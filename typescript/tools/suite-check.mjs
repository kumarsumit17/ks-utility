#!/usr/bin/env node
// ks-suite-check: the suite rules that code can check, run on one app's checkout by the shared
// release workflows (kotlin-app-release.yml, tauri-app-release-check.yml) before anything is
// built (specs/suite-check.md). Node's standard library only.
//
//   node <ks-utility>/typescript/tools/suite-check.mjs <app dir> [--newest <tag> --newest-commit <sha>] [--rehearsal [--dev-commit <sha>]]
//
// Prints one line per problem (with ::error:: for GitHub) and exits 1 when there is any.
// `--newest` and `--newest-commit` are ks-utility's newest tag and its commit; without them the
// pin is not checked. `--rehearsal` also accepts calls of ks-utility's shared workflows at @dev,
// and with `--dev-commit <sha>` (ks-utility's dev head) a submodule pinned there.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const PLATFORM_FOLDERS = ["tv/google-tv", "desktop/mac", "desktop/windows", "mobile/android", "mobile/ios"];

/** Folders never looked into: build output, dependencies, and the ks-utility copy itself. */
const SKIP = new Set([".git", "build", ".gradle", "node_modules", "target", "dist", "graphify-out", "ks-utility", ".idea", ".kotlin"]);

/** Analytics, crash-reporting and ad SDKs, by a name that appears in a dependency declaration. */
export const TRACKING_SDKS = [
  "firebase-analytics", "firebase-crashlytics", "crashlytics", "firebase-perf", "google-analytics", "play-services-analytics",
  "play-services-ads", "admob", "sentry", "bugsnag", "mixpanel", "amplitude", "segment-analytics", "analytics-kotlin",
  "appcenter", "posthog", "datadog", "newrelic", "flurry", "appsflyer", "com.adjust", "applovin", "ironsource",
  "unity-ads", "unityads", "facebook-android-sdk", "facebook-core", "chartboost", "vungle", "instabug", "raygun",
  "rollbar", "honeybadger", "@sentry/", "react-ga", "ga4", "plausible", "matomo", "logrocket", "fullstory", "hotjar",
];

/** SHA-256 of Tauri's own template icons (tauri-cli's app template and create-tauri-app). */
export const TAURI_DEFAULT_ICONS = new Set([
  "aaa96d0c53b756b77c7f46aeb72290f42256c786c69be68f6bcdeb9c7492a48e", "d151f11e325f7502de0c739a2e51697aa569fd4701ae6e11fae1a3b4c7d5f157",
  "1f3689f6374b0553996fdc99743799216703835070145d7f0e6ec11e6280139e", "eeebf55d8ffe07348786b9057af253e3ca08c56b6a8f8893826381430e3c0b7b",
  "2998b41d0c9278b08e8b3874e094920034fe983a46053c9d62764225f58ab7b0", "69194785eef4323955af73b0c03362ac0804db056c2424f9715076cabc0ed103",
  "1535d355994f8ee82da91384d2a29e04d5b4440f3e6051b5c8b06e7a62283693", "3dc10493b7de48a61de58f768f8a5708d3a44a068c148cedf0502b9b9b71ba5d",
  "e38ca88e1d5490f3dcbc3c3fa525f7fcb7b80fff3cb2f3a4eb1b2d018c0915c1", "6413bfe9d546e5225fc9256a0ecec48df3a1272ea4bdc91c15b8e000222a95d3",
  "b5d93c8ec365c08b11bd006e46a46e227c681d30bb295af3d017573bfc752a83",
]);

/** The robot of Android Studio's launcher-icon template (ic_launcher_foreground.xml). */
const ANDROID_ROBOT = "M31,63.928c0,0 6.4,-11 12.1,-13.1";

const UPDATER = [/com\.ks\.utility\.appupdate/, /ks_utility::app_update/, /from\s+["']ks-utility["']/];

function files(root) {
  const out = [];
  const walk = (dir) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(join(dir, e.name)); } else if (e.isFile()) out.push(join(dir, e.name));
    }
  };
  walk(root);
  return out;
}

const read = (f) => { try { return readFileSync(f, "utf8"); } catch { return ""; } };
const sha256 = (f) => createHash("sha256").update(readFileSync(f)).digest("hex");

/** The problems of the app at `root`. `newest`: ks-utility's newest tag and commit, or null. */
export function suiteCheck(root, { newest = null, langTool = null, allowDev = false, devCommit = null } = {}) {
  const problems = [];
  const all = files(root);
  const rel = (f) => relative(root, f);
  const named = (re) => all.filter((f) => re.test(basename(f)));

  // 1. The five platform folders.
  for (const p of PLATFORM_FOLDERS) {
    if (!existsSync(join(root, p)) || !statSync(join(root, p)).isDirectory()) problems.push(`platform folder ${p}/ is missing (every app has all five)`);
  }

  // 2. No version in the build files: versions come from the tag.
  for (const f of named(/\.gradle\.kts$/)) {
    const t = read(f);
    for (const re of [/\bversionName\s*=\s*"\d/, /\bversionCode\s*=\s*\d/, /\bpackageVersion\s*=\s*"\d/, /^\s*version\s*=\s*"\d/m]) {
      if (re.test(t)) problems.push(`${rel(f)}: a hardcoded version (${re.source}); versions come from the tag (-PversionName, -PversionCode)`);
    }
  }
  for (const f of all.filter((f) => /^(tauri\.conf\.json|package\.json|manifest\.json)$/.test(basename(f)))) {
    let v;
    try { v = JSON.parse(read(f)).version; } catch { continue; }
    if (typeof v === "string" && v !== "0.0.0" && (basename(f) !== "manifest.json" || /"manifest_version"/.test(read(f)))) {
      problems.push(`${rel(f)}: version "${v}" is committed; keep 0.0.0, the release writes the tag's version`);
    }
  }
  for (const f of named(/^Cargo\.toml$/)) {
    const pkg = /\[package\][^[]*?^\s*version\s*=\s*"([^"]+)"/ms.exec(read(f));
    if (pkg && pkg[1] !== "0.0.0") problems.push(`${rel(f)}: version "${pkg[1]}" is committed; keep 0.0.0, the release writes the tag's version`);
  }

  // 3. No analytics, crash-reporting or ad SDK.
  const deps = all.filter((f) => /(\.gradle\.kts|libs\.versions\.toml|^package\.json|^Cargo\.toml)$/.test(basename(f)));
  for (const f of deps) {
    const t = read(f).toLowerCase();
    for (const sdk of TRACKING_SDKS) if (t.includes(sdk)) problems.push(`${rel(f)}: "${sdk}" looks like an analytics, crash-reporting or ad SDK; the suite has none`);
  }

  // 4. No default framework icon.
  for (const f of named(/^ic_launcher.*\.xml$/)) if (read(f).includes(ANDROID_ROBOT)) problems.push(`${rel(f)}: Android's default robot icon; use the app's own`);
  for (const f of named(/\.gradle\.kts$/)) {
    const t = read(f);
    if (/nativeDistributions\s*\{/.test(t) && !/iconFile/.test(t)) problems.push(`${rel(f)}: nativeDistributions without an iconFile ships the default Kotlin icon`);
  }
  for (const f of all.filter((f) => /\.(png|ico|icns)$/i.test(f) && /(^|\/)icons\//.test(rel(f)))) {
    if (TAURI_DEFAULT_ICONS.has(sha256(f))) problems.push(`${rel(f)}: Tauri's default icon; use the app's own`);
  }

  // 5. The language files pass the check.
  const langDirs = [...new Set(named(/^en\.json$/).map(dirname))].filter((d) => existsSync(join(d, "hi.json")));
  const chrome = [...new Set(all.filter((f) => /\/_locales\/en\/messages\.json$/.test(f)).map((f) => dirname(dirname(f))))];
  if (langDirs.length === 0 && chrome.length === 0) problems.push("no language files (en.json and hi.json) found");
  else if (langTool) {
    const args = [langTool, "check", ...langDirs, ...chrome.flatMap((c) => ["--chrome", c])];
    try {
      execFileSync(process.execPath, args, { stdio: "pipe", encoding: "utf8" });
    } catch (e) {
      const out = `${e.stdout ?? ""}${e.stderr ?? ""}`.trim().split("\n").slice(0, 20).join("\n  ");
      problems.push(`the language-file check fails:\n  ${out}`);
    }
  }

  // 6. Updates come from ks-utility's updater. The one exception an app may state, with its
  // reason, in ks-suite-check.json: {"no-updater": "..."} (an app with no in-app updater at all).
  let exceptions = {};
  try { exceptions = JSON.parse(read(join(root, "ks-suite-check.json")) || "{}"); } catch { problems.push("ks-suite-check.json is not valid JSON"); }
  for (const k of Object.keys(exceptions)) if (k !== "no-updater") problems.push(`ks-suite-check.json: "${k}" is not an exception the check knows (only "no-updater")`);
  const noUpdater = typeof exceptions["no-updater"] === "string" && exceptions["no-updater"].trim().length > 0;
  if ("no-updater" in exceptions && !noUpdater) problems.push('ks-suite-check.json: "no-updater" needs its reason as text');
  const sources = all.filter((f) => /\.(kt|rs|ts|tsx|mts)$/.test(f));
  if (!noUpdater && !sources.some((f) => UPDATER.some((re) => re.test(read(f))) && /app.?update|AppUpdate|appUpdate/i.test(read(f)))) {
    problems.push("no use of ks-utility's updater (com.ks.utility.appupdate, ks_utility::app_update or appUpdate from ks-utility)");
  }

  // 7. The ks-utility pin is the newest tag.
  if (newest) {
    const pins = [];
    if (existsSync(join(root, ".gitmodules")) && /path\s*=\s*ks-utility\b/.test(read(join(root, ".gitmodules")))) {
      try {
        const line = execFileSync("git", ["-C", root, "ls-tree", "HEAD", "ks-utility"], { encoding: "utf8" });
        const sha = line.split(/\s+/)[2];
        // A DEV build may also pin ks-utility's dev head, to try unreleased ks-utility work
        // in one app before it is tagged (specs/suite-check.md); a release never may.
        if (sha) pins.push({ where: "the ks-utility submodule", ok: sha === newest.commit || (allowDev && devCommit !== null && sha === devCommit), got: sha.slice(0, 7) });
      } catch { /* not a git checkout: nothing to compare */ }
    }
    for (const f of all.filter((f) => /^(package\.json|Cargo\.toml)$/.test(basename(f)))) {
      for (const m of read(f).matchAll(/ks-utility(?:\.git)?(?:#|"[^\n]*?tag\s*=\s*")(v\d+\.\d+\.\d+)/g)) {
        pins.push({ where: rel(f), ok: m[1] === newest.tag, got: m[1] });
      }
    }
    for (const p of pins) if (!p.ok) problems.push(`${p.where} pins ks-utility ${p.got}, not the newest tag ${newest.tag}; move the pin first (the suite's release cycle, step 1)`);
  }

  // 8. The app's workflows call ks-utility's shared workflows at @main, which is always the
  //    newest release (ks-utility's main moves only with a tag), so there is nothing to bump and
  //    no token that may change workflow files. A rehearsal may also call @dev, to try a change
  //    to a shared workflow before it is tagged.
  for (const f of all.filter((f) => /(^|\/)\.github\/workflows\/[^/]+\.ya?ml$/.test(rel(f)))) {
    for (const m of read(f).matchAll(/kumasumit\/ks-utility\/\.github\/workflows\/([\w.-]+\.ya?ml)@([\w./-]+)/g)) {
      if (m[2] === "main" || (allowDev && m[2] === "dev")) continue;
      problems.push(`${rel(f)} calls ks-utility's ${m[1]} at @${m[2]}; use @main, always the newest release${allowDev ? " (@dev only in a rehearsal)" : ""}`);
    }
  }
  return [...new Set(problems)];
}

function main(argv) {
  const [root, ...rest] = argv;
  if (!root) { console.error("usage: suite-check.mjs <app dir> [--newest <tag> --newest-commit <sha>] [--rehearsal [--dev-commit <sha>]]"); return 2; }
  const opt = (name) => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : undefined; };
  const tag = opt("--newest");
  const commit = opt("--newest-commit");
  const here = dirname(fileURLToPath(import.meta.url));
  const problems = suiteCheck(root, { newest: tag && commit ? { tag, commit } : null, langTool: join(here, "lang.mjs"), allowDev: rest.includes("--rehearsal"), devCommit: opt("--dev-commit") ?? null });
  for (const p of problems) console.log(`::error::ks-suite-check: ${p}`);
  console.log(problems.length ? `ks-suite-check: ${problems.length} problem(s).` : "ks-suite-check: OK.");
  return problems.length ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exit(main(process.argv.slice(2)));
