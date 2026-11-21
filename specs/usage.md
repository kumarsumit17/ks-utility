---
type: Reference
title: How apps depend on KS Utility
description: The dependency mechanism for each kind of app, the version-tag rules, and the steps to move an app to a newer tag.
tags: [dependency, submodule, gradle, npm, cargo, versioning]
status: draft
---

# How apps depend on KS Utility

Every app pins one version tag of this repository (`vMAJOR.MINOR.PATCH`). Lock files and submodule entries record the exact commit behind the tag, so builds are reproducible. Nothing is published to a registry yet (see [Versioning](#versioning)).

| App | Mechanism | Declared in |
|---|---|---|
| Kotlin apps (`ks-tv-launcher`, `ks-jaiplayer`, `ks-streamflix`, `ks-vault`, `ks-expense-manager`) | This repository as a git submodule at `ks-utility/`, included as a Gradle build | `.gitmodules`; `includeBuild("ks-utility/kotlin")` in `settings.gradle.kts`; `ks-utility = { module = "com.ks:utility" }` in `gradle/libs.versions.toml` |
| `ks-download-manager` (interface) | npm git dependency | `"ks-utility": "git+https://github.com/kumarsumit17/ks-utility.git#<tag>"` in `package.json` |
| `ks-download-manager` (engine) | Cargo git dependency | `ks-utility = { git = "https://github.com/kumarsumit17/ks-utility", tag = "<tag>" }` in `src-tauri/Cargo.toml` and `src-tauri/engine/Cargo.toml` |

## Kotlin apps

- Clone with `git clone --recurse-submodules`, or run `git submodule update --init` in an existing clone. CI checks out with `submodules: true`.
- `kotlin/` is a plain Kotlin/JVM Gradle build with group `com.ks` and name `utility`. Because the app includes it with `includeBuild`, Gradle builds it from source and substitutes it for `com.ks:utility`; the dependency has no version.
- The Kotlin version in `kotlin/gradle/libs.versions.toml` is kept in step with the apps.
- To move to a newer tag: `git -C ks-utility fetch --tags && git -C ks-utility checkout <tag>`, then commit the changed `ks-utility` entry in the app (it records the tag's commit).

## ks-download-manager

- npm reads the `package.json` in this repository's root, which exports `typescript/src/index.ts` as TypeScript source. The app's bundler compiles it.
- Cargo finds the `ks-utility` crate in `rust/` by its package name.
- To move to a newer tag: change the tag in `package.json` and both `Cargo.toml` files, run `npm install` and `cargo check`, check that both lock files name the tag's commit, and commit both lock files.

## Versioning
- Tags are `vMAJOR.MINOR.PATCH`. While in `0.x`: a new helper or a behaviour change raises MINOR; a fix raises PATCH.
- A tag is never moved or deleted once pushed. A mistake gets a new tag.
- Apps move to a newer tag deliberately, in their own commit, never mixed with other changes.
- **Future step, not now:** publishing to public registries (crates.io, npm, Maven Central) is deferred until the helpers are stable.

| Tag | Commit | What it holds |
|---|---|---|
| `v0.1.0` | `f772fa8` | The first generic helpers moved from `ks-download-manager` (HTTP dates, backoff, ranges, file names, atomic writes, formatting) |

A change to this contract is a cross-repo change: update the suite's `specs/cross-repo.md` and the `CLAUDE.md` of every app in the same cycle.
