// Reading language folders, for the language-file command (lang.ts) and the translation
// editor (translate.ts): the language files, the translators' context, the review state
// (what each translation was made from, and whether it is approved) and the glossaries.

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { isPlural, type Catalog, type Entry } from "../src/lang/catalog.ts";
import { hindiGlossary, type GlossaryTerm, type Term } from "../src/lang/check.ts";
import type { KeyContext } from "../src/lang/qa.ts";
import { isLanguageCode } from "../src/lang/language.ts";

export function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, "utf8"));
}

/** JSON as the language files are written: two spaces, a final newline. */
export function writeJson(file: string, value: unknown): void {
  writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}

/** The context file of a folder: notes and length limits for translators. Not a language. */
export const CONTEXT_FILE = "_context.json";
/** The review state of a folder: what each translation was made from, and approvals. */
export const STATE_FILE = "_state.json";

/** The language files of a folder, by code: every `<code>.json` in it (not `_…` files). */
export function readLanguages(dir: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of readdirSync(dir).sort()) if (f.endsWith(".json") && !f.startsWith("_")) out[f.slice(0, -5)] = readJson(join(dir, f));
  return out;
}

/** Every language but English in the order a list shows them: Hindi first, then by code. */
export function translationLanguages(codes: Iterable<string>): string[] {
  return [...new Set(codes)].filter((c) => c !== "en").sort((a, b) => (a === "hi" ? -1 : b === "hi" ? 1 : a.localeCompare(b)));
}

/** The context of a folder by key (`"key": "note"` or `"key": { note, maxLength }`). */
export function readContext(dir: string): { context: Record<string, KeyContext>; problems: string[] } {
  const file = join(dir, CONTEXT_FILE);
  if (!existsSync(file)) return { context: {}, problems: [] };
  const raw = readJson(file);
  const context: Record<string, KeyContext> = {};
  const problems: string[] = [];
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { context, problems: [`${CONTEXT_FILE} must hold one JSON object`] };
  for (const [key, v] of Object.entries(raw)) {
    if (typeof v === "string") context[key] = { note: v };
    else if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      const { note, maxLength, ...rest } = v as Record<string, unknown>;
      if (note !== undefined && typeof note !== "string") problems.push(`${CONTEXT_FILE}: "${key}" note must be a text`);
      if (maxLength !== undefined && !(Number.isInteger(maxLength) && (maxLength as number) > 0)) problems.push(`${CONTEXT_FILE}: "${key}" maxLength must be a whole number above 0`);
      if (Object.keys(rest).length) problems.push(`${CONTEXT_FILE}: "${key}" has ${Object.keys(rest).join(", ")}; only note and maxLength`);
      context[key] = { note: note as string | undefined, maxLength: maxLength as number | undefined };
    } else problems.push(`${CONTEXT_FILE}: "${key}" must be a note or { note, maxLength }`);
  }
  return { context, problems };
}

/** The review state of one translated key: a hash of the English it was made from, and approval. */
export interface KeyState {
  en: string;
  approved?: boolean;
}
export type FolderState = Record<string, Record<string, KeyState>>;

export function readState(dir: string): FolderState {
  const file = join(dir, STATE_FILE);
  if (!existsSync(file)) return {};
  const raw = readJson(file);
  return typeof raw === "object" && raw !== null && !Array.isArray(raw) ? (raw as FolderState) : {};
}

/** A short, stable hash of an English entry (all its forms). */
export function hashEntry(e: Entry): string {
  const text = isPlural(e) ? JSON.stringify(Object.keys(e).sort().map((k) => [k, e[k as keyof typeof e]])) : e;
  return createHash("sha256").update(text).digest("hex").slice(0, 12);
}

export type KeyStatus = "untranslated" | "outdated" | "translated" | "approved";

/**
 * The status of a key in a language: untranslated; outdated when English changed after it
 * was translated; approved; or translated. A key with no state yet (a file from before the
 * state, or written by hand) counts as translated from the current English.
 */
export function keyStatus(english: Entry, translation: Entry | undefined, state: KeyState | undefined): KeyStatus {
  if (translation === undefined) return "untranslated";
  if (state && state.en !== hashEntry(english)) return "outdated";
  return state?.approved ? "approved" : "translated";
}

/**
 * The state of `lang` after saving `next` over `prev`: a changed or new translation is
 * recorded as made from the current English and not approved; an unchanged one keeps its
 * state (or gets one). `confirm` marks an outdated translation as still right for the
 * current English; `approve` and `unapprove` set approval of a key explicitly (approving also
 * confirms).
 */
export function nextState(
  english: Catalog,
  prev: Catalog,
  next: Catalog,
  state: Record<string, KeyState> = {},
  approve: readonly string[] = [],
  unapprove: readonly string[] = [],
  confirm: readonly string[] = [],
): Record<string, KeyState> {
  const out: Record<string, KeyState> = {};
  for (const key of Object.keys(english)) {
    if (next[key] === undefined) continue;
    const hash = hashEntry(english[key]);
    const changed = JSON.stringify(prev[key]) !== JSON.stringify(next[key]);
    const old = state[key];
    let s: KeyState = changed || !old ? { en: hash } : { ...old };
    if (confirm.includes(key)) s = { ...s, en: hash };
    if (approve.includes(key)) s = { en: hash, approved: true };
    if (unapprove.includes(key)) s = { en: s.en };
    out[key] = s.approved ? s : { en: s.en };
  }
  return out;
}

export interface Progress {
  lang: string;
  total: number;
  /** English keys the language has a text (or plural forms) for. */
  done: number;
  outdated: number;
  approved: number;
}

/** How much of each language of a folder is translated, outdated and approved. */
export function progress(catalogs: Record<string, unknown>, state: FolderState = {}, extra: readonly string[] = []): Progress[] {
  const en = catalogs.en as Catalog;
  const keys = Object.keys(en);
  return translationLanguages([...Object.keys(catalogs), ...extra]).map((lang) => {
    const c = (catalogs[lang] ?? {}) as Catalog;
    const st = keys.map((k) => keyStatus(en[k], c[k], state[lang]?.[k]));
    return {
      lang,
      total: keys.length,
      done: st.filter((s) => s !== "untranslated").length,
      outdated: st.filter((s) => s === "outdated").length,
      approved: st.filter((s) => s === "approved").length,
    };
  });
}

/**
 * The glossaries of ks-utility by language: `lang/glossary/<code>.json` (a list of
 * `{ en, text, avoid?, note? }`) and, for Hindi, the term list.
 */
export function readGlossaries(root: string): { glossaries: Record<string, GlossaryTerm[]>; problems: string[] } {
  const glossaries: Record<string, GlossaryTerm[]> = {};
  const problems: string[] = [];
  const terms = join(root, "lang/hindi-terms.json");
  if (existsSync(terms)) glossaries.hi = hindiGlossary(readJson(terms) as Term[]);
  const dir = join(root, "lang/glossary");
  if (!existsSync(dir)) return { glossaries, problems };
  for (const f of readdirSync(dir).sort()) {
    if (!f.endsWith(".json")) continue;
    const lang = f.slice(0, -5);
    if (!isLanguageCode(lang) || lang === "en" || lang === "hi") {
      problems.push(`lang/glossary/${f}: name it by a language code other than en and hi (Hindi's is lang/hindi-terms.json)`);
      continue;
    }
    const list = readJson(join(dir, f));
    const ok = Array.isArray(list) && list.every((t) => typeof t?.en === "string" && typeof t?.text === "string" && (t.avoid === undefined || (Array.isArray(t.avoid) && t.avoid.every((a: unknown) => typeof a === "string"))));
    if (!ok) problems.push(`lang/glossary/${f}: a list of { en, text, avoid?, note? } is expected`);
    else glossaries[lang] = list as GlossaryTerm[];
  }
  return { glossaries, problems };
}
