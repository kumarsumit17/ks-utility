// Converts suite language files to and from the file Crowdin translates
// (specs/translation-format.md, "Crowdin"). Crowdin's "i18next JSON" parser knows plurals
// only as sibling keys with a CLDR suffix (`downloads.count_one`, `downloads.count_other`),
// and then asks each translator for the forms their language uses (Russian: one, few, many,
// other). The suite format keeps plural forms as one object, so these two functions map
// between the two. Placeholders (`{name}`) are left as they are.

import { PLURAL_CATEGORIES, isPlural, type Catalog } from "./catalog.ts";

/** The file Crowdin reads and writes: a flat object of key → text. */
export type CrowdinFile = Record<string, string>;

const SUFFIX = new RegExp(`_(${PLURAL_CATEGORIES.join("|")})$`);

/**
 * The Crowdin source file of an English catalog: texts as they are, plural forms as
 * `key_<category>`. Fails (problems) for a text key that already ends in a plural suffix,
 * which Crowdin would read as a plural form.
 */
export function toCrowdinSource(english: Catalog): { file: CrowdinFile; problems: string[] } {
  const file: CrowdinFile = {};
  const problems: string[] = [];
  for (const [key, entry] of Object.entries(english)) {
    if (!isPlural(entry)) {
      if (SUFFIX.test(key)) problems.push(`"${key}" ends in a plural suffix, which Crowdin reads as a plural form; rename it`);
      file[key] = entry;
      continue;
    }
    for (const cat of PLURAL_CATEGORIES) {
      const form = entry[cat];
      if (typeof form === "string") file[`${key}_${cat}`] = form;
    }
  }
  return { file, problems };
}

/**
 * A translated Crowdin file as a catalog of the suite format, in the key order of `english`.
 * Plural forms are gathered back into one object for keys that are plural in English. Empty
 * texts (untranslated) are left out, so English is shown for them; keys English does not
 * have are reported and left out.
 */
export function fromCrowdin(file: unknown, english: Catalog): { catalog: Catalog; problems: string[] } {
  if (typeof file !== "object" || file === null || Array.isArray(file)) {
    return { catalog: {}, problems: ["the Crowdin file must hold one JSON object"] };
  }
  const f = file as Record<string, unknown>;
  const catalog: Catalog = {};
  const problems: string[] = [];
  const used = new Set<string>();
  for (const [key, entry] of Object.entries(english)) {
    if (!isPlural(entry)) {
      const text = f[key];
      used.add(key);
      if (typeof text === "string" && text !== "") catalog[key] = text;
      continue;
    }
    const forms: Record<string, string> = {};
    for (const cat of PLURAL_CATEGORIES) {
      const name = `${key}_${cat}`;
      used.add(name);
      const text = f[name];
      if (typeof text === "string" && text !== "") forms[cat] = text;
    }
    if (Object.keys(forms).length) catalog[key] = forms as Catalog[string];
  }
  for (const key of Object.keys(f)) {
    if (!used.has(key)) problems.push(`"${key}" is in the Crowdin file and not in English`);
    else if (typeof f[key] !== "string") problems.push(`"${key}" must be a text`);
  }
  return { catalog, problems };
}
