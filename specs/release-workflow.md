---
type: Specification
title: Shared release workflow
description: The GitHub Actions release workflows the KS-Suite apps call, one for the Kotlin apps (Android, Google TV, macOS, Windows) and a check and a publish for the Tauri apps, with their inputs, file names, signing checks and publishing rules.
tags: [release, ci, github-actions, android, google-tv, macos, windows, chrome-extension, tauri, signing]
---

# Shared release workflow

The five Kotlin apps (`ks-tv-launcher`, `ks-jaiplayer`, `ks-streamflix`, `ks-vault`, `ks-expense-manager`) release through one reusable workflow in this repository, `.github/workflows/kotlin-app-release.yml`. Each app keeps only a short `.github/workflows/release.yml` that calls it at `@main` ([which version an app calls](#which-version-an-app-calls)) and names its platforms. A fix to the release process is made once, here, and reaches every app's next release.

The two Tauri apps (`ks-download-manager`, `ks-forge`) build differently from the Kotlin apps and from each other (bundled programs, Developer ID signing, the Chrome extension, self-tests), so their build jobs stay in their own `release.yml`. What is the same in both, the checks before the build and the attesting and publishing after it, is in two reusable workflows here ([Tauri apps](#tauri-apps)). Their release files follow the same names, so the [app-update](app-update.md) rules hold for them too.

## How an app calls it

```yaml
# .github/workflows/release.yml in the app
name: Release
on:
  push:
    tags: ["v*.*.*"]   # with platform tags also: ["v*.*.*", "*-v*.*.*"]
  workflow_dispatch:
    inputs:
      version:
        description: "Version to rehearse, X.Y.Z. Builds everything, releases nothing."
        required: true
        type: string
permissions:
  contents: read
jobs:
  release:
    uses: kumasumit/ks-utility/.github/workflows/kotlin-app-release.yml@main
    permissions:           # only the publish job uses the write permissions
      contents: write
      id-token: write
      attestations: write
    with:
      version: ${{ inputs.version }}
      app-name: ks-jaiplayer
      display-name: KS JaiPlayer
      android-module: ":mobile:android"   # empty: no Android
      tv-module: ":tv:google-tv"          # only an app with a real TV version; empty: no TV APK
      play-build-type: "play"             # the AAB is the Google Play build; empty: release
      mac-module: ":desktop:mac"          # empty: no macOS
      windows-module: ":desktop:windows"  # empty: no Windows
      test-tasks: ":shared:desktopTest"
    secrets: inherit
```

| Input | Meaning | Default |
|---|---|---|
| `version` | Rehearsal only: the version to build (`X.Y.Z`); pass the manual run's input. A tag run ignores it | none |
| `platform` | Rehearsal only (from `v0.10.0`): which platform to build, `all`, `android`, `google-tv`, `mac` or `windows`, as that platform's tag would. A tag run takes it from the tag | `all` |
| `app-name` | Repository name, the prefix of every file name | required |
| `display-name` | The app's name, used for the release title | required |
| `android-module` | Gradle path of the phone app module; a TV-only app (`ks-tv-launcher`) builds its TV app here | none |
| `mac-intel` | Also an Intel dmg, built on GitHub's Intel macOS runner (`macos-15-intel`) | false |
| `play-build-type` | Build type the AABs come from, for Google Play: no in-app updater and no `REQUEST_INSTALL_PACKAGES`, which Play forbids. The APKs stay the release build, with the updater, for GitHub | none (the AAB is the release build) |
| `tv-module` | Gradle path of a separate Google TV app module, for an app with a real TV version (a `tv/google-tv` application module); signed with the same keystore | none |
| `android-file-name` | APK/AAB name without extension, for an app whose installed copies look for a fixed name (`ks-tv-launcher`: `app-release`) | `<app>-v<version>` |
| `mac-module` | Gradle path of the Compose Desktop module packaged for macOS | none |
| `windows-module` | Gradle path of the Compose Desktop module packaged for Windows | none |
| `test-tasks` | Gradle tasks run before the Android build | `testDebugUnitTest` |
| `desktop-test-tasks` | Gradle tasks run on macOS and Windows before packaging | none |
| `node` | Set up Node, which the language-file tools need | `true` |
| `require-main` | A tag release must point at a commit on `main` ([release cycle](https://github.com/kumasumit/ks-suite/blob/main/specs/release-cycle.md)) | `true` |

Secrets: `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD` ([versioning and signing](https://github.com/kumasumit/ks-suite/blob/main/specs/versioning-signing.md)), passed with `secrets: inherit`.

## What it does

1. **Version.** A tag `vMAJOR.MINOR.PATCH` (no suffix) on `main`, or from `v0.10.0` a platform tag `<platform>-vMAJOR.MINOR.PATCH` (`android`, `google-tv`, `mac`, `windows`; [platform tags](app-update.md)), gives `versionName` and `versionCode = MAJOR×10000 + MINOR×100 + PATCH` (MINOR and PATCH below 100); both are passed to every Gradle build as `-PversionName` and `-PversionCode`. A manual run is the **rehearsal** of the [release cycle](https://github.com/kumasumit/ks-suite/blob/main/specs/release-cycle.md): it builds the version given as input exactly as a tag would, and never attests or publishes.
2. **Android and Google TV** (Ubuntu). A tag release stops at once if a signing secret is missing. The keystore is decoded into the runner's temporary folder and opened once to check the password and alias. Tests, then `assembleRelease` and `bundleRelease` for the phone module and, if set, the TV module. The signing check embedded in the workflow proves each APK and AAB is signed by the keystore's certificate, or, for a manual run without secrets, that they carry no signature and are named `-UNSIGNED`. The keystore is deleted when the job ends.
3. **macOS** (`macos-15`, Apple silicon): `packageReleaseDmg`. Not yet signed with a Developer ID or notarised: the first open needs System Settings › Privacy & Security › Open Anyway.
4. **Windows** (`windows-2025`, x64): `packageReleaseMsi`. Not yet Authenticode-signed: SmartScreen asks once (More info › Run anyway).
5. **Attest and publish** (Ubuntu, the only job with write access). Only for a tag, only when every platform the app names built, and only with a verified signed APK. It checks it received exactly the expected files, gives each a build-provenance attestation (`gh attestation verify <file> -R kumasumit/<app> --signer-workflow kumasumit/ks-utility/.github/workflows/kotlin-app-release.yml`; the signer is this shared workflow, not the app's own `release.yml`), and publishes them with the preinstalled `gh` CLI as a full release with generated notes. A plain tag's release is marked latest and titled "<display name> X.Y.Z"; a platform tag builds and expects only that platform's files (the phone or the TV APK and AAB, the dmgs, or the msi), is titled "<display name> for macOS X.Y.Z" (Android, Google TV, Windows) and is not marked latest. `gh release create` with files keeps the release hidden until every file is up, so a failure publishes nothing.

Every action is pinned to a full commit SHA with its version in a comment, runner images are named versions, and only GitHub's own actions are used, as the release cycle requires.

## File names

| Platform | File |
|---|---|
| Android | `<app>-v<version>.apk`, `<app>-v<version>.aab` (`ks-tv-launcher`, TV-only, keeps `app-release.apk`, which its installed copies look for) |
| Google TV (`tv-module`) | `<app>-v<version>-google-tv.apk`, `<app>-v<version>-google-tv.aab` |
| macOS | `<app>-v<version>-macos-arm64.dmg`; with `mac-intel` also `<app>-v<version>-macos-x64.dmg` |
| Windows | `<app>-v<version>-windows-x64.msi` |

These match the asset rules of [App updates](app-update.md), so an app finds its own update file, and GitHub lists a SHA-256 digest for each.

## Tauri apps
From `v0.14.0`. An app's `release.yml` calls `tauri-app-release-check.yml` first, then runs its own build jobs, each uploading its release files as artifacts, then calls `tauri-app-release-publish.yml`:

```yaml
on:
  push:
    tags: ["v*", "mac-v*", "windows-v*"]
  workflow_dispatch:
    inputs:
      version: { description: "Version to rehearse, X.Y.Z", required: true, type: string }
      platform: { required: true, default: all, type: choice, options: [all, mac, windows] }

permissions: {}

jobs:
  version:
    permissions: { contents: read }
    uses: kumasumit/ks-utility/.github/workflows/tauri-app-release-check.yml@main
    with:
      version: ${{ inputs.version }}
      platform: ${{ inputs.platform }}
      platforms: "mac windows"
      set-version: node scripts/set-version.mjs "$KS_TAG"

  mac:            # the app's own build: needs version, uploads its .dmg as an artifact
    needs: version
    if: needs.version.outputs.platform == 'all' || needs.version.outputs.platform == 'mac'
    # ...

  windows:        # the same for the installer
    # ...

  publish:
    needs: [version, mac, windows]
    if: ${{ !cancelled() && !contains(needs.*.result, 'failure') && !contains(needs.*.result, 'cancelled') }}
    permissions: { contents: write, id-token: write, attestations: write }
    uses: kumasumit/ks-utility/.github/workflows/tauri-app-release-publish.yml@main
    with:
      tag: ${{ needs.version.outputs.tag }}
      version: ${{ needs.version.outputs.version }}
      platform: ${{ needs.version.outputs.platform }}
      rehearsal: ${{ needs.version.outputs.rehearsal }}
      files: >-
        ${{ needs.version.outputs.platform != 'windows' && format('ks-forge-v{0}-macos-arm64.dmg', needs.version.outputs.version) || '' }}
        ${{ needs.version.outputs.platform != 'mac' && format('ks-forge-v{0}-windows-x64-setup.exe', needs.version.outputs.version) || '' }}
      title: KS Forge ${{ needs.version.outputs.heading }}
      notes: node scripts/release-notes.mjs "$KS_TAG" > notes.md
      ks-utility: ${{ needs.version.outputs.ks-utility }}
      signing: |
        macOS: not signed with an Apple Developer ID
        Windows: not code-signed
```

**Check** (`tauri-app-release-check.yml`):

| Input | Meaning | Default |
|---|---|---|
| `version`, `platform` | Rehearsal only: the version and platform to rehearse (a manual run passes its inputs). A tag run takes them from the tag | `""`, `all` |
| `platforms` | The prefixes the app's tags may have: `mac`, `windows`, `chrome` ([platform tags](app-update.md#platform-tags)) | `mac windows` |
| `changelog` | Must have a line `## [<heading>] - YYYY-MM-DD`; empty: not checked | `CHANGELOG.md` |
| `set-version` | The app's own version command, run with `KS_TAG` set; empty: none | `""` |
| `require-main` | A tag must point at a commit on `main` | `true` |

A tag is `vX.Y.Z` (every platform) or `<platform>-vX.Y.Z`; it must be higher than every earlier plain tag and every earlier tag of its platform (another platform's tags do not count; for a plain tag every tag counts). Outputs: `tag`, `version`, `platform` (`all`, `mac`, `windows`, `chrome`), `heading` (`1.2.0`, `macOS 1.2.0`, `Windows 1.2.0`, `Chrome 1.2.0`) and `rehearsal`.

**Publish** (`tauri-app-release-publish.yml`), with the check's outputs and:

| Input | Meaning |
|---|---|
| `files` | The release files, space-separated; each must be in exactly one artifact of the run, and nothing else is released |
| `title` | The release title |
| `notes` | A command that writes `notes.md`, run in the app's checkout with `KS_TAG`, `KS_VERSION`, `KS_PLATFORM` set and every artifact of the run in `artifacts/` (e.g. the signing mode a build recorded) |
| `ks-utility` | From `v0.19.0`: the check's `ks-utility` output, the ks-utility version the app is built on, recorded in the notes |
| `signing` | From `v0.19.0`: one line per platform on how it is signed, added to the notes (default: macOS and Windows not code-signed) |

It attests every file (not in a rehearsal), checks they arrived unchanged and are attested, writes the notes and publishes: a plain tag's release is marked latest, a platform tag's is not. A published release is never changed: the run fails, and the next version gets a new tag. A rehearsal attests and publishes nothing and keeps the notes as an artifact. Verify a file with `gh attestation verify <file> -R kumasumit/<app> --signer-workflow kumasumit/ks-utility/.github/workflows/tauri-app-release-publish.yml`. The caller grants the publish job `contents: write`, `id-token: write` and `attestations: write`; it needs no secrets.

## DEV builds, approval and production
From `v0.19.0`, following the suite's [release cycle](https://github.com/kumasumit/ks-suite/blob/main/specs/release-cycle.md) ("DEV, test, approval, production"):

- **The DEV build is the manual run** (on `dev`, the suite's release cycle, "DEV and PROD side by side"). It builds the app's DEV variant and never tags, attests or publishes anything:
  - **Kotlin:** every Gradle build gets `-PksVariant=dev` (a release gets `-PksVariant=prod`) and `-PksDevVersion=X.Y.Z-dev+<commit>`. Android's `versionName` is that DEV version; macOS and Windows keep `X.Y.Z`, which jpackage needs, so a desktop app reports `ksDevVersion` itself. The app's build reads `ksVariant` for its DEV IDs (an `applicationId` suffix `.dev`, its own bundle ID and MSI UpgradeCode), so DEV and production install side by side.
  - **Tauri:** the check gives `variant` (`dev` or `prod`) and `dev-version`; the app's build jobs build the DEV variant with them (for example `tauri build --config tauri.dev.conf.json`).
  - **Files:** `<app>-dev-<X.Y.Z>-dev+<commit>-<platform>.<ext>` (`-android.apk`, `-google-tv.apk`, `-macos-arm64.dmg`, `-windows-x64.msi`), in artifacts named `dev-…`, kept 14 days for the owner's test by hand.
  - **Android signing:** with a separate DEV key from the secrets `DEV_KEYSTORE_BASE64`, `DEV_KEYSTORE_PASSWORD`, `DEV_KEY_ALIAS` and `DEV_KEY_PASSWORD` (passed by the caller like the production ones), never the production `ks-release` key; without them the DEV build fails and says which are missing. A release never falls back to the DEV key. The signature is verified as for a release.
  - **Trying ks-utility's `dev` first:** an app can pin its submodule at a commit on ks-utility's `dev` (ahead of the newest tag) and run its DEV build with its callers at `@dev`, so unreleased ks-utility work is tested in the app before ks-utility is tagged. [ks-suite-check](suite-check.md) accepts that pin in a DEV build only; before the app's next release it moves to the new tag.
  - **Updates:** a DEV build never offers production files: its version is not a release version, so the automatic check never runs and a check by hand never offers an update ([app updates](app-update.md)); `isDevBuild` names the rule for an app that hides its update section.
- **The owner's approval gates production.** The Kotlin workflow's publish job, and the Tauri publish workflow's attest job, run in the environment `production`. Once the owner sets it up in an app's repository (Settings, Environments, `production`, with the owner as required reviewer), every release tag waits there for that click, before anything is attested or published. Until then GitHub creates the environment unprotected and nothing waits. A Tauri rehearsal's attest job runs in `dev`, which needs no approval. No workflow changes a repository's settings.
- **Every production release** attaches `SHA256SUMS` (the SHA-256 of every release file) and its notes say: "Built on ks-utility vX.Y.Z (commit)", taken from the submodule's commit or the Tauri app's git tag; each platform's signing (Android: signed with the suite's key and verified, which blocks a release that fails; macOS and Windows: not signed unless the app says otherwise); and that every file has a build-provenance attestation.
- Kept as before: the Android signature check, attestations, "the tag is on main", and [ks-suite-check](suite-check.md). No paid signing.

## Which version an app calls
From `v0.18.0`, an app calls every shared workflow at `@main` (`kumasumit/ks-utility/.github/workflows/<name>.yml@main`), not at a tag, and [ks-suite-check](suite-check.md) fails a release that calls one at anything else:

- **Always the newest release.** ks-utility's `main` moves only together with a release tag: a commit that is not released yet waits on `dev`. So `@main` is the newest tag's workflow, and an app's release runs the newest checks with nothing to move.
- **No token that can change workflow files.** Moving `@vX.Y.Z` refs by machine would need a token with "Workflows: write" in every app, which could also add a workflow that reads the signing secrets. `@main` needs none.
- **A broken workflow on `main` reaches every app's next release at once.** So a change to a shared workflow is tried before its tag: push it to ks-utility's `dev`, then run one app's rehearsal (a manual run) with its caller at `@dev`. ks-suite-check accepts `@dev` in a rehearsal only, so the caller goes back to `@main` before that app's next release. Only then is the change tagged and `main` moved.

The code an app builds with stays pinned to a tag (the submodule, or the git tag in `package.json` and `Cargo.toml`), and that pin must be the newest tag ([moving to the newest ks-utility](#moving-to-the-newest-ks-utility)).

## Moving to the newest ks-utility
From `v0.15.0`. Every app uses ks-utility's newest tag. `ks-utility-bump.yml` moves it there by itself; an app's own `.github/workflows/ks-utility-bump.yml` calls it:

```yaml
name: Move to the newest ks-utility
on:
  repository_dispatch:
    types: [ks-utility-released]
  schedule:
    - cron: "17 4 * * *"   # daily, in case a notice was missed
  workflow_dispatch:

permissions: {}

jobs:
  bump:
    permissions: { contents: write, issues: write }
    uses: kumasumit/ks-utility/.github/workflows/ks-utility-bump.yml@main
    with:
      kind: kotlin                       # or tauri
      java: true
      test: ./gradlew testDebugUnitTest   # the app's own tests
```

| Input | Meaning | Default |
|---|---|---|
| `kind` | `kotlin` (the `ks-utility` submodule) or `tauri` (the git tag in every `package.json` and `Cargo.toml` that names ks-utility, and their lock files) | — |
| `test` | The app's tests, run from the root after the move | — |
| `runs-on` | The runner (`macos-15` for Rust tests that need macOS) | `ubuntu-24.04` |
| `java` | Set up JDK 17 | `false` |
| `node-version` | Node; empty: none | `24` |
| `linux-packages` | apt packages the tests need | `""` |

It checks out `dev`, moves the pin to the newest tag and runs the tests. It moves only the pin: the app calls the shared workflows at `@main`, which needs no move. It never moves a pin backwards: a submodule already ahead of the newest tag (an app trying ks-utility's `dev`) stays where it is. Gradle's cache is restored read-only for the Kotlin apps. Every Gradle job of the release workflow and the move first writes patient network settings to the runner's `gradle.properties` (2-minute connection and read timeouts, 6 retries from a 2 s backoff): after one network error Gradle stops asking that repository for the rest of the build, so a lost request made the Kotlin plugin "not found" in Maven Central, the plugin portal and the mirror at once. A test failure that is a download (Maven Central, the Gradle plugin portal, npm or crates.io not answering: "could not resolve plugin artifact", "Could not GET", a timeout or a 429/5xx) is retried once after 30 s; if it fails again, the issue it opens says the downloads failed, not the tests, so the move is simply run again. From `v0.18.4`, when `dev` moved while the tests ran (the app's own work), the move puts its one commit, which changes only the pin, on top of the new `dev` and pushes again, up to three times; it stops with nothing to do when `dev` already has the same pin, and fails when `dev` moved the pin elsewhere. When the tests passed but the commit or push failed, the issue says that instead. repository_dispatch and the daily run use the caller on the app's `main`, so a caller change reaches them only with the app's next release. Only when they pass does it commit `chore: move ks-utility to vX.Y.Z` (the pin and its lock files only) and push it to `dev`; when they fail nothing is pushed and an issue is opened, or the open one gets a comment. Already on the newest tag: nothing happens. It never makes a branch. A push with GitHub's own token does not start the app's other workflows; the tests ran in the move itself.

When ks-utility pushes a tag, `notify-apps.yml` sends `ks-utility-released` to every app, with the owner's secret `KS_APPS_DISPATCH_TOKEN` (a fine-grained token for the app repositories with "Contents: read and write", which repository_dispatch requires). Without the secret nothing is sent, and the daily run moves the apps.

## Later
- Developer ID signing and notarisation for macOS, Authenticode for Windows, once the owner has the certificates.
- An Intel macOS build, if wanted.
