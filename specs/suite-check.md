---
type: Specification
title: ks-suite-check
description: The conformance check every KS-Suite app's release runs before anything is built, so the suite rules that code can check (platform folders, no hardcoded versions, no tracking SDKs, no default icons, language files, ks-utility's updater, the newest ks-utility pin) stop a release that breaks them.
tags: [ci, release, conformance, rules]
---

# ks-suite-check

From `v0.15.0`. The suite rules that code can check are checked by code: `typescript/tools/suite-check.mjs`, Node's standard library only. Both shared release workflows run it on the app's checkout before anything is built, from ks-utility's **newest** tag, so a rule added here reaches every app at its next release:

- `kotlin-app-release.yml`, in the version job;
- `tauri-app-release-check.yml`, after the tag check.

A problem fails the run, rehearsal or tag, and nothing is built or published. To run it by hand:

```bash
node <ks-utility>/typescript/tools/suite-check.mjs <app dir> [--newest <tag> --newest-commit <sha>] [--rehearsal]
```

## The rules
| Rule | Fails when |
|---|---|
| Platform folders | One of `tv/google-tv/`, `desktop/mac/`, `desktop/windows/`, `mobile/android/`, `mobile/ios/` is missing ([platform folders](https://github.com/kumasumit/ks-suite/blob/main/specs/platform-folders.md)) |
| Versions from the tag | A `*.gradle.kts` sets `versionName`, `versionCode`, `packageVersion` or `version` to a literal; a `tauri.conf.json`, `package.json`, extension `manifest.json` or `Cargo.toml` `[package]` has a version other than `0.0.0` |
| No tracking | A dependency file (`*.gradle.kts`, `libs.versions.toml`, `package.json`, `Cargo.toml`) names an analytics, crash-reporting or ad SDK (Firebase Analytics or Crashlytics, Sentry, Bugsnag, AdMob, Mixpanel, Amplitude, App Center, PostHog and others: `TRACKING_SDKS`) |
| The app's own icons | A launcher icon is Android Studio's robot; a Compose Desktop `nativeDistributions` has no `iconFile` (the Kotlin logo); a file under an `icons/` folder is one of Tauri's template icons (by SHA-256) ([app icons](https://github.com/kumasumit/ks-suite/blob/main/specs/conventions.md)) |
| Language files | No `en.json` with a `hi.json`, or the [language-file check](usage.md#language-files) fails on them (and on any Chrome `_locales`) |
| ks-utility's updater | No source file uses `com.ks.utility.appupdate`, `ks_utility::app_update` or `appUpdate` from `ks-utility` |
| The newest ks-utility | The `ks-utility` submodule, or a `ks-utility` git tag in a `package.json` or `Cargo.toml`, is not ks-utility's newest tag: move the pin first (the suite's [release cycle](https://github.com/kumasumit/ks-suite/blob/main/specs/release-cycle.md), step 1). From `v0.19.1`, a DEV build (manual run) may instead pin the submodule at a commit on ks-utility's `dev` that is ahead of the newest tag, to try unreleased ks-utility work in one app before it is tagged; the check then comes from `dev`. A release never may |
| Shared workflows at `@main` | From `v0.18.0`: a file in the app's `.github/workflows/` calls `kumasumit/ks-utility/.github/workflows/<name>.yml` at anything but `@main`, the newest release ([which version an app calls](release-workflow.md#which-version-an-app-calls)). A rehearsal (`--rehearsal`, a manual run) also accepts `@dev`, to try a change to a shared workflow before its tag |

Build output, dependencies and the ks-utility copy (`build/`, `.gradle/`, `node_modules/`, `target/`, `dist/`, `ks-utility/`) are not looked into.

## The one exception
An app with no in-app updater at all says so in `ks-suite-check.json` at its root, with the reason: `{"no-updater": "no in-app updater: an open owner question (specs/plan-v1.md)"}`. Nothing else can be switched off: an unknown key, or `no-updater` without a reason, fails the check.

## What it cannot see
The icon rule knows the default icons by their files: Android Studio's template robot, Compose Desktop without an icon, and Tauri's current template icons. An older or resized copy of a framework logo is not recognised; the owner's look at the built app is still the check for that.
