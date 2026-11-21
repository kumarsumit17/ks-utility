//! The file name in a `Content-Disposition` header value (RFC 6266, RFC 8187), and
//! percent-decoding. The name is returned as sent: make it safe with
//! [`crate::file_name::sanitize_file_name`] before using it on disk.

/// `filename*=UTF-8''name` (RFC 6266/8187) wins over `filename="name"`. `None` when
/// neither is there (or `filename*` uses a charset other than UTF-8 and no `filename`).
/// Quoted values may contain ";" and "=", and `\"` / `\\` escapes (RFC 9110 quoted-string).
pub fn content_disposition_filename(value: &str) -> Option<String> {
    let params = parameters(value);
    let extended = params.iter().find(|(k, _)| k == "filename*").and_then(|(_, v)| {
        let (charset, rest) = v.split_once('\'')?;
        let (_lang, encoded) = rest.split_once('\'')?;
        charset.eq_ignore_ascii_case("utf-8").then(|| percent_decode(encoded))
    });
    extended.or_else(|| params.into_iter().find(|(k, _)| k == "filename").map(|(_, v)| v))
}

/// The `name=value` parameters after the disposition type, names in lower case. A value
/// is a token (up to the next ";") or a quoted string, whose quotes are removed and whose
/// backslash escapes are resolved.
fn parameters(value: &str) -> Vec<(String, String)> {
    let mut out = Vec::new();
    // The disposition type ("attachment", "inline") is a token: it holds no quotes.
    let Some((_, mut rest)) = value.split_once(';') else { return out };
    loop {
        rest = rest.trim_start_matches([' ', '\t', ';']);
        if rest.is_empty() {
            return out;
        }
        let name_end = rest.find(['=', ';']).unwrap_or(rest.len());
        let name = rest[..name_end].trim().to_ascii_lowercase();
        rest = &rest[name_end..];
        let Some(after_eq) = rest.strip_prefix('=') else { continue }; // no value: skip it
        let after_eq = after_eq.trim_start_matches([' ', '\t']);
        let (value, remaining) = match after_eq.strip_prefix('"') {
            Some(quoted) => quoted_string(quoted),
            None => {
                let end = after_eq.find(';').unwrap_or(after_eq.len());
                (after_eq[..end].trim().to_owned(), &after_eq[end..])
            }
        };
        out.push((name, value));
        // Anything after a closing quote up to the next ";" is not part of the value.
        rest = remaining.find(';').map_or("", |i| &remaining[i..]);
    }
}

/// Reads a quoted string whose opening quote is already consumed: returns its content
/// and what follows the closing quote. An unterminated string runs to the end.
fn quoted_string(s: &str) -> (String, &str) {
    let mut out = String::new();
    let mut chars = s.char_indices();
    while let Some((i, c)) = chars.next() {
        match c {
            '\\' => match chars.next() {
                Some((_, escaped)) => out.push(escaped),
                None => break,
            },
            '"' => return (out, &s[i + 1..]),
            c => out.push(c),
        }
    }
    (out, "")
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
    fn quoted_values_may_hold_separators_and_escapes() {
        let f = content_disposition_filename;
        assert_eq!(f("attachment; filename=\"a;b=c.zip\"").as_deref(), Some("a;b=c.zip"));
        assert_eq!(f("attachment; filename=\"say \\\"hi\\\".txt\"").as_deref(), Some("say \"hi\".txt"));
        assert_eq!(f("attachment; filename=\"back\\\\slash.txt\"").as_deref(), Some("back\\slash.txt"));
        // A ";" inside quotes does not start a new parameter.
        assert_eq!(f("attachment; filename=\"x; filename*=UTF-8''evil.exe\"").as_deref(), Some("x; filename*=UTF-8''evil.exe"));
        assert_eq!(f("attachment; size=10; filename=\"r.pdf\"; creation-date=\"Wed, 12 Feb 1997\"").as_deref(), Some("r.pdf"));
        assert_eq!(f("attachment; FILENAME = \"spaced.txt\" ").as_deref(), Some("spaced.txt"));
        assert_eq!(f("attachment; filename=\"unterminated.txt").as_deref(), Some("unterminated.txt"));
        assert_eq!(f("attachment; novalue; filename=ok.bin").as_deref(), Some("ok.bin"));
        assert_eq!(f("attachment; filename*=UTF-8''a%3Bb.txt; filename=\"fallback\"").as_deref(), Some("a;b.txt"));
        assert_eq!(f("attachment;"), None);
    }

    #[test]
    fn percent_decoding() {
        assert_eq!(percent_decode("a%20b%zz%4"), "a b%zz%4");
        assert_eq!(percent_decode("%é%"), "%é%");
    }
}
