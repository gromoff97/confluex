# Report Requirements


### FR-0085
**Requirement**: Every retained run result that remains a report-set container
shall preserve one closed report-file set.

**Applicability**:
- plain output roots that remain on disk
- successfully created encrypted archives

**Rationale**:
- Operators need one standard report set to interpret any retained result.

**Acceptance Criteria**:
1. The closed report-file set is exactly `manifest.tsv`, `resolved-links.tsv`,
   `unresolved-links.tsv`, `failed-pages.tsv`, `scope-findings.tsv`, and
   `summary.txt`.
2. If a plain `export` output root remains on disk after a run, it retains that
   exact closed report-file set.
3. If a plain `plan` output root remains on disk after a run, it retains that
   exact closed report-file set.
4. If the final result is an encrypted artifact, extracting it yields that same
   exact closed report-file set inside the extracted top-level directory.
5. If a `plan` run removes its output root after interruption or runtime
   failure, the removed path does not retain a partial report set.

**Dependencies**:
- `FR-0107`
- `FR-0101`
- `FR-0102`

**Traceability**:
- Area: reports
- Observable evidence: presence or absence of the full report set

### FR-0086
**Requirement**: `manifest.tsv` shall use a stable schema and stable page
classification vocabulary.

**Applicability**:
- all report sets

**Rationale**:
- Operators and automation need one authoritative page inventory with stable
  structure and page classification.

**Acceptance Criteria**:
1. `manifest.tsv` is UTF-8 text with LF line endings and one header row.
2. The header row is exactly
   `page_id<TAB>space_key<TAB>page_title<TAB>folder<TAB>discovery_source<TAB>run_mode<TAB>attachment_count`.
3. `manifest.tsv` contains exactly one data row for each processed page.
4. Data rows are sorted first by `discovery_source` using the order `root`,
   `tree`, `linked`, then by ascending lexicographic order of the serialized
   `folder` value, with the shared absence token defined by `FR-0125` sorted
   before any relative path value, then by ascending lexicographic order of the
   serialized `page_id` value.
5. `folder` is the canonical relative payload-folder path defined by `FR-0079`
   when per-page artifacts for that page are retained in the final run result,
   whether in a plain output root or inside a retained encrypted archive;
   otherwise `folder` uses the shared absence token defined by `FR-0125`.
6. `run_mode` uses only `export` or `plan`.
7. `discovery_source` uses only `root`, `tree`, or `linked`.
8. `attachment_count` uses either a non-negative base-10 integer or the shared
   absence token defined by `FR-0125`.
9. Each manifest row's `discovery_source` value follows the classification rules
   in `FR-0068`.

**Dependencies**:
- `FR-0069`
- `FR-0079`
- `FR-0059`
- `FR-0068`
- `FR-0061`
- `FR-0073`
- `FR-0074`
- `FR-0075`
- `FR-0081`
- `FR-0107`
- `FR-0125`
- `FR-0127`
- `FR-0128`

**Traceability**:
- Area: reports
- Observable evidence: `manifest.tsv` header, rows, sort order, and values

### FR-0087
**Requirement**: `resolved-links.tsv` and `unresolved-links.tsv` shall use stable
link-report schemas.

**Applicability**:
- all report sets

**Rationale**:
- Operators need deterministic reporting of resolved and unresolved link
  outcomes.

**Acceptance Criteria**:
1. `resolved-links.tsv` is UTF-8 text with LF line endings and one header row.
2. The `resolved-links.tsv` header is exactly
   `source_page_id<TAB>source_title<TAB>link_kind<TAB>raw_link_value<TAB>target_page_id<TAB>target_space_key<TAB>target_title`.
3. `unresolved-links.tsv` is UTF-8 text with LF line endings and one header row.
4. The `unresolved-links.tsv` header is exactly
   `source_page_id<TAB>source_title<TAB>link_kind<TAB>raw_link_value<TAB>resolution_reason`.
5. `resolved-links.tsv` contains one row per resolved source-to-target link
   dependency.
6. `unresolved-links.tsv` contains one row per discovered link that remained
   unresolved.
7. `link_kind` uses only `child_result`, `content_id`, `page_ref`,
   `macro_param`, `href_page_id`, `href_space_title`, `ri_url_page_id`, or
   `ri_url_space_title`.
8. `resolution_reason` uses only `not_found`, `not_unique`, `candidate_limit`,
   or `insufficient_data`.

**Dependencies**:
- `FR-0063`
- `FR-0064`

**Traceability**:
- Area: reports
- Observable evidence: link report headers and row values

### FR-0088
**Requirement**: `failed-pages.tsv` shall use a stable schema for page-local
failures.

**Applicability**:
- all report sets

**Rationale**:
- Operators need one authoritative report of page-local failures.

**Acceptance Criteria**:
1. `failed-pages.tsv` is UTF-8 text with LF line endings and one header row.
2. The header row is exactly
   `page_id<TAB>page_title<TAB>operation<TAB>error_summary`.
3. `failed-pages.tsv` contains one row for each page-local failure.
4. `operation` uses only `page_metadata`, `storage_content`, `child_listing`,
   `title_resolution`, `attachment_preview`, `page_payload`, or
   `attachment_download`.
5. If a failed page-local operation cannot be attributed to a known page
   identifier or title at reporting time, the unavailable field value is the
   shared absence token defined by `FR-0125`.

**Dependencies**:
- `FR-0069`
- `FR-0070`
- `FR-0071`
- `FR-0072`
- `FR-0073`
- `FR-0074`
- `FR-0075`
- `FR-0125`

**Traceability**:
- Area: reports
- Observable evidence: failed-pages schema and operation values

### FR-0089
**Requirement**: `scope-findings.tsv` shall use a stable schema for scope and
support-profile findings.

**Applicability**:
- all report sets

**Rationale**:
- Operators need one authoritative report of findings that reduce confidence in
  scope completeness.

**Acceptance Criteria**:
1. `scope-findings.tsv` is UTF-8 text with LF line endings and one header row.
2. The header row is exactly
   `page_id<TAB>finding_area<TAB>finding_type<TAB>detail`.
3. `scope-findings.tsv` contains one row for each scope finding.
4. `finding_area` uses only `child_listing`, `storage_content`,
   `title_resolution`, or `unsupported_pattern`.
5. `finding_type` uses only `incomplete_tree`, `partial_listing`,
   `storage_unavailable`, `storage_uninterpretable`,
   `candidate_visibility_incomplete`, or `unsupported_internal_pattern`.
6. If a finding cannot be attributed to one page identity, the `page_id` value
   is the shared absence token defined by `FR-0125`.

**Dependencies**:
- `FR-0060`
- `FR-0066`
- `FR-0070`
- `FR-0071`
- `FR-0072`
- `FR-0125`

**Traceability**:
- Area: reports
- Observable evidence: scope-findings schema and controlled values

### FR-0090
**Requirement**: `summary.txt` shall use a stable machine-readable schema.

**Applicability**:
- all report sets

**Rationale**:
- Operators and automation need one deterministic summary contract.

**Acceptance Criteria**:
1. `summary.txt` is UTF-8 text with LF line endings and `key=value` lines.
2. `summary.txt` contains these keys exactly once each and in this exact order:
   `command`, `page_id`, `output_root`, `output_path_provenance`,
   `support_profile`, `page_payload_format`, `final_status`, `scope_trust`,
   `processed_pages`, `root_pages`, `tree_pages`, `linked_pages`, `other_pages`,
   `resolved_links`, `unresolved_links`, `scope_findings`,
   `failed_operations`, `downloaded_mib_total`,
   `downloaded_mib_content`, `downloaded_mib_metadata`,
   `blocking_reasons`, `interrupt_reason`, `resume_mode`,
   `resume_schema_version`, `reused_pages`, `fresh_pages`,
   `encryption_enabled`, and `encryption_successful`, and no additional keys.
3. Count keys use non-negative base-10 integers unless a more specific
   requirement defines decimal formatting.
4. Boolean-like keys use `0` or `1`.
5. Token-like keys use the shared absence token defined by `FR-0125` when no
   value applies unless a more specific requirement defines another value.

**Dependencies**:
- `FR-0113`
- `FR-0120`
- `FR-0121`
- `FR-0125`

**Traceability**:
- Area: reports
- Observable evidence: `summary.txt` key order and serialization

### FR-0091
**Requirement**: The required TSV reports shall preserve one-record-per-line
machine readability.

**Applicability**:
- all required `*.tsv` reports

**Rationale**:
- Operators and automation need deterministic TSV serialization without embedded
  control characters.

**Acceptance Criteria**:
1. Each header row and each data row in every required TSV report occupies
   exactly one physical line terminated by LF.
2. No serialized TSV field value contains TAB, LF, or CR.
3. Each required TSV data row contains exactly the same number of TAB-separated
   fields as its header row.
4. If a source value would otherwise contain TAB, LF, or CR, the product
   normalizes each such character to a single ASCII space before TSV
   serialization.

**Dependencies**:
- `FR-0086`
- `FR-0087`
- `FR-0088`
- `FR-0089`

**Traceability**:
- Area: reports
- Observable evidence: TSV row and field serialization

### FR-0092
**Requirement**: Summary and report counts shall remain arithmetically
consistent.

**Applicability**:
- all report sets

**Rationale**:
- Operators need summary counts that can be trusted against the report files.

**Acceptance Criteria**:
1. `processed_pages` equals the number of data rows in `manifest.tsv`.
2. `root_pages`, `tree_pages`, `linked_pages`, and `other_pages` equal the
   number of manifest rows in those categories; `other_pages` is `0` for all
   runs governed by the requirements corpus.
3. `resolved_links`, `unresolved_links`, `scope_findings`, and
   `failed_operations` equal the number of data rows in their corresponding
   report files.
4. `resume_mode=1` requires `processed_pages = reused_pages + fresh_pages`.

**Dependencies**:
- `FR-0086`
- `FR-0117`
- `FR-0127`
- `FR-0120`

**Traceability**:
- Area: reports
- Observable evidence: internal consistency between report files and summary

### FR-0093
**Requirement**: Required TSV reports shall use deterministic data-row ordering.

**Applicability**:
- all required `*.tsv` reports

**Rationale**:
- Operators and automation need repeated runs with the same report content to
  serialize rows in a predictable order.

**Acceptance Criteria**:
1. `manifest.tsv` data-row ordering is governed only by `FR-0086`.
2. In `resolved-links.tsv`, `unresolved-links.tsv`, `failed-pages.tsv`, and
   `scope-findings.tsv`, data rows are sorted in ascending bytewise
   lexicographic order of the complete serialized data row.
3. If a required TSV report has no data rows, the file still contains its
   header row and no data rows.

**Dependencies**:
- `FR-0086`
- `FR-0087`
- `FR-0088`
- `FR-0089`
- `FR-0091`

**Traceability**:
- Area: reports
- Observable evidence: deterministic data-row ordering and header-only empty
  reports
