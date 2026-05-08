# Observability And Outcome Requirements


### FR-0113
**Requirement**: Serialized `final_status` values shall use a stable vocabulary
for final run status.

**Applicability**:
- all report sets
- stdout `RUN_COMPLETE` lines that serialize `final_status`

**Rationale**:
- Operators need one stable final-status vocabulary across clean completion,
  completion with findings, incomplete completion, and interruption.

**Acceptance Criteria**:
1. `final_status` uses only `success`, `success_with_findings`,
   `incomplete`, or `interrupted`.
2. A completed run that has `blocking_reasons=none` uses
   `final_status=success`.
3. A completed run that has `blocking_reasons` not equal to `none` uses
   `final_status=success_with_findings` for base outcome evaluation.
4. A configured stop condition or runtime failure that leaves the run incomplete
   uses `final_status=incomplete`.
5. Signal interruption uses `final_status=interrupted`.

**Dependencies**:
- `FR-0116`

**Traceability**:
- Area: observability and outcomes
- Observable evidence: `summary.txt` final-status field, `RUN_COMPLETE`

### FR-0114
**Requirement**: `summary.txt` shall use a stable vocabulary for scope trust.

**Applicability**:
- report sets whose `summary.txt` schema is governed by `FR-0090`

**Rationale**:
- Operators need a compact summary of whether the product believes semantic
  scope completeness is trusted or degraded.

**Acceptance Criteria**:
1. `scope_trust` uses only `trusted` or `degraded`.
2. If `final_status` is `incomplete` or `interrupted`,
   `scope_trust=degraded`.
3. If `scope-findings.tsv` contains at least one data row, if `summary.txt`
   reports `unresolved_links` greater than `0`, or if `failed-pages.tsv`
   contains at least one data row with `operation=page_metadata` or
   `operation=storage_content`, `scope_trust=degraded`.
4. If `final_status` is `success` or `success_with_findings`, and criterion 3
   does not apply, `scope_trust=trusted`.
5. Page-local failures counted only through `failed-pages.tsv` do not by
   themselves change `scope_trust` unless criterion 3 applies.

**Dependencies**:
- `FR-0070`
- `FR-0088`
- `FR-0090`
- `FR-0085`
- `FR-0113`
- `FR-0066`
- `FR-0089`
- `FR-0092`

**Traceability**:
- Area: observability and outcomes
- Observable evidence: `summary.txt` scope-trust field

### FR-0115
**Requirement**: `summary.txt` shall use a stable vocabulary for output-path
provenance.

**Applicability**:
- report sets whose `summary.txt` schema is governed by `FR-0090`

**Rationale**:
- Operators need to know whether the output root was generated or selected by a
  public input.

**Acceptance Criteria**:
1. `output_path_provenance` uses only `explicit`, `configured`, or `generated`.
2. If the operator supplied `--out`, `output_path_provenance=explicit`.
3. If `--out` was omitted and `CONFLUEX_OUTPUT_ROOT` supplied the output root
   under `FR-0219`, `output_path_provenance=configured`.
4. If the product generated the output root automatically,
   `output_path_provenance=generated`.

**Dependencies**:
- `FR-0090`
- `FR-0085`
- `FR-0021`
- `FR-0219`

**Traceability**:
- Area: observability and outcomes
- Observable evidence: `summary.txt` output-path-provenance field

### FR-0116
**Requirement**: `summary.txt` shall use a stable vocabulary for blocking
reasons.

**Applicability**:
- report sets whose `summary.txt` schema is governed by `FR-0090`

**Rationale**:
- Operators need a compact explanation of why the final status is not clean
  success because report findings or page-local failures remain.

**Acceptance Criteria**:
1. `blocking_reasons` uses either the shared absence token defined by
   `FR-0125` or a comma-delimited list serialized with the shared token-list
   form defined by `FR-0126` and containing one or more unique tokens chosen
   from `unresolved_links`, `scope_findings`, and `failed_operations`.
2. If `blocking_reasons` is not the shared absence token, tokens appear only in
   this order:
   `unresolved_links`, `scope_findings`, `failed_operations`.
3. `blocking_reasons=none` if and only if `summary.txt` reports
   `unresolved_links=0`, `scope_findings=0`, and `failed_operations=0`.
4. If `summary.txt` reports a value greater than `0` for `unresolved_links`,
   `scope_findings`, or `failed_operations`, the corresponding token appears
   exactly once in `blocking_reasons`.

**Dependencies**:
- `FR-0090`
- `FR-0085`
- `FR-0092`
- `FR-0125`
- `FR-0126`

**Traceability**:
- Area: observability and outcomes
- Observable evidence: `summary.txt` blocking-reasons field

### FR-0140
**Requirement**: `summary.txt` shall use a stable vocabulary for interrupt
reasons.

**Applicability**:
- report sets whose `summary.txt` schema is governed by `FR-0090`

**Rationale**:
- Operators need a compact explanation of why a retained report set represents
  an interrupted, stopped, or runtime-failed run.

**Acceptance Criteria**:
1. `interrupt_reason` uses either the shared absence token defined by
   `FR-0125` or one of `max_pages_limit_reached`,
   `max_download_limit_reached`, `runtime_error`, or `signal_interrupt`.
2. If `--max-pages` or `CONFLUEX_MAX_PAGES` stops the run,
   `interrupt_reason=max_pages_limit_reached`.
3. If `--max-download-mib` or `CONFLUEX_MAX_DOWNLOAD_MIB` stops the run,
   `interrupt_reason=max_download_limit_reached`.
4. If both configured stop limits would stop the run at the same decision
   point, `interrupt_reason=max_pages_limit_reached`.
5. If runtime failure after accepted run execution has begun stops a run whose
   retained result includes `summary.txt`, `interrupt_reason=runtime_error`.
6. If signal interruption stops a run whose retained result includes
   `summary.txt`, `interrupt_reason=signal_interrupt`.
7. `interrupt_reason` uses the shared absence token for completed runs.

**Dependencies**:
- `FR-0090`
- `FR-0085`
- `FR-0034`
- `FR-0100`
- `FR-0101`
- `FR-0102`
- `FR-0125`
- `FR-0219`

**Traceability**:
- Area: observability and outcomes
- Observable evidence: `summary.txt` interrupt-reason field

### FR-0117
**Requirement**: `summary.txt` shall expose recovery accounting through stable
fields.

**Applicability**:
- report sets whose `summary.txt` schema is governed by `FR-0090`

**Rationale**:
- Operators need to know whether resume actually reused payload and how much.

**Acceptance Criteria**:
1. `resume_mode` uses `0` or `1`.
2. `resume_schema_version` uses only `3`.
3. `resume_mode=1` only for accepted resumed export runs.
4. `resume_mode=0` for any report set not covered by criterion 3.
5. If `resume_mode=1`, `summary.txt` reports `reused_pages` and `fresh_pages`.
6. If `resume_mode=0`, `reused_pages=0` and `fresh_pages=<processed_pages>`.
7. If `resume_mode=1` and no payload was reused, `reused_pages=0`.
8. `reused_pages` is the count of processed pages whose page payload was reused
   from a prior incomplete result under `FR-0105`.
9. `fresh_pages` is the count of processed pages that were not counted in
   `reused_pages`; this includes `plan_only` processed pages and
   `materialized` processed pages whose payload was not acquired successfully.
10. `reused_pages + fresh_pages` equals `processed_pages`.

**Dependencies**:
- `FR-0090`
- `FR-0085`
- `FR-0105`
- `FR-0106`
- `FR-0092`

**Traceability**:
- Area: observability and outcomes
- Observable evidence: recovery-accounting fields in `summary.txt`

### FR-0118
**Requirement**: The CLI shall use stable exit codes for black-box automation.

**Applicability**:
- all invocations

**Rationale**:
- Operators and automation need exit codes that distinguish the major outcome
  classes.

**Acceptance Criteria**:
1. Rejected invocations exit `1`.
2. Accepted `export` runs that terminate with
   `final_status=success` or `final_status=success_with_findings` exit `0`.
3. Accepted `setup` invocations that complete according to the setup success
   contract governed by `FR-0043` exit `0`.
4. Accepted `setup` invocations that fail setup validation under `FR-0043` exit
   `1`.
5. Configured stop conditions exit `3`.
6. Runtime failure after accepted run execution has begun exits `4`.
7. Signal interruption exits `130`.
8. Top-level help invocations governed by `FR-0007` exit `0`.
9. Command-help invocations governed by `FR-0008` exit `0`.

**Dependencies**:
- `FR-0007`
- `FR-0008`
- `FR-0019`
- `FR-0043`
- `FR-0113`
- `FR-0100`
- `FR-0101`
- `FR-0102`
- `FR-0097`
- `FR-0142`

**Traceability**:
- Area: observability and outcomes
- Observable evidence: process exit code

### FR-0142
**Requirement**: Runtime failures of accepted setup invocations shall use one
bounded observable contract.

**Applicability**:
- accepted `setup` invocations whose failure is observed after invocation
  acceptance under `FR-0212` and is not a setup validation failure governed by
  `FR-0043`

**Rationale**:
- Operators need setup runtime failures to be visible without confusing them
  with setup validation failures, successful setup lines, or rejected
  invocations.

**Acceptance Criteria**:
1. The invocation exits `4` under `FR-0118`.
2. The invocation does not emit `setup_result=passed` or `config_path=` stdout
   lines after the failure is observed.
3. Runtime-failure output is written to `stderr`.
4. Runtime-failure stderr is UTF-8 text with LF line endings and at least one
   line.
5. The first stderr line is `ERROR: <message>`, where `<message>` is non-empty
   after removing leading and trailing ASCII space and contains no TAB, LF, or
   CR.
6. Additional stderr lines, if any, are non-governed diagnostic text and do not
   define additional runtime-failure status values.
7. User configuration state after a setup runtime failure is governed by
   `FR-0042`.
8. A setup runtime failure does not emit any setup success stdout line after the
   failure is observed.

**Dependencies**:
- `FR-0118`
- `FR-0212`
- `FR-0042`
- `FR-0043`

**Traceability**:
- Area: observability and outcomes
- Observable evidence: stderr error output

### FR-0119
**Requirement**: `summary.txt` shall use stable value contracts for command,
execution mode, support-profile, payload-format, output-root, ZIP path, and
page-id fields.

**Applicability**:
- report sets whose `summary.txt` schema is governed by `FR-0090`

**Rationale**:
- Operators need the rest of the summary fields to remain stable and
  machine-readable.

**Acceptance Criteria**:
1. `command` uses only `export`.
2. `execution_mode` uses only `materialized` or `plan_only`.
3. `support_profile` uses only `default`.
4. If `execution_mode=materialized`, `page_payload_format` is exactly `md`.
5. If `execution_mode=plan_only`, `page_payload_format` uses the shared absence
   token governed by `FR-0125`, serialized here as exactly `none`.
6. `output_root` reports the absolute logical plain output-root path; its
   serialization uses the quoted path string governed by `FR-0124`, which for
   this field is one JSON string literal with no surrounding whitespace whose
   decoded value is that exact absolute path.
7. If the run creates a ZIP archive under `FR-0221`, `zip_path` reports that
   absolute ZIP path using the quoted path string governed by `FR-0124`.
   Otherwise `zip_path` is the shared absence token governed by `FR-0125`,
   serialized here as exactly `none`.
8. `page_id` reports the canonical resolved root page identifier.

**Dependencies**:
- `FR-0021`
- `FR-0227`
- `FR-0228`
- `FR-0058`
- `FR-0085`
- `FR-0076`
- `FR-0090`
- `FR-0017`
- `FR-0121`
- `FR-0124`
- `FR-0125`
- `FR-0221`

**Traceability**:
- Area: observability and outcomes
- Observable evidence: stable `summary.txt` key values

### FR-0120
**Requirement**: `summary.txt` shall use stable counting semantics for
download-volume fields.

**Applicability**:
- report sets whose `summary.txt` schema is governed by `FR-0090`

**Rationale**:
- Operators need download-volume metrics that are reproducible and
  machine-comparable.

**Acceptance Criteria**:
1. `downloaded_mib_total`, `downloaded_mib_content`, and
   `downloaded_mib_metadata` use non-negative decimal values serialized with
   exactly three digits after the decimal point.
2. Download-volume accounting is accumulated in whole bytes before MiB
   serialization.
3. `downloaded_mib_content` counts only content-byte volume accumulated during
   the current run: exact page-payload byte sequences produced for successful
   page payload materialization in the selected format and exact attachment
   payload byte sequences acquired by attachment payload downloads.
4. `downloaded_mib_metadata` counts only metadata-byte volume accumulated during
   the current run for page metadata, storage-format data, child-listing data,
   page-id lookup data, title-resolution candidate data, attachment-preview
   data, and attachment data acquired to determine `attachment_count`.
5. Content bytes are counted at the boundary where the product has the exact
   byte sequence that becomes the persisted page payload or attachment payload,
   before any later ZIP packaging.
6. Metadata bytes are counted at the boundary where the product has the decoded
   Confluence API response body bytes used for metadata, storage-format,
   child-listing, page-id lookup, title-candidate, attachment-preview, or
   attachment-count interpretation, before report serialization or page-payload
   conversion.
7. Bytes from transport headers, TLS framing, HTTP compression framing, local
   log text, generated reports, and ZIP archives do not contribute to
   download-volume counters.
8. `downloaded_mib_total` is derived from the exact arithmetic sum of the
   content-byte counter and the metadata-byte counter.
9. For MiB serialization, `1 MiB` means exactly `1,048,576` bytes.
10. MiB serialization divides the byte counter by `1,048,576` and rounds the
    result to the nearest `0.001`; exact half-way values round away from zero.

**Dependencies**:
- `FR-0090`
- `FR-0085`
- `FR-0064`
- `FR-0069`
- `FR-0070`
- `FR-0071`
- `FR-0072`
- `FR-0073`
- `FR-0074`
- `FR-0075`
- `FR-0121`

**Traceability**:
- Area: observability and outcomes
- Observable evidence: summary MiB fields and underlying report semantics
