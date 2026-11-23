---
type: Specification
title: Translation file format
description: The one format for interface text in every KS-Suite app (keys, placeholders, plural forms), how it is looked up in TypeScript and Kotlin, checked, converted for Android and Compose Multiplatform, and how Rust sends message codes.
tags: [language, translation, hindi, format, android, compose, kotlin, check]
---

# Translation file format

Every KS-Suite app keeps its interface text in language files of this format, one per language: English (`en.json`) and Hindi (`hi.json`) side by side in one folder ([Languages](languages.md)). No translation library is used anywhere; the helpers are in this repository.

## Files
- One JSON object per language. Each member is a **key** and its **text**, or a key and its **plural forms**.
- Both files of a folder have exactly the same keys.
- UTF-8, NFC. Hindi text in Devanagari, following the [Hindi style guide](hindi-style.md).
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
- The Hindi text uses exactly the placeholders of the English one, each as often (a missing, repeated or changed placeholder fails the check). Their order may differ.
- A value given as a number is formatted for the language by the built-in `Intl.NumberFormat`, always with Latin digits (`1,200`; Hindi uses Indian grouping, `1,00,000`). Values that are not quantities (years, IDs, versions) are passed as strings.

## Plural forms
- An object of Unicode CLDR categories (`zero`, `one`, `two`, `few`, `many`, `other`). `other` is required, and only categories the language uses are allowed: English and Hindi use `one` and `other`. Note that Hindi's `one` also covers 0.
- The form is chosen by the `{count}` parameter with the built-in `Intl.PluralRules`. `other` must contain `{count}`; other forms may leave placeholders out ("One file") but never add or repeat one.
- A key is plural forms in both languages or a text in both.

## Look-up (TypeScript)
`createTranslator(language, ...layers)` from `ks-utility` returns `t(key, params?)`:
- `layers` are `{ en, hi }` pairs of catalogs, searched last to first, so an app passes the shared catalogue first and its own files after it.
- A key missing in the language is taken from English; a key missing everywhere is returned as it is, so it shows up in testing.
- A placeholder without a value is left as it is.

## Look-up (Kotlin)
`com.ks.utility.lang.Translator(language, layers)` is the same look-up for Kotlin code that does not use Android or Compose resources (a server, a command-line tool). `Catalog.parse(json)` reads one language file; a layer is a map of language code to catalog (`mapOf("en" to …, "hi" to …)`).
- Layers searched last to first, English fallback, a missing key returned as it is, a placeholder without a value left as it is: as in TypeScript.
- `t(key, params)` or `tr(key, "name" to value)`. A number is formatted like `Intl.NumberFormat`: Latin digits, at most three decimals, thousands grouping, Indian grouping for Hindi (`12,34,567`). Other values are passed through `toString()`.
- Plural forms follow the CLDR rules of English (`one` is exactly 1) and Hindi (`one` is 0 to 1); other languages use the English rule. Without a numeric `count`, `other` is used.
- Interface text in Android and Compose apps comes from their resources (below), not from this class.

## Messages from Rust
Rust never builds display sentences. It sends a **message code** (a key of the app's language files) and named parameters, `ks_utility::message::Message` (`Message::new("error.http").with("status", 404)`); the interface looks the code up and fills in the parameters. `Display` on a message is for logs only.

## Android
The Kotlin apps use Android's own string resources, not a parallel runtime. `lang.mjs android` ([usage](usage.md#language-files)) converts the shared catalogue and an app's files into `values/lang_strings.xml` and `values-hi/lang_strings.xml`:
- Resource names: dots become `_` and capitals become `_` + lower case (`downloads.timeLeft` → `downloads_time_left`). Names that collide or are Java or Kotlin keywords fail.
- Placeholders become positional string arguments numbered by first appearance in the English text (`{done} of {total}` → `%1$s of %2$s`; the Hindi text keeps the same numbers), so the app formats numbers before passing them. Plurals become `<plurals>` (`getQuantityString(id, count, formattedCount, …)`).
- Text is escaped for Android (`'`, `"`, `\`, `@`/`?` at the start, `&`, `<`, `>`, newlines). In a text with arguments a literal `%` becomes `%%`.
- The generated files carry a "do not edit" comment and are rebuilt from the language files.

## Compose Multiplatform
Compose Multiplatform resources read the same `strings.xml` layout, but after reading the XML they undo only `\\`, `\n`, `\t` and `\uXXXX` (checked in Compose Multiplatform 1.12.2), so Android's `\'`, `\"`, `\@`, `\?` and `%%` would show their backslash or both percent signs ("You\'re offline"). Compose apps therefore use `lang.mjs compose` ([usage](usage.md#language-files)), which writes the same files and names with only that escaping: `\`, newlines, tabs and the XML characters `&`, `<`, `>`. Placeholders become `%1$s` as for Android.

Write the straight `'` and `"` in the language files; each converter escapes them for its target. The typographic apostrophe ’ (U+2019) is allowed but not required.

## Check
`lang.mjs check` ([usage](usage.md#language-files)) runs on the shared catalogue, the app's folders and, optionally, Chrome `_locales` folders. It fails when:
- a key exists in one language and not the other;
- a placeholder is missing, repeated or changed in the Hindi text;
- a Hindi text uses a disallowed alternative from the term list (`lang/hindi-terms.json`, matched as whole words);
- a Hindi text contains Devanagari digits (० to ९);
- a key, a plural form or a brace is malformed, or an app key redefines a shared one.

Chrome `_locales/<lang>/messages.json` files are checked the same way: `$name$` placeholders count as `{name}` (and must be defined in that file's `placeholders`), `$1`–`$9` as `{arg1}`–`{arg9}`; their keys follow Chrome's own rule.
