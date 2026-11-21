# KS Utility

> Part of the [KS-Suite](https://github.com/kumarsumit17/KS-Suite).

Common utility functions shared across the KS-Suite apps. Everything here is generic: a utility can be dragged and dropped into any suite app, today's or a later one, and used as it is. Application-specific logic does not belong in this repository.

| | |
|---|---|
| **Used by** | Any KS-Suite app |
| **Language** | Kotlin (`kotlin/`); another language gets its own top-level folder when an app first needs it |
| **Status** | Planned: the repository holds the structure and its rules, with utilities still to come |

## What belongs here

- Code that is reused across apps and knows nothing about any one of them
- Self-contained utilities that need only the language's standard library

What does not: anything tied to one app's features, screens, data or package. That stays in the app's own repository. The full rules are in [specs/rules.md](specs/rules.md).

## Using a utility

Copy the utility's file (or its folder) from `kotlin/` into the app. There is nothing to configure, and the app keeps building and shipping alone.

## License

MIT. See [LICENSE](LICENSE).
