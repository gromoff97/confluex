//! Retained layout, page artifacts, attachments, ZIP output, and publication.

use std::collections::{BTreeMap, BTreeSet};
use std::io::{Cursor, Write};
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use camino::{Utf8Path, Utf8PathBuf};
use thiserror::Error;
use tokio::fs;
use walkdir::WalkDir;
use zip::write::SimpleFileOptions;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RetainedAuthority {
    Authoritative,
    Incomplete,
    NonAuthoritative,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RetainedOutcome {
    pub root: Utf8PathBuf,
    pub authority: RetainedAuthority,
    pub final_artifact: Option<Utf8PathBuf>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExecutionMode {
    Materialized,
    PlanOnly,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum OutputRootSelection {
    Ok(Utf8PathBuf),
    Rejected { requirement_id: &'static str },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OutputRootClaim {
    Ok,
    Exists,
    Invalid,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FinalArtifactKind {
    PlainRoot,
    Zip,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PublicationStatus {
    Authoritative,
    Incomplete,
    NonAuthoritative,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RetainedPublicationInput {
    pub output_root: Utf8PathBuf,
    pub authority: PublicationStatus,
    pub artifact_kind: FinalArtifactKind,
    pub zip_path: Option<Utf8PathBuf>,
    pub cleanup_paths: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RetainedPublicationResult {
    pub authority: PublicationStatus,
    pub marker_file: Option<&'static str>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RetainedLayoutPolicy {
    pub expected_page_folders: Vec<String>,
    pub expected_attachment_files_by_folder: BTreeMap<String, Vec<String>>,
    pub allow_debug: bool,
}

#[derive(Debug, Error)]
pub enum OutputError {
    #[error("invalid governed relative path")]
    InvalidGovernedRelativePath,
    #[error("invalid page payload folder")]
    InvalidPagePayloadFolder,
    #[error("filesystem operation failed: {0}")]
    Filesystem(String),
    #[error("zip operation failed: {0}")]
    Zip(String),
}

const REPORT_AND_MARKER_FILES: [&str; 8] = [
    "manifest.tsv",
    "resolved-links.tsv",
    "unresolved-links.tsv",
    "failed-pages.tsv",
    "scope-findings.tsv",
    "summary.txt",
    "INCOMPLETE",
    "NON_AUTHORITATIVE",
];

const REUSABLE_PAYLOAD_FILES: [&str; 3] = ["page.md", "_info.txt", "_storage.xml"];

pub fn quote_path_string(value: &str) -> String {
    let mut output = String::from("\"");
    for character in value.chars() {
        match character {
            '"' => output.push_str("\\\""),
            '\\' => output.push_str("\\\\"),
            '\u{08}' => output.push_str("\\b"),
            '\t' => output.push_str("\\t"),
            '\n' => output.push_str("\\n"),
            '\u{0c}' => output.push_str("\\f"),
            '\r' => output.push_str("\\r"),
            character if (character as u32) <= 0x1f => {
                output.push_str(&format!("\\u{:04X}", character as u32));
            }
            character => output.push(character),
        }
    }
    output.push('"');
    output
}

pub fn governed_relative_path(value: &str) -> Result<String, OutputError> {
    if value.starts_with('/')
        || value.ends_with('/')
        || value.contains('\\')
        || value.contains(':')
        || value.contains(['\t', '\n', '\r'])
        || value
            .split('/')
            .any(|segment| segment.is_empty() || matches!(segment, "." | ".."))
    {
        return Err(OutputError::InvalidGovernedRelativePath);
    }
    Ok(value.to_owned())
}

pub fn join_governed_relative_path(
    root: &Utf8Path,
    relative_path: &str,
) -> Result<Utf8PathBuf, OutputError> {
    governed_relative_path(relative_path)?;
    Ok(relative_path
        .split('/')
        .fold(root.to_path_buf(), |path, segment| path.join(segment)))
}

pub fn page_payload_folder(page_id: &str, space_key: Option<&str>) -> Result<String, OutputError> {
    if !is_canonical_non_negative_integer(page_id) {
        return Err(OutputError::InvalidPagePayloadFolder);
    }

    let space_segment = match space_key.filter(|space_key| !space_key.is_empty()) {
        Some(space_key) => format!("space__{}", hex_upper(space_key.as_bytes())),
        None => "_no_space".to_owned(),
    };
    let page_segment = format!("page__{page_id}");

    if space_segment.len() > 240 || page_segment.len() > 240 {
        return Err(OutputError::InvalidPagePayloadFolder);
    }

    Ok(format!("pages/{space_segment}/{page_segment}"))
}

pub fn try_page_payload_folder(page_id: &str, space_key: Option<&str>) -> Option<String> {
    page_payload_folder(page_id, space_key).ok()
}

pub fn select_output_root(
    execution_mode: ExecutionMode,
    page_id: &str,
    output_root: Option<&Utf8Path>,
    resume: bool,
    cwd: &Utf8Path,
    now_utc: SystemTime,
) -> OutputRootSelection {
    match output_root {
        Some(source) => select_explicit_output_root(execution_mode, source, resume, cwd),
        None => select_generated_output_root(execution_mode, page_id, cwd, now_utc),
    }
}

pub async fn claim_fresh_output_root(output_root: &Utf8Path) -> OutputRootClaim {
    let absolute_root = absolute_utf8(output_root);
    if assert_no_symlink_ancestors(&absolute_root).await.is_err() {
        return OutputRootClaim::Invalid;
    }
    match fs::create_dir(&absolute_root).await {
        Ok(()) => OutputRootClaim::Ok,
        Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => OutputRootClaim::Exists,
        Err(_) => OutputRootClaim::Invalid,
    }
}

pub async fn ensure_directory_no_follow(path: &Utf8Path) -> Result<(), OutputError> {
    let absolute = absolute_utf8(path);
    assert_no_symlink_ancestors(&absolute).await?;
    match fs::symlink_metadata(&absolute).await {
        Ok(metadata) => {
            if !metadata.is_dir() || metadata.file_type().is_symlink() {
                return Err(OutputError::Filesystem(
                    "path is not a directory".to_owned(),
                ));
            }
            Ok(())
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            fs::create_dir_all(&absolute).await.map_err(fs_error)?;
            assert_no_symlink_ancestors(&absolute).await
        }
        Err(error) => Err(fs_error(error)),
    }
}

pub async fn write_file_no_follow_atomic(
    target_path: &Utf8Path,
    bytes: impl AsRef<[u8]>,
) -> Result<(), OutputError> {
    let absolute = absolute_utf8(target_path);
    let parent = absolute
        .parent()
        .ok_or_else(|| OutputError::Filesystem("missing parent".to_owned()))?;
    ensure_directory_no_follow(parent).await?;
    assert_writable_file_target(&absolute).await?;

    let temp_path = parent.join(format!(
        ".tmp-{}-{}",
        std::process::id(),
        monotonic_suffix()
    ));
    fs::write(&temp_path, bytes).await.map_err(fs_error)?;
    match fs::rename(&temp_path, &absolute).await {
        Ok(()) => Ok(()),
        Err(error) => {
            let _ = fs::remove_file(&temp_path).await;
            Err(fs_error(error))
        }
    }
}

pub async fn read_file_no_follow(target_path: &Utf8Path) -> Result<Vec<u8>, OutputError> {
    assert_regular_file_no_follow(target_path).await?;
    fs::read(target_path).await.map_err(fs_error)
}

pub async fn remove_tree_no_follow(path: &Utf8Path) -> Result<(), OutputError> {
    let metadata = match fs::symlink_metadata(path).await {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(fs_error(error)),
    };

    if metadata.is_dir() && !metadata.file_type().is_symlink() {
        let mut entries = fs::read_dir(path).await.map_err(fs_error)?;
        while let Some(entry) = entries.next_entry().await.map_err(fs_error)? {
            let child = Utf8PathBuf::from_path_buf(entry.path())
                .map_err(|_| OutputError::Filesystem("non-UTF8 path".to_owned()))?;
            Box::pin(remove_tree_no_follow(&child)).await?;
        }
        fs::remove_dir(path).await.map_err(fs_error)?;
        return Ok(());
    }

    if metadata.is_file() || metadata.file_type().is_symlink() {
        fs::remove_file(path).await.map_err(fs_error)?;
        return Ok(());
    }

    Err(OutputError::Filesystem(
        "unsupported filesystem object".to_owned(),
    ))
}

pub async fn sanitize_retained_layout(
    output_root: &Utf8Path,
    policy: &RetainedLayoutPolicy,
) -> Result<(), OutputError> {
    let expected_folders = policy
        .expected_page_folders
        .iter()
        .cloned()
        .collect::<BTreeSet<_>>();
    let mut allowed_top_level = REPORT_AND_MARKER_FILES
        .into_iter()
        .map(str::to_owned)
        .collect::<BTreeSet<_>>();
    allowed_top_level.insert("pages".to_owned());
    if policy.allow_debug {
        allowed_top_level.insert("_debug".to_owned());
    }

    for entry in safe_read_dir(output_root).await? {
        if !allowed_top_level.contains(entry.file_name().to_string_lossy().as_ref()) {
            let child = Utf8PathBuf::from_path_buf(entry.path())
                .map_err(|_| OutputError::Filesystem("non-UTF8 path".to_owned()))?;
            remove_tree_no_follow(&child).await?;
        }
    }

    sanitize_pages_tree(
        output_root,
        &expected_folders,
        &policy.expected_attachment_files_by_folder,
    )
    .await?;
    sanitize_debug_tree(output_root, policy.allow_debug).await
}

pub async fn assert_reusable_payload_folder(
    output_root: &Utf8Path,
    folder: &str,
) -> Result<(), OutputError> {
    let folder_path = join_governed_relative_path(output_root, folder)?;
    let metadata = fs::symlink_metadata(&folder_path).await.map_err(fs_error)?;
    if !metadata.is_dir() || metadata.file_type().is_symlink() {
        return Err(OutputError::Filesystem(
            "reusable payload folder must be a directory".to_owned(),
        ));
    }

    for entry in safe_read_dir(&folder_path).await? {
        let name = entry.file_name().to_string_lossy().to_string();
        if name == "attachments" {
            if !entry.file_type().await.map_err(fs_error)?.is_dir() {
                return Err(OutputError::Filesystem(
                    "invalid attachments entry".to_owned(),
                ));
            }
            continue;
        }
        if !entry.file_type().await.map_err(fs_error)?.is_file()
            || !REUSABLE_PAYLOAD_FILES.contains(&name.as_str())
        {
            return Err(OutputError::Filesystem(
                "unsupported reusable payload entry".to_owned(),
            ));
        }
    }
    Ok(())
}

pub fn zip_path_for_output_root(output_root: &Utf8Path) -> Utf8PathBuf {
    Utf8PathBuf::from(format!("{output_root}.zip"))
}

pub async fn assert_zip_path_available(zip_path: &Utf8Path) -> Result<(), OutputError> {
    match fs::symlink_metadata(zip_path).await {
        Ok(_) => Err(OutputError::Filesystem(
            "zip path already exists".to_owned(),
        )),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(fs_error(error)),
    }
}

pub async fn create_zip_from_root(
    output_root: &Utf8Path,
    zip_path: Option<&Utf8Path>,
) -> Result<Utf8PathBuf, OutputError> {
    let zip_path = zip_path
        .map(Utf8Path::to_path_buf)
        .unwrap_or_else(|| zip_path_for_output_root(output_root));
    let root_metadata = fs::symlink_metadata(output_root).await.map_err(fs_error)?;
    if !root_metadata.is_dir() {
        return Err(OutputError::Zip(
            "zip output root must be a directory".to_owned(),
        ));
    }

    let mut entries = Vec::new();
    for entry in WalkDir::new(output_root).follow_links(false).min_depth(1) {
        let entry = entry.map_err(|error| OutputError::Zip(error.to_string()))?;
        let relative_path = entry
            .path()
            .strip_prefix(output_root)
            .map_err(|error| OutputError::Zip(error.to_string()))?;
        let relative_path = relative_path
            .to_string_lossy()
            .replace(std::path::MAIN_SEPARATOR, "/");
        validate_zip_relative_path(&relative_path)?;
        if entry.file_type().is_file() {
            let content = fs::read(entry.path()).await.map_err(fs_error)?;
            entries.push((relative_path, content));
        } else if !entry.file_type().is_dir() {
            return Err(OutputError::Zip(
                "zip output root contains unsupported entry".to_owned(),
            ));
        }
    }
    entries.sort_by(|left, right| left.0.as_bytes().cmp(right.0.as_bytes()));

    let mut archive = Cursor::new(Vec::new());
    {
        let mut writer = zip::ZipWriter::new(&mut archive);
        let options =
            SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
        for (name, content) in entries {
            writer
                .start_file(name, options)
                .map_err(|error| OutputError::Zip(error.to_string()))?;
            writer
                .write_all(&content)
                .map_err(|error| OutputError::Zip(error.to_string()))?;
        }
        writer
            .finish()
            .map_err(|error| OutputError::Zip(error.to_string()))?;
    }

    let temp_zip_path = Utf8PathBuf::from(format!("{zip_path}.tmp-{}", monotonic_suffix()));
    write_file_no_follow_atomic(&temp_zip_path, archive.into_inner()).await?;
    assert_zip_path_available(&zip_path).await?;
    fs::rename(&temp_zip_path, &zip_path)
        .await
        .map_err(fs_error)?;
    Ok(zip_path)
}

pub async fn publish_retained_outcome(
    publication: &RetainedPublicationInput,
) -> Result<RetainedPublicationResult, OutputError> {
    ensure_directory_no_follow(&publication.output_root).await?;
    if publication.artifact_kind == FinalArtifactKind::Zip && publication.zip_path.is_none() {
        return Err(OutputError::Filesystem(
            "zip publication requires zip path".to_owned(),
        ));
    }

    for cleanup_path in &publication.cleanup_paths {
        let path = join_governed_relative_path(&publication.output_root, cleanup_path)?;
        remove_tree_no_follow(&path).await?;
    }

    match publication.authority {
        PublicationStatus::Authoritative => {
            let _ = fs::remove_file(publication.output_root.join("INCOMPLETE")).await;
            let _ = fs::remove_file(publication.output_root.join("NON_AUTHORITATIVE")).await;
            Ok(RetainedPublicationResult {
                authority: publication.authority,
                marker_file: None,
            })
        }
        PublicationStatus::Incomplete => {
            write_file_no_follow_atomic(
                &publication.output_root.join("INCOMPLETE"),
                b"incomplete=1\n",
            )
            .await?;
            let _ = fs::remove_file(publication.output_root.join("NON_AUTHORITATIVE")).await;
            Ok(RetainedPublicationResult {
                authority: publication.authority,
                marker_file: Some("INCOMPLETE"),
            })
        }
        PublicationStatus::NonAuthoritative => {
            write_file_no_follow_atomic(
                &publication.output_root.join("NON_AUTHORITATIVE"),
                b"non_authoritative=1\n",
            )
            .await?;
            Ok(RetainedPublicationResult {
                authority: publication.authority,
                marker_file: Some("NON_AUTHORITATIVE"),
            })
        }
    }
}

fn select_explicit_output_root(
    execution_mode: ExecutionMode,
    source: &Utf8Path,
    resume: bool,
    cwd: &Utf8Path,
) -> OutputRootSelection {
    let output_root = if source.is_absolute() {
        source.to_path_buf()
    } else {
        cwd.join(source)
    };
    let output_root = absolute_utf8(&output_root);
    let state = std::fs::symlink_metadata(&output_root);
    let is_resume = execution_mode == ExecutionMode::Materialized && resume;

    if is_resume {
        match state {
            Ok(metadata) if metadata.is_dir() && !metadata.file_type().is_symlink() => {
                OutputRootSelection::Ok(output_root)
            }
            Ok(_) => OutputRootSelection::Rejected {
                requirement_id: "FR-0076",
            },
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                OutputRootSelection::Rejected {
                    requirement_id: "FR-0103",
                }
            }
            Err(_) => OutputRootSelection::Rejected {
                requirement_id: "FR-0076",
            },
        }
    } else if state.is_ok() {
        OutputRootSelection::Rejected {
            requirement_id: "FR-0016",
        }
    } else {
        OutputRootSelection::Ok(output_root)
    }
}

fn select_generated_output_root(
    execution_mode: ExecutionMode,
    page_id: &str,
    cwd: &Utf8Path,
    now_utc: SystemTime,
) -> OutputRootSelection {
    let prefix = match execution_mode {
        ExecutionMode::Materialized => "confluence_dump",
        ExecutionMode::PlanOnly => "confluence_plan",
    };
    let base_name = format!("{prefix}_{page_id}_{}", format_utc_timestamp(now_utc));
    for suffix in 0..u64::MAX {
        let candidate_name = if suffix == 0 {
            base_name.clone()
        } else {
            format!("{base_name}_{suffix}")
        };
        let candidate = absolute_utf8(&cwd.join(candidate_name));
        match std::fs::symlink_metadata(&candidate) {
            Ok(_) => continue,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                return OutputRootSelection::Ok(candidate);
            }
            Err(_) => {
                return OutputRootSelection::Rejected {
                    requirement_id: "FR-0055",
                };
            }
        }
    }
    OutputRootSelection::Rejected {
        requirement_id: "FR-0055",
    }
}

async fn sanitize_pages_tree(
    output_root: &Utf8Path,
    expected_folders: &BTreeSet<String>,
    expected_attachment_files_by_folder: &BTreeMap<String, Vec<String>>,
) -> Result<(), OutputError> {
    let pages_path = output_root.join("pages");
    let metadata = match fs::symlink_metadata(&pages_path).await {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(fs_error(error)),
    };
    if !metadata.is_dir() || metadata.file_type().is_symlink() {
        remove_tree_no_follow(&pages_path).await?;
        return Ok(());
    }

    for entry in WalkDir::new(&pages_path)
        .follow_links(false)
        .min_depth(1)
        .contents_first(true)
    {
        let entry = entry.map_err(|error| OutputError::Filesystem(error.to_string()))?;
        let path = Utf8PathBuf::from_path_buf(entry.path().to_path_buf())
            .map_err(|_| OutputError::Filesystem("non-UTF8 path".to_owned()))?;
        if should_keep_page_tree_path(output_root, &path, expected_folders) {
            continue;
        }
        remove_tree_no_follow(&path).await?;
    }

    for folder in expected_folders {
        let folder_path = join_governed_relative_path(output_root, folder)?;
        if fs::symlink_metadata(&folder_path).await.is_ok() {
            sanitize_page_folder(
                &folder_path,
                expected_attachment_files_by_folder
                    .get(folder)
                    .map(Vec::as_slice)
                    .unwrap_or(&[]),
            )
            .await?;
        }
    }
    Ok(())
}

async fn sanitize_page_folder(
    folder_path: &Utf8Path,
    expected_attachment_files: &[String],
) -> Result<(), OutputError> {
    let mut allowed = REUSABLE_PAYLOAD_FILES
        .into_iter()
        .map(str::to_owned)
        .collect::<BTreeSet<_>>();
    if !expected_attachment_files.is_empty() {
        allowed.insert("attachments".to_owned());
    }

    for entry in safe_read_dir(folder_path).await? {
        let name = entry.file_name().to_string_lossy().to_string();
        let path = Utf8PathBuf::from_path_buf(entry.path())
            .map_err(|_| OutputError::Filesystem("non-UTF8 path".to_owned()))?;
        let file_type = entry.file_type().await.map_err(fs_error)?;
        if !allowed.contains(&name) {
            remove_tree_no_follow(&path).await?;
        } else if name == "attachments" {
            if !file_type.is_dir() {
                remove_tree_no_follow(&path).await?;
            } else {
                sanitize_attachment_folder(&path, expected_attachment_files).await?;
            }
        } else if !file_type.is_file() {
            remove_tree_no_follow(&path).await?;
        }
    }
    Ok(())
}

async fn sanitize_attachment_folder(
    folder_path: &Utf8Path,
    expected_attachment_files: &[String],
) -> Result<(), OutputError> {
    let expected = expected_attachment_files
        .iter()
        .cloned()
        .collect::<BTreeSet<_>>();
    for entry in safe_read_dir(folder_path).await? {
        let name = entry.file_name().to_string_lossy().to_string();
        let path = Utf8PathBuf::from_path_buf(entry.path())
            .map_err(|_| OutputError::Filesystem("non-UTF8 path".to_owned()))?;
        let file_type = entry.file_type().await.map_err(fs_error)?;
        if !expected.contains(&name) || !file_type.is_file() {
            remove_tree_no_follow(&path).await?;
        }
    }
    Ok(())
}

async fn sanitize_debug_tree(output_root: &Utf8Path, allow_debug: bool) -> Result<(), OutputError> {
    let debug_path = output_root.join("_debug");
    if fs::symlink_metadata(&debug_path).await.is_err() {
        return Ok(());
    }
    if !allow_debug {
        return remove_tree_no_follow(&debug_path).await;
    }
    for entry in safe_read_dir(&debug_path).await? {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with(".tmp-") {
            let path = Utf8PathBuf::from_path_buf(entry.path())
                .map_err(|_| OutputError::Filesystem("non-UTF8 path".to_owned()))?;
            remove_tree_no_follow(&path).await?;
        }
    }
    Ok(())
}

fn should_keep_page_tree_path(
    output_root: &Utf8Path,
    absolute_path: &Utf8Path,
    expected_folders: &BTreeSet<String>,
) -> bool {
    let Ok(relative_path) = absolute_path.strip_prefix(output_root) else {
        return false;
    };
    let relative_path = relative_path.as_str();
    if relative_path == "pages" {
        return true;
    }
    expected_folders.iter().any(|folder| {
        folder == relative_path
            || folder.starts_with(&format!("{relative_path}/"))
            || relative_path.starts_with(&format!("{folder}/"))
    })
}

async fn assert_no_symlink_ancestors(path: &Utf8Path) -> Result<(), OutputError> {
    let absolute = absolute_utf8(path);
    let mut current = Utf8PathBuf::new();
    for component in absolute.components() {
        current.push(component.as_str());
        match fs::symlink_metadata(&current).await {
            Ok(metadata) if metadata.file_type().is_symlink() => {
                return Err(OutputError::Filesystem("symlink path segment".to_owned()));
            }
            Ok(metadata) if current != absolute && !metadata.is_dir() => {
                return Err(OutputError::Filesystem("non-directory ancestor".to_owned()));
            }
            Ok(_) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
            Err(error) => return Err(fs_error(error)),
        }
    }
    Ok(())
}

async fn assert_regular_file_no_follow(path: &Utf8Path) -> Result<(), OutputError> {
    let metadata = fs::symlink_metadata(path).await.map_err(fs_error)?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err(OutputError::Filesystem(
            "path is not a regular file".to_owned(),
        ));
    }
    Ok(())
}

async fn assert_writable_file_target(path: &Utf8Path) -> Result<(), OutputError> {
    match assert_regular_file_no_follow(path).await {
        Ok(()) => Ok(()),
        Err(OutputError::Filesystem(_)) => match fs::symlink_metadata(path).await {
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(error) => Err(fs_error(error)),
            Ok(_) => Err(OutputError::Filesystem("target not writable".to_owned())),
        },
        Err(error) => Err(error),
    }
}

async fn safe_read_dir(path: &Utf8Path) -> Result<Vec<fs::DirEntry>, OutputError> {
    let mut entries = match fs::read_dir(path).await {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(fs_error(error)),
    };
    let mut output = Vec::new();
    while let Some(entry) = entries.next_entry().await.map_err(fs_error)? {
        output.push(entry);
    }
    Ok(output)
}

fn validate_zip_relative_path(relative_path: &str) -> Result<(), OutputError> {
    governed_relative_path(relative_path)?;
    if relative_path
        .chars()
        .any(|character| character.is_control())
    {
        return Err(OutputError::InvalidGovernedRelativePath);
    }
    Ok(())
}

fn absolute_utf8(path: &Utf8Path) -> Utf8PathBuf {
    if path.is_absolute() {
        path.to_path_buf()
    } else {
        Utf8PathBuf::from_path_buf(std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")))
            .unwrap_or_else(|_| Utf8PathBuf::from("."))
            .join(path)
    }
}

fn hex_upper(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02X}")).collect()
}

fn is_canonical_non_negative_integer(value: &str) -> bool {
    value == "0"
        || value
            .chars()
            .next()
            .is_some_and(|first| first.is_ascii_digit() && first != '0')
            && value.chars().all(|character| character.is_ascii_digit())
}

fn format_utc_timestamp(time: SystemTime) -> String {
    let seconds = time
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let days = seconds / 86_400;
    let seconds_of_day = seconds % 86_400;
    let (year, month, day) = civil_from_days(days as i64);
    format!(
        "{year:04}{month:02}{day:02}T{:02}{:02}{:02}Z",
        seconds_of_day / 3600,
        (seconds_of_day % 3600) / 60,
        seconds_of_day % 60
    )
}

fn civil_from_days(days_since_epoch: i64) -> (i64, u32, u32) {
    let z = days_since_epoch + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = mp + if mp < 10 { 3 } else { -9 };
    (y + i64::from(m <= 2), m as u32, d as u32)
}

fn monotonic_suffix() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    format!("{}-{nanos}", std::process::id())
}

fn fs_error(error: std::io::Error) -> OutputError {
    OutputError::Filesystem(error.to_string())
}
