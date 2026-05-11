//! Path safety, redaction, attachment quarantine, and formula neutralization.

use crate::links::{report_raw_link_value, target_reference_from_relative_url};

pub fn redact_known_secrets(input: &str, secrets: &[String]) -> String {
    secrets
        .iter()
        .filter(|secret| !secret.is_empty())
        .fold(input.to_owned(), |text, secret| {
            text.replace(secret, "[redacted]")
        })
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AttachmentQuarantine {
    None,
    DangerousName,
    DangerousTarget,
    ActiveContent,
}

impl AttachmentQuarantine {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::None => "none",
            Self::DangerousName => "dangerous_name",
            Self::DangerousTarget => "dangerous_target",
            Self::ActiveContent => "active_content",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AttachmentArtifactInput {
    pub filename: String,
    pub download_url: String,
    pub content_type: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AttachmentArtifactPlan {
    pub filename: String,
    pub quarantine: AttachmentQuarantine,
    pub retained_path: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MarkdownDestinationClassification {
    NeutralizedDangerous { reason: &'static str },
    PreservedExternal { url: String },
    UnresolvedInternal { marker: String },
    Unsupported { marker: String },
}

const ACTIVE_CONTENT_EXTENSIONS: [&str; 6] = [".html", ".htm", ".svg", ".js", ".mjs", ".xhtml"];
const ACTIVE_CONTENT_TYPES: [&str; 7] = [
    "application/javascript",
    "application/ecmascript",
    "application/xhtml+xml",
    "image/svg+xml",
    "text/ecmascript",
    "text/html",
    "text/javascript",
];

pub fn plan_attachment_artifact(input: &AttachmentArtifactInput) -> AttachmentArtifactPlan {
    if !is_safe_attachment_filename(&input.filename) {
        return quarantined(&input.filename, AttachmentQuarantine::DangerousName);
    }
    if !is_safe_attachment_download_url(&input.download_url) {
        return quarantined(&input.filename, AttachmentQuarantine::DangerousTarget);
    }
    if is_active_content(&input.filename, input.content_type.as_deref()) {
        return quarantined(&input.filename, AttachmentQuarantine::ActiveContent);
    }
    AttachmentArtifactPlan {
        filename: input.filename.clone(),
        quarantine: AttachmentQuarantine::None,
        retained_path: Some(input.filename.clone()),
    }
}

pub fn classify_markdown_destination(destination: &str) -> MarkdownDestinationClassification {
    let destination = destination.trim();
    if has_dangerous_scheme(destination) {
        return MarkdownDestinationClassification::NeutralizedDangerous {
            reason: "dangerous_scheme",
        };
    }

    if is_preserved_external_url(destination) {
        return MarkdownDestinationClassification::PreservedExternal {
            url: destination.to_owned(),
        };
    }

    if let Some(target) = target_reference_from_relative_url(destination) {
        return MarkdownDestinationClassification::UnresolvedInternal {
            marker: unresolved_target_marker(&report_raw_link_value(&target)),
        };
    }

    MarkdownDestinationClassification::Unsupported {
        marker: format!(
            "[unsupported: markdown_destination; value=\"{}\"]",
            escape_double_quotes(destination)
        ),
    }
}

fn quarantined(filename: &str, quarantine: AttachmentQuarantine) -> AttachmentArtifactPlan {
    AttachmentArtifactPlan {
        filename: filename.to_owned(),
        quarantine,
        retained_path: None,
    }
}

fn is_safe_attachment_filename(filename: &str) -> bool {
    if filename.is_empty() || filename.len() > 255 {
        return false;
    }
    if !filename
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || matches!(character, '.' | '_' | '-'))
        || filename.contains("..")
        || filename.ends_with('.')
    {
        return false;
    }
    let basename = filename
        .rsplit_once('.')
        .map(|(base, _)| base)
        .unwrap_or(filename);
    !is_windows_reserved_basename(basename)
}

fn is_safe_attachment_download_url(download_url: &str) -> bool {
    if !download_url.starts_with('/')
        || download_url.starts_with("//")
        || has_scheme_prefix(download_url)
        || download_url.contains('#')
    {
        return false;
    }
    let path_part = download_url
        .split_once('?')
        .map(|(path, _)| path)
        .unwrap_or(download_url);
    for segment in path_part.split('/') {
        if segment.is_empty() {
            continue;
        }
        let Some(decoded) = decode_url_segment(segment) else {
            return false;
        };
        if decoded == "." || decoded == ".." || decoded.contains('/') {
            return false;
        }
    }
    true
}

fn is_active_content(filename: &str, content_type: Option<&str>) -> bool {
    if let Some(media_type) = content_type.and_then(media_type_only) {
        if ACTIVE_CONTENT_TYPES.contains(&media_type.as_str()) {
            return true;
        }
    }

    let extension = filename_extension(filename);
    ACTIVE_CONTENT_EXTENSIONS.contains(&extension.as_str())
}

fn media_type_only(content_type: &str) -> Option<String> {
    let media_type = content_type
        .split_once(';')
        .map(|(media_type, _)| media_type)
        .unwrap_or(content_type)
        .trim()
        .to_ascii_lowercase();
    (!media_type.is_empty()).then_some(media_type)
}

fn filename_extension(filename: &str) -> String {
    filename
        .rfind('.')
        .map(|index| filename[index..].to_ascii_lowercase())
        .unwrap_or_default()
}

fn has_dangerous_scheme(value: &str) -> bool {
    let Some(scheme) = scheme_prefix(value) else {
        return false;
    };
    matches!(
        scheme.as_str(),
        "javascript:" | "data:" | "vbscript:" | "file:"
    )
}

fn is_preserved_external_url(value: &str) -> bool {
    let lower = value.to_ascii_lowercase();
    lower.starts_with("http:") || lower.starts_with("https:") || lower.starts_with("mailto:")
}

fn unresolved_target_marker(raw_link_value: &str) -> String {
    if let Some(value) = raw_link_value.strip_prefix("page_id:") {
        return format!(
            "[unresolved: page; target_hint=page_id; value=\"{}\"]",
            escape_double_quotes(value)
        );
    }
    if raw_link_value.starts_with("title:") {
        return format!(
            "[unresolved: page; target_hint=title; value=\"{}\"]",
            escape_double_quotes(raw_link_value)
        );
    }
    format!(
        "[unresolved: page; target_hint=raw; value=\"{}\"]",
        escape_double_quotes(raw_link_value)
    )
}

fn escape_double_quotes(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

fn decode_url_segment(segment: &str) -> Option<String> {
    let bytes = segment.as_bytes();
    let mut output = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' {
            let high = *bytes.get(index + 1)?;
            let low = *bytes.get(index + 2)?;
            output.push((hex_value(high)? << 4) | hex_value(low)?);
            index += 3;
            continue;
        }
        output.push(bytes[index]);
        index += 1;
    }
    String::from_utf8(output).ok()
}

fn hex_value(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}

fn scheme_prefix(value: &str) -> Option<String> {
    let mut chars = value.chars();
    let first = chars.next()?;
    if !first.is_ascii_alphabetic() {
        return None;
    }

    for (index, character) in value.char_indices().skip(1) {
        if character == ':' {
            return Some(value[..=index].to_ascii_lowercase());
        }
        if !(character.is_ascii_alphanumeric() || matches!(character, '+' | '.' | '-')) {
            return None;
        }
    }
    None
}

fn has_scheme_prefix(value: &str) -> bool {
    scheme_prefix(value).is_some()
}

fn is_windows_reserved_basename(value: &str) -> bool {
    matches!(
        value.to_ascii_uppercase().as_str(),
        "CON"
            | "PRN"
            | "AUX"
            | "NUL"
            | "COM1"
            | "COM2"
            | "COM3"
            | "COM4"
            | "COM5"
            | "COM6"
            | "COM7"
            | "COM8"
            | "COM9"
            | "LPT1"
            | "LPT2"
            | "LPT3"
            | "LPT4"
            | "LPT5"
            | "LPT6"
            | "LPT7"
            | "LPT8"
            | "LPT9"
    )
}
