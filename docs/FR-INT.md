# Interruption And Runtime-Failure Requirements


### FR-0180
**Requirement**: Accepted run execution shall use one shared start threshold.

**Applicability**:
- accepted non-help `export` and `plan` invocations

**Rationale**:
- Interruption, runtime-failure, exit-code, and retained-artifact branches need
  one shared meaning for when accepted run execution has actually begun.

**Acceptance Criteria**:
1. After invocation acceptance under `FR-0212`, accepted run execution begins
   at the earliest moment when the product starts any accepted-run lifecycle
   work specific to that invocation: persistent log-artifact creation,
   replacement, or first write under `FR-0134`, output-root creation or reuse,
   payload reuse, scope-discovery work, page processing, or report generation.
2. Validation-only and pre-acceptance setup work before criterion 1, including
   CLI parsing, option validation, root-page preflight, rejection decisions,
   and pre-acceptance generated output-root candidate selection under `FR-0055`,
   is not accepted run execution.
3. Cards that say `after accepted run execution has begun` or equivalent use
   the threshold defined by criteria 1 and 2.

**Dependencies**:
- `FR-0017`
- `FR-0134`
- `FR-0055`
- `FR-0057`
- `FR-0212`

**Traceability**:
- Area: interruption
- Observable evidence: branch selection for accepted-run interruption and
  runtime-failure cases

### FR-0181
**Requirement**: Normal report-set retention shall use one shared completion
threshold.

**Applicability**:
- accepted `export` and `plan` runs whose plain output root exists

**Rationale**:
- Interruption and runtime-failure branches need one shared threshold for when
  a run has already retained the ordinary closed report-file set and must
  rewrite rather than synthesize it.

**Acceptance Criteria**:
1. The normal report set for a run is the closed report-file set required by
   `FR-0085` at that run's plain output root before any interruption or
   runtime-failure branch-specific report synthesis occurs.
2. The normal report set has been fully retained when every mandatory report
   file in criterion 1 exists at its final plain-output-root path and its
   governed content for the current run has been fully written.
3. Cards that distinguish branches before or after the normal report set has
   been fully retained use the threshold defined by criteria 1 and 2.

**Dependencies**:
- `FR-0085`

**Traceability**:
- Area: interruption
- Observable evidence: branch selection between report synthesis and summary
  rewrite

### FR-0100
**Requirement**: An interrupted `export` run shall leave a retained partial
plain output root on disk.

**Applicability**:
- accepted `export` runs interrupted after the output root has been created or
  reused and before the encryption phase begins for that run

**Rationale**:
- Operators need a real export interrupted mid-run to remain on disk with its
  partial artifacts rather than disappear.

**Acceptance Criteria**:
1. Artifacts already written or rewritten for the interrupted run remain on
   disk; if the plain output root was reused for that run, inherited stale
   entries may still be removed as required by `FR-0188`.
2. The retained plain output root satisfies the interrupted-or-incomplete
   top-level export layout required by `FR-0077`, using inherited-layout
   sanitation from `FR-0188` when the plain output root was reused.
3. The retained plain output root is reported using the signal-interruption
   outcome defined by `FR-0113` and `FR-0140`.
4. If interruption occurs before the normal report-set retention threshold from
   `FR-0181` is reached, the product synthesizes the closed report-file set
   required by `FR-0085` under `FR-0145` before exit.
5. The synthesized `summary.txt` from criterion 4 reports the
   signal-interruption summary values selected by this card under `FR-0113`
   and `FR-0140`.
6. If interruption occurs after the normal report-set retention threshold from
   `FR-0181` is reached and before the encryption phase begins, the product
   rewrites the retained `summary.txt` in the plain output root so that it
   reports the same signal-interruption summary values from criterion 5 before
   process exit.
7. The retained plain output root contains the `INCOMPLETE` marker required by
   `FR-0076` and `FR-0077`.
8. If report synthesis required by criterion 4 fails or rewriting the retained
   `summary.txt` required by criterion 6 fails, `RUN_COMPLETE` is not emitted
   because final outcome determination did not complete, the process exit code
   remains the signal-interruption exit code governed by `FR-0118`, and any
   plain output root left on disk is non-authoritative interruption-update
   debris, satisfies `FR-0217`, is not a completed retained result, and is not
   selected as an authoritative retained artifact for that run.

**Dependencies**:
- `FR-0058`
- `FR-0090`
- `FR-0077`
- `FR-0076`
- `FR-0085`
- `FR-0145`
- `FR-0098`
- `FR-0113`
- `FR-0140`
- `FR-0118`
- `FR-0181`
- `FR-0188`
- `FR-0217`

**Traceability**:
- Area: interruption
- Observable evidence: retained export root, marker file, summary fields

### FR-0101
**Requirement**: An interrupted `plan` run shall not leave a misleading partial
output root.

**Applicability**:
- accepted `plan` runs interrupted after a plain output root has been created,
  before completion, and before the encryption phase begins for that run

**Rationale**:
- Operators should not mistake an interrupted plan root for a valid final plan.

**Acceptance Criteria**:
1. If interruption occurs after plain output-root creation and before
   the normal report-set retention threshold from `FR-0181` is reached, the
   product synthesizes the closed report-file set required by `FR-0085` under
   `FR-0145` before attempting to remove the plain output root.
2. The synthesized `summary.txt` from criterion 1 reports the
   signal-interruption summary values selected by this card under `FR-0113`
   and `FR-0140`.
3. If interruption occurs after the normal report-set retention threshold from
   `FR-0181` is reached and before the encryption phase begins, the product
   rewrites the retained `summary.txt` in that plain output root so that it
   reports the same signal-interruption summary values from criterion 2 before
   attempting to remove the plain output root.
4. The product removes the plain output root created for the interrupted plan
   run after the applicable branch from criterion 1 or 3.
5. The removed path does not retain a partial report set.
6. If removal of the interrupted plan output root fails after the applicable
   report synthesis or summary-rewrite branch from criterion 1 or 3 succeeds,
   the plain output root remains on disk as an interrupted partial result.
7. The retained cleanup-failure root from criterion 6 satisfies the plan layout
   from `FR-0078`, contains the report-file set from `FR-0085`, contains the
   `INCOMPLETE` marker from `FR-0076`, and its `summary.txt` reports the same
   signal-interruption summary values from criterion 2.
8. Accepted `plan` runs interrupted before any plain output root has been
   created are governed by `FR-0147`, not by this card.
9. If report synthesis required by criterion 1 fails or rewriting the retained
   `summary.txt` required by criterion 3 fails, the product still attempts
   removal under criterion 4; `RUN_COMPLETE` is not emitted because final
   outcome determination did not complete, and the process exit code remains
   the signal-interruption exit code governed by `FR-0118`.
10. If criterion 9 leaves a plain output root on disk, that path is
    non-authoritative interruption-update debris, satisfies `FR-0217`, is not
    the interrupted partial result from criteria 6 and 7, and is not selected
    as an authoritative retained artifact for that run.

**Dependencies**:
- `FR-0058`
- `FR-0090`
- `FR-0085`
- `FR-0145`
- `FR-0076`
- `FR-0078`
- `FR-0113`
- `FR-0140`
- `FR-0147`
- `FR-0118`
- `FR-0181`
- `FR-0217`

**Traceability**:
- Area: interruption
- Observable evidence: absence of the interrupted plan output root or retained
  cleanup-failure partial root

### FR-0102
**Requirement**: Runtime failure after accepted run execution begins under
`FR-0180` shall be reported explicitly.

**Applicability**:
- accepted `export` and `plan` runs that fail after the accepted-run execution
  threshold from `FR-0180` is reached and before the encryption phase begins
  for that run

**Rationale**:
- Operators need a runtime failure to be visible and distinguishable from
  configured-stop or clean outcomes.

**Acceptance Criteria**:
1. If a runtime failure stops an `export` or `plan` run after accepted run
   execution has begun under `FR-0180` and before any plain output root has
   been created or reused for that run, no plain output root, encrypted
   archive, or confidential-mode status sidecar is selected as an authoritative
   retained artifact for that run.
2. In the criterion 1 branch, `RUN_COMPLETE` is not emitted because final
   outcome determination did not complete, the process exit code remains the
   accepted-run runtime failure code from `FR-0118`, and stdout contains no
   line emitted after the failure is observed.
3. In the criterion 1 branch, stderr is UTF-8 text with LF line endings and its
   first line is exactly `ERROR: runtime_failure pre_output_root`.
4. Additional stderr lines in the criterion 1 branch, if any, are
   non-governed diagnostic text.
5. If criterion 1 leaves any filesystem path on disk other than a persistent
   log artifact governed by `FR-0134`, that path is non-authoritative
   runtime-failure debris. Any such directory root satisfies `FR-0217`. No such
   path is a partial result, a report-set container, or a selected retained
   artifact. A persistent log artifact governed by `FR-0134`, if
   present, is retained or left as already written under `FR-0134`, is outside
   the retained-artifact set consumed by `FR-0058`, and is not a partial
   result.
6. If a runtime failure stops an `export` or `plan` run after accepted run
   execution has begun under `FR-0180`, after a plain output root has been
   created or reused for that run, and before the normal report-set retention
   threshold from `FR-0181` is reached, the product enters runtime-failure
   report synthesis before final-outcome determination.
7. Runtime-failure report synthesis writes the closed report-file set from
   `FR-0085` under the synthesis rules in `FR-0145`, and `summary.txt`
   reports the runtime-failure summary values selected by this card under
   `FR-0113` and `FR-0140`.
8. If runtime-failure report synthesis succeeds for an `export` run, the plain
   output root remains on disk as the retained runtime-failed partial result,
   satisfies the export layout from `FR-0077`, using inherited-layout
   sanitation from `FR-0188` when the plain output root was reused, contains
   the report-file set from `FR-0085`, contains the `INCOMPLETE` marker from
   `FR-0076`, and its `summary.txt` reports the same runtime-failure summary
   values from criterion 7.
9. If runtime-failure report synthesis succeeds for a `plan` run, the product
   removes the plain output root created for that run and does not leave a
   partial report set behind at that path.
10. If removal of the runtime-failed plan output root from criterion 9 fails, the
    plain output root remains on disk as a runtime-failed partial result.
11. The retained cleanup-failure root from criterion 10 satisfies the plan layout
    from `FR-0078`, contains the report-file set from `FR-0085`, contains the
    `INCOMPLETE` marker from `FR-0076`, and its `summary.txt` reports the same
    runtime-failure summary values from criterion 7.
12. If a runtime failure stops an `export` or `plan` run after the normal
   report-set retention threshold from `FR-0181` is reached and before the
   encryption phase begins, the product rewrites the retained `summary.txt` in
   the plain output root so that it reports the same runtime-failure summary
   values from criterion 7 before final-outcome determination.
13. If criterion 12 succeeds for an `export` run, the plain output root remains on
   disk as the retained runtime-failed partial result, satisfies the export
   layout from `FR-0077`, using inherited-layout sanitation from `FR-0188`
   when the plain output root was reused, contains the report-file set from
   `FR-0085`, contains the `INCOMPLETE` marker from `FR-0076`, and its
   `summary.txt` reports the same runtime-failure summary values from
   criterion 7.
14. If criterion 12 succeeds for a `plan` run, the product removes the plain output
   root created for that run and does not leave a partial report set behind at
   that path.
15. If removal of the runtime-failed plan output root from criterion 14 fails,
    the plain output root remains on disk as a runtime-failed partial result.
16. The retained cleanup-failure root from criterion 15 satisfies the plan
    layout from `FR-0078`, contains the report-file set from `FR-0085`,
    contains the `INCOMPLETE` marker from `FR-0076`, and its `summary.txt`
    reports the same runtime-failure summary values from criterion 7.
17. If rewriting the retained `summary.txt` under criterion 12 fails,
    `RUN_COMPLETE` is not emitted because final outcome determination did not
    complete, and the exit code remains the accepted-run runtime failure code
    from `FR-0118`.
18. If criterion 17 leaves any output-root path on disk, that path is
    non-authoritative runtime-failure debris, satisfies `FR-0217`, is not a
    partial result, is not a report-set container, and is not selected as a
    retained artifact.
19. In the criterion 17 branch, stdout contains no `RUN_COMPLETE` line and no
    stdout line emitted after the summary-rewrite failure is observed.
20. In the criterion 17 branch, stderr is UTF-8 text with LF line endings and
    its first line is exactly `ERROR: runtime_failure summary_update`.
21. Additional stderr lines in the criterion 17 branch, if any, are
    non-governed diagnostic text.
22. If runtime-failure report synthesis itself fails, no retained path is a
    report-set container for that run; `RUN_COMPLETE` is not emitted because
    final outcome determination did not complete, and the exit code remains the
    accepted-run runtime failure code from `FR-0118`.
23. If criterion 22 leaves any output-root path on disk, that path is
    non-authoritative runtime-failure debris, satisfies `FR-0217`, is not a
    partial result, is not a report-set container, and is not selected as a
    retained artifact.
24. In the criterion 22 branch, stdout contains no `RUN_COMPLETE` line and no
    stdout line emitted after the report-synthesis failure is observed.
25. In the criterion 22 branch, stderr is UTF-8 text with LF line endings and
    its first line is exactly `ERROR: runtime_failure report_synthesis`.
26. Additional stderr lines in the criterion 22 branch, if any, are
    non-governed diagnostic text.

**Dependencies**:
- `FR-0090`
- `FR-0085`
- `FR-0145`
- `FR-0076`
- `FR-0077`
- `FR-0078`
- `FR-0098`
- `FR-0058`
- `FR-0118`
- `FR-0113`
- `FR-0140`
- `FR-0134`
- `FR-0180`
- `FR-0181`
- `FR-0188`
- `FR-0217`

**Traceability**:
- Area: interruption
- Observable evidence: summary fields, removed plan root, exit code

### FR-0145
**Requirement**: Interrupted and runtime-failed report synthesis shall use one
deterministic partial-report rule.

**Applicability**:
- interrupted `export` report synthesis under `FR-0100`
- interrupted `plan` report synthesis before cleanup under `FR-0101`
- accepted-run runtime-failure report synthesis under `FR-0102`

**Rationale**:
- Operators need retained interrupted or runtime-failed report sets to be
  schema-valid without inventing partially known rows.

**Acceptance Criteria**:
1. The synthesis checkpoint is the moment immediately after the last completed
   acquisition, page-processing, or report-row production operation before the
   interruption or runtime failure was observed.
2. `manifest.tsv` includes exactly the processed-page rows whose processed-page
   status under `FR-0127` was reached at or before the synthesis checkpoint.
3. `resolved-links.tsv`, `unresolved-links.tsv`, `failed-pages.tsv`, and
   `scope-findings.tsv` include exactly the rows whose governing discovery,
   resolution, failure, or finding condition had already been recorded at or
   before the synthesis checkpoint.
4. No report data row is synthesized from partially determined field values.
5. If a retained row's report schema permits an unavailable field value, that
   field uses the absence token or normalization rule defined by that report
   schema.
6. Report row sorting, deduplication, TSV normalization, and count derivation use
   the same rules as completed report generation over the synthesized row set.
7. `summary.txt` uses the final-status and interrupt-reason values supplied by
   the invoking interruption or runtime-failure card and derives all count fields
   from the synthesized report files.

**Dependencies**:
- `FR-0085`
- `FR-0086`
- `FR-0087`
- `FR-0088`
- `FR-0089`
- `FR-0090`
- `FR-0091`
- `FR-0092`
- `FR-0100`
- `FR-0101`
- `FR-0102`
- `FR-0113`
- `FR-0127`
- `FR-0140`

**Traceability**:
- Area: interruption
- Observable evidence: synthesized partial report rows and summary counts

### FR-0147
**Requirement**: Signal interruption before output-root creation shall leave no
retained run artifact.

**Applicability**:
- accepted `export` and `plan` runs interrupted after root-page preflight
  succeeds and before any plain output root has been created or reused for that
  run

**Rationale**:
- Operators need a deterministic branch for signals that arrive after acceptance
  but before there is any result container to retain.

**Acceptance Criteria**:
1. The run leaves no plain output root, encrypted archive, or
   confidential-mode status sidecar created by that run; persistent log
   artifacts governed by `FR-0134` are outside the retained-artifact set
   consumed by `FR-0058` for this criterion.
2. The run emits no `RUN_COMPLETE` line because retained-artifact and final
   report-set determination did not complete.
3. If `RUN_START` had already been emitted under `FR-0056` before the signal was
   observed, that line remains on stdout; otherwise stdout contains no
   `RUN_START` line for that run.
4. The run emits no `RUN_PHASE` line.
5. The process exit code is the signal-interruption exit code governed by
   `FR-0118`.
6. If persistent log-artifact creation, replacement, or first write under
   `FR-0134` began before the signal was observed, the selected persistent log
   artifact is retained or left as already written under `FR-0134`; if that
   work did not begin before the signal was observed, this branch creates no
   new persistent log artifact. In either case, the log path is not an
   authoritative retained artifact for that run and is not named by
   `RUN_COMPLETE`.

**Dependencies**:
- `FR-0017`
- `FR-0056`
- `FR-0134`
- `FR-0057`
- `FR-0058`
- `FR-0118`

**Traceability**:
- Area: interruption
- Observable evidence: absence of retained artifacts, stdout lifecycle lines,
  exit code

### FR-0156
**Requirement**: Accepted `selftest` invocations interrupted by signal shall use
one deterministic interruption branch.

**Applicability**:
- accepted non-help `confluex selftest` invocations interrupted by signal after
  invocation acceptance and before process exit

**Rationale**:
- Maintainers need interrupted self-test runs to have deterministic
  retained-report behavior and phase-status values without hidden target
  lifecycle side effects.

**Acceptance Criteria**:
1. If a signal is observed before a candidate self-test report root under
   `FR-0173` exists, no self-test report root is retained, no stdout result
   line is emitted, and the process exits `130` under `FR-0118`.
2. If a signal is observed after a candidate self-test report root under
   `FR-0173` exists, `selftest` follows the retained-report status branch from
   this card and does not attempt Docker lifecycle cleanup.
3. If a signal is observed after the bootstrap phase is attempted under
   `FR-0136` and before `bootstrap_status` is determined and a report root is
   retained, that retained report root reports
   `bootstrap_status=failed`, `fixture_apply_status=not_run`,
   `prepare_expected_data_status=not_run`, `live_regression_status=not_run`,
   and `selftest_status=failed`.
4. If a signal is observed after `bootstrap_status=passed` and before
   the fixture-application phase is attempted under `FR-0136`, a retained
   report root reports
   `bootstrap_status=passed`, `fixture_apply_status=not_run`,
   `prepare_expected_data_status=not_run`, `live_regression_status=not_run`,
   and `selftest_status=failed`.
5. If a signal is observed after the fixture-application phase is attempted
   under `FR-0136` and before `fixture_apply_status` is determined, or during
   fixture dataset preparation before that phase reaches `passed`, a retained
   report root reports
   `bootstrap_status=passed`, `fixture_apply_status=failed`,
   `prepare_expected_data_status=not_run`, `live_regression_status=not_run`,
   and `selftest_status=failed`.
6. If a signal is observed after `fixture_apply_status=passed` and before the
   expected-data phase is attempted under `FR-0136`, a retained report root
   reports `bootstrap_status=passed`, `fixture_apply_status=passed`,
   `prepare_expected_data_status=not_run`, `live_regression_status=not_run`,
   and `selftest_status=failed`.
7. If a signal is observed after the expected-data phase is attempted under
   `FR-0136` and before `prepare_expected_data_status` is determined, or during
   expected-data preparation before that phase reaches `passed`, a retained
   report root
   reports `bootstrap_status=passed`, `fixture_apply_status=passed`,
   `prepare_expected_data_status=failed`, `live_regression_status=not_run`,
   and `selftest_status=failed`.
8. If a signal is observed after `prepare_expected_data_status=passed` and
   before the live-regression phase is attempted under `FR-0136`,
   a retained report root reports
   `bootstrap_status=passed`, `fixture_apply_status=passed`,
   `prepare_expected_data_status=passed`, `live_regression_status=not_run`,
   and `selftest_status=failed`.
9. If a signal is observed after the live-regression phase is attempted under
   `FR-0136` and before `live_regression_status` is determined, or
   during live regression, a retained report root reports
   `bootstrap_status=passed`, `fixture_apply_status=passed`,
   `prepare_expected_data_status=passed`, `live_regression_status=failed`, and
   `selftest_status=failed`.
10. If a candidate self-test report root under `FR-0173` exists when the signal
   is observed, `selftest` attempts to materialize one retained self-test
   report root at that candidate path using the status values selected by the
   applicable criterion from 3 through 9. A retained report root exists only
   when that materialization completes, the path is a retained self-test report
   root under `FR-0173`, the retained-schema obligations from `FR-0135` and
   `FR-0182` through `FR-0187` are satisfied using those selected status
   values, and the stdout result line is governed by `FR-0133`.
11. Signal interruption does not introduce any self-test phase-status or
   aggregate-status value outside the vocabularies governed by `FR-0136`; it
   only selects the `failed` and `not_run` values required by criteria 3
   through 9 plus exit code `130`.
12. If a signal is observed after a candidate self-test report root under
    `FR-0173` exists but before that path becomes a retained self-test report
    root under `FR-0173`, including because the retained-schema materialization
    required by criterion 10 does not complete, any remaining path on disk that
    does not satisfy criteria 3 through 10 is non-authoritative self-test
    interruption debris and satisfies `FR-0217`.
13. In the criterion 12 branch, no stdout result line is emitted after the
    signal is observed, and stderr is non-governed diagnostic text.
14. Accepted `selftest` invocations interrupted by signal exit `130`.

**Dependencies**:
- `FR-0118`
- `FR-0133`
- `FR-0135`
- `FR-0136`
- `FR-0173`
- `FR-0182`
- `FR-0183`
- `FR-0184`
- `FR-0185`
- `FR-0186`
- `FR-0187`
- `FR-0217`

**Traceability**:
- Area: interruption
- Observable evidence: self-test exit code and retained report-root status values
