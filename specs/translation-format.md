---
type: Specification
title: Translation file format
description: The one format for interface text in every KS-Suite app (keys, placeholders, plural forms, any number of languages), how it is looked up in TypeScript and Kotlin, checked, converted for Android, Compose Multiplatform and Crowdin, and how Rust sends message codes.
tags: [language, translation, hindi, format, android, compose, kotlin, check, crowdin]
---

# Translation file format

Every KS-Suite app keeps its interface text in language files of this format, one per language, side by side in one folder: English (`en.json`, the source) and Hindi (`hi.json`) always, and any other language the app ships (`fr.json`, `pt-BR.json`), usually translated in [Crowdin](crowdin.md) ([Languages](languages.md)). No translation library is used anywhere; the helpers are in this repository.

## Files
- One JSON object per language. Each member is a **key** and its **text**, or a key and its **plural forms**.
- A file is named by its **language code**: a language (`fr`), optionally a script (`zh-Hans`) and a region (`pt-BR`, `es-419`). Every `.json` file in a language folder is a language file.
- English and Hindi have exactly the same keys. Another language may leave keys out (English is shown for them, after a less specific form: `pt-BR`, then `pt`) but never adds one.
- UTF-8, NFC. Hindi text in Devanagari, following the [Hindi style guide](hindi-style.md). Every language writes numbers with the digits 0-9.
- Shared text, used by every app, is in this repository: `lang/common/en.json` and `lang/common/hi.json` (OK, Cancel, Remove, Delete, Settings, Pause, Resume, common errors and confirmations). Its keys start with `common.`. App-specific text stays in each app's repository, and an app never redefines a shared key (the check fails).

```json
{
  "downloads.added": "Added {name}",
  "downloads.count": { "one": "{count} download", "other": "{count} downloads" }
}
```

## Keys
- Dot-separated parts, each starting with a lower-case ASCII letter, then letters, digits or `_`: `common.ok`, `downloads.timeLeft`, `error.disk_full`. The first part names the area (`common`, `downloads`, `settings`, `error`, …).
- A key names a meaning, not its English words: when the English wording changes, the key stays.

## Placeholders
- `{name}`: an ASCII letter, then letters or digits. Every other `{` or `}` is an error (there is no escape; reword instead).
- Every translation uses exactly the placeholders of the English text, each as often (a missing, repeated or changed placeholder fails the check). Their order may differ.
- A value given as a number is formatted for the language by the built-in `Intl.NumberFormat`, always with Latin digits (`1,200`; Hindi uses Indian grouping, `1,00,000`). Values that are not quantities (years, IDs, versions) are passed as strings.

## Plural forms
- An object of Unicode CLDR categories (`zero`, `one`, `two`, `few`, `many`, `other`). `other` is required, and only categories the language uses are allowed (as `Intl.PluralRules` lists them): English and Hindi use `one` and `other`, Russian `one`, `few`, `many` and `other`, Arabic all six, Japanese only `other`. Note that Hindi's `one` also covers 0.
- The form is chosen by the `{count}` parameter with the built-in `Intl.PluralRules`. `other` must contain `{count}`; other forms may leave placeholders out ("One file") but never add or repeat one.
- A key is plural forms in both languages or a text in both.

## Look-up (TypeScript)
`createTranslator(language, ...layers)` from `ks-utility` returns `t(key, params?)`:
- `layers` are `{ en, hi }` pairs of catalogs, searched last to first, so an app passes the shared catalogue first and its own files after it.
- A key missing in the language is taken from its less specific forms (`pt-BR`, then `pt`) and then from English; a key missing everywhere is returned as it is, so it shows up in testing.
- A placeholder without a value is left as it is.

## Look-up (Kotlin)
`com.ks.utility.lang.Translator(language, layers)` is the same look-up for Kotlin code that does not use Android or Compose resources (a server, a command-line tool). `Catalog.parse(json)` reads one language file; a layer is a map of language code to catalog (`mapOf("en" to …, "hi" to …)`).
- Layers searched last to first, fallback through the less specific forms to English, a missing key returned as it is, a placeholder without a value left as it is: as in TypeScript.
- `t(key, params)` or `tr(key, "name" to value)`. A number is formatted like `Intl.NumberFormat(language, { numberingSystem: "latn" })`: Latin digits, at most three decimals, the language's separators and grouping (Indian grouping for Hindi and most Indian languages, `12,34,567`). Other values are passed through `toString()`.
- Plural forms are chosen like `Intl.PluralRules` (numbers rounded to three decimals first). Plain Kotlin/JVM has no CLDR plural API, so `LanguageRules` writes out the rules and formats of 28 languages (`en hi bn mr gu pa ta te kn ml ur es fr de pt pt-PT it nl ru uk pl ar ja zh ko tr id vi`), checked against values taken from `Intl` (`kotlin/src/test/resources/intl-vectors.json`, regenerated by `UPDATE_VECTORS=1 npm test`); other languages use the English rule and format. Without a numeric `count`, `other` is used.
- Interface text in Android and Compose apps comes from their resources (below), not from this class.

## Messages from Rust
Rust never builds display sentences. It sends a **message code** (a key of the app's language files) and named parameters, `ks_utility::message::Message` (`Message::new("error.http").with("status", 404)`); the interface looks the code up and fills in the parameters. `Display` on a message is for logs only.

## Android
The Kotlin apps use Android's own string resources, not a parallel runtime. `lang.mjs android` ([usage](usage.md#language-files)) converts the shared catalogue and an app's files into `values/lang_strings.xml` (English), `values-hi/lang_strings.xml` and one folder per other language (`values-fr`, `values-pt-rBR`; a script or a numeric region in the BCP 47 form, `values-b+zh+Hans`, `values-b+es+419`). A text a language leaves out is not written, so Android shows the English one from `values/`:
- Resource names: dots become `_` and capitals become `_` + lower case (`downloads.timeLeft` → `downloads_time_left`). Names that collide or are Java or Kotlin keywords fail.
- Placeholders become positional string arguments numbered by first appearance in the English text (`{done} of {total}` → `%1$s of %2$s`; the Hindi text keeps the same numbers), so the app formats numbers before passing them. Plurals become `<plurals>` (`getQuantityString(id, count, formattedCount, …)`).
- Text is escaped for Android (`'`, `"`, `\`, `@`/`?` at the start, `&`, `<`, `>`, newlines). In a text with arguments a literal `%` becomes `%%`.
- The generated files carry a "do not edit" comment and are rebuilt from the language files.

## Compose Multiplatform
Compose Multiplatform resources read the same `strings.xml` layout, but after reading the XML they undo only `\\`, `\n`, `\t` and `\uXXXX` (checked in Compose Multiplatform 1.12.2), so Android's `\'`, `\"`, `\@`, `\?` and `%%` would show their backslash or both percent signs ("You\'re offline"). Compose apps therefore use `lang.mjs compose` ([usage](usage.md#language-files)), which writes the same files and names with only that escaping: `\`, newlines, tabs and the XML characters `&`, `<`, `>`. Placeholders become `%1$s` as for Android.

Compose Multiplatform has no folder for a script or a numeric region, so `compose` fails for codes such as `zh-Hans`; use a language or language-region code there.

Write the straight `'` and `"` in the language files; each converter escapes them for its target. The typographic apostrophe ’ (U+2019) is allowed but not required.

## Check
`lang.mjs check` ([usage](usage.md#language-files)) runs on the shared catalogue, the app's folders and, optionally, Chrome `_locales` folders. It fails when:
- `en.json` or `hi.json` is missing, or a file name is not a language code;
- a key exists in English and not in Hindi (or the other way round), or in any other language and not in English;
- a placeholder is missing, repeated or changed in a translation;
- a plural form is one the language does not use;
- a Hindi text uses a disallowed alternative from the term list (`lang/hindi-terms.json`, matched as whole words);
- a text contains digits other than 0-9 (Devanagari ० to ९, Arabic-Indic, Bengali, …);
- a key, a plural form or a brace is malformed, or an app key redefines a shared one.

Chrome `_locales/<lang>/messages.json` files are checked the same way, every language folder in it (`pt_BR` is `pt-BR`): `$name$` placeholders count as `{name}` (and must be defined in that file's `placeholders`), `$1`–`$9` as `{arg1}`–`{arg9}`; their keys follow Chrome's own rule.

## Crowdin
Translators work in [Crowdin](crowdin.md), whose "i18next JSON" parser knows plural forms only as sibling keys with a CLDR suffix and then asks each translator for exactly the forms their language uses. So the language files are converted on the way in and out ([usage](usage.md#language-files)):
- `lang.mjs crowdin-export <dir> --out <file>` writes the Crowdin source file of `<dir>/en.json`: texts as they are, plural forms as `key_one`, `key_other`, … (`{"downloads.count_one": "{count} download", "downloads.count_other": "{count} downloads"}`). A text key that already ends in `_one`, `_other` (or another category) fails: rename it.
- `lang.mjs crowdin-import <file> --lang <code> --into <dir>` turns a translated file back into `<dir>/<code>.json`, in the key order of English, with the suffixed keys gathered into plural forms. Empty (untranslated) texts are left out. The folder with the new file must pass the check; otherwise nothing is written and the problems are listed. `en` is never imported.
- Placeholders stay `{name}`; Crowdin shows them as placeholders and its own QA check flags a changed one.
