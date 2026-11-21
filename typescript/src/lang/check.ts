// The language-file check every suite app runs (specs/translation-format.md, "Check").
// It fails when a key is in one language and not the other, when a placeholder is
// missing, repeated or changed in the Hindi text, when Hindi text uses a disallowed
// alternative from the term list, or when it contains Devanagari digits.

import { COUNT, KEY_PATTERN, PLURAL_CATEGORIES, bracesAreValid, isPlural, placeholders, type Catalog } from "./catalog.ts";

/** One row of the Hindi term list (`lang/hindi-terms.json`). */
export interface Term {
  en: string;
  hi: string;
  /** Alternatives that must not be used for this concept. */
  avoid: string[];
  /** Chosen in the guide's style but not yet approved by the owner. */
  review?: boolean;
}

export interface CheckOptions {
  /** Skip the key-name rule (Chrome `_locales` keys follow Chrome's own rule). */
  anyKeys?: boolean;
}

const DEVANAGARI_DIGIT = /[०-९]/;

/** Words of `text` (letters, marks, digits), NFC-normalised. */
function words(text: string): string[] {
  return text.normalize("NFC").split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean);
}

/** True when the words of `phrase` appear one after another in `text`. */
export function containsPhrase(text: string, phrase: string): boolean {
  const t = words(text);
  const p = words(phrase);
  if (p.length === 0) return false;
  for (let i = 0; i + p.length <= t.length; i++) {
    if (p.every((w, j) => t[i + j] === w)) return true;
  }
  return false;
}

function forms(e: unknown): string[] {
  if (typeof e === "string") return [e];
  if (isPlural(e)) return Object.values(e).filter((v): v is string => typeof v === "string");
  return [];
}

function sameMultiset(a: string[], b: string[]): boolean {
  return a.length === b.length && [...a].sort().join("\u0000") === [...b].sort().join("\u0000");
}

/** Problems in the shape of one catalog: key names, values, braces, plural categories. */
function checkShape(lang: string, catalog: unknown, options: CheckOptions): string[] {
  if (typeof catalog !== "object" || catalog === null || Array.isArray(catalog)) {
    return [`${lang}: the file must hold one JSON object`];
  }
  const out: string[] = [];
  const allowed = new Set<string>(new Intl.PluralRules(lang).resolvedOptions().pluralCategories);
  for (const [key, e] of Object.entries(catalog)) {
    if (!options.anyKeys && !KEY_PATTERN.test(key)) out.push(`${lang}: "${key}" is not a valid key`);
    if (typeof e === "string") {
      if (!bracesAreValid(e)) out.push(`${lang}: "${key}" has a "{" or "}" that is not a placeholder`);
      continue;
    }
    if (!isPlural(e)) {
      out.push(`${lang}: "${key}" must be a text or plural forms`);
      continue;
    }
    if (typeof e.other !== "string") out.push(`${lang}: "${key}" needs an "other" form`);
    for (const [cat, form] of Object.entries(e)) {
      if (!(PLURAL_CATEGORIES as readonly string[]).includes(cat) || !allowed.has(cat)) {
        out.push(`${lang}: "${key}" has plural form "${cat}", which ${lang} does not use (${[...allowed].join(", ")})`);
      }
      if (typeof form !== "string") out.push(`${lang}: "${key}" form "${cat}" must be a text`);
      else if (!bracesAreValid(form)) out.push(`${lang}: "${key}" form "${cat}" has a "{" or "}" that is not a placeholder`);
    }
    if (typeof e.other === "string" && !placeholders(e.other).includes(COUNT)) {
      out.push(`${lang}: "${key}" form "other" must contain {${COUNT}}`);
    }
  }
  return out;
}

/** Placeholder problems of one key: Hindi must use English's placeholders, each as often. */
function checkPlaceholders(key: string, en: unknown, hi: unknown): string[] {
  if (isPlural(en) !== isPlural(hi)) return [`"${key}" is plural forms in one language and a text in the other`];
  if (typeof en === "string" && typeof hi === "string") {
    const a = placeholders(en);
    const b = placeholders(hi);
    return sameMultiset(a, b) ? [] : [`hi: "${key}" has placeholders ${show(b)}, English has ${show(a)}`];
  }
  if (!isPlural(en) || !isPlural(hi) || typeof en.other !== "string" || typeof hi.other !== "string") return [];
  const out: string[] = [];
  const a = placeholders(en.other);
  if (!sameMultiset(a, placeholders(hi.other))) {
    out.push(`hi: "${key}" form "other" has placeholders ${show(placeholders(hi.other))}, English has ${show(a)}`);
  }
  // Other forms may leave a placeholder out ("One file"), never add or repeat one.
  for (const [cat, form] of Object.entries(hi)) {
    if (cat === "other" || typeof form !== "string") continue;
    const p = placeholders(form);
    if (p.some((x) => !a.includes(x)) || new Set(p).size !== p.length) {
      out.push(`hi: "${key}" form "${cat}" has placeholders ${show(p)}, English "other" has ${show(a)}`);
    }
  }
  return out;
}

function show(p: string[]): string {
  return p.length ? p.map((x) => `{${x}}`).join(" ") : "none";
}

/** Every problem in a pair of English and Hindi catalogs. Empty when they pass. */
export function checkCatalogs(en: unknown, hi: unknown, terms: readonly Term[], options: CheckOptions = {}): string[] {
  const out = [...checkShape("en", en, options), ...checkShape("hi", hi, options)];
  if (out.some((p) => p.endsWith("one JSON object"))) return out;
  const e = en as Catalog;
  const h = hi as Catalog;
  for (const key of Object.keys(e)) if (!(key in h)) out.push(`"${key}" is in en and not in hi`);
  for (const key of Object.keys(h)) if (!(key in e)) out.push(`"${key}" is in hi and not in en`);
  for (const key of Object.keys(e)) if (key in h) out.push(...checkPlaceholders(key, e[key], h[key]));
  for (const [key, entry] of Object.entries(h)) {
    for (const text of forms(entry)) {
      if (DEVANAGARI_DIGIT.test(text)) out.push(`hi: "${key}" uses Devanagari digits; use 0-9`);
      for (const term of terms) {
        for (const bad of term.avoid) {
          if (containsPhrase(text, bad)) out.push(`hi: "${key}" uses "${bad}"; the term list says "${term.hi}" (${term.en})`);
        }
      }
    }
  }
  return [...new Set(out)];
}

/** Keys defined in more than one of `catalogs` (an app redefining a shared key). */
export function duplicateKeys(catalogs: readonly Catalog[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const c of catalogs) for (const k of Object.keys(c)) (seen.has(k) ? dup : seen).add(k);
  return [...dup];
}

/** A Chrome `_locales/<lang>/messages.json` file. */
export type ChromeMessages = Record<string, { message: string; description?: string; placeholders?: Record<string, { content: string }> }>;

/**
 * A Chrome messages file as a catalog, for the check: `$name$` becomes `{name}` and
 * `$1`..`$9` become `{arg1}`..`{arg9}` ("$$" is a literal dollar). Also returns the
 * placeholders a message uses that its own file does not define.
 */
export function fromChromeMessages(lang: string, file: unknown): { catalog: Catalog; problems: string[] } {
  if (typeof file !== "object" || file === null || Array.isArray(file)) {
    return { catalog: {}, problems: [`${lang}: messages.json must hold one JSON object`] };
  }
  const catalog: Catalog = {};
  const problems: string[] = [];
  for (const [key, m] of Object.entries(file as ChromeMessages)) {
    if (typeof m?.message !== "string") {
      problems.push(`${lang}: "${key}" has no "message"`);
      continue;
    }
    const defined = new Set(Object.keys(m.placeholders ?? {}).map((k) => k.toLowerCase()));
    const text = m.message
      .replace(/\$\$/g, "")
      .replace(/[{}]/g, "")
      .replace(/\$([A-Za-z][A-Za-z0-9_@]*)\$/g, (_, name: string) => {
        if (!defined.has(name.toLowerCase())) problems.push(`${lang}: "${key}" uses $${name}$, which it does not define`);
        return `{${name.toLowerCase().replace(/[^a-z0-9]/g, "")}}`;
      })
      .replace(/\$([1-9])/g, (_, d: string) => `{arg${d}}`);
    catalog[key] = text;
  }
  return { catalog, problems };
}
