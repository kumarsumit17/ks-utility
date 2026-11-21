//! The file name in a `Content-Disposition` header value (RFC 6266, RFC 8187), and
//! percent-decoding. The name is returned as sent: make it safe with
//! [`crate::file_name::sanitize_file_name`] before using it on disk.

/// `filename*=UTF-8''name` (RFC 6266/8187) wins over `filename="name"`. `None` when
/// neither is there (or `filename*` uses a charset other than UTF-8 and no `filename`).
pub fn content_disposition_filename(value: &str) -> Option<String> {
    let params: Vec<(String, String)> = value
        .split(';')
        .skip(1)
        .filter_map(|p| p.split_once('='))
        .map(|(k, v)| (k.trim().to_ascii_lowercase(), v.trim().to_owned()))
        .collect();
    let extended = params.iter().find(|(k, _)| k == "filename*").and_then(|(_, v)| {
        let (charset, rest) = v.split_once('\'')?;
        let (_lang, encoded) = rest.split_once('\'')?;
        charset.eq_ignore_ascii_case("utf-8").then(|| percent_decode(encoded))
    });
    extended.or_else(|| {
        params.iter().find(|(k, _)| k == "filename").map(|(_, v)| v.trim_matches('"').to_owned())
    })
}

/// Decodes `%XX` escapes; malformed escapes are kept as they are, and bytes that are not
/// valid UTF-8 after decoding become U+FFFD.
pub fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    let hex = |b: u8| (b as char).to_digit(16).map(|d| d as u8);
    while i < bytes.len() {
        // Work on bytes, not str slices: a multi-byte character after '%' must not panic.
        if bytes[i] == b'%'
            && i + 2 < bytes.len()
            && let (Some(h), Some(l)) = (hex(bytes[i + 1]), hex(bytes[i + 2]))
        {
            out.push(h << 4 | l);
            i += 3;
            continue;
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn disposition_forms() {
        assert_eq!(content_disposition_filename("attachment; filename=\"a b.zip\"").as_deref(), Some("a b.zip"));
        assert_eq!(content_disposition_filename("attachment; filename=plain.txt").as_deref(), Some("plain.txt"));
        assert_eq!(
            content_disposition_filename("attachment; filename=\"x.bin\"; filename*=UTF-8''caf%C3%A9.bin").as_deref(),
            Some("café.bin")
        );
        assert_eq!(content_disposition_filename("inline"), None);
    }

    #[test]
    fn percent_decoding() {
        assert_eq!(percent_decode("a%20b%zz%4"), "a b%zz%4");
        assert_eq!(percent_decode("%é%"), "%é%");
    }
}
