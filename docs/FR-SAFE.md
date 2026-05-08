# Safety Requirements


### FR-0094
**Requirement**: The product shall warn about effectively unbounded runs.

**Applicability**:
- accepted `export` runs

**Rationale**:
- Operators need an explicit warning when a run can grow without practical
  bounds.

**Acceptance Criteria**:
1. If `export` is invoked without an effective positive max-pages
   value and without an effective positive max-download-mib value, the product
   emits an explicit warning that the run is effectively unbounded.
2. The unbounded-run warning text is governed by `FR-0009`.
3. The product does not emit the unbounded-run warning if either effective
   positive limit is in effect.

**Dependencies**:
- `FR-0009`
- `FR-0228`
- `FR-0034`

**Traceability**:
- Area: safety
- Observable evidence: stderr warning output

### FR-0095
**Requirement**: The product shall distinguish fail-fast behavior from
best-effort behavior.

**Applicability**:
- accepted `export` runs

**Rationale**:
- Operators need to choose whether page-local failures stop the run or remain
  visible while later work continues.

**Acceptance Criteria**:
1. Without `--no-fail-fast`, a page-local failure stops further page processing
   immediately after the operation that records the failure completes.
2. With `--no-fail-fast`, a page-local failure is recorded and the run continues
   to later pages that have not yet been processed unless another stop condition
   ends the run.
3. If the run retains a report-set container, recorded page-local failures
   remain visible in that report set in both modes.
4. For this card, a page-local failure is one page-scoped failure condition
   that another requirement explicitly requires to be recorded in
   `failed-pages.tsv`.
5. The following scope-finding conditions are not page-local failures and do not
   trigger fail-fast stopping by themselves: `scope-findings.tsv` rows with
   `finding_area=storage_content` and `finding_type=storage_unavailable` or
   `storage_uninterpretable`; rows with `finding_area=child_listing` and
   `finding_type=partial_listing` or `incomplete_tree`; rows with
   `finding_area=title_resolution` and
   `finding_type=candidate_visibility_incomplete`; and rows with
   `finding_area=unsupported_pattern` and
   `finding_type=unsupported_internal_pattern`.
6. If one underlying condition records both a scope-finding row and a
   `failed-pages.tsv` row, the condition is a page-local failure for fail-fast
   purposes.

**Dependencies**:
- `FR-0069`
- `FR-0066`
- `FR-0070`
- `FR-0071`
- `FR-0072`
- `FR-0073`
- `FR-0074`
- `FR-0075`
- `FR-0088`

**Traceability**:
- Area: safety
- Observable evidence: continued processing behavior and failed-pages reporting

### FR-0240
**Requirement**: Report findings shall remain completed-run safety outcomes.

**Applicability**:
- report sets whose `summary.txt` schema is governed by `FR-0090`

**Rationale**:
- Operators need unresolved links, scope findings, and failed operations to
  remain visible as completed-run findings.

**Acceptance Criteria**:
1. For completed accepted `export` runs, unresolved links, scope
   findings, and failed operations are represented through the report files
   governed by `FR-0085` and the `blocking_reasons` value governed by
   `FR-0116`.
2. A completed accepted `export` run with `blocking_reasons=none`
   uses `final_status=success` under `FR-0113` and exit code `0` under
   `FR-0118`.
3. A completed accepted `export` run with `blocking_reasons` not equal
   to `none` uses `final_status=success_with_findings` under `FR-0113` and exit
   code `0` under `FR-0118`.
4. Configured-stop, runtime-failure, and signal-interruption branches use the
   incomplete or interrupted outcomes governed by `FR-0097`, `FR-0100`,
   `FR-0101`, `FR-0102`, `FR-0113`, `FR-0118`, and `FR-0140`.

**Dependencies**:
- `FR-0085`
- `FR-0090`
- `FR-0097`
- `FR-0100`
- `FR-0101`
- `FR-0102`
- `FR-0113`
- `FR-0116`
- `FR-0118`
- `FR-0140`

**Traceability**:
- Area: safety
- Observable evidence: summary final status, exit code

### FR-0097
**Requirement**: Configured stop conditions shall yield explicit incomplete
outcomes.

**Applicability**:
- accepted `export` runs stopped by configured limits

**Rationale**:
- Operators need limit-driven early stops to be clearly distinguishable from
  clean success.

**Acceptance Criteria**:
1. If `--max-pages` stops the run, the run takes the configured-stop incomplete
   outcome whose interrupt-reason serialization is governed by `FR-0140`.
2. If `--max-download-mib` stops the run, the run takes the configured-stop
   incomplete outcome whose interrupt-reason serialization is governed by
   `FR-0140`.
3. If both configured limits would stop the run at the same decision point, the
   configured-stop outcome uses the interrupt-reason precedence rule defined by
   `FR-0140`.
4. If a configured stop condition occurs in `materialized` execution mode, the
   plain output root remains on disk as a retained partial result that satisfies
   the export layout from `FR-0077`, contains the closed report-file set from
   `FR-0085`, and contains the `INCOMPLETE` marker from `FR-0076`.
5. If a configured stop condition occurs in `plan_only` execution mode, the
   plain output root remains on disk as a retained partial result that satisfies
   the plan-only layout from `FR-0078`, contains the closed report-file set from
   `FR-0085`, and contains the `INCOMPLETE` marker from `FR-0076`.
6. Configured-stop retained partial results remain interpretable under
   `FR-0098`.

**Dependencies**:
- `FR-0034`
- `FR-0076`
- `FR-0077`
- `FR-0078`
- `FR-0085`
- `FR-0098`
- `FR-0113`
- `FR-0118`
- `FR-0140`

**Traceability**:
- Area: safety
- Observable evidence: summary fields, exit code

### FR-0098
**Requirement**: Partial results that remain on disk shall remain interpretable.

**Applicability**:
- accepted `export` runs that leave configured-stop, interrupted, or
  runtime-failed partial results on disk

**Rationale**:
- Operators need retained partial results to remain machine-interpretable.

**Acceptance Criteria**:
1. If a configured-stop, interrupted, or runtime-failed partial plain output
   root remains on disk, that retained root satisfies exactly one of the
   authoritative retained-partial-result contracts from `FR-0097`, `FR-0100`,
   `FR-0101`, or `FR-0102`.
2. No retained partial plain output root may simultaneously satisfy
   branch-specific markers or summary-field combinations from more than one of
   `FR-0097`, `FR-0100`, `FR-0101`, or `FR-0102`.
3. The top-level artifacts and report set retained in a partial plain output
   root are sufficient to determine that root's unique branch classification
   from criterion 1 without reading internal logs.
4. A retained partial result's top-level artifacts keep the stable meanings
   defined by `FR-0082`.

**Dependencies**:
- `FR-0090`
- `FR-0097`
- `FR-0100`
- `FR-0101`
- `FR-0102`
- `FR-0077`
- `FR-0078`
- `FR-0085`
- `FR-0082`

**Traceability**:
- Area: safety
- Observable evidence: retained partial artifact set, summary status

### FR-0099
**Requirement**: `plan_only` execution mode shall preserve configured-stop
results but discard misleading abnormal partial results.

**Applicability**:
- accepted `export --plan-only` runs that leave configured-stop, interrupted, or
  runtime-failed partial results on disk

**Rationale**:
- Operators need limited plan-only results to remain on disk with their reports,
  but interrupted or failed plan-only roots should not masquerade as complete
  runs.

**Acceptance Criteria**:
1. For `plan_only` execution mode, a partial plain output root from a configured-stop,
   signal-interruption, or runtime-failure branch may remain on disk only when
   the applicable branch card classifies that root as an authoritative retained
   partial result under `FR-0097`, `FR-0101`, or `FR-0102`.
2. A configured-stop, signal-interruption, or runtime-failure `plan_only` branch
   that does not satisfy the authoritative retained-partial conditions from
   `FR-0097`, `FR-0101`, or `FR-0102` leaves no authoritative partial plain
   output root on disk.
3. Any authoritative retained `plan_only` partial root on disk remains
   distinguishable from clean success by the branch-specific markers or summary
   fields required by its governing card.

**Dependencies**:
- `FR-0097`
- `FR-0101`
- `FR-0102`

**Traceability**:
- Area: safety
- Observable evidence: retained or removed plan-only output roots
