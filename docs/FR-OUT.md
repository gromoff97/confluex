# Output And Artifact Requirements


### FR-0076
**Requirement**: The selected logical plain output root shall be validated and
materialized for every accepted `export` run.

**Applicability**:
- non-help `export` invocations

**Rationale**:
- Operators need one authoritative filesystem location for a run result.

**Acceptance Criteria**:
1. The chosen output-root path for this card is the logical plain output-root
   path selected, normalized, or generated under `FR-0021`.
2. Before creating or reusing the chosen output-root path, the product
   evaluates each existing path segment from the filesystem root through the
   chosen output-root path using non-following filesystem metadata under
   `FR-0154`.
3. If metadata evaluation required by criterion 2 fails for any existing path
   segment or for the chosen output-root path when that path already exists,
   the invocation is rejected under `FR-0019` before invocation acceptance
   under `FR-0212` and before accepted run execution begins.
4. If any existing ancestor of the chosen output-root path is a symbolic link,
   regular file, FIFO, socket, device, or any other non-directory filesystem
   object, the invocation is rejected before invocation acceptance under
   `FR-0212` and before accepted run execution begins.
5. If the chosen output-root path exists as a symbolic link, regular file, FIFO,
   socket, device, or any other non-directory filesystem object, the invocation
   is rejected before invocation acceptance under `FR-0212` and before accepted
   run execution begins.
6. If the chosen output-root path exists as a directory for a non-resume
   invocation that supplied `--out`, the invocation is rejected under `FR-0016`
   before invocation acceptance under `FR-0212` and before accepted run
   execution begins.
7. A generated output root selected under `FR-0021` is never reused; if the
   generated candidate path already exists under the pre-acceptance candidate
   checks governed by `FR-0055`, the product selects another generated
   candidate under `FR-0055` before invocation acceptance under `FR-0212` and
   before accepted run execution begins.
8. If the chosen output-root path exists as a directory for
   `export --resume --out <path>`, reuse is governed by the resume compatibility
   requirements in `FR-0103`.
9. If the chosen output-root path does not exist, the product creates that
   directory path, including missing parent directories, before writing run
   artifacts.
10. Missing parent directories are created as directories only; the product does
   not follow symbolic links while creating or verifying the output-root path.
11. If creating or verifying the chosen output-root directory fails after
   invocation acceptance under `FR-0212`, the invocation fails as an
   accepted-run runtime failure under `FR-0102`; no page processing begins
   after that failure.
12. Any retained `INCOMPLETE` marker in a plain output root is a regular UTF-8
   text file with LF line endings, contains exactly one line `incomplete=1`, and
   contains no other bytes.

**Dependencies**:
- `FR-0021`
- `FR-0055`
- `FR-0016`
- `FR-0019`
- `FR-0102`
- `FR-0103`
- `FR-0154`
- `FR-0212`

**Traceability**:
- Area: output structure
- Observable evidence: created or reused output-root path

### FR-0077
**Requirement**: A plain `export` output root shall have a stable top-level
artifact layout.

**Applicability**:
- authoritative retained plain `export` output roots that remain on disk

**Rationale**:
- Operators need a deterministic top-level layout for materialized export runs.

**Acceptance Criteria**:
1. The top level contains exactly the report-file entries from the closed
   report-file set defined by `FR-0085`.
2. The top level contains `pages/`.
3. If `_debug/` artifacts are requested under `FR-0248`, the top level also
   contains `_debug/`.
4. If the plain export output root represents an interrupted or incomplete run,
   the top level also contains `INCOMPLETE`.
5. The top level contains no entries other than the entries required by
   criteria 1 through 4.
6. The `pages/` subtree contains exactly the first-level space-segment
   directories needed by the canonical relative payload-folder paths from
   `FR-0079` for pages whose per-page artifacts are retained in the final export
   result.
7. Each first-level space-segment directory under `pages/` contains exactly the
   page folders needed by those same `FR-0079` paths for retained export pages
   in that space segment.
8. Each retained export page folder's direct entries are governed by `FR-0080`;
   no recursive entry exists under `pages/` except entries required by criteria
   6 and 7, page-folder direct entries permitted by `FR-0080`, and retained
   attachment payload files permitted by `FR-0075`.

**Dependencies**:
- `FR-0085`
- `FR-0076`
- `FR-0082`
- `FR-0075`
- `FR-0079`
- `FR-0080`
- `FR-0097`
- `FR-0100`
- `FR-0102`
- `FR-0248`

**Traceability**:
- Area: output structure
- Observable evidence: top-level export artifact set

### FR-0078
**Requirement**: A plain `export --plan-only` output root shall have a stable
top-level artifact layout.

**Applicability**:
- authoritative retained plain `export --plan-only` output roots that remain on
  disk

**Rationale**:
- Operators need a deterministic top-level layout for plan-only export runs.

**Acceptance Criteria**:
1. The top level contains exactly the report-file entries from the closed
   report-file set defined by `FR-0085`.
2. If `_debug/` artifacts are requested under `FR-0248`, the top level also
   contains `_debug/`.
3. If the plain plan-only output root remains on disk because the run ended in a
   configured stop condition, interrupted cleanup failure, or runtime-failed
   cleanup failure, the top level also contains `INCOMPLETE`.
4. The top level contains no entries other than the entries required by
   criteria 1 through 3.
5. The top level does not contain `pages/`.

**Dependencies**:
- `FR-0085`
- `FR-0076`
- `FR-0082`
- `FR-0097`
- `FR-0101`
- `FR-0102`
- `FR-0248`

**Traceability**:
- Area: output structure
- Observable evidence: top-level plan-only artifact set

### FR-0079
**Requirement**: Each processed page shall map to exactly one payload folder when
per-page artifacts are persisted.

**Applicability**:
- `export` in `materialized` execution mode

**Rationale**:
- Operators need a deterministic, page-scoped payload layout.

**Acceptance Criteria**:
1. Each persisted page has exactly one payload folder under `pages/`.
2. If the page source provides a non-empty space key, the payload folder path is
   `pages/<space_key_segment>/<page_folder>`.
3. If the page source does not provide a space key or provides an empty space
   key, the payload folder path is `pages/_no_space/<page_folder>`.
4. `<page_folder>` is exactly `page__<page_id>`.
5. `<page_id>` is the persisted page's canonical page identifier governed by
   `FR-0014`.
6. For a non-empty `space_key`, `<space_key_segment>` is one deterministic
   single-segment encoding of that exact `space_key`, defined as `space__`
   followed by the uppercase hexadecimal encoding of the UTF-8 bytes of the
   exact `space_key` with no separators.
7. Within one run, identical non-empty `space_key` values map to the same
   `<space_key_segment>`, and different non-empty `space_key` values map to
   different `<space_key_segment>` values.
8. `<space_key_segment>` and `<page_folder>` each occupy exactly one filesystem
   path segment and do not contain path separators, `.` segments, or `..`
   segments.
9. If `<space_key_segment>` or `<page_folder>` would exceed `240` UTF-8 bytes,
   that page does not receive a persisted payload folder under this layout. In
   `export`, that condition is a `page_payload` page-local failure governed by
   `FR-0074`, the final run result retains no per-page artifacts for that page,
   and `manifest.tsv` serializes `folder` as the shared absence token under
   `FR-0086`.
10. This card defines the canonical relative payload-folder path for each
   persisted page as a governed relative path under `FR-0150`.

**Dependencies**:
- `FR-0014`
- `FR-0069`
- `FR-0074`
- `FR-0086`
- `FR-0128`
- `FR-0150`

**Traceability**:
- Area: output structure
- Observable evidence: persisted page folder paths, manifest `folder` values

### FR-0080
**Requirement**: Export page payload folders shall have a stable file structure.

**Applicability**:
- accepted `export` runs

**Rationale**:
- Operators need predictable placement of materialized content and metadata.

**Acceptance Criteria**:
1. A successfully materialized export page payload folder contains the
   materialized Markdown payload file `page.md`.
2. If the page has persisted attachments, the folder contains `attachments/`.
3. This card governs payload file names, folder placement, and metadata or
   attachment side files; it does not define Markdown payload acquisition,
   Markdown normalization, Markdown internal-link localization, inline
   unresolved-marker rendering, or any other page-content semantics inside
   `page.md`; those semantics are governed by `FR-0074`.
4. Any retained export page payload folder contains no direct entries other than
   `page.md` when payload materialization succeeded and `attachments/` when
   criterion 2 applies.

**Dependencies**:
- `FR-0069`
- `FR-0070`
- `FR-0079`
- `FR-0074`
- `FR-0075`
- `FR-0128`
- `FR-0121`

**Traceability**:
- Area: output structure
- Observable evidence: file structure within export page payload folders

### FR-0081
**Requirement**: Plan-only output shall retain no materialized page payload
folders.

**Applicability**:
- accepted `export --plan-only` runs

**Rationale**:
- Operators need plan-only runs to inspect scope without retaining materialized
  page content or downloaded attachment payloads.

**Acceptance Criteria**:
1. `plan_only` execution mode does not retain `page.md`.
2. `plan_only` execution mode does not retain downloaded attachment payload
   files.
3. `plan_only` execution mode does not retain `pages/`.
4. Scope reports for `plan_only` execution mode remain governed by `FR-0085`.
5. Debug artifacts for `plan_only` execution mode are governed by `FR-0249` and
   do not make `pages/` a retained materialized output subtree.

**Dependencies**:
- `FR-0069`
- `FR-0070`
- `FR-0073`
- `FR-0085`
- `FR-0249`

**Traceability**:
- Area: output structure
- Observable evidence: plan-only output root without materialized page folders

### FR-0082
**Requirement**: Run-artifact names in retained report-set containers and plain
output roots shall have one stable functional meaning.

**Applicability**:
- report-set containers defined by `FR-0085`
- retained plain output roots that contain `INCOMPLETE`

**Rationale**:
- Operators need each artifact to have one authoritative interpretation.

**Acceptance Criteria**:
1. `manifest.tsv` means the authoritative list of processed pages.
2. `resolved-links.tsv` means the authoritative list of resolved source-to-target
   link dependencies.
3. `unresolved-links.tsv` means the authoritative list of discovered links that
   were not resolved to one unique target page.
4. `failed-pages.tsv` means the authoritative list of page-local failures.
5. `scope-findings.tsv` means the authoritative list of conditions that reduce
   confidence in scope completeness.
6. `summary.txt` means the authoritative machine-readable summary of run outcome.
7. `INCOMPLETE` means that the plain output root does not represent a cleanly
   completed plain run result.
8. `_debug/` means the sanitized diagnostic artifact tree governed by
   `FR-0249`.

**Dependencies**:
- `FR-0085`
- `FR-0076`

**Traceability**:
- Area: output structure
- Observable evidence: stable artifact naming and interpretation

### FR-0238
**Requirement**: Export ZIP sibling artifact paths shall be derived
deterministically from the logical plain output-root path.

**Applicability**:
- `export --zip` invocations whose logical plain output-root path has been
  selected under `FR-0076`

**Rationale**:
- Operators need the portable archive path to be predictable from the selected
  output root.

**Acceptance Criteria**:
1. `<out>` is the logical plain output-root path string selected under
   `FR-0076`.
2. The ZIP sibling path is the absolute path produced by appending `.zip` to
   `<out>` before ZIP creation governed by `FR-0221`.
3. The ZIP sibling path has the same parent directory as `<out>`.
4. The ZIP sibling path is serialized in `summary.txt` only through the
   `zip_path` value contract governed by `FR-0119`.

**Dependencies**:
- `FR-0076`
- `FR-0119`
- `FR-0221`

**Traceability**:
- Area: output structure
- Observable evidence: ZIP path and `summary.txt` `zip_path` field

### FR-0239
**Requirement**: Final run status shall be recorded in retained report sets.

**Applicability**:
- retained plain `export` output roots
- retained plain `export --plan-only` output roots

**Rationale**:
- Operators need final outcome state to live inside the report set that
  accompanies the retained run result.

**Acceptance Criteria**:
1. A retained plain output root records final run status through the
   `final_status` field in `summary.txt`.
2. The `final_status` field uses the vocabulary governed by `FR-0113`.
3. The `summary.txt` file is part of the report-file set governed by `FR-0085`
   and the schema governed by `FR-0090`.
4. This card does not redefine report-set retention branches or summary schema
   key order.

**Dependencies**:
- `FR-0085`
- `FR-0090`
- `FR-0113`

**Traceability**:
- Area: output structure
- Observable evidence: retained `summary.txt` final-status field

### FR-0128
**Requirement**: Failed per-page export materialization shall produce a
deterministic failed-page artifact state in the final run result.

**Applicability**:
- accepted `export` runs

**Rationale**:
- Operators need retained export artifacts to show only successful payload
  materialization and successful attachment retention, not half-written files.

**Acceptance Criteria**:
1. If `page_payload` fails for a processed page, the final run result does not
   retain `page.md` for that page.
2. If `attachment_download` fails for a processed page, the final run result
   does not retain any attachment payload file for that page.
3. Cleanup required by criteria 1 or 2 does not remove other per-page artifacts
   for that page whose retention is still required elsewhere in the corpus.
4. If a processed page retains no per-page artifacts in the final run result
   after applying this cleanup, the page's payload folder is absent.
5. If cleanup required by criteria 1 or 2 fails before final result retention,
   the run is governed as a runtime failure after accepted run execution began
   under `FR-0102`; no successful final run result is produced.
6. Atomic commit semantics for retained per-page artifacts are governed by
   `FR-0151`.

**Dependencies**:
- `FR-0074`
- `FR-0075`
- `FR-0086`
- `FR-0127`
- `FR-0102`
- `FR-0151`

**Traceability**:
- Area: output structure
- Observable evidence: retained page folders and files after page-local failure

### FR-0151
**Requirement**: Retained per-page artifact commits shall be atomic relative to
report synthesis.

**Applicability**:
- accepted `export` runs in `materialized` execution mode that retain per-page
  artifacts

**Rationale**:
- Interrupted and runtime-failed runs need retained per-page files and
  synthesized reports to agree without exposing half-written artifacts.

**Acceptance Criteria**:
1. Per-page artifacts governed by this card are `page.md` and attachment
   payload files under `attachments/`.
2. A per-page artifact becomes eligible for any final or partial retained result
   only after the complete intended byte sequence has been written and the
   governing acquisition, materialization, preview, or download operation has
   reached success.
3. Before criterion 2 is satisfied, per-page artifact bytes are written only to
   non-retained temporary paths outside the plain output root.
4. For normal report generation, configured-stop report retention, and report
   synthesis under `FR-0145`, the transition that makes a per-page artifact
   eligible under criterion 2 and the corresponding report evidence from
   criteria 6 and 7 are one indivisible per-page artifact commit.
5. If a runtime failure or signal interruption occurs before the commit from
   criterion 4 completes, the affected per-page artifact is not retained in the
   authoritative plain output root.
6. For any retained per-page artifact, `manifest.tsv` contains the page's row and
   that row's `folder` field is the page's canonical `FR-0079` folder path under
   the `FR-0086` folder semantics.
7. If a retained per-page artifact corresponds to an operation whose failure
   would be reported in `failed-pages.tsv` under `FR-0088`, the retained report
   set contains no `failed-pages.tsv` row for that page and operation.
8. If criteria 6 or 7 cannot be satisfied for a per-page artifact, that artifact
   is not eligible for final or partial retention under criterion 2.
9. A prior page payload reused by an accepted resumed export under `FR-0105` is
   eligible for retention without a current-run byte write when the reuse
   predicate in `FR-0105` succeeds and the regenerated reports from `FR-0106`
   satisfy criteria 6 and 7 for that page.

**Dependencies**:
- `FR-0073`
- `FR-0074`
- `FR-0075`
- `FR-0079`
- `FR-0080`
- `FR-0086`
- `FR-0088`
- `FR-0097`
- `FR-0105`
- `FR-0106`
- `FR-0145`

**Traceability**:
- Area: output structure
- Observable evidence: retained per-page files and synthesized report rows

### FR-0249
**Requirement**: Debug artifacts shall use one sanitized `_debug/` artifact
tree inside the selected output root.

**Applicability**:
- accepted `export --debug` runs
- accepted `export --plan-only --debug` runs

**Rationale**:
- Operators need enough local evidence to diagnose scope discovery and export
  materialization failures without enabling any other option.

**Acceptance Criteria**:
1. The debug artifact root is exactly `_debug/` directly under the selected
   logical plain output root.
2. Run-level debug artifacts are exactly `_debug/run.json`,
   `_debug/options.json`, and `_debug/events.ndjson`.
3. Page-level debug artifacts are retained under `_debug/pages/<page_id>/`,
   where `<page_id>` is the canonical page identifier governed by `FR-0014`.
4. Page-level debug artifact names are selected only from `metadata.json`,
   `storage.xml`, `attachments-preview.json`, `markdown.raw.md`, and
   `markdown.normalized.md`.
5. Debug artifacts are written only for operations the selected execution mode
   already performed.
6. `plan_only` execution mode never writes `markdown.raw.md` or
   `markdown.normalized.md`.
7. `materialized` execution mode writes Markdown debug artifacts only for pages
   whose page-payload materialization was attempted.
8. Debug artifact content is sanitized under `FR-0250` before it is written.
9. Debug artifact path components are governed relative path segments under
   `FR-0150`; a page-level debug directory is not created if `<page_id>` is not a
   canonical page identifier under `FR-0014`.
10. Debug artifact writes use the same atomic regular-file commit semantics as
    retained per-page artifacts under `FR-0151`.

**Dependencies**:
- `FR-0014`
- `FR-0150`
- `FR-0151`
- `FR-0248`
- `FR-0250`

**Traceability**:
- Area: output structure
- Observable evidence: `_debug/` tree, run-level debug files, page-level debug
  files

### FR-0250
**Requirement**: Debug artifacts shall redact configured secret values before
persistence.

**Applicability**:
- debug artifact writes governed by `FR-0249`

**Rationale**:
- Operators need diagnostic artifacts that can be inspected without exposing the
  Confluence token or authorization headers.

**Acceptance Criteria**:
1. The effective Confluence token selected under `FR-0216` is never written
   verbatim to a debug artifact.
2. Authorization header values are never written verbatim to a debug artifact.
3. Captured child-process stdout, stderr, command arguments, config snapshots,
   thrown errors, and serialized objects pass through redaction before
   persistence.
4. Redaction replaces an exact selected token value with a stable placeholder
   and replaces recognized authorization-header values with a stable
   authorization placeholder.
5. Debug artifacts may contain Confluence page content, page titles, space keys,
   links, storage XML, Markdown payloads, and attachment metadata after secret
   redaction.

**Dependencies**:
- `FR-0216`
- `FR-0249`

**Traceability**:
- Area: output structure
- Observable evidence: debug artifacts without token disclosure

### FR-0217
**Requirement**: Directory roots left on disk as non-authoritative result debris
shall carry one stable disqualifying marker.

**Applicability**:
- directory roots left on disk and explicitly classified by another card as
  non-authoritative run-result debris

**Rationale**:
- Resume compatibility and post-run tooling need one machine-readable way to
  distinguish eligible retained roots from debris that only happens to contain
  partial governed files.

**Acceptance Criteria**:
1. A directory root governed by this card contains one top-level regular file
   named `NON_AUTHORITATIVE`.
2. `NON_AUTHORITATIVE` is UTF-8 text with LF line endings.
3. `NON_AUTHORITATIVE` contains exactly one line `non_authoritative=1` and no
   other bytes.
4. A directory root that contains `NON_AUTHORITATIVE` is not a report-set
   container under `FR-0085`.
5. A card that explicitly classifies an on-disk directory root as
   non-authoritative debris satisfies that classification only when the root
   also satisfies criteria 1 through 3.

**Dependencies**:
- `FR-0085`

**Traceability**:
- Area: output structure
- Observable evidence: top-level `NON_AUTHORITATIVE` marker on retained debris
  roots

### FR-0221
**Requirement**: ZIP export packaging shall use deterministic success and
failure branches beside the plain output root.

**Applicability**:
- accepted `export --zip` invocations whose ZIP-packaging request from
  `FR-0220` reaches ZIP packaging after accepted run execution begins

**Rationale**:
- Operators need a portable archive while retaining the ordinary output root for
  inspection and recovery, and automation needs existing-sibling and creation
  failures to be classified consistently.

**Acceptance Criteria**:
1. After the plain output root reaches its final retained content, the ZIP
   packaging branch governed by this card creates one ZIP archive at the ZIP
   sibling path governed by `FR-0238`, unless that path already exists.
2. If the `FR-0238` ZIP sibling path already exists before ZIP creation begins
   after accepted run execution has begun, the accepted invocation fails under
   `FR-0102` before modifying that path.
3. ZIP input collection evaluates every included filesystem object using
   non-following metadata after the plain output root reaches its final retained
   content.
4. The ZIP archive contains only relative entries for regular files retained
   under the plain output root. It contains no absolute path entries, no empty
   directory entries, and no entries containing `..` as a path segment.
5. ZIP entry names contain no backslash, colon, ASCII control character, absolute
   path prefix, `.` segment, or `..` segment.
6. If an included path is not a regular file under non-following metadata during
   collection or immediately before its bytes are read, ZIP creation fails under
   `FR-0102`.
7. ZIP entries are added in ascending bytewise lexicographic order of their
   governed relative path under `FR-0150`.
8. ZIP bytes are first written to a unique temporary sibling path and are moved to
   the final ZIP sibling path only after all archive bytes have been produced and
   the temporary path has been closed.
9. If ZIP creation fails before final rename, the final ZIP sibling path is absent
   unless it pre-existed and triggered criterion 2.
10. The plain output root remains on disk after successful ZIP creation.
11. `summary.txt` includes exactly one `zip_path=<quoted_path_string>` line when
   ZIP creation succeeds; the serialized ZIP path is governed by `FR-0238` and
   `FR-0119`.
12. If ZIP creation fails after accepted run execution begins, the run fails
   under `FR-0102`; any partially written ZIP archive is non-authoritative
   output debris and is not a report-set container.

**Dependencies**:
- `FR-0085`
- `FR-0238`
- `FR-0102`
- `FR-0119`
- `FR-0150`
- `FR-0154`
- `FR-0220`

**Traceability**:
- Area: output structure
- Observable evidence: ZIP archive path, archive entry list, summary field,
  retained plain output root
