---
type: Specification
title: Shared release workflow
description: The one GitHub Actions release workflow that every KS-Suite Kotlin app calls, for Android, Google TV, macOS and Windows, with its inputs, file names, signing checks and publishing rules.
tags: [release, ci, github-actions, android, google-tv, macos, windows, signing]
---

# Shared release workflow

The five Kotlin apps (`ks-tv-launcher`, `ks-jaiplayer`, `ks-streamflix`, `ks-vault`, `ks-expense-manager`) release through one reusable workflow in this repository, `.github/workflows/kotlin-app-release.yml`. Each app keeps only a short `.github/workflows/release.yml` that calls it, pinned to a tag of this repository, and names its platforms. A fix to the release process is made once, here, and reaches an app when it moves the pin, as for any other helper ([usage](usage.md)).

`ks-download-manager` (Rust, Tauri, Chrome extension) keeps its own workflow: its build (Tauri bundles, bundled programs, the extension zip) shares no steps with the Kotlin apps. Its release files follow the same names, so the [app-update](app-update.md) rules hold for it too.

## How an app calls it

```yaml
# .github/workflows/release.yml in the app
name: Release
on:
  push:
    tags: ["v*.*.*"]
  workflow_dispatch:
permissions:
  contents: read
jobs:
  release:
    uses: kumarsumit17/ks-utility/.github/workflows/kotlin-app-release.yml@v0.4.0
    permissions:
      contents: write      # only the publish job uses it
    with:
      app-name: ks-jaiplayer
      display-name: KS JaiPlayer
      android-module: ":mobile:android"   # empty: no Android
      mac-module: ":desktop:mac"          # empty: no macOS
      windows-module: ":desktop:windows"  # empty: no Windows
      test-tasks: ":shared:desktopTest"
    secrets: inherit
```

| Input | Meaning | Default |
|---|---|---|
| `app-name` | Repository name, the prefix of every file name | required |
| `display-name` | The app's name, used for the release title | required |
| `android-module` | Gradle path of the Android application module; Google TV apps use the same APK | none |
| `mac-module` | Gradle path of the Compose Desktop module packaged for macOS | none |
| `windows-module` | Gradle path of the Compose Desktop module packaged for Windows | none |
| `test-tasks` | Gradle tasks run before the Android build | `testDebugUnitTest` |
| `desktop-test-tasks` | Gradle tasks run on macOS and Windows before packaging | none |
| `node` | Set up Node, which the language-file tools need | `true` |
| `require-main` | A tag release must point at a commit on `main` ([release cycle](https://github.com/kumarsumit17/KS-Suite/blob/main/specs/release-cycle.md)) | `true` |

Secrets: `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD` ([versioning and signing](https://github.com/kumarsumit17/KS-Suite/blob/main/specs/versioning-signing.md)), passed with `secrets: inherit`.

## What it does

1. **Version.** A tag `vMAJOR.MINOR.PATCH` gives `versionName` and `versionCode = MAJOR×10000 + MINOR×100 + PATCH` (MINOR and PATCH below 100); both are passed to every Gradle build as `-PversionName` and `-PversionCode`. A manual run uses the latest tag and never publishes.
2. **Android and Google TV** (Ubuntu). A tag release stops at once if a signing secret is missing. The keystore is decoded into the runner's temporary folder and opened once to check the password and alias. Tests, then `assembleRelease` and `bundleRelease`. `.github/scripts/verify-release-signing.sh` (from this repository, at the workflow's own commit) proves both files are signed by the keystore's certificate, or, for a manual run without secrets, that they carry no signature and are named `-UNSIGNED`. The keystore is deleted when the job ends.
3. **macOS** (`macos-15`, Apple silicon): `packageReleaseDmg`. Not yet signed with a Developer ID or notarised: the first open needs System Settings › Privacy & Security › Open Anyway.
4. **Windows** (`windows-2025`, x64): `packageReleaseMsi`. Not yet Authenticode-signed: SmartScreen asks once (More info › Run anyway).
5. **Publish** (Ubuntu, the only job with write access). Only for a tag, only when every platform the app names built, and only with a verified signed APK. It adds `SHA256SUMS.txt` and publishes a full GitHub Release marked latest, with generated notes.

## File names

| Platform | File |
|---|---|
| Android, Google TV | `<app>-v<version>.apk`, `<app>-v<version>.aab` |
| macOS | `<app>-v<version>-macos-arm64.dmg` |
| Windows | `<app>-v<version>-windows-x64.msi` |

These match the asset rules of [App updates](app-update.md), so an app finds its own update file, and GitHub lists a SHA-256 digest for each.

## Later
- Developer ID signing and notarisation for macOS, Authenticode for Windows, once the owner has the certificates.
- An Intel macOS build, if wanted.
