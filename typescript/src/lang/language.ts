// The suite's language rule (specs/languages.md): follow the system, allow a choice of
// English or Hindi, remember it. Apps store the choice; this decides what it means.

export const LANGUAGES = ["en", "hi"] as const;
export type Language = (typeof LANGUAGES)[number];

/** What the user picked: a language, or "system" (the default). */
export type LanguageChoice = Language | "system";

export function isLanguage(v: unknown): v is Language {
  return typeof v === "string" && (LANGUAGES as readonly string[]).includes(v);
}

/** A stored choice read back; anything unknown (or nothing) is "system". */
export function parseLanguageChoice(v: unknown): LanguageChoice {
  return isLanguage(v) ? v : "system";
}

/**
 * The language to show. A remembered English or Hindi choice wins; otherwise the first
 * system language whose primary part is supported ("hi-IN" -> "hi"); otherwise English.
 */
export function resolveLanguage(choice: unknown, system: readonly string[]): Language {
  if (isLanguage(choice)) return choice;
  for (const tag of system) {
    const primary = tag.split(/[-_]/)[0]?.toLowerCase();
    if (isLanguage(primary)) return primary;
  }
  return "en";
}
