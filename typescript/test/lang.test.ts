import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, readdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  argumentOrder,
  checkCatalogs,
  checkLanguages,
  fromXliff,
  lookUp,
  buildMemory,
  pseudoLocalize,
  pseudoCatalog,
  qaCheck,
  similarity,
  toXliff,
  languageFallbacks,
  nativeLanguageName,
  resourceFolder,
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
  const section = md.slice(md.indexOf("| English | Hindi | Avoid | Status | Description |"));
  const rows = section
    .split("\n")
    .slice(2)
    .filter((l) => l.startsWith("|"))
    .map((l) => l.split("|").slice(1, -1).map((c) => c.trim()));
  const fromTable = rows.map(([en, hi, avoid, status, description]) => ({
    en,
    hi,
    avoid: avoid === "—" ? [] : avoid.split(",").map((a) => a.trim()),
    review: status === "owner review",
    description: description === "—" ? undefined : description,
  }));
  const fromData = terms.map((t) => ({ en: t.en, hi: t.hi, avoid: t.avoid, review: t.review === true, description: t.description }));
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

test("more languages: the language rule with a supported list", () => {
  const supported = ["en", "hi", "fr", "pt", "pt-BR", "zh-Hans"];
  assert.equal(resolveLanguage("fr", ["en"], supported), "fr", "a remembered choice wins");
  assert.equal(resolveLanguage("system", ["de-DE", "fr-CA"], supported), "fr", "by language part");
  assert.equal(resolveLanguage(undefined, ["pt_br"], supported), "pt-BR", "exact, after normalising");
  assert.equal(resolveLanguage(undefined, ["pt-PT"], supported), "pt");
  assert.equal(resolveLanguage(undefined, ["zh-Hans-CN"], supported), "zh-Hans");
  assert.equal(resolveLanguage(undefined, ["de", "en-GB", "fr"], supported), "en", "English in the system list counts");
  assert.equal(resolveLanguage(undefined, ["de"], supported), "en", "otherwise English");
  assert.equal(resolveLanguage("fr", ["en"]), "en", "without a list, only English and Hindi");
  assert.equal(parseLanguageChoice("fr", supported), "fr");
  assert.equal(parseLanguageChoice("de", supported), "system");
  assert.deepEqual(languageFallbacks("zh-Hans-CN"), ["zh-Hans-CN", "zh-Hans", "zh", "en"]);
  assert.deepEqual(languageFallbacks("en"), ["en"]);
  assert.equal(nativeLanguageName("hi"), "हिन्दी");
  assert.equal(nativeLanguageName("fr"), "Français");
  assert.equal(nativeLanguageName("pt-BR"), "Português (Brasil)");
});

test("more languages: look-up falls back through the region to English", () => {
  const layer = {
    en: { a: "A", b: "B", c: "C", files: { one: "{count} file", other: "{count} files" } },
    pt: { a: "A-pt", b: "B-pt" },
    "pt-BR": { a: "A-br" },
    ru: { files: { one: "{count} файл", few: "{count} файла", many: "{count} файлов", other: "{count} файла" } },
  };
  const br = createTranslator("pt-BR", layer);
  assert.deepEqual([br("a"), br("b"), br("c")], ["A-br", "B-pt", "C"]);
  const ru = createTranslator("ru", layer);
  assert.deepEqual([1, 3, 5, 21, 1.5].map((count) => ru("files", { count })), ["1 файл", "3 файла", "5 файлов", "21 файл", "1,5 файла"]);
});

test("more languages: the check", () => {
  const en = { a: "Hello {name}", b: "Bye", files: { one: "{count} file", other: "{count} files" } };
  const hi = { a: "नमस्ते {name}", b: "अलविदा", files: { one: "{count} फ़ाइल", other: "{count} फ़ाइलें" } };
  assert.deepEqual(checkLanguages({ en, hi, fr: { a: "Bonjour {name}" } }, terms), [], "a partial translation passes");
  assert.deepEqual(checkLanguages({ en, hi, ru: { files: { one: "{count} файл", few: "{count} файла", many: "{count} файлов", other: "{count} файла" } } }, terms), []);
  const p = checkLanguages(
    {
      en,
      hi,
      fr: { a: "Bonjour {nom}", extra: "x" },
      de: { files: { one: "1 Datei", few: "{count} Dateien", other: "{count} Dateien" } },
      ar: { b: "وداعا ٣" },
      pt_BR: { b: "Tchau" },
    },
    terms,
  ).join("\n");
  assert.match(p, /fr: "a" has placeholders \{nom\}, English has \{name\}/);
  assert.match(p, /"extra" is in fr and not in en/);
  assert.match(p, /de: "files" has plural form "few", which de does not use/);
  assert.match(p, /ar: "b" uses digits other than 0-9/);
  assert.match(p, /pt_BR: not a language code/);
  assert.doesNotMatch(p, /"b" is in en and not in fr/, "only English and Hindi must be complete");
  assert.match(checkLanguages({ en }, terms).join(), /hi: the language file is missing/);
  // The Hindi term list is for Hindi only.
  assert.deepEqual(checkLanguages({ en: { e: "Cancel" }, hi: { e: "रद्द करें" }, mr: { e: "कैंसल" } }, terms), []);
});

test("more languages: resource folders", () => {
  assert.equal(resourceFolder("en"), "values");
  assert.equal(resourceFolder("hi"), "values-hi");
  assert.equal(resourceFolder("pt-BR"), "values-pt-rBR");
  assert.equal(resourceFolder("zh-Hans"), "values-b+zh+Hans");
  assert.equal(resourceFolder("es-419"), "values-b+es+419");
  assert.equal(resourceFolder("pt-BR", "compose"), "values-pt-rBR");
  assert.equal(resourceFolder("zh-Hans", "compose"), null);
});

/** The numbers the Kotlin `Translator` is checked against (kotlin/src/test/resources). */
const VECTOR_LANGUAGES = "en hi bn mr gu pa ta te kn ml ur es fr de pt pt-PT it nl ru uk pl ar ja zh ko tr id vi".split(" ");
const VECTOR_NUMBERS = ["0", "1", "2", "3", "4", "5", "10", "11", "12", "14", "21", "22", "25", "100", "101", "102", "111", "999", "1000", "1234", "12345", "123456", "1234567", "1000000", "2000000", "1000001", "0.5", "1.5", "2.5", "1.0001", "0.9996", "0.0005", "-1", "-2.5", "-1234567.5", "1234.5678"];

function intlVectors() {
  const plural: Record<string, string[]> = {};
  const format: Record<string, string[]> = {};
  for (const lang of VECTOR_LANGUAGES) {
    const pr = new Intl.PluralRules(lang);
    const nf = new Intl.NumberFormat(lang, { numberingSystem: "latn" });
    plural[lang] = VECTOR_NUMBERS.map((n) => pr.select(Number(n)));
    format[lang] = VECTOR_NUMBERS.map((n) => nf.format(Number(n)));
  }
  return { note: "Generated from Intl by typescript/test/lang.test.ts (UPDATE_VECTORS=1 npm test). Do not edit.", numbers: VECTOR_NUMBERS, plural, format };
}

test("the Kotlin translator's expected values are what Intl says", () => {
  const file = new URL("kotlin/src/test/resources/intl-vectors.json", root);
  const now = JSON.stringify(intlVectors(), null, 1) + "\n";
  if (process.env.UPDATE_VECTORS) writeFileSync(file, now);
  assert.equal(readFileSync(file, "utf8"), now, "run UPDATE_VECTORS=1 npm test after a Node update, then fix the Kotlin rules");
});

test("the command line with more languages", () => {
  const tool = new URL("../tools/lang.mjs", import.meta.url).pathname;
  const run = (...args: string[]) => spawnSync(process.execPath, [tool, ...args], { encoding: "utf8" });
  const dir = mkdtempSync(join(tmpdir(), "ks-lang-"));
  try {
    const app = join(dir, "app");
    mkdirSync(app);
    writeFileSync(join(app, "en.json"), JSON.stringify({ "app.title": "Hello {name}", "app.files": { one: "{count} file", other: "{count} files" } }));
    writeFileSync(join(app, "hi.json"), JSON.stringify({ "app.title": "नमस्ते {name}", "app.files": { one: "{count} फ़ाइल", other: "{count} फ़ाइलें" } }));
    writeFileSync(join(app, "fr.json"), JSON.stringify({ "app.title": "Bonjour {name}" }));
    assert.equal(run("check", app).status, 0);

    const res = join(dir, "res");
    const conv = run("android", app, "--out", res);
    assert.equal(conv.status, 0, conv.stderr);
    assert.match(conv.stdout, /values-fr\/lang_strings\.xml/);
    const fr = readFileSync(join(res, "values-fr/lang_strings.xml"), "utf8");
    assert.match(fr, /<string name="app_title">Bonjour %1\$s<\/string>/);
    assert.doesNotMatch(fr, /app_files/, "a missing text comes from the default (English) resources");

    const cmp = run("compose", app, "--out", join(dir, "compose"));
    assert.equal(cmp.status, 0, cmp.stderr);
    writeFileSync(join(app, "zh-Hans.json"), JSON.stringify({ "app.title": "你好 {name}" }));
    assert.match(run("compose", app, "--out", join(dir, "compose")).stderr, /no folder for a script/);
    assert.equal(run("android", app, "--out", res).status, 0);
    assert.match(readFileSync(join(res, "values-b+zh+Hans/lang_strings.xml"), "utf8"), /你好 %1\$s/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("quality checks: errors of the check and warnings like a translation platform's", () => {
  const ok = qaCheck("fr", "a", "Delete {name}?", "Supprimer {name} ?");
  assert.deepEqual(ok.errors, []);
  assert.deepEqual(ok.warnings, ["has a double space"].filter(() => false));
  assert.match(qaCheck("fr", "a", "Delete {name}?", "Supprimer {nom}").errors.join(), /placeholders \{nom\}/);
  const w = qaCheck("fr", "a", "Saved 3 files.", " Enregistré  4 fichiers").warnings.join("\n");
  assert.match(w, /starts with a space/);
  assert.match(w, /double space/);
  assert.match(w, /does not end with "\."/);
  assert.match(w, /other numbers than English/);
  assert.match(qaCheck("de", "a", "Settings", "Einstellungen", { context: { maxLength: 8 } }).warnings.join(), /longer than 8 characters/);
  assert.deepEqual(qaCheck("hi", "a", "Saved.", "सेव हो गया।").warnings, [], "the danda ends a sentence like a full stop");
  assert.deepEqual(qaCheck("fr", "a", "OK", undefined).warnings, ["not translated yet"]);
  const glossary = [{ en: "download", text: "téléchargement", avoid: ["download"] }];
  assert.match(qaCheck("fr", "a", "Pause the download", "Mettre le download en pause", { glossary }).errors.join(), /uses "download"; the glossary says "téléchargement"/);
  assert.match(qaCheck("fr", "a", "Pause the download", "Mettre en pause", { glossary }).warnings.join(), /the glossary says "download" is "téléchargement"/);
  assert.match(qaCheck("ru", "f", { one: "{count} file", other: "{count} files" }, { one: "{count} файл", other: "{count} файла" }).warnings.join(), /plural forms "few", "many" missing/);
  assert.match(qaCheck("ru", "f", { one: "{count} file", other: "{count} files" }, { one: "{count} файл", other: "{count} файла", two: "x {count}" }).errors.join(), /plural form "two"/);
});

test("translation memory: the same English, then similar texts", () => {
  assert.equal(similarity("Delete file", "delete file"), 100);
  assert.ok(similarity("Delete the file", "Delete this file") >= 80);
  assert.ok(similarity("Cancel", "Open settings") < 50);
  const memory = buildMemory("fr", [
    { source: "ks-jaiplayer", catalogs: { en: { a: "Delete the file", b: "Cancel", n: { one: "{count} file", other: "{count} files" } }, fr: { a: "Supprimer le fichier", b: "Annuler", n: { one: "{count} fichier", other: "{count} fichiers" } } } },
    { source: "ks-vault", catalogs: { en: { c: "Cancel" }, fr: { c: "Annuler" } } },
  ]);
  const exact = lookUp(memory, "Cancel");
  assert.equal(exact.length, 1, "one per translation");
  assert.equal(exact[0].score, 100);
  const fuzzy = lookUp(memory, "Delete this file");
  assert.equal(fuzzy[0].translation, "Supprimer le fichier");
  assert.ok(fuzzy[0].score < 100 && fuzzy[0].score >= 70);
  assert.equal(lookUp(memory, { one: "{count} file", other: "{count} files" })[0].score, 100, "plurals match plurals");
  assert.deepEqual(lookUp(memory, "Something else entirely"), []);
});

test("pseudo-localisation keeps placeholders and makes text longer", () => {
  const p = pseudoLocalize("Delete {name}?");
  assert.match(p, /^\[Ðéļéţé \{name\}\? .+\]$/);
  assert.ok(p.length >= "Delete {name}?".length * 1.3);
  assert.deepEqual(Object.keys(pseudoCatalog({ f: { one: "{count} file", other: "{count} files" } }).f as object), ["one", "other"]);
});

test("XLIFF: one unit per text and per plural form of the language, and back", () => {
  const en = { "app.title": "Tom & Jerry <3", "app.files": { one: "{count} file", other: "{count} files" } };
  const xml = toXliff("ru", en, { "app.title": "Том и Джерри" }, { notes: { "app.title": "Window title" } });
  assert.match(xml, /target-language="ru"/);
  assert.match(xml, /<source>Tom &amp; Jerry &lt;3<\/source>/);
  assert.match(xml, /<target state="translated">Том и Джерри<\/target>/);
  assert.match(xml, /<note>Window title<\/note>/);
  for (const c of ["one", "few", "many", "other"]) assert.match(xml, new RegExp(`id="app.files#${c}"`));
  const filled = xml
    .replace('id="app.files#one" xml:space="preserve">\n        <source>{count} file</source>\n        <target state="needs-translation"></target>', 'id="app.files#one" xml:space="preserve">\n        <source>{count} file</source>\n        <target>{count} файл</target>')
    .replace(/(id="app.files#other"[\s\S]*?)<target state="needs-translation"><\/target>/, "$1<target>{count} файла</target>");
  const back = fromXliff(filled, en);
  assert.deepEqual(back.problems, []);
  assert.deepEqual(back.catalog, { "app.title": "Том и Джерри", "app.files": { one: "{count} файл", other: "{count} файла" } });
  assert.match(fromXliff('<trans-unit id="nope"><source>x</source><target>y</target></trans-unit>', en).problems.join(), /"nope" is in the XLIFF file and not in English/);
  assert.match(fromXliff('<trans-unit id="app.title"><source>x</source><target>a <g id="1">b</g></target></trans-unit>', en).problems.join(), /markup/);
  assert.match(fromXliff("<xliff/>", en).problems.join(), /no translation units/);
});

test("the command line: status, XLIFF round trip, context, outdated, pseudo", () => {
  const tool = new URL("../tools/lang.mjs", import.meta.url).pathname;
  const run = (...args: string[]) => spawnSync(process.execPath, [tool, ...args], { encoding: "utf8" });
  const dir = mkdtempSync(join(tmpdir(), "ks-lang-"));
  try {
    const app = join(dir, "app");
    mkdirSync(app);
    const en = { "app.title": "Hello {name}", "app.bye": "Bye", "app.files": { one: "{count} file", other: "{count} files" } };
    writeFileSync(join(app, "en.json"), JSON.stringify(en));
    writeFileSync(join(app, "hi.json"), JSON.stringify({ "app.title": "नमस्ते {name}", "app.bye": "अलविदा", "app.files": { one: "{count} फ़ाइल", other: "{count} फ़ाइलें" } }));
    writeFileSync(join(app, "_context.json"), JSON.stringify({ "app.title": { note: "Greeting on the home screen", maxLength: 30 }, "app.bye": "Shown when the app closes" }));
    assert.equal(run("check", app).status, 0, run("check", app).stderr);

    const xlf = join(dir, "fr.xlf");
    const exp = run("export-xliff", app, "--lang", "fr", "--out", xlf);
    assert.equal(exp.status, 0, exp.stderr);
    assert.match(exp.stdout, /3 keys to translate/);
    for (const c of ["one", "many", "other"]) assert.match(readFileSync(xlf, "utf8"), new RegExp(`id="app.files#${c}"`), "French plural forms");
    let xml = readFileSync(xlf, "utf8");
    assert.match(xml, /<note>Greeting on the home screen At most 30 characters\.<\/note>/);
    xml = xml.replace(/(id="app.title"[\s\S]*?)<target state="needs-translation"><\/target>/, "$1<target>Bonjour {name}</target>");
    writeFileSync(xlf, xml);
    const imp = run("import-xliff", xlf, "--lang", "fr", "--into", app);
    assert.equal(imp.status, 0, imp.stderr);
    assert.deepEqual(JSON.parse(readFileSync(join(app, "fr.json"), "utf8")), { "app.title": "Bonjour {name}" });
    assert.ok(JSON.parse(readFileSync(join(app, "_state.json"), "utf8")).fr["app.title"].en, "the state records the English");
    assert.equal(run("import-xliff", xlf, "--lang", "de", "--into", app).status, 1, "a file for another language");

    let st = run("status", app);
    assert.equal(st.status, 0, st.stderr);
    assert.match(st.stdout, /fr\s+1 of 3\s+33%\s+\(2 to translate\)/);
    assert.match(st.stdout, /hi\s+3 of 3\s+100%/);

    // English changes: the French translation is outdated.
    writeFileSync(join(app, "en.json"), JSON.stringify({ ...en, "app.title": "Hello, {name}!" }));
    writeFileSync(join(app, "hi.json"), JSON.stringify({ "app.title": "नमस्ते, {name}!", "app.bye": "अलविदा", "app.files": { one: "{count} फ़ाइल", other: "{count} फ़ाइलें" } }));
    st = run("status", app);
    assert.match(st.stdout, /fr\s+1 of 3\s+33%\s+\(2 to translate, 1 outdated\)/);
    assert.match(readFileSync(xlf, "utf8"), /app\.title/);
    run("export-xliff", app, "--lang", "fr", "--out", xlf);
    assert.match(readFileSync(xlf, "utf8"), /<target state="translated">Bonjour \{name\}<\/target>/, "an outdated text is exported with its old translation");

    writeFileSync(join(app, "_context.json"), JSON.stringify({ "app.gone": "x" }));
    assert.match(run("check", app).stderr, /_context.json has "app.gone", which is not in en/);
    writeFileSync(join(app, "_context.json"), "{}");

    const res = join(dir, "res");
    const conv = run("android", app, "--out", res, "--pseudo");
    assert.equal(conv.status, 0, conv.stderr);
    assert.match(readFileSync(join(res, "values-en-rXA/lang_strings.xml"), "utf8"), /<string name="app_bye">\[Ɓýé .+\]<\/string>/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the translation editor: served on this computer only, saves only what passes the check", async () => {
  const { startEditor } = await import("../tools/translate.ts");
  const dir = mkdtempSync(join(tmpdir(), "ks-lang-"));
  const other = mkdtempSync(join(tmpdir(), "ks-lang-"));
  try {
    writeFileSync(join(dir, "en.json"), JSON.stringify({ "app.title": "Hello {name}", "app.cancel": "Cancel order", "app.files": { one: "{count} file", other: "{count} files" } }));
    writeFileSync(join(dir, "hi.json"), JSON.stringify({ "app.title": "नमस्ते {name}", "app.cancel": "ऑर्डर रद्द करें", "app.files": { one: "{count} फ़ाइल", other: "{count} फ़ाइलें" } }));
    writeFileSync(join(other, "en.json"), JSON.stringify({ "x.cancel": "Cancel order" }));
    writeFileSync(join(other, "hi.json"), JSON.stringify({ "x.cancel": "ऑर्डर रद्द करें" }));
    writeFileSync(join(other, "ru.json"), JSON.stringify({ "x.cancel": "Отменить заказ" }));
    const root = new URL("../../", import.meta.url).pathname;
    const editor = await startEditor({ dirs: [dir], memory: [other], root, languages: ["ru"] });
    try {
      const base = editor.url.slice(0, editor.url.indexOf("/?"));
      const get = (path: string, token = editor.token) => fetch(base + path, { headers: { "x-ks-token": token } });
      const post = (path: string, body: unknown) => fetch(base + path, { method: "POST", headers: { "x-ks-token": editor.token, "content-type": "application/json" }, body: JSON.stringify(body) });

      assert.match(editor.url, /^http:\/\/127\.0\.0\.1:\d+\/\?t=/);
      assert.equal((await fetch(base + "/")).status, 403, "the page needs the token");
      assert.equal((await fetch(editor.url)).status, 200);
      assert.equal((await get("/api/project", "wrong")).status, 403);

      const project = (await (await get("/api/project")).json()) as { languages: { code: string }[] };
      assert.deepEqual(project.languages.map((l) => l.code), ["hi", "ru"]);
      const view = (await (await get("/api/folder?folder=0&lang=ru")).json()) as { categories: string[]; rows: { key: string; status: string; suggestion: unknown }[] };
      assert.deepEqual(view.categories, ["one", "few", "many", "other"]);
      assert.equal(view.rows.find((r) => r.key === "app.cancel")?.suggestion, "Отменить заказ", "translation memory from the other folder");
      assert.equal(view.rows[0].status, "untranslated");

      const fill = (await (await post("/api/pretranslate", { folder: 0, lang: "ru" })).json()) as { changes: Record<string, string> };
      assert.deepEqual(fill.changes, { "app.cancel": "Отменить заказ" });

      const qa = (await (await post("/api/qa", { folder: 0, lang: "ru", key: "app.title", entry: "Привет {imya}" })).json()) as { errors: string[] };
      assert.match(qa.errors.join(), /placeholders \{imya\}/);

      const bad = (await (await post("/api/save", { folder: 0, lang: "ru", changes: { "app.title": "Привет {imya}" } })).json()) as { saved: boolean; problems: string[] };
      assert.equal(bad.saved, false);
      assert.ok(!readdirSync(dir).includes("ru.json"), "nothing written");

      const good = (await (await post("/api/save", { folder: 0, lang: "ru", changes: { "app.title": "Привет {name}", "app.files": { one: "{count} файл", few: "{count} файла", many: "{count} файлов", other: "{count} файла" } }, approve: ["app.title"] })).json()) as { saved: boolean; view: { rows: { key: string; status: string }[] } };
      assert.equal(good.saved, true);
      assert.deepEqual(JSON.parse(readFileSync(join(dir, "ru.json"), "utf8")), { "app.title": "Привет {name}", "app.files": { one: "{count} файл", few: "{count} файла", many: "{count} файлов", other: "{count} файла" } });
      assert.equal(good.view.rows.find((r) => r.key === "app.title")?.status, "approved");
      assert.equal(good.view.rows.find((r) => r.key === "app.files")?.status, "translated");

      const sugg = (await (await post("/api/suggestions", { folder: 0, lang: "ru", key: "app.cancel" })).json()) as { score: number }[];
      assert.equal(sugg[0].score, 100);
      assert.equal((await post("/api/save", { folder: 5, lang: "ru", changes: {} })).status, 404);
      assert.equal((await post("/api/save", { folder: 0, lang: "en", changes: {} })).status, 400, "English is never edited here");
      const wrongHost = await new Promise<number>((ok) => {
        import("node:http").then(({ request }) => {
          const u = new URL(base);
          const r = request({ host: "127.0.0.1", port: u.port, path: "/api/project", headers: { host: "evil.example", "x-ks-token": editor.token } }, (res) => ok(res.statusCode ?? 0));
          r.end();
        });
      });
      assert.equal(wrongHost, 421, "another host name is refused (DNS rebinding)");
    } finally {
      await editor.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(other, { recursive: true, force: true });
  }
});
