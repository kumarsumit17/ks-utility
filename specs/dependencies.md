---
type: Policy
title: Dependencies
description: Utilities use only the standard library; no third-party dependencies.
tags: [dependencies, policy]
---

# Dependencies

- A utility uses only the language's standard library. For Kotlin that is the Kotlin standard library and, when the utility is Android-specific, the Android SDK.
- No third-party libraries. If a utility cannot be written without one, it does not belong here; it goes into the app that needs it, under that app's own dependency rules.
- Never hand-write TLS, cryptography or other security-critical code as a utility. Apps use a maintained library for those.
- No analytics, crash-reporting or ad SDKs, ever.
