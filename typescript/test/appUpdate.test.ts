import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHECK_INTERVAL_MS,
  createUpdateStore,
  evaluateRelease,
  isCheckDue,
  isDevVersion,
  isNewerVersion,
  latestReleaseApiUrl,
  parseRelease,
  parseReleases,
  evaluateReleases,
  releasesApiUrl,
  releaseTagPageUrl,
  tagVersion,
  parseRepo,
  parseVersion,
  pickAsset,
  releasePageUrl,
  sha256Hex,
  sha256Matches,
  type Platform,
} from "../src/index.ts";

const repo = parseRepo("someone/ks-app")!;
const sha = (c: string) => `sha256:${c.repeat(64)}`;
const asset = (name: string, size = 1, digest = sha("a"), url = `https://github.com/someone/ks-app/releases/download/v1.2.0/${name}`) => ({
  name,
  size,
  digest,
  browser_download_url: url,
});
const release = (tag: string, assets: object[]) => JSON.stringify({ tag_name: tag, body: "notes", assets });

test("versions", () => {
  assert.deepEqual(parseVersion("v1.2.3"), [1, 2, 3]);
  for (const bad of ["1.2.3.4.5", "1..2", "../evil", "1.2.3-beta", "", 3]) assert.equal(parseVersion(bad), null, String(bad));
  assert.ok(isNewerVersion("0.1.10", "0.1.9"));
  assert.ok(isNewerVersion("v1.0.0", "0.9.9"));
  assert.ok(isNewerVersion("1.0.1", "1.0"));
  assert.ok(!isNewerVersion("1.0.0", "1"));
  assert.ok(!isNewerVersion("0.1.3", "0.1.3"));
  assert.ok(!isNewerVersion("0.1.2", "0.1.3"));
  assert.ok(!isNewerVersion("x", "0.1.3"));
  assert.ok(isDevVersion("0.0.0") && isDevVersion("v0.0.0") && !isDevVersion("0.0.1"));
});

test("the daily check", () => {
  const now = Date.now();
  assert.ok(isCheckDue(true, "1.0.0", null, now));
  assert.ok(!isCheckDue(false, "1.0.0", null, now), "switch off");
  assert.ok(!isCheckDue(true, "0.0.0", null, now), "built from source");
  assert.ok(!isCheckDue(true, "1.0.0", now - 60_000, now));
  assert.ok(isCheckDue(true, "1.0.0", now - CHECK_INTERVAL_MS, now));
  assert.ok(isCheckDue(true, "1.0.0", now + 3_600_000, now), "clock set back");
});

test("repositories and URLs", () => {
  assert.equal(latestReleaseApiUrl(repo), "https://api.github.com/repos/someone/ks-app/releases/latest");
  assert.equal(releasePageUrl(repo), "https://github.com/someone/ks-app/releases/latest");
  for (const bad of ["someone", "a/b/c", "../x", "a/..", "a b/c", "/x", "a/"]) assert.equal(parseRepo(bad), null, bad);
});

test("the installer for each platform", () => {
  const r = parseRelease(
    release("v1.2.0", [
      asset("ks-app-v1.2.0-macos-arm64.dmg", 10),
      asset("ks-app-v1.2.0-macos-x64.dmg", 11),
      asset("ks-app-v1.2.0-windows-x64-setup.exe", 12),
      asset("ks-app-v1.2.0.apk", 13),
      asset("ks-app-extension-v1.2.0.zip", 14),
      asset("ffmpeg.exe", 99),
    ]),
    repo,
  )!;
  assert.equal(r.version, "1.2.0");
  const pick = (p: Platform) => pickAsset(r.assets, p, repo)?.name;
  assert.equal(pick("macos-arm64"), "ks-app-v1.2.0-macos-arm64.dmg");
  assert.equal(pick("macos-x64"), "ks-app-v1.2.0-macos-x64.dmg");
  assert.equal(pick("windows-x64"), "ks-app-v1.2.0-windows-x64-setup.exe");
  assert.equal(pick("android"), "ks-app-v1.2.0.apk");
});

test("universal files, and the larger of two", () => {
  const r = parseRelease(release("1.2.0", [asset("ks-app.dmg", 5), asset("ks-app.msi", 6), asset("small.apk", 1), asset("universal.apk", 9)]), repo)!;
  const pick = (p: Platform) => pickAsset(r.assets, p, repo)?.name;
  assert.equal(pick("macos-arm64"), "ks-app.dmg");
  assert.equal(pick("macos-x64"), "ks-app.dmg");
  assert.equal(pick("windows-x64"), "ks-app.msi");
  assert.equal(pick("android"), "universal.apk");
});

test("unsafe or unchecked files are dropped", () => {
  const r = parseRelease(
    release("v1.2.0", [
      asset("nodigest.apk", 1, "md5:abc"),
      asset("short.apk", 1, "sha256:abc"),
      asset("empty.apk", 0),
      asset(".hidden.apk"),
      asset("a.apk", 1, sha("b"), "https://example.com/a.apk"),
      asset("a.apk", 1, sha("b"), "https://github.com/someone/ks-app-evil/releases/download/v1/a.apk"),
    ]),
    repo,
  )!;
  assert.deepEqual(r.assets, []);
  assert.equal(parseRelease(release("../evil", []), repo), null);
  assert.equal(parseRelease("not json", repo), null);
});

test("outcomes", () => {
  const json = release("v1.2.0", [asset("ks-app-v1.2.0.apk", 3, sha("A"))]);
  const a = evaluateRelease(json, repo, "1.1.0", "android");
  assert.equal(a?.result, "available");
  assert.equal(a?.result === "available" && a.asset.sha256, "a".repeat(64));
  assert.deepEqual(evaluateRelease(JSON.parse(json), repo, "1.2.0", "android"), { result: "upToDate", version: "1.2.0" });
  assert.deepEqual(evaluateRelease(json, repo, "1.1.0", "windows-x64"), { result: "noInstaller", version: "1.2.0" });
  assert.equal(evaluateRelease("{}", repo, "1.1.0", "android"), null);
});

test("SHA-256", async () => {
  const abc = await sha256Hex(new TextEncoder().encode("abc"));
  assert.equal(abc, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.ok(sha256Matches(abc, abc.toUpperCase()));
  assert.ok(!sha256Matches(abc, ""));
});

test("the App updates state", async () => {
  let next: unknown = { result: "upToDate", version: "1.1.0" };
  const store = createUpdateStore(
    {
      check: async () => {
        if (next instanceof Error) throw next;
        return next as never;
      },
      install: async () => "macos",
    },
    "KS App",
  );
  let changes = 0;
  const stop = store.subscribe(() => changes++);
  store.setCurrent("1.1.0");
  await store.checkNow();
  assert.deepEqual(store.getState().note, { key: "common.appUpdate.upToDate", params: { version: "1.1.0" } });
  assert.ok(!store.showBanner());

  next = { result: "available", update: { version: "1.2.0", size: 3 } };
  await store.checkNow();
  assert.deepEqual(store.getState().note, { key: "common.appUpdate.available", params: { version: "1.2.0" } });
  assert.ok(store.showBanner());
  store.dismiss();
  assert.ok(!store.showBanner(), "Later");

  assert.equal(await store.installNow(), "macos");
  assert.equal(store.getState().phase, "opened");
  assert.deepEqual(store.getState().note, { key: "common.appUpdate.openedMac", params: { app: "KS App" } });

  next = new Error("offline");
  await store.checkNow();
  assert.deepEqual(store.getState().note, { key: "common.appUpdate.checkFailed", params: { detail: "offline" } });
  stop();
  const seen = changes;
  store.setCurrent("1.1.1");
  assert.equal(changes, seen, "unsubscribed");
});

test("platform tags and the release list", () => {
  assert.equal(tagVersion("mac-v1.3.0", "macos-x64"), "1.3.0");
  assert.equal(tagVersion("v1.2.0", "android"), "1.2.0");
  assert.equal(tagVersion("windows-v1.3.0", "macos-arm64"), null);
  assert.equal(tagVersion("mac-1.3.0", "macos-arm64"), null);
  assert.equal(releasesApiUrl(repo), "https://api.github.com/repos/someone/ks-app/releases?per_page=30");
  assert.equal(releaseTagPageUrl(repo, "mac-v1.3.0"), "https://github.com/someone/ks-app/releases/tag/mac-v1.3.0");
  const list = [
    { tag_name: "windows-v2.0.0", assets: [asset("ks-app-v2.0.0-windows-x64.msi")] },
    { tag_name: "mac-v1.4.0", draft: true, assets: [asset("ks-app-v1.4.0-macos-arm64.dmg")] },
    { tag_name: "v1.2.0", assets: [asset("ks-app-v1.2.0-macos-arm64.dmg"), asset("ks-app-v1.2.0-windows-x64.msi")] },
  ];
  const mac = parseReleases(JSON.stringify(list), repo, "macos-arm64")!;
  assert.deepEqual([mac.version, mac.tag], ["1.2.0", "v1.2.0"]);
  const win = evaluateReleases(list, repo, "1.2.0", "windows-x64");
  assert.equal(win?.result, "available");
  assert.equal(parseReleases("[]", repo, "android"), null);
  assert.equal(parseReleases("{}", repo, "android"), null);
});

test("Google TV and Chrome tags", () => {
  assert.equal(tagVersion("google-tv-v1.3.0", "google-tv"), "1.3.0");
  assert.equal(tagVersion("google-tv-v1.3.0", "android"), null);
  assert.equal(tagVersion("android-v1.3.0", "google-tv"), null);
  assert.equal(tagVersion("chrome-v2.1.0", "chrome"), "2.1.0");
  assert.equal(tagVersion("chrome-v2.1.0", "macos-arm64"), null);
  assert.equal(tagVersion("v2.0.0", "chrome"), "2.0.0");
  const both = parseRelease(release("v1.2.0", [asset("ks-app-v1.2.0.apk", 9), asset("ks-app-v1.2.0-google-tv.apk", 5)]), repo)!;
  const one = parseRelease(release("v1.2.0", [asset("ks-app-v1.2.0.apk", 9), asset("ks-app-v1.2.0-extension.zip", 9)]), repo)!;
  assert.equal(pickAsset(both.assets, "google-tv", repo)?.name, "ks-app-v1.2.0-google-tv.apk");
  assert.equal(pickAsset(one.assets, "google-tv", repo)?.name, "ks-app-v1.2.0.apk", "no TV build: the plain APK");
  assert.equal(pickAsset(one.assets, "chrome", repo), null, "an extension has no installer");
  const list = JSON.stringify([JSON.parse(release("chrome-v2.1.0", [])), JSON.parse(release("v2.0.0", [asset("ks-app-v2.0.0.apk")]))]);
  const found = parseReleases(JSON.parse(list), repo, "chrome");
  assert.equal(found?.tag, "chrome-v2.1.0");
});

test("the note after opening: the desktop helper's Mac image says the app now closes", async () => {
  const { openedNote, MAC_QUIT_AFTER_MS } = await import("../src/index.ts");
  assert.deepEqual(openedNote("macos-closes", "KS App"), { key: "common.appUpdate.openedMacCloses", params: { app: "KS App" } });
  assert.deepEqual(openedNote("macos", "KS App"), { key: "common.appUpdate.openedMac", params: { app: "KS App" } }, "unchanged for older apps");
  assert.deepEqual(openedNote("windows", "KS App"), { key: "common.appUpdate.openedWindows" });
  assert.equal(MAC_QUIT_AFTER_MS, 6000);
});
