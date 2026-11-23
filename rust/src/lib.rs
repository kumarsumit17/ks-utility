//! KS Utility (Rust): generic utilities only. Nothing here may know about any one app.
//!
//! Standard library only, no `unsafe`. Each module is self-contained:
//! - [`http_date`]: HTTP-date and `Retry-After` parsing (RFC 9110).
//! - [`backoff`]: exponential backoff with full jitter, and its jitter-only random source.
//! - [`content_range`]: `Content-Range` parsing (RFC 9110).
//! - [`content_disposition`]: the file name in `Content-Disposition` (RFC 6266/8187), and
//!   percent-decoding.
//! - [`ranges`]: half-open byte ranges and a merging range set.
//! - [`atomic`]: replace a file atomically (temp file, sync, rename).
//! - [`file_name`]: safe file names, "name (n).ext" numbering, and reserving a free name.
//! - [`media_type`]: file extensions for media types (`Content-Type`).
//! - [`message`]: message codes with parameters, so Rust never builds display sentences.
//! - [`token_bucket`]: token-bucket arithmetic for rate limits.
//! - [`app_update`]: is a newer version of the app out, and which file installs it (no network).
//! - [`sha256`]: SHA-256, to check a download against its published checksum.

#![forbid(unsafe_code)]

pub mod app_update;
pub mod atomic;
pub mod backoff;
pub mod content_disposition;
pub mod content_range;
pub mod file_name;
pub mod http_date;
pub mod media_type;
pub mod message;
pub mod ranges;
pub mod sha256;
pub mod token_bucket;
