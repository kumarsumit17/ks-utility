---
type: Specification
title: Overview
description: What KS Utility is for, who uses it and how it is laid out.
tags: [overview, utilities, layout]
status: draft
---

# Overview

Common utility functions shared across the KS-Suite apps. Everything here is generic: any suite app, today's or a later one, can take it as a dependency and use it as it is. Application-specific logic does not belong in this repository.

| | |
|---|---|
| **Used by** | Every KS-Suite app, as a dependency pinned to a version tag ([usage](usage.md)) |
| **Languages** | Kotlin, TypeScript, Rust |

## Layout

- `kotlin/`: Gradle build of a plain Kotlin/JVM library, `com.ks:utility`, package `com.ks.utility`. Used by the five Kotlin apps.
- `typescript/`: TypeScript source, exported through the `package.json` in the repository root. Used by the `ks-download-manager` interface.
- `rust/`: crate `ks-utility`. Used by the `ks-download-manager` engine.
- `lang/`: the shared English and Hindi catalogue and the Hindi term list, used by every app ([Languages](languages.md)). `typescript/tools/lang.mjs` checks any app's language files and converts them for Android.
- The same utility may exist in more than one language; each copy is written and tested for its own language.

Every KS-Suite app supports English and Hindi through this repository ([Languages](languages.md)).
