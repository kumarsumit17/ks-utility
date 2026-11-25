---
type: Reference
title: Utilities
description: The utilities KS Utility provides in each language, and what each one is for.
tags: [reference, rust, typescript, kotlin]
---

# Utilities

## Rust (`rust/`, crate `ks-utility`)
Standard library only, `#![forbid(unsafe_code)]`.

| Module | What it does |
|---|---|
| `http_date` | `parse_http_date` (the three HTTP-date forms of RFC 9110; years 1970..=9999 only, otherwise `None`, so a server's date never panics or overflows) and `parse_retry_after` (seconds or a date; a past date is zero; `None` on overflow). |
| `backoff` | `full_jitter`: exponential backoff with full jitter. `jitter_random_below`: its random source, **for jitter only**; never for tokens, IDs, keys or anything security-related. |
| `content_range` | `parse_content_range`: `bytes a-b/c`, `bytes a-b/*`, `bytes */c`. |
| `content_disposition` | `content_disposition_filename` (`filename*` over `filename`, RFC 6266/8187; quoted values may hold `;`, `=` and backslash escapes) and `percent_decode`. The name is returned as sent; sanitise it before use. |
| `ranges` | `Range` (half-open, `len` never underflows), `RangeSet` (sorted, merging insert, gaps, bytes covered) and `gaps` (every gap lies inside `[0, size)`, even when covered ranges reach past `size`). |
| `atomic` | `write_atomic`: temp file, sync, rename, sync folder. Covers only the file it writes; not safe for two writers of the same path at once. |
| `media_type` | `extension_for` (the usual extension of a media type; parameters and case ignored; common, unambiguous types only) and `name_with_type` (adds that extension to a name that has none). |
| `message` | `Message`: a message code (a language-file key) with named parameters, so Rust never builds display sentences ([format](translation-format.md#messages-from-rust)); `is_valid_code`, `is_valid_param`. `Display` is for logs only. |
| `token_bucket` | `TokenBucket`: the arithmetic of a rate limit (rate, burst, debt paid by waiting). `take(n, now)` returns how long to wait; the caller sleeps however it likes. |
| `app_update` | App updates ([spec](app-update.md)), no network: `parse_version`, `is_newer`, `is_dev_version`, `check_due` (daily schedule), `Repo` (request URL and headers, release page), `parse_release` (keeps only this repository's files with a GitHub `sha256:` digest), `Platform`, `pick_asset`, `evaluate` / `decide` → `Outcome`. |
| `sha256` | `Sha256` (incremental), `sha256_hex`, `sha256_reader`, `sha256_file`, `sha256_matches`: to check a download against its published checksum. |
| `file_name` | `sanitize_file_name` (also strips bidirectional and other invisible format characters; reserved Windows names matched before the first dot), `split_extension`, `numbered_name` ("name (n).ext"), `reserve_free_name` (creates the first free name with `create_new`; never overwrites; `name` must be a single file name, otherwise `InvalidInput` and nothing is created, so sanitise untrusted names first). |

## TypeScript (`typescript/src/`)

| Export | What it does |
|---|---|
| `formatBytes`, `formatSpeed`, `formatTimeLeft` | Human-readable sizes (binary units), speeds and durations. Without options the output is fixed English-style ("1.5 KB"); with `{ locale }` numbers go through the built-in `Intl` (Latin digits), and `unknown` sets the text for an unknown size. |
| `createTranslator` | Look-up by key with placeholders, plurals (`Intl.PluralRules`) and fallback through the region to English ([format](translation-format.md#look-up-typescript)). |
| `resolveLanguage`, `parseLanguageChoice`, `LANGUAGES`, `REQUIRED_LANGUAGES`, `languageFallbacks`, `nativeLanguageName`, `isLanguageCode` | The suite's language rule for any list of languages, and each language's own name for the menu ([Languages](languages.md)). |
| `checkCatalogs`, `checkLanguages`, `fromChromeMessages`, `duplicateKeys`, `containsPhrase` | The language-file check, as functions; the command is `typescript/tools/lang.mjs` ([usage](usage.md#language-files)). |
| `parseVersion`, `isNewerVersion`, `isDevVersion`, `isCheckDue`, `parseRepo`, `latestReleaseApiUrl`, `releasePageUrl`, `requestHeaders`, `parseRelease`, `pickAsset`, `evaluateRelease`, `decide`, `sha256Hex`, `sha256Matches` | App updates, no network ([spec](app-update.md)). |
| `createUpdateStore`, `openedNote` | The state behind an "App updates" section and banner; notes are message keys with parameters. |
| `toAndroidXml`, `toComposeXml`, `resourceName`, `resourceNameProblems`, `resourceFolder`, `escapeAndroid`, `escapeCompose`, `argumentOrder` | Conversion of language files into Android string resources (one `values-…` folder per language), and the same files escaped for Compose Multiplatform resources. |
| `qaCheck` | Quality checks of one translation: the check's errors, and warnings (spaces, end punctuation, numbers, missing plural forms, length limit, glossary) ([translation tools](translating.md#quality-checks)). |
| `buildMemory`, `lookUp`, `similarity`, `editDistance` | Translation memory: the same English translated elsewhere (100 %), then similar texts ([translation tools](translating.md#translation-memory)). |
| `toXliff`, `fromXliff` | XLIFF 1.2 for translators' own tools, one unit per plural form of the target language ([format](translation-format.md#xliff)). |
| `pseudoLocalize`, `pseudoCatalog`, `PSEUDO_LANGUAGE` | Pseudo-localisation (`en-XA`): accented, longer, bracketed text for layout tests. |
| `hindiGlossary`, `GlossaryTerm` | Glossaries per language; the Hindi term list as one. |

## Kotlin (`kotlin/`, package `com.ks.utility`)
Plain Kotlin/JVM, no Android SDK.

| Class | What it does |
|---|---|
| `appupdate.AppUpdate`, `GitHubRepo`, `UpdatePlatform`, `Release`, `ReleaseAsset`, `UpdateOutcome` | App updates, no network ([spec](app-update.md)): versions, daily schedule, request URL and headers, reading the release, choosing the file, deciding. |
| `appupdate.Sha256` | SHA-256 of bytes, a stream or a file (`MessageDigest`), and `matches`. |
| `lang.Translator`, `lang.Catalog`, `lang.Entry` | Look-up in the suite's language files for code without Android or Compose resources: layers, English fallback, `{name}` placeholders, CLDR plurals and number formats of 28 languages (`LanguageRules`), Latin digits with Indian grouping for Hindi ([format](translation-format.md#look-up-kotlin)). |

## Language data (`lang/`)

| File | What it holds |
|---|---|
| `lang/common/en.json`, `lang/common/hi.json` | The shared catalogue of common interface text (`common.*` keys), including the App updates section (`common.appUpdate.*`). |
| `lang/hindi-terms.json` | The Hindi term list with disallowed alternatives; the same rows as the table in the [Hindi style guide](hindi-style.md) (a test fails if they differ). |
