//! App updates (specs/app-update.md): the decisions of "is there a newer version of this
//! app, and which file installs it here", without any network access. The app makes the one
//! request itself (to [`Repo::latest_release_api_url`], with [`Repo::request_headers`]) and
//! hands the response body to [`evaluate`]; this module reads it, compares versions, picks
//! the installer for the platform and keeps only files GitHub lists a SHA-256 for.
//!
//! Also here: when the daily check is due ([`check_due`]), and the version rules
//! ([`parse_version`], [`is_newer`], [`DEV_VERSION`]). Verify the download with
//! [`crate::sha256`].

mod json;

use std::time::{Duration, SystemTime};

use json::Json;

/// The version of a build made from source without a tag. It never checks by itself.
pub const DEV_VERSION: &str = "0.0.0";
/// The automatic check runs at most once in this time.
pub const CHECK_INTERVAL: Duration = Duration::from_secs(24 * 60 * 60);
/// The automatic check waits this long after start-up, so it never slows the start.
pub const STARTUP_DELAY: Duration = Duration::from_secs(10);
/// While the app runs, it asks [`check_due`] again this often.
pub const RECHECK_EVERY: Duration = Duration::from_secs(60 * 60);
/// The most of the response body the app should read; a release is far smaller.
pub const MAX_RESPONSE_BYTES: usize = 1 << 20;

/// `vMAJOR.MINOR.PATCH` (one to four numeric parts, optional leading `v`) as numbers.
pub fn parse_version(s: &str) -> Option<Vec<u64>> {
    let s = s.trim();
    let s = s.strip_prefix('v').unwrap_or(s);
    let parts: Vec<&str> = s.split('.').collect();
    if parts.is_empty() || parts.len() > 4 {
        return None;
    }
    parts
        .iter()
        .map(|p| if !p.is_empty() && p.len() <= 9 && p.bytes().all(|b| b.is_ascii_digit()) { p.parse().ok() } else { None })
        .collect()
}

/// True for [`DEV_VERSION`] (with or without `v`).
pub fn is_dev_version(v: &str) -> bool {
    parse_version(v).is_some_and(|p| p.iter().all(|n| *n == 0))
}

/// `candidate` is a higher version than `current`, part by part, missing parts counting as
/// zero. False when either is not a version.
pub fn is_newer(candidate: &str, current: &str) -> bool {
    let (Some(a), Some(b)) = (parse_version(candidate), parse_version(current)) else { return false };
    for i in 0..a.len().max(b.len()) {
        let (x, y) = (a.get(i).copied().unwrap_or(0), b.get(i).copied().unwrap_or(0));
        if x != y {
            return x > y;
        }
    }
    false
}

/// The automatic check should run now: the switch is on, the build has a real version, and
/// no check ran in the last [`CHECK_INTERVAL`]. A last check in the future (clock set back)
/// counts as due, so a wrong date never stops checks for good.
pub fn check_due(enabled: bool, current: &str, last_check: Option<SystemTime>, now: SystemTime) -> bool {
    if !enabled || parse_version(current).is_none() || is_dev_version(current) {
        return false;
    }
    match last_check {
        None => true,
        Some(last) => match now.duration_since(last) {
            Ok(elapsed) => elapsed >= CHECK_INTERVAL,
            Err(_) => true,
        },
    }
}

/// A GitHub repository, `owner/name`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Repo {
    owner: String,
    name: String,
}

impl Repo {
    /// Parses `owner/name`; only letters, digits, `-`, `_` and `.` (not `.` or `..`).
    pub fn parse(s: &str) -> Option<Repo> {
        let (owner, name) = s.trim().split_once('/')?;
        let ok = |p: &str| {
            !p.is_empty()
                && p.len() <= 100
                && p != "."
                && p != ".."
                && p.bytes().all(|b| b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.'))
        };
        (ok(owner) && ok(name)).then(|| Repo { owner: owner.to_owned(), name: name.to_owned() })
    }

    pub fn owner(&self) -> &str {
        &self.owner
    }

    pub fn name(&self) -> &str {
        &self.name
    }

    /// The one request the check makes: `GET` this, unauthenticated.
    pub fn latest_release_api_url(&self) -> String {
        format!("https://api.github.com/repos/{}/{}/releases/latest", self.owner, self.name)
    }

    /// The newest releases (one page of [`RELEASES_PER_PAGE`]), for an app whose platforms have
    /// their own tags (`mac-v1.3.0`): `releases/latest` may be another platform's release.
    pub fn releases_api_url(&self) -> String {
        format!("https://api.github.com/repos/{}/{}/releases?per_page={RELEASES_PER_PAGE}", self.owner, self.name)
    }

    /// The page of one release, by its tag, for "Get the new version" links.
    pub fn release_page_url(&self, tag: &str) -> String {
        format!("https://github.com/{}/{}/releases/tag/{tag}", self.owner, self.name)
    }

    /// The page of the newest release, for "Get the new version" links.
    pub fn latest_release_page_url(&self) -> String {
        format!("https://github.com/{}/{}/releases/latest", self.owner, self.name)
    }

    /// Every file the update may download starts with this.
    pub fn download_prefix(&self) -> String {
        format!("https://github.com/{}/{}/releases/download/", self.owner, self.name)
    }

    /// The only headers the request sends. No token, cookie or identifier.
    pub fn request_headers(&self) -> Vec<(&'static str, String)> {
        vec![
            ("Accept", "application/vnd.github+json".to_owned()),
            ("X-GitHub-Api-Version", "2022-11-28".to_owned()),
            ("User-Agent", self.name.clone()),
        ]
    }
}

/// How many releases [`Repo::releases_api_url`] asks for.
pub const RELEASES_PER_PAGE: u32 = 30;

/// The system an installer is for. [`Platform::GoogleTv`] and [`Platform::Chrome`] are never
/// detected: an Android app running on a TV passes `GoogleTv`, so it gets the TV build
/// (`…-google-tv.apk`, or any APK when there is none); a Chrome extension passes `Chrome`, which
/// has no installer file (it opens the release page), so only its tag prefix and version matter.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Platform {
    MacosArm64,
    MacosX64,
    WindowsX64,
    Android,
    GoogleTv,
    Chrome,
}

impl Platform {
    /// The tag prefix of this platform's own releases (`mac-v1.3.0`), for an app whose platforms
    /// have their own versions. Both macOS builds share `mac-`; a plain `v1.3.0` is every platform's.
    pub fn tag_prefix(self) -> &'static str {
        match self {
            Platform::MacosArm64 | Platform::MacosX64 => "mac-",
            Platform::WindowsX64 => "windows-",
            Platform::Android => "android-",
            Platform::GoogleTv => "google-tv-",
            Platform::Chrome => "chrome-",
        }
    }

    /// The platform this code was built for, if it is one apps are released for.
    pub fn current() -> Option<Platform> {
        if cfg!(target_os = "android") {
            Some(Platform::Android)
        } else if cfg!(target_os = "macos") && cfg!(target_arch = "aarch64") {
            Some(Platform::MacosArm64)
        } else if cfg!(target_os = "macos") && cfg!(target_arch = "x86_64") {
            Some(Platform::MacosX64)
        } else if cfg!(target_os = "windows") && cfg!(target_arch = "x86_64") {
            Some(Platform::WindowsX64)
        } else {
            None
        }
    }
}

/// A release file that may be downloaded: from this repository's releases, with a safe
/// name, a size and GitHub's SHA-256.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Asset {
    pub name: String,
    pub size: u64,
    pub url: String,
    /// 64 lowercase hex digits, from GitHub's `sha256:` digest.
    pub sha256: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Release {
    /// Without the `v` or a platform prefix.
    pub version: String,
    /// Only the files that pass the rules of [`Asset`]; others are left out.
    pub assets: Vec<Asset>,
}

/// A release found by [`parse_releases`], with its tag as it is (`v1.3.0`, `mac-v1.3.0`), for
/// [`Repo::release_page_url`].
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TaggedRelease {
    pub release: Release,
    pub tag: String,
}

impl Release {
    /// The first usable file whose name passes `matches` (for apps with their own names).
    pub fn find(&self, matches: impl Fn(&str) -> bool) -> Option<&Asset> {
        self.assets.iter().find(|a| matches(&a.name))
    }
}

/// Reads a `releases/latest` response. `None` when it is not JSON or its tag is not a version.
pub fn parse_release(json: &str, repo: &Repo) -> Option<Release> {
    let v = Json::parse(json)?;
    let tag = v.get("tag_name")?.as_str()?.trim();
    parse_version(tag)?;
    let version = tag.strip_prefix('v').unwrap_or(tag).to_owned();
    Some(Release { version, assets: assets_of(&v, repo) })
}

/// The version a tag gives `platform`: `v1.3.0` (every platform) or its own `<prefix>v1.3.0`
/// gives `1.3.0`; another platform's tag gives `None`.
pub fn tag_version(tag: &str, platform: Platform) -> Option<String> {
    let t = tag.trim();
    let bare = match t.strip_prefix(platform.tag_prefix()) {
        Some(rest) if rest.starts_with('v') => rest,
        Some(_) => return None,
        None => t,
    };
    parse_version(bare)?;
    Some(bare.strip_prefix('v').unwrap_or(bare).to_owned())
}

/// Reads a [`Repo::releases_api_url`] response (a list) and returns the newest release for
/// `platform`: its own tag or a plain one, never a draft or a pre-release.
pub fn parse_releases(json: &str, repo: &Repo, platform: Platform) -> Option<TaggedRelease> {
    let list = Json::parse(json)?;
    let mut best: Option<TaggedRelease> = None;
    for v in list.as_array()? {
        if matches!(v.get("draft"), Some(Json::Bool(true))) || matches!(v.get("prerelease"), Some(Json::Bool(true))) {
            continue;
        }
        let Some(tag) = v.get("tag_name").and_then(Json::as_str).map(str::trim) else { continue };
        let Some(version) = tag_version(tag, platform) else { continue };
        if best.as_ref().is_none_or(|b| is_newer(&version, &b.release.version)) {
            best = Some(TaggedRelease { release: Release { version, assets: assets_of(v, repo) }, tag: tag.to_owned() });
        }
    }
    best
}

/// Reads a [`Repo::releases_api_url`] response and decides. `None` when it cannot be read or has no release for `platform`.
pub fn evaluate_releases(json: &str, repo: &Repo, current: &str, platform: Platform) -> Option<Outcome> {
    let release = parse_releases(json, repo, platform)?.release;
    Some(decide(&release, current, pick_asset(&release.assets, platform, repo)))
}

fn assets_of(v: &Json, repo: &Repo) -> Vec<Asset> {
    let prefix = repo.download_prefix();
    v
        .get("assets")
        .and_then(Json::as_array)
        .unwrap_or_default()
        .iter()
        .filter_map(|a| {
            let name = a.get("name")?.as_str()?;
            if name.is_empty() || name.starts_with('.') || name.contains(['/', '\\']) || name.chars().any(char::is_control) {
                return None;
            }
            let url = a.get("browser_download_url")?.as_str()?;
            if !url.starts_with(&prefix) || url.contains("..") {
                return None;
            }
            let sha256 = a.get("digest")?.as_str()?.strip_prefix("sha256:")?.to_ascii_lowercase();
            if sha256.len() != 64 || !sha256.bytes().all(|b| b.is_ascii_hexdigit()) {
                return None;
            }
            let size = a.get("size")?.as_u64().filter(|s| *s > 0)?;
            Some(Asset { name: name.to_owned(), size, url: url.to_owned(), sha256 })
        })
        .collect()
}

fn has_any(name: &str, words: &[&str]) -> bool {
    words.iter().any(|w| name.contains(w))
}

const ARM: &[&str] = &["aarch64", "arm64", "apple-silicon"];

/// A TV build names itself: `ks-app-v1.2.0-google-tv.apk` (also `googletv`, `android-tv`, `-tv.`).
fn is_tv_build(n: &str) -> bool {
    if has_any(n, &["google-tv", "googletv", "android-tv", "androidtv"]) {
        return true;
    }
    let b = n.as_bytes();
    let sep = |c: u8| c == b'-' || c == b'_' || c == b'.';
    (1..b.len().saturating_sub(2)).any(|i| sep(b[i - 1]) && &b[i..i + 2] == b"tv" && sep(b[i + 2]))
}
const X64: &[&str] = &["x64", "x86_64", "amd64", "intel"];

/// The installer for `platform`, by the suite's file-name rules (specs/app-update.md):
/// a file made for the platform beats a universal one, and of two matches the larger wins.
pub fn pick_asset<'a>(assets: &'a [Asset], platform: Platform, repo: &Repo) -> Option<&'a Asset> {
    let repo_name = repo.name.to_ascii_lowercase();
    // 2: made for this platform; 1: universal; 0: not for it.
    let rank = |a: &Asset| -> u8 {
        let n = a.name.to_ascii_lowercase();
        match platform {
            Platform::MacosArm64 | Platform::MacosX64 if n.ends_with(".dmg") => {
                let own = if platform == Platform::MacosArm64 { ARM } else { X64 };
                if has_any(&n, own) {
                    2
                } else if !has_any(&n, ARM) && !has_any(&n, X64) {
                    1
                } else {
                    0
                }
            }
            Platform::WindowsX64 if !has_any(&n, ARM) => {
                let installer = n.ends_with(".msi")
                    || (n.ends_with(".exe") && (has_any(&n, &["setup", "install"]) || n.starts_with(&repo_name)));
                match (installer, has_any(&n, X64)) {
                    (true, true) => 2,
                    (true, false) => 1,
                    _ => 0,
                }
            }
            Platform::Android if n.ends_with(".apk") => 2,
            Platform::GoogleTv if n.ends_with(".apk") => {
                if is_tv_build(&n) {
                    2
                } else {
                    1
                }
            }
            _ => 0,
        }
    };
    assets.iter().filter(|a| rank(a) > 0).max_by_key(|a| (rank(a), a.size))
}

/// What a check found.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Outcome {
    /// Nothing newer; `version` is the running one.
    UpToDate { version: String },
    /// A newer version with a usable installer for this platform.
    Available { version: String, asset: Asset },
    /// A newer version, but no usable installer for this platform (yet).
    NoInstaller { version: String },
}

/// Reads the response and decides. `None` when the response cannot be read.
pub fn evaluate(json: &str, repo: &Repo, current: &str, platform: Platform) -> Option<Outcome> {
    let release = parse_release(json, repo)?;
    Some(decide(&release, current, pick_asset(&release.assets, platform, repo)))
}

/// The same as [`evaluate`] with the app's own choice of file.
pub fn decide(release: &Release, current: &str, asset: Option<&Asset>) -> Outcome {
    if !is_newer(&release.version, current) {
        return Outcome::UpToDate { version: current.trim_start_matches('v').to_owned() };
    }
    match asset {
        Some(a) => Outcome::Available { version: release.version.clone(), asset: a.clone() },
        None => Outcome::NoInstaller { version: release.version.clone() },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn platform_tags() {
        assert_eq!(tag_version("mac-v1.3.0", Platform::MacosX64).as_deref(), Some("1.3.0"));
        assert_eq!(tag_version("v1.2.0", Platform::WindowsX64).as_deref(), Some("1.2.0"));
        assert_eq!(tag_version("windows-v1.3.0", Platform::MacosArm64), None);
        assert_eq!(tag_version("mac-1.3.0", Platform::MacosArm64), None);
        let r = repo();
        assert_eq!(r.releases_api_url(), "https://api.github.com/repos/someone/ks-app/releases?per_page=30");
        assert_eq!(r.release_page_url("mac-v1.3.0"), "https://github.com/someone/ks-app/releases/tag/mac-v1.3.0");
        let sha = format!("sha256:{}", "a".repeat(64));
        let list = format!(
            "[{},{},{}]",
            release("windows-v2.0.0", &[asset("ks-app-v2.0.0-windows-x64.msi", 5, &sha)]),
            release("mac-v1.4.0", &[asset("ks-app-v1.4.0-macos-arm64.dmg", 5, &sha)]).replace(r#""body""#, r#""prerelease":true,"body""#),
            release("v1.2.0", &[asset("ks-app-v1.2.0-macos-arm64.dmg", 5, &sha), asset("ks-app-v1.2.0-windows-x64.msi", 5, &sha)]),
        );
        let mac = parse_releases(&list, &r, Platform::MacosArm64).unwrap();
        assert_eq!((mac.release.version.as_str(), mac.tag.as_str()), ("1.2.0", "v1.2.0"), "the pre-release is skipped");
        match evaluate_releases(&list, &r, "1.2.0", Platform::WindowsX64) {
            Some(Outcome::Available { version, asset }) => assert_eq!((version.as_str(), asset.name.as_str()), ("2.0.0", "ks-app-v2.0.0-windows-x64.msi")),
            other => panic!("{other:?}"),
        }
        assert_eq!(parse_releases("[]", &r, Platform::Android), None);
        assert_eq!(parse_releases("{}", &r, Platform::Android), None);
    }

    #[test]
    fn google_tv_and_chrome_tags() {
        assert_eq!(tag_version("google-tv-v1.3.0", Platform::GoogleTv).as_deref(), Some("1.3.0"));
        assert_eq!(tag_version("google-tv-v1.3.0", Platform::Android), None);
        assert_eq!(tag_version("android-v1.3.0", Platform::GoogleTv), None);
        assert_eq!(tag_version("chrome-v2.1.0", Platform::Chrome).as_deref(), Some("2.1.0"));
        assert_eq!(tag_version("chrome-v2.1.0", Platform::MacosArm64), None);
        assert_eq!(tag_version("v2.0.0", Platform::Chrome).as_deref(), Some("2.0.0"));
        let sha = format!("sha256:{}", "a".repeat(64));
        let r = repo();
        let both = parse_release(&release("v1.2.0", &[asset("ks-app-v1.2.0.apk", 9, &sha), asset("ks-app-v1.2.0-google-tv.apk", 5, &sha)]), &r).unwrap();
        let one = parse_release(&release("v1.2.0", &[asset("ks-app-v1.2.0.apk", 9, &sha), asset("ks-app-v1.2.0-extension.zip", 9, &sha)]), &r).unwrap();
        let name = |rel: &Release, p| pick_asset(&rel.assets, p, &r).map(|a| a.name.clone());
        assert_eq!(name(&both, Platform::GoogleTv).as_deref(), Some("ks-app-v1.2.0-google-tv.apk"));
        assert_eq!(name(&one, Platform::GoogleTv).as_deref(), Some("ks-app-v1.2.0.apk"), "no TV build: the plain APK");
        assert_eq!(name(&one, Platform::Chrome), None, "an extension has no installer");
        assert!(is_tv_build("ks-app_tv.apk") && is_tv_build("ks-app-androidtv.apk") && !is_tv_build("ks-tvlauncher.apk"));
    }

    fn repo() -> Repo {
        Repo::parse("someone/ks-app").unwrap()
    }

    fn asset(name: &str, size: u64, digest: &str) -> String {
        format!(
            r#"{{"name":"{name}","size":{size},"digest":"{digest}","browser_download_url":"https://github.com/someone/ks-app/releases/download/v1.2.0/{name}"}}"#
        )
    }

    fn release(tag: &str, assets: &[String]) -> String {
        format!(r#"{{"tag_name":"{tag}","body":"notes \"quoted\"","assets":[{}]}}"#, assets.join(","))
    }

    fn sha(c: char) -> String {
        format!("sha256:{}", c.to_string().repeat(64))
    }

    #[test]
    fn versions() {
        assert_eq!(parse_version("v1.2.3"), Some(vec![1, 2, 3]));
        assert_eq!(parse_version("1.2.3.4.5"), None);
        assert_eq!(parse_version("1..2"), None);
        assert_eq!(parse_version("../evil"), None);
        assert_eq!(parse_version("1.2.3-beta"), None);
        assert!(is_newer("0.1.10", "0.1.9"));
        assert!(is_newer("v1.0.0", "0.9.9"));
        assert!(is_newer("1.0.1", "1.0"));
        assert!(!is_newer("1.0.0", "1"));
        assert!(!is_newer("0.1.3", "0.1.3"));
        assert!(!is_newer("0.1.2", "0.1.3"));
        assert!(!is_newer("x", "0.1.3"));
        assert!(is_dev_version("0.0.0") && is_dev_version("v0.0.0") && !is_dev_version("0.0.1"));
    }

    #[test]
    fn daily_check() {
        let now = SystemTime::now();
        assert!(check_due(true, "1.0.0", None, now));
        assert!(!check_due(false, "1.0.0", None, now), "switch off");
        assert!(!check_due(true, DEV_VERSION, None, now), "built from source");
        assert!(!check_due(true, "unknown", None, now));
        assert!(!check_due(true, "1.0.0", Some(now - Duration::from_secs(60)), now));
        assert!(check_due(true, "1.0.0", Some(now - CHECK_INTERVAL), now));
        assert!(check_due(true, "1.0.0", Some(now + Duration::from_secs(3600)), now), "clock set back");
    }

    #[test]
    fn repo_and_urls() {
        let r = repo();
        assert_eq!(r.latest_release_api_url(), "https://api.github.com/repos/someone/ks-app/releases/latest");
        assert_eq!(r.latest_release_page_url(), "https://github.com/someone/ks-app/releases/latest");
        assert!(r.request_headers().iter().all(|(k, _)| ["Accept", "X-GitHub-Api-Version", "User-Agent"].contains(k)));
        for bad in ["someone", "a/b/c", "../x", "a/..", "a b/c", "/x", "a/"] {
            assert!(Repo::parse(bad).is_none(), "{bad}");
        }
    }

    #[test]
    fn picks_the_installer_for_each_platform() {
        let names = [
            ("ks-app-v1.2.0-macos-arm64.dmg", 10),
            ("ks-app-v1.2.0-macos-x64.dmg", 11),
            ("ks-app-v1.2.0-windows-x64-setup.exe", 12),
            ("ks-app-v1.2.0.apk", 13),
            ("ks-app-extension-v1.2.0.zip", 14),
            ("ffmpeg.exe", 99),
        ];
        let assets: Vec<String> = names.iter().map(|(n, s)| asset(n, *s, &sha('a'))).collect();
        let r = parse_release(&release("v1.2.0", &assets), &repo()).unwrap();
        assert_eq!(r.version, "1.2.0");
        let pick = |p| pick_asset(&r.assets, p, &repo()).map(|a| a.name.as_str());
        assert_eq!(pick(Platform::MacosArm64), Some("ks-app-v1.2.0-macos-arm64.dmg"));
        assert_eq!(pick(Platform::MacosX64), Some("ks-app-v1.2.0-macos-x64.dmg"));
        assert_eq!(pick(Platform::WindowsX64), Some("ks-app-v1.2.0-windows-x64-setup.exe"));
        assert_eq!(pick(Platform::Android), Some("ks-app-v1.2.0.apk"));
        assert_eq!(r.find(|n| n.ends_with(".zip")).map(|a| a.size), Some(14));
    }

    #[test]
    fn universal_files_and_size() {
        let assets = [asset("ks-app.dmg", 5, &sha('a')), asset("ks-app.msi", 6, &sha('a')), asset("ks-app-small.apk", 1, &sha('a')), asset("ks-app-universal.apk", 9, &sha('a'))];
        let r = parse_release(&release("1.2.0", &assets), &repo()).unwrap();
        let pick = |p| pick_asset(&r.assets, p, &repo()).map(|a| a.name.as_str());
        assert_eq!(pick(Platform::MacosArm64), Some("ks-app.dmg"));
        assert_eq!(pick(Platform::MacosX64), Some("ks-app.dmg"));
        assert_eq!(pick(Platform::WindowsX64), Some("ks-app.msi"));
        assert_eq!(pick(Platform::Android), Some("ks-app-universal.apk"), "the larger wins");
    }

    #[test]
    fn unsafe_or_unchecked_files_are_dropped() {
        let elsewhere = format!(r#"{{"name":"a.apk","size":1,"digest":"{}","browser_download_url":"https://example.com/a.apk"}}"#, sha('b'));
        let other_repo = format!(r#"{{"name":"a.apk","size":1,"digest":"{}","browser_download_url":"https://github.com/someone/ks-app-evil/releases/download/v1/a.apk"}}"#, sha('b'));
        let assets = [
            asset("nodigest.apk", 1, "md5:abc"),
            asset("short.apk", 1, "sha256:abc"),
            asset("empty.apk", 0, &sha('c')),
            asset(".hidden.apk", 1, &sha('c')),
            elsewhere,
            other_repo,
        ];
        let r = parse_release(&release("v1.2.0", &assets), &repo()).unwrap();
        assert!(r.assets.is_empty(), "{:?}", r.assets);
        assert!(parse_release(&release("../evil", &[]), &repo()).is_none());
        assert!(parse_release("not json", &repo()).is_none());
    }

    #[test]
    fn outcomes() {
        let json = release("v1.2.0", &[asset("ks-app-v1.2.0.apk", 3, &sha('A'))]);
        let r = repo();
        match evaluate(&json, &r, "1.1.0", Platform::Android) {
            Some(Outcome::Available { version, asset }) => {
                assert_eq!(version, "1.2.0");
                assert_eq!(asset.sha256, "a".repeat(64), "lowercased");
            }
            other => panic!("{other:?}"),
        }
        assert_eq!(evaluate(&json, &r, "1.2.0", Platform::Android), Some(Outcome::UpToDate { version: "1.2.0".into() }));
        assert_eq!(evaluate(&json, &r, "1.1.0", Platform::WindowsX64), Some(Outcome::NoInstaller { version: "1.2.0".into() }));
        assert_eq!(evaluate("{}", &r, "1.1.0", Platform::Android), None);
    }
}
