---
type: Policy
title: Rules
description: What may go into KS Utility and the rules every utility must keep.
tags: [rules, scope, policy]
status: draft
---

# Rules

- **Generic only.** A utility belongs here when it is reused across apps and knows nothing about any one of them. Application-specific logic or helpers stay in that app's repository.
- **Drop-in.** Each utility is self-contained: once an app has `ks-utility` as a dependency, a utility is used by importing it. No utility needs setup or configuration of its own.
- **No third-party dependencies.** A utility uses only its language's standard library. The Kotlin part is plain Kotlin/JVM with no Android SDK, so Android, TV and desktop apps can all use it.
- **No app knowledge.** No app package names, resources, screens, storage schemas or feature flags. Anything a utility needs from the app comes in as a parameter.
- **Pinned by version tag.** Every app pins a `ks-utility` version tag (the lock files keep its exact commit) (see "How apps depend on it"). A change here reaches an app only when that app moves its pin, so apps still build and ship alone.
- **No breaking changes in place.** Apps move their pins at different times (each before its own next release): add a new function instead of changing the meaning or signature of one that is in use.
- **No network, no analytics.** A utility never opens a connection or reports anything by itself, so it is safe for `ks-vault` and `ks-expense-manager`. The development tools in `typescript/tools/` are not shipped in any app; the translation editor among them listens on `127.0.0.1` only, behind a random token, and connects nowhere.
- **Tested here.** Each utility has unit tests in this repository, in the same commit.

These rules are also in `CLAUDE.md`, where they are loaded into every AI-assisted session; change both together.
