---
type: Specification
title: App updates
description: How every KS-Suite app finds a newer version of itself on GitHub, shows it in an "App updates" section, and installs it on each platform, with the shared helpers in Kotlin, Rust and TypeScript.
tags: [update, github, release, checksum, settings, android, macos, windows, chrome-extension]
---

# App updates

Every KS-Suite app tells the user when a newer version of itself is out and, where the platform allows, downloads and installs it. The behaviour below is the same in every app; the helpers in this repository hold the decisions, and the app does the request, the download and the hand-over to the system. Reference implementation: `ks-download-manager` (`src-tauri/src/appupdate.rs`, its `specs/ui.md` "App updates").

## Shared behaviour

### When it checks
- **On demand:** when the user presses **Check for updates**.
- **Automatically**, while **Check for updates automatically** is on (on by default): 10 s after start-up, then again every hour while the app runs, each time only if the check is due (`isCheckDue` / `check_due`): the build has a real version, and no check ran in the last 24 hours. A last check in the future (clock set back) counts as due. Android and TV apps also ask when they come back to the foreground.
- The app saves the time of the last check that got a response from GitHub (in its own settings, any format). A request that failed for lack of network is not recorded, so the next start or hour tries again.
- **Never by itself for a build from source** (`0.0.0`, `DEV_VERSION`). The button still works there and reports what it finds.
- A failed automatic check is only logged; the user sees errors only from the button.

### What it sends
- One request: `GET https://api.github.com/repos/<owner>/<repo>/releases/latest` (`latestReleaseApiUrl`), unauthenticated, with only the headers from `requestHeaders`: `Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2022-11-28`, and `User-Agent: <repo name>` (GitHub requires one; a browser sets its own). No token, cookie, device or user identifier, and nothing about the app's data.
- Read at most 1 MiB of the response (`MAX_RESPONSE_BYTES`). A non-200 answer (including 404 for "no release yet" and 403/429 rate limits) is an error for the button and silence for the automatic check.
- KS Utility itself never opens a connection ([Rules](rules.md)): the app makes the request with its own HTTP client and passes the body to `evaluate`.
- **Privacy note the app must show**, next to the switch: "Once a day, the app asks GitHub whether a newer version is out. Nothing else is sent." (`common.appUpdate.autoHint`). An app whose privacy promise is "no network unless the user asks" names this request as its one exception in its own spec and first-run text. An app whose rules forbid all network access (`ks-vault`, `ks-expense-manager`: no `INTERNET` permission) has no check at all: its App updates section shows the version and **Get the new version** (`common.appUpdate.getButton`), which opens `releasePageUrl` in the user's browser, so the browser makes the request, not the app.

### Versions
- A version is `vMAJOR.MINOR.PATCH`: one to four numeric parts, optional leading `v`, nothing else (`1.2.3-beta` is not a version; such a tag is ignored). Parts compare as numbers, a missing part counts as zero (`1.0` equals `1.0.0`).
- An update is offered only when the release's tag is strictly higher than the running version. The running version comes from the build (`-PversionName`, the Tauri/Cargo version), which comes from the git tag ([versioning](https://github.com/kumasumit/ks-suite/blob/main/specs/versioning-signing.md)).
- `releases/latest` never returns drafts or pre-releases, so a beta is offered only to whoever installs it by hand.

### Platform tags
An app whose platforms have their own versions (from `v0.10.0`; the suite's [versioning](https://github.com/kumasumit/ks-suite/blob/main/specs/versioning-signing.md)) tags each platform's release `<platform>-vMAJOR.MINOR.PATCH`: `android-`, `google-tv-`, `mac-` (both macOS builds), `windows-` or, from `v0.11.0`, `chrome-` for a Chrome extension (`UpdatePlatform.tagPrefix`, `tag_prefix`, `tagPrefix`; `google-tv-` in Rust and TypeScript from `v0.11.0`). A plain `vMAJOR.MINOR.PATCH` is still a release of every platform.
- Such an app asks `GET https://api.github.com/repos/<owner>/<repo>/releases?per_page=30` (`releasesApiUrl`) instead of `releases/latest`, which may be another platform's release, with the same headers and the same 1 MiB limit, and passes the body to `evaluateReleases`.
- `parseReleases` takes, of the releases on that page, the highest version whose tag is this platform's own or a plain one, skipping drafts and pre-releases. Another platform's tag is never offered (`tagVersion` returns null for it).
- "Get the new version" opens that release's page (`releasePageUrl(tag)`, `release_page_url`, `releaseTagPageUrl`), not `releases/latest`.
- A platform release is not marked latest ([release workflow](release-workflow.md)), so `releases/latest` stays the last release of every platform. **Bridge release:** copies installed before the switch read only `releases/latest`, so the app ships one plain `vX.Y.Z` release whose builds read the release list, before its first platform tag. Each platform's first own version is higher than that bridge version.

### Which file
Assets are matched by file name, case-insensitive, following the same rules as the suite's landing page:

| Platform | Made for it (preferred) | Universal (fallback) |
|---|---|---|
| macOS Apple silicon | `.dmg` containing `aarch64`, `arm64` or `apple-silicon` | `.dmg` with no architecture in its name |
| macOS Intel | `.dmg` containing `x64`, `x86_64`, `amd64` or `intel` | the same |
| Windows x64 | `.msi`, or `.exe` with `setup` or `install` in its name or starting with the repository name, containing `x64`, `x86_64`, `amd64` or `intel`; never one naming `arm64`/`aarch64` | the same without an architecture |
| Android | an `.apk` whose name is not a TV build (`.aab` ignored) | — |
| Google TV | the TV build, an `.apk` named `…-google-tv.apk` (also `googletv`, `android-tv`, `-tv.`) | any other `.apk` (an app with one APK for phone and TV, or a TV-only app) |

Of two matches of the same kind, the larger wins (a universal APK over a split one). An app with other names uses `Release.find(predicate)` instead of `pickAsset` and passes the result to `decide`.

### Which files are trusted
An asset is used only when all hold; anything else is dropped before matching:
- its URL starts with `https://github.com/<owner>/<repo>/releases/download/` (this app's own releases) and has no `..`;
- its name is a single file name (no `/`, `\`, control character, or leading `.`);
- GitHub lists a `digest` of the form `sha256:<64 hex digits>`, and a size above zero.

After downloading, the app computes the SHA-256 of the file (`Sha256` / `sha256_file` / `sha256Hex`) and compares it with the asset's (`sha256Matches`). On a mismatch it deletes the file, opens nothing, and says so (`common.appUpdate.damaged`). Downloads go to the app's own data or cache folder, in a subfolder emptied before each download.

## The "App updates" section
Every app's settings has an **App updates** section, as in `ks-download-manager`:

1. "This is version X." (`common.appUpdate.current`), or for `0.0.0` "This copy was built from source…" (`common.appUpdate.dev`).
2. The switch **Check for updates automatically** (`common.appUpdate.auto`) with the privacy note under it (`common.appUpdate.autoHint`).
3. The **Check for updates** button (`common.appUpdate.checkButton`) and a status line beside it: "Checking…", "You have the newest version (X).", "Version X is available.", "Version X has no installer for this system yet." or the error.
4. When an update is found: **Download and install (size)** (`common.appUpdate.installButton`, size formatted with `formatBytes`), then the downloading line and the platform's "opened" text. Where the app cannot install itself (Chrome extension), **Get the new version** (`common.appUpdate.getButton`) opens `releasePageUrl` instead.

The app may also show a bar or notice outside settings when the automatic check finds an update ("Version X is available." with the install button and **Later**, `common.appUpdate.later`); **Later** hides it for that version only.

All texts are in the shared catalogue under `common.appUpdate.*` (English and Hindi, [Hindi style guide](hindi-style.md)); an app adds only what is its own.

## How each platform installs
The install step is the user's own: the app only hands the verified file to the system. No updater framework and no new dependency.

- **Desktop helper** (from `v0.15.0`): `DesktopInstaller(appName, beforeQuit).open(file)` (Kotlin, `com.ks.utility.appupdate`) and `app_update::install::open(file, app_name)` (Rust) do the two steps below, so an app does not write them itself. Kotlin quits by itself; Rust returns `Opened::Mac` or `Opened::Windows`, and the Tauri app quits (`app.exit`) after its own clean-up: at once on Windows, after `MAC_QUIT_AFTER` on macOS. In the TypeScript store, the app's `install()` then resolves to `"macos-closes"` (from `v0.17.0`) for `Opened::Mac`, so `openedNote` gives `openedMacCloses`; `MAC_QUIT_AFTER_MS` is the delay. `"macos"` keeps giving `openedMac` for an app that does not quit. Another system or file is an error (`common.appUpdate.openFailed`). Nothing is installed silently.
- **macOS:** quarantine the `.dmg` as a browser download would (`com.apple.quarantine`, so Gatekeeper checks it) and open it. Then show `common.appUpdate.openedMacCloses` ("The disk image is open. {app} now closes: drag it into Applications, choose Replace, then open it again.", `{app}` the app's name), and after 6 seconds save and quit, because Finder cannot replace an app that is running. `common.appUpdate.openedMac` (no quitting) stays for an app that has not moved to the helper yet.
- **Windows:** mark the installer with the internet zone (`Zone.Identifier`, zone 3, so SmartScreen checks it), start it (`msiexec /i` for an `.msi`), then save and quit at once so it can be replaced (`common.appUpdate.openedWindows`).
- **Android (phone and TV):** download the APK with the app's own HTTP client into its cache folder, verify the SHA-256, then hand it to the system installer: `PackageInstaller` session, or an `ACTION_VIEW`/`ACTION_INSTALL_PACKAGE` intent with a `content://` URI from a `FileProvider` and `FLAG_GRANT_READ_URI_PERMISSION` (`common.appUpdate.openedAndroid`). This needs:
  - `android.permission.REQUEST_INSTALL_PACKAGES` in the manifest;
  - from Android 8, the user's "install unknown apps" permission for this app: if `packageManager.canRequestPackageInstalls()` is false, show `common.appUpdate.allowInstall` with **Open system settings** (`common.appUpdate.allowInstallButton`), which opens `Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES` with `package:<the app's id>`; when the user comes back, try again;
  - the APK signed with the same key as the installed app (the suite's release signing), or Android refuses the update.
  An app distributed through a store that forbids self-updates leaves the install button out there and shows **Get the new version** instead. This Android glue lives in each app (it needs the Android SDK, which this repository does not use).
- **Chrome extension:** an extension loaded unpacked cannot update itself and never checks the network on its own. It shows "Version X is available." with **Get the new version**, which opens `releasePageUrl`, and `common.appUpdate.extensionHint`. Where a desktop app pairs with the extension, the app's check supplies the version (as in `ks-download-manager`); otherwise the extension compares with `isNewerVersion` against a version it was given, and makes no request of its own.

## API
Same names in each language, written in its own style. None of them opens a connection.

| Purpose | Kotlin (`com.ks.utility.appupdate`) | Rust (`ks_utility::app_update`, `ks_utility::sha256`) | TypeScript (`ks-utility`) |
|---|---|---|---|
| Constants | `AppUpdate.DEV_VERSION`, `CHECK_INTERVAL_MS`, `STARTUP_DELAY_MS`, `RECHECK_EVERY_MS`, `MAX_RESPONSE_BYTES` | `DEV_VERSION`, `CHECK_INTERVAL`, `STARTUP_DELAY`, `RECHECK_EVERY`, `MAX_RESPONSE_BYTES` | `DEV_VERSION`, `CHECK_INTERVAL_MS`, `STARTUP_DELAY_MS`, `RECHECK_EVERY_MS`, `MAX_RESPONSE_BYTES` |
| Versions | `AppUpdate.parseVersion`, `isNewer`, `isDevVersion` | `parse_version`, `is_newer`, `is_dev_version` | `parseVersion`, `isNewerVersion`, `isDevVersion` |
| Daily schedule | `AppUpdate.isCheckDue(enabled, current, lastCheckMs?, nowMs)` | `check_due(enabled, current, Option<SystemTime>, SystemTime)` | `isCheckDue(enabled, current, lastCheckMs \| null, nowMs)` |
| Repository and request | `GitHubRepo.parse("owner/name")`, `.latestReleaseApiUrl`, `.latestReleasePageUrl`, `.downloadPrefix`, `.requestHeaders` | `Repo::parse`, `.latest_release_api_url()`, `.latest_release_page_url()`, `.download_prefix()`, `.request_headers()` | `parseRepo`, `latestReleaseApiUrl`, `releasePageUrl`, `downloadPrefix`, `requestHeaders` |
| Platform | `UpdatePlatform` (`MACOS_ARM64`, `MACOS_X64`, `WINDOWS_X64`, `ANDROID`, `GOOGLE_TV`, from `v0.11.0` `CHROME`), `.current()`, `.detect(...)`; an Android app running on a TV passes `GOOGLE_TV` itself (never detected), so a phone never installs a TV build and a TV never a phone build. A Chrome extension passes `CHROME` (never detected): it has no installer file, so `pickAsset` finds none and only the tag matters | `Platform` (from `v0.11.0` also `GoogleTv`, `Chrome`, never detected), `Platform::current()` | `Platform` (`"macos-arm64"`, …, from `v0.11.0` also `"google-tv"`, `"chrome"`); the app supplies it |
| Read the response | `AppUpdate.parseRelease(json, repo)` → `Release(version, assets, tag)` | `parse_release(json, &repo)` → `Release` | `parseRelease(textOrObject, repo)` → `Release` (`tag` added) |
| Platform tags (from `v0.10.0`) | `UpdatePlatform.tagPrefix`, `AppUpdate.tagVersion(tag, platform)`, `GitHubRepo.releasesApiUrl`, `.releasePageUrl(tag)`, `AppUpdate.parseReleases(json, repo, platform)`, `evaluateReleases(json, repo, current, platform)` | `Platform::tag_prefix()`, `tag_version`, `Repo::releases_api_url()`, `.release_page_url(tag)`, `parse_releases` → `TaggedRelease { release, tag }`, `evaluate_releases` | `tagPrefix`, `tagVersion`, `releasesApiUrl`, `releaseTagPageUrl`, `parseReleases`, `evaluateReleases` |
| Choose the file | `AppUpdate.pickAsset`, `Release.find` | `pick_asset`, `Release::find` | `pickAsset` |
| Decide | `AppUpdate.evaluate` / `decide` → `UpdateOutcome` (`UpToDate`, `Available`, `NoInstaller`); null = unreadable | `evaluate` / `decide` → `Outcome`; `None` = unreadable | `evaluateRelease` / `decide` → `Outcome` (`result`: `upToDate`, `available`, `noInstaller`); null = unreadable |
| Checksum | `Sha256.hex(bytes \| stream \| file)`, `Sha256.matches` | `Sha256`, `sha256_hex`, `sha256_reader`, `sha256_file`, `sha256_matches` | `sha256Hex` (Web Crypto), `sha256Matches` |
| Section state | — (Compose apps hold it in their view model) | — | `createUpdateStore(driver, appName)`: `getState`, `subscribe` (fits `useSyncExternalStore`), `setCurrent`, `setAvailable`, `checkNow`, `installNow`, `dismiss`, `showBanner`; notes are `{ key, params }` for the app's translator; `openedNote` |

The Rust and Kotlin parts read the JSON with a small private reader, since they have no dependencies. In a Tauri app the Rust side checks, downloads and opens, and the TypeScript store drives the interface through the app's commands (`UpdateDriver.check`, `install`).
