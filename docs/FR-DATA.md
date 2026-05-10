# Data Acquisition Requirements


### FR-0069
**Requirement**: The product shall acquire page metadata required for
black-box reporting using the remote-access context defined by `FR-0216`.

**Applicability**:
- accepted `export` runs

**Rationale**:
- Operators need page identifiers, titles, and space context in reports.

**Acceptance Criteria**:
1. If a page is in scope, the product attempts page-metadata acquisition for
   that page using data sufficient to report that page's `page_id` and
   `page_title` when the acquisition succeeds. For this card, a page-local
   failure is one page-scoped failure condition that another requirement
   explicitly requires to be recorded in `failed-pages.tsv`.
2. A page that is not in scope and appears only as a resolved target page under
   `FR-0087` does not by itself require page-metadata acquisition under this
   card.
3. When page-metadata acquisition for an in-scope page provides a non-empty
   space key, the product acquires it as `space_key`.
4. If page-metadata acquisition for an in-scope page does not provide a space
   key or provides an empty space key, report fields that need that page's
   `space_key` use the shared absence token governed by `FR-0125` where their
   governing report schemas require an absence value.
5. If a `failed-pages.tsv` row must be reported before page identity is known,
   the unavailable `page_id` and `page_title` field values use the shared
   absence token governed by `FR-0125` as required by `FR-0088`.
6. If page-metadata acquisition for an in-scope page prevents that page's
   remaining required processing for the active command, the run records
   exactly one `failed-pages.tsv` row with `operation=page_metadata` for that
   condition; that row is a page-local failure under `FR-0088`.
7. If `--no-fail-fast` is not in effect, a `page_metadata` page-local failure
   stops further page processing after the failure is recorded.
8. If `--no-fail-fast` is in effect, a `page_metadata` page-local failure does
   not by itself prevent processing of later pages.

**Dependencies**:
- `FR-0060`
- `FR-0086`
- `FR-0088`
- `FR-0095`
- `FR-0125`
- `FR-0216`

**Traceability**:
- Area: data acquisition
- Observable evidence: manifest and failed-pages field population

### FR-0070
**Requirement**: The product shall acquire storage content required for
supported link discovery using the remote-access context defined by `FR-0216`.

**Applicability**:
- accepted `export` runs

**Rationale**:
- Supported internal-link discovery depends on page storage content.

**Acceptance Criteria**:
1. If a page is in scope, the product acquires that page's storage content for
   supported internal-link inspection.
2. If a storage-content problem blocks supported-link inspection but does not
   prevent the page's remaining required processing for the active command, the
   run records exactly one `scope-findings.tsv` row with
   `finding_area=storage_content` and
   `finding_type=storage_unavailable`.
3. If storage content is acquired but the product cannot extract the data
   needed to complete supported-link inspection from it, and that interpretation
   problem does not prevent the page's remaining required processing for the
   active command, the run records exactly one `scope-findings.tsv` row with
   `finding_area=storage_content` and `finding_type=storage_uninterpretable`.
4. For this card, a storage-content problem does not prevent the page's
   remaining required processing when the active command can still complete all
   required page work other than supported-link inspection for that page.
5. For this card, required page work other than supported-link inspection means
   page metadata acquisition, child-listing acquisition when required by
   recursive traversal, title-resolution candidate acquisition for already
   discovered title-based links, attachment-preview acquisition for `plan_only`
   execution mode, page payload materialization for `materialized` execution
   mode, and attachment-download work for `materialized` execution mode.
6. If storage-content acquisition or interpretation for a page prevents any
   active-command required page work from criterion 5 and no more-specific
   acquisition card records the same condition under a different
   `failed-pages.tsv` operation, the run records exactly one `failed-pages.tsv`
   row with `operation=storage_content` for that condition; that row is a
   page-local failure under `FR-0088`, and the run does not also record a
   scope-finding row for the same condition. For this card, the same condition
   means the same page and the same storage-content acquisition or
   interpretation failure instance during the current run.
7. If the same underlying condition from criterion 6 is recorded under a
   more-specific
   `failed-pages.tsv` operation from `FR-0069`, `FR-0071`, `FR-0072`, `FR-0073`,
   `FR-0074`, or `FR-0075`, this card does not require an additional
   `storage_content` failed-pages row.
8. If `--no-fail-fast` is not in effect, a `storage_content` page-local failure
   stops further page processing after the failure is recorded.
9. If `--no-fail-fast` is in effect, a `storage_content` page-local failure
   does not by itself prevent processing of later pages.

**Dependencies**:
- `FR-0069`
- `FR-0071`
- `FR-0072`
- `FR-0073`
- `FR-0074`
- `FR-0075`
- `FR-0087`
- `FR-0088`
- `FR-0089`
- `FR-0095`
- `FR-0216`

**Traceability**:
- Area: data acquisition
- Observable evidence: link reports, scope-findings report, failed-pages report

### FR-0071
**Requirement**: The product shall acquire child-listing data required for
recursive root-tree traversal using the remote-access context defined by
`FR-0216`.

**Applicability**:
- accepted `export` runs

**Rationale**:
- Recursive child traversal requires explicit child-listing data.

**Acceptance Criteria**:
1. If the run includes the root page, the product acquires child-listing data
   needed to discover descendants recursively.
2. For each processed source page discovered under recursive traversal whose
   descendants remain in scope under `FR-0060`, the product queries that
   page's child listing in turn unless a page-local failure or configured stop
   condition has already prevented that source page from reaching its
   child-listing step.
3. If criterion 2 is not satisfied for an in-scope source page because a
   page-local failure or configured stop condition prevents that source page
   from reaching its child-listing step while descendants remain in scope under
   `FR-0060`, the run records exactly one `scope-findings.tsv` row with
   `finding_area=child_listing` and `finding_type=incomplete_tree` for that
   source page.
4. For each processed source page whose descendants are queried, the
   child-listing result used for scope determination is the ordered sequence of
   child results returned for that source page by the child-listing operation
   together with three completeness indicators for that same source page:
   `continuation_locator`, `has_next_page`, and `listing_complete`. Each child
   result is either a `page` result exposing one child page identity or a
   `non_page` result exposing no child page identity.
5. The product preserves the criterion-4 sequence order when generating
   `child_result` discoveries for the `page` results of that source page; later
   cards that consume child-list discoveries use that preserved order.
6. A criterion-4 `non_page` result does not create a `child_result` discovery,
   does not add a page to scope, and does not by itself require a manifest,
   resolved-links, unresolved-links, scope-findings, or failed-pages row.
7. In criterion 4, `continuation_locator` is either the exact empty string or a
   non-empty source-returned token; `has_next_page` and `listing_complete` use
   only `0` or `1`; `listing_complete=1` means the child-listing operation
   explicitly indicates that no additional child results exist beyond the
   acquired criterion-4 sequence; and child-listing data is known to be partial
   or paginated only when `continuation_locator` is non-empty,
   `has_next_page=1`, or `listing_complete=0`.
8. If criterion 7 holds for any source page, the run records exactly one
   `scope-findings.tsv` row with `finding_area=child_listing` and
   `finding_type=partial_listing` for that condition.
9. If a criterion-4 `page` result exposes one child page identity whose returned
   page-id input from `FR-0063` does not satisfy `FR-0014`, the run records
   exactly one `scope-findings.tsv` row with `finding_area=child_listing` and
   `finding_type=incomplete_tree` for that source page and child-listing result
   instance.
10. If a `child_listing` page-local failure under criterion 11 occurs for any
   source page and criteria 3 and 7 do not describe that same condition, the run
   records exactly one `scope-findings.tsv` row with
   `finding_area=child_listing` and `finding_type=incomplete_tree` for that
   condition. For this card, the same condition means the same source page and
   the same child-listing result instance during the current run.
11. If child-listing acquisition or interpretation for a page prevents that
    page's remaining required processing for the active command, the run records
    exactly one `failed-pages.tsv` row with `operation=child_listing` for that
    condition; that row is a page-local failure under `FR-0088`.
12. If `--no-fail-fast` is not in effect, a `child_listing` page-local failure
    stops further page processing after the failure is recorded.
13. If `--no-fail-fast` is in effect, a `child_listing` page-local failure does
    not by itself prevent processing of later pages.

**Dependencies**:
- `FR-0014`
- `FR-0060`
- `FR-0063`
- `FR-0088`
- `FR-0089`
- `FR-0095`
- `FR-0216`

**Traceability**:
- Area: data acquisition
- Observable evidence: scope-findings report, child-tree coverage in manifest

### FR-0072
**Requirement**: The product shall acquire title-resolution candidate data when
title-based link resolution is attempted using the remote-access context
defined by `FR-0216`.

**Applicability**:
- accepted `export` runs that attempt title-based resolution

**Rationale**:
- Conservative title resolution depends on visible candidate data.

**Acceptance Criteria**:
1. When title-based link resolution is attempted, the product acquires a finite
   sequence of title-resolution candidate records together with
   `candidate_listing_complete` for that attempt; each acquired candidate
   record exposes exactly `candidate_title`,
   `candidate_space_key_present`, `candidate_space_key`, and
   `candidate_page_id` values for one candidate page identity.
   `candidate_space_key_present` uses only `0` or `1`. If
   `candidate_space_key_present=1`, `candidate_space_key` is the candidate
   page's exact non-empty space-key string. If
   `candidate_space_key_present=0`, `candidate_space_key` is exactly the empty
   string and candidate data omitted or could not determine a space key.
   `candidate_listing_complete` uses only `0` or `1`.
   `candidate_listing_complete=1` means the governed access result explicitly
   indicates that no additional candidate records exist for that attempt
   beyond the acquired sequence unless `--max-find-candidates` under
   `FR-0157` prevented further inspection. `candidate_listing_complete=0`
   means such completeness is not established.
2. A candidate matches the requested title only when the candidate title string
   equals the requested title input exactly after the source-specific decoding
   and surrounding-character removal rules defined by `FR-0063`; the product
   performs no additional character removal, case folding, or Unicode
   normalization for this comparison.
3. If the requested title-based target has an explicit space-key input, a
   candidate remains compatible only when `candidate_space_key_present=1` and
   the candidate space-key string equals that explicit space-key exactly after
   the source-specific decoding and surrounding-character removal rules defined
   by `FR-0063`.
4. If the requested title-based target has no explicit space-key input, the
   candidate space-key does not make the candidate incompatible.
5. Duplicate inspected candidates with the same page id count as one compatible
   target page identity.
6. Candidate inspection order is ascending bytewise lexicographic order of the
   tuple (`candidate_title`, `candidate_space_key_present`,
   `candidate_space_key`, `candidate_page_id`) after TSV field normalization
   from `FR-0091`, with `candidate_space_key_present=0` sorted before
   `candidate_space_key_present=1`.
7. If `candidate_listing_complete=1` and the configured candidate limit did not
   prevent further inspection and exactly one inspected title candidate remains
   compatible with the requested title-based target, the link resolves to that
   candidate's canonical page identity.
8. If `candidate_listing_complete=1` and the configured candidate limit did not
   prevent further inspection and all inspected title candidates fail to match
   the requested title-based target, the link is recorded in
   `unresolved-links.tsv` with `resolution_reason=not_found`.
9. If `candidate_listing_complete=1` and two or more inspected title
   candidates remain compatible with the requested title-based target and the
   configured candidate limit did not prevent further inspection, the link is
   recorded in `unresolved-links.tsv` with
   `resolution_reason=not_unique`.
10. If `--max-find-candidates` prevents inspection of more candidates and unique
    resolution cannot be proven within that limit, the link is recorded in
    `unresolved-links.tsv` with `resolution_reason=candidate_limit`.
11. If candidate data is unavailable, `candidate_listing_complete=0`, or the
    acquired candidate sequence cannot be interpreted for reasons other than the
    configured candidate limit and unique resolution therefore cannot be proven,
    the link is recorded in `unresolved-links.tsv` with
    `resolution_reason=insufficient_data`, and the run records exactly one
    `scope-findings.tsv` row with `finding_area=title_resolution` and
    `finding_type=candidate_visibility_incomplete` for that condition.
12. If title-resolution data acquisition or interpretation for a page prevents
    that page's remaining required processing for the active command, the run
    records exactly one `failed-pages.tsv` row with
    `operation=title_resolution` for that condition; that row is a page-local
    failure under `FR-0088`.
13. If `--no-fail-fast` is not in effect, a `title_resolution` page-local
    failure stops further page processing after the failure is recorded.
14. If `--no-fail-fast` is in effect, a `title_resolution` page-local failure
    does not by itself prevent processing of later pages.

**Dependencies**:
- `FR-0063`
- `FR-0064`
- `FR-0157`
- `FR-0087`
- `FR-0088`
- `FR-0089`
- `FR-0091`
- `FR-0095`
- `FR-0216`

**Traceability**:
- Area: data acquisition
- Observable evidence: unresolved-links report, scope-findings report

### FR-0073
**Requirement**: `plan_only` execution mode shall acquire attachment-preview
data without downloading attachment payload files using the remote-access
context defined by `FR-0216`.

**Applicability**:
- accepted `export --plan-only` runs

**Rationale**:
- Planning requires attachment visibility without materializing attachment
  payloads.

**Acceptance Criteria**:
1. If a processed page has attachments, `plan_only` execution mode acquires
   attachment-preview data needed to determine `attachment_count` without
   downloading attachment payload files.
2. If attachment-preview acquisition for a processed page fails, the run records
   exactly one `failed-pages.tsv` row with `operation=attachment_preview` for
   that condition; that row is a page-local failure under `FR-0088`.
3. If a page's attachment-preview acquisition fails and that page still appears
   in `manifest.tsv`, that row serializes `attachment_count` using the shared
   absence token governed by `FR-0125` as required by `FR-0086`.
4. If `--no-fail-fast` is not in effect, an `attachment_preview` page-local
   failure stops further page processing after the failure is recorded.
5. If `--no-fail-fast` is in effect, an `attachment_preview` page-local failure
   does not by itself prevent processing of later pages.
6. `plan_only` execution mode never persists attachment payload files.

**Dependencies**:
- `FR-0078`
- `FR-0081`
- `FR-0086`
- `FR-0088`
- `FR-0095`
- `FR-0125`
- `FR-0216`

**Traceability**:
- Area: data acquisition
- Observable evidence: manifest attachment counts, failed-pages rows, absence of
  attachment payload files

### FR-0074
**Requirement**: `export` shall persist the Markdown page representation
supplied for a processed page as `page.md`.

**Applicability**:
- accepted `export` runs

**Rationale**:
- Materialized export requires persisted page content for successfully exported
  pages, while Confluex owns persistence and failure reporting rather than
  Confluence rendering semantics.

**Acceptance Criteria**:
1. For this card, page representation means the complete UTF-8 Markdown text
   payload acquired after any Confluex-defined Markdown normalization and
   immediately before the product writes `page.md` for that page.
2. If a page is successfully materialized in `export`, the product acquires
   that page's Markdown
   representation through the product's Markdown payload converter, applies the
   Markdown localization and Markdown normalization governed by this card, and
   persists the resulting representation as `page.md` in that page's payload
   folder.
3. For successful page payload materialization, reading `page.md` as UTF-8
   yields exactly the page representation from criterion 1. The product does
   not otherwise define the semantic rendering of Confluence constructs inside
   `page.md`.
4. For this card, Markdown localization inspects only Markdown link nodes and
   Markdown image nodes in the converted Markdown representation. Fenced code
   blocks, inline code spans, and plain text that is not part of a Markdown
   link or image node are not rewritten by Markdown localization.
5. If one Markdown link or image destination denotes a supported internal page
   target for the source page whose unresolved-link result is recorded for that
   same source page, the persisted `page.md` replaces that link or image with
   one inline unresolved marker that uses exactly the text
   `[unresolved: page; reason=<reason>; target_hint=<hint>; value="<value>"]`
   where `<reason>` is exactly one of `not_found`, `not_unique`,
   `candidate_limit`, or `insufficient_data`, `<hint>` is exactly `page_id`,
   `title`, or `raw`, and `<value>` is the exact page-id, title value, or raw
   target value selected for that unresolved-link row.
6. If one Markdown link or image destination denotes a supported internal page
   target that resolves to one exported processed page under the run's
   resolved-link result for that same source page, the persisted `page.md`
   rewrites that destination to exactly one governed relative path from the
   source page payload folder to the target page payload file `page.md`. If the
   source destination contains a `#fragment`, the rewritten destination preserves
   that exact fragment suffix byte-for-byte after the localized relative path.
7. If one Markdown link or image destination is already one governed relative
   path of the exact form `attachments/<filename>` optionally followed by a
   `#fragment`, where `<filename>` is a valid retained attachment filename under
   `FR-0075`, the persisted `page.md` preserves that destination unchanged.
8. If one Markdown link or image destination has a scheme prefix whose
   lowercase scheme is `javascript`, `data`, `vbscript`, or `file`, the
   persisted `page.md` replaces that link or image with one inline neutralized
   marker that uses exactly the text
   `[neutralized: markdown_destination; reason=dangerous_scheme]`.
9. If one Markdown link or image destination is not an external URL with scheme
   `http`, `https`, or `mailto`, is not a governed attachment destination under
   criterion 7, and does not denote a supported internal page target under
   criteria 5 or 6, the persisted `page.md` replaces that link or image with
   one inline unsupported marker that uses exactly the text
   `[unsupported: markdown_destination; value="<value>"]`, where `<value>` is
   the destination value with backslash and double-quote characters escaped by
   one preceding backslash.
10. If one Markdown link or image destination does not satisfy criteria 5
    through 9, the persisted `page.md` preserves that destination unchanged.
    This includes external URLs and supported internal targets that were not
    materialized and do not have a source-page unresolved-link result.
11. Markdown normalization for `page.md` uses LF line endings, removes leading
    blank lines, removes trailing spaces and tabs, removes whitespace-only
    lines, collapses runs of more than two blank lines to two blank lines, and
    ensures exactly one final LF byte.
12. If normalized Markdown contains a storage-format or HTML remnant marker, the
    product persists the normalized Markdown payload and records exactly one
    `scope-findings.tsv` row for each unique remnant diagnostic under
    `FR-0089`. The row uses
    `finding_area=page_payload`, `finding_type=markdown_remnant`, and a
    `detail` field with exactly
    `markdown_remnant_kind=<kind>;token=<token>`. Storage remnant markers are
    the exact case-sensitive strings `<ac:` and `<ri:`; their `<kind>` value
    is `storage_format_remnant`, and `<token>` is the exact marker string.
    HTML remnant markers are the exact case-sensitive strings `<p`, `</p>`,
    `<table`, `</table>`, `<tr`, `</tr>`, `<td`, `</td>`, `<th`, `</th>`,
    `<div`, `</div>`, `<span`, `</span>`, and `<img`; their `<kind>` value is
    `html_remnant`, and `<token>` is the exact marker string. This condition is
    not a page-local payload failure by itself.
11. If page payload materialization for a page fails, the run records exactly
   one `failed-pages.tsv` row with `operation=page_payload` for that condition;
   that row is a page-local failure under `FR-0088`.
12. If `--no-fail-fast` is not in effect, a `page_payload` page-local failure
    stops further page processing after the failure is recorded.
13. If `--no-fail-fast` is in effect, a `page_payload` page-local failure does
    not by itself prevent processing of later pages.

**Dependencies**:
- `FR-0079`
- `FR-0080`
- `FR-0075`
- `FR-0088`
- `FR-0089`
- `FR-0091`
- `FR-0095`
- `FR-0121`

**Traceability**:
- Area: data acquisition
- Observable evidence: `page.md` presence, failed-pages report

### FR-0075
**Requirement**: `export` shall acquire and persist attachment payload files
when attachments are present using the remote-access context defined by
`FR-0216`.

**Applicability**:
- accepted `export` runs

**Rationale**:
- Materialized export requires attachment payloads for pages whose
  attachment-download work succeeds.

**Acceptance Criteria**:
1. If a processed page in `export` has attachments, the product acquires
   exactly one per-page attachment-data acquisition result for that page before
   any attachment payload download for that page begins, unless
   attachment-download work fails before that acquisition result is obtained.
2. For this corpus, the criterion-1 per-page attachment-data acquisition result
   is the `attachment data needed to determine attachment_count` referenced by
   `FR-0034` and `FR-0120`: it is the finite sequence of attachment items for
   that page whose source metadata is sufficient to determine the page's
   `attachment_count`, each item's source filename, media type when source
   metadata exposes one, governed download target, and whether that item's
   payload download can be attempted.
3. If the criterion-1 attachment-data acquisition succeeds for a processed page,
   `attachment_count` for that page is the exact number of attachment items in
   that acquired sequence.
4. If attachment-download work succeeds for a processed page in `export`, the
   product persists that page's attachment payload files under that page's
   `attachments/` folder.
5. A valid retained attachment filename is a UTF-8 string whose byte length is
   from `1` through `255`, whose characters are only ASCII letters, ASCII
   digits, `.`, `_`, and `-`, whose complete value is neither `.` nor `..`,
   whose final byte is not `.`, and whose basename before the first `.` does
   not equal, under ASCII case-insensitive comparison, any of `CON`, `PRN`,
   `AUX`, `NUL`, `COM1`, `COM2`, `COM3`, `COM4`, `COM5`, `COM6`, `COM7`,
   `COM8`, `COM9`, `LPT1`, `LPT2`, `LPT3`, `LPT4`, `LPT5`, `LPT6`, `LPT7`,
   `LPT8`, or `LPT9`.
6. For each successfully downloaded attachment payload file whose attachment
   source filename is valid under criterion 5 and is unique among retained
   attachment payload filenames for that page under ASCII case-insensitive
   comparison, the retained file under `attachments/` has that filename and its
   byte content is exactly the downloaded attachment payload.
7. If an attachment source filename is invalid under criterion 5 or if two or
   more attachment source items for the same page have the same source filename
   under the criterion 6 comparison, attachment-download work for that page fails
   before downloading any invalid or duplicate-named attachment payload bytes;
   final attachment payload retention for that page after the failure is governed
   by `FR-0128`.
8. For each attachment item whose payload download can be attempted, the
   attachment metadata exposes a governed Confluence download target under
   `FR-0216` with no scheme, no authority, no userinfo, no fragment, an absolute
   path beginning with `/`, and an optional query string.
9. If an attachment metadata item exposes an invalid download target under
   criterion 8, attachment-download work for that page fails before downloading
   any payload bytes for that invalid item.
10. Active attachment content is any attachment item whose media type is one of
    `text/html`, `image/svg+xml`, `application/xhtml+xml`, `text/javascript`,
    `application/javascript`, `text/ecmascript`, or `application/ecmascript`,
    or whose filename extension under ASCII case-insensitive comparison is one
    of `.html`, `.htm`, `.svg`, `.js`, `.mjs`, or `.xhtml`.
11. If an attachment item is active attachment content under criterion 10,
    attachment-download work for that page fails before downloading any payload
    bytes for that active item.
12. Attachment payload requests are constructed by applying the configured
    Confluence base URL path-prefix rules from `FR-0216` to the governed
    download target; a leading slash in source metadata does not strip the
    configured context path.
13. The product sends the Confluence Authorization field for attachment payload
    requests only to URLs satisfying the governed request target and transport
    rules in `FR-0216` and `FR-0251`.
14. Attachment payload downloads are streamed with bounded memory, and no
    partial attachment file is retained when a stream fails or is stopped by the
    max-download limit.
15. If the criterion-1 attachment-data acquisition fails before `attachment_count`
   is determined for a page, attachment-download work for that page fails before
   any attachment payload download for that page begins.
16. If a page still appears in `manifest.tsv` after attachment-download work for
   that page and the product did not determine `attachment_count`, that
   manifest row serializes `attachment_count` using the shared absence token
   governed by `FR-0125` as required by `FR-0086`.
17. Each page-local attachment-download failure is recorded in
   `failed-pages.tsv` with `operation=attachment_download`; that row is a
   page-local failure under `FR-0088`.
18. Attachment-download failures are reported per processed page: one or more
   failed attachment metadata or payload items for the same page produce exactly
   one `attachment_download` failed-pages row for that page.
19. When multiple attachment failures for one page are collapsed into one row, the
   row's `error_summary` remains the explanatory field governed by `FR-0088` and
   is not required to enumerate every failed attachment.
20. If `--no-fail-fast` is not in effect, an `attachment_download` page-local
   failure stops further page processing after the failure is recorded.
21. If `--no-fail-fast` is in effect, an `attachment_download` page-local
   failure does not by itself prevent processing of later pages.
22. When an `attachments/` folder is retained for a page, it contains exactly the
   retained attachment payload files for that page and no other entries.
23. Persisted attachment payload files reside directly inside that page's
   `attachments/` folder and do not escape it.

**Dependencies**:
- `FR-0034`
- `FR-0080`
- `FR-0086`
- `FR-0088`
- `FR-0095`
- `FR-0120`
- `FR-0125`
- `FR-0128`
- `FR-0216`
- `FR-0251`

**Traceability**:
- Area: data acquisition
- Observable evidence: attachment files, failed-pages report
