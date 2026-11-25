#!/usr/bin/env node
// The suite's language-file command (specs/usage.md, "Language files"). Node 23.6 or
// later runs it as it is (TypeScript types are stripped); it needs nothing else.
//
//   node <ks-utility>/typescript/tools/lang.mjs check <dir>... [--chrome <_locales dir>]...
//   node <ks-utility>/typescript/tools/lang.mjs android <dir>... --out <res dir> [--name <file>]
//   node <ks-utility>/typescript/tools/lang.mjs compose <dir>... --out <res dir> [--name <file>]
//   node <ks-utility>/typescript/tools/lang.mjs crowdin-export <dir> --out <file>
//   node <ks-utility>/typescript/tools/lang.mjs crowdin-import <file> --lang <code> --into <dir>
//
// `android` writes Android string resources; `compose` writes the same files escaped for
// Compose Multiplatform resources, which do not undo Android's `\'`, `\"` or `%%`.
//
// lang.mjs is the entry point: Node does not strip types from files inside node_modules,
// so it runs a copy of this file and src/lang from a temporary folder.
//
// `crowdin-export` writes the Crowdin source file of <dir>/en.json; `crowdin-import` turns a
// file Crowdin translated back into <dir>/<code>.json, checked first (written only when it
// passes).
//
// Each <dir> holds one file per language, named by its code: en.json and hi.json always,
// and any others (fr.json, pt-BR.json). The shared catalogue (lang/common) is always
// included: checked, and an app key that redefines one of its keys fails.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Catalog } from "../src/lang/catalog.ts";
import { checkLanguages, duplicateKeys, fromChromeMessages, type Term } from "../src/lang/check.ts";
import { resourceFolder, resourceNameProblems, toAndroidXml, type ResourceTarget } from "../src/lang/android.ts";
import { fromCrowdin, toCrowdinSource } from "../src/lang/crowdin.ts";
import { isLanguageCode } from "../src/lang/language.ts";

/** The ks-utility folder, for the shared catalogue and term list. */
let ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const common = () => join(ROOT, "lang/common");
const termsFile = () => join(ROOT, "lang/hindi-terms.json");

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, "utf8"));
}

/** The language files of a folder, by code: every `<code>.json` in it. */
function readLanguages(dir: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of readdirSync(dir).sort()) if (f.endsWith(".json")) out[f.slice(0, -5)] = readJson(join(dir, f));
  return out;
}

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
  into?: string;
  lang?: string;
  name: string;
}

function parse(argv: string[]): Args {
  const a: Args = { dirs: [], chrome: [], name: "lang_strings" };
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
    else if (v === "--into") a.into = next();
    else if (v === "--lang") a.lang = next();
    else if (v.startsWith("--")) throw new Error(`unknown option ${v}`);
    else a.dirs.push(v);
  }
  return a;
}

/** Every problem in the given language folders and Chrome `_locales` folders. */
export function check(dirs: string[], chrome: string[] = []): string[] {
  const terms = readJson(termsFile()) as Term[];
  const out: string[] = [];
  const english: Catalog[] = [];
  for (const dir of [common(), ...dirs.map((d) => resolve(d))]) {
    try {
      const catalogs = readLanguages(dir);
      out.push(...checkLanguages(catalogs, terms).map((p) => `${dir}: ${p}`));
      if (catalogs.en) english.push(catalogs.en as Catalog);
    } catch (e) {
      out.push(`${dir}: ${(e as Error).message}`);
    }
  }
  out.push(...duplicateKeys(english).map((k) => `"${k}" is defined twice (an app key may not redefine a shared one)`));
  for (const dir of chrome.map((d) => resolve(d))) {
    try {
      const { catalogs, problems } = readChromeLocales(dir);
      out.push(...[...problems, ...checkLanguages(catalogs, terms, { anyKeys: true })].map((p) => `${dir}: ${p}`));
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
export function android(dirs: string[], out: string, name: string, target: ResourceTarget = "android", written: string[] = []): string[] {
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
  for (const [folder, catalog] of folders) {
    mkdirSync(join(out, folder), { recursive: true });
    writeFileSync(join(out, folder, `${name}.xml`), toAndroidXml(catalog, en, "ks-utility", target));
    written.push(`${folder}/${name}.xml`);
  }
  return [];
}

/** Writes the Crowdin source file of `<dir>/en.json` to `out`. */
export function crowdinExport(dir: string, out: string): string[] {
  const problems = check([dir]);
  if (problems.length) return problems;
  const { file, problems: p } = toCrowdinSource(readJson(join(resolve(dir), "en.json")) as Catalog);
  if (p.length) return p;
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(file, null, 2) + "\n");
  return [];
}

/**
 * Turns the Crowdin file `file` for `lang` into `<dir>/<lang>.json`. The folder with the new
 * file must pass the check; otherwise nothing is written and the problems are returned.
 */
export function crowdinImport(file: string, lang: string, dir: string): string[] {
  if (!isLanguageCode(lang)) return [`${lang}: not a language code (use "fr", "pt-BR", "zh-Hans")`];
  if (lang === "en") return ["en.json is the source; it is never imported from Crowdin"];
  const folder = resolve(dir);
  const catalogs = readLanguages(folder);
  const { catalog, problems } = fromCrowdin(readJson(resolve(file)), catalogs.en as Catalog);
  if (problems.length) return problems.map((p) => `${file}: ${p}`);
  catalogs[lang] = catalog;
  const terms = readJson(termsFile()) as Term[];
  const found = checkLanguages(catalogs, terms);
  if (found.length) return found.map((p) => `${folder}: ${p}`);
  writeFileSync(join(folder, `${lang}.json`), JSON.stringify(catalog, null, 2) + "\n");
  return [];
}

/** Runs the command; `root` is the ks-utility folder when this file is a copy. */
export function main(argv: string[], root?: string): number {
  if (root) ROOT = root;
  const [command, ...rest] = argv;
  let args: Args;
  try {
    args = parse(rest);
  } catch (e) {
    console.error((e as Error).message);
    return 2;
  }
  let problems: string[];
  let done = "Language files: OK.";
  const written: string[] = [];
  if (command === "check") problems = check(args.dirs, args.chrome);
  else if ((command === "android" || command === "compose") && args.out) {
    problems = android(args.dirs, resolve(args.out), args.name, command, written);
    done = `Wrote ${written.join(", ")}.`;
  } else if (command === "crowdin-export" && args.dirs.length === 1 && args.out) {
    problems = crowdinExport(args.dirs[0], resolve(args.out));
    done = `Wrote ${args.out}.`;
  } else if (command === "crowdin-import" && args.dirs.length === 1 && args.lang && args.into) {
    problems = crowdinImport(args.dirs[0], args.lang, args.into);
    done = `Wrote ${join(args.into, `${args.lang}.json`)}.`;
  } else {
    console.error(
      "usage: lang.mjs check <dir>... [--chrome <_locales dir>]...\n" +
        "       lang.mjs android|compose <dir>... --out <res dir> [--name <file>]\n" +
        "       lang.mjs crowdin-export <dir> --out <file>\n" +
        "       lang.mjs crowdin-import <file> --lang <code> --into <dir>",
    );
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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
