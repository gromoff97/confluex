# Safety Requirements


### FR-0094
**Requirement**: The product shall warn about effectively unbounded non-safe
runs.

**Applicability**:
- accepted `export` and `plan` runs

**Rationale**:
- Operators need an explicit warning when a run may grow without practical
  bounds.

**Acceptance Criteria**:
1. If `export` or `plan` is invoked without `--safe`, without a positive
   `--max-pages`, and without a positive `--max-download-mib`, the product emits
   an explicit warning that the run is effectively unbounded.
2. The unbounded-run warning recommends at least one of `--safe`,
   `--max-pages`, or `--max-download-mib`.
3. The product does not emit the unbounded-run warning if `--safe` is in effect
   or either positive limit is in effect.

**Dependencies**:
- `FR-0009`
- `FR-0022`
- `FR-0034`

**Traceability**:
- Area: safety
- Observable evidence: stderr warning output

### FR-0095
**Requirement**: The product shall distinguish fail-fast behavior from
best-effort behavior.

**Applicability**:
- accepted `export` and `plan` runs

**Rationale**:
- Operators need to choose whether page-local failures stop the run or remain
  visible while later work continues.

**Acceptance Criteria**:
1. Without `--no-fail-fast`, a page-local failure stops further page processing
   immediately unless a more specific requirement explicitly classifies that
   condition as non-fatal.
2. With `--no-fail-fast`, a page-local failure is recorded and the run continues
   to later pages that have not yet been processed unless another stop condition
   ends the run.
3. Recorded page-local failures remain visible in the report set in both modes.

**Dependencies**:
- `FR-0027`
- `FR-0088`

**Traceability**:
- Area: safety
- Observable evidence: continued processing behavior and failed-pages reporting

### FR-0096
**Requirement**: `--critical` shall act as a fail-closed policy overlay.

**Applicability**:
- accepted `export --critical` and `plan --critical` runs

**Rationale**:
- Operators need a mode that blocks completion when findings remain.

**Acceptance Criteria**:
1. If a completed run under `--critical` has unresolved links, scope findings, or
   failed page-local operations, `summary.txt` reports
   `final_status=policy_failed`.
2. If a run under `--critical` would otherwise qualify for a clean success,
   `summary.txt` reports `final_status=success`.
3. If a run under `--critical` ends because of interruption, runtime failure, or
   configured stop, the result uses the underlying non-policy outcome rather than
   `policy_failed`.

**Dependencies**:
- `FR-0023`
- `FR-0113`

**Traceability**:
- Area: safety
- Observable evidence: summary final status, exit code

### FR-0097
**Requirement**: Configured stop conditions shall yield explicit incomplete
outcomes.

**Applicability**:
- accepted `export` and `plan` runs stopped by configured limits

**Rationale**:
- Operators need limit-driven early stops to be clearly distinguishable from
  clean success.

**Acceptance Criteria**:
1. If `--max-pages` stops the run, the run ends in the configured-stop outcome
   defined by `FR-0113` and `FR-0116`.
2. If `--max-download-mib` stops the run, the run ends in the configured-stop
   outcome defined by `FR-0113` and `FR-0116`.
3. If a configured stop condition occurs in `export`, the plain output root
   remains on disk as an inspectable partial result.
4. A configured stop condition causes exit code `3`.

**Dependencies**:
- `FR-0034`
- `FR-0113`
- `FR-0116`
- `FR-0118`

**Traceability**:
- Area: safety
- Observable evidence: summary fields, exit code

### FR-0098
**Requirement**: Partial results that remain on disk shall remain interpretable.

**Applicability**:
- accepted `export` and `plan` runs that leave partial results on disk

**Rationale**:
- Operators need retained partial results to remain machine-interpretable.

**Acceptance Criteria**:
1. If a partial plain output root remains on disk, it still contains the full
   report set and top-level artifact layout required by the authoritative cards
   for that command and outcome.
2. A partial result that remains on disk after signal interruption, runtime
   failure, or configured stop is distinguishable from clean success without
   reading internal logs.
3. A retained partial result's top-level artifacts keep the stable meanings
   defined by `FR-0082`.

**Dependencies**:
- `FR-0077`
- `FR-0078`
- `FR-0085`
- `FR-0082`

**Traceability**:
- Area: safety
- Observable evidence: retained partial artifact set, summary status

### FR-0099
**Requirement**: `plan` shall preserve configured-stop results but discard
misleading abnormal partial results.

**Applicability**:
- accepted `plan` runs

**Rationale**:
- Operators need limited plan results to remain inspectable, but interrupted or
  failed plan roots should not masquerade as complete plans.

**Acceptance Criteria**:
1. If a `plan` run ends because `--max-pages` or `--max-download-mib` was
   reached, the plain output root remains on disk as an inspectable partial
   result.
2. If a `plan` run ends because of signal interruption, plain-output-root
   retention follows `FR-0101`.
3. If a `plan` run ends because of a runtime failure after work has started,
   plain-output-root retention follows `FR-0102`.

**Dependencies**:
- `FR-0097`
- `FR-0101`
- `FR-0102`

**Traceability**:
- Area: safety
- Observable evidence: retained or removed plan output roots
