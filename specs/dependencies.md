---
type: Policy
title: Dependencies
description: Utilities use only the standard library; no third-party dependencies.
tags: [dependencies, policy]
---

# Dependencies

- A utility uses only its language's standard library: the Kotlin standard library (no Android SDK), the Rust standard library, and the JavaScript language and web-standard APIs for TypeScript.
- No third-party libraries. `rust/Cargo.toml` has no `[dependencies]` and `package.json` has no `dependencies`. If a utility cannot be written without one, it does not belong here; it goes into the app that needs it, under that app's own dependency rules.
- Tests use only what ships with the toolchain: `kotlin("test")`, `cargo test`, and Node's built-in test runner.
- Never hand-write TLS, cryptography or other security-critical code as a utility. Apps use a maintained library for those.
- No analytics, crash-reporting or ad SDKs, ever.
