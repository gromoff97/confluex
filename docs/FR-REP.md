# Report Requirements


### FR-0085
**Requirement**: Authoritative retained plain output roots and authoritative
retained encrypted archives shall preserve one closed report-file set.

**Applicability**:
- authoritative plain output roots that remain on disk
- authoritative encrypted archives retained as run artifacts

**Rationale**:
- Operators need one standard report set to interpret any retained result.

**Acceptance Criteria**:
1. In this corpus, a report-set container is only an authoritative retained
   plain output root that remains on disk or an authoritative retained
   encrypted archive selected as a retained run artifact.
2. The closed report-file set is exactly `manifest.tsv`, `resolved-links.tsv`,
   `unresolved-links.tsv`, `failed-pages.tsv`, `scope-findings.tsv`, and
   `summary.txt`.
3. When a report-set container is retained, its report-file members are exactly
   the closed report-file set from criterion 2.
4. When final-artifact selection under `FR-0058` retains an encrypted archive
   as the authoritative run artifact, extracting that archive yields one
   extracted top-level directory, and the report-file members inside that
   directory are exactly the closed report-file set from criterion 2.
5. No retained report-set container contains only a proper subset of the closed
   report-file set from criterion 2.
6. In exact report-header literals in this file, `<TAB>` denotes one literal
   horizontal tab byte `0x09` between adjacent field names.

**Dependencies**:
- `FR-0058`

**Traceability**:
- Area: reports
- Observable evidence: presence or absence of the full report set

### FR-0086
**Requirement**: `manifest.tsv` shall use a stable schema and stable page
classification vocabulary.

**Applicability**:
- all `export` and `plan` report sets

**Rationale**:
- Operators and automation need one authoritative page inventory with stable
  structure and page classification.

**Acceptance Criteria**:
1. `manifest.tsv` is UTF-8 text with LF line endings and one header row.
2. The header row is exactly
   `page_id<TAB>space_key<TAB>page_title<TAB>folder<TAB>discovery_source<TAB>run_mode<TAB>attachment_count`.
3. `manifest.tsv` contains exactly one data row for each processed page as
   defined by `FR-0127`.
4. Data rows are sorted first by `discovery_source` using the order `root`,
   `tree`, `linked`, then by ascending bytewise lexicographic order of the
   complete serialized `folder` field value, with the shared absence token
   governed by `FR-0125` and serialized here as the exact bare field value
   `none` sorted before any relative path value, then by ascending bytewise
   lexicographic order of the complete serialized `page_id` field value.
5. `folder` is the canonical relative payload-folder path defined by `FR-0079`
   when per-page artifacts for that page are retained in the final run result,
   whether in a plain output root or inside a retained encrypted archive;
   otherwise `folder` uses the shared absence token governed by `FR-0125`,
   serialized here as the exact bare field value `none`.
6. `run_mode` uses only `export` or `plan`.
7. `discovery_source` uses only `root`, `tree`, or `linked`.
8. `attachment_count` uses either a canonical non-negative integer governed by
   `FR-0014` or the shared absence token governed by `FR-0125`, serialized here
   as the exact bare field value `none`.
9. Each manifest row's `discovery_source` value follows the classification rules
   in `FR-0068`.
10. `page_id` is the processed page's canonical page identifier governed by
    `FR-0014`.
11. If `space_key` is known at reporting time, it is the processed page's exact
   space key after TSV field normalization from `FR-0091`; otherwise it uses the
   shared absence token governed by `FR-0125`, serialized here as the exact
   bare field value `none`.
12. If `page_title` is known at reporting time, it is the processed page's exact
   title after TSV field normalization from `FR-0091`; otherwise it uses the
   shared absence token governed by `FR-0125`, serialized here as the exact
   bare field value `none`.
13. If attachment count is determined for a processed page, `attachment_count` is
   that exact count serialized as a canonical non-negative integer governed by
   `FR-0014`, including `0` when the page is known to have no attachments.
14. `attachment_count` uses the shared absence token governed by `FR-0125`,
   serialized here as the exact bare field value `none`, only when attachment
   count is not determined for that processed page.
15. Source-derived manifest field values that would otherwise equal the shared
   absence token's exact text `none` after TSV field normalization are
   serialized using the escaped TSV value form defined by `FR-0091`.

**Dependencies**:
- `FR-0085`
- `FR-0069`
- `FR-0068`
- `FR-0079`
- `FR-0125`
- `FR-0014`
- `FR-0091`
- `FR-0127`

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
5. `resolved-links.tsv` contains one row per unique resolved-link tuple defined
   by criterion 19.
6. `unresolved-links.tsv` contains one row per unique unresolved-link tuple
   defined by criterion 20.
7. `link_kind` uses only `child_result`, `content_id`, `page_ref`,
   `macro_param`, `href_page_id`, `href_space_title`, `ri_url_page_id`, or
   `ri_url_space_title`.
8. `resolution_reason` uses only `not_found`, `not_unique`, `candidate_limit`,
   or `insufficient_data`.
9. `source_page_id` and `target_page_id` are canonical page identifiers governed
   by `FR-0014`.
10. `source_title` is the source page title acquired for the source page under
    `FR-0069` after TSV field normalization from `FR-0091`; if that title is
    not available, the field uses the shared absence token governed by
    `FR-0125`, serialized here as the exact bare field value `none`. A
    source-derived source-page title that would otherwise equal the shared
    absence token's exact text `none` after TSV field normalization is
    serialized using the escaped TSV value form defined by `FR-0091`.
11. In `resolved-links.tsv`, `target_title` is the target page title acquired
    for the resolved target page under `FR-0069` after TSV field normalization
    from `FR-0091`; if that title is not available, the field uses the shared
    absence token governed by `FR-0125`, serialized here as the exact bare
    field value `none`. A source-derived target-page title that would
    otherwise equal the shared absence token's exact text `none` after TSV
    field normalization is serialized using the escaped TSV value form defined
    by `FR-0091`.
12. In `resolved-links.tsv`, `target_space_key` is the target page's exact
    space key acquired for the resolved target page under `FR-0069` after TSV
    field normalization from `FR-0091`; if that space key is not available,
    the field uses the shared absence token governed by `FR-0125`, serialized
    here as the exact bare field value `none`. A source-derived target-page
    space key that would otherwise equal the shared absence token's exact text
    `none` after TSV field normalization is serialized using the escaped TSV
    value form defined by `FR-0091`.
13. `raw_link_value` is the normalized target-input serialization used for
    target resolution after source-specific decoding defined by `FR-0063` and
    TSV field normalization from `FR-0091`; the field name is historical and
    does not mean undecoded source markup.
14. For page-id link kinds `child_result`, `content_id`, `href_page_id`, and
    `ri_url_page_id`, `raw_link_value` is exactly `page_id:<page_id>`, where
    `<page_id>` is the source-derived target-resolution input from `FR-0063` and
    is not the canonical resolved page identifier unless that input already
    satisfies `FR-0014`.
15. For title-based link kinds `page_ref`, `macro_param`, `href_space_title`, and
    `ri_url_space_title`, `raw_link_value` is exactly
    `space_key_present=<space_key_present>;space_key_bytes=<space_key_byte_count>;space_key=<space_key_value>;title_bytes=<title_byte_count>;title=<title_value>`,
    where `<space_key_present>` is `1` when an explicit decoded space-key input
    exists and `0` otherwise, `<space_key_value>` is that explicit decoded
    space-key input after TSV field normalization when present and is the empty
    string when absent, and `<title_value>` is the decoded title input after TSV
    field normalization; an explicit space-key value exactly equal to `none` is
    serialized as data with `space_key_present=1`, not as absence.
16. In criterion 15, `<space_key_present>` uses only `0` or `1`;
    `<space_key_byte_count>` and `<title_byte_count>` are canonical
    non-negative integers governed by `FR-0014`; they equal the UTF-8 byte
    lengths of `<space_key_value>` and `<title_value>` respectively after TSV
    field normalization; when `<space_key_present>=0`,
    `<space_key_byte_count>` is exactly `0`; and when `<space_key_present>=1`,
    `<space_key_byte_count>` is greater than `0`.
17. In criterion 15, delimiter characters inside `<space_key_value>` or
    `<title_value>` are data, not separators; the byte counts from criterion 15
    determine where each value ends.
18. In `unresolved-links.tsv`, `source_page_id`, `source_title`, `link_kind`,
    and `raw_link_value` use the same field semantics as their corresponding
    `resolved-links.tsv` fields.
19. The resolved-link row identity tuple is `source_page_id`, `link_kind`,
    `raw_link_value`, and `target_page_id`.
20. The unresolved-link row identity tuple is `source_page_id`, `link_kind`,
    `raw_link_value`, and `resolution_reason`.
21. For one resolved-link row identity tuple from criterion 19, every
    conforming observation that has available `source_title`,
    `target_space_key`, and `target_title` yields the same values after
    criteria 10 through 18.
22. If duplicate resolved-link discoveries for one resolved-link row identity
    tuple from criterion 19 differ only because some observations lack
    `source_title`, `target_space_key`, or `target_title`, the retained row
    uses the available non-absence field value when one exists; otherwise the
    corresponding field uses the absence-token form required by criteria 10
    through 12.
23. For one unresolved-link row identity tuple from criterion 20, every
    conforming observation yields the same `source_title` after criteria 10
    and 18.
24. Duplicate resolved-link discoveries whose resolved-link row identity tuples
    are identical produce exactly one `resolved-links.tsv` row, and
    `resolved-links.tsv` data rows are sorted in ascending bytewise
    lexicographic order of the complete serialized data row after that
    deduplication.
25. Duplicate unresolved-link discoveries whose unresolved-link row identity
    tuples are identical produce exactly one `unresolved-links.tsv` row, and
    `unresolved-links.tsv` data rows are sorted in ascending bytewise
    lexicographic order of the complete serialized data row after that
    deduplication.
26. Each processed supported internal-link discovery under `FR-0063` whose
    `link_kind` is not `child_result` and whose target resolves under
    `FR-0064` and, for title-based link kinds, `FR-0072`, contributes exactly
    one resolved-link tuple before the deduplication from criteria 24 and 25.
    For that tuple, `source_page_id` is the source page's canonical page
    identifier, `link_kind` is the discovery's governed link kind,
    `raw_link_value` is the normalized target-input serialization governed by
    criteria 13 through 17 for that discovery, and `target_page_id` is the
    resolved target page's canonical page identifier.
27. Each recursive child-listing edge returned for a processed source page under
    `FR-0063` contributes one link-report tuple before the
    deduplication from criteria 24 and 25. If the returned child page identity
    includes a
    canonical page identifier, it contributes one resolved-link tuple:
   `source_page_id` is the source page's canonical page identifier,
   `link_kind` is `child_result`, `raw_link_value` is exactly
   `page_id:<target_page_id>`, and `target_page_id` is the returned child's
   canonical page identifier. Otherwise it contributes one unresolved-link
   tuple whose `source_page_id` is the source page's canonical page
   identifier, whose `link_kind` is `child_result`, whose `raw_link_value` is
   exactly `page_id:<target_page_id>` where `<target_page_id>` is the returned
   child page-id input from `FR-0063`, and whose
   `resolution_reason` is `insufficient_data`.

**Dependencies**:
- `FR-0085`
- `FR-0069`
- `FR-0063`
- `FR-0064`
- `FR-0072`
- `FR-0014`
- `FR-0091`
- `FR-0125`

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
3. In this corpus, a page-local failure is one page-scoped failure condition
   that another requirement explicitly requires to be recorded in
   `failed-pages.tsv`.
4. `failed-pages.tsv` contains one row for each unique page-local-failure row
   identity tuple defined by criterion 10 when criterion 9 defines a governed
   failure-page key, and one row for each page-local-failure observation whose
   criterion-6 `page_id` field is `none`, after the deterministic
   `error_summary` selection from criterion 11.
5. `operation` uses only `page_metadata`, `storage_content`, `child_listing`,
   `title_resolution`, `attachment_preview`, `page_payload`, or
   `attachment_download`.
6. If `page_id` is known at reporting time, it is the failed page's canonical
   page identifier governed by `FR-0014`; otherwise `page_id` uses the shared
   absence token governed by `FR-0125`, serialized here as the exact bare
   field value `none`.
7. If `page_title` is known at reporting time, it is the failed page's exact
   page title after TSV field normalization from `FR-0091`; otherwise
   `page_title` uses the shared absence token governed by `FR-0125`,
   serialized here as the exact bare field value `none`.
8. A source-derived `page_title` that would otherwise equal the shared absence
   token's exact text `none` after TSV field normalization is serialized using
   the escaped TSV value form defined by `FR-0091`.
9. For this card, one page-local-failure observation has a governed
   failure-page key only when its complete serialized `page_id` field value
   from criterion 6 is not `none`; that governed failure-page key is that same
   serialized `page_id` field value.
10. The page-local-failure row identity tuple is the governed failure-page key
    from criterion 9 and `operation`.
11. `error_summary` is a deterministic single TSV field chosen solely from
   `operation`: `page_metadata_failed`, `storage_content_failed`,
   `child_listing_failed`, `title_resolution_failed`,
   `attachment_preview_failed`, `page_payload_failed`, or
   `attachment_download_failed`.
12. For one criterion-10 identity tuple, every conforming observation yields the
    same criterion-11 `error_summary`.
13. If multiple page-local-failure observations share one criterion-10 identity
    tuple, exactly one data row is retained. Its `page_id` field is the unique
    non-`none` serialized `page_id` value from those observations.
14. If multiple page-local-failure observations share one criterion-10 identity
    tuple and one or more of those observations has `page_title` other than
    `none`, the retained row's `page_title` field is the ascending bytewise
    lexicographically smallest such serialized `page_title`; otherwise the
    retained row's `page_title` field is `none`.
15. Duplicate page-local-failure observations whose criterion-10 identity tuples
    are identical produce exactly one data row after the retained-field
    selection from criteria 13 and 14.
16. Each page-local-failure observation whose criterion-6 `page_id` field is
    `none` contributes one data row; criteria 13 through 15 do not collapse
    such observations even when their `page_title`, `operation`, and
    `error_summary` values are identical.
17. `failed-pages.tsv` data rows are sorted in ascending bytewise
    lexicographic order of the complete serialized data row after the
    retained-field selection and deduplication from criteria 13 through 16.

**Dependencies**:
- `FR-0085`
- `FR-0069`
- `FR-0070`
- `FR-0071`
- `FR-0072`
- `FR-0073`
- `FR-0074`
- `FR-0075`
- `FR-0014`
- `FR-0091`
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
3. In this corpus, a scope finding is one condition that another requirement
   explicitly requires to be recorded in `scope-findings.tsv`.
4. `scope-findings.tsv` contains one row for each unique scope-finding row
   identity tuple defined by criterion 12 after any source-derived `detail`
   normalization from criterion 11.
5. `finding_area` uses only `child_listing`, `storage_content`,
   `title_resolution`, `unsupported_pattern`, or `page_payload`.
6. `finding_type` uses only `incomplete_tree`, `partial_listing`,
   `storage_unavailable`, `storage_uninterpretable`,
   `candidate_visibility_incomplete`, `unsupported_internal_pattern`, or
   `markdown_remnant`.
7. Valid `(finding_area, finding_type)` pairs are exactly:
   `child_listing` with `incomplete_tree`,
   `child_listing` with `partial_listing`,
   `storage_content` with `storage_unavailable`,
   `storage_content` with `storage_uninterpretable`,
   `title_resolution` with `candidate_visibility_incomplete`,
   `unsupported_pattern` with `unsupported_internal_pattern`, and
   `page_payload` with `markdown_remnant`.
8. If a finding cannot be attributed to one page identity, the `page_id` value
   is the shared absence token governed by `FR-0125`, serialized here as the
   exact bare field value `none`.
9. If a finding can be attributed to one processed source page, `page_id` is that
   source page's canonical page identifier governed by `FR-0014`.
10. `detail` is one deterministic TSV field chosen solely from `finding_type`.
   For `storage_unavailable`, `detail` is exactly
   `storage_content_unavailable`. For `storage_uninterpretable`, `detail` is
   exactly `storage_content_uninterpretable`. For `partial_listing`, `detail`
   is exactly `child_listing_partial`. For `incomplete_tree`, `detail` is
   exactly `child_listing_incomplete`. For
   `candidate_visibility_incomplete`, `detail` is exactly
   `title_candidates_incomplete`. For `unsupported_internal_pattern`, `detail`
   is the source-derived value governed by `FR-0066`. For
   `markdown_remnant`, `detail` is the source-derived value governed by
   `FR-0074`.
11. If `detail` is source-derived for `unsupported_internal_pattern`, it is
    normalized using the TSV field normalization rules from `FR-0091` before
    criteria 4, 12, 13, and 14 are evaluated. If `detail` is source-derived for
    `markdown_remnant`, it is normalized using the TSV field normalization
    rules from `FR-0091` before criteria 4, 12, 13, and 14 are evaluated.
12. The scope-finding row identity tuple is `page_id`, `finding_area`,
    `finding_type`, and `detail`.
13. If multiple scope findings share one criterion-12 identity tuple, exactly
    one data row is retained for that tuple.
14. `scope-findings.tsv` data rows are sorted in ascending bytewise
    lexicographic order of the complete serialized data row after the
    normalization and deduplication from criteria 11 through 13.

**Dependencies**:
- `FR-0085`
- `FR-0066`
- `FR-0070`
- `FR-0071`
- `FR-0072`
- `FR-0074`
- `FR-0014`
- `FR-0091`
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
3. `summary.txt` contains exactly one physical `key=value` line for each key in
   criterion 2, in criterion 2 order.
4. Each physical line ends with LF, and `summary.txt` contains no empty lines,
   additional lines, duplicate physical lines for a key, or bytes outside those
   lines.
5. Each `key` is serialized exactly as named in criterion 2, immediately followed
   by ASCII `=`, then that key's value.
6. Count keys are exactly `processed_pages`, `root_pages`, `tree_pages`,
   `linked_pages`, `other_pages`, `resolved_links`, `unresolved_links`,
   `scope_findings`, `failed_operations`, `reused_pages`, and `fresh_pages`;
   these keys use canonical non-negative integers governed by `FR-0014`.
7. Boolean-like keys are exactly `resume_mode`, `encryption_enabled`, and
   `encryption_successful`; these keys use `0` or `1`.
8. Decimal MiB keys are exactly `downloaded_mib_total`,
   `downloaded_mib_content`, and `downloaded_mib_metadata`; their counting and
   serialization contract is governed exclusively by `FR-0120`.
9. `output_root` is a string-valued key whose complete run-specific value
   contract is governed exclusively by `FR-0119`.
10. `page_id` is a string-valued key whose complete run-specific value contract
    is governed exclusively by `FR-0119`.
11. Value contracts for `processed_pages`, `root_pages`, `tree_pages`,
    `linked_pages`, `other_pages`, `resolved_links`, `unresolved_links`,
    `scope_findings`, and `failed_operations` are governed exclusively by
    `FR-0092`.
12. Value contracts for `command`, `support_profile`, `page_payload_format`,
    `output_root`, `page_id`, `encryption_enabled`, and
    `encryption_successful` are governed exclusively by `FR-0119`.
13. Value contracts for `output_path_provenance`, `final_status`,
    `scope_trust`, `blocking_reasons`, `interrupt_reason`, `resume_mode`,
    `resume_schema_version`, `reused_pages`, and `fresh_pages` are governed
    exclusively by `FR-0115`, `FR-0113`, `FR-0114`, `FR-0116`, `FR-0140`, and
    `FR-0117`.
14. This card governs only `summary.txt` key presence, key order, physical line
    structure, and key-type partition; the value contracts delegated in
    criteria 8 through 13 are not redefined here.
15. This card does not govern the self-test `summary.txt` schema, which is
    defined separately by `FR-0182`.

**Dependencies**:
- `FR-0085`
- `FR-0113`
- `FR-0114`
- `FR-0115`
- `FR-0116`
- `FR-0117`
- `FR-0119`
- `FR-0120`
- `FR-0092`
- `FR-0014`
- `FR-0182`
- `FR-0140`

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
2. No serialized TSV field value contains any ASCII control character.
3. Each required TSV data row contains exactly the same number of TAB-separated
   fields as its header row.
4. If a source value would otherwise contain any ASCII control character, the
   product normalizes each such character to a single ASCII space before TSV
   serialization.
5. If a source-derived TSV field value after criterion 4 would equal the bare
   field value `none`, the serialized field value is the escaped TSV value form
   `\none`.
6. If a source-derived TSV field value after criterion 4 begins with ASCII
   backslash, the product prefixes one additional ASCII backslash before TSV
   serialization.
7. Criterion 6 is applied before criterion 5, so a literal source value `none`
   serializes as `\none` and a literal source value `\none` serializes as
   `\\none`.

**Dependencies**:
- `FR-0085`
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

**Dependencies**:
- `FR-0085`
- `FR-0087`
- `FR-0088`
- `FR-0089`
- `FR-0090`
- `FR-0086`

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
2. `resolved-links.tsv` and `unresolved-links.tsv` data-row ordering and
   duplicate semantics are governed only by `FR-0087`.
3. `failed-pages.tsv` data-row ordering and duplicate semantics are governed
   only by `FR-0088`.
4. `scope-findings.tsv` data-row ordering and duplicate semantics are governed
   only by `FR-0089`.
5. If a required TSV report has no data rows, the file still contains its
   header row and no data rows.

**Dependencies**:
- `FR-0085`
- `FR-0086`
- `FR-0087`
- `FR-0088`
- `FR-0089`
- `FR-0091`

**Traceability**:
- Area: reports
- Observable evidence: deterministic data-row ordering and header-only empty
  reports
