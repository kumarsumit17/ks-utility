// Converts suite language files into Android string resources (`values/` for English,
// `values-hi/` for Hindi), so the Kotlin apps use Android's own resource look-up and
// plurals instead of a parallel runtime (specs/translation-format.md, "Android"). The
// same files for Compose Multiplatform resources differ only in escaping ("Compose").

import { isPlural, placeholders, type Catalog, type Entry } from "./catalog.ts";

const KEYWORDS = new Set([
  "abstract", "as", "assert", "boolean", "break", "byte", "case", "catch", "char", "class", "const", "continue",
  "default", "do", "double", "else", "enum", "extends", "false", "final", "finally", "float", "for", "fun", "goto",
  "if", "implements", "import", "in", "instanceof", "int", "interface", "is", "long", "native", "new", "null",
  "object", "package", "private", "protected", "public", "return", "short", "static", "super", "switch",
  "synchronized", "this", "throw", "throws", "transient", "true", "try", "typealias", "typeof", "val", "var", "void",
  "volatile", "when", "while",
]);

/** The Android resource name of a key: "downloads.timeLeft" -> "downloads_time_left". */
export function resourceName(key: string): string {
  return key.replace(/\./g, "_").replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

/** Keys whose resource names collide or are not allowed; empty when all are usable. */
export function resourceNameProblems(keys: readonly string[]): string[] {
  const out: string[] = [];
  const by = new Map<string, string>();
  for (const k of keys) {
    const name = resourceName(k);
    const other = by.get(name);
    if (other !== undefined) out.push(`"${other}" and "${k}" both become "${name}"`);
    else by.set(name, k);
    if (KEYWORDS.has(name)) out.push(`"${k}" becomes "${name}", a Java or Kotlin keyword`);
  }
  return out;
}

/** Text escaped for an Android string resource. `formatted`: `%` is doubled. */
export function escapeAndroid(text: string, formatted: boolean): string {
  let s = text
    .replace(/\\/g, "\\\\")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t");
  if (formatted) s = s.replace(/%/g, "%%");
  if (/^[@?]/.test(s)) s = `\\${s}`;
  return s;
}

/**
 * Text escaped for a Compose Multiplatform string resource. Compose reads the XML and then
 * turns only `\\`, `\n`, `\t` and `\uXXXX` back (checked in Compose Multiplatform 1.12),
 * so `'`, `"`, `@`, `?` and `%` stay as they are: an Android escape would show its backslash.
 */
export function escapeCompose(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t");
}

/** The two resource flavours: Android's own resources, and Compose Multiplatform's. */
export type ResourceTarget = "android" | "compose";

/**
 * The argument number of each placeholder of a key, from its English text: in order of
 * first appearance, so `{a} of {b}` is `%1$s` and `%2$s` in every language.
 */
export function argumentOrder(english: Entry): Map<string, number> {
  const order = new Map<string, number>();
  const texts = isPlural(english) ? [english.other, ...Object.values(english)] : [english];
  for (const t of texts) for (const p of placeholders(t ?? "")) if (!order.has(p)) order.set(p, order.size + 1);
  return order;
}

function convert(text: string, order: Map<string, number>, target: ResourceTarget): string {
  const formatted = order.size > 0;
  const escape = target === "compose" ? escapeCompose : (t: string) => escapeAndroid(t, formatted);
  // Placeholders are swapped for markers first, so escaping cannot touch them.
  const marked = text.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (whole, name: string) => {
    const n = order.get(name);
    return n === undefined ? whole : `\u0000${n}\u0000`;
  });
  return escape(marked).replace(/\u0000(\d+)\u0000/g, (_, n: string) => `%${n}$s`);
}

/**
 * One `strings` resource file for `catalog`. `english` gives the argument numbers and
 * the key order. Every argument is a string (`%1$s`): the app formats numbers for the
 * language before passing them. Plurals become `<plurals>`. `target` picks the escaping.
 */
export function toAndroidXml(
  catalog: Catalog,
  english: Catalog,
  source = "ks-utility",
  target: ResourceTarget = "android",
): string {
  const lines = [
    '<?xml version="1.0" encoding="utf-8"?>',
    `<!-- Generated from ${source} language files by ks-utility. Do not edit; change the language files. -->`,
    "<resources>",
  ];
  for (const key of Object.keys(english)) {
    const entry = catalog[key];
    if (entry === undefined) continue;
    const order = argumentOrder(english[key]);
    const name = resourceName(key);
    if (isPlural(entry)) {
      lines.push(`    <plurals name="${name}">`);
      for (const [cat, form] of Object.entries(entry)) {
        if (typeof form === "string") lines.push(`        <item quantity="${cat}">${convert(form, order, target)}</item>`);
      }
      lines.push("    </plurals>");
    } else {
      lines.push(`    <string name="${name}">${convert(entry, order, target)}</string>`);
    }
  }
  lines.push("</resources>", "");
  return lines.join("\n");
}

/** The same file for Compose Multiplatform resources ([escapeCompose]). */
export function toComposeXml(catalog: Catalog, english: Catalog, source = "ks-utility"): string {
  return toAndroidXml(catalog, english, source, "compose");
}
