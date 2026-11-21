---
type: Policy
title: Rules
description: What may go into KS Utility and the rules every utility must keep.
tags: [rules, scope, policy]
status: draft
---

# Rules

- **Generic only.** A utility belongs here when it is reused across apps and knows nothing about any one of them. Application-specific logic or helpers stay in that app's repository.
- **Drag and drop.** Each utility is self-contained: copying its file (or its one folder) into an app is all it takes to use it. No utility needs setup, configuration or a build step of its own.
- **No third-party dependencies.** A utility uses only the language's standard library (for Kotlin, the Kotlin standard library and, when the utility is Android-specific, the Android SDK).
- **No app knowledge.** No app package names, resources, screens, storage schemas or feature flags. Anything a utility needs from the app comes in as a parameter.
- **Apps still build alone.** Apps take utilities by copying the source in; no app depends on this repository at build time or at run time.
- **No network, no analytics.** A utility never opens a connection or reports anything by itself, so it is safe to copy into `ks-vault` and `ks-expense-manager`.
- **Tested here.** Each utility has unit tests next to it in this repository.

These rules are also in `CLAUDE.md`, where they are loaded into every AI-assisted session; change both together.
