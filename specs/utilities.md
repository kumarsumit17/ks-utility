---
type: Reference
title: Utilities
description: The utilities KS Utility provides in each language, and what each one is for.
tags: [reference, rust, typescript]
---

# Utilities

## Rust (`rust/`, crate `ks-utility`)
Standard library only, `#![forbid(unsafe_code)]`.

| Module | What it does |
|---|---|
| `http_date` | `parse_http_date` (the three HTTP-date forms of RFC 9110; years 1970..=9999 only, otherwise `None`, so a server's date never panics or overflows) and `parse_retry_after` (seconds or a date; a past date is zero; `None` on overflow). |
| `backoff` | `full_jitter`: exponential backoff with full jitter. `jitter_random_below`: its random source, **for jitter only**; never for tokens, IDs, keys or anything security-related. |
| `content_range` | `parse_content_range`: `bytes a-b/c`, `bytes a-b/*`, `bytes */c`. |
| `content_disposition` | `content_disposition_filename` (`filename*` over `filename`, RFC 6266/8187; quoted values may hold `;`, `=` and backslash escapes) and `percent_decode`. The name is returned as sent; sanitise it before use. |
| `ranges` | `Range` (half-open, `len` never underflows), `RangeSet` (sorted, merging insert, gaps, bytes covered) and `gaps` (every gap lies inside `[0, size)`, even when covered ranges reach past `size`). |
| `atomic` | `write_atomic`: temp file, sync, rename, sync folder. Covers only the file it writes; not safe for two writers of the same path at once. |
| `file_name` | `sanitize_file_name` (also strips bidirectional and other invisible format characters; reserved Windows names matched before the first dot), `split_extension`, `numbered_name` ("name (n).ext"), `reserve_free_name` (creates the first free name with `create_new`; never overwrites; `name` must be a single file name, otherwise `InvalidInput` and nothing is created, so sanitise untrusted names first). |

## TypeScript (`typescript/src/`)

| Export | What it does |
|---|---|
| `formatBytes`, `formatSpeed`, `formatTimeLeft` | Human-readable sizes (binary units), speeds and durations. |
