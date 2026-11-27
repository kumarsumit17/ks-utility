//! Opens a downloaded desktop update and quits the app so it can be replaced
//! (specs/app-update.md, "How each platform installs"). Nothing is installed silently: the
//! system's installer or Finder does the rest, with the person watching.
//!
//! - **Windows:** marks the installer as downloaded from the internet (`Zone.Identifier`, zone 3,
//!   so SmartScreen checks it), starts it (`msiexec /i` for an `.msi`), and returns
//!   [`Opened::Windows`]: the app calls its own clean-up and quits at once.
//! - **macOS:** quarantines the disk image as a browser download would (so Gatekeeper checks it),
//!   opens it, and returns [`Opened::Mac`]: the app shows `common.appUpdate.openedMacCloses`, then
//!   after [`MAC_QUIT_AFTER`] calls its clean-up and quits, because Finder cannot replace a running
//!   app. The quitting is the app's (Tauri's `app.exit`), so it can save first.

use std::io;
use std::path::Path;
use std::process::Command;
use std::time::Duration;

/// How long the Mac app shows that it now closes before it quits.
pub const MAC_QUIT_AFTER: Duration = Duration::from_secs(6);

/// The internet zone mark of a Windows download.
pub const ZONE_IDENTIFIER: &str = "[ZoneTransfer]\r\nZoneId=3\r\n";

/// What was opened, so the app knows what to show and when to quit.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Opened {
    /// The disk image is open: show `openedMacCloses`, quit after [`MAC_QUIT_AFTER`].
    Mac,
    /// The installer is starting: quit now.
    Windows,
}

/// The `com.apple.quarantine` value of a download: flags 0081, no time, the app as the downloader.
pub fn quarantine_value(app_name: &str) -> String {
    format!("0081;00000000;{};", app_name.replace(';', " "))
}

/// The command that starts a Windows installer.
pub fn windows_command(file: &Path) -> Vec<String> {
    let path = file.to_string_lossy().into_owned();
    if has_extension(file, "msi") {
        vec!["msiexec".into(), "/i".into(), path]
    } else {
        vec![path]
    }
}

fn has_extension(file: &Path, ext: &str) -> bool {
    file.extension().and_then(|e| e.to_str()).is_some_and(|e| e.eq_ignore_ascii_case(ext))
}

fn invalid(msg: String) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidInput, msg)
}

/// The steps [`open`] takes on `os` (`"macos"` or `"windows"`, as `std::env::consts::OS`), for
/// tests and for [`open`] itself. An error for another system or file.
pub fn plan(file: &Path, app_name: &str, os: &str) -> io::Result<Vec<Vec<String>>> {
    let path = file.to_string_lossy().into_owned();
    match os {
        "windows" if has_extension(file, "msi") || has_extension(file, "exe") => Ok(vec![windows_command(file)]),
        "windows" => Err(invalid(format!("not a Windows installer: {path}"))),
        "macos" if has_extension(file, "dmg") => Ok(vec![
            vec!["xattr".into(), "-w".into(), "com.apple.quarantine".into(), quarantine_value(app_name), path.clone()],
            vec!["open".into(), path],
        ]),
        "macos" => Err(invalid(format!("not a disk image: {path}"))),
        other => Err(invalid(format!("updates are installed by this helper only on macOS and Windows, not {other}"))),
    }
}

/// Opens `file` on this system. The app then quits: at once for [`Opened::Windows`], after
/// [`MAC_QUIT_AFTER`] for [`Opened::Mac`].
pub fn open(file: &Path, app_name: &str) -> io::Result<Opened> {
    let os = std::env::consts::OS;
    let steps = plan(file, app_name, os)?;
    if os == "windows" {
        let mut mark = file.as_os_str().to_owned();
        mark.push(":Zone.Identifier");
        let _ = std::fs::write(Path::new(&mark), ZONE_IDENTIFIER);
        let c = &steps[0];
        Command::new(&c[0]).args(&c[1..]).spawn()?;
        return Ok(Opened::Windows);
    }
    // The quarantine mark is best effort; opening the image is not.
    let q = &steps[0];
    let _ = Command::new(&q[0]).args(&q[1..]).status();
    let o = &steps[1];
    let status = Command::new(&o[0]).args(&o[1..]).status()?;
    if !status.success() {
        return Err(io::Error::other(format!("open exited with {status}")));
    }
    Ok(Opened::Mac)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mac_quarantines_then_opens_the_disk_image() {
        let steps = plan(Path::new("/tmp/ks-app-v1.2.0-macos-arm64.dmg"), "KS App", "macos").unwrap();
        assert_eq!(steps[0], ["xattr", "-w", "com.apple.quarantine", "0081;00000000;KS App;", "/tmp/ks-app-v1.2.0-macos-arm64.dmg"]);
        assert_eq!(steps[1], ["open", "/tmp/ks-app-v1.2.0-macos-arm64.dmg"]);
        assert_eq!(MAC_QUIT_AFTER, Duration::from_secs(6));
    }

    #[test]
    fn windows_starts_msi_with_msiexec_and_exe_directly() {
        assert_eq!(plan(Path::new("a.MSI"), "X", "windows").unwrap(), [["msiexec", "/i", "a.MSI"]]);
        assert_eq!(plan(Path::new("setup.exe"), "X", "windows").unwrap(), [["setup.exe"]]);
    }

    #[test]
    fn refuses_other_files_and_systems() {
        assert!(plan(Path::new("a.msi"), "X", "macos").is_err());
        assert!(plan(Path::new("a.dmg"), "X", "windows").is_err());
        assert!(plan(Path::new("a.dmg"), "X", "linux").is_err());
        assert_eq!(quarantine_value("A;B"), "0081;00000000;A B;");
    }
}
