//! Retained layout, page artifacts, attachments, ZIP output, and publication.

use camino::Utf8PathBuf;

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
