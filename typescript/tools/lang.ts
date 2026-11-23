#!/usr/bin/env node
// The suite's language-file command (specs/usage.md, "Language files"). Node 23.6 or
// later runs it as it is (TypeScript types are stripped); it needs nothing else.
//
//   node <ks-utility>/typescript/tools/lang.mjs check <dir>... [--chrome <_locales dir>]...
//   node <ks-utility>/typescript/tools/lang.mjs android <dir>... --out <res dir> [--name <file>]
//   node <ks-utility>/typescript/tools/lang.mjs compose <dir>... --out <res dir> [--name <file>]
//
// `android` writes Android string resources; `compose` writes the same files escaped for
// Compose Multiplatform resources, which do not undo Android's `\'`, `\"` or `%%`.
//
// lang.mjs is the entry point: Node does not strip types from files inside node_modules,
// so it runs a copy of this file and src/lang from a temporary folder.
//
// Each <dir> holds en.json and hi.json. The shared catalogue (lang/common) is always
// included: checked, and an app key that redefines one of its keys fails.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Catalog } from "../src/lang/catalog.ts";
import { checkCatalogs, duplicateKeys, fromChromeMessages, type Term } from "../src/lang/check.ts";
import { resourceNameProblems, toAndroidXml, type ResourceTarget } from "../src/lang/android.ts";

/** The ks-utility folder, for the shared catalogue and term list. */
let ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const common = () => join(ROOT, "lang/common");
const termsFile = () => join(ROOT, "lang/hindi-terms.json");

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, "utf8"));
}

interface Args {
  dirs: string[];
  chrome: string[];
  out?: string;
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
      const en = readJson(join(dir, "en.json"));
      const hi = readJson(join(dir, "hi.json"));
      out.push(...checkCatalogs(en, hi, terms).map((p) => `${dir}: ${p}`));
      english.push(en as Catalog);
    } catch (e) {
      out.push(`${dir}: ${(e as Error).message}`);
    }
  }
  out.push(...duplicateKeys(english).map((k) => `"${k}" is defined twice (an app key may not redefine a shared one)`));
  for (const dir of chrome.map((d) => resolve(d))) {
    try {
      const en = fromChromeMessages("en", readJson(join(dir, "en/messages.json")));
      const hi = fromChromeMessages("hi", readJson(join(dir, "hi/messages.json")));
      out.push(...[...en.problems, ...hi.problems, ...checkCatalogs(en.catalog, hi.catalog, terms, { anyKeys: true })].map((p) => `${dir}: ${p}`));
    } catch (e) {
      out.push(`${dir}: ${(e as Error).message}`);
    }
  }
  return out;
}

/**
 * Writes `values/<name>.xml` and `values-hi/<name>.xml` under `out`, escaped for `target`:
 * Android's own resources (default) or Compose Multiplatform resources.
 */
export function android(dirs: string[], out: string, name: string, target: ResourceTarget = "android"): string[] {
  const problems = check(dirs);
  if (problems.length) return problems;
  const layers = [common(), ...dirs.map((d) => resolve(d))];
  const en: Catalog = Object.assign({}, ...layers.map((d) => readJson(join(d, "en.json"))));
  const hi: Catalog = Object.assign({}, ...layers.map((d) => readJson(join(d, "hi.json"))));
  const names = resourceNameProblems(Object.keys(en));
  if (names.length) return names;
  for (const [folder, catalog] of [["values", en], ["values-hi", hi]] as const) {
    mkdirSync(join(out, folder), { recursive: true });
    writeFileSync(join(out, folder, `${name}.xml`), toAndroidXml(catalog, en, "ks-utility", target));
  }
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
  if (command === "check") problems = check(args.dirs, args.chrome);
  else if ((command === "android" || command === "compose") && args.out) {
    problems = android(args.dirs, resolve(args.out), args.name, command);
  }
  else {
    console.error("usage: lang.mjs check <dir>... [--chrome <_locales dir>]...\n       lang.mjs android|compose <dir>... --out <res dir> [--name <file>]");
    return 2;
  }
  for (const p of problems) console.error(p);
  if (problems.length) {
    console.error(`${problems.length} problem(s) in the language files.`);
    return 1;
  }
  console.log(command === "check" ? "Language files: OK." : `Wrote values/${args.name}.xml and values-hi/${args.name}.xml.`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
