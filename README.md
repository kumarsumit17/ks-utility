# KS Utility

> Part of the [KS-Suite](https://github.com/kumarsumit17/KS-Suite).

Common utility functions shared across the KS-Suite apps. Everything here is generic: any suite app, today's or a later one, can take it as a dependency and use it as it is. Application-specific logic does not belong in this repository.

| | |
|---|---|
| **Used by** | Every KS-Suite app, as a dependency pinned to a version tag |
| **Languages** | Kotlin (`kotlin/`) · TypeScript (`typescript/`) · Rust (`rust/`) |
| **Status** | In use: helpers for HTTP, ranges, file names, formatting, rate limits, and English and Hindi for every app |
| **Languages offered by every app** | English and Hindi, through this repository ([specs/languages.md](specs/languages.md)) |

## What belongs here

- Code that is reused across apps and knows nothing about any one of them
- Self-contained utilities that need only their language's standard library

What does not: anything tied to one app's features, screens, data or package. That stays in the app's own repository. The full rules are in [specs/rules.md](specs/rules.md).

## How apps depend on it

| App | Mechanism | Declared in |
|---|---|---|
| Kotlin apps (`ks-tv-launcher`, `ks-jaiplayer`, `ks-streamflix`, `ks-vault`, `ks-expense-manager`) | This repository as a git submodule at `ks-utility/`, included as a Gradle build | `.gitmodules`; `includeBuild("ks-utility/kotlin")` in `settings.gradle.kts`; `ks-utility = { module = "com.ks:utility" }` in `gradle/libs.versions.toml` |
| `ks-download-manager` (interface) | npm git dependency | `"ks-utility": "git+https://github.com/kumarsumit17/ks-utility.git#<tag>"` in `package.json` |
| `ks-download-manager` (engine) | Cargo git dependency | `ks-utility = { git = "https://github.com/kumarsumit17/ks-utility", tag = "<tag>" }` in `src-tauri/Cargo.toml` |

Details and the steps to move an app to a newer tag, and the versioning rules: [specs/usage.md](specs/usage.md).

## Tests

```bash
cargo test --manifest-path rust/Cargo.toml     # Rust
npm test                                       # TypeScript (Node's built-in test runner), incl. the language tools
npm run check:lang                             # the shared catalogue and term list
./gradlew -p ks-utility/kotlin test            # Kotlin, run from a Kotlin app that has this repo as a submodule
```

## License

MIT. See [LICENSE](LICENSE).
