// The suite's language rule (specs/languages.md): follow the system, allow a choice, remember
// it. Apps store the choice; this decides what it means. English and Hindi are required in
// every app; an app may ship more languages (one language file each), listed in `supported`.

/** The languages every app has, complete: English (the source) and Hindi. */
export const LANGUAGES = ["en", "hi"] as const;
export type Language = (typeof LANGUAGES)[number];

/** The required languages under the name that says what they are. */
export const REQUIRED_LANGUAGES: readonly string[] = LANGUAGES;

/** What the user picked: a language code, or "system" (the default). */
export type LanguageChoice = Language | "system";

/**
 * A language code as language files are named: a language (`fr`), optionally a script
 * (`zh-Hans`) and a region (`pt-BR`, `es-419`). The same tags Android and Crowdin use.
 */
export const LANGUAGE_CODE = /^[a-z]{2,3}(-[A-Z][a-z]{3})?(-([A-Z]{2}|[0-9]{3}))?$/;

export function isLanguageCode(v: unknown): v is string {
  return typeof v === "string" && LANGUAGE_CODE.test(v);
}

/** True for English and Hindi, or, when `supported` is given, for a code in it. */
export function isLanguage(v: unknown, supported: readonly string[] = LANGUAGES): v is Language {
  return typeof v === "string" && supported.includes(v);
}

/** A stored choice read back; anything unknown (or nothing) is "system". */
export function parseLanguageChoice(v: unknown): LanguageChoice;
export function parseLanguageChoice(v: unknown, supported: readonly string[]): string;
export function parseLanguageChoice(v: unknown, supported: readonly string[] = LANGUAGES): string {
  return isLanguage(v, supported) ? v : "system";
}

/** A system tag in the form of language codes: `pt_br` → `pt-BR`, `zh-hans-cn` → `zh-Hans-CN`. */
function normalise(tag: string): string {
  return tag
    .replace(/_/g, "-")
    .split("-")
    .map((part, i) => {
      if (i === 0) return part.toLowerCase();
      if (part.length === 4 && /^[A-Za-z]+$/.test(part)) return part[0].toUpperCase() + part.slice(1).toLowerCase();
      return part.toUpperCase();
    })
    .join("-");
}

/**
 * The language to show. A remembered choice among `supported` wins; otherwise the first system
 * language that is supported, exactly (`pt-BR`) or by its language part (`hi-IN` → `hi`, and
 * `pt-PT` → `pt` when only `pt` is supported); otherwise English. `supported` defaults to
 * English and Hindi.
 */
export function resolveLanguage(choice: unknown, system: readonly string[]): Language;
export function resolveLanguage(choice: unknown, system: readonly string[], supported: readonly string[]): string;
export function resolveLanguage(choice: unknown, system: readonly string[], supported: readonly string[] = LANGUAGES): string {
  if (isLanguage(choice, supported)) return choice;
  for (const raw of system) {
    const tag = normalise(raw);
    for (const candidate of languageFallbacks(tag)) {
      if (candidate === "en" && tag.split("-")[0] !== "en") break;
      if (supported.includes(candidate)) return candidate;
    }
  }
  return "en";
}

/**
 * The languages a text is looked up in, most specific first, ending in English:
 * `pt-BR` → `pt-BR`, `pt`, `en`; `zh-Hans-CN` → `zh-Hans-CN`, `zh-Hans`, `zh`, `en`.
 */
export function languageFallbacks(code: string): string[] {
  const parts = code.split("-");
  const out: string[] = [];
  for (let n = parts.length; n >= 1; n--) out.push(parts.slice(0, n).join("-"));
  if (!out.includes("en")) out.push("en");
  return out;
}

/**
 * The name of a language in that language, for a language menu ("हिन्दी", "Français",
 * "Português (Brasil)"), from the built-in `Intl.DisplayNames`; the code when it has none.
 */
export function nativeLanguageName(code: string): string {
  try {
    const name = new Intl.DisplayNames([code], { type: "language" }).of(code);
    if (!name || name === code) return code;
    return name.charAt(0).toLocaleUpperCase(code) + name.slice(1);
  } catch {
    return code;
  }
}
