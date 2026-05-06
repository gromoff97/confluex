# Observability And Outcome Requirements


### FR-0113
**Requirement**: Serialized `final_status` values shall use a stable vocabulary
for final run status.

**Applicability**:
- all report sets
- confidential-mode status sidecars
- stdout `RUN_COMPLETE` lines that serialize `final_status`

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
   `final_status=success_with_findings` for base outcome evaluation.
4. A configured stop condition or runtime failure that leaves the run incomplete
   uses `final_status=incomplete`.
5. Signal interruption uses `final_status=interrupted`.
6. Encryption failure after encryption was requested uses
   `final_status=encryption_failed`.
7. `policy_failed` is reserved for policy-overlay requirements that explicitly
   select it, including `FR-0096`.

**Dependencies**:
- `FR-0116`
- `FR-0096`

**Traceability**:
- Area: observability and outcomes
- Observable evidence: `summary.txt` final-status field, status-sidecar
  `final_status` line, `RUN_COMPLETE`

### FR-0114
**Requirement**: `summary.txt` shall use a stable vocabulary for scope trust.

**Applicability**:
- report sets whose `summary.txt` schema is governed by `FR-0090`

**Rationale**:
- Operators need a compact summary of whether the product believes semantic scope
  completeness is trusted or degraded.

**Acceptance Criteria**:
1. `scope_trust` uses only `trusted` or `degraded`.
2. If `final_status` is `incomplete` or `interrupted`,
   `scope_trust=degraded`.
3. If `scope-findings.tsv` contains at least one data row or if
   `summary.txt` reports `unresolved_links` greater than `0`, or if
   `failed-pages.tsv` contains at least one data row with
   `operation=page_metadata` or `operation=storage_content`,
   `scope_trust=degraded`.
4. If `final_status` is `success`, `success_with_findings`, `policy_failed`, or
   `encryption_failed`, and `scope-findings.tsv` contains no data rows and
   `summary.txt` reports `unresolved_links=0`, and `failed-pages.tsv` contains
   no data row with `operation=page_metadata` or
   `operation=storage_content`, `scope_trust=trusted`.
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
- Operators need to know whether the output root was generated or explicitly
  chosen.

**Acceptance Criteria**:
1. `output_path_provenance` uses only `explicit` or `generated`.
2. If the operator supplied `--out`, `output_path_provenance=explicit`.
3. If the product generated the output root automatically,
   `output_path_provenance=generated`.

**Dependencies**:
- `FR-0090`
- `FR-0085`
- `FR-0021`

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
2. If `--max-pages` stops the run, `interrupt_reason=max_pages_limit_reached`.
3. If `--max-download-mib` stops the run,
   `interrupt_reason=max_download_limit_reached`.
4. If both `--max-pages` and `--max-download-mib` would stop the run at the same
   decision point, `interrupt_reason=max_pages_limit_reached`.
5. If runtime failure after accepted run execution has begun stops a run whose
   retained result includes `summary.txt`, `interrupt_reason=runtime_error`.
6. If signal interruption stops a run whose retained result includes
   `summary.txt`, `interrupt_reason=signal_interrupt`.
7. `interrupt_reason` uses the shared absence token for completed runs and for
   encryption failures that occur after a completed pre-encryption run result
   has been produced.

**Dependencies**:
- `FR-0090`
- `FR-0085`
- `FR-0034`
- `FR-0100`
- `FR-0101`
- `FR-0102`
- `FR-0107`
- `FR-0109`
- `FR-0110`
- `FR-0112`
- `FR-0149`
- `FR-0125`

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
2. `resume_schema_version` uses only `2`.
3. `resume_mode=1` only for accepted resumed export runs.
4. `resume_mode=0` for any report set not covered by criterion 3, including
   any `plan` run and any `export` run that is not an accepted resumed export
   run.
5. If `resume_mode=1`, `summary.txt` reports `reused_pages` and `fresh_pages`.
6. If `resume_mode=0`, `reused_pages=0` and `fresh_pages=<processed_pages>`.
7. If `resume_mode=1` and no payload was reused, `reused_pages=0`.
8. `reused_pages` is the count of processed pages whose page payload was reused
   from a prior incomplete result under `FR-0105`.
9. `fresh_pages` is the count of processed pages that were not counted in
   `reused_pages`; this includes `plan` processed pages and `export` processed
   pages whose payload was not acquired successfully.
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
2. Accepted `export` and `plan` runs that terminate with
   `final_status=success` or `final_status=success_with_findings` exit `0`.
3. Accepted `doctor`, `config`, `install`, and `uninstall` invocations that
   complete according to the requirements corpus exit `0`.
4. Accepted `doctor`, `config`, `install`, and `uninstall` invocations that fail
   after accepted command work begins exit `4`.
5. `policy_failed` exits `2`.
6. Configured stop conditions exit `3`.
7. Runtime failure after accepted run execution has begun exits `4`.
8. `encryption_failed` exits `5`.
9. Signal interruption exits `130`.
10. Accepted `selftest` invocations with `selftest_status=passed` exit `0`.
11. Accepted `selftest` invocations with `selftest_status=failed` and not
   interrupted by signal under `FR-0156` exit `4`.
12. Accepted `selftest` invocations that take the self-test report-root failure
   branch under `FR-0174` exit `4`.
13. Accepted `selftest` invocations interrupted by a signal under `FR-0156`
    exit `130`.
14. Top-level help invocations governed by `FR-0007` exit `0`.
15. Command-help invocations governed by `FR-0008` exit `0`.

**Dependencies**:
- `FR-0007`
- `FR-0008`
- `FR-0019`
- `FR-0113`
- `FR-0100`
- `FR-0101`
- `FR-0102`
- `FR-0136`
- `FR-0174`
- `FR-0097`
- `FR-0156`

**Traceability**:
- Area: observability and outcomes
- Observable evidence: process exit code

### FR-0142
**Requirement**: Runtime failures of accepted non-run utility commands shall use
one bounded observable contract.

**Applicability**:
- accepted `doctor`, `config`, `install`, and `uninstall` invocations whose
  failure is observed after invocation acceptance under `FR-0212` and after
  command-specific work begins

**Rationale**:
- Operators need utility-command runtime failures to be visible without confusing
  them with successful result lines or rejected invocations.

**Acceptance Criteria**:
1. The invocation exits `4` under `FR-0118`.
2. The invocation emits no stdout.
3. Runtime-failure output is written to `stderr`.
4. Runtime-failure stderr is UTF-8 text with LF line endings and at least one
   line.
5. The first stderr line is `ERROR: <message>`, where `<message>` is non-empty
   after removing leading and trailing ASCII space and contains no TAB, LF, or
   CR.
6. Additional stderr lines, if any, are non-governed diagnostic text and do not
   define additional runtime-failure status values.
7. A `doctor` runtime failure does not create, modify, or remove any
   product-owned persistent file, directory, Docker resource, or configuration
   state other than the selected persistent log artifact, if any, and any
   parent directory created solely so that artifact can be written under
   `FR-0134`. If such a selected persistent log artifact exists, it is retained
   or left as already written.
8. A read-only `config` runtime failure leaves the saved default encryption
   recipient state unchanged from its pre-invocation state.
9. A `config --encryption-key <value>` or `config --clear-encryption-key` runtime
   failure leaves the saved default encryption recipient state unchanged from its
   pre-invocation state.
10. For this card, `<target>` is the accepted invocation's resolved installation
   target.
11. An `install` runtime failure does not create a new valid
   `<target>/.confluex-install-manifest.txt` for the failed invocation. If the
   failure occurs before target mutation begins, any pre-existing valid install
   manifest remains governed by the pre-invocation installation state.
12. An `uninstall` runtime failure modifies no target path except paths listed in
   the valid install manifest that governed that uninstall attempt.
13. After an `uninstall` runtime failure, any removed target path must have been
   removable by the manifest-governed uninstall semantics for that attempt.

**Dependencies**:
- `FR-0118`
- `FR-0212`
- `FR-0215`
- `FR-0134`
- `FR-0045`
- `FR-0046`
- `FR-0047`
- `FR-0166`
- `FR-0167`
- `FR-0168`
- `FR-0170`
- `FR-0171`

**Traceability**:
- Area: observability and outcomes
- Observable evidence: stderr error output, absence of success stdout, bounded
  state changes

### FR-0119
**Requirement**: `summary.txt` shall use stable value contracts for command,
support-profile, payload-format, output-root, page-id, and encryption fields.

**Applicability**:
- report sets whose `summary.txt` schema is governed by `FR-0090`

**Rationale**:
- Operators need the rest of the summary fields to remain stable and
  machine-readable.

**Acceptance Criteria**:
1. `command` uses only `export` or `plan`.
2. `support_profile` uses only `default`.
3. If `command=export`, `page_payload_format` uses only `md` or `html` and
   reports the effective page payload format for that run.
4. If `command=plan`, `page_payload_format` uses the shared absence token
   governed by `FR-0125`, serialized here as exactly `none`.
5. `output_root` reports the absolute logical plain output-root path; its
   serialization uses the quoted path string governed by `FR-0124`, which for
   this field is one JSON string literal with no surrounding whitespace whose
   decoded value is that exact absolute path, even if encryption later removes
   that directory from disk.
6. `page_id` reports the canonical resolved root page identifier.
7. `encryption_enabled=1` if encryption was requested; otherwise `0`.
8. `encryption_successful=1` if and only if the final encrypted-run branch from
   `FR-0149` is the successful-encryption branch whose authoritative final
   artifact is the encrypted archive; otherwise `0`.
9. Encrypted archives created during a cleanup-failure branch and later
   classified as non-authoritative debris under `FR-0107` do not satisfy
   criterion 8.

**Dependencies**:
- `FR-0021`
- `FR-0024`
- `FR-0025`
- `FR-0058`
- `FR-0085`
- `FR-0076`
- `FR-0090`
- `FR-0107`
- `FR-0149`
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
   before any later archive compression or encryption.
6. Metadata bytes are counted at the boundary where the product has the decoded
   Confluence API response body bytes used for metadata, storage-format,
   child-listing, page-id lookup, title-candidate, attachment-preview, or
   attachment-count interpretation, before report serialization or
   page-payload conversion.
7. Bytes from transport headers, TLS framing, HTTP compression framing, local log
   text, generated reports, generated sidecars, encrypted archives, and Docker
   self-test control traffic do not contribute to download-volume counters.
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

### FR-0133
**Requirement**: Accepted `selftest` runs with a retained report root shall emit
one stable stdout result line.

**Applicability**:
- accepted non-help `confluex selftest` invocations

**Rationale**:
- Maintainers and automation need one machine-readable stdout line that locates
  the self-test report and names the aggregate self-test status.

**Acceptance Criteria**:
1. If `selftest` retains a self-test report root under `FR-0173`, it emits
   exactly one stdout result line in the format
   `selftest_result=<status> report_root=<quoted_path_string>`.
2. `<status>` equals the `selftest_status` value defined by `FR-0136`.
3. `<quoted_path_string>` uses the quoted path-string rules defined by
   `FR-0124` and names the retained self-test report root selected and retained
   under `FR-0173`.
4. Accepted `selftest` invocations that retain a self-test report root emit no
   stdout line other than the result line from criterion 1.
5. Accepted `selftest` invocations that retain a self-test report root write
   nothing to `stderr`.
6. Accepted report-root handling failures before the retained-root threshold
   from `FR-0173` is reached are governed by `FR-0174`.

**Dependencies**:
- `FR-0124`
- `FR-0136`
- `FR-0173`
- `FR-0174`

**Traceability**:
- Area: observability and outcomes
- Observable evidence: self-test stdout result line

### FR-0135
**Requirement**: Retained self-test report roots shall use one stable top-level
self-test report-root layout.

**Applicability**:
- accepted non-help `confluex selftest` invocations whose retained self-test
  report root under `FR-0173` exists

**Rationale**:
- Maintainers and automation need one retained report root that explains which
  self-test phases ran and where detailed evidence was written.

**Acceptance Criteria**:
1. The retained self-test report root top level contains no entries other than
   the mandatory top-level entries and directories governed by criteria 2
   through 8.
2. The mandatory top-level entries are exactly `summary.txt`, `identities.json`,
   `live-bats.tap`, `plan/`, `export/`, `expected/`, and `diagnostics/`.
3. `summary.txt` is governed by `FR-0182`.
4. `identities.json` is governed by `FR-0183`.
5. `live-bats.tap` is governed by `FR-0184`.
6. `plan/` and `export/` are governed by `FR-0186`.
7. `expected/` is governed by `FR-0185`.
8. `diagnostics/` is governed by `FR-0187`.

**Dependencies**:
- `FR-0173`
- `FR-0182`
- `FR-0183`
- `FR-0184`
- `FR-0185`
- `FR-0186`
- `FR-0187`

**Traceability**:
- Area: observability and outcomes
- Observable evidence: retained self-test report-root top-level entry set

### FR-0136
**Requirement**: Accepted `selftest` runs shall use stable self-test phase and
aggregate status values.

**Applicability**:
- accepted non-help `confluex selftest` invocations

**Rationale**:
- Maintainers and automation need stable status values that distinguish passing,
  failing, and skipped self-test phases.

**Acceptance Criteria**:
1. `bootstrap_status` uses only `passed` or `failed`.
2. `fixture_apply_status` uses only `passed`, `failed`, or `not_run`.
3. `prepare_expected_data_status` uses only `passed`, `failed`, or `not_run`.
4. `live_regression_status` uses only `passed`, `failed`, or `not_run`.
5. `selftest_status` uses only `passed` or `failed`.
6. The bootstrap phase is attempted when `selftest` begins the governed
   bootstrap sequence immediately after candidate self-test report-root
   creation succeeds under `FR-0173` and before the first governed bootstrap
   action is evaluated. The governed bootstrap sequence consists first of the
   suite-root and support-path preflight governed by `FR-0138` and then of the
   explicit-target bootstrap phase governed by `FR-0132`.
7. The fixture-application phase is attempted when `selftest` begins fixture
   dataset preparation under `FR-0137` after `bootstrap_status=passed` and
   before the first governed fixture step is evaluated.
8. The expected-data phase is attempted when `selftest` begins expected-data
   preparation under `FR-0144` after `fixture_apply_status=passed` and before
   the first governed expected-data step is evaluated.
9. The live-regression phase is attempted when `selftest` begins live
   regression suite selection under `FR-0138` after
   `prepare_expected_data_status=passed` and before the first governed
   live-regression step is evaluated.
10. `bootstrap_status` covers the full governed bootstrap sequence from
   criterion 6, including both the suite-root and support-path preflight
   governed by `FR-0138` and the explicit-target bootstrap phase governed by
   `FR-0132`; it reports `passed` only when that sequence completes
   successfully and reports `failed` only when that sequence is attempted and
   fails.
11. `fixture_apply_status` covers fixture dataset application from `FR-0137`; it
   reports `passed` only when that phase completes successfully, reports
   `failed` only when that phase is attempted and fails, and reports `not_run`
   only when `bootstrap_status=failed` or when a signal is observed before the
   fixture-application phase is attempted under `FR-0156` after
   `bootstrap_status=passed`.
12. `prepare_expected_data_status` covers expected-data artifact preparation from
   `FR-0144`; it reports `passed` only when that phase completes successfully,
   reports `failed` only when that phase is attempted and fails, and reports
   `not_run` only when `bootstrap_status=failed` or
   `fixture_apply_status=failed`, or when a signal is observed before the
   expected-data phase is attempted under `FR-0156` after
   `fixture_apply_status=passed`.
13. `live_regression_status` covers full live regression execution from
   `FR-0138`; it reports `passed` only when the live regression phase is
   attempted and completes successfully.
14. If the attempted live regression phase fails, `live_regression_status=failed`.
15. If live regression execution is not attempted because
   `bootstrap_status=failed`, `fixture_apply_status=failed`,
   `prepare_expected_data_status=failed`, or because a signal is observed before
   the live-regression phase is attempted under `FR-0156` after
   `prepare_expected_data_status=passed`, `live_regression_status=not_run`.
16. If all self-test phases pass, `selftest_status=passed`.
17. If any self-test phase fails after invocation acceptance under `FR-0212`,
    `selftest_status=failed`.

**Dependencies**:
- `FR-0132`
- `FR-0137`
- `FR-0138`
- `FR-0144`
- `FR-0156`
- `FR-0173`
- `FR-0212`

**Traceability**:
- Area: observability and outcomes
- Observable evidence: self-test phase status fields and aggregate status

### FR-0173
**Requirement**: The self-test report-root selection, creation, and retained-root
threshold contract shall select one retained report-root path under the process
current working directory.

**Applicability**:
- accepted non-help `confluex selftest` invocations

**Rationale**:
- Maintainers and automation need one deterministic retained report-root path
  per accepted self-test invocation.

**Acceptance Criteria**:
1. The report-root base directory is the process current working directory
   acquired as a current-working-directory source under `FR-0158`; it must be
   absolute and path-normalizable for the current platform under `FR-0159`.
   If current-working-directory source acquisition fails under `FR-0158`, the
   self-test report-root failure branch is governed by `FR-0174` before any
   candidate report-root path is created.
2. `selftest` has no operator-supplied report-root directory option; the only
   report-root base directory is the process current working directory.
3. The default self-test report-root base name is
   `confluex_selftest_<YYYYMMDDTHHMMSSZ>`.
4. `<YYYYMMDDTHHMMSSZ>` is the UTC time captured exactly once immediately after
   invocation acceptance under `FR-0212` and before the product evaluates the
   first self-test report-root candidate under criteria 5 through 7,
   serialized as four-digit year, two-digit month, two-digit day, literal `T`,
   two-digit 24-hour hour, two-digit minute, two-digit second, and literal `Z`,
   with all numeric components zero-padded.
5. For the default base name from criteria 3 and 4 and for each suffixed retry
   candidate from criterion 6, `selftest` joins that single directory name to
   the base directory from criterion 1 and path-normalizes the joined result
   under `FR-0159` before atomic directory creation is attempted.
6. The product attempts to create the default self-test report-root path
   atomically as a directory; if that atomic creation fails because the
   candidate already exists, including because another process created it after
   a prior existence check, the product appends the smallest suffix `_<n>`
   where `<n>` is a canonical positive integer governed by `FR-0014` and the
   first retry uses `n=1`, then repeats the same atomic creation attempt until
   one candidate is created or creation fails for a reason other than
   already-exists.
7. Candidate report-root path existence checks, when performed before atomic
   creation attempts, use non-following filesystem metadata; a race that creates
   the same candidate before the atomic creation attempt is treated as an
   existing path under criterion 6, not as the selected report root.
8. Any existing filesystem object at a candidate report-root path, including a
   regular file, directory, symbolic link, FIFO, socket, or device, counts as an
   existing path for criterion 6 and is not reused by the current invocation.
9. If any existing ancestor of the selected report-root path is a symbolic link,
   regular file, FIFO, socket, device, or any other non-directory filesystem
   object, self-test report-root creation fails under `FR-0174`.
10. If candidate-path normalization required by criterion 5 fails, if creating
    missing parent directories fails, or if atomic creation of a candidate
    report-root directory fails after invocation acceptance under `FR-0212`
    for a reason other than already-exists, self-test report-root creation
    fails under `FR-0174`.
11. If creating the selected report-root directory succeeds, the selected path is
    the candidate self-test report root.
12. The candidate self-test report root becomes the retained self-test report
    root only when its top-level entry set and placement satisfy `FR-0135` and
    its `summary.txt`, `identities.json`, `live-bats.tap`, `expected/`,
    `diagnostics/`, `plan/`, and `export/` contents satisfy `FR-0182`,
    `FR-0183`, `FR-0184`, `FR-0185`, `FR-0187`, and `FR-0186`, with both
    `plan/` and `export/` governed by `FR-0186`.
    Before criterion 12 is reached, the path remains only the candidate
    self-test report root and has no obligation to satisfy `FR-0135`,
    `FR-0182`, `FR-0183`, `FR-0184`, `FR-0185`, `FR-0186`, or `FR-0187`.

**Dependencies**:
- `FR-0014`
- `FR-0135`
- `FR-0154`
- `FR-0158`
- `FR-0159`
- `FR-0212`
- `FR-0174`
- `FR-0182`
- `FR-0183`
- `FR-0184`
- `FR-0185`
- `FR-0186`
- `FR-0187`

**Traceability**:
- Area: observability and outcomes
- Observable evidence: selected report-root path and creation attempts

### FR-0174
**Requirement**: The self-test report-root failure branch shall suppress stdout
and emit the runtime-failure stderr branch when retained report-root handling
fails before retention completes.

**Applicability**:
- accepted non-help `confluex selftest` invocations

**Rationale**:
- Maintainers and automation need deterministic failure signaling when the
  report-root path cannot be selected, retained, or cleaned up.

**Acceptance Criteria**:
1. If self-test report-root base-directory acquisition, candidate-path
   normalization, selection, creation, or mandatory retained-schema retention
   required to reach the retained-root threshold from `FR-0173` fails after
   invocation acceptance under `FR-0212` and before that threshold is reached,
   or if another self-test card explicitly routes an accepted pre-status
   runtime failure other than signal interruption to this criterion before any
   phase status is retained, `selftest` emits no stdout, writes runtime-failure
   output to `stderr`, and exits `4`.
2. If the failure from criterion 1 occurs before target access begins, the
   invocation does not access the target, execute fixture preparation,
   expected-data preparation, or run live regression tests.
3. The criterion-1 failure branch does not attempt Docker lifecycle cleanup.
4. The stderr branch in criterion 1 is UTF-8 text with LF line endings and at
   least one line.
5. The first stderr line in criterion 1 is `ERROR: <message>`, where
   `<message>` is non-empty after removing leading and trailing ASCII space and
   contains no TAB, LF, or CR.
6. Additional stderr lines in criterion 1, if any, are non-governed diagnostic
   text and do not define additional self-test status values.
7. If the selected report-root directory was created before a criterion 1
   failure, the product attempts to remove that report-root directory
   recursively before process exit.
8. If removal from criterion 7 succeeds, no self-test report root is retained
   for that invocation.
9. If removal from criterion 7 fails, any remaining selected report-root path is
   non-authoritative self-test report-root debris, satisfies `FR-0217`, is not
   a retained self-test report root, has no obligation to satisfy the retained
   self-test report-root schema, and is not named by any stdout result line.

**Dependencies**:
- `FR-0118`
- `FR-0173`
- `FR-0212`
- `FR-0217`

**Traceability**:
- Area: observability and outcomes
- Observable evidence: runtime-failure stderr output and report-root cleanup

### FR-0182
**Requirement**: Retained self-test report roots shall use one stable
`summary.txt` schema.

**Applicability**:
- accepted non-help `confluex selftest` invocations whose retained self-test
  report root under `FR-0173` exists

**Rationale**:
- Maintainers and automation need one machine-readable status summary inside the
  retained self-test report root.

**Acceptance Criteria**:
1. `summary.txt` exists at the top level of the retained self-test report root.
2. `summary.txt` is UTF-8 text with LF line endings.
3. `summary.txt` contains exactly these keys once each, in this exact order:
   `command`, `confluence_version`, `fixture_dataset`, `bootstrap_status`,
   `fixture_apply_status`, `prepare_expected_data_status`,
   `live_regression_status`, `selftest_status`, and `report_root`.
4. `summary.txt` contains exactly one `key=value` line for each key in
   criterion 3, in criterion 3 order, and contains no empty lines or additional
   lines.
5. Each `key` is serialized exactly as named in criterion 3, immediately
   followed by ASCII `=`, then that key's value.
6. The final physical line of `summary.txt` is terminated by LF, and no bytes
   occur after that LF.
7. `command=selftest`, `confluence_version=7.13.7`, and
   `fixture_dataset=confluence-7137`.
8. The status fields `bootstrap_status`, `fixture_apply_status`,
   `prepare_expected_data_status`, `live_regression_status`, and
   `selftest_status` use the current invocation values governed by `FR-0136`.
9. The `report_root` summary value uses the quoted path-string rules defined by
   `FR-0124` and equals the retained self-test report root under `FR-0173`.

**Dependencies**:
- `FR-0124`
- `FR-0136`
- `FR-0173`

**Traceability**:
- Area: observability and outcomes
- Observable evidence: retained self-test `summary.txt`

### FR-0183
**Requirement**: Retained self-test report roots shall use one stable
`identities.json` retention contract.

**Applicability**:
- accepted non-help `confluex selftest` invocations whose retained self-test
  report root under `FR-0173` exists

**Rationale**:
- Maintainers and automation need one deterministic fixture-identity artifact in
  every retained self-test report root.

**Acceptance Criteria**:
1. `identities.json` exists at the top level of the retained self-test report
   root.
2. If `fixture_apply_status=passed`, `identities.json` is a UTF-8 JSON object.
3. If `fixture_apply_status=passed`, `identities.json` has no top-level entries
   other than the logical space entries from criterion 7, the logical page
   entries from criterion 4, and the logical attachment entries from criterion
   9.
4. If `fixture_apply_status=passed`, `identities.json` publishes entries for
   every logical page name governed by `FR-0176`.
5. Each logical page entry from criterion 4 is a JSON object with exactly
   `page_id`, `title`, and `space_key` keys. In each such entry, `page_id` is a
   JSON string containing a canonical page identifier governed by `FR-0014`,
   `title` is exactly the authoritative logical page title for that entry's
   logical page name under `FR-0205`, and `space_key` is exactly the
   authoritative logical space key for that logical page under `FR-0205`.
6. Distinct logical page names from criterion 4 use distinct `page_id` values.
7. If `fixture_apply_status=passed`, `identities.json` publishes entries for
   every logical space name governed by `FR-0176`.
8. Each logical space entry from criterion 7 is a JSON object with exactly
   `space_key` and `space_name` keys whose values are exactly the authoritative
   logical space key and logical space name for that logical space under
   `FR-0205`.
9. If `fixture_apply_status=passed`, `identities.json` publishes entries for
   every logical attachment name governed by `FR-0205`.
10. Each logical attachment entry from criterion 9 is a JSON object with exactly
    `page_id` and `filename` keys. In each such entry, `page_id` equals the
    `page_id` value of the logical page entry for that attachment's owning page
    under `FR-0205`, and `filename` equals the authoritative filename for that
    logical attachment under `FR-0205`.
11. When `fixture_apply_status=passed`, `identities.json` is serialized as UTF-8
    JSON with no byte order mark, no duplicate object member names, no
    whitespace outside JSON string values except one final LF after the
    top-level object, and no bytes after that LF.
12. The non-empty `identities.json` top-level object member order under
    criterion 11 is exactly: `fixture_space`, `aux_space`, then the logical page
    names in the order listed by `FR-0176`, then `root_attachment`, then
    `markdown_attachment`.
13. Logical page entry object members are serialized in the order `page_id`,
    `title`, `space_key`; logical space entry object members are serialized in
    the order `space_key`, `space_name`; logical attachment entry object members
    are serialized in the order `page_id`, `filename`.
14. If `fixture_apply_status` is `failed` or `not_run`, `identities.json` is
   UTF-8 text with LF line endings containing exactly one line `{}` and no other
   bytes after that line's terminating LF.

**Dependencies**:
- `FR-0014`
- `FR-0136`
- `FR-0173`
- `FR-0176`
- `FR-0205`

**Traceability**:
- Area: observability and outcomes
- Observable evidence: retained self-test `identities.json`

### FR-0184
**Requirement**: Retained self-test report roots shall use one stable
`live-bats.tap` retention contract.

**Applicability**:
- accepted non-help `confluex selftest` invocations whose retained self-test
  report root under `FR-0173` exists

**Rationale**:
- Maintainers and automation need one deterministic retained location for the
  live regression TAP artifact.

**Acceptance Criteria**:
1. `live-bats.tap` exists at the top level of the retained self-test report
   root.
2. `live-bats.tap` is UTF-8 text and, when non-empty, uses LF line endings.
3. If the live-regression phase is not attempted under `FR-0136`,
   `live-bats.tap` exists and is empty.
4. If the live-regression phase is attempted under `FR-0136`, the
   file-selection TAP comment line, captured Bats TAP output, and retained file
   content contract are governed by `FR-0138`.
5. No self-test card outside `FR-0138` adds additional governed content to
   `live-bats.tap`.

**Dependencies**:
- `FR-0173`
- `FR-0138`
- `FR-0136`
- `FR-0156`

**Traceability**:
- Area: observability and outcomes
- Observable evidence: retained self-test `live-bats.tap`

### FR-0185
**Requirement**: Retained self-test report roots shall use one stable
`expected/` directory contract.

**Applicability**:
- accepted non-help `confluex selftest` invocations whose retained self-test
  report root under `FR-0173` exists

**Rationale**:
- Maintainers and automation need one deterministic location for expected-data
  artifacts inside the retained self-test report root.

**Acceptance Criteria**:
1. `expected/` exists at the top level of the retained self-test report root as
   a directory.
2. If `prepare_expected_data_status=passed`, `expected/` contains exactly the
   expected-data artifacts governed by `FR-0177`, `FR-0178`, and `FR-0179`.
3. If `prepare_expected_data_status` is `failed` or `not_run`, `expected/`
   exists and contains no entries.

**Dependencies**:
- `FR-0173`
- `FR-0136`
- `FR-0177`
- `FR-0178`
- `FR-0179`

**Traceability**:
- Area: observability and outcomes
- Observable evidence: retained self-test `expected/` directory

### FR-0186
**Requirement**: Retained self-test report roots shall use one stable
live-regression artifact-bucket contract.

**Applicability**:
- accepted non-help `confluex selftest` invocations whose retained self-test
  report root under `FR-0173` exists

**Rationale**:
- Maintainers and automation need deterministic locations for retained live
  regression artifacts by command type.

**Acceptance Criteria**:
1. `plan/` and `export/` each exist at the top level of the retained self-test
   report root as directories.
2. If no live regression artifact of one command type is retained, that command
   type's directory exists and contains no entries.
3. When live-regression artifacts are retained for `plan`, the direct child
   entries of `plan/` are exactly the retained case artifact directories for
   the `FR-0178` case objects whose `artifact_bucket=plan`. When
   live-regression artifacts are retained for `export`, the direct child
   entries of `export/` are exactly the retained case artifact directories for
   the `FR-0178` case objects whose `artifact_bucket=export`. No retained
   live-regression artifact may be placed outside those matching case
   directories under its command-type bucket.
4. For a retained case artifact directory from criterion 3 that is the retained
   `export` or `plan` run artifact root for that case under `FR-0178`, the
   recursive contents of that directory remain governed by the retained
   output-root and report-set contracts that apply to that run artifact under
   `FR-0077`, `FR-0078`, and `FR-0085`; this card governs only bucket and
   case-directory placement.
5. If the live-regression phase is not attempted under `FR-0136`, both `plan/`
   and `export/` contain no entries.

**Dependencies**:
- `FR-0173`
- `FR-0138`
- `FR-0136`
- `FR-0178`
- `FR-0077`
- `FR-0078`
- `FR-0085`

**Traceability**:
- Area: observability and outcomes
- Observable evidence: retained self-test `plan/` and `export/` buckets

### FR-0187
**Requirement**: Retained self-test report roots shall use one stable
`diagnostics/` directory contract.

**Applicability**:
- accepted non-help `confluex selftest` invocations whose retained self-test
  report root under `FR-0173` exists

**Rationale**:
- Maintainers and automation need one deterministic location for retained
  phase-diagnostic text.

**Acceptance Criteria**:
1. `diagnostics/` exists at the top level of the retained self-test report root
   as a directory reserved for captured non-governed phase diagnostics; no
   captured phase diagnostic artifact is retained outside `diagnostics/`.
2. `diagnostics/` contains exactly `bootstrap.log`, `fixture-apply.log`,
   `prepare-expected-data.log`, and `live-regression.log`.
3. Each file from criterion 2 is UTF-8 text and, when non-empty, uses LF line
   endings; when no captured diagnostic text exists for that phase, the file
   exists and is empty.

**Dependencies**:
- `FR-0173`

**Traceability**:
- Area: observability and outcomes
- Observable evidence: retained self-test `diagnostics/` directory
