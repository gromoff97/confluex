//! Markdown exporter interface and compatibility seam.

use std::collections::BTreeMap;
use std::process::Stdio;
use std::time::Duration;

use camino::{Utf8Path, Utf8PathBuf};
use serde_json::json;
use thiserror::Error;
use tokio::process::Command;
use tokio::time::timeout;
use url::Url;

use crate::security::redact_known_secrets;

const EXPORTER_PACKAGE: &str = "confluence-markdown-exporter==5.0.0";
const EXPORTER_TIMEOUT: Duration = Duration::from_secs(120);
const MARKDOWN_PAYLOAD_MAX_BYTES: u64 = 64 * 1024 * 1024;
const DEBUG_TEXT_MAX_BYTES: usize = 1024 * 1024;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MarkdownExportInput {
    pub base_url: String,
    pub page_id: String,
    pub token: String,
    pub work_dir: Utf8PathBuf,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MarkdownExportOutput {
    pub markdown: String,
    pub diagnostics: Vec<String>,
}

#[derive(Debug, Error)]
pub enum MarkdownExportError {
    #[error("markdown exporter process failed: {0}")]
    Process(String),
    #[error("markdown payload exceeded byte cap")]
    ByteCap,
    #[error("markdown exporter cleanup failed: {0}")]
    Cleanup(String),
}

#[allow(async_fn_in_trait)]
pub trait MarkdownExporter {
    async fn export(
        &self,
        input: MarkdownExportInput,
    ) -> Result<MarkdownExportOutput, MarkdownExportError>;
}

#[derive(Debug, Clone, Default)]
pub struct ExternalMarkdownExporter;

impl MarkdownExporter for ExternalMarkdownExporter {
    async fn export(
        &self,
        input: MarkdownExportInput,
    ) -> Result<MarkdownExportOutput, MarkdownExportError> {
        let output_dir = input.work_dir.join("out");
        let config_path = input.work_dir.join("cme-config.json");
        tokio::fs::create_dir_all(&output_dir)
            .await
            .map_err(|error| MarkdownExportError::Process(error.to_string()))?;
        write_exporter_config(&config_path, &input, &output_dir).await?;

        let args = markdown_exporter_args(&input.base_url, &input.page_id)?;
        let command_result =
            run_exporter(&args, &config_path, std::slice::from_ref(&input.token)).await?;
        if command_result.exit_code != Some(0) {
            return Err(MarkdownExportError::Process(command_result.stderr));
        }

        let payload_path = output_dir.join(format!("{}.md", input.page_id));
        let markdown = read_markdown_payload_within_cap(&payload_path).await?;
        Ok(MarkdownExportOutput {
            markdown,
            diagnostics: Vec::new(),
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MarkdownExporterProcessResult {
    pub args: Vec<String>,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
}

pub fn markdown_exporter_args(
    base_url: &str,
    page_id: &str,
) -> Result<Vec<String>, MarkdownExportError> {
    Ok(vec![
        "--from".to_owned(),
        EXPORTER_PACKAGE.to_owned(),
        "cme".to_owned(),
        "page".to_owned(),
        page_view_url(base_url, page_id)?,
    ])
}

async fn write_exporter_config(
    config_path: &Utf8Path,
    input: &MarkdownExportInput,
    output_dir: &Utf8Path,
) -> Result<(), MarkdownExportError> {
    let mut confluence = BTreeMap::new();
    confluence.insert(
        input.base_url.clone(),
        json!({
            "username": "",
            "api_token": "",
            "pat": input.token,
            "cloud_id": ""
        }),
    );
    let config = json!({
        "export": {
            "output_path": output_dir.as_str(),
            "page_path": "{page_id}.md",
            "attachment_path": "attachments/{attachment_title}{attachment_extension}",
            "skip_unchanged": false,
            "cleanup_stale": false,
            "page_breadcrumbs": false,
            "include_document_title": false,
            "enable_jira_enrichment": false
        },
        "connection_config": {
            "use_v2_api": false,
            "verify_ssl": true,
            "max_workers": 1
        },
        "auth": {
            "confluence": confluence,
            "jira": {}
        }
    });
    let text = serde_json::to_string_pretty(&config)
        .map_err(|error| MarkdownExportError::Process(error.to_string()))?;
    tokio::fs::write(config_path, format!("{text}\n"))
        .await
        .map_err(|error| MarkdownExportError::Process(error.to_string()))
}

async fn run_exporter(
    args: &[String],
    config_path: &Utf8Path,
    secrets: &[String],
) -> Result<MarkdownExporterProcessResult, MarkdownExportError> {
    let mut command = Command::new("uvx");
    command
        .args(args)
        .env_clear()
        .envs(allowed_child_env())
        .env("CME_CONFIG_PATH", config_path.as_str())
        .env("CI", "true")
        .env("NO_COLOR", "1")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let output = timeout(EXPORTER_TIMEOUT, command.output())
        .await
        .map_err(|_| MarkdownExportError::Process("exporter timed out".to_owned()))?
        .map_err(|error| MarkdownExportError::Process(error.to_string()))?;

    Ok(MarkdownExporterProcessResult {
        args: args.to_vec(),
        stdout: cap_debug_text(&redact_known_secrets(
            &String::from_utf8_lossy(&output.stdout),
            secrets,
        )),
        stderr: cap_debug_text(&redact_known_secrets(
            &String::from_utf8_lossy(&output.stderr),
            secrets,
        )),
        exit_code: output.status.code(),
    })
}

async fn read_markdown_payload_within_cap(
    payload_path: &Utf8Path,
) -> Result<String, MarkdownExportError> {
    let metadata = tokio::fs::metadata(payload_path)
        .await
        .map_err(|error| MarkdownExportError::Process(error.to_string()))?;
    if metadata.len() > MARKDOWN_PAYLOAD_MAX_BYTES {
        return Err(MarkdownExportError::ByteCap);
    }
    let bytes = tokio::fs::read(payload_path)
        .await
        .map_err(|error| MarkdownExportError::Process(error.to_string()))?;
    if bytes.len() as u64 > MARKDOWN_PAYLOAD_MAX_BYTES {
        return Err(MarkdownExportError::ByteCap);
    }
    String::from_utf8(bytes).map_err(|error| MarkdownExportError::Process(error.to_string()))
}

fn page_view_url(base_url: &str, page_id: &str) -> Result<String, MarkdownExportError> {
    let mut url = Url::parse(&format!(
        "{}/pages/viewpage.action",
        base_url.trim_end_matches('/')
    ))
    .map_err(|error| MarkdownExportError::Process(error.to_string()))?;
    url.query_pairs_mut().append_pair("pageId", page_id);
    Ok(url.to_string())
}

fn allowed_child_env() -> BTreeMap<String, String> {
    let allowlist = [
        "PATH",
        "PATHEXT",
        "HOME",
        "USERPROFILE",
        "SYSTEMROOT",
        "SystemRoot",
        "COMSPEC",
        "ComSpec",
    ];
    allowlist
        .into_iter()
        .filter_map(|key| std::env::var(key).ok().map(|value| (key.to_owned(), value)))
        .collect()
}

fn cap_debug_text(value: &str) -> String {
    if value.len() <= DEBUG_TEXT_MAX_BYTES {
        return value.to_owned();
    }
    let mut end = DEBUG_TEXT_MAX_BYTES;
    while !value.is_char_boundary(end) {
        end -= 1;
    }
    format!("{}\n[truncated]\n", &value[..end])
}
