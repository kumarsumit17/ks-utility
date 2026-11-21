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

#![forbid(unsafe_code)]

pub mod atomic;
pub mod backoff;
pub mod content_disposition;
pub mod content_range;
pub mod file_name;
pub mod http_date;
pub mod ranges;
