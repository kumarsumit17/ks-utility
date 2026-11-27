---
okf_version: "0.2"
---

# Product specifications

* [Overview](overview.md) - What KS Utility is for, who uses it and how it is laid out.
* [Translation file format](translation-format.md) - The one format for interface text in every KS-Suite app (keys, placeholders, plural forms, any number of languages), how it is looked up in TypeScript and Kotlin, checked, converted for Android, Compose Multiplatform and XLIFF, and how Rust sends message codes.
* [App updates](app-update.md) - How every KS-Suite app finds a newer version of itself on GitHub, shows it in an "App updates" section, and installs it on each platform, with the shared helpers in Kotlin, Rust and TypeScript.
* [Shared release workflow](release-workflow.md) - The GitHub Actions release workflows the KS-Suite apps call, one for the Kotlin apps (Android, Google TV, macOS, Windows) and a check and a publish for the Tauri apps, with their inputs, file names, signing checks and publishing rules.
* [ks-suite-check](suite-check.md) - The conformance check every KS-Suite app's release runs before anything is built, so the suite rules that code can check (platform folders, no hardcoded versions, no tracking SDKs, no default icons, language files, ks-utility's updater, the newest ks-utility pin) stop a release that breaks them.

# Reference

* [Utilities](utilities.md) - The utilities KS Utility provides in each language, and what each one is for.
* [How apps depend on KS Utility](usage.md) - The dependency mechanism for each kind of app, and the steps to move an app to a newer commit.

# Policies

* [Rules](rules.md) - What may go into KS Utility and the rules every utility must keep.
* [Dependencies](dependencies.md) - Utilities use only the standard library; no third-party dependencies.
* [Languages](languages.md) - Every KS-Suite app supports English and Hindi through KS Utility, may add more languages with KS Utility's own translation tools, and chooses among them by one rule.
* [Hindi style guide](hindi-style.md) - How every KS-Suite app writes Hindi interface text, with the term list and the alternatives that are not used.

# Playbooks

* [Translation tools](translating.md) - How the KS-Suite apps get more languages with KS Utility's own tools, run on this computer with no outside service: the translation editor, plural forms per language, quality checks, translation memory, glossaries, translators' notes, outdated and approved texts, XLIFF and pseudo-localisation.
