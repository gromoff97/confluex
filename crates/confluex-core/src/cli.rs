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
    pub root_page: Option<String>,
    pub output_root: Option<Utf8PathBuf>,
    pub config_path: Option<Utf8PathBuf>,
    pub include_children: bool,
    pub plan_only: bool,
    pub zip: bool,
    pub resume: bool,
    pub debug: bool,
    pub insecure: bool,
    pub link_depth: Option<u32>,
    pub max_pages: Option<u32>,
    pub max_bytes: Option<u64>,
}
