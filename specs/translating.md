---
type: Playbook
title: Translation tools
description: How the KS-Suite apps get more languages with KS Utility's own tools, run on this computer with no outside service: the translation editor, plural forms per language, quality checks, translation memory, glossaries, translators' notes, outdated and approved texts, XLIFF and pseudo-localisation.
tags: [language, translation, editor, xliff, glossary, playbook]
---

# Translation tools

KS Utility has its own translation tools, the features of a translation platform such as Crowdin, kept in this repository and run on the owner's computer. Nothing depends on an outside service, an account or a package: the tools are part of `lang.mjs` and need only Node 23.6 or later. The language files in each app's repository stay the only source; the tools read and write them, and write a file only when it passes the [language-file check](translation-format.md#check).

| Feature | Where |
|---|---|
| Side-by-side editor, progress per language, filters, search | `lang.mjs translate` |
| Plural forms per language (Russian `one`, `few`, `many`, `other`; Arabic all six) | the editor, XLIFF, [format](translation-format.md#plural-forms) |
| Placeholder chips, live quality checks | the editor, `qaCheck` |
| Translation memory: the same English (100 %) and similar texts, across apps | the editor, "Fill from memory" |
| Glossary per language, words to avoid | `lang/glossary/<code>.json`, Hindi: `lang/hindi-terms.json` |
| Notes and length limits for translators | `_context.json` in a language folder |
| Outdated when the English changes; approval | `_state.json`, the editor, `status` |
| Files for translators' own tools | `export-xliff`, `import-xliff` |
| Layout test before any translation | `--pseudo` (`en-XA`) |
| Progress report | `lang.mjs status` |

Machine translation is not included: it would need an outside service or a large model.

## The translation editor
```bash
node <ks-utility>/typescript/tools/lang.mjs translate <dir>... [--lang <code>]... [--memory <dir>]... [--port <n>]
```
- `<dir>` are an app's language folders (each with `en.json`); several apps' folders may be opened at once. `--lang` adds a language that has no file yet (`--lang fr`); the editor's "Add language…" does the same. `--memory` adds folders that are only read for translation memory, typically the other apps' folders. In ks-utility itself, `npm run translate` opens the shared catalogue.
- The command prints an address such as `http://127.0.0.1:53817/?t=…`. The editor listens on `127.0.0.1` only, every request must carry the random token from that address, and a request for another host name is refused, so no other computer and no web page can reach it. It stops with Ctrl+C.
- English must pass the check first: the editor translates from `en.json` and never edits it.
- Each English text stands next to its translation. A plural key shows one field per form the language uses. Placeholders are chips that insert themselves; the character count turns red past a length limit. Filters: all, to translate, outdated, with problems, not approved; search covers keys, English and translations.
- Every change is checked as it is typed (below). **Save** (Ctrl+S or ⌘S) writes `<code>.json` and `_state.json` only when the language passes the check; otherwise nothing is written and the problems are listed. Hindi must stay complete to be saved, as the check requires.
- A key can be **approved** (reviewed), an approval undone, and an outdated translation marked **still right** for the new English.

## Quality checks
`qaCheck` gives, for one translation:
- **Errors**, the language-file check's: a placeholder missing, repeated or changed; a plural form the language does not use; digits other than 0-9; a word the glossary says to avoid. A file with an error is not saved.
- **Warnings**, to look at and keep if right for the language: a leading or trailing space English does not have; a double space; end punctuation unlike English's (the Hindi danda `।` counts as a full stop); other numbers than English; a plural form the language uses but the translation leaves out (its `other` form is shown then); longer than the key's `maxLength`; a glossary term in the English whose agreed translation is not used.

## Translation memory
Every English text already translated into the language, in the folders being edited, the `--memory` folders and the shared catalogue, is offered again: the same English as a 100 % match on the row, similar texts (70 % and up, by edit distance) under "Similar…". **Fill from memory** fills every untranslated text that has a 100 % match; the filled texts are unsaved edits to look over, not saved translations.

## Glossaries
- Hindi's glossary is the term list, `lang/hindi-terms.json`, kept equal to the [Hindi style guide](hindi-style.md).
- Another language's glossary is `lang/glossary/<code>.json` in this repository, a list of `{ "en": "download", "text": "téléchargement", "avoid": ["download"], "note": "the noun" }`. Its `avoid` words fail the check in that language; the editor shows the terms found in each English text.
- A glossary is shared by every app; it changes in this repository like any shared text.

## Translators' notes and length limits
A language folder may hold `_context.json`, written by the developer next to `en.json`:
```json
{
  "player.seekBack": "Button on the player's top bar; {count} is a number of seconds",
  "home.openFile": { "note": "Main button on the home screen", "maxLength": 20 }
}
```
A note is shown in the editor and in XLIFF; `maxLength` (characters, without placeholders) gives a warning when a translation is longer, which matters on TV screens. The check fails for a key that is not in `en.json`.

## Outdated and approved texts
`_state.json`, next to the language files, records for each translated key a short hash of the English it was translated from, and whether it is approved. The editor and the XLIFF import keep it; it is committed with the language files.
- When the English of a key changes, its translations become **outdated**: shown in the editor's "Outdated" filter and counted by `status`, until edited, marked still right, or approved. An outdated translation is still shown to users: it is not an error.
- A translation written by hand, or from before the state existed, counts as translated from the current English.

## XLIFF
For a translator who works in their own tool:
```bash
node <ks-utility>/typescript/tools/lang.mjs export-xliff <dir> --lang fr --out fr.xlf [--all]
node <ks-utility>/typescript/tools/lang.mjs import-xliff fr.xlf --lang fr --into <dir>
```
The export holds the keys still to translate and the outdated ones (with their old translation as the target), or every key with `--all`, with the notes. The import merges the translated units into `<dir>/fr.json` and records them in `_state.json`, only when the result passes the check, and refuses a file for another language ([format](translation-format.md#xliff)).

## Pseudo-localisation
`lang.mjs android … --pseudo` (and `compose … --pseudo`) also writes the pseudo-locale `en-XA` (`values-en-rXA`): every English text accented, about 40 % longer and in brackets, `[Šéţţíñĝš one two]`, placeholders kept. On a debug build, choosing "English (XA)" in the system's languages shows text that is clipped (no closing bracket), text that is not in the language files (no accents) and text built from pieces. Ship only the real languages: `--pseudo` is for test builds.

## Progress
```bash
node <ks-utility>/typescript/tools/lang.mjs status <dir>...
```
prints, for the shared catalogue and each folder, every language's translated keys, those still to translate, outdated and approved.

## Adding a language to an app
1. `translate <dir> --lang <code>` (with `--memory` for the other apps), translate, save; or send `export-xliff` to a translator and `import-xliff` the result.
2. Run the app's tests (the language-file check) and test the screens, on TV at every size for a TV app.
3. Add the code to the app's languages (`supported` in TypeScript, `locales_config.xml` on Android) when the owner decides the language is good enough, and commit to `dev`.
