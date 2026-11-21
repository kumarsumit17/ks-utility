//! `Content-Range` (RFC 9110, section 14.4).

/// A parsed `Content-Range` header value.
#[derive(Debug, PartialEq, Eq)]
pub enum ContentRange {
    /// `bytes first-last/complete`; complete may be unknown (`*`).
    Bytes { first: u64, last: u64, complete: Option<u64> },
    /// `bytes */complete`, sent with 416.
    Unsatisfied { complete: u64 },
}

/// `None` for anything that is not a valid byte range (`last < first`, `last` past the
/// complete length, another unit, bad numbers).
pub fn parse_content_range(value: &str) -> Option<ContentRange> {
    let rest = value.trim().strip_prefix("bytes")?.trim_start();
    let (range, complete) = rest.split_once('/')?;
    let complete = complete.trim();
    if range.trim() == "*" {
        return Some(ContentRange::Unsatisfied { complete: complete.parse().ok()? });
    }
    let (first, last) = range.trim().split_once('-')?;
    let first: u64 = first.trim().parse().ok()?;
    let last: u64 = last.trim().parse().ok()?;
    if last < first {
        return None;
    }
    let complete = if complete == "*" { None } else { Some(complete.parse().ok()?) };
    if complete.is_some_and(|c| last >= c) {
        return None;
    }
    Some(ContentRange::Bytes { first, last, complete })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn content_range_forms() {
        assert_eq!(
            parse_content_range("bytes 0-0/1234"),
            Some(ContentRange::Bytes { first: 0, last: 0, complete: Some(1234) })
        );
        assert_eq!(
            parse_content_range("bytes 10-19/*"),
            Some(ContentRange::Bytes { first: 10, last: 19, complete: None })
        );
        assert_eq!(parse_content_range("bytes */0"), Some(ContentRange::Unsatisfied { complete: 0 }));
        assert_eq!(parse_content_range("bytes 5-4/10"), None);
        assert_eq!(parse_content_range("bytes 0-10/10"), None);
        assert_eq!(parse_content_range("items 0-1/2"), None);
        assert_eq!(parse_content_range("bytes abc"), None);
    }
}
