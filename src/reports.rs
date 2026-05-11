//! Report row types, TSV codec, and summary arithmetic.

use std::collections::{BTreeMap, BTreeSet};

use thiserror::Error;

use crate::output::{governed_relative_path, quote_path_string};

pub const REPORT_FILE_ORDER: [&str; 6] = [
    "manifest.tsv",
    "resolved-links.tsv",
    "unresolved-links.tsv",
    "failed-pages.tsv",
    "scope-findings.tsv",
    "summary.txt",
];

pub const SUMMARY_KEYS: [&str; 28] = [
    "command",
    "execution_mode",
    "page_id",
    "output_root",
    "zip_path",
    "output_path_provenance",
    "support_profile",
    "page_payload_format",
    "final_status",
    "scope_trust",
    "processed_pages",
    "root_pages",
    "tree_pages",
    "linked_pages",
    "other_pages",
    "resolved_links",
    "unresolved_links",
    "scope_findings",
    "failed_operations",
    "downloaded_mib_total",
    "downloaded_mib_content",
    "downloaded_mib_metadata",
    "blocking_reasons",
    "interrupt_reason",
    "resume_mode",
    "resume_schema_version",
    "reused_pages",
    "fresh_pages",
];

pub const LINK_KINDS: [&str; 8] = [
    "child_result",
    "content_id",
    "page_ref",
    "macro_param",
    "href_page_id",
    "href_space_title",
    "ri_url_page_id",
    "ri_url_space_title",
];

pub const RESOLUTION_REASONS: [&str; 4] = [
    "not_found",
    "not_unique",
    "candidate_limit",
    "insufficient_data",
];

pub const FAILED_OPERATIONS: [&str; 7] = [
    "page_metadata",
    "storage_content",
    "child_listing",
    "title_resolution",
    "attachment_preview",
    "page_payload",
    "attachment_download",
];

pub const FINDING_AREAS: [&str; 5] = [
    "child_listing",
    "storage_content",
    "title_resolution",
    "unsupported_pattern",
    "page_payload",
];

pub const FINDING_TYPES: [&str; 7] = [
    "incomplete_tree",
    "partial_listing",
    "storage_unavailable",
    "storage_uninterpretable",
    "candidate_visibility_incomplete",
    "unsupported_internal_pattern",
    "markdown_remnant",
];

pub const REPORT_HEADER_TEXT: [(&str, &str); 5] = [
    (
        "manifest.tsv",
        "page_id\tspace_key\tpage_title\tfolder\tdiscovery_source\texecution_mode\tattachment_count\n",
    ),
    (
        "resolved-links.tsv",
        "source_page_id\tsource_title\tlink_kind\traw_link_value\ttarget_page_id\ttarget_space_key\ttarget_title\n",
    ),
    (
        "unresolved-links.tsv",
        "source_page_id\tsource_title\tlink_kind\traw_link_value\tresolution_reason\n",
    ),
    (
        "failed-pages.tsv",
        "page_id\tpage_title\toperation\terror_summary\n",
    ),
    (
        "scope-findings.tsv",
        "page_id\tfinding_area\tfinding_type\tdetail\n",
    ),
];

#[derive(Debug, Error)]
pub enum ReportError {
    #[error("{0} must be a non-empty string")]
    NonEmptyString(&'static str),
    #[error("{0} must be a canonical non-negative integer")]
    CanonicalNonNegativeInteger(&'static str),
    #[error("{0} must be a canonical positive integer")]
    CanonicalPositiveInteger(&'static str),
    #[error("{0} must be one of {1}")]
    InvalidVocabulary(&'static str, String),
    #[error("invalid governed relative path")]
    InvalidRelativePath,
    #[error("invalid scope finding pair")]
    InvalidScopeFindingPair,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StructuredRawLinkKind {
    PageId,
    Title,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ManifestRow {
    pub page_id: String,
    pub space_key: Option<String>,
    pub page_title: String,
    pub folder: Option<String>,
    pub discovery_source: DiscoverySource,
    pub execution_mode: ExecutionMode,
    pub attachment_count: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResolvedLinkRow {
    pub source_page_id: String,
    pub source_title: Option<String>,
    pub link_kind: String,
    pub raw_link_value: String,
    pub target_page_id: String,
    pub target_space_key: Option<String>,
    pub target_title: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UnresolvedLinkRow {
    pub source_page_id: String,
    pub source_title: Option<String>,
    pub link_kind: String,
    pub raw_link_value: String,
    pub resolution_reason: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FailedPageRow {
    pub page_id: Option<String>,
    pub page_title: Option<String>,
    pub operation: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ScopeFindingRow {
    pub page_id: Option<String>,
    pub finding_area: String,
    pub finding_type: String,
    pub detail: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DiscoverySource {
    Root,
    Tree,
    Linked,
}

impl DiscoverySource {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Root => "root",
            Self::Tree => "tree",
            Self::Linked => "linked",
        }
    }

    fn rank(self) -> u8 {
        match self {
            Self::Root => 0,
            Self::Tree => 1,
            Self::Linked => 2,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExecutionMode {
    Materialized,
    PlanOnly,
}

impl ExecutionMode {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Materialized => "materialized",
            Self::PlanOnly => "plan_only",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FinalStatus {
    Success,
    SuccessWithFindings,
    Incomplete,
    Interrupted,
}

impl FinalStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Success => "success",
            Self::SuccessWithFindings => "success_with_findings",
            Self::Incomplete => "incomplete",
            Self::Interrupted => "interrupted",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ScopeTrust {
    Trusted,
    Degraded,
}

impl ScopeTrust {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Trusted => "trusted",
            Self::Degraded => "degraded",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InterruptReason {
    None,
    MaxPagesLimitReached,
    MaxDownloadLimitReached,
    RuntimeError,
    SignalInterrupt,
}

impl InterruptReason {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::None => "none",
            Self::MaxPagesLimitReached => "max_pages_limit_reached",
            Self::MaxDownloadLimitReached => "max_download_limit_reached",
            Self::RuntimeError => "runtime_error",
            Self::SignalInterrupt => "signal_interrupt",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DownloadedMibValues {
    pub total: String,
    pub content: String,
    pub metadata: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RunReportInput {
    pub command: String,
    pub execution_mode: ExecutionMode,
    pub page_id: String,
    pub output_root: String,
    pub zip_path: Option<String>,
    pub output_path_provenance: String,
    pub final_status: FinalStatus,
    pub scope_trust: ScopeTrust,
    pub interrupt_reason: InterruptReason,
    pub downloaded_mib: Option<DownloadedMibValues>,
    pub resume_mode: bool,
    pub reused_pages: u64,
    pub fresh_pages: Option<u64>,
    pub manifest_rows: Vec<ManifestRow>,
    pub resolved_link_rows: Vec<ResolvedLinkRow>,
    pub unresolved_link_rows: Vec<UnresolvedLinkRow>,
    pub failed_page_rows: Vec<FailedPageRow>,
    pub scope_finding_rows: Vec<ScopeFindingRow>,
}

pub type RunReportTexts = BTreeMap<String, String>;

pub fn canonical_non_negative_integer(
    value: &str,
    name: &'static str,
) -> Result<String, ReportError> {
    if !is_canonical_non_negative_integer(value) {
        return Err(ReportError::CanonicalNonNegativeInteger(name));
    }
    Ok(value.to_owned())
}

pub fn canonical_positive_integer(value: &str, name: &'static str) -> Result<String, ReportError> {
    if !is_canonical_non_negative_integer(value) || value == "0" {
        return Err(ReportError::CanonicalPositiveInteger(name));
    }
    Ok(value.to_owned())
}

pub fn bytewise_compare(left: &str, right: &str) -> std::cmp::Ordering {
    left.as_bytes().cmp(right.as_bytes())
}

pub fn normalize_tsv_field(value: &str) -> String {
    tsv_data_field(value)
}

pub fn tsv_data_field(value: &str) -> String {
    let normalized = normalize_tsv_text(value);
    let escaped = if normalized.starts_with('\\') {
        format!("\\{normalized}")
    } else {
        normalized
    };
    if escaped == "none" {
        "\\none".to_owned()
    } else {
        escaped
    }
}

pub fn tsv_absence_or_data_field(value: Option<&str>) -> String {
    match value {
        None => "none".to_owned(),
        Some(value) => tsv_data_field(value),
    }
}

pub fn tsv_formula_safe_data_field(value: &str) -> String {
    let normalized = tsv_data_field(value);
    if matches!(
        value.chars().next(),
        Some('=') | Some('+') | Some('-') | Some('@' | '\t' | '\r' | '\n')
    ) {
        format!("'{normalized}")
    } else {
        normalized
    }
}

pub fn token_list(tokens: &[String]) -> String {
    if tokens.is_empty() {
        "none".to_owned()
    } else {
        tokens.join(",")
    }
}

pub fn structured_raw_link_value(
    kind: StructuredRawLinkKind,
    parts: &[String],
) -> Result<String, ReportError> {
    match kind {
        StructuredRawLinkKind::PageId => {
            let page_id = parts
                .first()
                .ok_or(ReportError::NonEmptyString("page_id"))?;
            Ok(format!("page_id:{}", normalize_tsv_field(page_id)))
        }
        StructuredRawLinkKind::Title => {
            if parts.len() != 3 || (parts[0] != "0" && parts[0] != "1") {
                return Err(ReportError::NonEmptyString("title parts"));
            }
            let normalized_space_key = normalize_tsv_field(&parts[1]);
            let normalized_title = normalize_tsv_field(&parts[2]);
            Ok([
                format!("space_key_present={}", parts[0]),
                format!("space_key_bytes={}", normalized_space_key.len()),
                format!("space_key={normalized_space_key}"),
                format!("title_bytes={}", normalized_title.len()),
                format!("title={normalized_title}"),
            ]
            .join(";"))
        }
    }
}

pub fn run_report_texts(input: &RunReportInput) -> Result<RunReportTexts, ReportError> {
    let manifest_rows = sorted_manifest_rows(&input.manifest_rows)?;
    let manifest_text_rows = manifest_rows
        .iter()
        .map(serialize_manifest_row)
        .collect::<Result<Vec<_>, _>>()?;
    let resolved_link_rows = sorted_unique_serialized(
        merge_resolved_rows(&input.resolved_link_rows),
        serialize_resolved_link_row,
    )?;
    let unresolved_link_rows = sorted_unique_serialized(
        merge_unresolved_rows(&input.unresolved_link_rows),
        serialize_unresolved_link_row,
    )?;
    let failed_page_rows = sorted_unique_serialized(
        merge_failed_page_rows(&input.failed_page_rows),
        serialize_failed_page_row,
    )?;
    let scope_finding_rows = sorted_unique_serialized(
        input.scope_finding_rows.clone(),
        serialize_scope_finding_row,
    )?;

    let counts = ReportCounts {
        processed_pages: manifest_text_rows.len(),
        root_pages: manifest_rows
            .iter()
            .filter(|row| row.discovery_source == DiscoverySource::Root)
            .count(),
        tree_pages: manifest_rows
            .iter()
            .filter(|row| row.discovery_source == DiscoverySource::Tree)
            .count(),
        linked_pages: manifest_rows
            .iter()
            .filter(|row| row.discovery_source == DiscoverySource::Linked)
            .count(),
        resolved_links: resolved_link_rows.len(),
        unresolved_links: unresolved_link_rows.len(),
        scope_findings: scope_finding_rows.len(),
        failed_operations: failed_page_rows.len(),
    };

    let mut texts = BTreeMap::new();
    texts.insert(
        "manifest.tsv".to_owned(),
        tsv_text(header("manifest.tsv"), &manifest_text_rows),
    );
    texts.insert(
        "resolved-links.tsv".to_owned(),
        tsv_text(header("resolved-links.tsv"), &resolved_link_rows),
    );
    texts.insert(
        "unresolved-links.tsv".to_owned(),
        tsv_text(header("unresolved-links.tsv"), &unresolved_link_rows),
    );
    texts.insert(
        "failed-pages.tsv".to_owned(),
        tsv_text(header("failed-pages.tsv"), &failed_page_rows),
    );
    texts.insert(
        "scope-findings.tsv".to_owned(),
        tsv_text(header("scope-findings.tsv"), &scope_finding_rows),
    );
    texts.insert("summary.txt".to_owned(), summary_text(input, counts)?);
    Ok(texts)
}

fn sorted_manifest_rows(rows: &[ManifestRow]) -> Result<Vec<ManifestRow>, ReportError> {
    let mut rows = rows.to_vec();
    for row in &rows {
        normalize_manifest_folder(row.folder.as_deref())?;
    }
    rows.sort_by(|left, right| {
        left.discovery_source
            .rank()
            .cmp(&right.discovery_source.rank())
            .then_with(|| {
                normalize_manifest_folder(left.folder.as_deref())
                    .expect("manifest folder prevalidated")
                    .cmp(
                        &normalize_manifest_folder(right.folder.as_deref())
                            .expect("manifest folder prevalidated"),
                    )
            })
            .then_with(|| left.page_id.as_bytes().cmp(right.page_id.as_bytes()))
    });
    Ok(rows)
}

fn serialize_manifest_row(row: &ManifestRow) -> Result<String, ReportError> {
    Ok(format!(
        "{}\t{}\t{}\t{}\t{}\t{}\t{}\n",
        canonical_non_negative_integer(&row.page_id, "manifest.page_id")?,
        tsv_absence_or_data_field(row.space_key.as_deref()),
        tsv_formula_safe_data_field(non_empty(&row.page_title, "manifest.page_title")?),
        normalize_manifest_folder(row.folder.as_deref())?,
        row.discovery_source.as_str(),
        row.execution_mode.as_str(),
        row.attachment_count
            .as_deref()
            .map(|value| canonical_non_negative_integer(value, "manifest.attachment_count"))
            .transpose()?
            .unwrap_or_else(|| "none".to_owned())
    ))
}

fn serialize_resolved_link_row(row: &ResolvedLinkRow) -> Result<String, ReportError> {
    require_one_of(&row.link_kind, &LINK_KINDS, "resolved.link_kind")?;
    Ok(format!(
        "{}\t{}\t{}\t{}\t{}\t{}\t{}\n",
        canonical_non_negative_integer(&row.source_page_id, "resolved.source_page_id")?,
        tsv_absence_or_data_field(row.source_title.as_deref()),
        row.link_kind,
        tsv_formula_safe_data_field(non_empty(&row.raw_link_value, "resolved.raw_link_value")?),
        canonical_non_negative_integer(&row.target_page_id, "resolved.target_page_id")?,
        tsv_absence_or_data_field(row.target_space_key.as_deref()),
        tsv_absence_or_data_field(row.target_title.as_deref()),
    ))
}

fn serialize_unresolved_link_row(row: &UnresolvedLinkRow) -> Result<String, ReportError> {
    require_one_of(&row.link_kind, &LINK_KINDS, "unresolved.link_kind")?;
    require_one_of(
        &row.resolution_reason,
        &RESOLUTION_REASONS,
        "unresolved.resolution_reason",
    )?;
    Ok(format!(
        "{}\t{}\t{}\t{}\t{}\n",
        canonical_non_negative_integer(&row.source_page_id, "unresolved.source_page_id")?,
        tsv_absence_or_data_field(row.source_title.as_deref()),
        row.link_kind,
        tsv_formula_safe_data_field(non_empty(&row.raw_link_value, "unresolved.raw_link_value")?),
        row.resolution_reason,
    ))
}

fn serialize_failed_page_row(row: &FailedPageRow) -> Result<String, ReportError> {
    require_one_of(&row.operation, &FAILED_OPERATIONS, "failed.operation")?;
    Ok(format!(
        "{}\t{}\t{}\t{}_failed\n",
        row.page_id
            .as_deref()
            .map(|value| canonical_non_negative_integer(value, "failed.page_id"))
            .transpose()?
            .unwrap_or_else(|| "none".to_owned()),
        tsv_absence_or_data_field(row.page_title.as_deref()),
        row.operation,
        row.operation,
    ))
}

fn serialize_scope_finding_row(row: &ScopeFindingRow) -> Result<String, ReportError> {
    require_one_of(&row.finding_area, &FINDING_AREAS, "scope.finding_area")?;
    require_one_of(&row.finding_type, &FINDING_TYPES, "scope.finding_type")?;
    if !is_valid_scope_finding_pair(&row.finding_area, &row.finding_type) {
        return Err(ReportError::InvalidScopeFindingPair);
    }
    Ok(format!(
        "{}\t{}\t{}\t{}\n",
        row.page_id
            .as_deref()
            .map(|value| canonical_non_negative_integer(value, "scope.page_id"))
            .transpose()?
            .unwrap_or_else(|| "none".to_owned()),
        row.finding_area,
        row.finding_type,
        tsv_formula_safe_data_field(non_empty(&row.detail, "scope.detail")?),
    ))
}

fn merge_resolved_rows(rows: &[ResolvedLinkRow]) -> Vec<ResolvedLinkRow> {
    let mut rows_by_key: BTreeMap<String, ResolvedLinkRow> = BTreeMap::new();
    let mut order = Vec::new();
    for row in rows {
        let key = [
            row.source_page_id.as_str(),
            row.link_kind.as_str(),
            row.raw_link_value.as_str(),
            row.target_page_id.as_str(),
        ]
        .join("\t");
        if let Some(current) = rows_by_key.get_mut(&key) {
            if current.source_title.is_none() {
                current.source_title = row.source_title.clone();
            }
            if current.target_space_key.is_none() {
                current.target_space_key = row.target_space_key.clone();
            }
            if current.target_title.is_none() {
                current.target_title = row.target_title.clone();
            }
            continue;
        }
        order.push(key.clone());
        rows_by_key.insert(key, row.clone());
    }
    order
        .into_iter()
        .filter_map(|key| rows_by_key.remove(&key))
        .collect()
}

fn merge_unresolved_rows(rows: &[UnresolvedLinkRow]) -> Vec<UnresolvedLinkRow> {
    let mut rows_by_key: BTreeMap<String, UnresolvedLinkRow> = BTreeMap::new();
    let mut order = Vec::new();
    for row in rows {
        let key = [
            row.source_page_id.as_str(),
            row.link_kind.as_str(),
            row.raw_link_value.as_str(),
            row.resolution_reason.as_str(),
        ]
        .join("\t");
        if let Some(current) = rows_by_key.get_mut(&key) {
            if current.source_title.is_none() {
                current.source_title = row.source_title.clone();
            }
            continue;
        }
        order.push(key.clone());
        rows_by_key.insert(key, row.clone());
    }
    order
        .into_iter()
        .filter_map(|key| rows_by_key.remove(&key))
        .collect()
}

fn merge_failed_page_rows(rows: &[FailedPageRow]) -> Vec<FailedPageRow> {
    let mut rows_by_key: BTreeMap<String, FailedPageRow> = BTreeMap::new();
    let mut order = Vec::new();
    for (index, row) in rows.iter().enumerate() {
        let key = match &row.page_id {
            Some(page_id) => format!("{}\t{}", page_id, row.operation),
            None => format!("none\t{index}"),
        };
        if let Some(current) = rows_by_key.get_mut(&key) {
            match (&current.page_title, &row.page_title) {
                (None, Some(_)) => current.page_title = row.page_title.clone(),
                (Some(current_title), Some(next_title))
                    if bytewise_compare(
                        &tsv_data_field(next_title),
                        &tsv_data_field(current_title),
                    )
                    .is_lt() =>
                {
                    current.page_title = row.page_title.clone();
                }
                _ => {}
            }
            continue;
        }
        order.push(key.clone());
        rows_by_key.insert(key, row.clone());
    }
    order
        .into_iter()
        .filter_map(|key| rows_by_key.remove(&key))
        .collect()
}

fn sorted_unique_serialized<T>(
    rows: Vec<T>,
    serialize: fn(&T) -> Result<String, ReportError>,
) -> Result<Vec<String>, ReportError> {
    let mut set = BTreeSet::new();
    for row in &rows {
        set.insert(serialize(row)?);
    }
    Ok(set.into_iter().collect())
}

#[derive(Debug, Clone, Copy)]
struct ReportCounts {
    processed_pages: usize,
    root_pages: usize,
    tree_pages: usize,
    linked_pages: usize,
    resolved_links: usize,
    unresolved_links: usize,
    scope_findings: usize,
    failed_operations: usize,
}

fn summary_text(input: &RunReportInput, counts: ReportCounts) -> Result<String, ReportError> {
    let downloaded = input.downloaded_mib.clone().unwrap_or(DownloadedMibValues {
        total: "0.000".to_owned(),
        content: "0.000".to_owned(),
        metadata: "0.000".to_owned(),
    });
    require_one_of(&input.command, &["export"], "command")?;
    canonical_non_negative_integer(&input.page_id, "pageId")?;
    require_one_of(
        &input.output_path_provenance,
        &["explicit", "configured", "generated"],
        "outputPathProvenance",
    )?;
    require_decimal_mib(&downloaded.total, "downloadedMib.total")?;
    require_decimal_mib(&downloaded.content, "downloadedMib.content")?;
    require_decimal_mib(&downloaded.metadata, "downloadedMib.metadata")?;

    let final_fresh_pages = input.fresh_pages.unwrap_or(counts.processed_pages as u64);
    let values = [
        ("command", input.command.clone()),
        ("execution_mode", input.execution_mode.as_str().to_owned()),
        ("page_id", input.page_id.clone()),
        ("output_root", quote_path_string(&input.output_root)),
        (
            "zip_path",
            input
                .zip_path
                .as_deref()
                .map(quote_path_string)
                .unwrap_or_else(|| "none".to_owned()),
        ),
        (
            "output_path_provenance",
            input.output_path_provenance.clone(),
        ),
        ("support_profile", "default".to_owned()),
        (
            "page_payload_format",
            match input.execution_mode {
                ExecutionMode::Materialized => "md",
                ExecutionMode::PlanOnly => "none",
            }
            .to_owned(),
        ),
        ("final_status", input.final_status.as_str().to_owned()),
        ("scope_trust", input.scope_trust.as_str().to_owned()),
        ("processed_pages", counts.processed_pages.to_string()),
        ("root_pages", counts.root_pages.to_string()),
        ("tree_pages", counts.tree_pages.to_string()),
        ("linked_pages", counts.linked_pages.to_string()),
        ("other_pages", "0".to_owned()),
        ("resolved_links", counts.resolved_links.to_string()),
        ("unresolved_links", counts.unresolved_links.to_string()),
        ("scope_findings", counts.scope_findings.to_string()),
        ("failed_operations", counts.failed_operations.to_string()),
        ("downloaded_mib_total", downloaded.total),
        ("downloaded_mib_content", downloaded.content),
        ("downloaded_mib_metadata", downloaded.metadata),
        ("blocking_reasons", blocking_reasons(counts)),
        (
            "interrupt_reason",
            input.interrupt_reason.as_str().to_owned(),
        ),
        (
            "resume_mode",
            if input.resume_mode { "1" } else { "0" }.to_owned(),
        ),
        ("resume_schema_version", "3".to_owned()),
        ("reused_pages", input.reused_pages.to_string()),
        ("fresh_pages", final_fresh_pages.to_string()),
    ];

    Ok(format!(
        "{}\n",
        values
            .into_iter()
            .map(|(key, value)| format!("{key}={value}"))
            .collect::<Vec<_>>()
            .join("\n")
    ))
}

fn tsv_text(header: &str, serialized_rows: &[String]) -> String {
    format!("{}{}", header, serialized_rows.join(""))
}

fn header(name: &str) -> &'static str {
    REPORT_HEADER_TEXT
        .iter()
        .find(|(candidate, _)| *candidate == name)
        .map(|(_, text)| *text)
        .expect("report header exists")
}

fn normalize_manifest_folder(value: Option<&str>) -> Result<String, ReportError> {
    match value {
        None => Ok("none".to_owned()),
        Some(value) => governed_relative_path(value).map_err(|_| ReportError::InvalidRelativePath),
    }
}

fn blocking_reasons(counts: ReportCounts) -> String {
    let mut tokens = Vec::new();
    if counts.unresolved_links > 0 {
        tokens.push("unresolved_links".to_owned());
    }
    if counts.scope_findings > 0 {
        tokens.push("scope_findings".to_owned());
    }
    if counts.failed_operations > 0 {
        tokens.push("failed_operations".to_owned());
    }
    token_list(&tokens)
}

fn normalize_tsv_text(value: &str) -> String {
    value
        .chars()
        .map(|character| {
            if character.is_control() || character == '\u{7f}' {
                ' '
            } else {
                character
            }
        })
        .collect()
}

fn non_empty<'a>(value: &'a str, name: &'static str) -> Result<&'a str, ReportError> {
    if value.is_empty() {
        return Err(ReportError::NonEmptyString(name));
    }
    Ok(value)
}

fn require_one_of(
    value: &str,
    allowed: &'static [&'static str],
    name: &'static str,
) -> Result<(), ReportError> {
    if allowed.contains(&value) {
        Ok(())
    } else {
        Err(ReportError::InvalidVocabulary(name, allowed.join(",")))
    }
}

fn require_decimal_mib(value: &str, name: &'static str) -> Result<(), ReportError> {
    let Some((whole, decimal)) = value.split_once('.') else {
        return Err(ReportError::NonEmptyString(name));
    };
    if decimal.len() == 3
        && is_canonical_non_negative_integer(whole)
        && decimal.chars().all(|c| c.is_ascii_digit())
    {
        Ok(())
    } else {
        Err(ReportError::NonEmptyString(name))
    }
}

fn is_valid_scope_finding_pair(finding_area: &str, finding_type: &str) -> bool {
    matches!(
        (finding_area, finding_type),
        ("child_listing", "incomplete_tree")
            | ("child_listing", "partial_listing")
            | ("storage_content", "storage_unavailable")
            | ("storage_content", "storage_uninterpretable")
            | ("title_resolution", "candidate_visibility_incomplete")
            | ("unsupported_pattern", "unsupported_internal_pattern")
            | ("page_payload", "markdown_remnant")
    )
}

fn is_canonical_non_negative_integer(value: &str) -> bool {
    value == "0"
        || value
            .chars()
            .next()
            .is_some_and(|first| first.is_ascii_digit() && first != '0')
            && value.chars().all(|character| character.is_ascii_digit())
}
