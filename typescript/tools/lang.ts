#!/usr/bin/env node
// The suite's language-file command (specs/usage.md, "Language files"). Node 23.6 or
// later runs it as it is (TypeScript types are stripped); it needs nothing else.
//
//   node <ks-utility>/typescript/tools/lang.mjs check <dir>... [--chrome <_locales dir>]...
//   node <ks-utility>/typescript/tools/lang.mjs android <dir>... --out <res dir> [--name <file>]
//   node <ks-utility>/typescript/tools/lang.mjs compose <dir>... --out <res dir> [--name <file>]
//   node <ks-utility>/typescript/tools/lang.mjs status <dir>...
//   node <ks-utility>/typescript/tools/lang.mjs translate <dir>... [--lang <code>]... [--memory <dir>]... [--port <n>]
//   node <ks-utility>/typescript/tools/lang.mjs export-xliff <dir> --lang <code> --out <file> [--all]
//   node <ks-utility>/typescript/tools/lang.mjs import-xliff <file> --lang <code> --into <dir>
//
// `android` writes Android string resources; `compose` writes the same files escaped for
// Compose Multiplatform resources, which do not undo Android's `\'`, `\"` or `%%`.
//
// lang.mjs is the entry point: Node does not strip types from files inside node_modules,
// so it runs a copy of the tools and src/lang from a temporary folder.
//
// `android` and `compose` take `--pseudo` to add the pseudo-locale (en-XA) for layout tests.
// `export-xliff` writes the texts still to translate (or `--all`) for a translator's own
// tool; `import-xliff` merges the translated file back, checked first.
// `status` shows how much of each language is translated, outdated and approved. `translate` opens the translation
// editor (translate.ts): a page served on this computer only, which writes a language file
// only when it passes the check.
//
// Each <dir> holds one file per language, named by its code: en.json and hi.json always,
// and any others (fr.json, pt-BR.json). The shared catalogue (lang/common) is always
// included: checked, and an app key that redefines one of its keys fails.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Catalog } from "../src/lang/catalog.ts";
import { checkLanguages, duplicateKeys, fromChromeMessages, type Term } from "../src/lang/check.ts";
import { resourceFolder, resourceNameProblems, toAndroidXml, type ResourceTarget } from "../src/lang/android.ts";
import { isLanguageCode } from "../src/lang/language.ts";
import { PSEUDO_LANGUAGE, pseudoCatalog } from "../src/lang/pseudo.ts";
import { fromXliff, toXliff } from "../src/lang/xliff.ts";
import { STATE_FILE, keyStatus, nextState, progress, readContext, readGlossaries, readJson, readLanguages, readState, writeJson } from "./files.ts";
import { startEditor } from "./translate.ts";

/** The ks-utility folder, for the shared catalogue and term list. */
let ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const common = () => join(ROOT, "lang/common");
const termsFile = () => join(ROOT, "lang/hindi-terms.json");

/** The Chrome `_locales` folders of `dir`, by language code (`pt_BR` → `pt-BR`). */
function readChromeLocales(dir: string): { catalogs: Record<string, unknown>; problems: string[] } {
  const catalogs: Record<string, unknown> = {};
  const problems: string[] = [];
  for (const sub of readdirSync(dir).sort()) {
    const file = join(dir, sub, "messages.json");
    if (!existsSync(file)) continue;
    const code = sub.replace(/_/g, "-");
    const m = fromChromeMessages(code, readJson(file));
    catalogs[code] = m.catalog;
    problems.push(...m.problems);
  }
  return { catalogs, problems };
}

interface Args {
  dirs: string[];
  chrome: string[];
  out?: string;
  langs: string[];
  port?: number;
  into?: string;
  memory: string[];
  all: boolean;
  pseudo: boolean;
  name: string;
}

function parse(argv: string[]): Args {
  const a: Args = { dirs: [], chrome: [], langs: [], memory: [], name: "lang_strings", all: false, pseudo: false };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    const next = () => {
      const n = argv[++i];
      if (n === undefined) throw new Error(`${v} needs a value`);
      return n;
    };
    if (v === "--chrome") a.chrome.push(next());
    else if (v === "--out") a.out = next();
    else if (v === "--name") a.name = next();
    else if (v === "--lang") a.langs.push(next());
    else if (v === "--into") a.into = next();
    else if (v === "--all") a.all = true;
    else if (v === "--memory") a.memory.push(next());
    else if (v === "--pseudo") a.pseudo = true;
    else if (v === "--port") {
      const n = Number(next());
      if (!Number.isInteger(n) || n < 0 || n > 65535) throw new Error("--port needs a port number");
      a.port = n;
    }
    else if (v.startsWith("--")) throw new Error(`unknown option ${v}`);
    else a.dirs.push(v);
  }
  return a;
}

/** Every problem in the given language folders and Chrome `_locales` folders. */
export function check(dirs: string[], chrome: string[] = []): string[] {
  const terms = readJson(termsFile()) as Term[];
  const { glossaries, problems: glossaryProblems } = readGlossaries(ROOT);
  const out: string[] = [...glossaryProblems];
  const english: Catalog[] = [];
  for (const dir of [common(), ...dirs.map((d) => resolve(d))]) {
    try {
      const catalogs = readLanguages(dir);
      out.push(...checkLanguages(catalogs, terms, { glossaries }).map((p) => `${dir}: ${p}`));
      const { context, problems } = readContext(dir);
      out.push(...problems.map((p) => `${dir}: ${p}`));
      for (const key of Object.keys(context)) if (catalogs.en && !(key in (catalogs.en as Catalog))) out.push(`${dir}: _context.json has "${key}", which is not in en`);
      if (catalogs.en) english.push(catalogs.en as Catalog);
    } catch (e) {
      out.push(`${dir}: ${(e as Error).message}`);
    }
  }
  out.push(...duplicateKeys(english).map((k) => `"${k}" is defined twice (an app key may not redefine a shared one)`));
  for (const dir of chrome.map((d) => resolve(d))) {
    try {
      const { catalogs, problems } = readChromeLocales(dir);
      out.push(...[...problems, ...checkLanguages(catalogs, terms, { anyKeys: true, glossaries })].map((p) => `${dir}: ${p}`));
    } catch (e) {
      out.push(`${dir}: ${(e as Error).message}`);
    }
  }
  return out;
}

/**
 * Writes `values/<name>.xml` (English), `values-hi/<name>.xml` and one folder for every other
 * language under `out`, escaped for `target`: Android's own resources (default) or Compose
 * Multiplatform resources. Returns the problems, or the folders written in `written`.
 */
export function android(dirs: string[], out: string, name: string, target: ResourceTarget = "android", written: string[] = [], pseudo = false): string[] {
  const problems = check(dirs);
  if (problems.length) return problems;
  const layers = [common(), ...dirs.map((d) => resolve(d))].map(readLanguages);
  const langs = [...new Set(layers.flatMap((l) => Object.keys(l)))].sort((a, b) => (a === "en" ? -1 : b === "en" ? 1 : a.localeCompare(b)));
  const merged = (lang: string): Catalog => Object.assign({}, ...layers.map((l) => (l[lang] ?? {}) as Catalog));
  const en = merged("en");
  const names = resourceNameProblems(Object.keys(en));
  if (names.length) return names;
  const folders: [string, Catalog][] = [];
  for (const lang of langs) {
    const folder = resourceFolder(lang, target);
    if (folder === null) return [`${lang}: Compose Multiplatform resources have no folder for a script or a numeric region; use a code like "pt-BR"`];
    folders.push([folder, merged(lang)]);
  }
  if (pseudo) folders.push([resourceFolder(PSEUDO_LANGUAGE, target) as string, pseudoCatalog(en)]);
  for (const [folder, catalog] of folders) {
    mkdirSync(join(out, folder), { recursive: true });
    writeFileSync(join(out, folder, `${name}.xml`), toAndroidXml(catalog, en, "ks-utility", target));
    written.push(`${folder}/${name}.xml`);
  }
  return [];
}

/** One line per language of each folder: translated, outdated and approved keys. */
export function status(dirs: string[]): { lines: string[]; problems: string[] } {
  const lines: string[] = [];
  const problems: string[] = [];
  for (const dir of [common(), ...dirs.map((d) => resolve(d))]) {
    try {
      const catalogs = readLanguages(dir);
      if (!catalogs.en) {
        problems.push(`${dir}: en.json is missing`);
        continue;
      }
      lines.push(dir);
      for (const p of progress(catalogs, readState(dir))) {
        const pct = p.total ? Math.floor((100 * p.done) / p.total) : 100;
        const notes = [
          p.total > p.done ? `${p.total - p.done} to translate` : "",
          p.outdated ? `${p.outdated} outdated` : "",
          p.approved ? `${p.approved} approved` : "",
        ].filter(Boolean);
        lines.push(`  ${p.lang.padEnd(8)} ${String(p.done).padStart(5)} of ${p.total}  ${String(pct).padStart(3)}%${notes.length ? `  (${notes.join(", ")})` : ""}`);
      }
    } catch (e) {
      problems.push(`${dir}: ${(e as Error).message}`);
    }
  }
  return { lines, problems };
}

/** Writes an XLIFF file of `<dir>` for `lang`: the keys to translate (untranslated, outdated), or all. */
export function exportXliff(dir: string, lang: string, out: string, all: boolean): { problems: string[]; units: number } {
  if (!isLanguageCode(lang) || lang === "en") return { problems: [`${lang}: not a language to translate into`], units: 0 };
  const folder = resolve(dir);
  const catalogs = readLanguages(folder);
  const en = catalogs.en as Catalog | undefined;
  if (!en) return { problems: [`${folder}: en.json is missing`], units: 0 };
  const tr = (catalogs[lang] ?? {}) as Catalog;
  const state = readState(folder)[lang] ?? {};
  const keys = Object.keys(en).filter((k) => all || ["untranslated", "outdated"].includes(keyStatus(en[k], tr[k], state[k])));
  const { context } = readContext(folder);
  const notes = Object.fromEntries(Object.entries(context).map(([k, c]) => [k, [c.note, c.maxLength ? `At most ${c.maxLength} characters.` : ""].filter(Boolean).join(" ")]));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, toXliff(lang, en, tr, { keys, notes, original: `${basename(folder)}/en.json` }));
  return { problems: [], units: keys.length };
}

/**
 * Merges the translations of an XLIFF file into `<dir>/<lang>.json`. The folder with the new
 * file must pass the check; otherwise nothing is written and the problems are returned.
 */
export function importXliff(file: string, lang: string, dir: string): { problems: string[]; keys: number } {
  if (!isLanguageCode(lang) || lang === "en") return { problems: [`${lang}: not a language to import (en.json is the source)`], keys: 0 };
  const folder = resolve(dir);
  const catalogs = readLanguages(folder);
  const en = catalogs.en as Catalog | undefined;
  if (!en) return { problems: [`${folder}: en.json is missing`], keys: 0 };
  const { catalog, problems } = fromXliff(readFileSync(resolve(file), "utf8"), en);
  if (problems.length) return { problems: problems.map((p) => `${file}: ${p}`), keys: 0 };
  const target = /target-language="([^"]+)"/.exec(readFileSync(resolve(file), "utf8"))?.[1];
  if (target && target !== lang) return { problems: [`${file}: the file is for ${target}, not ${lang}`], keys: 0 };
  const prev = (catalogs[lang] ?? {}) as Catalog;
  const merged: Catalog = {};
  for (const k of Object.keys(en)) {
    const v = catalog[k] ?? prev[k];
    if (v !== undefined) merged[k] = v;
  }
  const found = checkLanguages({ ...catalogs, [lang]: merged }, readJson(termsFile()) as Term[], { glossaries: readGlossaries(ROOT).glossaries });
  if (found.length) return { problems: found.map((p) => `${folder}: ${p}`), keys: 0 };
  writeJson(join(folder, `${lang}.json`), merged);
  const state = readState(folder);
  state[lang] = nextState(en, prev, merged, state[lang]);
  writeJson(join(folder, STATE_FILE), state);
  return { problems: [], keys: Object.keys(catalog).length };
}

const USAGE =
  "usage: lang.mjs check <dir>... [--chrome <_locales dir>]...\n" +
  "       lang.mjs android|compose <dir>... --out <res dir> [--name <file>] [--pseudo]\n" +
  "       lang.mjs status <dir>...\n" +
  "       lang.mjs translate <dir>... [--lang <code>]... [--memory <dir>]... [--port <n>]\n" +
  "       lang.mjs export-xliff <dir> --lang <code> --out <file> [--all]\n" +
  "       lang.mjs import-xliff <file> --lang <code> --into <dir>";

/**
 * Runs the command; `root` is the ks-utility folder when this file is a copy. `translate`
 * returns a promise that settles when the editor is stopped (Ctrl+C).
 */
export function main(argv: string[], root?: string): number | Promise<number> {
  if (root) ROOT = root;
  const [command, ...rest] = argv;
  let args: Args;
  try {
    args = parse(rest);
  } catch (e) {
    console.error((e as Error).message);
    return 2;
  }
  if (command === "translate") return translate(args);
  let problems: string[];
  let done = "Language files: OK.";
  const written: string[] = [];
  if (command === "check") problems = check(args.dirs, args.chrome);
  else if ((command === "android" || command === "compose") && args.out) {
    problems = android(args.dirs, resolve(args.out), args.name, command, written, args.pseudo);
    done = `Wrote ${written.join(", ")}.`;
  } else if (command === "status") {
    const r = status(args.dirs);
    problems = r.problems;
    done = r.lines.join("\n");
  } else if (command === "export-xliff" && args.dirs.length === 1 && args.langs.length === 1 && args.out) {
    const r = exportXliff(args.dirs[0], args.langs[0], resolve(args.out), args.all);
    problems = r.problems;
    done = `Wrote ${args.out} (${r.units} key${r.units === 1 ? "" : "s"} to translate).`;
  } else if (command === "import-xliff" && args.dirs.length === 1 && args.langs.length === 1 && args.into) {
    const r = importXliff(args.dirs[0], args.langs[0], args.into);
    problems = r.problems;
    done = `Wrote ${join(args.into, `${args.langs[0]}.json`)} (${r.keys} key${r.keys === 1 ? "" : "s"} from the XLIFF file).`;
  } else {
    console.error(USAGE);
    return 2;
  }
  for (const p of problems) console.error(p);
  if (problems.length) {
    console.error(`${problems.length} problem(s) in the language files.`);
    return 1;
  }
  console.log(done);
  return 0;
}

/** Opens the translation editor on the given folders until Ctrl+C. */
async function translate(args: Args): Promise<number> {
  if (args.dirs.length === 0) {
    console.error(USAGE);
    return 2;
  }
  const bad = args.langs.filter((l) => !isLanguageCode(l) || l === "en");
  if (bad.length) {
    console.error(`${bad.join(", ")}: not a language to translate into (use "fr", "pt-BR", "zh-Hans")`);
    return 2;
  }
  const problems = check(args.dirs).filter((p) => /: en: |is in en and not in hi|is defined twice|missing/.test(p));
  if (problems.length) {
    for (const p of problems) console.error(p);
    console.error("Fix English first: the editor translates from en.json.");
    return 1;
  }
  const editor = await startEditor({ dirs: args.dirs.map((d) => resolve(d)), memory: args.memory, root: ROOT, languages: args.langs, port: args.port });
  console.log(`Translation editor: ${editor.url}\nOnly this computer can open it. Press Ctrl+C to stop.`);
  await new Promise<void>((done) => {
    const stop = () => {
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
      editor.close().then(done, done);
    };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
  });
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const code = main(process.argv.slice(2));
  if (typeof code === "number") process.exitCode = code;
  else code.then((c) => (process.exitCode = c));
}
