# Data Acquisition Requirements


### FR-0069
**Requirement**: The product shall acquire page metadata required for
black-box reporting.

**Applicability**:
- accepted `export` and `plan` runs

**Rationale**:
- Operators need page identifiers, titles, and space context in reports.

**Acceptance Criteria**:
1. For each processed page, the product acquires the data needed to report
   `page_id` and `page_title`.
2. When the page source provides a space key, the product acquires it as
   `space_key`.
3. If the page source does not provide a space key, the `space_key` field in
   `manifest.tsv` is serialized as an empty field.
4. If a page-local failure must be reported before page identity is known, the
   unavailable `page_id` and `page_title` field values are serialized as `none`.
5. If page-metadata acquisition for a page prevents the page's remaining
   required processing for the active command, the run records exactly one
   `failed-pages.tsv` row with `operation=page_metadata` for that condition.
6. If `--no-fail-fast` is not in effect, a `page_metadata` page-local failure
   stops further page processing after the failure is recorded.
7. If `--no-fail-fast` is in effect, a `page_metadata` page-local failure does
   not by itself prevent processing of later pages.

**Dependencies**:
- `FR-0085`
- `FR-0088`
- `FR-0095`
- `FR-0127`

**Traceability**:
- Area: data acquisition
- Observable evidence: manifest and failed-pages field population

### FR-0070
**Requirement**: The product shall acquire storage content required for
supported link discovery.

**Applicability**:
- accepted `export` and `plan` runs

**Rationale**:
- Supported internal-link discovery depends on page storage content.

**Acceptance Criteria**:
1. If a page is in scope, the product acquires that page's storage content for
   supported internal-link inspection.
2. If a storage-content problem affects supported-link inspection but does not
   prevent the page's remaining required processing for the active command, the
   run records exactly one `scope-findings.tsv` row with
   `finding_area=storage_content` and
   `finding_type=storage_unavailable`.
3. If storage content is acquired but cannot be interpreted well enough to
   complete supported-link inspection, and that interpretation problem does not
   prevent the page's remaining required processing for the active command, the
   run records exactly one `scope-findings.tsv` row with
   `finding_area=storage_content` and
   `finding_type=storage_uninterpretable`.
4. If storage-content acquisition or interpretation for a page prevents the
   page's remaining required processing for the active command, the run records
   exactly one `failed-pages.tsv` row with `operation=storage_content` for that
   condition and does not also record a scope-finding row for the same
   condition.
5. If `--no-fail-fast` is not in effect, a `storage_content` page-local failure
   stops further page processing after the failure is recorded.
6. If `--no-fail-fast` is in effect, a `storage_content` page-local failure
   does not by itself prevent processing of later pages.

**Dependencies**:
- `FR-0063`
- `FR-0088`
- `FR-0089`
- `FR-0095`
- `FR-0127`

**Traceability**:
- Area: data acquisition
- Observable evidence: link reports, scope-findings report, failed-pages report

### FR-0071
**Requirement**: The product shall acquire child-listing data required for
recursive root-tree traversal.

**Applicability**:
- accepted `export` and `plan` runs

**Rationale**:
- Recursive child traversal requires explicit child-listing data.

**Acceptance Criteria**:
1. If the run includes the root page, the product acquires child-listing data
   needed to discover descendants recursively.
2. If child-listing data is known to be partial or paginated for scope
   determination, the run records exactly one `scope-findings.tsv` row with
   `finding_area=child_listing` and `finding_type=partial_listing` for that
   condition.
3. If child-listing completeness cannot be established for any reason other
   than the known partial-or-paginated case in criterion 2, and tree coverage
   therefore remains incomplete, the run records exactly one
   `scope-findings.tsv` row with `finding_area=child_listing` and
   `finding_type=incomplete_tree` for that condition.
4. If child-listing acquisition or interpretation for a page prevents that
   page's remaining required processing for the active command, the run records
   exactly one `failed-pages.tsv` row with `operation=child_listing` for that
   condition.
5. If `--no-fail-fast` is not in effect, a `child_listing` page-local failure
   stops further page processing after the failure is recorded.
6. If `--no-fail-fast` is in effect, a `child_listing` page-local failure does
   not by itself prevent processing of later pages.

**Dependencies**:
- `FR-0060`
- `FR-0088`
- `FR-0089`
- `FR-0095`
- `FR-0127`

**Traceability**:
- Area: data acquisition
- Observable evidence: scope-findings report, child-tree coverage in manifest

### FR-0072
**Requirement**: The product shall acquire title-resolution candidate data when
title-based link resolution is attempted.

**Applicability**:
- accepted `export` and `plan` runs that attempt title-based resolution

**Rationale**:
- Conservative title resolution depends on visible candidate data.

**Acceptance Criteria**:
1. When title-based link resolution is attempted, the product acquires search
   results and candidate identity data for that attempt.
2. If `--max-find-candidates` prevents inspection of more candidates and unique
   resolution cannot be proven within that limit, the link is recorded in
   `unresolved-links.tsv` with `resolution_reason=candidate_limit`.
3. If candidate data is unavailable or incomplete for reasons other than the
   configured candidate limit and unique resolution therefore cannot be proven,
   the link is recorded in `unresolved-links.tsv` with
   `resolution_reason=insufficient_data`, and the run records exactly one
   `scope-findings.tsv` row with `finding_area=title_resolution` and
   `finding_type=candidate_visibility_incomplete` for that condition.
4. If title-resolution data acquisition or interpretation for a page prevents
   that page's remaining required processing for the active command, the run
   records exactly one `failed-pages.tsv` row with
   `operation=title_resolution` for that condition.
5. If `--no-fail-fast` is not in effect, a `title_resolution` page-local
   failure stops further page processing after the failure is recorded.
6. If `--no-fail-fast` is in effect, a `title_resolution` page-local failure
   does not by itself prevent processing of later pages.

**Dependencies**:
- `FR-0064`
- `FR-0087`
- `FR-0088`
- `FR-0089`
- `FR-0095`
- `FR-0127`

**Traceability**:
- Area: data acquisition
- Observable evidence: unresolved-links report, scope-findings report

### FR-0073
**Requirement**: `plan` shall acquire attachment-preview data without
downloading attachment payload files.

**Applicability**:
- accepted `plan` runs

**Rationale**:
- Planning requires attachment visibility without materializing attachment
  payloads.

**Acceptance Criteria**:
1. If a processed page has attachments, `plan` acquires enough attachment-preview
   data to determine `attachment_count` without downloading attachment payload
   files.
2. If attachment-preview acquisition for a processed page fails, the run records
   exactly one `failed-pages.tsv` row with `operation=attachment_preview` for
   that condition.
3. If a page's attachment-preview acquisition fails and that page still appears
   in `manifest.tsv`, that row serializes `attachment_count=none`.
4. If `--no-fail-fast` is not in effect, an `attachment_preview` page-local
   failure stops further page processing after the failure is recorded.
5. If `--no-fail-fast` is in effect, an `attachment_preview` page-local failure
   does not by itself prevent processing of later pages.
6. `plan` never persists attachment payload files.

**Dependencies**:
- `FR-0085`
- `FR-0095`
- `FR-0081`
- `FR-0127`

**Traceability**:
- Area: data acquisition
- Observable evidence: manifest attachment counts, failed-pages rows, absence of
  attachment payload files

### FR-0074
**Requirement**: `export` shall acquire and persist page payload in the
selected format.

**Applicability**:
- accepted `export` runs

**Rationale**:
- Materialized export requires persisted page content for successfully exported
  pages in the selected format.

**Acceptance Criteria**:
1. If a page is successfully materialized in `export` and the effective page
   payload format is `md`, the product persists `page.md` in that page's
   payload folder.
2. If a page is successfully materialized in `export` and the effective page
   payload format is `html`, the product persists `page.html` in that page's
   payload folder.
3. If page payload materialization for a page fails, the run records exactly
   one `failed-pages.tsv` row with `operation=page_payload` for that condition.
4. If `--no-fail-fast` is not in effect, a `page_payload` page-local failure
   stops further page processing after the failure is recorded.
5. If `--no-fail-fast` is in effect, a `page_payload` page-local failure does
   not by itself prevent processing of later pages.

**Dependencies**:
- `FR-0053`
- `FR-0095`
- `FR-0121`
- `FR-0080`
- `FR-0127`
- `FR-0128`

**Traceability**:
- Area: data acquisition
- Observable evidence: `page.md` or `page.html` presence, failed-pages report

### FR-0075
**Requirement**: `export` shall acquire and persist attachment payload files when
attachments are present.

**Applicability**:
- accepted `export` runs

**Rationale**:
- Materialized export requires attachment payloads for pages whose
  attachment-download work succeeds.

**Acceptance Criteria**:
1. If a processed page in `export` has attachments, the product acquires enough
   attachment data to determine `attachment_count` for that page unless
   attachment-download work fails before the count can be determined.
2. If attachment-download work succeeds for a processed page in `export`, the
   product persists that page's attachment payload files under that page's
   `attachments/` folder.
3. If a page still appears in `manifest.tsv` after attachment-download work for
   that page and the product did not determine `attachment_count`, that manifest
   row serializes `attachment_count=none`.
4. Each page-local attachment-download failure is recorded in
   `failed-pages.tsv` with `operation=attachment_download`.
5. If `--no-fail-fast` is not in effect, an `attachment_download` page-local
   failure stops further page processing after the failure is recorded.
6. If `--no-fail-fast` is in effect, an `attachment_download` page-local
   failure does not by itself prevent processing of later pages.
7. Persisted attachment payload files reside directly inside that page's
   `attachments/` folder and do not escape it.

**Dependencies**:
- `FR-0053`
- `FR-0095`
- `FR-0080`
- `FR-0086`
- `FR-0127`
- `FR-0128`

**Traceability**:
- Area: data acquisition
- Observable evidence: attachment files, failed-pages report
