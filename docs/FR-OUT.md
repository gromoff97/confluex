# Output And Artifact Requirements


### FR-0076
**Requirement**: Every accepted `export` or `plan` run shall have exactly one
logical plain output root.

**Applicability**:
- accepted `export` and `plan` runs

**Rationale**:
- Operators need one authoritative filesystem location for a run result.

**Acceptance Criteria**:
1. If the operator supplies `--out`, the resolved logical plain output-root path
   is the output root.
2. If the operator omits `--out`, the product generates exactly one output root.
3. If the chosen output-root path does not exist, the product creates that
   directory path, including missing parent directories, before writing run
   artifacts.

**Dependencies**:
- `FR-0021`
- `FR-0055`

**Traceability**:
- Area: output structure
- Observable evidence: created or reused output-root path

### FR-0077
**Requirement**: A plain `export` output root shall have a stable top-level
artifact layout.

**Applicability**:
- `export` runs whose plain output root remains on disk

**Rationale**:
- Operators need a deterministic top-level layout for materialized export runs.

**Acceptance Criteria**:
1. The top level contains `pages/`, `manifest.tsv`, `resolved-links.tsv`,
   `unresolved-links.tsv`, `failed-pages.tsv`, `scope-findings.tsv`, and
   `summary.txt`.
2. If the plain export output root represents an interrupted or incomplete run,
   the top level also contains `INCOMPLETE`.

**Dependencies**:
- `FR-0097`
- `FR-0100`
- `FR-0102`

**Traceability**:
- Area: output structure
- Observable evidence: top-level export artifact set

### FR-0078
**Requirement**: A plain `plan` output root shall have a stable top-level
artifact layout.

**Applicability**:
- `plan` runs whose plain output root remains on disk

**Rationale**:
- Operators need a deterministic top-level layout for planning runs.

**Acceptance Criteria**:
1. The top level contains `manifest.tsv`, `resolved-links.tsv`,
   `unresolved-links.tsv`, `failed-pages.tsv`, `scope-findings.tsv`, and
   `summary.txt`.
2. If `plan` persisted any per-page metadata artifacts, the top level also
   contains `pages/`.
3. If the plain plan output root remains on disk because the run ended in a
   configured stop condition, the top level also contains `INCOMPLETE`.

**Dependencies**:
- `FR-0097`

**Traceability**:
- Area: output structure
- Observable evidence: top-level plan artifact set

### FR-0079
**Requirement**: Each processed page shall map to exactly one payload folder when
per-page artifacts are persisted.

**Applicability**:
- `export`
- `plan` with persisted per-page metadata

**Rationale**:
- Operators need a deterministic, page-scoped payload layout.

**Acceptance Criteria**:
1. Each persisted page has exactly one payload folder under `pages/`.
2. If the page source provides a space key, the payload folder path is
   `pages/<space_key_segment>/<page_folder>`.
3. If the page source does not provide a space key, the payload folder path is
   `pages/_no_space/<page_folder>`.
4. `<page_folder>` is exactly `page__<page_id>`.
5. For a non-empty `space_key`, `<space_key_segment>` is one deterministic
   single-segment encoding of that exact `space_key`, defined as `space__`
   followed by the uppercase hexadecimal encoding of the UTF-8 bytes of the
   exact `space_key` with no separators.
6. Within one run, identical non-empty `space_key` values map to the same
   `<space_key_segment>`, and different non-empty `space_key` values map to
   different `<space_key_segment>` values.
7. `<space_key_segment>` and `<page_folder>` each occupy exactly one filesystem
   path segment and do not contain path separators, `.` segments, or `..`
   segments.
8. This card defines the canonical relative payload-folder path for each
   persisted page, serialized with `/` path separators and no trailing slash.

**Dependencies**:
- `FR-0069`
- `FR-0127`

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
1. If the effective page payload format is `md`, a successfully materialized
   export page payload folder contains `page.md` and does not contain
   `page.html`.
2. If the effective page payload format is `html`, a successfully materialized
   export page payload folder contains `page.html` and does not contain
   `page.md`.
3. If the page has persisted attachments, the folder contains `attachments/`.
4. If `--keep-metadata` is in effect and metadata acquisition succeeded, the
   folder also contains `_info.txt` and `_storage.xml`.

**Dependencies**:
- `FR-0074`
- `FR-0075`
- `FR-0128`
- `FR-0028`
- `FR-0121`

**Traceability**:
- Area: output structure
- Observable evidence: file structure within export page payload folders

### FR-0081
**Requirement**: Plan page payload folders shall have a stable file structure
when metadata persistence is enabled.

**Applicability**:
- accepted `plan` runs

**Rationale**:
- Operators need predictable metadata persistence in planning mode without
  accidental content export.

**Acceptance Criteria**:
1. Without `--keep-metadata`, `plan` does not persist `page.md`, `page.html`,
   attachments, `_info.txt`, `_storage.xml`, or `_attachments_preview.txt`.
2. With `--keep-metadata` and successful metadata acquisition, a persisted plan
   page folder contains `_info.txt` and `_storage.xml`, and does not contain
   `page.md`, `page.html`, or downloaded attachment payload files.
3. With `--keep-metadata` and acquired attachment-preview data, the persisted
   plan page folder also contains `_attachments_preview.txt`.

**Dependencies**:
- `FR-0073`
- `FR-0028`

**Traceability**:
- Area: output structure
- Observable evidence: file structure within plan page payload folders

### FR-0082
**Requirement**: Top-level run artifacts shall have one stable functional
meaning.

**Applicability**:
- all runs that leave run artifacts on disk

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

**Dependencies**:
- `FR-0085`

**Traceability**:
- Area: output structure
- Observable evidence: stable artifact naming and interpretation

### FR-0083
**Requirement**: Successful encrypted runs shall create a deterministic
instruction sidecar derived from the logical plain output-root path.

**Applicability**:
- runs with successful encryption

**Rationale**:
- Operators need a deterministic instruction-sidecar path for decrypt and
  extract guidance.

**Acceptance Criteria**:
1. If encryption succeeds, the product creates `<out>.tar.gz.gpg.txt`.
2. That instruction sidecar is UTF-8 text with LF line endings.
3. The instruction sidecar contains exactly these four lines in this exact
   order:
   `archive_path=<quoted_path_string>`
   `decrypt_output_path=<quoted_path_string>`
   `decrypt_command=gpg --output <quoted_path_string> --decrypt <quoted_path_string>`
   `extract_command=tar -xzf <quoted_path_string>`.
4. In line 1, `<quoted_path_string>` is the absolute path to
   `<out>.tar.gz.gpg` serialized with the quoted path-string rules in
   `FR-0124`.
5. In lines 2 through 4, `<quoted_path_string>` is the absolute sibling path
   `<out>.tar.gz` serialized with the quoted path-string rules in `FR-0124`,
   except that the second quoted path string in line 3 is again the absolute
   path to `<out>.tar.gz.gpg`.
6. The instruction sidecar path is a sibling path derived by
   appending its suffix to the logical plain output-root path string and is not
   created outside that parent directory.

**Dependencies**:
- `FR-0107`
- `FR-0124`

**Traceability**:
- Area: output structure
- Observable evidence: instruction sidecar path and contents

### FR-0084
**Requirement**: Confidential-mode encryption failure shall create a
deterministic status sidecar derived from the logical plain output-root path.

**Applicability**:
- confidential-mode encryption failure

**Rationale**:
- Operators need a deterministic status-sidecar path that records
  confidential-mode encryption failure without leaving the plain output root
  behind.

**Acceptance Criteria**:
1. If confidential-mode encryption fails, the product creates `<out>.status.txt`.
2. `<out>.status.txt` is UTF-8 text with LF line endings and contains the line
   `final_status=encryption_failed`.
3. The status sidecar path is a sibling path derived by appending its suffix to
   the logical plain output-root path string and is not created outside that
   parent directory.

**Dependencies**:
- `FR-0110`

**Traceability**:
- Area: output structure
- Observable evidence: status sidecar path and contents

### FR-0128
**Requirement**: Failed per-page export materialization shall not leave
ambiguous partial payload artifacts in the final run result.

**Applicability**:
- accepted `export` runs

**Rationale**:
- Operators need retained export artifacts to show only successful payload
  materialization and successful attachment retention, not half-written files.

**Acceptance Criteria**:
1. If `page_payload` fails for a processed page, the final run result does not
   retain `page.md` or `page.html` for that page.
2. If `attachment_download` fails for a processed page, the final run result
   does not retain any attachment payload file for that page.
3. Cleanup required by criteria 1 or 2 does not remove other per-page artifacts
   for that page whose retention is still required elsewhere in the corpus.
4. If a processed page retains no per-page artifacts in the final run result
   after applying this cleanup, the product need not retain a payload folder for
   that page.

**Dependencies**:
- `FR-0074`
- `FR-0075`
- `FR-0086`
- `FR-0127`

**Traceability**:
- Area: output structure
- Observable evidence: retained page folders and files after page-local failure
