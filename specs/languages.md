---
type: Policy
title: Languages
description: Every KS-Suite app supports English and Hindi through KS Utility, and chooses between them by one rule.
tags: [language, hindi, english, policy]
---

# Languages

Every KS-Suite app supports **English and Hindi** through KS Utility: its interface text is in language files of the [suite format](translation-format.md), the shared text comes from this repository's catalogue, Hindi follows the [Hindi style guide](hindi-style.md), and the app runs the language-file check in its tests ([usage](usage.md#language-files)).

## The language rule
One rule for every app:
1. **Follow the system.** With no choice made, the app uses the first of the system's preferred languages that it supports (`hi-IN` → Hindi), else English.
2. **Allow a choice.** Settings offers "Same as the system", English and Hindi.
3. **Remember it.** The choice is saved with the app's settings and wins over the system from then on. Anything unknown in the saved setting counts as "Same as the system".

In TypeScript the rule is `resolveLanguage(choice, navigator.languages)` and `parseLanguageChoice(saved)`. Android apps get the same behaviour from the system's per-app language setting (`AppCompatDelegate.setApplicationLocales`, with `en` and `hi` listed in `locales_config.xml`), which follows the system until the user picks a language and remembers the pick.

## Formatting
- Numbers, sizes, dates and times are formatted for the language with the built-in `Intl` (TypeScript) or the platform's formatters (Android), always with Latin digits.
- Unit symbols (`KB`, `MB/s`), `%` and `₹` stay as they are.
- Text is never assembled from pieces in code ("Downloaded " + n + " files"); each sentence is one key with placeholders, because word order differs between English and Hindi.
