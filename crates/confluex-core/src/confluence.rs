//! Confluence REST access, JSON validation, and acquisition records.

use serde_json::Value;
use thiserror::Error;
use url::Url;

use crate::config::EnvMap;

pub const DEFAULT_REMOTE_TIMEOUT_MS: u64 = 60_000;
pub const DEFAULT_BUFFERED_RESPONSE_LIMIT_BYTES: usize = 64 * 1024 * 1024;

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

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct TransportPolicy {
    pub insecure: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RemoteAccessFailureReason {
    MissingBaseUrl,
    InvalidBaseUrl,
    MissingToken,
}

impl RemoteAccessFailureReason {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::MissingBaseUrl => "missing_base_url",
            Self::InvalidBaseUrl => "invalid_base_url",
            Self::MissingToken => "missing_token",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RemoteOperationFailureReason {
    MissingBaseUrl,
    InvalidBaseUrl,
    MissingToken,
    AuthRejected,
    PageInaccessible,
    TransportDns,
    TransportTimeout,
    TransportConnectionReset,
    TransportTls,
    TransportProxy,
}

impl RemoteOperationFailureReason {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::MissingBaseUrl => "missing_base_url",
            Self::InvalidBaseUrl => "invalid_base_url",
            Self::MissingToken => "missing_token",
            Self::AuthRejected => "auth_rejected",
            Self::PageInaccessible => "page_inaccessible",
            Self::TransportDns => "transport_dns",
            Self::TransportTimeout => "transport_timeout",
            Self::TransportConnectionReset => "transport_connection_reset",
            Self::TransportTls => "transport_tls",
            Self::TransportProxy => "transport_proxy",
        }
    }
}

impl From<RemoteAccessFailureReason> for RemoteOperationFailureReason {
    fn from(value: RemoteAccessFailureReason) -> Self {
        match value {
            RemoteAccessFailureReason::MissingBaseUrl => Self::MissingBaseUrl,
            RemoteAccessFailureReason::InvalidBaseUrl => Self::InvalidBaseUrl,
            RemoteAccessFailureReason::MissingToken => Self::MissingToken,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RemoteAccessContext {
    Usable {
        base_url: String,
        token: String,
        authorization: String,
        transport_policy: TransportPolicy,
    },
    Unusable {
        reason: RemoteAccessFailureReason,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PageMetadata {
    pub page_id: String,
    pub page_title: String,
    pub space_key: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AttachmentDataItem {
    pub filename: String,
    pub download_url: String,
    pub content_type: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RequestLimits {
    pub timeout_ms: u64,
    pub max_buffered_bytes: usize,
}

impl Default for RequestLimits {
    fn default() -> Self {
        Self {
            timeout_ms: DEFAULT_REMOTE_TIMEOUT_MS,
            max_buffered_bytes: DEFAULT_BUFFERED_RESPONSE_LIMIT_BYTES,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AttachmentDownloadLimits {
    pub max_bytes: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum JsonRecordDecodeResult {
    Ok { value: Value, bytes: usize },
    Failed { reason: AcquisitionFailureReason },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AcquisitionFailureReason {
    HttpStatus,
    InvalidUtf8,
    InvalidJson,
    NonObjectJson,
    InvalidNext,
}

impl AcquisitionFailureReason {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::HttpStatus => "http_status",
            Self::InvalidUtf8 => "invalid_utf8",
            Self::InvalidJson => "invalid_json",
            Self::NonObjectJson => "non_object_json",
            Self::InvalidNext => "invalid_next",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AcquisitionResult {
    Ok {
        body: Value,
        bytes: usize,
        complete: bool,
    },
    Failed {
        reason: AcquisitionFailureReason,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RootPageAccessResult {
    Ok {
        identity: String,
        metadata_bytes: usize,
        metadata: Option<PageMetadata>,
    },
    Failed {
        reason: RemoteOperationFailureReason,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CurrentUserAccessResult {
    Ok {
        base_url: String,
    },
    Failed {
        reason: RemoteOperationFailureReason,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PageListResult {
    Ok {
        complete: bool,
        pages: Vec<PageMetadata>,
        metadata_bytes: usize,
    },
    Failed,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PageStorageResult {
    Ok {
        storage: String,
        metadata_bytes: usize,
    },
    Failed,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AttachmentPreviewResult {
    Ok {
        count: usize,
        preview: String,
        metadata_bytes: usize,
    },
    Failed,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AttachmentDataResult {
    Ok {
        items: Vec<AttachmentDataItem>,
        metadata_bytes: usize,
    },
    Failed,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AttachmentPayloadResult {
    Ok { bytes: Vec<u8> },
    DownloadLimitReached,
    Failed,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TitleDiscovery {
    pub title: String,
    pub space_key: Option<String>,
}

#[allow(async_fn_in_trait)]
pub trait ConfluenceTransport {
    async fn get_json(
        &self,
        path: &str,
        query: &[(&str, &str)],
    ) -> Result<AcquisitionRecord, ConfluenceError>;
}

#[derive(Debug, Clone)]
pub struct ReqwestConfluenceTransport {
    client: reqwest::Client,
    base_url: String,
    authorization: String,
}

impl ReqwestConfluenceTransport {
    pub fn new(context: &RemoteAccessContext) -> Result<Self, ConfluenceError> {
        let RemoteAccessContext::Usable {
            base_url,
            authorization,
            transport_policy,
            ..
        } = context
        else {
            return Err(ConfluenceError::InvalidUrl(
                "unusable remote access context".to_owned(),
            ));
        };
        let client = reqwest::Client::builder()
            .danger_accept_invalid_certs(transport_policy.insecure)
            .timeout(std::time::Duration::from_millis(DEFAULT_REMOTE_TIMEOUT_MS))
            .build()
            .map_err(|error| ConfluenceError::Http(error.to_string()))?;
        Ok(Self {
            client,
            base_url: base_url.clone(),
            authorization: authorization.clone(),
        })
    }
}

impl ConfluenceTransport for ReqwestConfluenceTransport {
    async fn get_json(
        &self,
        path: &str,
        query: &[(&str, &str)],
    ) -> Result<AcquisitionRecord, ConfluenceError> {
        let mut url = governed_url(&self.base_url, path)?;
        url.query_pairs_mut().extend_pairs(query.iter().copied());
        let response = self
            .client
            .get(url.clone())
            .header(reqwest::header::AUTHORIZATION, self.authorization.clone())
            .send()
            .await
            .map_err(|error| ConfluenceError::Http(error.to_string()))?;
        let status = response.status().as_u16();
        let bytes = response
            .bytes()
            .await
            .map_err(|error| ConfluenceError::Http(error.to_string()))?;
        let decoded = decode_json_record(&bytes);
        let JsonRecordDecodeResult::Ok { value, bytes } = decoded else {
            return Err(ConfluenceError::NonObjectJson);
        };
        Ok(AcquisitionRecord {
            method: "GET",
            url,
            status,
            bytes: bytes as u64,
            body: value,
        })
    }
}

#[derive(Debug, Clone)]
pub struct ConfluenceClient {
    http: reqwest::Client,
    base_url: String,
    authorization: String,
}

impl ConfluenceClient {
    pub fn new(input: ConfluenceClientInput) -> Result<Self, ConfluenceError> {
        let base_url = normalize_base_url(&input.base_url)?;
        let http = reqwest::Client::builder()
            .danger_accept_invalid_certs(input.insecure)
            .timeout(std::time::Duration::from_millis(DEFAULT_REMOTE_TIMEOUT_MS))
            .build()
            .map_err(|error| ConfluenceError::Http(error.to_string()))?;
        Ok(Self {
            http,
            base_url,
            authorization: format!("Bearer {}", input.token),
        })
    }

    pub async fn get_page_metadata(&self, page_id: &str) -> AcquisitionResult {
        self.acquire_json(&format!("/rest/api/content/{page_id}?expand=space"))
            .await
    }

    pub async fn get_page_storage(&self, page_id: &str) -> AcquisitionResult {
        self.acquire_json(&format!("/rest/api/content/{page_id}?expand=body.storage"))
            .await
    }

    pub async fn list_child_pages(&self, page_id: &str) -> AcquisitionResult {
        self.acquire_paginated(&format!(
            "/rest/api/content/{page_id}/child/page?limit=200&expand=space"
        ))
        .await
    }

    pub async fn find_title_candidates(&self, discovery: &TitleDiscovery) -> AcquisitionResult {
        let mut url = Url::parse("http://local/rest/api/content").expect("static URL");
        url.query_pairs_mut()
            .append_pair("type", "page")
            .append_pair("title", &discovery.title);
        if let Some(space_key) = &discovery.space_key {
            url.query_pairs_mut().append_pair("spaceKey", space_key);
        }
        url.query_pairs_mut()
            .append_pair("limit", "200")
            .append_pair("expand", "space");
        let path_and_query = format!(
            "{}?{}",
            url.path(),
            url.query().expect("query is populated")
        );
        self.acquire_paginated(&path_and_query).await
    }

    pub async fn get_attachment_metadata(&self, page_id: &str) -> AcquisitionResult {
        self.acquire_paginated(&format!(
            "/rest/api/content/{page_id}/child/attachment?limit=200"
        ))
        .await
    }

    async fn acquire_paginated(&self, first_path_and_query: &str) -> AcquisitionResult {
        let mut current = Some(first_path_and_query.to_owned());
        let mut bytes = 0usize;
        let mut results = Vec::new();
        let mut last_body = None;

        while let Some(path_and_query) = current {
            let page = self.acquire_json(&path_and_query).await;
            let AcquisitionResult::Ok {
                body,
                bytes: page_bytes,
                ..
            } = page
            else {
                return page;
            };
            bytes += page_bytes;
            if let Some(page_results) = body.get("results").and_then(Value::as_array) {
                results.extend(page_results.iter().cloned());
            }
            let next = next_path_and_query(&body);
            match next {
                NextPath::Ok(next) => current = Some(next),
                NextPath::Absent => current = None,
                NextPath::Failed => {
                    return AcquisitionResult::Failed {
                        reason: AcquisitionFailureReason::InvalidNext,
                    }
                }
            }
            last_body = Some(body);
        }

        let mut body = last_body.unwrap_or_else(|| Value::Object(Default::default()));
        if let Value::Object(object) = &mut body {
            object.insert("results".to_owned(), Value::Array(results));
        }

        AcquisitionResult::Ok {
            body,
            bytes,
            complete: true,
        }
    }

    async fn acquire_json(&self, path_and_query: &str) -> AcquisitionResult {
        let url = match governed_url(&self.base_url, path_and_query) {
            Ok(url) => url,
            Err(_) => {
                return AcquisitionResult::Failed {
                    reason: AcquisitionFailureReason::InvalidNext,
                }
            }
        };
        let response = match self
            .http
            .get(url)
            .header(reqwest::header::AUTHORIZATION, self.authorization.clone())
            .send()
            .await
        {
            Ok(response) => response,
            Err(_) => {
                return AcquisitionResult::Failed {
                    reason: AcquisitionFailureReason::HttpStatus,
                }
            }
        };
        if response.status().as_u16() != 200 {
            return AcquisitionResult::Failed {
                reason: AcquisitionFailureReason::HttpStatus,
            };
        }
        let bytes = match response.bytes().await {
            Ok(bytes) => bytes,
            Err(_) => {
                return AcquisitionResult::Failed {
                    reason: AcquisitionFailureReason::HttpStatus,
                }
            }
        };
        match decode_json_record(&bytes) {
            JsonRecordDecodeResult::Ok { value, bytes } => AcquisitionResult::Ok {
                complete: matches!(next_path_and_query(&value), NextPath::Absent),
                body: value,
                bytes,
            },
            JsonRecordDecodeResult::Failed { reason } => AcquisitionResult::Failed { reason },
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ConfluenceClientInput {
    pub base_url: String,
    pub token: String,
    pub insecure: bool,
}

pub fn decode_json_record(body: &[u8]) -> JsonRecordDecodeResult {
    let text = match std::str::from_utf8(body) {
        Ok(text) => text,
        Err(_) => {
            return JsonRecordDecodeResult::Failed {
                reason: AcquisitionFailureReason::InvalidUtf8,
            }
        }
    };
    let value = match serde_json::from_str::<Value>(text) {
        Ok(value) => value,
        Err(_) => {
            return JsonRecordDecodeResult::Failed {
                reason: AcquisitionFailureReason::InvalidJson,
            }
        }
    };
    if !value.is_object() {
        return JsonRecordDecodeResult::Failed {
            reason: AcquisitionFailureReason::NonObjectJson,
        };
    }
    JsonRecordDecodeResult::Ok {
        value,
        bytes: body.len(),
    }
}

pub fn resolve_remote_access_context(env: &EnvMap, policy: TransportPolicy) -> RemoteAccessContext {
    let base_url_value = env.get("CONFLUEX_CONFLUENCE_BASE_URL");
    let token = env.get("CONFLUEX_CONFLUENCE_TOKEN");

    let Some(base_url_value) = base_url_value.filter(|value| valid_environment_value(value)) else {
        return RemoteAccessContext::Unusable {
            reason: RemoteAccessFailureReason::MissingBaseUrl,
        };
    };
    let Some(base_url) = parse_usable_base_url(base_url_value, policy) else {
        return RemoteAccessContext::Unusable {
            reason: RemoteAccessFailureReason::InvalidBaseUrl,
        };
    };
    let Some(token) = token.filter(|value| valid_environment_value(value)) else {
        return RemoteAccessContext::Unusable {
            reason: RemoteAccessFailureReason::MissingToken,
        };
    };

    RemoteAccessContext::Usable {
        base_url,
        token: token.to_owned(),
        authorization: format!("Bearer {token}"),
        transport_policy: policy,
    }
}

pub async fn check_root_page_access(
    page_id: &str,
    env: &EnvMap,
    policy: TransportPolicy,
) -> RootPageAccessResult {
    let context = resolve_remote_access_context(env, policy);
    let RemoteAccessContext::Usable {
        base_url,
        authorization,
        transport_policy,
        ..
    } = context
    else {
        return RootPageAccessResult::Failed {
            reason: context_failure_reason(&context),
        };
    };

    let url = match root_page_url(&base_url, page_id) {
        Ok(url) => url,
        Err(_) => {
            return RootPageAccessResult::Failed {
                reason: RemoteOperationFailureReason::InvalidBaseUrl,
            }
        }
    };
    match get(
        &url,
        &authorization,
        transport_policy,
        RequestLimits::default(),
    )
    .await
    {
        Ok(response) if response.status_code == Some(200) => {
            let decoded = decode_json_record(&response.body);
            let JsonRecordDecodeResult::Ok { value, bytes } = decoded else {
                return RootPageAccessResult::Failed {
                    reason: RemoteOperationFailureReason::PageInaccessible,
                };
            };
            let Some(id) = value
                .get("id")
                .and_then(Value::as_str)
                .filter(|id| is_canonical_page_id(id))
            else {
                return RootPageAccessResult::Failed {
                    reason: RemoteOperationFailureReason::PageInaccessible,
                };
            };
            RootPageAccessResult::Ok {
                identity: id.to_owned(),
                metadata: extract_page_metadata(&value),
                metadata_bytes: bytes,
            }
        }
        Ok(response) => RootPageAccessResult::Failed {
            reason: classify_http_failure(response.status_code),
        },
        Err(reason) => RootPageAccessResult::Failed { reason },
    }
}

pub async fn check_current_user_access(
    env: &EnvMap,
    policy: TransportPolicy,
) -> CurrentUserAccessResult {
    let context = resolve_remote_access_context(env, policy);
    let RemoteAccessContext::Usable {
        base_url,
        authorization,
        transport_policy,
        ..
    } = &context
    else {
        return CurrentUserAccessResult::Failed {
            reason: context_failure_reason(&context),
        };
    };

    let url = match current_user_url(base_url) {
        Ok(url) => url,
        Err(_) => {
            return CurrentUserAccessResult::Failed {
                reason: RemoteOperationFailureReason::InvalidBaseUrl,
            }
        }
    };

    match get(
        &url,
        authorization,
        *transport_policy,
        RequestLimits::default(),
    )
    .await
    {
        Ok(response) if response.status_code == Some(200) => {
            match decode_json_record(&response.body) {
                JsonRecordDecodeResult::Ok { value, .. }
                    if value.get("type").and_then(Value::as_str) == Some("known") =>
                {
                    CurrentUserAccessResult::Ok {
                        base_url: base_url.clone(),
                    }
                }
                _ => CurrentUserAccessResult::Failed {
                    reason: RemoteOperationFailureReason::AuthRejected,
                },
            }
        }
        Ok(response) => CurrentUserAccessResult::Failed {
            reason: classify_http_failure(response.status_code),
        },
        Err(reason) => CurrentUserAccessResult::Failed { reason },
    }
}

pub async fn list_child_pages(
    page_id: &str,
    env: &EnvMap,
    policy: TransportPolicy,
) -> PageListResult {
    let Some((base_url, authorization, policy)) = usable_context_parts(env, policy) else {
        return PageListResult::Failed;
    };
    let url = match child_pages_url(&base_url, page_id) {
        Ok(url) => url,
        Err(_) => return PageListResult::Failed,
    };
    let Ok(response) = get(&url, &authorization, policy, RequestLimits::default()).await else {
        return PageListResult::Failed;
    };
    if response.status_code != Some(200) {
        return PageListResult::Failed;
    }
    page_list_from_response(response)
}

pub async fn find_title_candidates(
    discovery: &TitleDiscovery,
    env: &EnvMap,
    policy: TransportPolicy,
) -> PageListResult {
    if discovery.title.is_empty() || discovery.space_key.as_deref() == Some("") {
        return PageListResult::Failed;
    }
    let Some((base_url, authorization, policy)) = usable_context_parts(env, policy) else {
        return PageListResult::Failed;
    };
    let url = match title_candidates_url(&base_url, discovery) {
        Ok(url) => url,
        Err(_) => return PageListResult::Failed,
    };
    let Ok(response) = get(&url, &authorization, policy, RequestLimits::default()).await else {
        return PageListResult::Failed;
    };
    if response.status_code != Some(200) {
        return PageListResult::Failed;
    }
    page_list_from_response(response)
}

pub async fn get_page_storage_content(
    page_id: &str,
    env: &EnvMap,
    policy: TransportPolicy,
) -> PageStorageResult {
    let Some((base_url, authorization, policy)) = usable_context_parts(env, policy) else {
        return PageStorageResult::Failed;
    };
    let url = match page_storage_url(&base_url, page_id) {
        Ok(url) => url,
        Err(_) => return PageStorageResult::Failed,
    };
    let Ok(response) = get(&url, &authorization, policy, RequestLimits::default()).await else {
        return PageStorageResult::Failed;
    };
    if response.status_code != Some(200) {
        return PageStorageResult::Failed;
    }
    let JsonRecordDecodeResult::Ok { value, bytes } = decode_json_record(&response.body) else {
        return PageStorageResult::Failed;
    };
    if value.get("id").and_then(Value::as_str) != Some(page_id) {
        return PageStorageResult::Failed;
    }
    let Some(storage) = value
        .get("body")
        .and_then(|body| body.get("storage"))
        .and_then(|storage| storage.get("value"))
        .and_then(Value::as_str)
    else {
        return PageStorageResult::Failed;
    };
    PageStorageResult::Ok {
        storage: storage.to_owned(),
        metadata_bytes: bytes,
    }
}

pub async fn get_attachment_preview(
    page_id: &str,
    env: &EnvMap,
    policy: TransportPolicy,
) -> AttachmentPreviewResult {
    let response = match attachment_metadata_response(page_id, env, policy).await {
        Some(response) => response,
        None => return AttachmentPreviewResult::Failed,
    };
    let JsonRecordDecodeResult::Ok { value, bytes } = decode_json_record(&response.body) else {
        return AttachmentPreviewResult::Failed;
    };
    if has_next_link(&value) {
        return AttachmentPreviewResult::Failed;
    }
    let Some(results) = value.get("results").and_then(Value::as_array) else {
        return AttachmentPreviewResult::Failed;
    };
    AttachmentPreviewResult::Ok {
        count: results.len(),
        preview: attachment_preview_text(results),
        metadata_bytes: bytes,
    }
}

pub async fn get_attachment_data(
    page_id: &str,
    env: &EnvMap,
    policy: TransportPolicy,
) -> AttachmentDataResult {
    let response = match attachment_metadata_response(page_id, env, policy).await {
        Some(response) => response,
        None => return AttachmentDataResult::Failed,
    };
    let JsonRecordDecodeResult::Ok { value, bytes } = decode_json_record(&response.body) else {
        return AttachmentDataResult::Failed;
    };
    if has_next_link(&value) {
        return AttachmentDataResult::Failed;
    }
    let Some(results) = value.get("results").and_then(Value::as_array) else {
        return AttachmentDataResult::Failed;
    };
    let mut items = Vec::new();
    for result in results {
        let Some(item) = attachment_data_item(result) else {
            return AttachmentDataResult::Failed;
        };
        items.push(item);
    }
    AttachmentDataResult::Ok {
        items,
        metadata_bytes: bytes,
    }
}

pub async fn download_attachment_payload(
    download_url: &str,
    env: &EnvMap,
    policy: TransportPolicy,
    limits: Option<AttachmentDownloadLimits>,
) -> AttachmentPayloadResult {
    let Some((base_url, authorization, policy)) = usable_context_parts(env, policy) else {
        return AttachmentPayloadResult::Failed;
    };
    let Some(url) = governed_attachment_download_url(&base_url, download_url) else {
        return AttachmentPayloadResult::Failed;
    };
    let request_limits = attachment_request_limits(limits);
    match get(&url, &authorization, policy, request_limits).await {
        Ok(response) if response.status_code == Some(200) => AttachmentPayloadResult::Ok {
            bytes: response.body,
        },
        Err(RemoteOperationFailureReason::PageInaccessible) if limits.is_some() => {
            AttachmentPayloadResult::DownloadLimitReached
        }
        _ => AttachmentPayloadResult::Failed,
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HttpResponse {
    pub status_code: Option<u16>,
    pub body: Vec<u8>,
}

async fn get(
    url: &Url,
    authorization: &str,
    policy: TransportPolicy,
    limits: RequestLimits,
) -> Result<HttpResponse, RemoteOperationFailureReason> {
    let http = reqwest::Client::builder()
        .danger_accept_invalid_certs(policy.insecure)
        .timeout(std::time::Duration::from_millis(limits.timeout_ms))
        .build()
        .map_err(classify_reqwest_failure)?;
    let response = http
        .get(url.clone())
        .header(reqwest::header::AUTHORIZATION, authorization)
        .send()
        .await
        .map_err(classify_reqwest_failure)?;
    let status_code = Some(response.status().as_u16());
    let bytes = response.bytes().await.map_err(classify_reqwest_failure)?;
    if bytes.len() > limits.max_buffered_bytes {
        return Err(RemoteOperationFailureReason::PageInaccessible);
    }
    Ok(HttpResponse {
        status_code,
        body: bytes.to_vec(),
    })
}

fn page_list_from_response(response: HttpResponse) -> PageListResult {
    let JsonRecordDecodeResult::Ok { value, bytes } = decode_json_record(&response.body) else {
        return PageListResult::Failed;
    };
    let Some(results) = value.get("results").and_then(Value::as_array) else {
        return PageListResult::Failed;
    };
    let mut pages = Vec::new();
    for result in results {
        let Some(metadata) = extract_page_metadata(result) else {
            return PageListResult::Failed;
        };
        pages.push(metadata);
    }
    PageListResult::Ok {
        complete: !has_next_link(&value),
        pages,
        metadata_bytes: bytes,
    }
}

async fn attachment_metadata_response(
    page_id: &str,
    env: &EnvMap,
    policy: TransportPolicy,
) -> Option<HttpResponse> {
    let (base_url, authorization, policy) = usable_context_parts(env, policy)?;
    let url = attachment_preview_url(&base_url, page_id).ok()?;
    let response = get(&url, &authorization, policy, RequestLimits::default())
        .await
        .ok()?;
    (response.status_code == Some(200)).then_some(response)
}

fn usable_context_parts(
    env: &EnvMap,
    policy: TransportPolicy,
) -> Option<(String, String, TransportPolicy)> {
    match resolve_remote_access_context(env, policy) {
        RemoteAccessContext::Usable {
            base_url,
            authorization,
            transport_policy,
            ..
        } => Some((base_url, authorization, transport_policy)),
        RemoteAccessContext::Unusable { .. } => None,
    }
}

fn valid_environment_value(value: &str) -> bool {
    !value.is_empty() && !value.contains(['\t', '\n', '\r'])
}

fn parse_usable_base_url(value: &str, policy: TransportPolicy) -> Option<String> {
    let url = Url::parse(value).ok()?;
    if url.scheme() != "http" && url.scheme() != "https" {
        return None;
    }
    if url.scheme() == "http" && !policy.insecure {
        return None;
    }
    if !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return None;
    }
    let path = url.path();
    if path != "/" && (!path.starts_with('/') || path.ends_with('/')) {
        return None;
    }
    let suffix = if path == "/" { "" } else { path };
    Some(
        format!(
            "{}://{}{}",
            url.scheme(),
            url.host_str()?,
            url.port()
                .map(|port| format!(":{port}"))
                .unwrap_or_default(),
        ) + suffix,
    )
}

fn normalize_base_url(value: &str) -> Result<String, ConfluenceError> {
    let url = Url::parse(value).map_err(|error| ConfluenceError::InvalidUrl(error.to_string()))?;
    let path = if url.path() == "/" { "" } else { url.path() };
    let host = url
        .host_str()
        .ok_or_else(|| ConfluenceError::InvalidUrl("missing host".to_owned()))?;
    Ok(format!(
        "{}://{}{}{}",
        url.scheme(),
        host,
        url.port()
            .map(|port| format!(":{port}"))
            .unwrap_or_default(),
        path
    ))
}

fn governed_url(base_url: &str, path_and_query: &str) -> Result<Url, ConfluenceError> {
    if !path_and_query.starts_with('/')
        || path_and_query.starts_with("//")
        || path_and_query.contains('#')
        || has_scheme_prefix(path_and_query)
    {
        return Err(ConfluenceError::InvalidUrl(path_and_query.to_owned()));
    }
    let base =
        Url::parse(base_url).map_err(|error| ConfluenceError::InvalidUrl(error.to_string()))?;
    let prefix = if base.path() == "/" { "" } else { base.path() };
    Url::parse(&format!(
        "{}://{}{}{}{}",
        base.scheme(),
        base.host_str().unwrap_or_default(),
        base.port()
            .map(|port| format!(":{port}"))
            .unwrap_or_default(),
        prefix,
        path_and_query
    ))
    .map_err(|error| ConfluenceError::InvalidUrl(error.to_string()))
}

fn root_page_url(base_url: &str, page_id: &str) -> Result<Url, ConfluenceError> {
    governed_url(base_url, &format!("/rest/api/content/{page_id}"))
}

fn current_user_url(base_url: &str) -> Result<Url, ConfluenceError> {
    governed_url(base_url, "/rest/api/user/current")
}

fn child_pages_url(base_url: &str, page_id: &str) -> Result<Url, ConfluenceError> {
    governed_url(
        base_url,
        &format!("/rest/api/content/{page_id}/child/page?limit=200&expand=space"),
    )
}

fn page_storage_url(base_url: &str, page_id: &str) -> Result<Url, ConfluenceError> {
    governed_url(
        base_url,
        &format!("/rest/api/content/{page_id}?expand=body.storage"),
    )
}

fn attachment_preview_url(base_url: &str, page_id: &str) -> Result<Url, ConfluenceError> {
    governed_url(
        base_url,
        &format!("/rest/api/content/{page_id}/child/attachment?limit=200"),
    )
}

fn title_candidates_url(
    base_url: &str,
    discovery: &TitleDiscovery,
) -> Result<Url, ConfluenceError> {
    let mut url = governed_url(base_url, "/rest/api/content")?;
    url.query_pairs_mut()
        .append_pair("type", "page")
        .append_pair("title", &discovery.title);
    if let Some(space_key) = &discovery.space_key {
        url.query_pairs_mut().append_pair("spaceKey", space_key);
    }
    url.query_pairs_mut()
        .append_pair("limit", "200")
        .append_pair("expand", "space");
    Ok(url)
}

enum NextPath {
    Ok(String),
    Failed,
    Absent,
}

fn next_path_and_query(body: &Value) -> NextPath {
    let Some(next) = body
        .get("_links")
        .and_then(|links| links.get("next"))
        .and_then(Value::as_str)
    else {
        return NextPath::Absent;
    };
    if !next.starts_with('/')
        || next.starts_with("//")
        || next.contains('#')
        || has_scheme_prefix(next)
    {
        return NextPath::Failed;
    }
    NextPath::Ok(next.to_owned())
}

fn classify_http_failure(status_code: Option<u16>) -> RemoteOperationFailureReason {
    if matches!(status_code, Some(401 | 403)) {
        RemoteOperationFailureReason::AuthRejected
    } else {
        RemoteOperationFailureReason::PageInaccessible
    }
}

fn classify_reqwest_failure(error: reqwest::Error) -> RemoteOperationFailureReason {
    let text = error.to_string().to_ascii_lowercase();
    if error.is_timeout() {
        return RemoteOperationFailureReason::TransportTimeout;
    }
    if error.is_connect() && (text.contains("dns") || text.contains("resolve")) {
        return RemoteOperationFailureReason::TransportDns;
    }
    if text.contains("certificate") || text.contains("tls") {
        return RemoteOperationFailureReason::TransportTls;
    }
    if text.contains("proxy") {
        return RemoteOperationFailureReason::TransportProxy;
    }
    if text.contains("connection reset") || text.contains("reset by peer") {
        return RemoteOperationFailureReason::TransportConnectionReset;
    }
    RemoteOperationFailureReason::PageInaccessible
}

fn context_failure_reason(context: &RemoteAccessContext) -> RemoteOperationFailureReason {
    match context {
        RemoteAccessContext::Usable { .. } => RemoteOperationFailureReason::PageInaccessible,
        RemoteAccessContext::Unusable { reason } => reason.clone().into(),
    }
}

fn is_canonical_page_id(value: &str) -> bool {
    value == "0"
        || value
            .chars()
            .next()
            .is_some_and(|first| first.is_ascii_digit() && first != '0')
            && value.chars().all(|character| character.is_ascii_digit())
}

fn extract_page_metadata(body: &Value) -> Option<PageMetadata> {
    let page_id = body.get("id").and_then(Value::as_str)?;
    let page_title = body.get("title").and_then(Value::as_str)?;
    if page_title.is_empty() {
        return None;
    }
    let space_key = body
        .get("space")
        .and_then(|space| space.get("key"))
        .and_then(Value::as_str)
        .filter(|key| !key.is_empty())
        .map(str::to_owned);
    Some(PageMetadata {
        page_id: page_id.to_owned(),
        page_title: page_title.to_owned(),
        space_key,
    })
}

fn attachment_preview_text(results: &[Value]) -> String {
    let mut lines = vec![format!("attachment_count={}", results.len())];
    lines.extend(
        results
            .iter()
            .map(|result| format!("source_filename={}", attachment_source_filename(result))),
    );
    lines.push(String::new());
    lines.join("\n")
}

fn attachment_data_item(result: &Value) -> Option<AttachmentDataItem> {
    let filename = result
        .get("title")
        .and_then(Value::as_str)
        .filter(|title| !title.is_empty())?;
    let download = result
        .get("_links")
        .and_then(|links| links.get("download"))
        .and_then(Value::as_str)
        .filter(|download| !download.is_empty())?;
    let download_url = attachment_download_path_and_query(download)?;
    Some(AttachmentDataItem {
        filename: single_line(filename),
        download_url,
        content_type: attachment_content_type(result),
    })
}

fn attachment_content_type(result: &Value) -> Option<String> {
    [
        result
            .get("metadata")
            .and_then(|metadata| metadata.get("mediaType")),
        result
            .get("extensions")
            .and_then(|extensions| extensions.get("mediaType")),
    ]
    .into_iter()
    .flatten()
    .filter_map(Value::as_str)
    .map(str::trim)
    .find(|candidate| !candidate.is_empty())
    .map(single_line)
}

fn attachment_download_path_and_query(download: &str) -> Option<String> {
    if download.is_empty()
        || !download.starts_with('/')
        || download.starts_with("//")
        || download.contains('#')
        || has_scheme_prefix(download)
    {
        return None;
    }
    let path_part = download
        .split_once('?')
        .map(|(path, _)| path)
        .unwrap_or(download);
    if has_traversal_segment(path_part) {
        return None;
    }
    Some(download.to_owned())
}

fn attachment_request_limits(limits: Option<AttachmentDownloadLimits>) -> RequestLimits {
    match limits {
        Some(limits) => RequestLimits {
            timeout_ms: DEFAULT_REMOTE_TIMEOUT_MS,
            max_buffered_bytes: limits.max_bytes,
        },
        None => RequestLimits::default(),
    }
}

fn governed_attachment_download_url(base_url: &str, download_url: &str) -> Option<Url> {
    let base = Url::parse(base_url).ok()?;
    let url = Url::parse(&format!("{base_url}{download_url}")).ok()?;
    if url.origin() != base.origin()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.fragment().is_some()
    {
        return None;
    }
    let prefix = if base.path() == "/" { "" } else { base.path() };
    if !prefix.is_empty() && url.path() != prefix && !url.path().starts_with(&format!("{prefix}/"))
    {
        return None;
    }
    if has_traversal_segment(url.path()) {
        return None;
    }
    Some(url)
}

fn has_traversal_segment(path_value: &str) -> bool {
    path_value.split('/').any(|segment| {
        percent_decode(segment)
            .map(|decoded| decoded == "." || decoded == "..")
            .unwrap_or(true)
    })
}

fn attachment_source_filename(result: &Value) -> String {
    result
        .get("title")
        .and_then(Value::as_str)
        .filter(|title| !title.is_empty())
        .map(single_line)
        .unwrap_or_else(|| "none".to_owned())
}

fn single_line(value: &str) -> String {
    value.replace(['\t', '\n', '\r'], " ")
}

fn has_next_link(body: &Value) -> bool {
    body.get("_links")
        .and_then(|links| links.get("next"))
        .and_then(Value::as_str)
        .is_some_and(|next| !next.is_empty())
}

fn has_scheme_prefix(value: &str) -> bool {
    let mut chars = value.chars();
    let Some(first) = chars.next() else {
        return false;
    };
    if !first.is_ascii_alphabetic() {
        return false;
    }
    for character in chars {
        if character == ':' {
            return true;
        }
        if !(character.is_ascii_alphanumeric() || matches!(character, '+' | '.' | '-')) {
            return false;
        }
    }
    false
}

fn percent_decode(value: &str) -> Option<String> {
    let bytes = value.as_bytes();
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
