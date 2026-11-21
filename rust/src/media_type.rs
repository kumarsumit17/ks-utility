//! File extensions for media types (`Content-Type`), for files whose address names none.

use std::path::Path;

/// The usual extension for a media type ("image/jpeg" -> "jpg"). Parameters ("; charset=…")
/// and case are ignored. Only common, unambiguous types; anything else is `None`.
pub fn extension_for(content_type: &str) -> Option<&'static str> {
    let essence = content_type.split(';').next().unwrap_or("").trim().to_ascii_lowercase();
    Some(match essence.as_str() {
        "image/jpeg" | "image/jpg" | "image/pjpeg" => "jpg",
        "image/png" => "png",
        "image/gif" => "gif",
        "image/webp" => "webp",
        "image/avif" => "avif",
        "image/heic" => "heic",
        "image/svg+xml" => "svg",
        "image/bmp" => "bmp",
        "image/tiff" => "tiff",
        "video/mp4" => "mp4",
        "video/webm" => "webm",
        "video/quicktime" => "mov",
        "video/x-matroska" => "mkv",
        "audio/mpeg" => "mp3",
        "audio/mp4" | "audio/x-m4a" => "m4a",
        "audio/ogg" => "ogg",
        "audio/flac" => "flac",
        "audio/wav" | "audio/x-wav" => "wav",
        "application/pdf" => "pdf",
        "application/zip" => "zip",
        _ => return None,
    })
}

/// `name`, with the extension of `content_type` added when it has none.
pub fn name_with_type(name: &str, content_type: Option<&str>) -> String {
    if Path::new(name).extension().is_some() {
        return name.to_owned();
    }
    match content_type.and_then(extension_for) {
        Some(ext) => format!("{name}.{ext}"),
        None => name.to_owned(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extensions_from_media_types() {
        assert_eq!(extension_for("image/jpeg"), Some("jpg"));
        assert_eq!(extension_for("Image/PNG; charset=binary"), Some("png"));
        assert_eq!(extension_for(" audio/mpeg "), Some("mp3"));
        assert_eq!(extension_for("text/html"), None);
        assert_eq!(extension_for(""), None);
    }

    #[test]
    fn names_get_an_extension_only_when_they_have_none() {
        assert_eq!(name_with_type("G1abc", Some("image/jpeg")), "G1abc.jpg");
        assert_eq!(name_with_type("photo.png", Some("image/jpeg")), "photo.png");
        assert_eq!(name_with_type("file", Some("application/x-unknown")), "file");
        assert_eq!(name_with_type("file", None), "file");
    }
}
