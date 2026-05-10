//! Rust export orchestration entry point.

use std::time::SystemTime;

use camino::Utf8PathBuf;

use crate::cli::ExportRequest;
use crate::config::{
    apply_effective_configuration, load_explicit_json_config, load_user_config, EnvMap, JsonConfig,
    LoadedJsonConfig,
};
use crate::confluence::{
    check_root_page_access, find_title_candidates, get_attachment_preview,
    get_page_storage_content, list_child_pages, AttachmentPreviewResult, PageListResult,
    PageMetadata, PageStorageResult, RemoteOperationFailureReason, RootPageAccessResult,
    TitleDiscovery, TransportPolicy,
};
use crate::links::target_reference_from_relative_url;
use crate::markdown::{ExternalMarkdownExporter, MarkdownExportInput, MarkdownExporter};
use crate::output::{
    claim_fresh_output_root, ensure_directory_no_follow, page_payload_folder, quote_path_string,
    select_output_root, write_file_no_follow_atomic, ExecutionMode as OutputExecutionMode,
    OutputRootClaim, OutputRootSelection,
};
use crate::reports::{
    run_report_texts, structured_raw_link_value, DiscoverySource, DownloadedMibValues,
    ExecutionMode as ReportExecutionMode, FailedPageRow, FinalStatus, InterruptReason, ManifestRow,
    ResolvedLinkRow, RunReportInput, ScopeFindingRow, ScopeTrust, StructuredRawLinkKind,
    UnresolvedLinkRow, REPORT_FILE_ORDER,
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
    let selected_base_url = effective.confluence_base_url.clone();
    let selected_token = effective.confluence_token.clone();
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

    let transport_policy = TransportPolicy {
        insecure: request.insecure,
    };
    let access = check_root_page_access(&page_id, &env, transport_policy).await;
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

    let scope = basic_plan_scope(
        &metadata,
        &request,
        &env,
        transport_policy,
        execution_mode,
        metadata_bytes,
    )
    .await?;

    if request.plan_only {
        write_plan_only_report(&scope, &output_root, request.resume, output_path_provenance)
            .await?;
        let final_status = completed_final_status(&scope);
        return Ok(CliOutcome {
            exit: successful_run_exit_code(final_status),
            stdout: run_stdout(
                execution_mode,
                &metadata.page_id,
                &output_root,
                final_status,
                false,
            ),
            stderr,
        });
    }

    let final_status = write_materialized_export(
        &scope,
        &output_root,
        request.resume,
        output_path_provenance,
        selected_base_url
            .as_deref()
            .or_else(|| env.get("CONFLUEX_CONFLUENCE_BASE_URL"))
            .ok_or_else(|| validation_failure("FR-0017"))?,
        selected_token
            .as_deref()
            .or_else(|| env.get("CONFLUEX_CONFLUENCE_TOKEN"))
            .ok_or_else(|| validation_failure("FR-0017"))?,
    )
    .await?;
    Ok(CliOutcome {
        exit: successful_run_exit_code(final_status),
        stdout: run_stdout(
            execution_mode,
            &metadata.page_id,
            &output_root,
            final_status,
            false,
        ),
        stderr,
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
        downloaded_mib: downloaded_mib_fields(metadata_bytes as u64, 0),
        manifest_rows: Vec::new(),
        resolved_link_rows: Vec::new(),
        unresolved_link_rows: Vec::new(),
        failed_page_rows: vec![FailedPageRow {
            page_id: Some(page_id.to_owned()),
            page_title: None,
            operation: "page_metadata".to_owned(),
        }],
        scope_finding_rows: Vec::new(),
    })?;
    write_report_set(output_root, &texts).await?;
    write_incomplete_marker(output_root).await?;
    Ok(String::new())
}

async fn write_plan_only_report(
    scope: &BasicPlanScope,
    output_root: &camino::Utf8Path,
    resume_mode: bool,
    output_path_provenance: &str,
) -> Result<String, ExportFailure> {
    let texts = report_text(ReportBuild {
        page_id: &scope.root_page_id,
        output_root,
        execution_mode: OutputExecutionMode::PlanOnly,
        resume_mode,
        output_path_provenance,
        final_status: completed_final_status(scope),
        scope_trust: scope_trust_for(scope),
        interrupt_reason: scope.configured_stop_reason,
        downloaded_mib: downloaded_mib_fields(scope.downloaded_metadata_bytes, 0),
        manifest_rows: scope.manifest_rows.clone(),
        resolved_link_rows: scope.resolved_link_rows.clone(),
        unresolved_link_rows: scope.unresolved_link_rows.clone(),
        failed_page_rows: scope.failed_page_rows.clone(),
        scope_finding_rows: scope.scope_finding_rows.clone(),
    })?;
    write_report_set(output_root, &texts).await?;
    Ok(String::new())
}

async fn write_materialized_export(
    scope: &BasicPlanScope,
    output_root: &camino::Utf8Path,
    resume_mode: bool,
    output_path_provenance: &str,
    base_url: &str,
    token: &str,
) -> Result<FinalStatus, ExportFailure> {
    let exporter = ExternalMarkdownExporter;
    let mut failed_payload_ids = std::collections::BTreeSet::new();
    let mut content_bytes = 0u64;

    for row in &scope.manifest_rows {
        let Some(folder) = &row.folder else {
            failed_payload_ids.insert(row.page_id.clone());
            break;
        };
        let temp_dir = tempfile::tempdir().map_err(|_| ExportFailure {
            exit: ExitCode::RuntimeFailure,
            stderr: "ERROR: runtime_failure artifact\n".to_owned(),
        })?;
        let work_dir = Utf8PathBuf::from_path_buf(temp_dir.path().to_path_buf()).map_err(|_| {
            ExportFailure {
                exit: ExitCode::RuntimeFailure,
                stderr: "ERROR: runtime_failure artifact\n".to_owned(),
            }
        })?;
        let payload = match exporter
            .export(MarkdownExportInput {
                base_url: base_url.to_owned(),
                page_id: row.page_id.clone(),
                token: token.to_owned(),
                work_dir,
            })
            .await
        {
            Ok(payload) => payload.markdown,
            Err(_) => {
                failed_payload_ids.insert(row.page_id.clone());
                break;
            }
        };
        write_page_payload(output_root, folder, &payload).await?;
        content_bytes += payload.len() as u64;
    }

    let manifest_rows = scope
        .manifest_rows
        .iter()
        .cloned()
        .map(|mut row| {
            if failed_payload_ids.contains(&row.page_id) {
                row.folder = None;
            }
            row
        })
        .collect::<Vec<_>>();
    let failed_page_rows = scope
        .failed_page_rows
        .clone()
        .into_iter()
        .chain(scope.manifest_rows.iter().filter_map(|row| {
            if !failed_payload_ids.contains(&row.page_id) {
                return None;
            }
            Some(FailedPageRow {
                page_id: Some(row.page_id.clone()),
                page_title: Some(row.page_title.clone()),
                operation: "page_payload".to_owned(),
            })
        }))
        .collect::<Vec<_>>();
    let has_blocking_reasons = !scope.scope_finding_rows.is_empty()
        || !scope.unresolved_link_rows.is_empty()
        || !failed_page_rows.is_empty();
    let final_status = final_status_for(scope.configured_stop_reason, has_blocking_reasons);
    let texts = report_text(ReportBuild {
        page_id: &scope.root_page_id,
        output_root,
        execution_mode: OutputExecutionMode::Materialized,
        resume_mode,
        output_path_provenance,
        final_status,
        scope_trust: scope_trust_for_rows(
            scope.configured_stop_reason,
            &scope.scope_finding_rows,
            &scope.unresolved_link_rows,
            &failed_page_rows,
        ),
        interrupt_reason: scope.configured_stop_reason,
        downloaded_mib: downloaded_mib_fields(scope.downloaded_metadata_bytes, content_bytes),
        manifest_rows,
        resolved_link_rows: scope.resolved_link_rows.clone(),
        unresolved_link_rows: scope.unresolved_link_rows.clone(),
        failed_page_rows,
        scope_finding_rows: scope.scope_finding_rows.clone(),
    })?;
    write_report_set(output_root, &texts).await?;
    if final_status == FinalStatus::Incomplete {
        write_incomplete_marker(output_root).await?;
    }
    Ok(final_status)
}

async fn write_page_payload(
    output_root: &camino::Utf8Path,
    folder: &str,
    payload: &str,
) -> Result<(), ExportFailure> {
    let folder_path = output_root.join(folder);
    ensure_directory_no_follow(&folder_path)
        .await
        .map_err(|_| ExportFailure {
            exit: ExitCode::RuntimeFailure,
            stderr: "ERROR: runtime_failure artifact\n".to_owned(),
        })?;
    write_file_no_follow_atomic(&folder_path.join("page.md"), payload)
        .await
        .map_err(|_| ExportFailure {
            exit: ExitCode::RuntimeFailure,
            stderr: "ERROR: runtime_failure artifact\n".to_owned(),
        })?;
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
    downloaded_mib: DownloadedMibValues,
    manifest_rows: Vec<ManifestRow>,
    resolved_link_rows: Vec<ResolvedLinkRow>,
    unresolved_link_rows: Vec<UnresolvedLinkRow>,
    failed_page_rows: Vec<FailedPageRow>,
    scope_finding_rows: Vec<ScopeFindingRow>,
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
        downloaded_mib: Some(input.downloaded_mib),
        resume_mode: input.resume_mode,
        reused_pages: 0,
        fresh_pages: None,
        manifest_rows: input.manifest_rows,
        resolved_link_rows: input.resolved_link_rows,
        unresolved_link_rows: input.unresolved_link_rows,
        failed_page_rows: input.failed_page_rows,
        scope_finding_rows: input.scope_finding_rows,
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

#[derive(Debug, Clone)]
struct BasicPlanScope {
    root_page_id: String,
    manifest_rows: Vec<ManifestRow>,
    resolved_link_rows: Vec<ResolvedLinkRow>,
    unresolved_link_rows: Vec<UnresolvedLinkRow>,
    failed_page_rows: Vec<FailedPageRow>,
    scope_finding_rows: Vec<ScopeFindingRow>,
    downloaded_metadata_bytes: u64,
    configured_stop_reason: InterruptReason,
}

#[derive(Debug, Clone)]
struct PageQueueEntry {
    metadata: PageMetadata,
    discovery_source: DiscoverySource,
    link_depth: u64,
}

#[derive(Debug, Clone)]
struct PageIdDiscovery {
    link_kind: String,
    page_id: String,
}

#[derive(Debug, Clone)]
struct LinkDiscovery {
    link_kind: String,
    title: String,
    space_key: Option<String>,
}

#[derive(Debug, Clone, Default)]
struct StorageDiscoveries {
    page_id_links: Vec<PageIdDiscovery>,
    title_links: Vec<LinkDiscovery>,
    unsupported_patterns: Vec<String>,
}

async fn basic_plan_scope(
    root_metadata: &PageMetadata,
    request: &ExportRequest,
    env: &EnvMap,
    policy: TransportPolicy,
    execution_mode: OutputExecutionMode,
    initial_metadata_bytes: usize,
) -> Result<BasicPlanScope, ExportFailure> {
    let mut pages = vec![PageQueueEntry {
        metadata: root_metadata.clone(),
        discovery_source: DiscoverySource::Root,
        link_depth: 0,
    }];
    let mut seen_page_ids = std::collections::BTreeSet::from([root_metadata.page_id.clone()]);
    let mut resolved_link_rows = Vec::new();
    let mut unresolved_link_rows = Vec::new();
    let mut scope_finding_rows = Vec::new();
    let mut failed_page_rows = Vec::new();
    let mut downloaded_metadata_bytes = initial_metadata_bytes as u64;
    let max_download_bytes = request
        .max_download_mib
        .and_then(|mib| mib.checked_mul(1_048_576));
    let max_pages = request.max_pages.map(|value| value as usize);
    let link_depth = request.link_depth.unwrap_or(1);
    let mut download_limit_reached =
        reached_download_limit(downloaded_metadata_bytes, max_download_bytes);

    if request.include_children {
        let mut index = 0;
        while index < pages.len()
            && !download_limit_reached
            && max_pages.is_none_or(|limit| index < limit)
        {
            let source = pages[index].metadata.clone();
            match list_child_pages(&source.page_id, env, policy).await {
                PageListResult::Ok {
                    complete,
                    pages: children,
                    metadata_bytes,
                } => {
                    downloaded_metadata_bytes += metadata_bytes as u64;
                    download_limit_reached =
                        reached_download_limit(downloaded_metadata_bytes, max_download_bytes);
                    if !complete {
                        scope_finding_rows.push(child_listing_partial_row(&source.page_id));
                    }
                    for child in children {
                        resolved_link_rows.push(resolved_link_row(
                            &source,
                            &child,
                            "child_result",
                            &raw_page_id_link_value(&child.page_id)?,
                        ));
                        if seen_page_ids.insert(child.page_id.clone()) {
                            pages.push(PageQueueEntry {
                                metadata: child,
                                discovery_source: DiscoverySource::Tree,
                                link_depth: 0,
                            });
                        }
                    }
                }
                PageListResult::Failed => {
                    scope_finding_rows.push(child_listing_incomplete_row(&source.page_id));
                }
            }
            index += 1;
        }
    }

    let mut index = 0;
    while index < pages.len()
        && !download_limit_reached
        && max_pages.is_none_or(|limit| index < limit)
    {
        let page = pages[index].clone();
        match get_page_storage_content(&page.metadata.page_id, env, policy).await {
            PageStorageResult::Ok {
                storage,
                metadata_bytes,
            } => {
                downloaded_metadata_bytes += metadata_bytes as u64;
                download_limit_reached =
                    reached_download_limit(downloaded_metadata_bytes, max_download_bytes);
                let discoveries = storage_discoveries(&storage);
                for detail in discoveries.unsupported_patterns {
                    scope_finding_rows
                        .push(unsupported_pattern_row(&page.metadata.page_id, detail));
                }
                if page.link_depth < link_depth {
                    for discovery in discoveries.page_id_links {
                        let resolution =
                            check_root_page_access(&discovery.page_id, env, policy).await;
                        match resolution {
                            RootPageAccessResult::Ok {
                                metadata: Some(target),
                                metadata_bytes,
                                ..
                            } if target.page_id == discovery.page_id => {
                                downloaded_metadata_bytes += metadata_bytes as u64;
                                resolved_link_rows.push(resolved_link_row(
                                    &page.metadata,
                                    &target,
                                    &discovery.link_kind,
                                    &raw_page_id_link_value(&discovery.page_id)?,
                                ));
                                if seen_page_ids.insert(target.page_id.clone()) {
                                    pages.push(PageQueueEntry {
                                        metadata: target,
                                        discovery_source: DiscoverySource::Linked,
                                        link_depth: page.link_depth + 1,
                                    });
                                }
                            }
                            RootPageAccessResult::Ok { metadata_bytes, .. } => {
                                downloaded_metadata_bytes += metadata_bytes as u64;
                                unresolved_link_rows.push(unresolved_link_row(
                                    &page.metadata,
                                    &discovery.link_kind,
                                    &raw_page_id_link_value(&discovery.page_id)?,
                                    "insufficient_data",
                                ));
                            }
                            RootPageAccessResult::Failed { reason } => {
                                unresolved_link_rows.push(unresolved_link_row(
                                    &page.metadata,
                                    &discovery.link_kind,
                                    &raw_page_id_link_value(&discovery.page_id)?,
                                    page_id_resolution_reason(reason),
                                ));
                            }
                        }
                        if reached_download_limit(downloaded_metadata_bytes, max_download_bytes) {
                            download_limit_reached = true;
                            break;
                        }
                    }
                    if !download_limit_reached {
                        for discovery in discoveries.title_links {
                            let resolution =
                                resolve_title_link(&discovery, request, env, policy).await?;
                            downloaded_metadata_bytes += resolution.metadata_bytes;
                            match resolution.metadata {
                                Some(target) => {
                                    resolved_link_rows.push(resolved_link_row(
                                        &page.metadata,
                                        &target,
                                        &discovery.link_kind,
                                        &raw_title_link_value(&discovery)?,
                                    ));
                                    if seen_page_ids.insert(target.page_id.clone()) {
                                        pages.push(PageQueueEntry {
                                            metadata: target,
                                            discovery_source: DiscoverySource::Linked,
                                            link_depth: page.link_depth + 1,
                                        });
                                    }
                                }
                                None => {
                                    unresolved_link_rows.push(unresolved_link_row(
                                        &page.metadata,
                                        &discovery.link_kind,
                                        &raw_title_link_value(&discovery)?,
                                        resolution.reason,
                                    ));
                                    if resolution.finding {
                                        scope_finding_rows.push(title_resolution_incomplete_row(
                                            &page.metadata.page_id,
                                        ));
                                    }
                                }
                            }
                            if reached_download_limit(downloaded_metadata_bytes, max_download_bytes)
                            {
                                download_limit_reached = true;
                                break;
                            }
                        }
                    }
                }
            }
            PageStorageResult::Failed => {
                scope_finding_rows.push(storage_unavailable_row(&page.metadata.page_id));
            }
        }
        index += 1;
    }

    let processed_len = max_pages.map_or(pages.len(), |limit| pages.len().min(limit));
    let mut manifest_pages = pages.into_iter().take(processed_len).collect::<Vec<_>>();
    let mut configured_stop_reason = if max_pages.is_some_and(|limit| seen_page_ids.len() > limit) {
        InterruptReason::MaxPagesLimitReached
    } else if download_limit_reached {
        InterruptReason::MaxDownloadLimitReached
    } else {
        InterruptReason::None
    };

    let mut attachment_counts = std::collections::BTreeMap::new();
    if execution_mode == OutputExecutionMode::PlanOnly
        && configured_stop_reason != InterruptReason::MaxDownloadLimitReached
    {
        for page in &manifest_pages {
            match get_attachment_preview(&page.metadata.page_id, env, policy).await {
                AttachmentPreviewResult::Ok {
                    count,
                    metadata_bytes,
                    ..
                } => {
                    attachment_counts.insert(page.metadata.page_id.clone(), count.to_string());
                    downloaded_metadata_bytes += metadata_bytes as u64;
                    if reached_download_limit(downloaded_metadata_bytes, max_download_bytes) {
                        configured_stop_reason = InterruptReason::MaxDownloadLimitReached;
                        break;
                    }
                }
                AttachmentPreviewResult::Failed => {
                    failed_page_rows.push(FailedPageRow {
                        page_id: Some(page.metadata.page_id.clone()),
                        page_title: Some(page.metadata.page_title.clone()),
                        operation: "attachment_preview".to_owned(),
                    });
                    if !request.no_fail_fast {
                        break;
                    }
                }
            }
        }
    }

    let report_execution_mode = match execution_mode {
        OutputExecutionMode::Materialized => ReportExecutionMode::Materialized,
        OutputExecutionMode::PlanOnly => ReportExecutionMode::PlanOnly,
    };
    let manifest_rows = manifest_pages
        .drain(..)
        .map(|page| {
            let mut row = manifest_row_with_source(
                &page.metadata,
                page.discovery_source,
                report_execution_mode,
            );
            row.attachment_count = attachment_counts.get(&page.metadata.page_id).cloned();
            row
        })
        .collect();

    Ok(BasicPlanScope {
        root_page_id: root_metadata.page_id.clone(),
        manifest_rows,
        resolved_link_rows,
        unresolved_link_rows,
        failed_page_rows,
        scope_finding_rows,
        downloaded_metadata_bytes,
        configured_stop_reason,
    })
}

#[derive(Debug, Clone)]
struct TitleResolution {
    metadata: Option<PageMetadata>,
    reason: &'static str,
    finding: bool,
    metadata_bytes: u64,
}

async fn resolve_title_link(
    discovery: &LinkDiscovery,
    request: &ExportRequest,
    env: &EnvMap,
    policy: TransportPolicy,
) -> Result<TitleResolution, ExportFailure> {
    let result = find_title_candidates(
        &TitleDiscovery {
            title: discovery.title.clone(),
            space_key: discovery.space_key.clone(),
        },
        env,
        policy,
    )
    .await;
    let PageListResult::Ok {
        complete,
        pages,
        metadata_bytes,
    } = result
    else {
        return Ok(TitleResolution {
            metadata: None,
            reason: "insufficient_data",
            finding: true,
            metadata_bytes: 0,
        });
    };
    if !complete {
        return Ok(TitleResolution {
            metadata: None,
            reason: "insufficient_data",
            finding: true,
            metadata_bytes: metadata_bytes as u64,
        });
    }
    let mut candidates = pages
        .into_iter()
        .filter(|candidate| {
            candidate.page_title == discovery.title
                && discovery
                    .space_key
                    .as_ref()
                    .is_none_or(|space_key| candidate.space_key.as_ref() == Some(space_key))
        })
        .collect::<Vec<_>>();
    candidates.sort_by(|left, right| {
        [
            left.space_key.clone().unwrap_or_default(),
            left.page_title.clone(),
            left.page_id.clone(),
        ]
        .cmp(&[
            right.space_key.clone().unwrap_or_default(),
            right.page_title.clone(),
            right.page_id.clone(),
        ])
    });
    candidates.dedup_by(|left, right| left.page_id == right.page_id);
    if request
        .max_find_candidates
        .is_some_and(|limit| candidates.len() as u64 > limit)
    {
        return Ok(TitleResolution {
            metadata: None,
            reason: "candidate_limit",
            finding: false,
            metadata_bytes: metadata_bytes as u64,
        });
    }
    match candidates.len() {
        0 => Ok(TitleResolution {
            metadata: None,
            reason: "not_found",
            finding: false,
            metadata_bytes: metadata_bytes as u64,
        }),
        1 => Ok(TitleResolution {
            metadata: candidates.pop(),
            reason: "not_found",
            finding: false,
            metadata_bytes: metadata_bytes as u64,
        }),
        _ => Ok(TitleResolution {
            metadata: None,
            reason: "not_unique",
            finding: false,
            metadata_bytes: metadata_bytes as u64,
        }),
    }
}

fn storage_discoveries(storage: &str) -> StorageDiscoveries {
    let mut discoveries = StorageDiscoveries::default();
    capture_page_id_links(
        storage,
        r#"<ri:(?:content-entity|page)\b[^>]*\bri:content-id="([0-9]+)"[^>]*>"#,
        "content_id",
        &mut discoveries,
    );
    for markup in capture_markup(storage, r#"<ri:page\b[^>]*(?:/>|></ri:page>)"#) {
        if markup.contains("ri:content-id=") {
            continue;
        }
        let Some(title) = decoded_xml_attribute(&markup, "ri:content-title") else {
            continue;
        };
        if title.is_empty() {
            continue;
        }
        let space_key =
            decoded_xml_attribute(&markup, "ri:space-key").filter(|value| !value.is_empty());
        discoveries.title_links.push(LinkDiscovery {
            link_kind: "page_ref".to_owned(),
            title,
            space_key,
        });
    }
    for text in capture_group(
        storage,
        r#"<ac:parameter\b[^>]*\bac:name="page"[^>]*>([\s\S]*?)</ac:parameter>"#,
    ) {
        if let Some(discovery) = macro_param_discovery(&text) {
            discoveries.title_links.push(discovery);
        }
    }
    for value in capture_attr_values(storage, r#"<ri:url\b[^>]*(?:/>|></ri:url>)"#, "ri:value") {
        add_relative_url_discovery(
            &value,
            "ri_url_page_id",
            "ri_url_space_title",
            &mut discoveries,
        );
    }
    for href in capture_group(storage, r#"\bhref="([^"]*)""#) {
        if let Some(decoded) = decode_xml_attribute(&href) {
            add_relative_url_discovery(
                &decoded,
                "href_page_id",
                "href_space_title",
                &mut discoveries,
            );
        }
    }
    discoveries.page_id_links = unique_page_id_links(discoveries.page_id_links);
    discoveries.title_links = unique_title_links(discoveries.title_links);
    discoveries.unsupported_patterns = unsupported_patterns(storage);
    discoveries
}

fn capture_page_id_links(
    storage: &str,
    pattern: &str,
    link_kind: &str,
    discoveries: &mut StorageDiscoveries,
) {
    for page_id in capture_group(storage, pattern) {
        discoveries.page_id_links.push(PageIdDiscovery {
            link_kind: link_kind.to_owned(),
            page_id,
        });
    }
}

fn capture_markup(storage: &str, pattern: &str) -> Vec<String> {
    let regex = regex::Regex::new(pattern).expect("static regex");
    regex
        .find_iter(storage)
        .map(|matched| matched.as_str().to_owned())
        .collect()
}

fn capture_group(storage: &str, pattern: &str) -> Vec<String> {
    let regex = regex::Regex::new(pattern).expect("static regex");
    regex
        .captures_iter(storage)
        .filter_map(|captures| captures.get(1).map(|matched| matched.as_str().to_owned()))
        .collect()
}

fn capture_attr_values(storage: &str, markup_pattern: &str, attr_name: &str) -> Vec<String> {
    capture_markup(storage, markup_pattern)
        .into_iter()
        .filter_map(|markup| decoded_xml_attribute(&markup, attr_name))
        .collect()
}

fn add_relative_url_discovery(
    value: &str,
    page_id_kind: &str,
    title_kind: &str,
    discoveries: &mut StorageDiscoveries,
) {
    if crate::links::is_absolute_or_scheme_relative_url(value) {
        return;
    }
    match target_reference_from_relative_url(value) {
        Some(crate::links::TargetReference::PageId(page_id)) => {
            discoveries.page_id_links.push(PageIdDiscovery {
                link_kind: page_id_kind.to_owned(),
                page_id,
            });
        }
        Some(crate::links::TargetReference::Title { title, space_key }) => {
            discoveries.title_links.push(LinkDiscovery {
                link_kind: title_kind.to_owned(),
                title,
                space_key,
            });
        }
        None => {}
    }
}

fn macro_param_discovery(raw_text: &str) -> Option<LinkDiscovery> {
    let decoded = decode_xml_attribute(raw_text)?;
    let target_text = decoded.trim();
    if target_text.is_empty() {
        return None;
    }
    if let Some((space_key, title)) = target_text.split_once(':') {
        let title = title.trim();
        if !space_key.is_empty()
            && !title.is_empty()
            && space_key.chars().all(|character| {
                character.is_ascii_uppercase()
                    || character.is_ascii_digit()
                    || matches!(character, '_' | '.' | '-')
            })
        {
            return Some(LinkDiscovery {
                link_kind: "macro_param".to_owned(),
                title: title.to_owned(),
                space_key: Some(space_key.to_owned()),
            });
        }
    }
    Some(LinkDiscovery {
        link_kind: "macro_param".to_owned(),
        title: target_text.to_owned(),
        space_key: None,
    })
}

fn unsupported_patterns(storage: &str) -> Vec<String> {
    let mut patterns = std::collections::BTreeSet::new();
    for value in capture_group(storage, r#"\b[A-Za-z_:][A-Za-z0-9_:.-]*="([^"]*)""#) {
        let Some(decoded) = decode_xml_attribute(&value) else {
            continue;
        };
        if decoded.contains("pageId=")
            || decoded.contains("/pages/")
            || decoded.contains("/display/")
        {
            patterns.insert(decoded);
        }
    }
    patterns.into_iter().collect()
}

fn unique_page_id_links(links: Vec<PageIdDiscovery>) -> Vec<PageIdDiscovery> {
    let mut seen = std::collections::BTreeSet::new();
    links
        .into_iter()
        .filter(|link| seen.insert(format!("{}\t{}", link.link_kind, link.page_id)))
        .collect()
}

fn unique_title_links(links: Vec<LinkDiscovery>) -> Vec<LinkDiscovery> {
    let mut seen = std::collections::BTreeSet::new();
    links
        .into_iter()
        .filter(|link| {
            seen.insert(format!(
                "{}\t{}\t{}",
                link.link_kind,
                link.space_key.clone().unwrap_or_default(),
                link.title
            ))
        })
        .collect()
}

fn decoded_xml_attribute(markup: &str, name: &str) -> Option<String> {
    let pattern = format!(r#"\b{}="([^"]*)""#, regex::escape(name));
    capture_group(markup, &pattern)
        .into_iter()
        .next()
        .and_then(|value| decode_xml_attribute(&value))
}

fn decode_xml_attribute(value: &str) -> Option<String> {
    let entity = regex::Regex::new(r"&(#x[0-9A-Fa-f]+|#[0-9]+|amp|lt|gt|quot|apos|mdash);").ok()?;
    let mut failed = false;
    let decoded = entity
        .replace_all(value, |captures: &regex::Captures<'_>| {
            let token = captures.get(1).map(|m| m.as_str()).unwrap_or_default();
            match token {
                "amp" => "&".to_owned(),
                "lt" => "<".to_owned(),
                "gt" => ">".to_owned(),
                "quot" => "\"".to_owned(),
                "apos" => "'".to_owned(),
                "mdash" => "-".to_owned(),
                token if token.starts_with("#x") => u32::from_str_radix(&token[2..], 16)
                    .ok()
                    .and_then(char::from_u32)
                    .map(|c| c.to_string())
                    .unwrap_or_else(|| {
                        failed = true;
                        String::new()
                    }),
                token if token.starts_with('#') => token[1..]
                    .parse::<u32>()
                    .ok()
                    .and_then(char::from_u32)
                    .map(|c| c.to_string())
                    .unwrap_or_else(|| {
                        failed = true;
                        String::new()
                    }),
                _ => {
                    failed = true;
                    String::new()
                }
            }
        })
        .into_owned();
    (!failed).then_some(decoded)
}

fn manifest_row_with_source(
    metadata: &PageMetadata,
    discovery_source: DiscoverySource,
    execution_mode: ReportExecutionMode,
) -> ManifestRow {
    let mut row = manifest_row(metadata, execution_mode);
    row.discovery_source = discovery_source;
    row
}

fn resolved_link_row(
    source: &PageMetadata,
    target: &PageMetadata,
    link_kind: &str,
    raw_link_value: &str,
) -> ResolvedLinkRow {
    ResolvedLinkRow {
        source_page_id: source.page_id.clone(),
        source_title: Some(source.page_title.clone()),
        link_kind: link_kind.to_owned(),
        raw_link_value: raw_link_value.to_owned(),
        target_page_id: target.page_id.clone(),
        target_space_key: target.space_key.clone(),
        target_title: Some(target.page_title.clone()),
    }
}

fn unresolved_link_row(
    source: &PageMetadata,
    link_kind: &str,
    raw_link_value: &str,
    reason: &'static str,
) -> UnresolvedLinkRow {
    UnresolvedLinkRow {
        source_page_id: source.page_id.clone(),
        source_title: Some(source.page_title.clone()),
        link_kind: link_kind.to_owned(),
        raw_link_value: raw_link_value.to_owned(),
        resolution_reason: reason.to_owned(),
    }
}

fn raw_page_id_link_value(page_id: &str) -> Result<String, ExportFailure> {
    structured_raw_link_value(StructuredRawLinkKind::PageId, &[page_id.to_owned()]).map_err(|_| {
        ExportFailure {
            exit: ExitCode::RuntimeFailure,
            stderr: "ERROR: runtime_failure report\n".to_owned(),
        }
    })
}

fn raw_title_link_value(discovery: &LinkDiscovery) -> Result<String, ExportFailure> {
    structured_raw_link_value(
        StructuredRawLinkKind::Title,
        &[
            if discovery.space_key.is_some() {
                "1"
            } else {
                "0"
            }
            .to_owned(),
            discovery.space_key.clone().unwrap_or_default(),
            discovery.title.clone(),
        ],
    )
    .map_err(|_| ExportFailure {
        exit: ExitCode::RuntimeFailure,
        stderr: "ERROR: runtime_failure report\n".to_owned(),
    })
}

fn page_id_resolution_reason(reason: RemoteOperationFailureReason) -> &'static str {
    match reason {
        RemoteOperationFailureReason::PageInaccessible => "not_found",
        _ => "insufficient_data",
    }
}

fn completed_final_status(scope: &BasicPlanScope) -> FinalStatus {
    final_status_for(
        scope.configured_stop_reason,
        !scope.scope_finding_rows.is_empty()
            || !scope.unresolved_link_rows.is_empty()
            || !scope.failed_page_rows.is_empty(),
    )
}

fn final_status_for(stop_reason: InterruptReason, has_blocking_reasons: bool) -> FinalStatus {
    if stop_reason != InterruptReason::None {
        FinalStatus::Incomplete
    } else if has_blocking_reasons {
        FinalStatus::SuccessWithFindings
    } else {
        FinalStatus::Success
    }
}

fn scope_trust_for(scope: &BasicPlanScope) -> ScopeTrust {
    scope_trust_for_rows(
        scope.configured_stop_reason,
        &scope.scope_finding_rows,
        &scope.unresolved_link_rows,
        &scope.failed_page_rows,
    )
}

fn scope_trust_for_rows(
    stop_reason: InterruptReason,
    scope_finding_rows: &[ScopeFindingRow],
    unresolved_link_rows: &[UnresolvedLinkRow],
    failed_page_rows: &[FailedPageRow],
) -> ScopeTrust {
    if stop_reason != InterruptReason::None
        || !scope_finding_rows.is_empty()
        || !unresolved_link_rows.is_empty()
        || failed_page_rows
            .iter()
            .any(|row| matches!(row.operation.as_str(), "page_metadata" | "storage_content"))
    {
        ScopeTrust::Degraded
    } else {
        ScopeTrust::Trusted
    }
}

fn successful_run_exit_code(final_status: FinalStatus) -> ExitCode {
    match final_status {
        FinalStatus::Incomplete => ExitCode::RuntimeFailure,
        _ => ExitCode::Success,
    }
}

fn reached_download_limit(downloaded_bytes: u64, max_download_bytes: Option<u64>) -> bool {
    max_download_bytes.is_some_and(|limit| downloaded_bytes >= limit)
}

fn child_listing_incomplete_row(page_id: &str) -> ScopeFindingRow {
    ScopeFindingRow {
        page_id: Some(page_id.to_owned()),
        finding_area: "child_listing".to_owned(),
        finding_type: "incomplete_tree".to_owned(),
        detail: "child_listing_incomplete".to_owned(),
    }
}

fn child_listing_partial_row(page_id: &str) -> ScopeFindingRow {
    ScopeFindingRow {
        page_id: Some(page_id.to_owned()),
        finding_area: "child_listing".to_owned(),
        finding_type: "partial_listing".to_owned(),
        detail: "child_listing_partial".to_owned(),
    }
}

fn storage_unavailable_row(page_id: &str) -> ScopeFindingRow {
    ScopeFindingRow {
        page_id: Some(page_id.to_owned()),
        finding_area: "storage_content".to_owned(),
        finding_type: "storage_unavailable".to_owned(),
        detail: "storage_content_unavailable".to_owned(),
    }
}

fn title_resolution_incomplete_row(page_id: &str) -> ScopeFindingRow {
    ScopeFindingRow {
        page_id: Some(page_id.to_owned()),
        finding_area: "title_resolution".to_owned(),
        finding_type: "candidate_visibility_incomplete".to_owned(),
        detail: "title_candidates_incomplete".to_owned(),
    }
}

fn unsupported_pattern_row(page_id: &str, detail: String) -> ScopeFindingRow {
    ScopeFindingRow {
        page_id: Some(page_id.to_owned()),
        finding_area: "unsupported_pattern".to_owned(),
        finding_type: "unsupported_internal_pattern".to_owned(),
        detail,
    }
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
