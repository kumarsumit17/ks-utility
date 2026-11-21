# ks-utility

Common, generic utility functions for the KS-Suite apps. Part of KS-Suite; the suite-wide rules in the workspace `CLAUDE.md` apply. Every app takes this repository as a dependency; application-specific logic never goes here.

## Specs
- All specs for this project live in `specs/` in the repository root, as an Open Knowledge Format (OKF) v0.2 bundle. Never create spec files anywhere else. Start at `specs/index.md`.
- One topic per file. Every file except `index.md` and `log.md` starts with YAML frontmatter: `type` (required: `Specification`, `Policy`, `Plan`, `Playbook` or `Reference`), `title`, `description` (one sentence), `tags`.
- When a spec is added: list it in `specs/index.md` with its description. When a spec is added or changed: add a line under today's date (`# YYYY-MM-DD`, newest first) in `specs/log.md`.
- Link between specs with relative markdown links (`[Dependencies](dependencies.md)`), so they also work on GitHub.

## Layout
- `kotlin/`: Gradle build of a plain Kotlin/JVM library (`com.ks:utility`, package `com.ks.utility`, no Android SDK). Kotlin version in `kotlin/gradle/libs.versions.toml`, kept in step with the apps.
- `typescript/`: TypeScript source, exported from `typescript/src/index.ts` through the root `package.json`.
- `rust/`: crate `ks-utility`, no dependencies.
- This is not an app: no release workflow and no signing. Releases are version tags (`vMAJOR.MINOR.PATCH`, rules in `specs/usage.md`); the `0.0.0` in `package.json` and `rust/Cargo.toml` is a placeholder.

## Rules (non-negotiable)
- **Generic only.** A utility belongs here when it is reused across apps and knows nothing about any one of them. Application-specific logic or helpers stay in that app's repository.
- **Drop-in.** Each utility is self-contained: once an app has `ks-utility` as a dependency, a utility is used by importing it. No utility needs setup or configuration of its own.
- **No third-party dependencies.** A utility uses only its language's standard library. The Kotlin part is plain Kotlin/JVM with no Android SDK, so Android, TV and desktop apps can all use it.
- **No app knowledge.** No app package names, resources, screens, storage schemas or feature flags. Anything a utility needs from the app comes in as a parameter.
- **Pinned by version tag.** Every app pins a `ks-utility` version tag; a pushed tag is never moved or deleted (see "How apps depend on it"). A change here reaches an app only when that app moves its pin, so apps still build and ship alone.
- **No breaking changes in place.** Apps move their pins at different times: add a new function instead of changing the meaning or signature of one that is in use.
- **No network, no analytics.** A utility never opens a connection or reports anything by itself, so it is safe for `ks-vault` and `ks-expense-manager`.
- **Tested here.** Each utility has unit tests in this repository, in the same commit.
- Before adding a utility, check that at least two apps need it, or that it is plainly generic. If it is only useful to one app, put it in that app.

## How apps depend on it
- Kotlin apps: git submodule at `ks-utility/` plus `includeBuild("ks-utility/kotlin")`. `ks-download-manager`: git dependencies in `package.json` and `src-tauri/Cargo.toml`. Details: `specs/usage.md`.
- Changing this is a cross-repo change: update the suite's `specs/cross-repo.md` and each app's `CLAUDE.md`.

## Commands
```bash
cargo test --manifest-path rust/Cargo.toml     # Rust
npm test                                       # TypeScript (Node's built-in test runner)
./gradlew -p ks-utility/kotlin test            # Kotlin, from a Kotlin app that has this repo as a submodule
```

## Working efficiently (keep token use low)
- Use the knowledge graph first: follow the rules in the `graphify` section at the end of this file. [graphify](https://github.com/Graphify-Labs/graphify) is a development tool only; it is never a dependency of the code and is never bundled or shipped.
- One-time setup on a new machine (owner): `uv tool install graphifyy` (the package name has two y's), then `/graphify .` in Claude Code. The setup in `.claude/` is committed; `graphify-out/` is generated and git-ignored.
- Read only the specs the task needs, and do not re-read a file that has not changed in this session.
- Never read generated files: `build/`, `.gradle/`, `target/`, `node_modules/`, `graphify-out/graph.json`.
- Keep command output short (show only failures), and keep summaries brief.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. When the answer is under a Markdown heading, `graphify section "<heading>"` prints that section's text, so the .md need not be opened. These return a scoped subgraph, usually much smaller than GRAPH_REPORT
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- `graphify-out/` is generated and git-ignored: never commit it.
