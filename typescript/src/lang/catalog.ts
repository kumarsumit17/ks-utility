// The KS-Suite translation file format (specs/translation-format.md): one JSON object per
// language, key -> text, or key -> plural forms.

/** The plural categories of Unicode CLDR, as `Intl.PluralRules` names them. */
export const PLURAL_CATEGORIES = ["zero", "one", "two", "few", "many", "other"] as const;
export type PluralCategory = (typeof PLURAL_CATEGORIES)[number];

/** Plural forms of one text, chosen by its `{count}` placeholder. `other` is required. */
export type PluralForms = Partial<Record<PluralCategory, string>> & { other: string };

export type Entry = string | PluralForms;

/** The texts of one language: key -> text or plural forms. */
export type Catalog = Record<string, Entry>;

/** Values for placeholders. Numbers are formatted for the language (Latin digits). */
export type Params = Record<string, string | number>;

/** Keys: dot-separated parts, each starting with a lower-case letter ("common.ok"). */
export const KEY_PATTERN = /^[a-z][A-Za-z0-9_]*(\.[a-z][A-Za-z0-9_]*)*$/;

/** The parameter that chooses the plural form. */
export const COUNT = "count";

const PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9]*)\}/g;

export function isPlural(e: unknown): e is PluralForms {
  return typeof e === "object" && e !== null && !Array.isArray(e);
}

/** The placeholder names in `text`, in order, repeats included. */
export function placeholders(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER)].map((m) => m[1]);
}

/** True when every `{` and `}` in `text` belongs to a well-formed placeholder. */
export function bracesAreValid(text: string): boolean {
  return !/[{}]/.test(text.replace(PLACEHOLDER, ""));
}

/** Replaces each `{name}` that has a value; others are left as they are. */
export function fill(text: string, params: Params | undefined, number: (n: number) => string): string {
  if (!params) return text;
  return text.replace(PLACEHOLDER, (whole, name: string) => {
    const v = params[name];
    if (v === undefined) return whole;
    return typeof v === "number" ? number(v) : v;
  });
}
