// The release-tag script of .github/workflows/tauri-app-release-check.yml, run as the workflow
// runs it: which tag a run releases, and which tags are refused.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const workflow = readFileSync(new URL("../../.github/workflows/tauri-app-release-check.yml", import.meta.url), "utf8");
const begin = workflow.indexOf("// release-tag script: begin");
const end = workflow.indexOf("// release-tag script: end");
const script = workflow.slice(begin, end);

interface Run {
  event?: string;
  ref?: string;
  version?: string;
  platform?: string;
  platforms?: string;
  tags?: string[];
}

function run(r: Run): { ok: boolean; out: Record<string, string>; text: string } {
  const dir = mkdtempSync(join(tmpdir(), "ks-tauri-"));
  const tags = join(dir, "tags.txt");
  writeFileSync(tags, (r.tags ?? []).join("\n") + "\n");
  const p = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    encoding: "utf8",
    env: {
      PATH: process.env.PATH ?? "",
      KS_EVENT: r.event ?? "push",
      KS_REF_NAME: r.ref ?? "",
      KS_INPUT_VERSION: r.version ?? "",
      KS_INPUT_PLATFORM: r.platform ?? "all",
      KS_PLATFORMS: r.platforms ?? "mac windows",
      KS_TAGS_FILE: tags,
    },
  });
  const out: Record<string, string> = {};
  for (const line of p.stdout.split("\n")) {
    const m = /^(\w+)=(.*)$/.exec(line);
    if (m) out[m[1]] = m[2];
  }
  return { ok: p.status === 0, out, text: p.stdout + p.stderr };
}

test("the script is found in the workflow", () => {
  assert.ok(begin > 0 && end > begin, "markers around the release-tag script");
});

test("a plain tag releases every platform; a platform tag one", () => {
  assert.deepEqual(run({ ref: "v1.2.0", tags: ["v1.1.0", "v1.2.0"] }).out, {
    tag: "v1.2.0", version: "1.2.0", platform: "all", heading: "1.2.0", rehearsal: "false",
  });
  const mac = run({ ref: "mac-v1.3.0", tags: ["v1.2.0", "windows-v1.4.0", "mac-v1.3.0"] }).out;
  assert.equal(mac.platform, "mac");
  assert.equal(mac.heading, "macOS 1.3.0", "another platform's higher tag does not count");
  const chrome = run({ ref: "chrome-v2.0.0", platforms: "mac windows chrome", tags: ["v1.2.0"] }).out;
  assert.equal(chrome.heading, "Chrome 2.0.0");
});

test("refused tags", () => {
  const cases: [Run, RegExp][] = [
    [{ ref: "v1.2" }, /not a release tag/],
    [{ ref: "v01.2.0" }, /not a release tag/],
    [{ ref: "mac-1.2.0" }, /not a release tag/],
    [{ ref: "chrome-v1.0.0" }, /not a release tag/],
    [{ ref: "google-tv-v1.0.0" }, /not a release tag/],
    [{ ref: "v1.2.0", tags: ["mac-v1.2.0"] }, /must be higher than mac-v1\.2\.0/],
    [{ ref: "mac-v1.2.0", tags: ["v1.3.0"] }, /must be higher than v1\.3\.0/],
    [{ ref: "windows-v1.0.0", tags: ["windows-v1.0.1"] }, /must be higher/],
    [{ ref: "v1.0.0", platforms: "mac linux" }, /"linux" is not one of/],
  ];
  for (const [r, why] of cases) {
    const res = run(r);
    assert.equal(res.ok, false, JSON.stringify(r));
    assert.match(res.text, why, JSON.stringify(r));
  }
});

test("a manual run rehearses the version and platform given", () => {
  const r = run({ event: "workflow_dispatch", version: "1.4.0", platform: "windows", tags: ["v1.3.0"] });
  assert.equal(r.ok, true, r.text);
  assert.deepEqual(r.out, { tag: "windows-v1.4.0", version: "1.4.0", platform: "windows", heading: "Windows 1.4.0", rehearsal: "true" });
  assert.equal(run({ event: "workflow_dispatch", version: "v1.4.0" }).out.tag, "v1.4.0");
  assert.equal(run({ event: "workflow_dispatch", version: "1.4.0", platform: "chrome" }).ok, false, "chrome is not in platforms");
  assert.equal(run({ event: "workflow_dispatch", version: "1.3.0", tags: ["v1.3.0"] }).ok, true, "rehearsing a tag that exists is not refused");
});
