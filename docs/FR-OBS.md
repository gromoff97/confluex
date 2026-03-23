# Observability And Outcome Requirements


### FR-0113
**Requirement**: Serialized `final_status` values shall use a stable vocabulary
for final run status.

**Applicability**:
- all report sets
- confidential-mode status sidecars

**Rationale**:
- Operators need one stable final-status vocabulary across clean completion,
  completion with findings, policy failure, incomplete completion,
  interruption, and encryption failure.

**Acceptance Criteria**:
1. `final_status` uses only `success`, `success_with_findings`,
   `policy_failed`, `incomplete`, `interrupted`, or `encryption_failed`.
2. A completed run that does not later end in encryption failure and has
   `blocking_reasons=none` uses `final_status=success`.
3. A completed run that does not later end in encryption failure and has
   `blocking_reasons` not equal to `none` uses
   `final_status=success_with_findings` unless `--critical` converts the outcome
   to `policy_failed`.
4. A configured stop condition or runtime failure that leaves the run incomplete
   uses `final_status=incomplete`.
5. Signal interruption uses `final_status=interrupted`.
6. Encryption failure after encryption was requested uses
   `final_status=encryption_failed`.

**Dependencies**:
- `FR-0096`
- `FR-0097`
- `FR-0100`
- `FR-0102`
- `FR-0109`
- `FR-0110`
- `FR-0116`
- `FR-0084`

**Traceability**:
- Area: observability and outcomes
- Observable evidence: `summary.txt` final-status field, status-sidecar
  `final_status` line, `RUN_COMPLETE`

### FR-0114
**Requirement**: `summary.txt` shall use a stable vocabulary for scope trust.

**Applicability**:
- all report sets

**Rationale**:
- Operators need a compact summary of whether the product believes semantic scope
  completeness is trusted or degraded.

**Acceptance Criteria**:
1. `scope_trust` uses only `trusted` or `degraded`.
2. If `scope-findings.tsv` contains at least one data row, `scope_trust=degraded`.
3. If `scope-findings.tsv` contains no data rows, `scope_trust=trusted`.

**Dependencies**:
- `FR-0066`
- `FR-0089`

**Traceability**:
- Area: observability and outcomes
- Observable evidence: `summary.txt` scope-trust field

### FR-0115
**Requirement**: `summary.txt` shall use a stable vocabulary for output-path
provenance.

**Applicability**:
- all report sets

**Rationale**:
- Operators need to know whether the output root was generated or explicitly
  chosen.

**Acceptance Criteria**:
1. `output_path_provenance` uses only `explicit` or `generated`.
2. If the operator supplied `--out`, `output_path_provenance=explicit`.
3. If the product generated the output root automatically,
   `output_path_provenance=generated`.

**Dependencies**:
- `FR-0021`
- `FR-0055`

**Traceability**:
- Area: observability and outcomes
- Observable evidence: `summary.txt` output-path-provenance field

### FR-0116
**Requirement**: `summary.txt` shall use stable vocabularies for blocking
reasons and interrupt reasons.

**Applicability**:
- all report sets

**Rationale**:
- Operators need a compact explanation of why the final status is not clean
  success.

**Acceptance Criteria**:
1. `blocking_reasons` uses either the shared absence token defined by
   `FR-0125` or a comma-delimited list serialized with the shared token-list
   form defined by `FR-0126` and containing one or more unique tokens chosen
   from `unresolved_links`, `scope_findings`, and `failed_operations`.
2. If `blocking_reasons` is not the shared absence token, tokens appear only in
   this order:
   `unresolved_links`, `scope_findings`, `failed_operations`.
3. `interrupt_reason` uses only `none`, `max_pages_limit_reached`,
   `max_download_limit_reached`, `runtime_error`, or `signal_interrupt`.
4. If `--max-pages` stops the run, `interrupt_reason=max_pages_limit_reached`.
5. If `--max-download-mib` stops the run,
   `interrupt_reason=max_download_limit_reached`.
6. If runtime failure after accepted run execution has begun stops a run whose
   retained result includes `summary.txt`, `interrupt_reason=runtime_error`.
7. If signal interruption stops a run whose retained result includes
   `summary.txt`, `interrupt_reason=signal_interrupt`.
8. `blocking_reasons=none` if and only if `summary.txt` reports
   `unresolved_links=0`, `scope_findings=0`, and `failed_operations=0`.
9. If `summary.txt` reports a value greater than `0` for `unresolved_links`,
   `scope_findings`, or `failed_operations`, the corresponding token appears
   exactly once in `blocking_reasons`.
10. `interrupt_reason=none` for completed runs and for encryption failures that
    occur after a completed pre-encryption run result has been produced.

**Dependencies**:
- `FR-0097`
- `FR-0100`
- `FR-0102`
- `FR-0109`
- `FR-0112`
- `FR-0092`
- `FR-0125`
- `FR-0126`

**Traceability**:
- Area: observability and outcomes
- Observable evidence: `summary.txt` blocking-reasons and interrupt-reason fields

### FR-0117
**Requirement**: `summary.txt` shall expose recovery accounting through stable
fields.

**Applicability**:
- all report sets

**Rationale**:
- Operators need to know whether resume actually reused payload and how much.

**Acceptance Criteria**:
1. `resume_mode` uses `0` or `1`.
2. `resume_schema_version` uses only `2`.
3. If `resume_mode=1`, `summary.txt` reports `reused_pages` and `fresh_pages`.
4. If `resume_mode=0`, `reused_pages=0` and `fresh_pages=<processed_pages>`.
5. If `resume_mode=1` and no payload was reused, `reused_pages=0`.

**Dependencies**:
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
2. Accepted `export` and `plan` runs that terminate with
   `final_status=success` or `final_status=success_with_findings` exit `0`.
3. Accepted `doctor`, `config`, `install`, and `uninstall` invocations that
   complete according to the requirements corpus exit `0`.
4. `policy_failed` exits `2`.
5. Configured stop conditions exit `3`.
6. Runtime failure after accepted run execution has begun exits `4`.
7. `encryption_failed` exits `5`.
8. Signal interruption exits `130`.

**Dependencies**:
- `FR-0019`
- `FR-0113`
- `FR-0100`
- `FR-0101`
- `FR-0102`
- `FR-0097`

**Traceability**:
- Area: observability and outcomes
- Observable evidence: process exit code

### FR-0119
**Requirement**: `summary.txt` shall use stable vocabularies and invariants for
the remaining required keys.

**Applicability**:
- all report sets

**Rationale**:
- Operators need the rest of the summary fields to remain stable and
  machine-readable.

**Acceptance Criteria**:
1. `command` uses only `export` or `plan`.
2. `support_profile` uses only `default`.
3. If `command=export`, `page_payload_format` uses only `md` or `html` and
   reports the effective page payload format for that run.
4. If `command=plan`, `page_payload_format` uses the shared absence token
   defined by `FR-0125`.
5. `output_root` reports the absolute logical plain output-root path serialized
   as the quoted path string defined by `FR-0124`, even if encryption later
   removes that directory from disk.
6. `page_id` reports the canonical resolved root page identifier.
7. `encryption_enabled=1` if encryption was requested; otherwise `0`.
8. `encryption_successful=1` if and only if an encrypted archive was created
   successfully for the run; otherwise `0`.

**Dependencies**:
- `FR-0090`
- `FR-0017`
- `FR-0112`
- `FR-0121`
- `FR-0124`
- `FR-0125`

**Traceability**:
- Area: observability and outcomes
- Observable evidence: stable `summary.txt` key values

### FR-0120
**Requirement**: `summary.txt` shall use stable counting semantics for
download-volume fields.

**Applicability**:
- all report sets

**Rationale**:
- Operators need download-volume metrics that are reproducible and
  machine-comparable.

**Acceptance Criteria**:
1. `downloaded_mib_total`, `downloaded_mib_content`, and
   `downloaded_mib_metadata` use non-negative decimal values serialized with
   exactly three digits after the decimal point.
2. Download-volume accounting is accumulated in whole bytes before MiB
   serialization.
3. `downloaded_mib_content` counts only bytes acquired during the current run for
   page payload materialization in the selected format and attachment payload
   downloads.
4. `downloaded_mib_metadata` counts only bytes acquired during the current run
   for page metadata, storage-format data, and attachment-preview data.
5. `downloaded_mib_total` is derived from the exact arithmetic sum of the
   content-byte counter and the metadata-byte counter.
6. For MiB serialization, `1 MiB` means exactly `1,048,576` bytes.

**Dependencies**:
- `FR-0069`
- `FR-0070`
- `FR-0071`
- `FR-0072`
- `FR-0073`
- `FR-0074`
- `FR-0075`

**Traceability**:
- Area: observability and outcomes
- Observable evidence: summary MiB fields and underlying report semantics
