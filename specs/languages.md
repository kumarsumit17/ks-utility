---
type: Policy
title: Languages
description: Every KS-Suite app supports English and Hindi through KS Utility, may add more languages with KS Utility's own translation tools, and chooses among them by one rule.
tags: [language, hindi, english, translation, policy]
---

# Languages

Every KS-Suite app supports **English and Hindi** through KS Utility: its interface text is in language files of the [suite format](translation-format.md), the shared text comes from this repository's catalogue, Hindi follows the [Hindi style guide](hindi-style.md), and the app runs the language-file check in its tests ([usage](usage.md#language-files)).

## More languages
An app may ship more languages: one language file each, named by its code (`fr.json`, `pt-BR.json`), translated with KS Utility's own [translation tools](translating.md): a local editor, translation memory, glossaries, quality checks, review, XLIFF and pseudo-localisation, with no outside service.
- **English and Hindi stay required and complete**, and Hindi is written and reviewed by the owner against the style guide; the check fails without them.
- **Other languages may be partial.** A text a language leaves out is shown in English, so a language can ship as soon as its main screens are translated. A language is offered in Settings once the owner decides it is good enough.
- The same check applies to every language: placeholders as in English, only the plural forms the language uses, digits 0-9, and the words its glossary says to avoid.
- Before shipping a language, test the layout with the pseudo-locale (`--pseudo`, [translation tools](translating.md#pseudo-localisation)): text about 40 % longer shows where a screen clips.

## The language rule
One rule for every app:
1. **Follow the system.** With no choice made, the app uses the first of the system's preferred languages that it supports, exactly (`pt-BR`) or by its language part (`hi-IN` → Hindi), else English.
2. **Allow a choice.** Settings offers "Same as the system" and the app's languages, each by its own name ("English", "हिन्दी", "Français").
3. **Remember it.** The choice is saved with the app's settings and wins over the system from then on. Anything unknown in the saved setting counts as "Same as the system".

In TypeScript the rule is `resolveLanguage(choice, navigator.languages, supported)` and `parseLanguageChoice(saved, supported)`, where `supported` lists the app's languages (without it: English and Hindi); `nativeLanguageName(code)` gives each language's own name for the menu. Android apps get the same behaviour from the system's per-app language setting (`AppCompatDelegate.setApplicationLocales`, with each of the app's languages listed in `locales_config.xml`), which follows the system until the user picks a language and remembers the pick.

## Formatting
- Numbers, sizes, dates and times are formatted for the language with the built-in `Intl` (TypeScript) or the platform's formatters (Android), always with Latin digits.
- Unit symbols (`KB`, `MB/s`), `%` and `₹` stay as they are.
- Text is never assembled from pieces in code ("Downloaded " + n + " files"); each sentence is one key with placeholders, because word order differs between languages.
