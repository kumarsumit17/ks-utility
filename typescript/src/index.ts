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
  LANGUAGE_CODE,
  REQUIRED_LANGUAGES,
  isLanguage,
  isLanguageCode,
  languageFallbacks,
  nativeLanguageName,
  parseLanguageChoice,
  resolveLanguage,
  type Language,
  type LanguageChoice,
} from "./lang/language.ts";
export {
  checkCatalogs,
  checkLanguages,
  containsPhrase,
  duplicateKeys,
  fromChromeMessages,
  hindiGlossary,
  type CheckOptions,
  type GlossaryTerm,
  type Term,
} from "./lang/check.ts";
export {
  argumentOrder,
  escapeAndroid,
  escapeCompose,
  resourceFolder,
  resourceName,
  resourceNameProblems,
  toAndroidXml,
  toComposeXml,
} from "./lang/android.ts";
export { qaCheck, type KeyContext, type QaResult } from "./lang/qa.ts";
export { buildMemory, editDistance, lookUp, similarity, type MemoryMatch, type MemoryUnit } from "./lang/memory.ts";
export { PSEUDO_LANGUAGE, pseudoCatalog, pseudoLocalize } from "./lang/pseudo.ts";
export { fromXliff, toXliff, type XliffOptions } from "./lang/xliff.ts";
export type { ResourceTarget } from "./lang/android.ts";
export {
  CHECK_INTERVAL_MS,
  DEV_VERSION,
  MAX_RESPONSE_BYTES,
  RECHECK_EVERY_MS,
  STARTUP_DELAY_MS,
  createUpdateStore,
  decide,
  downloadPrefix,
  evaluateRelease,
  isCheckDue,
  isDevVersion,
  isNewerVersion,
  latestReleaseApiUrl,
  openedNote,
  parseRelease,
  parseRepo,
  parseVersion,
  pickAsset,
  releasePageUrl,
  requestHeaders,
  sha256Hex,
  sha256Matches,
  type Asset,
  type CheckResult,
  type Opened,
  type Outcome,
  type Platform,
  type Release,
  type Repo,
  type UpdateDriver,
  type UpdateInfo,
  type UpdateNote,
  type UpdatePhase,
  type UpdateState,
  type UpdateStore,
} from "./appUpdate.ts";
