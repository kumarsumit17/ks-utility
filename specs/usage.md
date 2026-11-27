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
| `ks-download-manager` (interface) | npm git dependency | `"ks-utility": "git+https://github.com/kumasumit/ks-utility.git#<tag>"` in `package.json` |
| `ks-download-manager` (engine) | Cargo git dependency | `ks-utility = { git = "https://github.com/kumasumit/ks-utility", tag = "<tag>" }` in `src-tauri/Cargo.toml` and `src-tauri/engine/Cargo.toml` |

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

Every suite app supports English and Hindi, and may ship more languages ([Languages](languages.md)), and checks its language files ([format](translation-format.md#check)) with one command, from this repository:

```bash
node <ks-utility>/typescript/tools/lang.mjs check <dir>... [--chrome <_locales dir>]...
node <ks-utility>/typescript/tools/lang.mjs android <dir>... --out <res dir> [--name lang_strings] [--pseudo]
node <ks-utility>/typescript/tools/lang.mjs compose <dir>... --out <res dir> [--name lang_strings] [--pseudo]
node <ks-utility>/typescript/tools/lang.mjs status <dir>...
node <ks-utility>/typescript/tools/lang.mjs translate <dir>... [--lang <code>]... [--memory <dir>]... [--port <n>]
node <ks-utility>/typescript/tools/lang.mjs export-xliff <dir> --lang <code> --out <file> [--all]
node <ks-utility>/typescript/tools/lang.mjs import-xliff <file> --lang <code> --into <dir>
```

- Each `<dir>` holds one file per language: `en.json` and `hi.json` always, and any others (`fr.json`, `pt-BR.json`; from `v0.8.0`). `android` and `compose` write one `values-…` folder per language. `status`, `translate`, `export-xliff`, `import-xliff` and `--pseudo` are the [translation tools](translating.md) (from `v0.9.0`). The shared catalogue (`lang/common`) is always included. Exit code 0 when everything passes, 1 with one line per problem, 2 for a usage mistake.
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
- **Compose Multiplatform app:** the same, with `compose` instead of `android`, written to a build folder that `compose.resources { customDirectory(...) }` reads. `android` output in a Compose app shows the escapes ("You\'re offline"); `compose` exists from `v0.5.0` ([format](translation-format.md#compose-multiplatform)).

## Versioning
- Tags are `vMAJOR.MINOR.PATCH`. While in `0.x`: a new helper or a behaviour change raises MINOR; a fix raises PATCH.
- A tag is never moved or deleted once pushed. A mistake gets a new tag. The single exception: on 2026-11-21 every tag was moved once, to the same files with tool attribution removed from the commit messages (history rewrite). Commit IDs from before that date no longer match.
- Every app moves to the newest ks-utility tag before each of its releases, in its own commit, never mixed with other changes (the suite's [release cycle](https://github.com/kumasumit/ks-suite/blob/main/specs/release-cycle.md), step 1).
- **Future step, not now:** publishing to public registries (crates.io, npm, Maven Central) is deferred until the helpers are stable.

| Tag | Commit | What it holds |
|---|---|---|
| `v0.1.0` | `4118c1e` | The first generic helpers moved from `ks-download-manager` (HTTP dates, backoff, ranges, file names, atomic writes, formatting) |
| `v0.2.0` | `58ccb47` | English and Hindi for every app: translation format, shared catalogue, translator, language rule, language-file check and Android conversion, Hindi style guide and term list; Rust message codes, token bucket, media-type extensions; locale-aware formatting |
| `v0.2.1` | the commit the tag names (each app's lock files record it) | Fix: the language-file command runs from `node_modules` (`typescript/tools/lang.mjs`) |
| `v0.3.0` | the commit the tag names | App updates ([spec](app-update.md)): Kotlin, Rust and TypeScript helpers, SHA-256, `createUpdateStore`, shared texts `common.appUpdate.*`; first Kotlin code |
| `v0.4.0` | the commit the tag names | The shared release workflow for the Kotlin apps ([spec](release-workflow.md)). Do not use: it names a signed APK `-UNSIGNED`, so the publish check stops every release |
| `v0.4.1` | the commit the tag names | Fix: signed APK and AAB keep their release names; call `kotlin-app-release.yml@v0.4.1` |
| `v0.4.2` | the commit the tag names | Docs: verify release attestations with `--signer-workflow`; the workflow is unchanged from `v0.4.1` |
| `v0.18.2` | the commit the tag names | `ks-utility-bump.yml`: when the tests pass but the commit or push fails, the issue says so ([release workflow](release-workflow.md#moving-to-the-newest-ks-utility)) |
| `v0.18.1` | the commit the tag names | `ks-utility-bump.yml`: Gradle's cache (read-only), one retry when the tests fail on a download, and an issue that names a download failure as such ([release workflow](release-workflow.md#moving-to-the-newest-ks-utility)) |
| `v0.18.0` | the commit the tag names | Apps call the shared workflows at `@main`, always the newest release: ks-suite-check requires it (`@dev` only in a rehearsal); `ks-utility-bump.yml` moves only the pin again, without `KS_WORKFLOWS_TOKEN`, which also fixes its failed push (a `.yaml` pathspec with no file) ([release workflow](release-workflow.md#which-version-an-app-calls)) |
| `v0.17.0` | the commit the tag names | TypeScript update store: `Opened` `"macos-closes"` gives `common.appUpdate.openedMacCloses`, and `MAC_QUIT_AFTER_MS` ([app updates](app-update.md#how-each-platform-installs)) |
| `v0.16.0` | the commit the tag names | ks-suite-check: an app's calls of ks-utility's shared workflows must be at the newest tag ([ks-suite-check](suite-check.md)); `ks-utility-bump.yml` moves them too with the optional secret `KS_WORKFLOWS_TOKEN` ([release workflow](release-workflow.md#moving-to-the-newest-ks-utility)) |
| `v0.15.0` | the commit the tag names | `DesktopInstaller` (Kotlin) and `app_update::install` (Rust): open a desktop update and quit so it can be replaced, with `common.appUpdate.openedMacCloses` ([app updates](app-update.md#how-each-platform-installs)); [ks-suite-check](suite-check.md) in both release workflows; `ks-utility-bump.yml` and `notify-apps.yml` move every app to the newest tag ([release workflow](release-workflow.md#moving-to-the-newest-ks-utility)) |
| `v0.14.0` | the commit the tag names | Shared release workflows for the Tauri apps: `tauri-app-release-check.yml` (tag, version, changelog, on main) and `tauri-app-release-publish.yml` (attest and publish exactly the named files) ([release workflow](release-workflow.md#tauri-apps)) |
| `v0.13.2` | the commit the tag names | Currency करेंसी and Default (setting) डिफ़ॉल्ट approved by the owner ([Hindi style guide](hindi-style.md)). No code change |
| `v0.13.1` | the commit the tag names | 2 Hindi terms from KS Expense Manager for owner review ([Hindi style guide](hindi-style.md)). No code change |
| `v0.13.0` | the commit the tag names | KS TV Launcher's 15 Hindi terms approved by the owner; अनपिन करें is avoided, so an app's language check fails on it once it moves its pin ([Hindi style guide](hindi-style.md)). No code change |
| `v0.12.1` | the commit the tag names | पैनल is no longer avoided: Panel पैनल (approved), Pane stays हिस्सा ([Hindi style guide](hindi-style.md)). No code change |
| `v0.12.0` | the commit the tag names | 44 Hindi terms approved by the owner, with new words to avoid: रकम, ट्रांसपोर्ट, शॉपिंग, सेहत, टाइटल, पैनल, बाँटें; an app's language check fails on them once it moves its pin ([Hindi style guide](hindi-style.md)). No code change |
| `v0.11.2` | the commit the tag names | 15 Hindi terms from KS TV Launcher for owner review ([Hindi style guide](hindi-style.md)). No code change |
| `v0.11.1` | the commit the tag names | 5 Hindi terms from KS Expense Manager for owner review ([Hindi style guide](hindi-style.md)). No code change |
| `v0.11.0` | the commit the tag names | Platforms `google-tv` (Rust `GoogleTv`, TypeScript `"google-tv"`: the TV build, else any APK) and `chrome` (all three languages: tag prefix `chrome-`, no installer file) ([app updates](app-update.md#platform-tags)) |
| `v0.10.1` | the commit the tag names | Hindi terms from KS Vault and KS Forge for owner review ([Hindi style guide](hindi-style.md)); the suite does not use platform tags for now ([app updates](app-update.md#platform-tags)). No code change |
| `v0.10.0` | the commit the tag names | Platform tags: `<platform>-vX.Y.Z` (android, google-tv, mac, windows) builds and releases one platform in the release workflow (`platform` input for rehearsals), platform releases are not marked latest, and the app-update helpers read the release list for the newest release with this platform's file ([app updates](app-update.md), [release workflow](release-workflow.md)). Also the Hindi terms from KS Expense Manager, for owner review |
| `v0.9.0` | the commit the tag names | Own translation tools, no outside service ([translation tools](translating.md)): the translation editor (`translate`), quality checks, translation memory, glossaries per language, `_context.json` notes and length limits, `_state.json` outdated and approved texts, XLIFF export and import, `--pseudo` (`en-XA`), `status`. Removes the Crowdin commands and functions of `v0.8.0` |
| `v0.8.0` | the commit the tag names | More languages: one file per language code (English and Hindi required, others partial, fallback through the region to English), the check for every language, one Android/Compose `values-…` folder per language, `crowdin-export` / `crowdin-import` (for Crowdin), Kotlin `LanguageRules` for 28 languages. `crowdin-export` / `crowdin-import` are removed in `v0.9.0`, which has its own translation tools instead |
| `v0.7.0` | the commit the tag names | Google Play: the shared release workflow's `play-build-type` input builds each AAB from that build type (no in-app updater), while the APKs stay the GitHub build; `mac-intel` adds an Intel dmg (`-macos-x64.dmg`) ([release workflow](release-workflow.md)) |
| `v0.6.0` | the commit the tag names | Google TV: `UpdatePlatform.GOOGLE_TV` picks `…-google-tv.apk` and `ANDROID` never picks it ([app updates](app-update.md)); the shared release workflow's `tv-module` input builds and publishes that separate TV APK and AAB ([release workflow](release-workflow.md)) |
| `v0.5.0` | the commit the tag names | `lang.mjs compose`: string resources escaped for Compose Multiplatform ([format](translation-format.md#compose-multiplatform)); Kotlin look-up `com.ks.utility.lang.Translator` (layers, English fallback, placeholders, en/hi plurals, Indian grouping) |

A change to this contract is a cross-repo change: update the suite's `specs/cross-repo.md` and the `CLAUDE.md` of every app in the same cycle.
