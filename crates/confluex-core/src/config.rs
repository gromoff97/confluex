//! Configuration loading, source provenance, and option merging.

use camino::Utf8PathBuf;
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct JsonConfig {
    pub confluence_base_url: Option<String>,
    pub confluence_token: Option<String>,
    pub output_root: Option<Utf8PathBuf>,
    pub root_page: Option<String>,
    pub include_children: Option<bool>,
    pub plan_only: Option<bool>,
    pub zip: Option<bool>,
    pub resume: Option<bool>,
    pub debug: Option<bool>,
    pub insecure: Option<bool>,
    pub link_depth: Option<u32>,
    pub max_pages: Option<u32>,
    pub max_bytes: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ConfigSource {
    ExplicitFile(Utf8PathBuf),
    UserFile(Utf8PathBuf),
    Environment,
    Absent,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ConfigurationSession {
    pub source: ConfigSource,
    pub config: JsonConfig,
}
