# Scope Discovery Requirements


### FR-0059
**Requirement**: Successful root-page preflight shall always place the root page
in scope.

**Applicability**:
- accepted `export` and `plan` runs

**Rationale**:
- Operators need the selected root page to remain part of the run scope even if
  later work is degraded.

**Acceptance Criteria**:
1. In this corpus, a page is in scope for a run if and only if the run has
   determined that the page belongs to the active command's required page set
   because the page is the resolved root page or is later added under
   `FR-0060` or `FR-0061`.
2. After successful root-page preflight, the resolved root page is in scope.
3. A page can be in scope even if it never reaches processed-page status under
   `FR-0127`.
4. Later traversal or processing failure does not retroactively remove a page
   from scope once it has entered scope under criteria 1 and 2.

**Dependencies**:
- `FR-0017`
- `FR-0060`
- `FR-0061`
- `FR-0127`

**Traceability**:
- Area: scope discovery
- Observable evidence: manifest and summary interpretation

### FR-0060
**Requirement**: The run shall add recursive child-tree pages to scope only when
recursive child traversal is selected.

**Applicability**:
- accepted `export` and `plan` runs

**Rationale**:
- Operators need default runs to remain focused on the selected root page and
  supported internal links, while still being able to request the full child
  hierarchy explicitly.

**Acceptance Criteria**:
1. If recursive child traversal is selected under `FR-0234`, any page that the
   run determines is a descendant of the root page through recursive child
   traversal is added to scope.
2. If recursive child traversal is not selected under `FR-0234`, no page is
   added to scope because it is a descendant of the root page.
3. If recursive child traversal is not selected under `FR-0234`, the run does
   not perform child-listing acquisition for recursive child traversal.
4. If recursive child traversal is selected and recursive child knowledge is
   incomplete, the run records the applicable `child_listing` scope-finding row
   defined by `FR-0071` rather than silently treating the child tree as complete.
5. If recursive child traversal is selected and recursive child knowledge is
   incomplete, the run has not proved the full descendant set for `FR-0060`;
   undiscovered descendants are therefore not silently treated as out of scope
   or as proven absent.

**Dependencies**:
- `FR-0071`
- `FR-0234`

**Traceability**:
- Area: scope discovery
- Observable evidence: manifest, resolved-links report, scope-findings report

### FR-0061
**Requirement**: The run scope shall include linked pages discovered from
eligible page content through supported internal-link forms up to the effective
link-depth.

**Applicability**:
- accepted `export` and `plan` runs

**Rationale**:
- Operators need the export scope to include supported internal page references
  from pages already in scope and explicitly bounded linked-page content.

**Acceptance Criteria**:
1. A page that is in scope through `FR-0059` or `FR-0060` has source
   link-depth `0`.
2. If a supported internal link in a page whose source link-depth is less than
   the effective link-depth resolves to one unique target page, that target page
   is added to scope.
3. A target page added to scope by criterion 2 has source link-depth equal to
   the source page's link-depth plus `1`.
4. If the same linked page is discovered from multiple sources, the target page
   still appears only once in scope.

**Dependencies**:
- `FR-0059`
- `FR-0063`
- `FR-0071`
- `FR-0064`
- `FR-0072`
- `FR-0218`

**Traceability**:
- Area: scope discovery
- Observable evidence: manifest rows for linked pages

### FR-0062
**Requirement**: Link-driven scope expansion shall be bounded by the effective
link-depth.

**Applicability**:
- accepted `export` and `plan` runs

**Rationale**:
- Operators need bounded linked-page expansion rather than uncontrolled graph
  traversal.

**Acceptance Criteria**:
1. A page added to scope only because it was linked from another page does not
   add its own descendants solely because it is in scope.
2. Links found while processing a page whose source link-depth is greater than
   or equal to the effective link-depth do not expand scope further.
3. When the effective link-depth is `0`, supported internal links from page
   storage do not add linked pages to scope.

**Dependencies**:
- `FR-0061`
- `FR-0218`

**Traceability**:
- Area: scope discovery
- Observable evidence: bounded scope contents in manifest and link reports

### FR-0063
**Requirement**: The product shall support only documented internal-link forms
for link-driven scope expansion.

**Applicability**:
- accepted `export` and `plan` runs

**Rationale**:
- Operators need a bounded, explicit support profile rather than implicit claims
  of universal Confluence-markup support.

**Acceptance Criteria**:
1. Supported discovery forms are exactly:
   `child_result`, `content_id`, `page_ref`, `macro_param`, `href_page_id`,
   `href_space_title`, `ri_url_page_id`, and `ri_url_space_title`.
2. `child_result` is a page identity returned by the recursive child-listing
   operation for any processed source page; its target-resolution input is the
   returned page id, and resolved-link row generation plus report-field
   serialization for that discovery form are governed by `FR-0087`.
3. `content_id` is a Confluence storage element `<ri:content-entity>` or
   `<ri:page>` whose attributes include `ri:content-id="<decimal_digits>"`;
   its target-resolution input is that decimal page id.
4. `page_ref` is a Confluence storage element `<ri:page>` with
   `ri:content-title="<title>"` and without `ri:content-id`; its
   target-resolution inputs are the optional `ri:space-key` value and the
   `ri:content-title` value.
5. `macro_param` is a Confluence storage element `<ac:parameter ac:name="page">`
   whose text body after XML entity decoding and removing leading and trailing
   code points from the whitespace trim set in criterion 32 is `<target_text>`;
   when `<target_text>` contains an ASCII colon and the substring before the
   first ASCII colon contains one or more characters chosen only from uppercase
   ASCII letters, ASCII digits, `_`, `.`, and `-`, and the substring after the
   first ASCII colon contains at least one code point after removing leading and
   trailing code points from the whitespace trim set in criterion 32, the
   substring before the first ASCII colon is the explicit `<space_key>` input and
   the trimmed substring after the first ASCII colon is the `<title>` input;
   otherwise there is no explicit `<space_key>` input and the entire
   `<target_text>` is the `<title>` input.
6. `macro_param` does not perform URL decoding: ASCII `%` sequences and ASCII
   `+` in `<target_text>` remain literal title or space-key characters after
   XML entity decoding.
7. `href_page_id` is an `href` attribute whose value is a relative Confluence
   URL containing `pageId=<decimal_digits>` or `/pages/<decimal_digits>`; its
   target-resolution input is that decimal page id.
8. `href_space_title` is an `href` attribute whose value is a relative
   Confluence URL containing either `/display/<space_key>/<title_segment>` or a
   `title=<title>` query parameter with an optional `spaceKey=<space_key>`
   query parameter; its target-resolution inputs are `<space_key>` when present
   and the decoded title value.
9. `ri_url_page_id` is an `<ri:url ri:value="...">` value using the same
   page-id URL forms as `href_page_id`.
10. `ri_url_space_title` is an `<ri:url ri:value="...">` value using the same
   space/title URL forms as `href_space_title`.
11. `<decimal_digits>` is one or more ASCII digits.
12. Absolute URLs and scheme-relative URLs do not match any supported discovery
   form.
13. For `href_space_title` and `ri_url_space_title`, the URL value is interpreted
   by the corpus-local relative URL rules in criterion 15 only after criterion 12
   excludes absolute and scheme-relative URLs.
14. For criteria 12 and 13, an absolute URL is any URL value whose first
   non-empty prefix before an ASCII colon matches an ASCII scheme name beginning
   with an ASCII letter and then containing only ASCII letters, ASCII digits,
   `+`, `.`, or `-`; a scheme-relative URL begins with `//`.
15. Corpus-local relative URL parsing uses no external URL parser: the fragment
   component is the substring after the first ASCII `#` and is ignored; before
   that fragment, the query component is the substring after the first ASCII `?`
   or empty when no ASCII `?` is present; the path component is the substring
   before that first ASCII `?` or, when no query exists, before the ignored
   fragment. No dot-segment removal, case folding, host parsing, backslash
   conversion, percent-decoding, or other URL normalization occurs before
   criteria 16 through 27.
16. Query-parameter order is the left-to-right order of name/value pairs in the
   parsed URL query before percent-decoding, split only on ASCII `&`; ASCII `;`
   has no delimiter role. For each split part, the first ASCII `=` separates the
   parameter name from the value, later ASCII `=` characters remain in the value,
   and a part without ASCII `=` has an empty value. Parameter names are matched
   case-sensitively before percent-decoding against exactly `pageId`, `title`,
   and `spaceKey`; an empty name or percent-encoded spelling of a parameter name
   does not match those names.
17. Path-segment order is the left-to-right order of parsed URL path segments
   after removing empty segments created by repeated `/`.
18. A single `href` or `ri:value` URL value emits at most one supported discovery
   link row.
19. Page-id URL forms take precedence over space/title URL forms for the same URL
   value.
20. If one or more `pageId` query parameters whose raw value before
   percent-decoding is `<decimal_digits>` are present, the first such query
   parameter in URL order supplies the `href_page_id` or `ri_url_page_id`
   target-resolution input.
21. If criterion 20 does not apply and the URL path contains one or more
   `/pages/<decimal_digits>` segments, the first such path segment in path order
   supplies the `href_page_id` or `ri_url_page_id` target-resolution input.
22. Space/title URL forms are considered only when neither criterion 20 nor
   criterion 21 applies.
23. For space/title URL forms, `/display/<space_key>/<title_segment>` takes
   precedence over query-parameter title forms for the same URL value.
24. For `/display/<space_key>/<title_segment>`, `<space_key>` is the path
   segment immediately after `/display/`, `<title_segment>` is the path segment
   immediately after that space-key segment, and the path contains no additional
   non-empty segment after `<title_segment>`.
25. For query-parameter title forms, the title input is the first `title`
   query-parameter value, and the optional explicit space-key input is the first
   `spaceKey` query-parameter value when present.
26. The decoded title value for criteria 8 and 10 is produced by replacing
   ASCII `+` with ASCII space, applying the percent-decoding rules in criterion
   33, and removing leading and trailing code points from the whitespace trim set
   in criterion 32.
27. The decoded space-key value for criteria 8 and 10 is produced by applying the
   percent-decoding rules in criterion 33 and removing leading and trailing code
   points from the whitespace trim set in criterion 32.
28. For supported space/title URL forms, the decoded title value must be
   non-empty after criterion 26, and an explicit decoded space-key value, when
   present, must be non-empty after criterion 27.
29. If criterion 28 is not satisfied, storage-content interpretation fails under
   `FR-0070` rather than emitting a supported-link row for that URL value.
30. If percent-decoding required by criteria 26 or 27 fails because of a
   malformed percent escape or invalid UTF-8 octet sequence, storage-content
   interpretation fails under `FR-0070` rather than emitting a supported-link
   row for that URL value.
31. Link forms outside that documented set do not count as supported discovery
   forms.
32. The whitespace trim set for this card is exactly: `U+0009`, `U+000A`,
   `U+000B`, `U+000C`, `U+000D`, `U+0020`, `U+0085`, `U+00A0`, `U+1680`,
   `U+2000`, `U+2001`, `U+2002`, `U+2003`, `U+2004`, `U+2005`, `U+2006`,
   `U+2007`, `U+2008`, `U+2009`, `U+200A`, `U+2028`, `U+2029`, `U+202F`,
   `U+205F`, and `U+3000`.
33. Percent-decoding for this card scans the input left to right, emits one byte
   for each `%HH` triplet where `H` is an ASCII hexadecimal digit accepted
   case-insensitively, emits the UTF-8 bytes of every non-`%` character
   unchanged, and decodes the resulting byte sequence as UTF-8; a `%` not
   followed by two ASCII hexadecimal digits or an invalid UTF-8 byte sequence is
   a percent-decoding failure.
34. Storage-content interpretation for criteria 3 through 10 uses this
   corpus-local XML fragment model: element and attribute names are matched by
   exact qualified-name text such as `ri:page`, `ri:content-id`,
   `ac:parameter`, and `ac:name`; namespace declarations do not alter those
   qualified names for matching purposes.
35. In the storage XML model from criterion 34, comments and processing
   instructions are ignored; CDATA sections contribute their character content to
   text bodies; predefined XML entities `amp`, `lt`, `gt`, `quot`, and `apos`
   and numeric character references are decoded; DTD declarations, external
   entities, and custom entity declarations are not processed.
36. If storage content is not well-formed under the model from criteria 34 and 35,
   contains a disallowed entity or declaration, contains duplicate attributes on
   one element, or cannot be decoded as UTF-8 before XML interpretation, storage
   content interpretation fails under `FR-0070` rather than emitting supported
   discovery rows from that storage content.

**Dependencies**:
- `FR-0070`
- `FR-0087`

**Traceability**:
- Area: scope discovery
- Observable evidence: supported-link-form diagnostics, link resolution outcomes

### FR-0064
**Requirement**: Link resolution shall be conservative and prefer unresolved
outcomes over guessed outcomes.

**Applicability**:
- accepted `export` and `plan` runs

**Rationale**:
- Operators need the product to avoid inventing page relationships it cannot
  justify.

**Acceptance Criteria**:
1. A discovered internal link is resolved only when it can be mapped to one
   unique target page identity.
2. If a discovered internal link does not resolve to one unique target page
   identity, it remains unresolved.
3. If title-candidate inspection is limited by `--max-find-candidates` and a
   unique target cannot be proven within that limit, the link remains
   unresolved.
4. For `child_result` links, the target page identity is the page identity
   returned by the recursive child-listing operation; if that returned identity
   lacks a canonical decimal page id, the link remains unresolved with
   `resolution_reason=insufficient_data`, the target is not appended to the
   discovery queue, and the run records the applicable `child_listing`
   `incomplete_tree` scope-finding row governed by `FR-0071`.
5. For `content_id`, `href_page_id`, and `ri_url_page_id` links, target
   resolution performs exactly one invocation-local page-id lookup using the
   remote-access context governed by `FR-0216` for exactly the decimal page id
   supplied by the supported discovery form from `FR-0063`.
6. For this corpus, the criterion-5 page-id lookup is the `page-id lookup`
   byte-contributing operation referenced by `FR-0034` and the `page-id lookup
   data` acquisition referenced by `FR-0120`. Its authoritative acquisition
   result for the current attempt is a finite sequence of source lookup records
   together with `lookup_complete`.
7. `lookup_complete` uses only `0` or `1`. `lookup_complete=1` means the
   governed access result explicitly indicates that no additional lookup
   records exist for the exact page-id input beyond the acquired sequence.
   `lookup_complete=0` means that such completeness is not established.
8. The acquired lookup result from criteria 6 and 7 is interpreted only as the
   finite sequence of source lookup records from criterion 6. Each
   interpretable lookup record exposes exactly one `candidate_page_id` value;
   that value is the candidate page identity's canonical decimal page id; and
   no other source-returned field or payload content participates in
   compatibility or uniqueness under this card.
9. Two compatible interpretable lookup records from criterion 8 count as one
   compatible lookup record only when their `candidate_page_id` values are
   identical; otherwise they remain distinct compatible lookup records.
10. An interpretable lookup record from criterion 8 is compatible only when
   `candidate_page_id` equals the lookup input from criterion 5 exactly.
11. The page-id lookup from criterion 5 resolves only when
    `lookup_complete=1` and exactly one compatible lookup record remains under
    criteria 8 through 10.
12. If `lookup_complete=1` and the lookup from criterion 5 yields no compatible
    interpretable lookup record, the link remains unresolved with
    `resolution_reason=not_found`.
13. If `lookup_complete=1` and the lookup from criterion 5 yields two or more
    distinct compatible lookup records after criterion 9, the link remains
    unresolved with `resolution_reason=not_unique`.
14. If the lookup from criterion 5 cannot determine whether exactly one
    compatible interpretable lookup record exists because the source response is
    unavailable, `lookup_complete=0`, or the acquired lookup sequence cannot be
    interpreted under criteria 6 through 10, the link remains unresolved with
    `resolution_reason=insufficient_data`.
15. An unresolved page-id link target is not appended to the discovery queue.

**Dependencies**:
- `FR-0014`
- `FR-0034`
- `FR-0063`
- `FR-0071`
- `FR-0087`
- `FR-0120`
- `FR-0157`
- `FR-0216`

**Traceability**:
- Area: scope discovery
- Observable evidence: resolved-links and unresolved-links reports

### FR-0065
**Requirement**: Run-scope expansion shall use only supported internal link
discovery forms.

**Applicability**:
- accepted `export` and `plan` runs

**Rationale**:
- Operators need scope expansion tied to real supported internal links, not to
  incidental text patterns.

**Acceptance Criteria**:
1. External links do not expand run scope.
2. Literal text that resembles a page id, URL, or `space/title` path does not
   expand run scope unless it is parsed from one of the supported discovery
   forms defined by `FR-0063`.
3. Text inside Confluence storage-format `<ac:plain-text-body>` elements,
   `<pre>` elements, `<code>` elements, or `<ac:parameter>` elements whose
   `ac:name` is not `page` does not expand run scope unless it is parsed from
   one of the supported discovery forms defined by `FR-0063`.
4. A `non_page` child result under `FR-0071` does not expand page scope.

**Dependencies**:
- `FR-0063`
- `FR-0071`

**Traceability**:
- Area: scope discovery
- Observable evidence: absence of false-positive pages in manifest

### FR-0066
**Requirement**: Unsupported internal-looking reference patterns shall be
recorded as scope findings.

**Applicability**:
- accepted `export` and `plan` runs

**Rationale**:
- Operators need explicit visibility when a run can be semantically incomplete
  because the product met the edge of its support profile.

**Acceptance Criteria**:
1. For this card, a scope finding is one condition that must later be recorded
   in `scope-findings.tsv` under `FR-0089`. If the product encounters a
   Confluence storage-format element or attribute
   outside the supported discovery forms defined by `FR-0063`, and an inspected
   unsupported-pattern source value from criteria 3 through 5 contains
   `pageId=<decimal_digits>`, `/pages/<decimal_digits>`, or
   `/display/<space_key>/<title_segment>`, or contains a URL-shaped
   `title=<title>` query parameter with an optional `spaceKey=<space_key>`
   query parameter recognizable under criteria 10 through 12, the run records
   one `unsupported_internal_pattern` scope finding for that inspected value
   with `finding_area=unsupported_pattern`, `finding_type=unsupported_internal_pattern`,
   and source-derived `detail` equal to that inspected unsupported-pattern
   source value before the normalization and row-identity rules applied by
   `FR-0089`.
2. `<decimal_digits>` is one or more ASCII digits.
3. An inspected unsupported-pattern source value is the XML-entity-decoded value
   of a storage-format attribute whose element-and-attribute combination did not
   emit a supported discovery form under `FR-0063`.
4. An inspected unsupported-pattern source value is also the XML-entity-decoded
   concatenated character-data content of a storage-format element whose element
   did not emit a supported discovery form under `FR-0063`, except for
   character data inside an `<ac:plain-text-body>` element that is a child of an
   `<ac:structured-macro ac:name="code">` element.
5. The concatenation in criterion 4 uses document order of character-data nodes
   inside that element and does not include descendant element markup, attribute
   text, or character-data nodes from ancestor or sibling elements.
6. `<space_key>` and `<title_segment>` each contain at least one non-`/`
   character after URL decoding.
7. Matching for `pageId=<decimal_digits>` and `/pages/<decimal_digits>` is
   performed on the inspected unsupported-pattern source value before URL
   decoding.
8. Raw substring matching for `pageId=<decimal_digits>` recognizes only a
   substring whose `p` in `pageId` is at the start of the inspected value or is
   immediately preceded by a character other than an ASCII letter, ASCII digit,
   or ASCII underscore, and whose final digit is at the end of the inspected
   value or is immediately followed by a character other than an ASCII letter
   or ASCII digit.
9. Raw substring matching for `/pages/<decimal_digits>` recognizes only a
   substring whose final digit is at the end of the inspected value or is
   immediately followed by `/`, `?`, `#`, `&`, or a character other than an
   ASCII letter or ASCII digit.
10. URL-shaped unsupported-pattern recognition uses the same absolute-URL
    exclusion, relative-URL parser, query ordering, path ordering, precedence,
    path segment arity, empty decoded field handling, and malformed-decode
    handling as the supported space/title URL discovery rules from `FR-0063`.
11. `/display/<space_key>/<title_segment>` unsupported-pattern recognition uses
    the same no-additional-non-empty-path-segment rule as the supported
    space/title URL discovery rules from `FR-0063`.
12. URL decoding for criterion 6 uses the decoded space-key and decoded title
    rules from the supported space/title URL discovery rules in `FR-0063`,
    including the same failure handling for malformed percent escapes and
    invalid UTF-8 octet sequences.
13. Distinct inspected unsupported-pattern source values from one processed
    source page remain distinct scope findings under this card; report-row
    deduplication and any collapse of identical normalized `detail` values are
    governed exclusively by `FR-0089`.

**Dependencies**:
- `FR-0063`
- `FR-0089`

**Traceability**:
- Area: scope discovery
- Observable evidence: scope-findings report

### FR-0067
**Requirement**: Duplicate discovery paths and cycles shall resolve to stable
single-page processing.

**Applicability**:
- accepted `export` and `plan` runs

**Rationale**:
- Operators need one stable page result per page even when the graph contains
  duplicate edges or cycles.

**Acceptance Criteria**:
1. This card governs only the observable no-duplicate and no-unbounded-traversal
   outcomes of discovery reuse; queue ordering and queue-membership mechanics
   are governed by `FR-0141`.
2. No canonical `page_id` value appears in more than one `manifest.tsv` data row
   in a run.
3. A page that has reached processed-page status under `FR-0127` is not
   processed again later in the same run.
4. Rediscovery of a page identity that is already queued or already processed
   does not add another later page-processing attempt for that same page
   identity.
5. After every distinct discoverable page identity reachable within the governed
   scope has already been queued or processed, later self-links, repeated
   links, or cycles among those already discovered page identities do not add
   new page-processing attempts.

**Dependencies**:
- `FR-0014`
- `FR-0061`
- `FR-0062`
- `FR-0086`
- `FR-0127`
- `FR-0141`

**Traceability**:
- Area: scope discovery
- Observable evidence: one manifest row per processed page, bounded completion

### FR-0141
**Requirement**: Page processing shall consume one deterministic FIFO discovery
queue.

**Applicability**:
- accepted `export` and `plan` runs

**Rationale**:
- Configured page limits, fail-fast stops, throttling, and download-limit stops
  must be reproducible for the same discovered graph.

**Acceptance Criteria**:
1. The discovery queue starts with the root page as its first entry.
2. The discovery queue is append-only: after a page id is appended, later
   discoveries never insert another page id before it.
3. While processing a page and recursive child traversal is selected,
   recursive child-listing discoveries for that page append newly discovered
   page ids to the tail of the queue in the preserved child-sequence order
   returned for that source page under `FR-0071`.
4. If recursive child traversal is selected and one child-listing result for the
   root page already contains descendants, every returned page id is treated as
   discovered while processing the root page and is appended under criterion 3.
5. When recursive child traversal is selected and requires child-listing results
   for multiple pages, those child-listing results are requested when their
   source page is processed in FIFO order.
6. Supported links discovered while processing a page whose source link-depth is
   less than the effective link-depth append resolved target page ids to the
   tail of the queue in the first-occurrence order found in that page's storage
   representation; supported links discovered while processing a page whose
   source link-depth is greater than or equal to the effective link-depth do not
   append target page ids under `FR-0062`.
7. For criterion 6, the page storage representation is traversed as parsed XML
   in document order, visiting an element's start position before its
   descendants and visiting descendants before the element's following sibling.
8. Attribute order in source markup is not used as a tie-breaker for criterion 6.
9. The occurrence position of a supported discovery form from a storage element
   or attribute is the start position of the element that owns the form.
10. If multiple supported discovery forms share one occurrence position, they are
   evaluated in this link-kind order: `content_id`, `page_ref`, `macro_param`,
   `href_page_id`, `href_space_title`, `ri_url_page_id`, and
   `ri_url_space_title`.
11. If multiple values of the same supported discovery form share one occurrence
   position, they are evaluated in ascending bytewise lexicographic order of the
   normalized target-input serialization defined for `raw_link_value` by
   `FR-0087`.
12. For the same source page, recursive child-listing discoveries are appended
    before supported-link discoveries when recursive child traversal is
    selected.
13. If a page id is already queued or processed, a later discovery path does not
   enqueue it again.
14. Page processing consumes the queue in FIFO order.

**Dependencies**:
- `FR-0060`
- `FR-0061`
- `FR-0062`
- `FR-0234`
- `FR-0218`
- `FR-0071`
- `FR-0087`
- `FR-0127`
- `FR-0234`

**Traceability**:
- Area: scope discovery
- Observable evidence: processing order under limits, sleeps, and fail-fast
  stops

### FR-0068
**Requirement**: Each processed page shall use one deterministic
`discovery_source` classification.

**Applicability**:
- accepted `export` and `plan` runs

**Rationale**:
- Operators need one stable page-classification rule when the same page is
  discovered through more than one scope path.

**Acceptance Criteria**:
1. The root page row in `manifest.tsv` uses `discovery_source=root`.
2. A non-root page that is part of the recursive child tree discovered while
   recursive child traversal is selected uses `discovery_source=tree` even if
   the same page is also discovered through a supported internal link.
3. A non-root page that is outside the recursive child tree and enters scope
   only through supported internal-link expansion uses
   `discovery_source=linked`.
4. No processed page is reported with more than one `discovery_source` value.

**Dependencies**:
- `FR-0060`
- `FR-0061`
- `FR-0062`

**Traceability**:
- Area: scope discovery
- Observable evidence: `manifest.tsv` page classification
