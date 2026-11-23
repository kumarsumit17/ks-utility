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

## Language files

Every suite app supports English and Hindi ([Languages](languages.md)) and checks its language files ([format](translation-format.md#check)) with one command, from this repository:

```bash
node <ks-utility>/typescript/tools/lang.mjs check <dir>... [--chrome <_locales dir>]...
node <ks-utility>/typescript/tools/lang.mjs android <dir>... --out <res dir> [--name lang_strings]
```

- Each `<dir>` holds `en.json` and `hi.json`. The shared catalogue (`lang/common`) is always included. Exit code 0 when everything passes, 1 with one line per problem, 2 for a usage mistake.
- It needs Node 23.6 or later and nothing installed. `lang.mjs` is plain JavaScript: Node does not strip TypeScript types from files inside `node_modules`, so it copies the TypeScript tool (`lang.ts`) and `typescript/src/lang/` to a new temporary folder, runs it there and removes the folder (fixed in `v0.2.1`; with `v0.2.0` the command fails inside `node_modules`). `<ks-utility>` is `node_modules/ks-utility` in a TypeScript app and the `ks-utility/` submodule in a Kotlin app.
- **TypeScript app:** add it to the app's tests, for example `"test:lang": "node node_modules/ks-utility/typescript/tools/lang.mjs check src/locales --chrome extension/_locales"`. Import the shared catalogue as `ks-utility/lang/common/en.json` and `ks-utility/lang/common/hi.json` and pass it to `createTranslator` before the app's own files.
- **Kotlin app:** keep the language files in the app (for example `app/src/main/lang/`), and register two Gradle tasks: one running `check`, hooked into `check`; one running `android --out app/src/main/res`, hooked before `preBuild`. For example:

  ```kotlin
  val langTool = rootProject.file("ks-utility/typescript/tools/lang.mjs")
  val checkLanguageFiles by tasks.registering(Exec::class) {
      commandLine("node", langTool, "check", file("src/main/lang"))
  }
  val languageResources by tasks.registering(Exec::class) {
      commandLine("node", langTool, "android", file("src/main/lang"), "--out", file("src/main/res"))
  }
  tasks.named("check") { dependsOn(checkLanguageFiles) }
  tasks.named("preBuild") { dependsOn(languageResources) }
  ```

  The generated `values/lang_strings.xml` and `values-hi/lang_strings.xml` are build output: git-ignore them.

## Versioning
- Tags are `vMAJOR.MINOR.PATCH`. While in `0.x`: a new helper or a behaviour change raises MINOR; a fix raises PATCH.
- A tag is never moved or deleted once pushed. A mistake gets a new tag. The single exception: on 2026-11-21 every tag was moved once, to the same files with tool attribution removed from the commit messages (history rewrite). Commit IDs from before that date no longer match.
- Apps move to a newer tag deliberately, in their own commit, never mixed with other changes.
- **Future step, not now:** publishing to public registries (crates.io, npm, Maven Central) is deferred until the helpers are stable.

| Tag | Commit | What it holds |
|---|---|---|
| `v0.1.0` | `4118c1e` | The first generic helpers moved from `ks-download-manager` (HTTP dates, backoff, ranges, file names, atomic writes, formatting) |
| `v0.2.0` | `58ccb47` | English and Hindi for every app: translation format, shared catalogue, translator, language rule, language-file check and Android conversion, Hindi style guide and term list; Rust message codes, token bucket, media-type extensions; locale-aware formatting |
| `v0.2.1` | the commit the tag names (each app's lock files record it) | Fix: the language-file command runs from `node_modules` (`typescript/tools/lang.mjs`) |
| `v0.3.0` | the commit the tag names | App updates ([spec](app-update.md)): Kotlin, Rust and TypeScript helpers, SHA-256, `createUpdateStore`, shared texts `common.appUpdate.*`; first Kotlin code |

A change to this contract is a cross-repo change: update the suite's `specs/cross-repo.md` and the `CLAUDE.md` of every app in the same cycle.
