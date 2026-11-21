# 2026-11-21

* **Update**: [Utilities](utilities.md): `parse_http_date` accepts only years 1970..=9999 and `parse_retry_after` returns `None` on overflow; `reserve_free_name` rejects anything but a single file name with `InvalidInput`; `gaps` clips every gap to `[0, size)`.
* **Update**: [Utilities](utilities.md): file names lose invisible format characters, reserved Windows names are matched before the first dot, `Content-Disposition` quoted values may hold `;`, `=` and escapes, `Range::len` saturates, and `write_atomic` documents that it allows one writer per path.
* **Creation**: [Utilities](utilities.md) added. Rust: HTTP-date and `Retry-After`, backoff with full jitter (jitter-only random source), `Content-Range`, `Content-Disposition` file name and percent-decoding, byte-range set, atomic file write, file-name sanitising and free-name reservation. TypeScript: byte, speed and time-left formatting. Moved from `ks-download-manager`.
* **Creation**: [How apps depend on KS Utility](usage.md) added: git submodule and Gradle included build for the Kotlin apps, npm and Cargo git dependencies for `ks-download-manager`.
* **Update**: [Rules](rules.md), [Overview](overview.md) and [Dependencies](dependencies.md): apps now take KS Utility as a pinned dependency instead of copying files; Kotlin, TypeScript and Rust parts added.
* **Initialization**: `specs/` created as an Open Knowledge Format (OKF) v0.2 bundle with this log and `index.md`.
* **Creation**: [Overview](overview.md), [Rules](rules.md) and [Dependencies](dependencies.md) added as drafts.
