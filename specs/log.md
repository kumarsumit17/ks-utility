# 2026-11-26

* **Update**: [Usage](usage.md), [App updates](app-update.md), [Release workflow](release-workflow.md), the README and two Kotlin doc comments: the GitHub owner is now `kumasumit` (was `kumarsumit17`); apps call `kumasumit/ks-utility/.github/workflows/kotlin-app-release.yml@<tag>`.

# 2026-11-25

* **Update**: [App updates](app-update.md) "Platform tags" and [Release workflow](release-workflow.md): the "not used for now" note is removed; every app, one-platform apps included, releases with platform tags again.
* **Update**: [Usage](usage.md): `v0.10.1` tagged (Hindi terms from KS Vault and KS Forge; platform tags not used for now).
* **Update**: [App updates](app-update.md) "Platform tags" and [Release workflow](release-workflow.md): the suite does not use platform tags for now (one plain `vX.Y.Z` tag releases all of an app's builds); the `v0.10.0` helpers stay, unused.
* **Update**: [Hindi style guide](hindi-style.md): 13 terms from KS Forge added for owner review (Tab टैब, Pane पैनल, Split बांटें, Terminal टर्मिनल, Shell शेल, Theme थीम, Shortcut शॉर्टकट, Font फ़ॉन्ट, Command palette कमांड पैलेट, Shell integration शेल इंटीग्रेशन, Scrollback स्क्रॉलबैक, Accent colour मुख्य रंग, Appearance रूप-रंग), in the table and `lang/hindi-terms.json`.
* **Update**: [Hindi style guide](hindi-style.md): 7 terms from KS Vault added for owner review (Vault वॉल्ट, Pattern पैटर्न, Lock लॉक, Unlock अनलॉक करें, Title शीर्षक, Encrypt एन्क्रिप्ट, Dot बिंदु), in the table and `lang/hindi-terms.json`.
* **Update**: [Usage](usage.md): `v0.10.0` tagged (platform tags).
* **Update**: [App updates](app-update.md) "Platform tags" and [Release workflow](release-workflow.md): an app's platforms may have their own versions, tagged `android-v…`, `google-tv-v…`, `mac-v…`, `windows-v…`. Kotlin, Rust and TypeScript helpers read the release list (`releasesApiUrl`, `parseReleases`, `evaluateReleases`, `tagVersion`, the release page by tag); the workflow builds only the tagged platform (`platform` input for rehearsals) and does not mark a platform release latest; the bridge release. For `v0.10.0`, not tagged yet.
* **Update**: [Hindi style guide](hindi-style.md): 13 terms from KS Expense Manager added for owner review (Expense खर्च, Amount रकम, Note नोट, Date तारीख, Export एक्सपोर्ट, Spreadsheet स्प्रेडशीट, Food खाना, Transport ट्रांसपोर्ट, Shopping शॉपिंग, Bills बिल, Health सेहत, Entertainment मनोरंजन, Hidden छिपी हुई), in the table and `lang/hindi-terms.json`.
* **Update**: [Usage](usage.md): `v0.9.0` tagged (own translation tools, Crowdin removed).
* **Creation**: [Translation tools](translating.md) added: KS Utility's own translation tools, with no outside service: the translation editor (`lang.mjs translate`, served on 127.0.0.1 behind a token), quality checks, translation memory, glossaries per language (`lang/glossary/<code>.json`), translators' notes and length limits (`_context.json`), outdated and approved texts (`_state.json`), XLIFF export and import, pseudo-localisation (`--pseudo`, `en-XA`) and `lang.mjs status`.
* **Update**: [Translation file format](translation-format.md), [Languages](languages.md), [usage](usage.md), [utilities](utilities.md), [rules](rules.md): Crowdin removed (`crowdin-export`, `crowdin-import`, `toCrowdinSource`, `fromCrowdin` and the Crowdin playbook); `_`-files in a language folder are not languages; XLIFF section; the development tools are not shipped and the editor listens on 127.0.0.1 only.
* **Update**: [Usage](usage.md): `v0.8.0` tagged (more languages, Crowdin conversion).
* **Creation**: Translating in Crowdin (`crowdin.md`, removed later the same day) added: one Crowdin project for the suite, the owner's one-time setup, `crowdin.yml` and the sync steps.
* **Update**: [Translation file format](translation-format.md), [Languages](languages.md), [usage](usage.md), [utilities](utilities.md): any number of languages (one file per language code; English and Hindi required, others partial), fallback through the region to English, the check for every language (plural forms per language, digits 0-9), one Android/Compose `values-…` folder per language, `crowdin-export` and `crowdin-import`, Kotlin `LanguageRules` for 28 languages checked against `Intl`.

# 2026-11-24

* **Update**: [Release workflow](release-workflow.md) and [Usage](usage.md) (`v0.7.0`): `play-build-type` makes each AAB the Google Play build (no in-app updater, no `REQUEST_INSTALL_PACKAGES`); the APKs stay the GitHub build. `mac-intel` adds an Intel dmg (`-macos-x64.dmg`) built on the `macos-15-intel` runner.
* **Update**: [App updates](app-update.md), [Release workflow](release-workflow.md) and [Usage](usage.md) (`v0.6.0`): separate Google TV builds. `UpdatePlatform.GOOGLE_TV` picks the TV APK (`…-google-tv.apk`, else a plain APK) and `ANDROID` never picks a TV build; the workflow's `tv-module` input builds, verifies and publishes `<app>-v<version>-google-tv.apk` and `.aab`.
* **Update**: [Usage](usage.md): `v0.5.0` tagged (Compose resource output, Kotlin `Translator`).

# 2026-11-23

* **Update**: [Translation file format](translation-format.md), [usage](usage.md), [utilities](utilities.md): `lang.mjs compose` writes string resources escaped for Compose Multiplatform (no `\'`, `\"`, `\@`, `\?` or `%%`, which Compose showed as typed); Kotlin look-up `com.ks.utility.lang.Translator` (moved from `ks-streamflix`).
* **Update**: [Usage](usage.md): `v0.4.2` tagged (docs only: attestation check with `--signer-workflow`).
* **Update**: [Shared release workflow](release-workflow.md): how to verify an attestation (`--signer-workflow` names this workflow).
* **Update**: [Shared release workflow](release-workflow.md), [usage](usage.md): `v0.4.1` fixes the Android file names (a signed APK was named `-UNSIGNED`, so `ks-jaiplayer` v1.0.0's publish check stopped and nothing was released); `v0.4.0` is not to be used.
* **Update**: [How apps depend on KS Utility](usage.md): tag `v0.4.0` (shared release workflow).
* **Creation**: [Shared release workflow](release-workflow.md) added: `.github/workflows/kotlin-app-release.yml`, one reusable release workflow for the five Kotlin apps (Android, Google TV, macOS, Windows), with the signing check (moved here from `ks-tv-launcher`) embedded in it.
* **Update**: [App updates](app-update.md): apps with no network access (`ks-vault`, `ks-expense-manager`) have no check; their section shows the version and a Get the new version link that opens in the browser.
* **Creation**: [App updates](app-update.md) added: the shared behaviour of every app's update check (daily GitHub `releases/latest` request with a switch, version rules, asset matching per platform, GitHub `sha256:` digest required, never for `0.0.0`, privacy note), the "App updates" section, how macOS, Windows, Android and the Chrome extension install, and the API per language (`v0.3.0`).
* **Update**: [Utilities](utilities.md): Rust `app_update` and `sha256`; TypeScript app-update helpers and `createUpdateStore`; the first Kotlin helpers (`com.ks.utility.appupdate`); shared texts `common.appUpdate.*` (`v0.3.0`).
* **Update**: [Hindi style guide](hindi-style.md): 6 terms for app updates (App ऐप, Install इंस्टॉल करें, Installer इंस्टॉलर, Check जांच करें, Disk image डिस्क इमेज, Unknown apps अनजान ऐप), marked for the owner's review.
* **Update**: [How apps depend on KS Utility](usage.md): tag `v0.3.0`.

# 2026-11-21

* **Update**: [Usage](usage.md): tags moved once, on 2026-11-21, to remove tool attribution from the commit messages; the single exception to "tags never move". Tag table updated to the new commit IDs.
* **Update**: [Hindi style guide](hindi-style.md): the owner's final review: every term approved with its current Hindi (इजाज़त, दिक्कत, इंतज़ार में, MP4 को पहले चुनें, जोड़ने की तारीख among them), except Yes, now हाँ (avoid हां): the one recorded exception to the anusvara spelling; `common.yes` is हाँ (`v0.2.4`).
* **Update**: [Hindi style guide](hindi-style.md): 5 terms from ks-download-manager's playlists (Playlist प्लेलिस्ट, Thumbnail थंबनेल, Select all सभी चुनें, Hide छिपाएं, Show दिखाएं), marked for the owner's review (`v0.2.3`).
* **Update**: [Hindi style guide](hindi-style.md): owner's wording: Status is स्टेटस (avoid स्थिति), Temporary folder is टेंप फ़ोल्डर (avoid अस्थायी), both approved; `common.language.system` is सिस्टम की भाषा (`v0.2.2`).
* **Update**: [Hindi style guide](hindi-style.md): 18 terms added from ks-download-manager (Queued, Paused, Size, Progress, Version, Quality, Permission and others), marked for the owner's review.
* **Update**: [How apps depend on KS Utility](usage.md), [Translation file format](translation-format.md): the language-file command is `typescript/tools/lang.mjs`, which runs the TypeScript tool from a temporary copy, because Node does not strip types inside `node_modules` (`v0.2.1`).
* **Creation**: [Translation file format](translation-format.md), [Languages](languages.md) and [Hindi style guide](hindi-style.md) added: every app supports English and Hindi through KS Utility; one JSON format with placeholders and CLDR plurals; shared catalogue in `lang/common`; the language rule (follow the system, allow a choice, remember it); the term list in `lang/hindi-terms.json`, checked against the guide's table.
* **Update**: [Utilities](utilities.md) and [How apps depend on KS Utility](usage.md): translator, language rule, language-file check and Android conversion (`typescript/tools/lang.ts`); Rust `message`, `token_bucket` and `media_type` (moved from `ks-download-manager`); locale-aware `formatBytes`, `formatSpeed`, `formatTimeLeft`; tag `v0.2.0`.
* **Update**: [How apps depend on KS Utility](usage.md), [Rules](rules.md), [Overview](overview.md): apps pin a version tag instead of a raw commit (`v0.1.0` = `f772fa8`); versioning rules (MINOR for new helpers or behaviour changes in 0.x, PATCH for fixes, tags never moved, apps move tags in their own commit); registry publishing deferred.
* **Update**: [Utilities](utilities.md): `parse_http_date` accepts only years 1970..=9999 and `parse_retry_after` returns `None` on overflow; `reserve_free_name` rejects anything but a single file name with `InvalidInput`; `gaps` clips every gap to `[0, size)`.
* **Update**: [Utilities](utilities.md): file names lose invisible format characters, reserved Windows names are matched before the first dot, `Content-Disposition` quoted values may hold `;`, `=` and escapes, `Range::len` saturates, and `write_atomic` documents that it allows one writer per path.
* **Creation**: [Utilities](utilities.md) added. Rust: HTTP-date and `Retry-After`, backoff with full jitter (jitter-only random source), `Content-Range`, `Content-Disposition` file name and percent-decoding, byte-range set, atomic file write, file-name sanitising and free-name reservation. TypeScript: byte, speed and time-left formatting. Moved from `ks-download-manager`.
* **Creation**: [How apps depend on KS Utility](usage.md) added: git submodule and Gradle included build for the Kotlin apps, npm and Cargo git dependencies for `ks-download-manager`.
* **Update**: [Rules](rules.md), [Overview](overview.md) and [Dependencies](dependencies.md): apps now take KS Utility as a pinned dependency instead of copying files; Kotlin, TypeScript and Rust parts added.
* **Initialization**: `specs/` created as an Open Knowledge Format (OKF) v0.2 bundle with this log and `index.md`.
* **Creation**: [Overview](overview.md), [Rules](rules.md) and [Dependencies](dependencies.md) added as drafts.
