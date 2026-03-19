# Run Lifecycle Requirements


### FR-0052
**Requirement**: `export` and `plan` shall share one scope-discovery model.

**Applicability**:
- accepted `export` and `plan` runs

**Rationale**:
- Operators need planning and materialized export to reason about the same page
  scope.

**Acceptance Criteria**:
1. Both workflows require a root page id.
2. Both workflows validate root-page accessibility before traversal begins.
3. Both workflows apply the same scope-discovery rules in Section 13 to the same
   root page.
4. Differences between `export` and `plan` are limited to command-specific
   payload acquisition, persistence, encryption, and output-retention
   requirements stated elsewhere in this document.

**Dependencies**:
- `FR-0059`
- `FR-0066`

**Traceability**:
- Area: run lifecycle
- Observable evidence: accepted run behavior, scope reports

### FR-0053
**Requirement**: `export` shall materialize page content and attachment payloads.

**Applicability**:
- accepted `export` runs

**Rationale**:
- Operators need a workflow that produces materialized page and attachment
  payloads.

**Acceptance Criteria**:
1. `export` materializes page HTML for successfully processed pages.
2. `export` materializes attachment payload files for processed pages when
   attachment-download work for those pages succeeds.
3. `export` produces the run-level report set.

**Dependencies**:
- `FR-0074`
- `FR-0075`
- `FR-0085`

**Traceability**:
- Area: run lifecycle
- Observable evidence: page payload folders, attachments, report set

### FR-0054
**Requirement**: `plan` shall remain a dry-run planning workflow.

**Applicability**:
- accepted `plan` runs

**Rationale**:
- Operators need planning output without the cost and risk of payload
  materialization.

**Acceptance Criteria**:
1. `plan` acquires only the data required by Sections 13, 14, and 16 to
   discover pages, resolve supported links, determine attachment counts, and
   produce the run-level report set.
2. `plan` does not persist `page.html`.
3. `plan` does not persist downloaded attachment payload files.

**Dependencies**:
- `FR-0073`
- `FR-0085`

**Traceability**:
- Area: run lifecycle
- Observable evidence: report set without materialized content payload

### FR-0055
**Requirement**: Automatically generated output-root names shall identify the
workflow and root page.

**Applicability**:
- `export` without `--out`
- `plan` without `--out`

**Rationale**:
- Operators need generated output roots that are readable and collision-safe.

**Acceptance Criteria**:
1. `export` without `--out` generates the base directory name
   `confluence_dump_<page_id>_<YYYYMMDDTHHMMSSZ>`.
2. `plan` without `--out` generates the base directory name
   `confluence_plan_<page_id>_<YYYYMMDDTHHMMSSZ>`.
3. `<page_id>` is the canonical resolved root page identifier.
4. The timestamp is the run start time in UTC.
5. If the generated base directory name already exists, the product appends the
   smallest suffix `_<n>` with `n` starting at `1` that yields a non-existing
   path.
6. A generated output root is created as a direct child of the process current
   working directory.

**Dependencies**:
- `FR-0021`
- `FR-0115`

**Traceability**:
- Area: run lifecycle
- Observable evidence: generated output-root name and location

### FR-0056
**Requirement**: Accepted export-related runs shall emit a deterministic
`RUN_START` line.

**Applicability**:
- accepted non-help `export` and `plan` runs

**Rationale**:
- Operators need one machine-readable start signal with run identity.

**Acceptance Criteria**:
1. The run emits exactly one stdout line in the format
   `RUN_START command=<command> page_id=<page_id> output_root="<absolute_path>"`.
2. `<command>` is `export` or `plan`.
3. `<page_id>` is the canonical resolved root page identifier.
4. `<absolute_path>` is the absolute logical plain output-root path for the run,
   serialized as a quoted path string; whenever the run later retains a report
   set, `summary.txt` reports the same path as `output_root`.
5. `RUN_START` is emitted only after root-page preflight succeeds and the
   logical plain output-root path has been determined.

**Dependencies**:
- `FR-0017`
- `FR-0090`

**Traceability**:
- Area: run lifecycle
- Observable evidence: `RUN_START` line on stdout

### FR-0057
**Requirement**: Accepted export-related runs shall emit deterministic
`RUN_PHASE` lines.

**Applicability**:
- accepted non-help `export` and `plan` runs

**Rationale**:
- Operators need coarse-grained phase visibility during long-running runs.

**Acceptance Criteria**:
1. If the run enters `scope_discovery`, `page_processing`, `report_generation`,
   or `encryption`, it emits exactly one stdout line
   `RUN_PHASE phase=<phase>` for that phase.
2. `RUN_PHASE phase=encryption` is emitted only if encryption is requested and
   the encryption phase actually begins.
3. Emitted `RUN_PHASE` lines appear in lifecycle order and each phase line
   appears at most once.

**Dependencies**:
- `FR-0112`

**Traceability**:
- Area: run lifecycle
- Observable evidence: `RUN_PHASE` lines on stdout

### FR-0058
**Requirement**: Accepted export-related runs that reach completion handling
shall emit a deterministic `RUN_COMPLETE` line.

**Applicability**:
- accepted non-help `export` and `plan` runs except those terminated solely by
  signal interruption before completion handling begins

**Rationale**:
- Operators need one machine-readable completion signal with the final status and
  final artifact location.

**Acceptance Criteria**:
1. The run emits exactly one stdout line in the format
   `RUN_COMPLETE final_status=<status> artifact=<artifact_value>`.
2. `<status>` uses the exact `final_status` vocabulary defined by `FR-0113`.
3. If a plain output root, encrypted archive, or status sidecar remains on disk,
   `<artifact_value>` is the absolute path to that artifact serialized as a
   quoted path string.
4. If no inspectable run artifact remains on disk, `<artifact_value>` is exactly
   `none`.
5. `RUN_COMPLETE` is emitted after the final status and final artifact location
   have been determined and before process exit.

**Dependencies**:
- `FR-0113`
- `FR-0101`
- `FR-0110`

**Traceability**:
- Area: run lifecycle
- Observable evidence: `RUN_COMPLETE` line on stdout
