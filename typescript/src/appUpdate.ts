// App updates (specs/app-update.md): the decisions of "is there a newer version of this app,
// and which file installs it here", and the state behind an app's "App updates" section.
// No network access: the app makes the one request to `latestReleaseApiUrl(repo)` with
// `requestHeaders(repo)` and passes the response to `evaluateRelease`.
import type { Params } from "./lang/catalog.ts";

/** The version of a build made from source without a tag. It never checks by itself. */
export const DEV_VERSION = "0.0.0";
/** The automatic check runs at most once in this time (ms). */
export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
/** The automatic check waits this long after start-up (ms). */
export const STARTUP_DELAY_MS = 10 * 1000;
/** While the app runs, it asks `isCheckDue` again this often (ms). */
export const RECHECK_EVERY_MS = 60 * 60 * 1000;
/** The most of the response body the app should read. */
export const MAX_RESPONSE_BYTES = 1 << 20;

/** `vMAJOR.MINOR.PATCH` (one to four numeric parts, optional leading `v`) as numbers. */
export function parseVersion(s: unknown): number[] | null {
  if (typeof s !== "string") return null;
  const m = /^v?(\d{1,9}(?:\.\d{1,9}){0,3})$/.exec(s.trim());
  return m ? m[1].split(".").map(Number) : null;
}

/** True for `0.0.0` (with or without `v`). */
export function isDevVersion(v: string): boolean {
  const p = parseVersion(v);
  return p !== null && p.every((n) => n === 0);
}

/** `candidate` is a higher version than `current`; false when either is not a version. */
export function isNewerVersion(candidate: unknown, current: unknown): boolean {
  const a = parseVersion(candidate);
  const b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return false;
}

/**
 * The automatic check should run now: the switch is on, the build has a real version, and no
 * check ran in the last day. A last check in the future (clock set back) counts as due.
 * `lastCheck` and `now` are milliseconds since 1970 (`Date.now()`); null when never checked.
 */
export function isCheckDue(enabled: boolean, current: string, lastCheck: number | null, now: number): boolean {
  if (!enabled || parseVersion(current) === null || isDevVersion(current)) return false;
  if (lastCheck === null || !Number.isFinite(lastCheck)) return true;
  return now < lastCheck || now - lastCheck >= CHECK_INTERVAL_MS;
}

/** A GitHub repository. */
export interface Repo {
  owner: string;
  name: string;
}

const REPO_PART = /^(?!\.{1,2}$)[A-Za-z0-9._-]{1,100}$/;

/** Parses `owner/name`; null when it is not one. */
export function parseRepo(s: string): Repo | null {
  const parts = s.trim().split("/");
  if (parts.length !== 2 || !parts.every((p) => REPO_PART.test(p))) return null;
  return { owner: parts[0], name: parts[1] };
}

/** The one request the check makes: `GET` this, unauthenticated. */
export function latestReleaseApiUrl(repo: Repo): string {
  return `https://api.github.com/repos/${repo.owner}/${repo.name}/releases/latest`;
}

/** How many releases `releasesApiUrl` asks for. */
export const RELEASES_PER_PAGE = 30;

/**
 * The newest releases (one page), for an app whose platforms have their own tags (`mac-v1.3.0`):
 * `releases/latest` may be another platform's release.
 */
export function releasesApiUrl(repo: Repo): string {
  return `https://api.github.com/repos/${repo.owner}/${repo.name}/releases?per_page=${RELEASES_PER_PAGE}`;
}

/** The page of one release, by its tag, for "Get the new version" links. */
export function releaseTagPageUrl(repo: Repo, tag: string): string {
  return `https://github.com/${repo.owner}/${repo.name}/releases/tag/${tag}`;
}

/** The page of the newest release, for "Get the new version" links. */
export function releasePageUrl(repo: Repo): string {
  return `https://github.com/${repo.owner}/${repo.name}/releases/latest`;
}

/** Every file the update may download starts with this. */
export function downloadPrefix(repo: Repo): string {
  return `https://github.com/${repo.owner}/${repo.name}/releases/download/`;
}

/** The only headers the request sends. No token, cookie or identifier. (Browsers set their own User-Agent.) */
export function requestHeaders(repo: Repo): Record<string, string> {
  return { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": repo.name };
}

/**
 * The system an installer is for. `google-tv` and `chrome` are never detected: an Android app
 * running on a TV passes `google-tv`, so it gets the TV build (`…-google-tv.apk`, or any APK when
 * there is none); a Chrome extension passes `chrome`, which has no installer file (it opens the
 * release page), so only its tag prefix and version matter.
 */
export type Platform = "macos-arm64" | "macos-x64" | "windows-x64" | "android" | "google-tv" | "chrome";

/**
 * The tag prefix of a platform's own releases (`mac-v1.3.0`), for an app whose platforms have
 * their own versions. Both macOS builds share `mac-`; a plain `v1.3.0` is every platform's.
 */
export function tagPrefix(platform: Platform): string {
  switch (platform) {
    case "macos-arm64":
    case "macos-x64":
      return "mac-";
    case "windows-x64":
      return "windows-";
    case "android":
      return "android-";
    case "google-tv":
      return "google-tv-";
    case "chrome":
      return "chrome-";
  }
}

/** The version a tag gives `platform` (`mac-v1.3.0` or `v1.3.0` → `1.3.0`); null for another platform's tag. */
export function tagVersion(tag: string, platform: Platform): string | null {
  const t = tag.trim();
  const prefix = tagPrefix(platform);
  const bare = t.startsWith(prefix) ? t.slice(prefix.length) : t;
  if (bare !== t && !bare.startsWith("v")) return null;
  return parseVersion(bare) === null ? null : bare.replace(/^v/, "");
}

/** A release file that may be downloaded: this repository's, safe name, size, GitHub's SHA-256. */
export interface Asset {
  name: string;
  size: number;
  url: string;
  /** 64 lowercase hex digits. */
  sha256: string;
}

export interface Release {
  /** Without the `v`. */
  version: string;
  /** Only the files that pass the rules of `Asset`. */
  assets: Asset[];
  /** The tag as it is (`v1.3.0`, `mac-v1.3.0`), for `releaseTagPageUrl`. */
  tag?: string;
}

function get(o: unknown, k: string): unknown {
  return typeof o === "object" && o !== null && !Array.isArray(o) ? (o as Record<string, unknown>)[k] : undefined;
}

/** Reads a `releases/latest` response (text or parsed JSON); null when its tag is not a version. */
function parsed(response: unknown): unknown {
  if (typeof response !== "string") return response;
  try {
    return JSON.parse(response);
  } catch {
    return undefined;
  }
}

export function parseRelease(response: unknown, repo: Repo): Release | null {
  const v = parsed(response);
  const tag = get(v, "tag_name");
  if (typeof tag !== "string" || parseVersion(tag) === null) return null;
  return { version: tag.trim().replace(/^v/, ""), assets: assetsOf(v, repo), tag: tag.trim() };
}

/**
 * Reads a `releasesApiUrl` response (a list, text or parsed) and returns the newest release for
 * `platform`: its own tag or a plain one, never a draft or a pre-release.
 */
export function parseReleases(response: unknown, repo: Repo, platform: Platform): Release | null {
  const list = parsed(response);
  if (!Array.isArray(list)) return null;
  let best: Release | null = null;
  for (const v of list) {
    if (get(v, "draft") === true || get(v, "prerelease") === true) continue;
    const tag = get(v, "tag_name");
    if (typeof tag !== "string") continue;
    const version = tagVersion(tag, platform);
    if (version === null) continue;
    if (best === null || isNewerVersion(version, best.version)) best = { version, assets: assetsOf(v, repo), tag: tag.trim() };
  }
  return best;
}

/** Reads a `releasesApiUrl` response and decides; null when it cannot be read or has no release for `platform`. */
export function evaluateReleases(response: unknown, repo: Repo, current: string, platform: Platform): Outcome | null {
  const release = parseReleases(response, repo, platform);
  return release && decide(release, current, pickAsset(release.assets, platform, repo));
}

function assetsOf(v: unknown, repo: Repo): Asset[] {
  const prefix = downloadPrefix(repo);
  const raw = get(v, "assets");
  const assets: Asset[] = [];
  for (const a of Array.isArray(raw) ? raw : []) {
    const name = get(a, "name");
    const url = get(a, "browser_download_url");
    const digest = get(a, "digest");
    const size = get(a, "size");
    if (typeof name !== "string" || !name || name.startsWith(".") || /[/\\\p{Cc}]/u.test(name)) continue;
    if (typeof url !== "string" || !url.startsWith(prefix) || url.includes("..")) continue;
    if (typeof digest !== "string" || !/^sha256:[0-9a-fA-F]{64}$/.test(digest)) continue;
    if (typeof size !== "number" || !Number.isSafeInteger(size) || size <= 0) continue;
    assets.push({ name, size, url, sha256: digest.slice(7).toLowerCase() });
  }
  return assets;
}

const ARM = ["aarch64", "arm64", "apple-silicon"];
const X64 = ["x64", "x86_64", "amd64", "intel"];
const hasAny = (n: string, words: string[]) => words.some((w) => n.includes(w));

/** 2: made for the platform; 1: universal; 0: not for it. */
/** A TV build names itself: `ks-app-v1.2.0-google-tv.apk` (also `googletv`, `android-tv`, `-tv.`). */
const TV = /google-?tv|android-?tv|[-_.]tv[-_.]/;

function rank(name: string, platform: Platform, repo: Repo): number {
  const n = name.toLowerCase();
  switch (platform) {
    case "macos-arm64":
    case "macos-x64": {
      if (!n.endsWith(".dmg")) return 0;
      if (hasAny(n, platform === "macos-arm64" ? ARM : X64)) return 2;
      return hasAny(n, ARM) || hasAny(n, X64) ? 0 : 1;
    }
    case "windows-x64": {
      if (hasAny(n, ARM)) return 0;
      const installer = n.endsWith(".msi") || (n.endsWith(".exe") && (hasAny(n, ["setup", "install"]) || n.startsWith(repo.name.toLowerCase())));
      if (!installer) return 0;
      return hasAny(n, X64) ? 2 : 1;
    }
    case "android":
      return n.endsWith(".apk") ? 2 : 0;
    case "google-tv":
      return n.endsWith(".apk") ? (TV.test(n) ? 2 : 1) : 0;
    case "chrome":
      return 0;
  }
}

/** The installer for `platform`: a file made for it beats a universal one; of two, the larger wins. */
export function pickAsset(assets: Asset[], platform: Platform, repo: Repo): Asset | null {
  let best: Asset | null = null;
  let bestRank = 0;
  for (const a of assets) {
    const r = rank(a.name, platform, repo);
    if (r > bestRank || (r > 0 && r === bestRank && best !== null && a.size > best.size)) {
      best = a;
      bestRank = r;
    }
  }
  return best;
}

export type Outcome =
  | { result: "upToDate"; version: string }
  | { result: "available"; version: string; asset: Asset }
  | { result: "noInstaller"; version: string };

/** Decides from a parsed release and the app's choice of file. */
export function decide(release: Release, current: string, asset: Asset | null): Outcome {
  if (!isNewerVersion(release.version, current)) return { result: "upToDate", version: current.trim().replace(/^v/, "") };
  return asset ? { result: "available", version: release.version, asset } : { result: "noInstaller", version: release.version };
}

/** Reads the response and decides; null when the response cannot be read. */
export function evaluateRelease(response: unknown, repo: Repo, current: string, platform: Platform): Outcome | null {
  const release = parseRelease(response, repo);
  return release && decide(release, current, pickAsset(release.assets, platform, repo));
}

/** The SHA-256 of `data` as 64 lowercase hex digits (Web Crypto, built into browsers and Node). */
export async function sha256Hex(data: BufferSource): Promise<string> {
  const d = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", data));
  return Array.from(d, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** True when `expected` is 64 hex digits (any case) equal to `actual`. */
export function sha256Matches(actual: string, expected: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(expected) && actual.toLowerCase() === expected.toLowerCase();
}

// ----- The state behind an "App updates" section -----

/** A text to show: a key of the shared catalogue (`common.appUpdate.*`) or the app's own, with parameters. */
export interface UpdateNote {
  key: string;
  params?: Params;
}

/** "failed": the last install attempt failed; the note says why, and it can be tried again. */
export type UpdatePhase = "idle" | "checking" | "downloading" | "opened" | "failed";

/** A newer version, as the interface shows it. */
export interface UpdateInfo {
  version: string;
  /** Bytes of the installer, when one can be installed from the app. */
  size?: number;
}

export type CheckResult =
  | { result: "upToDate"; version: string }
  | { result: "available"; update: UpdateInfo }
  | { result: "noInstaller"; version: string };

/**
 * How the installer was handed to the system. "windows": the app should now quit.
 * "macos-closes" (from v0.17.0): the disk image was opened by ks-utility's desktop helper
 * (Rust `app_update::install::open`, `Opened::Mac`), and the app quits after
 * `MAC_QUIT_AFTER_MS` so Finder can replace it. "macos": opened without quitting (older apps).
 */
export type Opened = "macos" | "macos-closes" | "windows" | "android";

/** How long the Mac app shows that it now closes before it quits (as Rust's `MAC_QUIT_AFTER`). */
export const MAC_QUIT_AFTER_MS = 6000;

/** What the app does; the store only keeps what to show. */
export interface UpdateDriver {
  /** Makes the request and decides (for example with `evaluateRelease`, or in Rust). */
  check(): Promise<CheckResult>;
  /** Downloads, verifies and opens the installer found by the last check. */
  install?(): Promise<Opened>;
  /** Text for an error; by default `common.appUpdate.checkFailed` / `installFailed` with the error as `detail`. */
  errorNote?(error: unknown, during: "check" | "install"): UpdateNote;
}

export interface UpdateState {
  /** The running version; null until known. */
  current: string | null;
  available: UpdateInfo | null;
  phase: UpdatePhase;
  /** The last result or error. */
  note: UpdateNote | null;
  /** "Later" was chosen for this version. */
  dismissed: string | null;
}

export interface UpdateStore {
  getState(): UpdateState;
  /** Calls `listener` after every change; returns the function that stops it (fits React's `useSyncExternalStore`). */
  subscribe(listener: () => void): () => void;
  setCurrent(version: string): void;
  /** An update found elsewhere (the automatic check, for example). */
  setAvailable(update: UpdateInfo | null): void;
  /** "Check for updates". */
  checkNow(): Promise<void>;
  /** "Download and install"; resolves to how it was opened, or null. On "windows" the app should quit; on "macos-closes", after `MAC_QUIT_AFTER_MS`. */
  installNow(): Promise<Opened | null>;
  /** "Later". */
  dismiss(): void;
  /** The banner for a found update is shown: one is found, not dismissed, and nothing is installing. */
  showBanner(): boolean;
}

function detail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** The note after the installer opened. `app` is the app's display name (for the macOS text). */
export function openedNote(opened: Opened, app: string): UpdateNote {
  if (opened === "macos") return { key: "common.appUpdate.openedMac", params: { app } };
  if (opened === "macos-closes") return { key: "common.appUpdate.openedMacCloses", params: { app } };
  if (opened === "windows") return { key: "common.appUpdate.openedWindows" };
  return { key: "common.appUpdate.openedAndroid" };
}

/** The state behind an app's "App updates" section and banner. `app` is the app's display name. */
export function createUpdateStore(driver: UpdateDriver, app: string): UpdateStore {
  let state: UpdateState = { current: null, available: null, phase: "idle", note: null, dismissed: null };
  const listeners = new Set<() => void>();
  const set = (patch: Partial<UpdateState>) => {
    state = { ...state, ...patch };
    for (const f of [...listeners]) f();
  };
  const errorNote = (e: unknown, during: "check" | "install"): UpdateNote =>
    driver.errorNote?.(e, during) ?? { key: during === "check" ? "common.appUpdate.checkFailed" : "common.appUpdate.installFailed", params: { detail: detail(e) } };

  return {
    getState: () => state,
    subscribe(f) {
      listeners.add(f);
      return () => listeners.delete(f);
    },
    setCurrent: (current) => set({ current }),
    setAvailable: (available) => set({ available }),
    async checkNow() {
      if (state.phase === "checking" || state.phase === "downloading") return;
      set({ phase: "checking", note: { key: "common.appUpdate.checking" } });
      try {
        const r = await driver.check();
        if (r.result === "available") {
          set({ phase: "idle", available: r.update, dismissed: null, note: { key: "common.appUpdate.available", params: { version: r.update.version } } });
        } else if (r.result === "noInstaller") {
          set({ phase: "idle", available: null, note: { key: "common.appUpdate.noInstaller", params: { version: r.version } } });
        } else {
          set({ phase: "idle", available: null, note: { key: "common.appUpdate.upToDate", params: { version: r.version } } });
        }
      } catch (e) {
        set({ phase: "idle", note: errorNote(e, "check") });
      }
    },
    async installNow() {
      const version = state.available?.version;
      if (!version || !driver.install || state.phase === "downloading") return null;
      set({ phase: "downloading", note: { key: "common.appUpdate.downloading", params: { version } } });
      try {
        const opened = await driver.install();
        set({ phase: "opened", note: openedNote(opened, app) });
        return opened;
      } catch (e) {
        set({ phase: "failed", note: errorNote(e, "install") });
        return null;
      }
    },
    dismiss: () => set({ dismissed: state.available?.version ?? null }),
    showBanner: () => state.available !== null && state.dismissed !== state.available.version && state.phase !== "downloading" && state.phase !== "opened",
  };
}
