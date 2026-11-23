import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  argumentOrder,
  checkCatalogs,
  containsPhrase,
  createTranslator,
  duplicateKeys,
  escapeAndroid,
  escapeCompose,
  fromChromeMessages,
  parseLanguageChoice,
  placeholders,
  resolveLanguage,
  resourceName,
  resourceNameProblems,
  toAndroidXml,
  toComposeXml,
  type Term,
} from "../src/index.ts";

const root = new URL("../../", import.meta.url);
const terms = JSON.parse(readFileSync(new URL("lang/hindi-terms.json", root), "utf8")) as Term[];
const commonEn = JSON.parse(readFileSync(new URL("lang/common/en.json", root), "utf8"));
const commonHi = JSON.parse(readFileSync(new URL("lang/common/hi.json", root), "utf8"));

test("look-up, placeholders, plurals and English fallback", () => {
  const common = { en: { "common.ok": "OK", "common.items": { one: "{count} item", other: "{count} items" } }, hi: { "common.ok": "ठीक है", "common.items": { one: "{count} आइटम", other: "{count} आइटम" } } };
  const app = { en: { greet: "Hello, {name}", onlyEn: "Only English", "common.ok": "Fine" }, hi: { greet: "नमस्ते, {name}" } };
  const hi = createTranslator("hi", common, app);
  assert.equal(hi("greet", { name: "Asha" }), "नमस्ते, Asha");
  assert.equal(hi("onlyEn"), "Only English", "missing in Hindi: English");
  assert.equal(hi("nothing.here"), "nothing.here", "missing everywhere: the key");
  assert.equal(hi("common.ok"), "ठीक है");
  assert.equal(hi("common.items", { count: 0 }), "0 आइटम", "Hindi uses 'one' for 0");
  assert.equal(hi("common.items", { count: 1200 }), "1,200 आइटम", "numbers formatted, Latin digits");
  const en = createTranslator("en", common, app);
  assert.equal(en("common.ok"), "Fine", "the app's layer comes first");
  assert.equal(en("common.items", { count: 1 }), "1 item");
  assert.equal(en("common.items", { count: 2 }), "2 items");
  assert.equal(en("common.items"), "{count} items", "no count: 'other', placeholder kept");
  assert.equal(en("greet"), "Hello, {name}");
  assert.equal(createTranslator("fr", common)("common.ok"), "OK", "another language falls back to English");
});

test("the language rule", () => {
  assert.equal(resolveLanguage("hi", ["en-US"]), "hi", "a remembered choice wins");
  assert.equal(resolveLanguage("system", ["hi-IN", "en"]), "hi");
  assert.equal(resolveLanguage(undefined, ["fr-FR", "hi_IN"]), "hi", "first supported system language");
  assert.equal(resolveLanguage(null, ["fr-FR", "de"]), "en", "otherwise English");
  assert.equal(resolveLanguage("de", []), "en");
  assert.equal(parseLanguageChoice("en"), "en");
  assert.equal(parseLanguageChoice("klingon"), "system");
  assert.equal(parseLanguageChoice(undefined), "system");
});

test("placeholders", () => {
  assert.deepEqual(placeholders("{a} of {b}, {a}"), ["a", "b", "a"]);
  assert.deepEqual(placeholders("none { here }"), []);
});

test("the shared catalogue passes the check", () => {
  assert.deepEqual(checkCatalogs(commonEn, commonHi, terms), []);
});

test("the check finds every kind of problem", () => {
  const en = {
    a: "Download {name}",
    b: "Only here",
    c: "{x} and {y}",
    d: "{n} once",
    e: "Cancel",
    f: { one: "{count} file", other: "{count} files" },
    g: "Text",
    h: "Odd { brace",
    "Bad.Key": "x",
  };
  const hi = {
    a: "{name} डाउनलोड करें",
    c: "{x} और {z}",
    d: "{n} और {n}",
    e: "कैंसल करें",
    f: { one: "{count} फ़ाइल", few: "x {count}", other: "{count} फ़ाइलें" },
    g: "पेज ३",
    h: "x",
    extra: "अतिरिक्त",
    "Bad.Key": "x",
  };
  const p = checkCatalogs(en, hi, terms).join("\n");
  assert.match(p, /"b" is in en and not in hi/);
  assert.match(p, /"extra" is in hi and not in en/);
  assert.match(p, /hi: "c" has placeholders \{x\} \{z\}/, "changed placeholder");
  assert.match(p, /hi: "d" has placeholders \{n\} \{n\}/, "repeated placeholder");
  assert.match(p, /hi: "e" uses "कैंसल"/, "disallowed alternative");
  assert.match(p, /hi: "f" has plural form "few"/, "a category Hindi does not use");
  assert.match(p, /hi: "g" uses Devanagari digits/);
  assert.match(p, /en: "h" has a "\{" or "\}"/);
  assert.match(p, /en: "Bad.Key" is not a valid key/);
  assert.doesNotMatch(p, /"a"/, "a correct key has no problem");
  // Missing placeholder.
  assert.match(checkCatalogs({ a: "{n} left" }, { a: "बाकी" }, terms).join(), /placeholders none, English has \{n\}/);
  // Plural in one language, text in the other; plural without {count}.
  assert.match(checkCatalogs({ a: { other: "{count} x" } }, { a: "{count} x" }, terms).join(), /plural forms in one language/);
  assert.match(checkCatalogs({ a: { other: "files" } }, { a: { other: "फ़ाइलें" } }, terms).join(), /must contain \{count\}/);
  assert.match(checkCatalogs([], {}, terms).join(), /one JSON object/);
});

test("disallowed words match whole words only", () => {
  assert.ok(containsPhrase("डाउनलोड की गति कम है", "गति"));
  assert.ok(!containsPhrase("प्रगति", "गति"));
  assert.ok(containsPhrase("कृपया पुनः प्रयास करें।", "पुनः प्रयास करें"));
  assert.ok(!containsPhrase("फ़ाइल", "फाइल"), "the nukta spelling is a different word");
  assert.ok(containsPhrase("नई फाइल", "फाइल"));
  // "Yes" is हाँ (the one chandrabindu exception); the avoided हां never matches यहां.
  assert.ok(!containsPhrase("हाँ", "हां"));
  assert.ok(!containsPhrase("यहां से डाउनलोड करें", "हां"));
  assert.ok(containsPhrase("हां, हटाएं", "हां"));
});

test("an app may not redefine a shared key", () => {
  assert.deepEqual(duplicateKeys([{ "common.ok": "OK", x: "1" }, { "common.ok": "Fine", y: "2" }]), ["common.ok"]);
});

test("Chrome messages are checked like any catalog", () => {
  const en = fromChromeMessages("en", {
    title: { message: "Send $FILE$ to the app", placeholders: { file: { content: "$1" } } },
    plain: { message: "Costs $$5" },
  });
  const hi = fromChromeMessages("hi", { title: { message: "$file$ ऐप को भेजें" }, plain: { message: "५ $$" } });
  assert.deepEqual(en.problems, []);
  assert.equal(en.catalog.title, "Send {file} to the app");
  assert.match(hi.problems.join(), /uses \$file\$, which it does not define/);
  assert.match(checkCatalogs(en.catalog, hi.catalog, terms, { anyKeys: true }).join(), /"plain" uses Devanagari digits/);
});

test("Android resource names", () => {
  assert.equal(resourceName("common.ok"), "common_ok");
  assert.equal(resourceName("downloads.timeLeft"), "downloads_time_left");
  assert.match(resourceNameProblems(["a.bC", "a_b.c"]).join(), /both become "a_b_c"/);
  assert.match(resourceNameProblems(["new"]).join(), /keyword/);
  assert.deepEqual(resourceNameProblems(Object.keys(commonEn)), []);
});

test("Android escaping", () => {
  assert.equal(escapeAndroid(`It's "5" < 6 & 7\\ok\nnext`, false), `It\\'s \\"5\\" &lt; 6 &amp; 7\\\\ok\\nnext`);
  assert.equal(escapeAndroid("@home", false), "\\@home");
  assert.equal(escapeAndroid("?x", false), "\\?x");
  assert.equal(escapeAndroid("50% done", true), "50%% done");
  assert.equal(escapeAndroid("50% done", false), "50% done");
});

test("Compose escaping leaves quotes, @, ? and % alone", () => {
  // Compose Multiplatform 1.12 undoes only \\, \n, \t and \uXXXX after reading the XML.
  assert.equal(escapeCompose(`It's "5" < 6 & 7\\ok\nnext\tend`), `It's "5" &lt; 6 &amp; 7\\\\ok\\nnext\\tend`);
  assert.equal(escapeCompose("@home"), "@home");
  assert.equal(escapeCompose("?x"), "?x");
  assert.equal(escapeCompose("\\u0041"), "\\\\u0041", "a literal backslash-u stays literal");
  const en = { "x.off": "You're offline", "x.pct": "{n}% of {total}" };
  const xml = toComposeXml(en, en);
  assert.match(xml, /<string name="x_off">You're offline<\/string>/);
  assert.match(xml, /<string name="x_pct">%1\$s% of %2\$s<\/string>/, "% is not doubled");
  assert.match(toAndroidXml(en, en), /<string name="x_off">You\\'re offline<\/string>/, "Android still escapes");
});

test("Android string resources keep argument numbers across languages", () => {
  const en = { "x.of": "{done} of {total}", "x.files": { one: "{count} file", other: "{count} files in {folder}" }, "x.pct": "100%" };
  const hi = { "x.of": "{total} में से {done}", "x.files": { one: "{count} फ़ाइल", other: "{folder} में {count} फ़ाइलें" }, "x.pct": "100%" };
  assert.deepEqual([...argumentOrder(en["x.of"])], [["done", 1], ["total", 2]]);
  const xml = toAndroidXml(hi, en);
  assert.match(xml, /<string name="x_of">%2\$s में से %1\$s<\/string>/);
  assert.match(xml, /<plurals name="x_files">\n {8}<item quantity="one">%1\$s फ़ाइल<\/item>\n {8}<item quantity="other">%2\$s में %1\$s फ़ाइलें<\/item>\n {4}<\/plurals>/);
  assert.match(xml, /<string name="x_pct">100%<\/string>/, "no arguments: % stays single");
  assert.match(xml, /^<\?xml version="1.0" encoding="utf-8"\?>\n<!-- Generated/);
});

test("the Hindi style guide table and the term data agree", () => {
  const md = readFileSync(new URL("specs/hindi-style.md", root), "utf8");
  const section = md.slice(md.indexOf("| English | Hindi | Avoid | Status |"));
  const rows = section
    .split("\n")
    .slice(2)
    .filter((l) => l.startsWith("|"))
    .map((l) => l.split("|").slice(1, -1).map((c) => c.trim()));
  const fromTable = rows.map(([en, hi, avoid, status]) => ({
    en,
    hi,
    avoid: avoid === "—" ? [] : avoid.split(",").map((a) => a.trim()),
    review: status === "owner review",
  }));
  const fromData = terms.map((t) => ({ en: t.en, hi: t.hi, avoid: t.avoid, review: t.review === true }));
  assert.deepEqual(fromTable, fromData);
  for (const s of rows.map((r) => r[3])) assert.ok(s === "approved" || s === "owner review", s);
  // A term never uses its own disallowed alternative, and digits are Latin.
  for (const t of terms) {
    for (const a of t.avoid) assert.ok(!containsPhrase(t.hi, a), `${t.en}: ${a}`);
    assert.ok(!/[०-९]/.test(t.hi), t.en);
  }
});

test("the command line check and Android conversion", () => {
  const tool = new URL("../tools/lang.mjs", import.meta.url).pathname;
  const dir = mkdtempSync(join(tmpdir(), "ks-lang-"));
  try {
    const app = join(dir, "app");
    mkdirSync(app);
    writeFileSync(join(app, "en.json"), JSON.stringify({ "app.title": "Downloads: {n}" }));
    writeFileSync(join(app, "hi.json"), JSON.stringify({ "app.title": "डाउनलोड: {n}" }));
    const ok = spawnSync(process.execPath, [tool, "check", app], { encoding: "utf8" });
    assert.equal(ok.status, 0, ok.stderr);

    writeFileSync(join(app, "hi.json"), JSON.stringify({ "app.title": "डाउनलोड" , "common.ok": "ठीक"}));
    const bad = spawnSync(process.execPath, [tool, "check", app], { encoding: "utf8" });
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /placeholders none/);
    assert.match(bad.stderr, /"common.ok" is in hi and not in en/);

    writeFileSync(join(app, "hi.json"), JSON.stringify({ "app.title": "डाउनलोड: {n}" }));
    const res = join(dir, "res");
    const conv = spawnSync(process.execPath, [tool, "android", app, "--out", res], { encoding: "utf8" });
    assert.equal(conv.status, 0, conv.stderr);
    const hiXml = readFileSync(join(res, "values-hi/lang_strings.xml"), "utf8");
    assert.match(hiXml, /<string name="app_title">डाउनलोड: %1\$s<\/string>/);
    assert.match(hiXml, /<string name="common_cancel">रद्द करें<\/string>/, "the shared catalogue is included");
    assert.match(readFileSync(join(res, "values/lang_strings.xml"), "utf8"), /<string name="common_ok">OK<\/string>/);
    assert.match(readFileSync(join(res, "values/lang_strings.xml"), "utf8"), /<string name="common_error_offline">You\\'re /);

    const cmp = join(dir, "compose");
    const compose = spawnSync(process.execPath, [tool, "compose", app, "--out", cmp, "--name", "strings"], { encoding: "utf8" });
    assert.equal(compose.status, 0, compose.stderr);
    const cmpEn = readFileSync(join(cmp, "values/strings.xml"), "utf8");
    assert.match(cmpEn, /<string name="common_error_offline">You're offline/, "no backslash for Compose");
    assert.match(readFileSync(join(cmp, "values-hi/strings.xml"), "utf8"), /<string name="app_title">डाउनलोड: %1\$s<\/string>/);

    const locales = join(dir, "_locales");
    mkdirSync(join(locales, "en"), { recursive: true });
    mkdirSync(join(locales, "hi"), { recursive: true });
    writeFileSync(join(locales, "en/messages.json"), JSON.stringify({ name: { message: "App" } }));
    writeFileSync(join(locales, "hi/messages.json"), JSON.stringify({}));
    const chrome = spawnSync(process.execPath, [tool, "check", "--chrome", locales], { encoding: "utf8" });
    assert.equal(chrome.status, 1);
    assert.match(chrome.stderr, /"name" is in en and not in hi/);

    assert.equal(spawnSync(process.execPath, [tool, "nonsense"], { encoding: "utf8" }).status, 2);

    // Inside an app, the package is in node_modules, where Node strips no types.
    const pkg = join(dir, "node_modules/ks-utility");
    const repo = new URL("../../", import.meta.url).pathname;
    for (const part of ["typescript/src/lang", "typescript/tools", "lang"]) cpSync(join(repo, part), join(pkg, part), { recursive: true });
    const inModules = spawnSync(process.execPath, [join(pkg, "typescript/tools/lang.mjs"), "check", app], { encoding: "utf8" });
    assert.equal(inModules.status, 0, inModules.stderr);
    assert.match(inModules.stdout, /Language files: OK/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
