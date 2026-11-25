// The translation helper: look-up by key, placeholders, plurals through the built-in
// Intl.PluralRules, and English when a key is missing (specs/translation-format.md).

import { COUNT, fill, isPlural, type Catalog, type Params } from "./catalog.ts";
import { languageFallbacks } from "./language.ts";

/** Catalogs per language code, for example `{ en, hi, fr }`. */
export type Translations = Partial<Record<string, Catalog>>;

export type Translate = (key: string, params?: Params) => string;

/** The language every app falls back to. */
export const FALLBACK_LANGUAGE = "en";

/**
 * A look-up function for `language`. `layers` are searched from last to first, so an
 * app's own texts (last) come before the shared catalogue (first). A key missing in
 * `language` is taken from its less specific forms (`pt-BR`, then `pt`) and then from
 * English; a key missing everywhere is returned as it is, so a mistake shows up instead of
 * an empty label.
 */
export function createTranslator(language: string, ...layers: Translations[]): Translate {
  const order = languageFallbacks(language);
  const numbers = new Map<string, Intl.NumberFormat>();
  const plurals = new Map<string, Intl.PluralRules>();
  const numberFormat = (lang: string) => {
    let f = numbers.get(lang);
    if (!f) {
      f = new Intl.NumberFormat(lang, { numberingSystem: "latn" });
      numbers.set(lang, f);
    }
    return f;
  };
  const pluralRules = (lang: string) => {
    let r = plurals.get(lang);
    if (!r) {
      r = new Intl.PluralRules(lang);
      plurals.set(lang, r);
    }
    return r;
  };

  return (key, params) => {
    for (const lang of order) {
      for (let i = layers.length - 1; i >= 0; i--) {
        const entry = layers[i][lang]?.[key];
        if (entry === undefined) continue;
        const format = (n: number) => numberFormat(lang).format(n);
        if (!isPlural(entry)) return fill(entry, params, format);
        const count = params?.[COUNT];
        const n = typeof count === "number" ? count : Number(count);
        const form = Number.isFinite(n) ? (entry[pluralRules(lang).select(n)] ?? entry.other) : entry.other;
        return fill(form, params, format);
      }
    }
    return key;
  };
}
