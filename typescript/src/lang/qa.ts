// Quality checks of one translation (specs/translating.md, "Quality checks"): the errors the
// language-file check fails on, and warnings a translator should look at but may keep.

import { PLURAL_CATEGORIES, isPlural, type Entry } from "./catalog.ts";
import { checkLanguages, containsPhrase, type GlossaryTerm } from "./check.ts";

/** What a translator may set for a key in `_context.json`. */
export interface KeyContext {
  /** Where the text is shown and what it means ("Button on the player's top bar"). */
  note?: string;
  /** The most characters the text may have on screen (a warning when longer). */
  maxLength?: number;
}

export interface QaResult {
  /** Problems the language-file check fails on; the file cannot be saved with them. */
  errors: string[];
  /** Things to look at, which may be right for the language. */
  warnings: string[];
}

const END = /[.!?:…।]$/u;
const NUMBERS = /\d+(?:[.,]\d+)*/g;

function texts(e: Entry | undefined): string[] {
  if (e === undefined) return [];
  if (typeof e === "string") return [e];
  return PLURAL_CATEGORIES.map((c) => e[c]).filter((v): v is string => typeof v === "string");
}

function ending(s: string): string {
  const m = END.exec(s.trimEnd());
  if (!m) return "";
  return m[0] === "।" ? "." : m[0];
}

function numbers(s: string): string[] {
  return (s.replace(/\{[A-Za-z][A-Za-z0-9]*\}/g, "").match(NUMBERS) ?? []).map((n) => n.replace(/[.,]/g, "")).sort();
}

/**
 * The errors and warnings of `translation` (in `lang`) of the English `english`. The errors
 * are those of the language-file check for this one key; the warnings are the usual translation-platform checks:
 * leading or trailing space, double space, end punctuation, numbers, length, glossary.
 */
export function qaCheck(
  lang: string,
  key: string,
  english: Entry,
  translation: Entry | undefined,
  options: { glossary?: readonly GlossaryTerm[]; context?: KeyContext } = {},
): QaResult {
  const warnings: string[] = [];
  if (translation === undefined || texts(translation).every((t) => t.trim() === "")) {
    return { errors: [], warnings: ["not translated yet"] };
  }
  const glossary = options.glossary ?? [];
  const errors = checkLanguages({ en: { [key]: english }, [lang]: { [key]: translation } }, [], {
    required: ["en"],
    glossaries: { [lang]: glossary },
  }).map((p) => p.replace(new RegExp(`^${lang}: "${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}" `), "").replace(`"${key}" `, ""));

  if (isPlural(english) && isPlural(translation)) {
    const used = new Intl.PluralRules(lang).resolvedOptions().pluralCategories as string[];
    const missing = PLURAL_CATEGORIES.filter((c) => used.includes(c) && typeof translation[c] !== "string");
    if (missing.length) warnings.push(`plural form${missing.length > 1 ? "s" : ""} ${missing.map((c) => `"${c}"`).join(", ")} missing; ${lang} uses ${used.join(", ")}; its "other" form is shown instead`);
  }
  const src = isPlural(english) ? english.other : english;
  const forms = isPlural(translation) ? Object.entries(translation) : [["", translation] as const];
  for (const [cat, t] of forms) {
    if (typeof t !== "string") continue;
    const where = cat ? ` (form "${cat}")` : "";
    if (t.trim() === "") warnings.push(`empty${where}`);
    if (/^\s/.test(src) !== /^\s/.test(t)) warnings.push(`starts ${/^\s/.test(t) ? "with" : "without"} a space, English does not${where}`);
    if (/\s$/.test(src) !== /\s$/.test(t)) warnings.push(`ends ${/\s$/.test(t) ? "with" : "without"} a space, English does not${where}`);
    if (/ {2}/.test(t) && !/ {2}/.test(src)) warnings.push(`has a double space${where}`);
    if (ending(src) !== ending(t)) {
      warnings.push(ending(src) ? `does not end with "${ending(src)}" as English does${where}` : `ends with "${ending(t)}", English does not${where}`);
    }
    if (!isPlural(english) && numbers(src).join() !== numbers(t).join()) warnings.push(`has other numbers than English${where}`);
    const max = options.context?.maxLength;
    if (max !== undefined && t.replace(/\{[A-Za-z][A-Za-z0-9]*\}/g, "").length > max) {
      warnings.push(`is longer than ${max} characters${where}`);
    }
  }
  const all = texts(english).join(" ");
  for (const term of glossary) {
    if (!containsPhrase(all.toLowerCase(), term.en.toLowerCase())) continue;
    if (!texts(translation).some((t) => containsPhrase(t, term.text))) warnings.push(`the glossary says "${term.en}" is "${term.text}"`);
  }
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
