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
3. Both workflows apply the same scope-discovery requirements in `FR-0059`
   through `FR-0067` to the same root page.
4. Differences between `export` and `plan` are limited to command-specific
   payload acquisition, persistence, encryption, and output-retention
   requirements stated elsewhere in the requirements corpus.

**Dependencies**:
- `FR-0059`
- `FR-0060`
- `FR-0061`
- `FR-0062`
- `FR-0063`
- `FR-0064`
- `FR-0065`
- `FR-0066`
- `FR-0067`

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
1. `export` materializes page payload for successfully processed pages in the
   effective format selected under `FR-0121`.
2. `export` materializes attachment payload files for processed pages when
   attachment-download work for those pages succeeds.
3. `export` produces the run-level report set.

**Dependencies**:
- `FR-0074`
- `FR-0075`
- `FR-0085`
- `FR-0127`
- `FR-0121`

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
1. `plan` acquires only the data required by `FR-0059` through `FR-0067`,
   `FR-0069` through `FR-0073`, and `FR-0085` through `FR-0093` to discover
   pages, resolve supported links, determine attachment counts, and produce the
   run-level report set.
2. `plan` does not persist `page.md` or `page.html`.
3. `plan` does not persist downloaded attachment payload files.

**Dependencies**:
- `FR-0059`
- `FR-0060`
- `FR-0061`
- `FR-0062`
- `FR-0063`
- `FR-0064`
- `FR-0065`
- `FR-0066`
- `FR-0067`
- `FR-0069`
- `FR-0070`
- `FR-0071`
- `FR-0072`
- `FR-0073`
- `FR-0085`
- `FR-0086`
- `FR-0087`
- `FR-0088`
- `FR-0089`
- `FR-0090`
- `FR-0091`
- `FR-0092`
- `FR-0093`
- `FR-0127`

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
- `FR-0017`
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
   serialized as the quoted path string defined by `FR-0124`; whenever the run
   later retains a report set, `summary.txt` reports the same path as
   `output_root`.
5. `RUN_START` is emitted only after root-page preflight succeeds and the
   logical plain output-root path has been determined.

**Dependencies**:
- `FR-0017`
- `FR-0090`
- `FR-0124`

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
**Requirement**: Accepted export-related runs that reach final-outcome
determination shall emit a deterministic `RUN_COMPLETE` line.

**Applicability**:
- accepted non-help `export` and `plan` runs except those terminated solely by
  signal interruption before the run determines `final_status`,
  `interrupt_reason`, and which inspectable artifact class, if any, remains on
  disk

**Rationale**:
- Operators need one machine-readable completion signal with the final status and
  final artifact location.

**Acceptance Criteria**:
1. The run emits exactly one stdout line in the format
   `RUN_COMPLETE final_status=<status> artifact=<artifact_value>`.
2. `<status>` uses the exact `final_status` vocabulary defined by `FR-0113`.
3. If one or more inspectable run artifacts remain on disk, `<artifact_value>`
   selects exactly one authoritative artifact by this precedence order:
   retained encrypted archive path, then retained status-sidecar path, then
   retained plain output-root path.
4. When `<artifact_value>` names a retained path, it is serialized as the
   quoted path string defined by `FR-0124`.
5. If no inspectable run artifact remains on disk, including interrupted or
   runtime-failed `plan` branches that remove their plain output root before
   exit, `<artifact_value>` is the shared absence token defined by `FR-0125`.
6. `RUN_COMPLETE` is emitted after the final status and final artifact location
   have been determined and before process exit.

**Dependencies**:
- `FR-0113`
- `FR-0084`
- `FR-0101`
- `FR-0102`
- `FR-0107`
- `FR-0109`
- `FR-0110`
- `FR-0124`
- `FR-0125`

**Traceability**:
- Area: run lifecycle
- Observable evidence: `RUN_COMPLETE` line on stdout

### FR-0127
**Requirement**: Processed-page status shall use one deterministic lifecycle
threshold.

**Applicability**:
- accepted `export` and `plan` runs

**Rationale**:
- Operators and automation need `processed page` counts, manifest rows, and
  page-local failure reporting to refer to the same lifecycle state.

**Acceptance Criteria**:
1. A page becomes a processed page only when the run has enough page metadata to
   populate that page's `manifest.tsv` row under `FR-0086`.
2. A page that never reaches processed-page status does not contribute a
   `manifest.tsv` row and does not contribute to `processed_pages`,
   `root_pages`, `tree_pages`, or `linked_pages`.
3. A page-local failure may still be recorded in `failed-pages.tsv` even when
   the failing page never reaches processed-page status; in that case the
   unavailable identity fields use the shared absence token defined by
   `FR-0125` as required by `FR-0069` and `FR-0088`.
4. Once a page reaches processed-page status, later page-local failures,
   omitted payload files, or omitted attachment payload files do not remove that
   page from `manifest.tsv` or from the processed-page counts derived from
   `manifest.tsv`.

**Dependencies**:
- `FR-0069`
- `FR-0086`
- `FR-0088`
- `FR-0092`
- `FR-0125`

**Traceability**:
- Area: run lifecycle
- Observable evidence: manifest rows, processed-page counts, failed-pages rows
