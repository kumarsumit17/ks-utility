---
type: Playbook
title: Translating in Crowdin
description: How the KS-Suite apps get more languages through one Crowdin project, with KS Utility converting the language files on the way in and out, and what the owner sets up once.
tags: [language, translation, crowdin, playbook]
---

# Translating in Crowdin

[Crowdin](https://crowdin.com) is a hosted translation platform: translators (volunteers or paid) translate the English texts in a web editor, with translation memory, a glossary, machine-translation suggestions and QA checks. Open-source projects such as IINA use it ([crowdin.com/project/iina](https://crowdin.com/project/iina)). The suite uses one Crowdin project, **KS-Suite**, for every app, so a text translated once ("Settings", "Cancel") is suggested in every app.

Crowdin is a development tool only, like graphify: no app talks to it, nothing of it is bundled, and KS Utility opens no connection ([rules](rules.md)). The language files in each repository stay the source of truth; Crowdin only receives the English texts and returns translations.

## What KS Utility provides
- **Any number of languages** in the [format](translation-format.md): one file per language code next to `en.json` and `hi.json`, checked like Hindi, partial allowed ([Languages](languages.md#more-languages)).
- **The conversion** Crowdin needs ([format](translation-format.md#crowdin)): `lang.mjs crowdin-export` (plural forms as `key_one`, `key_other`, which Crowdin's "i18next JSON" parser asks every translator for in their own language's forms) and `lang.mjs crowdin-import` (back to the suite format, written only when the check passes).
- **Look-up, plurals and number formats** for every language: TypeScript through `Intl`, Android and Compose through their resources (one `values-…` folder per language), Kotlin through `LanguageRules` (28 languages).
- **The shared catalogue** (`lang/common`) is translated in the same project, so every app gets `common.*` in a new language at once.

## One-time setup (owner)
These steps need the owner's own account and are not done by Claude:
1. Create a Crowdin account and a **public** project named `KS-Suite`, source language English. Ask Crowdin for its free open-source plan (the repositories are public), and check its current terms first.
2. Add the target languages. Hindi is a target too: upload the existing `hi.json` files as translations, and keep Hindi review with the owner ([Hindi style guide](hindi-style.md)); add the Hindi term list (`lang/hindi-terms.json`) to the project glossary.
3. Create a personal access token with access to that project only, and store it in each app repository as the secret `CROWDIN_PERSONAL_TOKEN`, with the project id as the variable `CROWDIN_PROJECT_ID`. Never commit either.

## Each app's files in the project
One folder per repository and language folder, for example `/ks-jaiplayer/shared/en.json`. In each repository a `crowdin.yml` names them:

```yaml
project_id_env: CROWDIN_PROJECT_ID
api_token_env: CROWDIN_PERSONAL_TOKEN
preserve_hierarchy: true
files:
  - source: /build/crowdin/shared/en.json          # written by lang.mjs crowdin-export
    dest: /ks-jaiplayer/shared/en.json
    translation: /build/crowdin/shared/%locale%.json
    type: i18next_json
    skip_untranslated_strings: true
languages_mapping:
  locale:
    fr: fr        # plain language codes, except where a region matters (pt-BR)
    hi: hi
```

This is a starting point: check the paths and the language mapping on the first sync, then keep the file as it works.

## A sync
1. `lang.mjs crowdin-export <dir> --out build/crowdin/<name>/en.json` for each language folder, then `crowdin upload sources`.
2. Translators work in Crowdin.
3. `crowdin download`, then `lang.mjs crowdin-import build/crowdin/<name>/<code>.json --lang <code> --into <dir>` for each language. An import that fails the check writes nothing and lists the problems: fix them in Crowdin.
4. Run the app's tests and commit the new language files to `dev` as `chore: translations from Crowdin`. Never on another branch: the suite has only `dev` and `main` ([release cycle](https://github.com/kumarsumit17/KS-Suite/blob/main/specs/release-cycle.md)), so the Crowdin GitHub integration's own `l10n_…` branch is not used.
5. A new language reaches users in the app's next release, once it is listed in the app's languages (`supported`, `locales_config.xml`).

Doing this in CI (a scheduled workflow with the Crowdin CLI and the two secrets) is the next step, once the project exists and one sync has been run by hand.
