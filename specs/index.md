---
okf_version: "0.2"
---

# Product specifications

* [Overview](overview.md) - What KS Utility is for, who uses it and how it is laid out.
* [Translation file format](translation-format.md) - The one format for interface text in every KS-Suite app (keys, placeholders, plural forms), how it is looked up, checked, converted for Android, and how Rust sends message codes.
* [App updates](app-update.md) - How every KS-Suite app finds a newer version of itself on GitHub, shows it in an "App updates" section, and installs it on each platform, with the shared helpers in Kotlin, Rust and TypeScript.
* [Shared release workflow](release-workflow.md) - The one GitHub Actions release workflow that every KS-Suite Kotlin app calls, for Android, Google TV, macOS and Windows, with its inputs, file names, signing checks and publishing rules.

# Reference

* [Utilities](utilities.md) - The utilities KS Utility provides in each language, and what each one is for.
* [How apps depend on KS Utility](usage.md) - The dependency mechanism for each kind of app, and the steps to move an app to a newer commit.

# Policies

* [Rules](rules.md) - What may go into KS Utility and the rules every utility must keep.
* [Dependencies](dependencies.md) - Utilities use only the standard library; no third-party dependencies.
* [Languages](languages.md) - Every KS-Suite app supports English and Hindi through KS Utility, and chooses between them by one rule.
* [Hindi style guide](hindi-style.md) - How every KS-Suite app writes Hindi interface text, with the term list and the alternatives that are not used.
