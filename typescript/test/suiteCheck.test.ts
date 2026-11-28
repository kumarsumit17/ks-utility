// ks-suite-check (typescript/tools/suite-check.mjs) on small apps made in a temporary folder.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
// @ts-ignore: a plain JavaScript module
import { suiteCheck, PLATFORM_FOLDERS } from "../tools/suite-check.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const langTool = join(here, "../tools/lang.mjs");

function write(root: string, path: string, text: string) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
}

/** A Kotlin app that keeps every rule. */
function goodApp(): string {
  const root = mkdtempSync(join(tmpdir(), "ks-suite-"));
  for (const p of PLATFORM_FOLDERS) write(root, `${p}/README.md`, "x");
  write(root, "mobile/android/build.gradle.kts", 'android { defaultConfig { versionName = providers.gradleProperty("versionName").get() } }\n');
  write(root, "desktop/mac/build.gradle.kts", 'compose.desktop { application { nativeDistributions { macOS { iconFile.set(file("icon.icns")) } } } }\n');
  write(root, "gradle/libs.versions.toml", '[libraries]\ncompose = "org.jetbrains.compose:compose:1.0"\n');
  write(root, "shared/src/Updates.kt", "import com.ks.utility.appupdate.AppUpdate\nval x = AppUpdate\n");
  write(root, "shared/lang/en.json", '{\n  "app.title": "KS App"\n}\n');
  write(root, "shared/lang/hi.json", '{\n  "app.title": "KS ऐप"\n}\n');
  return root;
}

const check = (root: string, newest: { tag: string; commit: string } | null = null) => suiteCheck(root, { newest, langTool }) as string[];

test("an app that keeps every rule passes", () => {
  assert.deepEqual(check(goodApp()), []);
});

test("each rule fails on its own", () => {
  const cases: [string, (root: string) => void, RegExp][] = [
    ["platform folder", (r) => write(r, "x", "") /* replaced below */, /platform folder mobile\/ios/],
    ["version", (r) => write(r, "mobile/android/build.gradle.kts", 'android { defaultConfig { versionName = "1.2.0"; versionCode = 10200 } }'), /hardcoded version/],
    ["tauri version", (r) => write(r, "shared/src-tauri/tauri.conf.json", '{"version": "1.2.0"}'), /version "1.2.0" is committed/],
    ["cargo version", (r) => write(r, "shared/src-tauri/Cargo.toml", '[package]\nname = "a"\nversion = "1.2.0"\n'), /version "1.2.0" is committed/],
    ["sdk", (r) => write(r, "gradle/libs.versions.toml", '[libraries]\nc = "com.google.firebase:firebase-crashlytics:1"\n'), /firebase-crashlytics/],
    ["robot", (r) => write(r, "mobile/android/src/main/res/drawable/ic_launcher_foreground.xml", '<path android:pathData="M31,63.928c0,0 6.4,-11 12.1,-13.1"/>'), /default robot/],
    ["kotlin icon", (r) => write(r, "desktop/windows/build.gradle.kts", "compose.desktop { application { nativeDistributions { } } }"), /default Kotlin icon/],
    ["language", (r) => write(r, "shared/lang/hi.json", "{}"), /language-file check fails/],
    ["updater", (r) => write(r, "shared/src/Updates.kt", "val x = 1"), /ks-utility's updater/],
  ];
  for (const [name, spoil, why] of cases) {
    const root = goodApp();
    if (name === "platform folder") {
      // Remove mobile/ios by making a new app without it.
      const r2 = mkdtempSync(join(tmpdir(), "ks-suite-"));
      for (const p of PLATFORM_FOLDERS.filter((p: string) => p !== "mobile/ios")) write(r2, `${p}/README.md`, "x");
      assert.ok(check(r2).some((p) => why.test(p)), name);
      continue;
    }
    spoil(root);
    const problems = check(root);
    assert.ok(problems.some((p) => why.test(p)), `${name}: ${problems.join(" | ")}`);
  }
});

test("a Tauri pin that is not the newest tag fails; the newest passes", () => {
  const root = goodApp();
  write(root, "shared/package.json", '{"dependencies": {"ks-utility": "git+https://github.com/kumasumit/ks-utility.git#v0.13.2"}}');
  write(root, "shared/src-tauri/Cargo.toml", '[package]\nname = "a"\nversion = "0.0.0"\n[dependencies]\nks-utility = { git = "https://github.com/kumasumit/ks-utility", tag = "v0.14.0" }\n');
  const problems = check(root, { tag: "v0.14.0", commit: "abc" });
  assert.equal(problems.length, 1, problems.join(" | "));
  assert.match(problems[0], /shared\/package\.json pins ks-utility v0\.13\.2, not the newest tag v0\.14\.0/);
  write(root, "shared/package.json", '{"dependencies": {"ks-utility": "git+https://github.com/kumasumit/ks-utility.git#v0.14.0"}}');
  assert.deepEqual(check(root, { tag: "v0.14.0", commit: "abc" }), []);
  assert.deepEqual(check(root, { tag: "v0.14.0", commit: "abc" }), []);
});

test("the shared workflows are called at @main; @dev only in a rehearsal", () => {
  const root = goodApp();
  const call = (ref: string) => write(root, ".github/workflows/release.yml", `jobs:\n  r:\n    uses: kumasumit/ks-utility/.github/workflows/kotlin-app-release.yml@${ref}\n`);
  call("main");
  assert.deepEqual(check(root), []);
  call("v0.17.0");
  const tag = check(root);
  assert.equal(tag.length, 1, tag.join(" | "));
  assert.match(tag[0], /release\.yml calls ks-utility's kotlin-app-release\.yml at @v0\.17\.0; use @main/);
  call("dev");
  assert.equal(check(root).length, 1, "a release never runs @dev");
  assert.deepEqual(suiteCheck(root, { langTool, allowDev: true }), [], "a rehearsal may");
});

test("an app without an updater says so, with a reason", () => {
  const root = goodApp();
  write(root, "shared/src/Updates.kt", "val x = 1");
  write(root, "ks-suite-check.json", '{"no-updater": "no in-app updater yet: an open owner question"}');
  assert.deepEqual(check(root), []);
  write(root, "ks-suite-check.json", '{"no-updater": ""}');
  assert.ok(check(root).some((p) => /needs its reason/.test(p)));
  write(root, "ks-suite-check.json", '{"skip-icons": "x"}');
  assert.ok(check(root).some((p) => /not an exception the check knows/.test(p)));
});

test("a DEV build may pin ks-utility's dev head; a release may not", async () => {
  const { execFileSync } = await import("node:child_process");
  const root = goodApp();
  const git = (...a: string[]) => execFileSync("git", ["-C", root, ...a], { encoding: "utf8" });
  git("init", "-q");
  write(root, ".gitmodules", '[submodule "ks-utility"]\n\tpath = ks-utility\n\turl = https://github.com/kumasumit/ks-utility.git\n');
  const devHead = "1".repeat(40);
  git("update-index", "--add", "--cacheinfo", `160000,${devHead},ks-utility`);
  git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "pin");
  const newest = { tag: "v0.19.0", commit: "2".repeat(40) };
  assert.ok(suiteCheck(root, { newest, langTool }).some((p: string) => /pins ks-utility 1111111, not the newest tag v0\.19\.0/.test(p)), "a release needs the newest tag");
  assert.ok(suiteCheck(root, { newest, langTool, allowDev: true }).some((p: string) => /not the newest tag/.test(p)), "a rehearsal without --dev-commit too");
  assert.deepEqual(suiteCheck(root, { newest, langTool, allowDev: true, devCommit: devHead }), [], "a DEV build on ks-utility dev passes");
  assert.ok(suiteCheck(root, { newest, langTool, devCommit: devHead }).some((p: string) => /not the newest tag/.test(p)), "dev-commit counts only in a rehearsal");
});
