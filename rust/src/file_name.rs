//! Safe file names, "name (n).ext" numbering, and reserving a free name in a folder.

use std::fs::OpenOptions;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

/// Longest file name [`sanitize_file_name`] and [`numbered_name`] return, in bytes (most
/// file systems allow 255).
pub const MAX_NAME: usize = 200;
/// [`reserve_free_name`] gives up after "name (9999)".
pub const MAX_SUFFIX: u32 = 9_999;

/// Makes a server- or user-supplied name safe to use as one file name inside a folder:
/// no path separators or drive letters, no control characters, no invisible format
/// characters (bidirectional overrides and isolates, which can make "evil\u{202E}gpj.exe"
/// look like "evilexe.jpg", and zero-width or byte-order marks), no characters Windows
/// forbids, no "." / ".." or leading dots (hidden files), no trailing dots or spaces, no
/// reserved Windows device names (matched on the part before the first dot, as Windows
/// does: "CON.tar.gz" is reserved), and at most [`MAX_NAME`] bytes (extension kept).
/// An empty result becomes "download".
pub fn sanitize_file_name(raw: &str) -> String {
    let mut name: String = raw
        .chars()
        .filter(|&c| !is_invisible_format(c))
        .map(|c| match c {
            '/' | '\\' | ':' | '<' | '>' | '"' | '|' | '?' | '*' => '_',
            c if c.is_control() => '_',
            c => c,
        })
        .collect();
    name = name.trim().trim_start_matches('.').trim_end_matches(['.', ' ']).to_owned();
    // With separators gone a ".." can no longer climb out of the folder; drop it anyway,
    // so no name ever looks like a path step.
    while name.contains("..") {
        name = name.replace("..", ".");
    }
    if name.is_empty() {
        name = "download".to_owned();
    }
    // Windows treats "CON.txt", "CON.tar.gz" and "CON .txt" all as the device CON.
    let stem = name.split('.').next().unwrap_or("").trim_end().to_ascii_uppercase();
    let reserved = matches!(stem.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        || ((stem.starts_with("COM") || stem.starts_with("LPT"))
            && stem.len() == 4
            && stem.as_bytes()[3].is_ascii_digit());
    if reserved {
        name.insert(0, '_');
    }
    truncate(&name, MAX_NAME)
}

/// Format characters that change how text is displayed without being visible: the
/// bidirectional marks, embeddings, overrides and isolates, the Arabic letter mark, the
/// Mongolian vowel separator, zero-width space, word joiner and invisible operators, and
/// the byte-order mark. Zero-width (non-)joiners (U+200C, U+200D) are kept: some scripts
/// and emoji need them, and they cannot reorder text.
fn is_invisible_format(c: char) -> bool {
    matches!(c,
        '\u{061C}' | '\u{180E}' | '\u{200B}' | '\u{200E}' | '\u{200F}'
        | '\u{202A}'..='\u{202E}'
        | '\u{2060}'..='\u{2064}'
        | '\u{2066}'..='\u{2069}'
        | '\u{FEFF}')
}

/// Shortens `name` to at most `max` bytes, keeping the extension and whole characters.
fn truncate(name: &str, max: usize) -> String {
    if name.len() <= max {
        return name.to_owned();
    }
    let (stem, ext) = split_extension(name);
    let ext = if ext.len() < max / 2 { ext } else { "" };
    let mut end = max - ext.len();
    while !stem.is_char_boundary(end) {
        end -= 1;
    }
    format!("{}{ext}", &stem[..end])
}

/// "movie.mp4" → ("movie", ".mp4"); "README" → ("README", ""); ".profile" → (".profile", "").
pub fn split_extension(name: &str) -> (&str, &str) {
    match name.rfind('.') {
        Some(i) if i > 0 => name.split_at(i),
        _ => (name, ""),
    }
}

/// The n-th alternative name: "movie.mp4", 2 → "movie (2).mp4", at most [`MAX_NAME`] bytes.
pub fn numbered_name(name: &str, n: u32) -> String {
    let (stem, ext) = split_extension(name);
    let suffix = format!(" ({n})");
    let stem = truncate(stem, MAX_NAME.saturating_sub(suffix.len() + ext.len()));
    format!("{stem}{suffix}{ext}")
}

/// Picks the first of `name`, `name (1)`, `name (2)`, … in `folder` that does not exist
/// and for which `skip` is false, and creates it as an empty file (`create_new`), so no
/// one else can take it before the caller writes it. Never overwrites a file. `skip`
/// lets the caller rule out names it knows are in use (for example by work in progress).
pub fn reserve_free_name(folder: &Path, name: &str, skip: &dyn Fn(&Path) -> bool) -> std::io::Result<PathBuf> {
    for n in 0..=MAX_SUFFIX {
        let candidate = folder.join(if n == 0 { name.to_owned() } else { numbered_name(name, n) });
        if skip(&candidate) {
            continue;
        }
        match OpenOptions::new().write(true).create_new(true).open(&candidate) {
            Ok(_) => return Ok(candidate),
            Err(e) if e.kind() == ErrorKind::AlreadyExists => continue,
            Err(e) => return Err(e),
        }
    }
    Err(std::io::Error::new(ErrorKind::AlreadyExists, "no free file name left"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir() -> PathBuf {
        use std::sync::atomic::{AtomicUsize, Ordering};
        static N: AtomicUsize = AtomicUsize::new(0);
        let dir = std::env::temp_dir()
            .join(format!("ks-utility-names-{}-{}", std::process::id(), N.fetch_add(1, Ordering::SeqCst)));
        std::fs::create_dir_all(&dir).unwrap();
        dir.canonicalize().unwrap()
    }

    #[test]
    fn names_lose_separators_and_dot_steps() {
        assert_eq!(sanitize_file_name("../../etc/passwd"), "_._etc_passwd");
        assert_eq!(sanitize_file_name("..\\..\\boot.ini"), "_._boot.ini");
        assert_eq!(sanitize_file_name("C:\\Windows\\x.exe"), "C__Windows_x.exe");
        assert_eq!(sanitize_file_name(".."), "download");
        assert_eq!(sanitize_file_name("."), "download");
        assert_eq!(sanitize_file_name("   "), "download");
        assert_eq!(sanitize_file_name(".hidden"), "hidden");
        assert_eq!(sanitize_file_name("a..b.txt"), "a.b.txt");
        assert_eq!(sanitize_file_name("report.pdf. . "), "report.pdf");
        assert_eq!(sanitize_file_name("bad\u{0}name\n.txt"), "bad_name_.txt");
        assert_eq!(sanitize_file_name("what?<>|*\".zip"), "what______.zip");
        assert_eq!(sanitize_file_name("CON.txt"), "_CON.txt");
        assert_eq!(sanitize_file_name("com1"), "_com1");
        assert_eq!(sanitize_file_name("console.log"), "console.log");
        assert_eq!(sanitize_file_name("holiday 2026.mp4"), "holiday 2026.mp4");
        for raw in ["../x", "a/../b", "..", "/abs/path", "x\\..\\y"] {
            let n = sanitize_file_name(raw);
            assert!(!n.contains('/') && !n.contains('\\') && !n.contains(".."), "{raw} -> {n}");
        }
    }

    #[test]
    fn invisible_format_characters_cannot_hide_the_extension() {
        // Right-to-left override: displays as "invoice_exe.pdf"-like text but is an .exe.
        assert_eq!(sanitize_file_name("invoice\u{202E}fdp.exe"), "invoicefdp.exe");
        for c in ['\u{200E}', '\u{200F}', '\u{202A}', '\u{202B}', '\u{202C}', '\u{202D}', '\u{202E}', '\u{2066}', '\u{2067}', '\u{2068}', '\u{2069}', '\u{FEFF}', '\u{200B}', '\u{061C}'] {
            assert_eq!(sanitize_file_name(&format!("a{c}b.txt")), "ab.txt", "U+{:04X}", c as u32);
        }
        assert_eq!(sanitize_file_name("\u{FEFF}report.pdf"), "report.pdf", "byte-order mark at the start");
        assert_eq!(sanitize_file_name("\u{202E}\u{2066}"), "download", "nothing visible left");
        // Joiners that scripts and emoji need are kept.
        assert_eq!(sanitize_file_name("\u{1F468}\u{200D}\u{1F4BB}.png"), "\u{1F468}\u{200D}\u{1F4BB}.png");
        assert_eq!(sanitize_file_name("می\u{200C}خواهم.txt"), "می\u{200C}خواهم.txt");
    }

    #[test]
    fn reserved_names_are_matched_before_the_first_dot() {
        assert_eq!(sanitize_file_name("CON.tar.gz"), "_CON.tar.gz");
        assert_eq!(sanitize_file_name("nul.txt.bak"), "_nul.txt.bak");
        assert_eq!(sanitize_file_name("LPT9.x.y"), "_LPT9.x.y");
        assert_eq!(sanitize_file_name("con .txt"), "_con .txt");
        assert_eq!(sanitize_file_name("aux"), "_aux");
        assert_eq!(sanitize_file_name("CONSOLE.tar.gz"), "CONSOLE.tar.gz");
        assert_eq!(sanitize_file_name("COM10.txt"), "COM10.txt");
        assert_eq!(sanitize_file_name("data.CON"), "data.CON");
    }

    #[test]
    fn long_names_keep_their_extension() {
        let long = format!("{}.mp4", "é".repeat(300));
        let n = sanitize_file_name(&long);
        assert!(n.len() <= MAX_NAME, "{}", n.len());
        assert!(n.ends_with(".mp4"));
        let numbered = numbered_name(&n, 12);
        assert!(numbered.len() <= MAX_NAME && numbered.ends_with(" (12).mp4"));
    }

    #[test]
    fn extensions() {
        assert_eq!(split_extension("movie.mp4"), ("movie", ".mp4"));
        assert_eq!(split_extension("a.tar.gz"), ("a.tar", ".gz"));
        assert_eq!(split_extension("README"), ("README", ""));
        assert_eq!(split_extension(".profile"), (".profile", ""));
        assert_eq!(numbered_name("README", 1), "README (1)");
    }

    #[test]
    fn reserve_never_overwrites() {
        let dir = temp_dir();
        let none = |_: &Path| false;
        std::fs::write(dir.join("movie.mp4"), b"keep me").unwrap();
        let a = reserve_free_name(&dir, "movie.mp4", &none).unwrap();
        assert_eq!(a, dir.join("movie (1).mp4"));
        assert_eq!(std::fs::read(dir.join("movie.mp4")).unwrap(), b"keep me");
        assert!(a.exists(), "the name is held by an empty file");
        let b = reserve_free_name(&dir, "movie.mp4", &none).unwrap();
        assert_eq!(b, dir.join("movie (2).mp4"));
        // Names the caller rules out are skipped.
        let skip = |p: &Path| p == dir.join("README") || p == dir.join("README (1)");
        assert_eq!(reserve_free_name(&dir, "README", &skip).unwrap(), dir.join("README (2)"));
        assert!(!dir.join("README").exists());
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
