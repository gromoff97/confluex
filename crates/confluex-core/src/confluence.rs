//! Confluence REST access, JSON validation, and acquisition records.

use serde_json::Value;
use thiserror::Error;
use url::Url;

#[derive(Debug, Clone)]
pub struct AcquisitionRecord {
    pub method: &'static str,
    pub url: Url,
    pub status: u16,
    pub bytes: u64,
    pub body: Value,
}

#[derive(Debug, Error)]
pub enum ConfluenceError {
    #[error("invalid Confluence URL: {0}")]
    InvalidUrl(String),
    #[error("HTTP request failed: {0}")]
    Http(String),
    #[error("JSON body is not an object")]
    NonObjectJson,
}

#[allow(async_fn_in_trait)]
pub trait ConfluenceTransport {
    async fn get_json(
        &self,
        path: &str,
        query: &[(&str, &str)],
    ) -> Result<AcquisitionRecord, ConfluenceError>;
}
