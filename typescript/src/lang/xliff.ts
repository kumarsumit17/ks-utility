// XLIFF 1.2 (specs/translating.md, "XLIFF"): the standard file for translators who work in
// their own tool (Poedit, OmegaT, memoQ, Trados, Xcode). One unit per text, and one per
// plural form the target language uses ("downloads.count#few"); notes carry the context.

import { PLURAL_CATEGORIES, isPlural, type Catalog, type Entry, type PluralCategory } from "./catalog.ts";

export interface XliffOptions {
  /** Notes for translators by key (`_context.json`). */
  notes?: Record<string, string | undefined>;
  /** Only these keys (default: every English key). */
  keys?: readonly string[];
  /** The file name shown in the translator's tool. */
  original?: string;
}

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function unescape(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#([0-9]+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** The plural categories of `lang`, in CLDR order. */
function categories(lang: string): PluralCategory[] {
  const used = new Set(new Intl.PluralRules(lang).resolvedOptions().pluralCategories);
  return PLURAL_CATEGORIES.filter((c) => used.has(c));
}

/**
 * An XLIFF 1.2 file translating `english` into `lang`, with the texts `translation` already
 * has as targets (state "translated"; others "needs-translation").
 */
export function toXliff(lang: string, english: Catalog, translation: Catalog, options: XliffOptions = {}): string {
  const keys = options.keys ?? Object.keys(english);
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">',
    `  <file original="${escape(options.original ?? "en.json")}" source-language="en" target-language="${escape(lang)}" datatype="plaintext">`,
    "    <body>",
  ];
  const unit = (id: string, source: string, target: string | undefined, note: string | undefined) => {
    lines.push(`      <trans-unit id="${escape(id)}" xml:space="preserve">`);
    lines.push(`        <source>${escape(source)}</source>`);
    lines.push(target === undefined ? '        <target state="needs-translation"></target>' : `        <target state="translated">${escape(target)}</target>`);
    if (note) lines.push(`        <note>${escape(note)}</note>`);
    lines.push("      </trans-unit>");
  };
  for (const key of keys) {
    const e = english[key];
    if (e === undefined) continue;
    const t = translation[key];
    const note = options.notes?.[key];
    if (!isPlural(e)) {
      unit(key, e, typeof t === "string" ? t : undefined, note);
      continue;
    }
    for (const cat of categories(lang)) {
      const form = isPlural(t) ? t[cat] : undefined;
      const hint = `Plural form "${cat}" of ${lang}${note ? `. ${note}` : ""}`;
      unit(`${key}#${cat}`, e[cat] ?? e.other, form, hint);
    }
  }
  lines.push("    </body>", "  </file>", "</xliff>", "");
  return lines.join("\n");
}

/**
 * The translations in an XLIFF file, as a catalog of the keys it has a non-empty target for
 * (plural forms gathered by key). Units whose key English does not have, and targets with
 * markup inside, are reported.
 */
export function fromXliff(xml: string, english: Catalog): { catalog: Catalog; problems: string[] } {
  const catalog: Catalog = {};
  const problems: string[] = [];
  const unitPattern = /<trans-unit\b([^>]*)>([\s\S]*?)<\/trans-unit>/g;
  let found = 0;
  for (const m of xml.matchAll(unitPattern)) {
    found++;
    const id = /\bid="([^"]*)"/.exec(m[1])?.[1];
    if (id === undefined) {
      problems.push("a unit has no id");
      continue;
    }
    const key = unescape(id);
    const raw = /<target\b[^>]*>([\s\S]*?)<\/target>/.exec(m[2])?.[1];
    if (raw === undefined || raw.trim() === "") continue;
    if (/<[A-Za-z/]/.test(raw)) {
      problems.push(`"${key}": the target has markup; write placeholders as {name}`);
      continue;
    }
    const text = unescape(raw);
    const hash = key.lastIndexOf("#");
    const base = hash > 0 ? key.slice(0, hash) : key;
    const cat = hash > 0 ? key.slice(hash + 1) : "";
    const e = english[base];
    if (e === undefined || (cat !== "") !== isPlural(e) || (cat && !(PLURAL_CATEGORIES as readonly string[]).includes(cat))) {
      problems.push(`"${key}" is in the XLIFF file and not in English`);
      continue;
    }
    if (cat) {
      const forms = (isPlural(catalog[base]) ? catalog[base] : {}) as Record<string, string>;
      forms[cat] = text;
      catalog[base] = forms as Entry;
    } else catalog[base] = text;
  }
  if (found === 0) problems.push("no translation units found (an XLIFF 1.2 file is expected)");
  const ordered: Catalog = {};
  for (const k of Object.keys(english)) if (catalog[k] !== undefined) ordered[k] = catalog[k];
  return { catalog: ordered, problems };
}
