---
type: Reference
title: How apps depend on KS Utility
description: The dependency mechanism for each kind of app, and the steps to move an app to a newer commit.
tags: [dependency, submodule, gradle, npm, cargo]
status: draft
---

# How apps depend on KS Utility

Every app pins one exact commit of this repository. Nothing is published to a registry.

| App | Mechanism | Declared in |
|---|---|---|
| Kotlin apps (`ks-tv-launcher`, `ks-jaiplayer`, `ks-streamflix`, `ks-vault`, `ks-expense-manager`) | This repository as a git submodule at `ks-utility/`, included as a Gradle build | `.gitmodules`; `includeBuild("ks-utility/kotlin")` in `settings.gradle.kts`; `ks-utility = { module = "com.ks:utility" }` in `gradle/libs.versions.toml` |
| `ks-download-manager` (interface) | npm git dependency | `"ks-utility": "github:kumarsumit17/ks-utility#<commit>"` in `package.json` |
| `ks-download-manager` (engine) | Cargo git dependency | `ks-utility = { git = "https://github.com/kumarsumit17/ks-utility", rev = "<commit>" }` in `src-tauri/Cargo.toml` |

## Kotlin apps

- Clone with `git clone --recurse-submodules`, or run `git submodule update --init` in an existing clone. CI checks out with `submodules: true`.
- `kotlin/` is a plain Kotlin/JVM Gradle build with group `com.ks` and name `utility`. Because the app includes it with `includeBuild`, Gradle builds it from source and substitutes it for `com.ks:utility`; the dependency has no version.
- The Kotlin version in `kotlin/gradle/libs.versions.toml` is kept in step with the apps.
- To move to a newer commit: `git -C ks-utility fetch && git -C ks-utility checkout <commit>`, then commit the changed `ks-utility` entry in the app.

## ks-download-manager

- npm reads the `package.json` in this repository's root, which exports `typescript/src/index.ts` as TypeScript source. The app's bundler compiles it.
- Cargo finds the `ks-utility` crate in `rust/` by its package name.
- To move to a newer commit: change the commit in `package.json` and `src-tauri/Cargo.toml`, run `npm install` and `cargo check`, and commit both lock files.

A change to this contract is a cross-repo change: update the suite's `specs/cross-repo.md` and the `CLAUDE.md` of every app in the same cycle.
