// KS Utility (TypeScript): generic utilities only. Export each utility from this file.
export { formatBytes, formatSpeed, formatTimeLeft, type FormatOptions } from "./format.ts";
export {
  COUNT,
  KEY_PATTERN,
  PLURAL_CATEGORIES,
  isPlural,
  placeholders,
  type Catalog,
  type Entry,
  type Params,
  type PluralCategory,
  type PluralForms,
} from "./lang/catalog.ts";
export { FALLBACK_LANGUAGE, createTranslator, type Translate, type Translations } from "./lang/translate.ts";
export {
  LANGUAGES,
  isLanguage,
  parseLanguageChoice,
  resolveLanguage,
  type Language,
  type LanguageChoice,
} from "./lang/language.ts";
export { checkCatalogs, containsPhrase, duplicateKeys, fromChromeMessages, type Term } from "./lang/check.ts";
export { argumentOrder, escapeAndroid, resourceName, resourceNameProblems, toAndroidXml } from "./lang/android.ts";
