# ks-utility

Common, generic utility functions for the KS-Suite apps. A utility here can be dragged and dropped into any suite app; application-specific logic never goes here.

## Specs
- All specs for this project live in `specs/` in the repository root, as an Open Knowledge Format (OKF) v0.2 bundle. Never create spec files anywhere else. Start at `specs/index.md`.
- One topic per file. Every file except `index.md` and `log.md` starts with YAML frontmatter: `type` (required: `Specification`, `Policy`, `Plan`, `Playbook` or `Reference`), `title`, `description` (one sentence), `tags`.
- When a spec is added: list it in `specs/index.md` with its description. When a spec is added or changed: add a line under today's date (`# YYYY-MM-DD`, newest first) in `specs/log.md`.
- Link between specs with relative markdown links (`[Dependencies](dependencies.md)`), so they also work on GitHub.

## Layout
- `kotlin/`: Kotlin utilities, package `com.ks.utility`. One utility per file or per folder.
- Another language gets its own top-level folder when an app first needs it.
- This is not an app: no release workflow, no signing, no version tags.

## Rules (non-negotiable)
- **Generic only.** A utility belongs here when it is reused across apps and knows nothing about any one of them. Application-specific logic or helpers stay in that app's repository.
- **Drag and drop.** Each utility is self-contained: copying its file (or its one folder) into an app is all it takes to use it. No utility needs setup, configuration or a build step of its own.
- **No third-party dependencies.** A utility uses only the language's standard library (for Kotlin, the Kotlin standard library and, when the utility is Android-specific, the Android SDK).
- **No app knowledge.** No app package names, resources, screens, storage schemas or feature flags. Anything a utility needs from the app comes in as a parameter.
- **Apps still build alone.** Apps take utilities by copying the source in; no app depends on this repository at build time or at run time.
- **No network, no analytics.** A utility never opens a connection or reports anything by itself, so it is safe to copy into `ks-vault` and `ks-expense-manager`.
- **Tested here.** Each utility has unit tests next to it in this repository.
- Before adding a utility, check that at least two apps need it, or that it is plainly generic. If it is only useful to one app, put it in that app.
