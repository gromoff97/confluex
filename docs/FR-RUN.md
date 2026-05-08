# Run Lifecycle Requirements


### FR-0052
**Requirement**: Export execution modes shall share one scope-discovery model.

**Applicability**:
- accepted `export` runs in `materialized` execution mode
- accepted `export` runs in `plan_only` execution mode

**Rationale**:
- Operators need plan-only and materialized export runs to reason about the same
  page scope.

**Acceptance Criteria**:
1. Both execution modes require a root page id.
2. Both execution modes validate root-page accessibility before traversal
   begins.
3. Both execution modes apply the same scope-discovery requirements in `FR-0059`,
   `FR-0060`, `FR-0061`, `FR-0062`, `FR-0063`, `FR-0064`, `FR-0065`,
   `FR-0066`, `FR-0067`, and `FR-0141` to the same root page.

**Dependencies**:
- `FR-0017`
- `FR-0059`
- `FR-0060`
- `FR-0061`
- `FR-0062`
- `FR-0063`
- `FR-0064`
- `FR-0065`
- `FR-0066`
- `FR-0067`
- `FR-0141`

**Traceability**:
- Area: run lifecycle
- Observable evidence: accepted run behavior, scope reports

### FR-0053
**Requirement**: `export` in `materialized` execution mode shall materialize
Markdown page content and attachment payloads.

**Applicability**:
- accepted `export` runs in `materialized` execution mode

**Rationale**:
- Operators need a workflow that produces materialized Markdown page payloads
  and attachment payload files.

**Acceptance Criteria**:
1. `materialized` execution mode performs page-payload materialization under
   `FR-0074` for each page whose processing reaches that page's
   payload-materialization work, using the Markdown payload format selected
   under `FR-0121`.
2. When page-payload materialization succeeds for a page under `FR-0074`,
   `materialized` execution mode retains the selected Markdown page
   representation in that page's payload folder.
3. `materialized` execution mode performs attachment-download work under
   `FR-0075` for each page that reaches processed-page status under `FR-0127`
   and whose attachment data is available for download.
4. When attachment-download work succeeds for a page from criterion 3 under
   `FR-0075`, `materialized` execution mode retains that page's attachment
   payload files.
5. `materialized` execution mode produces the run-level report set governed by
   `FR-0085`.

**Dependencies**:
- `FR-0074`
- `FR-0075`
- `FR-0085`
- `FR-0086`
- `FR-0127`
- `FR-0121`

**Traceability**:
- Area: run lifecycle
- Observable evidence: page payload folders, attachments, report set

### FR-0054
**Requirement**: `export --plan-only` shall run the plan-only execution mode.

**Applicability**:
- accepted `export --plan-only` runs

**Rationale**:
- Operators need planning output without the cost and risk of payload
  materialization.

**Acceptance Criteria**:
1. `plan_only` execution mode acquires only the page-scope, link-discovery,
   page-metadata,
   storage-content, child-listing, title-resolution-candidate, and
   attachment-preview data needed to satisfy `FR-0059`, `FR-0060`, `FR-0061`,
   `FR-0062`, `FR-0063`, `FR-0064`, `FR-0065`, `FR-0066`, `FR-0067`,
   `FR-0141`, `FR-0069`, `FR-0070`, `FR-0071`, `FR-0072`, `FR-0073`,
   `FR-0092`, and `FR-0093`.
2. `plan_only` execution mode does not materialize page payload content or
   downloaded attachment payload files in the final retained result.
3. `plan_only` attachment-preview acquisition and the prohibition on downloaded
   attachment payload files are governed by `FR-0073`.
4. `plan_only` output layout and the absence of `page.md` and downloaded
   attachment payload files are governed by `FR-0081`.
5. `plan_only` execution mode produces the run-level report set governed by
   `FR-0085`.

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
- `FR-0141`
- `FR-0069`
- `FR-0070`
- `FR-0071`
- `FR-0072`
- `FR-0073`
- `FR-0081`
- `FR-0085`
- `FR-0092`
- `FR-0093`

**Traceability**:
- Area: run lifecycle
- Observable evidence: report set without materialized content payload

### FR-0055
**Requirement**: Automatically generated output-root names shall identify the
workflow and root page.

**Applicability**:
- `export` with no effective output-root selector
- `export --plan-only` with no effective output-root selector

**Rationale**:
- Operators need generated output roots that are readable and collision-safe.

**Acceptance Criteria**:
1. `export` in `materialized` execution mode with no effective output-root
   selector generates the base directory name
   `confluence_dump_<page_id>_<YYYYMMDDTHHMMSSZ>`.
2. `export --plan-only` with no effective output-root selector generates the
   base directory name `confluence_plan_<page_id>_<YYYYMMDDTHHMMSSZ>`.
3. `<page_id>` is the canonical resolved root page identifier.
4. Automatic generated output-root naming and candidate selection begins only
   after root-page preflight under `FR-0017` succeeds and establishes the
   canonical resolved root page identifier serialized as `<page_id>` in
   criteria 1 and 2.
5. The timestamp is the UTC time captured exactly once after criterion 4 and
   before the product evaluates the first generated output-root candidate under
   criteria 7 through 9.
6. `<YYYYMMDDTHHMMSSZ>` serializes the UTC timestamp as four-digit year,
   two-digit month, two-digit day, literal `T`, two-digit 24-hour hour,
   two-digit minute, two-digit second, and literal `Z`, with all numeric
   components zero-padded.
7. For each base or suffixed generated directory name, before invocation
   acceptance the product obtains the process current working directory under
   `FR-0158`, requires that directory to be absolute and path-normalizable for
   the current platform under `FR-0159`, joins that single directory name to
   that directory, and path-normalizes the joined result under `FR-0159`.
8. Candidate existence is evaluated using non-following filesystem metadata, and
   any existing filesystem object at a candidate path counts as an existing
   candidate.
9. If metadata evaluation under criterion 8 fails for the generated base
   candidate path or for any suffixed candidate path checked before selection,
   the invocation is rejected under `FR-0019` before invocation acceptance.
10. If the generated base directory name already exists under criterion 8, or if
   any earlier suffixed candidate also exists under criterion 8, the product
   appends the smallest suffix `_<n>` whose `n` is a canonical positive integer
   governed by `FR-0014` and whose first retry uses `n=1`, then selects the
   smallest such candidate path that does not exist under criterion 8.
11. A generated output root is created as a direct child of the process current
    working directory.
12. If criterion 7 cannot obtain or validate the process current working
    directory, or if the joined candidate path cannot be path-normalized under
    `FR-0159`, the invocation is rejected under `FR-0019` before invocation
    acceptance.

**Dependencies**:
- `FR-0014`
- `FR-0021`
- `FR-0019`
- `FR-0017`
- `FR-0115`
- `FR-0154`
- `FR-0158`
- `FR-0159`
- `FR-0219`

**Traceability**:
- Area: run lifecycle
- Observable evidence: generated output-root name and location

### FR-0056
**Requirement**: Accepted export-related runs shall emit a deterministic
`RUN_START` line.

**Applicability**:
- accepted non-help `export` runs

**Rationale**:
- Operators need one machine-readable start signal with run identity.

**Acceptance Criteria**:
1. The run emits exactly one stdout line in the format
   `RUN_START command=export execution_mode=<execution_mode> page_id=<page_id> output_root=<quoted_path_string>`
   unless the run enters the `FR-0147` signal-interruption branch before
   `RUN_START` emission or the pre-output-root runtime-failure branch governed
   by `FR-0102` before `RUN_START` emission.
2. `<execution_mode>` is `materialized` or `plan_only`.
3. `<page_id>` is the canonical resolved root page identifier.
4. `<quoted_path_string>` is the absolute logical plain output-root path for the
   run, serialized with the quoted path-string rules defined by `FR-0124` whose
   decoded value is that exact absolute path; whenever the run later retains a
   report set, `summary.txt` reports the same path as `output_root`.
5. `RUN_START` is emitted only after root-page preflight succeeds and the
   logical plain output-root path has been determined.
6. For an accepted non-help `export` run, stdout contains only the
   export-related run lifecycle lines governed by `FR-0056`, `FR-0057`, and
   `FR-0058`.
7. If `RUN_START` is emitted, it is the first stdout line.
8. After `RUN_START`, zero or more `RUN_PHASE` lines appear in the lifecycle
   order governed by `FR-0057`.
9. If the run emits a `RUN_COMPLETE` line under `FR-0058`, that line is the
   final stdout line.
10. The governed stdout lifecycle output from criteria 1 through 9 is UTF-8
    text. When one or more lifecycle lines are emitted, each emitted line is one
    LF-terminated physical line and no byte other than the bytes of those
    emitted lines and their terminating LFs occurs on stdout.
11. If stdout is non-empty under criterion 10, its final byte is the LF that
    terminates the last emitted lifecycle line.

**Dependencies**:
- `FR-0017`
- `FR-0076`
- `FR-0085`
- `FR-0090`
- `FR-0124`
- `FR-0119`
- `FR-0057`
- `FR-0058`
- `FR-0147`
- `FR-0102`

**Traceability**:
- Area: run lifecycle
- Observable evidence: `RUN_START` line on stdout

### FR-0057
**Requirement**: Accepted export-related runs shall emit deterministic
`RUN_PHASE` lines.

**Applicability**:
- accepted non-help `export` runs

**Rationale**:
- Operators need coarse-grained phase visibility during long-running runs.

**Acceptance Criteria**:
1. The governed phase tokens are exactly `scope_discovery`, `page_processing`,
   `report_generation`, and `zip_packaging`.
2. `scope_discovery` means accepted run work after root-page preflight succeeds
   under `FR-0017`, after output-root creation or reuse has completed under
   `FR-0076`, and before the run begins page-processing work that can make a
   page reach processed-page status under `FR-0127`; this includes only the
   shared scope-discovery work governed by `FR-0052` that occurs before
   page-processing begins.
3. `page_processing` means accepted run work that can make one or more pages
   reach processed-page status under `FR-0127`, including any child-result or
   link discovery appended during page processing under `FR-0141`, before
   normal report generation or report synthesis begins.
4. `report_generation` means accepted run work that writes, rewrites, or
   synthesizes the closed report-file set governed by `FR-0085`, including
   report synthesis under `FR-0145`, before final-outcome determination or ZIP
   packaging begins.
5. `zip_packaging` means accepted export work that creates the ZIP archive
   governed by `FR-0221`.
6. If the run enters one of the phase tokens from criteria 1 through 5 and the
   run does not take the pre-output-root signal-interruption branch governed by
   `FR-0147`, it emits exactly one stdout line `RUN_PHASE phase=<phase>` for
   that phase.
7. `RUN_PHASE phase=zip_packaging` is emitted only for accepted `export --zip`
   invocations whose ZIP packaging work begins.
8. Lifecycle order for `materialized` execution mode is exactly
   `scope_discovery`, `page_processing`, `report_generation`, then
   `zip_packaging`.
9. Lifecycle order for `plan_only` execution mode is exactly
   `scope_discovery`, `report_generation`.
10. Emitted `RUN_PHASE` lines appear in lifecycle order and each phase line
   appears at most once.

**Dependencies**:
- `FR-0017`
- `FR-0052`
- `FR-0076`
- `FR-0085`
- `FR-0127`
- `FR-0141`
- `FR-0145`
- `FR-0147`
- `FR-0221`

**Traceability**:
- Area: run lifecycle
- Observable evidence: `RUN_PHASE` lines on stdout

### FR-0058
**Requirement**: Accepted export-related runs that reach final-outcome
determination shall emit a deterministic `RUN_COMPLETE` line.

**Applicability**:
- accepted non-help `export` runs except those terminated solely by
  signal interruption before the run determines `final_status`,
  `interrupt_reason`, and which retained artifact class, if any, remains on
  disk, and except accepted-run runtime failures that never complete
  final-outcome determination

**Rationale**:
- Operators need one machine-readable completion signal with the final status
  and final artifact location.

**Acceptance Criteria**:
1. The run emits exactly one stdout line in the format
   `RUN_COMPLETE final_status=<status> artifact=<artifact_value>`.
2. `<status>` uses the exact `final_status` vocabulary defined by `FR-0113`.
3. If one or more retained run artifacts remain on disk, `<artifact_value>`
   selects exactly one authoritative artifact by this precedence order:
   retained ZIP archive path, then retained plain output-root path.
4. When `<artifact_value>` names a retained path, it is serialized using the
   quoted path string governed by `FR-0124`, which for this line is one JSON
   string literal with no surrounding whitespace whose decoded value is that
   exact retained path.
5. If no retained run artifact remains on disk, including interrupted or
   runtime-failed `plan_only` branches that remove their plain output root before
   exit, `<artifact_value>` uses the shared absence token governed by
   `FR-0125`, serialized here as exactly the bare lowercase ASCII text `none`.
6. This card governs only the `RUN_COMPLETE` line shape, authoritative artifact
   selection, and emission timing; the `final_status` value contract used inside
   the line is governed exclusively by `FR-0113`.
7. `RUN_COMPLETE` is emitted after the final status and final artifact location
   have been determined and before process exit.

**Dependencies**:
- `FR-0113`
- `FR-0076`
- `FR-0077`
- `FR-0078`
- `FR-0124`
- `FR-0125`
- `FR-0221`

**Traceability**:
- Area: run lifecycle
- Observable evidence: `RUN_COMPLETE` line on stdout

### FR-0127
**Requirement**: Processed-page status shall use one deterministic lifecycle
threshold.

**Applicability**:
- accepted `export` runs

**Rationale**:
- Operators and automation need `processed page` counts, manifest rows, and
  page-local failure reporting to refer to the same lifecycle state.

**Acceptance Criteria**:
1. A page becomes a processed page only when the run has the page metadata
   required to populate that page's `page_id`, `space_key`, `page_title`,
   `discovery_source`, and `execution_mode` `manifest.tsv` fields under
   `FR-0086`.
   `folder` and `attachment_count` are not part of the processed-page threshold
   and may still serialize as `none` under `FR-0086` until later per-page
   artifact retention and attachment work determine them.
2. A page that never reaches processed-page status does not contribute a
   `manifest.tsv` row and does not contribute to `processed_pages`,
   `root_pages`, `tree_pages`, or `linked_pages`.
3. A page-local failure is still recorded in `failed-pages.tsv` even when the
   failing page never reaches processed-page status; in that case the
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
