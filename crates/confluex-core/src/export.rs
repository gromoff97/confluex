//! Rust export orchestration entry point.

use std::time::SystemTime;

use camino::Utf8PathBuf;

use crate::cli::ExportRequest;
use crate::config::{
    apply_effective_configuration, load_explicit_json_config, load_user_config, EnvMap, JsonConfig,
    LoadedJsonConfig,
};
use crate::confluence::{
    check_root_page_access, RemoteOperationFailureReason, RootPageAccessResult, TransportPolicy,
};
use crate::output::{
    claim_fresh_output_root, ensure_directory_no_follow, page_payload_folder, quote_path_string,
    select_output_root, write_file_no_follow_atomic, ExecutionMode as OutputExecutionMode,
    OutputRootClaim, OutputRootSelection,
};
use crate::reports::{
    run_report_texts, DiscoverySource, DownloadedMibValues, ExecutionMode as ReportExecutionMode,
    FailedPageRow, FinalStatus, InterruptReason, ManifestRow, RunReportInput, ScopeTrust,
    REPORT_FILE_ORDER,
};
use crate::runtime::{CliOutcome, ExitCode};

const UNBOUNDED_RUN_WARNING: &str =
    "WARNING: unbounded_run use --max-pages or --max-download-mib\n";
const INSECURE_TRANSPORT_WARNING: &str =
    "WARNING: insecure_transport TLS verification disabled or HTTP transport allowed\n";

pub async fn run_export(request: ExportRequest) -> CliOutcome {
    match run_export_inner(request).await {
        Ok(outcome) => outcome,
        Err(error) => CliOutcome {
            exit: error.exit,
            stdout: String::new(),
            stderr: error.stderr,
        },
    }
}

async fn run_export_inner(request: ExportRequest) -> Result<CliOutcome, ExportFailure> {
    validate_export_request(&request)?;
    let page_id = request
        .page_id
        .clone()
        .ok_or_else(|| diagnostic_failure("ERROR: missing_required_option --page-id\n"))?;
    let env = EnvMap::from_current_process();
    let cwd = current_utf8_dir()?;
    let request_had_output_root = request.output_root.is_some();

    let explicit_config = load_optional_explicit_config(&request, &cwd)?;
    let user_config = load_optional_user_config(&env)?;
    let effective = apply_effective_configuration(request, &explicit_config, &user_config, &env);
    let request = effective.request;
    let output_path_provenance = if request_had_output_root {
        "explicit"
    } else if request.output_root.is_some() {
        "configured"
    } else {
        "generated"
    };
    let execution_mode = if request.plan_only {
        OutputExecutionMode::PlanOnly
    } else {
        OutputExecutionMode::Materialized
    };
    let output_root = select_output_root(
        execution_mode,
        &page_id,
        request.output_root.as_deref(),
        request.resume,
        &cwd,
        SystemTime::now(),
    );
    let output_root = match output_root {
        OutputRootSelection::Ok(output_root) => output_root,
        OutputRootSelection::Rejected { requirement_id } => {
            return Err(validation_failure(requirement_id));
        }
    };

    let env = effective_env(
        &env,
        effective.confluence_base_url,
        effective.confluence_token,
    );
    let mut stderr = String::new();
    if request.insecure {
        stderr.push_str(INSECURE_TRANSPORT_WARNING);
    }
    if request.max_pages.is_none() && request.max_download_mib.is_none() {
        stderr.push_str(UNBOUNDED_RUN_WARNING);
    }

    let access = check_root_page_access(
        &page_id,
        &env,
        TransportPolicy {
            insecure: request.insecure,
        },
    )
    .await;
    let (identity, metadata, metadata_bytes) = match access {
        RootPageAccessResult::Ok {
            identity,
            metadata,
            metadata_bytes,
        } => (identity, metadata, metadata_bytes),
        RootPageAccessResult::Failed { reason } => {
            return Err(root_page_failure(&page_id, reason));
        }
    };

    if request.resume {
        return Err(validation_failure("FR-0103"));
    }

    match claim_fresh_output_root(&output_root).await {
        OutputRootClaim::Ok => {}
        OutputRootClaim::Exists => return Err(validation_failure("FR-0016")),
        OutputRootClaim::Invalid => return Err(validation_failure("FR-0076")),
    }

    let Some(metadata) = metadata else {
        let report = root_metadata_failure_report(
            &identity,
            &output_root,
            execution_mode,
            request.resume,
            output_path_provenance,
            metadata_bytes,
        )
        .await?;
        return Ok(CliOutcome {
            exit: ExitCode::RuntimeFailure,
            stdout: run_stdout(
                execution_mode,
                &identity,
                &output_root,
                FinalStatus::Incomplete,
                false,
            ),
            stderr: format!("{stderr}{report}"),
        });
    };

    if request.plan_only {
        write_plan_only_report(
            &metadata,
            &output_root,
            request.resume,
            output_path_provenance,
            metadata_bytes,
        )
        .await?;
        return Ok(CliOutcome {
            exit: ExitCode::Success,
            stdout: run_stdout(
                execution_mode,
                &metadata.page_id,
                &output_root,
                FinalStatus::Success,
                false,
            ),
            stderr,
        });
    }

    write_pending_materialized_report(
        &metadata,
        &output_root,
        request.resume,
        output_path_provenance,
        metadata_bytes,
    )
    .await?;
    Ok(CliOutcome {
        exit: ExitCode::RuntimeFailure,
        stdout: run_stdout(
            execution_mode,
            &metadata.page_id,
            &output_root,
            FinalStatus::Incomplete,
            false,
        ),
        stderr: format!("{stderr}ERROR: development_pending export\n"),
    })
}

#[derive(Debug)]
struct ExportFailure {
    exit: ExitCode,
    stderr: String,
}

fn validate_export_request(request: &ExportRequest) -> Result<(), ExportFailure> {
    if request.page_id.as_deref().is_none() {
        return Err(diagnostic_failure(
            "ERROR: missing_required_option --page-id\n",
        ));
    }
    if !request
        .page_id
        .as_deref()
        .is_some_and(is_canonical_non_negative_integer)
    {
        return Err(diagnostic_failure(
            "ERROR: invalid_option_value --page-id\n",
        ));
    }
    if request.plan_only && request.zip {
        return Err(diagnostic_failure(
            "ERROR: invalid_option_combination --plan-only,--zip\n",
        ));
    }
    if request.plan_only && request.resume {
        return Err(diagnostic_failure(
            "ERROR: invalid_option_combination --plan-only,--resume\n",
        ));
    }
    if request.resume && request.output_root.is_none() {
        return Err(diagnostic_failure(
            "ERROR: invalid_option_combination --out,--resume\n",
        ));
    }
    validate_positive(request.max_pages, "--max-pages")?;
    validate_positive(request.max_download_mib, "--max-download-mib")?;
    validate_positive(request.max_find_candidates, "--max-find-candidates")?;
    Ok(())
}

fn validate_positive(value: Option<u64>, option_token: &'static str) -> Result<(), ExportFailure> {
    if matches!(value, Some(0)) {
        return Err(diagnostic_failure(&format!(
            "ERROR: invalid_option_value {option_token}\n"
        )));
    }
    Ok(())
}

fn load_optional_explicit_config(
    request: &ExportRequest,
    cwd: &camino::Utf8Path,
) -> Result<JsonConfig, ExportFailure> {
    let Some(config_path) = &request.config_path else {
        return Ok(JsonConfig::default());
    };
    match load_explicit_json_config(cwd, config_path.as_str()) {
        LoadedJsonConfig::Ok { config, .. } => Ok(config),
        LoadedJsonConfig::Absent { .. } => Err(validation_failure("FR-0219")),
        LoadedJsonConfig::Invalid { .. } => Err(validation_failure("FR-0246")),
    }
}

fn load_optional_user_config(env: &EnvMap) -> Result<JsonConfig, ExportFailure> {
    match load_user_config(env) {
        LoadedJsonConfig::Ok { config, .. } => Ok(config),
        LoadedJsonConfig::Absent { .. } => Ok(JsonConfig::default()),
        LoadedJsonConfig::Invalid { .. } => Err(validation_failure("FR-0246")),
    }
}

async fn root_metadata_failure_report(
    page_id: &str,
    output_root: &camino::Utf8Path,
    execution_mode: OutputExecutionMode,
    resume_mode: bool,
    output_path_provenance: &str,
    metadata_bytes: usize,
) -> Result<String, ExportFailure> {
    let texts = report_text(ReportBuild {
        page_id,
        output_root,
        execution_mode,
        resume_mode,
        output_path_provenance,
        final_status: FinalStatus::Incomplete,
        scope_trust: ScopeTrust::Degraded,
        interrupt_reason: InterruptReason::RuntimeError,
        metadata_bytes,
        manifest_rows: Vec::new(),
        failed_page_rows: vec![FailedPageRow {
            page_id: Some(page_id.to_owned()),
            page_title: None,
            operation: "page_metadata".to_owned(),
        }],
    })?;
    write_report_set(output_root, &texts).await?;
    write_incomplete_marker(output_root).await?;
    Ok(String::new())
}

async fn write_plan_only_report(
    metadata: &crate::confluence::PageMetadata,
    output_root: &camino::Utf8Path,
    resume_mode: bool,
    output_path_provenance: &str,
    metadata_bytes: usize,
) -> Result<String, ExportFailure> {
    let texts = report_text(ReportBuild {
        page_id: &metadata.page_id,
        output_root,
        execution_mode: OutputExecutionMode::PlanOnly,
        resume_mode,
        output_path_provenance,
        final_status: FinalStatus::Success,
        scope_trust: ScopeTrust::Trusted,
        interrupt_reason: InterruptReason::None,
        metadata_bytes,
        manifest_rows: vec![manifest_row(metadata, ReportExecutionMode::PlanOnly)],
        failed_page_rows: Vec::new(),
    })?;
    write_report_set(output_root, &texts).await?;
    Ok(String::new())
}

async fn write_pending_materialized_report(
    metadata: &crate::confluence::PageMetadata,
    output_root: &camino::Utf8Path,
    resume_mode: bool,
    output_path_provenance: &str,
    metadata_bytes: usize,
) -> Result<(), ExportFailure> {
    let folder =
        page_payload_folder(&metadata.page_id, metadata.space_key.as_deref()).map_err(|_| {
            ExportFailure {
                exit: ExitCode::RuntimeFailure,
                stderr: "ERROR: runtime_failure artifact\n".to_owned(),
            }
        })?;
    ensure_directory_no_follow(&output_root.join(&folder))
        .await
        .map_err(|_| ExportFailure {
            exit: ExitCode::RuntimeFailure,
            stderr: "ERROR: runtime_failure artifact\n".to_owned(),
        })?;
    let texts = report_text(ReportBuild {
        page_id: &metadata.page_id,
        output_root,
        execution_mode: OutputExecutionMode::Materialized,
        resume_mode,
        output_path_provenance,
        final_status: FinalStatus::Incomplete,
        scope_trust: ScopeTrust::Degraded,
        interrupt_reason: InterruptReason::RuntimeError,
        metadata_bytes,
        manifest_rows: vec![manifest_row(metadata, ReportExecutionMode::Materialized)],
        failed_page_rows: vec![FailedPageRow {
            page_id: Some(metadata.page_id.clone()),
            page_title: Some(metadata.page_title.clone()),
            operation: "page_payload".to_owned(),
        }],
    })?;
    write_report_set(output_root, &texts).await?;
    write_incomplete_marker(output_root).await?;
    Ok(())
}

struct ReportBuild<'a> {
    page_id: &'a str,
    output_root: &'a camino::Utf8Path,
    execution_mode: OutputExecutionMode,
    resume_mode: bool,
    output_path_provenance: &'a str,
    final_status: FinalStatus,
    scope_trust: ScopeTrust,
    interrupt_reason: InterruptReason,
    metadata_bytes: usize,
    manifest_rows: Vec<ManifestRow>,
    failed_page_rows: Vec<FailedPageRow>,
}

fn report_text(input: ReportBuild<'_>) -> Result<crate::reports::RunReportTexts, ExportFailure> {
    run_report_texts(&RunReportInput {
        command: "export".to_owned(),
        execution_mode: match input.execution_mode {
            OutputExecutionMode::Materialized => ReportExecutionMode::Materialized,
            OutputExecutionMode::PlanOnly => ReportExecutionMode::PlanOnly,
        },
        page_id: input.page_id.to_owned(),
        output_root: input.output_root.to_string(),
        zip_path: None,
        output_path_provenance: input.output_path_provenance.to_owned(),
        final_status: input.final_status,
        scope_trust: input.scope_trust,
        interrupt_reason: input.interrupt_reason,
        downloaded_mib: Some(downloaded_mib_fields(input.metadata_bytes as u64, 0)),
        resume_mode: input.resume_mode,
        reused_pages: 0,
        fresh_pages: None,
        manifest_rows: input.manifest_rows,
        resolved_link_rows: Vec::new(),
        unresolved_link_rows: Vec::new(),
        failed_page_rows: input.failed_page_rows,
        scope_finding_rows: Vec::new(),
    })
    .map_err(|_| ExportFailure {
        exit: ExitCode::RuntimeFailure,
        stderr: "ERROR: runtime_failure report\n".to_owned(),
    })
}

async fn write_report_set(
    output_root: &camino::Utf8Path,
    texts: &crate::reports::RunReportTexts,
) -> Result<(), ExportFailure> {
    ensure_directory_no_follow(output_root)
        .await
        .map_err(|_| ExportFailure {
            exit: ExitCode::RuntimeFailure,
            stderr: "ERROR: runtime_failure report\n".to_owned(),
        })?;
    for name in REPORT_FILE_ORDER {
        let text = texts.get(name).ok_or_else(|| ExportFailure {
            exit: ExitCode::RuntimeFailure,
            stderr: "ERROR: runtime_failure report\n".to_owned(),
        })?;
        write_file_no_follow_atomic(&output_root.join(name), text)
            .await
            .map_err(|_| ExportFailure {
                exit: ExitCode::RuntimeFailure,
                stderr: "ERROR: runtime_failure report\n".to_owned(),
            })?;
    }
    Ok(())
}

async fn write_incomplete_marker(output_root: &camino::Utf8Path) -> Result<(), ExportFailure> {
    write_file_no_follow_atomic(&output_root.join("INCOMPLETE"), b"incomplete=1\n")
        .await
        .map_err(|_| ExportFailure {
            exit: ExitCode::RuntimeFailure,
            stderr: "ERROR: runtime_failure artifact\n".to_owned(),
        })
}

fn manifest_row(
    metadata: &crate::confluence::PageMetadata,
    execution_mode: ReportExecutionMode,
) -> ManifestRow {
    ManifestRow {
        page_id: metadata.page_id.clone(),
        space_key: metadata.space_key.clone(),
        page_title: metadata.page_title.clone(),
        folder: page_payload_folder(&metadata.page_id, metadata.space_key.as_deref()).ok(),
        discovery_source: DiscoverySource::Root,
        execution_mode,
        attachment_count: None,
    }
}

fn run_stdout(
    execution_mode: OutputExecutionMode,
    page_id: &str,
    output_root: &camino::Utf8Path,
    final_status: FinalStatus,
    zip_requested: bool,
) -> String {
    let execution_mode = match execution_mode {
        OutputExecutionMode::Materialized => "materialized",
        OutputExecutionMode::PlanOnly => "plan_only",
    };
    let mut lines = vec![
        format!(
            "RUN_START command=export execution_mode={execution_mode} page_id={page_id} output_root={}",
            quote_path_string(output_root.as_str())
        ),
        "RUN_PHASE phase=scope_discovery".to_owned(),
    ];
    if execution_mode == "materialized" {
        lines.push("RUN_PHASE phase=page_processing".to_owned());
    }
    lines.push("RUN_PHASE phase=report_generation".to_owned());
    if zip_requested {
        lines.push("RUN_PHASE phase=zip_packaging".to_owned());
    }
    lines.push(format!(
        "RUN_COMPLETE final_status={} artifact={}",
        final_status.as_str(),
        quote_path_string(output_root.as_str())
    ));
    format!("{}\n", lines.join("\n"))
}

fn downloaded_mib_fields(metadata: u64, content: u64) -> DownloadedMibValues {
    DownloadedMibValues {
        total: format_mib(metadata + content),
        content: format_mib(content),
        metadata: format_mib(metadata),
    }
}

fn format_mib(bytes: u64) -> String {
    format!("{:.3}", bytes as f64 / 1_048_576.0)
}

fn effective_env(env: &EnvMap, base_url: Option<String>, token: Option<String>) -> EnvMap {
    let mut values = env.0.clone();
    if let Some(base_url) = base_url {
        values.insert("CONFLUEX_CONFLUENCE_BASE_URL".to_owned(), base_url);
    }
    if let Some(token) = token {
        values.insert("CONFLUEX_CONFLUENCE_TOKEN".to_owned(), token);
    }
    EnvMap(values)
}

fn root_page_failure(page_id: &str, _reason: RemoteOperationFailureReason) -> ExportFailure {
    validation_failure_page_id("FR-0017", page_id)
}

fn validation_failure(requirement_id: &'static str) -> ExportFailure {
    diagnostic_failure(&format!("ERROR: validation_failed {requirement_id}\n"))
}

fn validation_failure_page_id(requirement_id: &'static str, page_id: &str) -> ExportFailure {
    diagnostic_failure(&format!(
        "ERROR: validation_failed {requirement_id} --page-id {}\n",
        diagnostic_token(page_id)
    ))
}

fn diagnostic_failure(stderr: &str) -> ExportFailure {
    ExportFailure {
        exit: ExitCode::RuntimeFailure,
        stderr: stderr.to_owned(),
    }
}

fn current_utf8_dir() -> Result<Utf8PathBuf, ExportFailure> {
    Utf8PathBuf::from_path_buf(std::env::current_dir().map_err(|_| ExportFailure {
        exit: ExitCode::RuntimeFailure,
        stderr: "ERROR: runtime_failure export\n".to_owned(),
    })?)
    .map_err(|_| ExportFailure {
        exit: ExitCode::RuntimeFailure,
        stderr: "ERROR: runtime_failure export\n".to_owned(),
    })
}

fn diagnostic_token(value: &str) -> String {
    value
        .as_bytes()
        .iter()
        .map(|byte| {
            if (0x21..=0x7e).contains(byte) && *byte != b'%' {
                char::from(*byte).to_string()
            } else {
                format!("%{byte:02X}")
            }
        })
        .collect()
}

fn is_canonical_non_negative_integer(value: &str) -> bool {
    value == "0"
        || value
            .chars()
            .next()
            .is_some_and(|first| first.is_ascii_digit() && first != '0')
            && value.chars().all(|character| character.is_ascii_digit())
}
