//! Typed command contracts and invocation inputs.

use camino::Utf8PathBuf;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CommandRequest {
    Help,
    Setup(SetupRequest),
    Export(ExportRequest),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SetupRequest {
    pub config_path: Option<Utf8PathBuf>,
    pub insecure: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExportRequest {
    pub page_id: Option<String>,
    pub output_root: Option<Utf8PathBuf>,
    pub config_path: Option<Utf8PathBuf>,
    pub include_children: bool,
    pub plan_only: bool,
    pub zip: bool,
    pub resume: bool,
    pub no_fail_fast: bool,
    pub debug: bool,
    pub insecure: bool,
    pub max_pages: Option<u64>,
    pub max_download_mib: Option<u64>,
    pub sleep_ms: Option<u64>,
    pub max_find_candidates: Option<u64>,
    pub link_depth: Option<u64>,
}
