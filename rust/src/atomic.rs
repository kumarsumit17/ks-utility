//! Replacing a file atomically.

use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};

/// Replaces `path` with `contents` so that a crash leaves either the old file or the new
/// one, never a mix: writes `<path>.tmp`, syncs it, renames it over `path`, then (on Unix)
/// syncs the folder so the rename itself is durable. The folder must exist. A leftover
/// `<path>.tmp` from an earlier crash is simply overwritten.
///
/// Only `path` is covered: when it describes another file (an index, a map of what is on
/// disk), sync that file yourself before calling this.
///
/// Not safe for two writers of the same `path` at once: both use the same `<path>.tmp`,
/// so their writes can mix or one rename can fail. Callers must make sure only one
/// thread or process writes a given path at a time (for example by holding a lock).
pub fn write_atomic(path: &Path, contents: &[u8]) -> std::io::Result<()> {
    let tmp = temp_path(path);
    {
        let mut f = File::create(&tmp)?;
        f.write_all(contents)?;
        f.sync_all()?;
    }
    fs::rename(&tmp, path)?;
    #[cfg(unix)]
    if let Some(dir) = path.parent().filter(|d| !d.as_os_str().is_empty()) {
        File::open(dir)?.sync_all()?;
    }
    Ok(())
}

/// The temporary file [`write_atomic`] writes before the rename: `<path>.tmp`.
pub fn temp_path(path: &Path) -> PathBuf {
    let mut s = path.as_os_str().to_owned();
    s.push(".tmp");
    PathBuf::from(s)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir() -> PathBuf {
        use std::sync::atomic::{AtomicUsize, Ordering};
        static N: AtomicUsize = AtomicUsize::new(0);
        let dir = std::env::temp_dir()
            .join(format!("ks-utility-atomic-{}-{}", std::process::id(), N.fetch_add(1, Ordering::SeqCst)));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn writes_and_replaces() {
        let dir = temp_dir();
        let file = dir.join("list.json");
        write_atomic(&file, b"one").unwrap();
        assert_eq!(fs::read(&file).unwrap(), b"one");
        write_atomic(&file, b"two, longer").unwrap();
        assert_eq!(fs::read(&file).unwrap(), b"two, longer");
        assert!(!temp_path(&file).exists(), "temp file renamed away");
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn a_leftover_temp_file_does_not_matter() {
        let dir = temp_dir();
        let file = dir.join("list.json");
        write_atomic(&file, b"old").unwrap();
        // A crash between writing the temp file and renaming it leaves the old file intact.
        fs::write(temp_path(&file), b"half wri").unwrap();
        assert_eq!(fs::read(&file).unwrap(), b"old");
        write_atomic(&file, b"new").unwrap();
        assert_eq!(fs::read(&file).unwrap(), b"new");
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn a_missing_folder_is_an_error() {
        let dir = temp_dir();
        assert!(write_atomic(&dir.join("missing/list.json"), b"x").is_err());
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn temp_name_appends_a_suffix() {
        assert_eq!(temp_path(Path::new("/x/a.ksdm")), PathBuf::from("/x/a.ksdm.tmp"));
    }
}
