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
1. After successful root-page preflight, the root page is in scope.
2. Later traversal or processing failure does not retroactively remove the root
   page from scope.

**Dependencies**:
- `FR-0017`

**Traceability**:
- Area: scope discovery
- Observable evidence: manifest and summary interpretation

### FR-0060
**Requirement**: The run scope shall include the full recursive child tree of
the root page.

**Applicability**:
- accepted `export` and `plan` runs

**Rationale**:
- The customer expects root-driven export, not just a single page export.

**Acceptance Criteria**:
1. Any page that is a descendant of the root page through recursive child
   traversal is in scope.
2. If recursive child knowledge is incomplete, the run records the applicable
   `child_listing` scope-finding row defined by `FR-0071` rather than
   silently treating the child tree as complete.

**Dependencies**:
- `FR-0071`
- `FR-0089`

**Traceability**:
- Area: scope discovery
- Observable evidence: manifest, scope-findings report

### FR-0061
**Requirement**: The run scope shall include linked pages discovered from
root-tree page content through supported internal-link forms.

**Applicability**:
- accepted `export` and `plan` runs

**Rationale**:
- Operators need the export scope to include supported internal page references
  from the root-tree content.

**Acceptance Criteria**:
1. If a supported internal link in a root-tree page resolves to one unique target
   page, that target page is added to scope.
2. If the same linked page is discovered from multiple sources, the target page
   still appears only once in scope.

**Dependencies**:
- `FR-0063`
- `FR-0064`

**Traceability**:
- Area: scope discovery
- Observable evidence: manifest rows for linked pages

### FR-0062
**Requirement**: Link-driven scope expansion shall be single-hop from root-tree
pages only.

**Applicability**:
- accepted `export` and `plan` runs

**Rationale**:
- Operators need bounded linked-page expansion rather than uncontrolled graph
  traversal.

**Acceptance Criteria**:
1. A page added to scope only because it was linked from a root-tree page does
   not add its own descendants solely because it is in scope.
2. Links found while processing a linked page that is not itself in the root
   child tree do not expand scope further.

**Dependencies**:
- `FR-0061`

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
2. Link forms outside that documented set do not count as supported discovery
   forms.

**Dependencies**:

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

**Dependencies**:
- `FR-0035`
- `FR-0087`

**Traceability**:
- Area: scope discovery
- Observable evidence: resolved-links and unresolved-links reports

### FR-0065
**Requirement**: False-positive link-like content shall not expand run scope.

**Applicability**:
- accepted `export` and `plan` runs

**Rationale**:
- Operators need scope expansion tied to real supported internal links, not to
  incidental text patterns.

**Acceptance Criteria**:
1. External links do not expand run scope.
2. Link-like text inside code-like or plain-text content that is not a supported
   link form does not expand run scope.
3. Child results that are not pages do not expand page scope.

**Dependencies**:
- `FR-0063`

**Traceability**:
- Area: scope discovery
- Observable evidence: absence of false-positive pages in manifest

### FR-0066
**Requirement**: Unsupported internal-looking reference patterns shall be
surfaced as scope findings.

**Applicability**:
- accepted `export` and `plan` runs

**Rationale**:
- Operators need explicit visibility when a run may be semantically incomplete
  because the product met the edge of its support profile.

**Acceptance Criteria**:
1. If the product encounters a reference pattern outside the supported discovery
   profile that still carries a Confluence page identifier or a Confluence
   `space/title` path, the run records exactly one `scope-findings.tsv` row with
   `finding_area=unsupported_pattern` and
   `finding_type=unsupported_internal_pattern`.

**Dependencies**:
- `FR-0063`
- `FR-0089`

**Traceability**:
- Area: scope discovery
- Observable evidence: scope-findings report

### FR-0067
**Requirement**: Duplicate discovery paths and cycles shall not cause duplicate
page processing or unbounded traversal.

**Applicability**:
- accepted `export` and `plan` runs

**Rationale**:
- Operators need one stable page result per page even when the graph contains
  duplicate edges or cycles.

**Acceptance Criteria**:
1. A page is processed at most once per run.
2. Multiple discovery paths to the same page do not create duplicate processing.
3. Cyclic links and self-links do not create unbounded traversal.

**Dependencies**:
- `FR-0061`
- `FR-0062`
- `FR-0127`

**Traceability**:
- Area: scope discovery
- Observable evidence: one manifest row per processed page, bounded completion

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
2. A non-root page that is part of the recursive child tree uses
   `discovery_source=tree` even if the same page is also discovered through a
   supported internal link.
3. A non-root page that is outside the recursive child tree and enters scope
   only through supported internal-link expansion uses
   `discovery_source=linked`.
4. No processed page is reported with more than one `discovery_source` value.

**Dependencies**:
- `FR-0059`
- `FR-0060`
- `FR-0061`
- `FR-0062`
- `FR-0127`

**Traceability**:
- Area: scope discovery
- Observable evidence: `manifest.tsv` page classification
