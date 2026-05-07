# Resume And Recovery Requirements


### FR-0103
**Requirement**: Resume compatibility shall be checked by machine-readable
recovery criteria.

**Applicability**:
- `export --resume --out <path>`

**Rationale**:
- Operators need explicit compatibility gating before prior export output is
  reused.

**Acceptance Criteria**:
1. A candidate resume root is an authoritative retained plain output root from a
   prior plain export run, contains no top-level `NON_AUTHORITATIVE` marker
   under `FR-0217`, is not non-authoritative debris under `FR-0100` or
   `FR-0102`, and contains the full report set defined by `FR-0085` and the
   interrupted-or-incomplete plain export layout defined by `FR-0077`,
   including `INCOMPLETE`.
2. The candidate resume root's prior report set is schema-valid under
   `FR-0086`, `FR-0087`, `FR-0088`, `FR-0089`, `FR-0090`, `FR-0091`,
   `FR-0092`, `FR-0093`, `FR-0114`, `FR-0115`, `FR-0116`, `FR-0117`,
   `FR-0119`, `FR-0120`, and `FR-0140` before reuse begins.
3. The prior `summary.txt` satisfies the plain-export resume-baseline value
   contracts governed by `FR-0117` and `FR-0119`: it identifies an `export`
   result with the `support_profile` value required by `FR-0119`,
   `page_payload_format` equal to the current invocation's effective page
   payload format, `resume_mode=0`, and `resume_schema_version=2`; its
   `page_id` value equals the current
   invocation's canonical resolved root page identifier established by
   root-page preflight under `FR-0017`, and its `output_root` value is one
   JSON string literal with no surrounding whitespace whose decoded value
   equals the candidate resume root path itself.
4. The prior `summary.txt` reports one of the two resume-eligible
   `final_status` values governed by `FR-0113`: `incomplete` or
   `interrupted`.
5. The prior report set satisfies the exact report-to-summary count equalities
   from `FR-0092` and the recovery-accounting equalities from `FR-0117`;
   because criterion 3 requires `resume_mode=0`, this includes
   `processed_pages` equal to the number of `manifest.tsv` data rows,
   `root_pages`, `tree_pages`, `linked_pages`, and `other_pages` equal to the
   corresponding `manifest.tsv` category counts, `resolved_links`,
   `unresolved_links`, `scope_findings`, and `failed_operations` equal to the
   data-row counts of their corresponding report files, `reused_pages=0`, and
   `fresh_pages=processed_pages`.
6. If any compatibility check fails, the invocation is rejected before reuse
   begins.

**Dependencies**:
- `FR-0017`
- `FR-0077`
- `FR-0082`
- `FR-0085`
- `FR-0086`
- `FR-0087`
- `FR-0088`
- `FR-0089`
- `FR-0090`
- `FR-0091`
- `FR-0092`
- `FR-0093`
- `FR-0114`
- `FR-0115`
- `FR-0116`
- `FR-0113`
- `FR-0117`
- `FR-0119`
- `FR-0120`
- `FR-0121`
- `FR-0100`
- `FR-0102`
- `FR-0140`
- `FR-0217`

**Traceability**:
- Area: resume and recovery
- Observable evidence: acceptance or rejection of resume roots

### FR-0104
**Requirement**: A resumed export run shall rediscover scope from the root page.

**Applicability**:
- accepted `export --resume --out <path>` runs

**Rationale**:
- Operators need resume to continue from the current root-page truth, not to
  trust the prior manifest blindly.

**Acceptance Criteria**:
1. A resumed export run validates root-page accessibility again.
2. A resumed export run rediscovers current-run scope from that root page again
   under the shared scope-discovery model from `FR-0052`, including
   `FR-0059`, `FR-0060`, `FR-0061`, `FR-0062`, `FR-0063`, `FR-0064`,
   `FR-0065`, `FR-0066`, `FR-0067`, and `FR-0141`, rather than treating the
   previous manifest as final scope truth.

**Dependencies**:
- `FR-0017`
- `FR-0052`
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
- Area: resume and recovery
- Observable evidence: re-run scope and preflight behavior

### FR-0105
**Requirement**: Resume shall reuse only safely attributable page payload.

**Applicability**:
- accepted resumed export runs

**Rationale**:
- Operators need safe reuse rather than guessed reuse of prior page payload.

**Acceptance Criteria**:
1. A prior page payload is reused only when the prior manifest identifies the
   page and its `folder` field is a canonical relative payload-folder path under
   `FR-0079` for that same page.
2. The prior `folder` path is joined to the active output root as path segments
   from the serialized `FR-0079` relative payload-folder path; the product does
   not follow symbolic links while deciding whether the path remains inside the
   active output root.
3. If a prior manifest row is considered for payload reuse and its `folder`
   field is not exactly the canonical relative payload-folder path required by
   criterion 1 for that same page, the resume invocation is rejected.
4. Each existing path segment from the active output root through the prior
   payload folder and payload file is evaluated using non-following filesystem
   metadata.
5. Prior payload is reused only if the payload folder is a directory, contains no
   symlink on the checked path, contains the page payload file required by the
   current invocation's effective page payload format as a regular file, does
   not contain the page payload file of the other supported format, contains no
   direct entry other than that required payload file, `attachments/`,
   `_info.txt`, or `_storage.xml`, and, if those optional direct entries are
   present, `attachments/` is a directory and `_info.txt` plus `_storage.xml`
   are regular files.
6. A prior page payload is reused only when the current invocation
   successfully produces the page representation governed by `FR-0074` for that
   same page and selected page payload format.
7. Reuse under criterion 6 succeeds only when reading the prior payload file as
   UTF-8 yields exactly the current-run page representation from `FR-0074`
   criterion 2.
8. If criteria 5 through 7 are not all satisfied and criterion 3 does not
   reject the invocation, the current invocation does not treat that prior
   payload as reused and instead follows the ordinary current-run page-payload
   persistence or `page_payload` failure behavior governed by `FR-0074`.

**Dependencies**:
- `FR-0074`
- `FR-0103`
- `FR-0148`
- `FR-0079`
- `FR-0086`
- `FR-0080`
- `FR-0121`
- `FR-0154`

**Traceability**:
- Area: resume and recovery
- Observable evidence: payload reuse behavior, rejection behavior

### FR-0106
**Requirement**: A resumed export run shall regenerate run-level reports for the
new run.

**Applicability**:
- accepted resumed export runs

**Rationale**:
- Operators need reports that describe the current rerun, not stale prior
  report-state.

**Acceptance Criteria**:
1. A resumed export run regenerates `manifest.tsv`, `resolved-links.tsv`,
   `unresolved-links.tsv`, `failed-pages.tsv`, `scope-findings.tsv`, and
   `summary.txt` for the new run.
2. For a resumed export run, `summary.txt` reports `resume_mode=1`.
3. If payload for a page is reused in a resumed export run, the regenerated
   `manifest.tsv` still contains exactly one row for that page.
4. Retained export-layout sanitation needed before finalizing the regenerated
   result is governed by `FR-0188`.

**Dependencies**:
- `FR-0105`
- `FR-0085`
- `FR-0086`
- `FR-0087`
- `FR-0088`
- `FR-0089`
- `FR-0090`
- `FR-0117`
- `FR-0188`

**Traceability**:
- Area: resume and recovery
- Observable evidence: regenerated report files and summary resume fields

### FR-0188
**Requirement**: A resumed export run shall sanitize inherited plain export
layout before any authoritative final result from that invocation is retained.

**Applicability**:
- accepted resumed export runs

**Rationale**:
- Operators need regenerated resumed exports to retain only the final layout
  required for the new run, not stale inherited filesystem entries.

**Acceptance Criteria**:
1. Before the product retains any authoritative final result for a resumed
   export run, it makes the regenerated plain export layout satisfy `FR-0077`
   for the regenerated result, including removing any inherited top-level
   `INCOMPLETE` marker unless the regenerated retained result itself is
   interrupted or incomplete, creating any required `pages/`, first-level
   space-segment, canonical page-folder, or `attachments/` directory as a
   directory when it is absent, and making the entire `pages/` subtree satisfy
   the closed export subtree layout from `FR-0077` for the
   regenerated result.
2. To satisfy criterion 1, the product evaluates every existing first-level
   entry under `pages/` using non-following filesystem metadata.
3. If a first-level `pages/` entry from criterion 2 is not a required
   first-level space-segment directory for the regenerated retained page set and
   is a regular file or symbolic link, the product removes that path itself
   without following a symbolic-link target.
4. If such an unexpected first-level `pages/` entry is a directory, the product
   removes it recursively by evaluating descendants using non-following
   filesystem metadata, removing regular files as files and symbolic links as
   links without following targets, traversing only directory descendants, and
   removing each directory after its descendants have been removed.
5. If descendant evaluation from criterion 4 encounters a FIFO, socket, device,
   or any other non-directory non-regular non-symlink filesystem object, the
   run fails as an accepted-run runtime failure under `FR-0102`.
6. Inside each required first-level space-segment directory, the product
   evaluates every direct entry using non-following filesystem metadata before
   deciding whether it is a required canonical page folder.
7. If a direct entry from criterion 6 is not the canonical `FR-0079` folder for
   a page represented by a retained per-page artifact in the regenerated result
   and is a regular file or symbolic link, the product removes that path itself
   without following a symbolic-link target.
8. If such an unexpected direct entry is a directory, the product removes it
   recursively using the same non-following descendant-removal rules from
   criteria 4 and 5.
9. If such an unexpected direct entry is a FIFO, socket, device, or any other
   non-directory non-regular non-symlink filesystem object, the run fails as an
   accepted-run runtime failure under `FR-0102`.
10. After criteria 6 through 9, the product removes every first-level
    space-segment directory that is empty and is not required by the regenerated
    retained page set.
11. If any required `pages/` entry or required first-level space-segment entry
    is present as a non-directory filesystem object under non-following
    metadata, the run fails as an accepted-run runtime failure under `FR-0102`.
12. If removal of any unexpected entry from criteria 3, 4, 7, 8, or 10 fails
    after accepted run work has begun, the run fails as an accepted-run runtime
    failure under `FR-0102`.
13. Canonical page-folder direct-entry sanitation is governed by `FR-0210`.
14. `attachments/` direct-entry sanitation is governed by `FR-0211`.
15. To satisfy criterion 1 for the retained export root outside `pages/`, the
    product evaluates every existing top-level entry using non-following
    filesystem metadata.
16. If a top-level entry from criterion 15 is required by `FR-0077` for the
    regenerated result and the required entry kind is a directory (`pages/`) or
    a regular file (each required report-file entry from `FR-0085`, and
    `INCOMPLETE` when `FR-0077` requires it), but the existing entry is not of
    that required kind under non-following metadata, the run fails as an
    accepted-run runtime failure under `FR-0102`.
17. If a top-level entry from criterion 15 is not required by `FR-0077` for the
    regenerated result and is a regular file or symbolic link, the product
    removes that path itself without following a symbolic-link target.
18. If such an unexpected top-level entry is a directory, the product removes
    it recursively using the same non-following descendant-removal rules from
    criteria 4 and 5.
19. If such an unexpected top-level entry is a FIFO, socket, device, or any
    other non-directory non-regular non-symlink filesystem object, the run
    fails as an accepted-run runtime failure under `FR-0102`.
20. If removal of any unexpected top-level entry from criteria 17 or 18 fails
    after accepted run work has begun, the run fails as an accepted-run runtime
    failure under `FR-0102`.

**Dependencies**:
- `FR-0085`
- `FR-0075`
- `FR-0076`
- `FR-0077`
- `FR-0079`
- `FR-0080`
- `FR-0102`
- `FR-0154`
- `FR-0210`
- `FR-0211`

**Traceability**:
- Area: resume and recovery
- Observable evidence: sanitized retained export layout after resume

### FR-0210
**Requirement**: A resumed export run shall sanitize inherited canonical
page-folder direct entries before retaining the regenerated result.

**Applicability**:
- accepted resumed export runs whose regenerated retained result requires one or
  more canonical page folders

**Rationale**:
- Operators need regenerated resumed exports to retain only the canonical
  page-folder entries permitted for the new run state.

**Acceptance Criteria**:
1. For each canonical page folder required by the regenerated retained page
   set, the product evaluates the folder path using non-following filesystem
   metadata; if it exists as a non-directory object, the run fails as an
   accepted-run runtime failure under `FR-0102`.
2. For each required canonical page folder, the product evaluates every direct
   entry using non-following filesystem metadata before deciding whether that
   entry is permitted for that page by `FR-0080` and the regenerated run state.
3. If a direct page-folder entry from criterion 2 is not permitted and is a
   regular file or symbolic link, the product removes that path itself without
   following a symbolic-link target.
4. If such an unexpected direct page-folder entry is a directory, the product
   removes it recursively by evaluating descendants using non-following
   filesystem metadata, removing regular files as files and symbolic links as
   links without following targets, traversing only directory descendants, and
   removing each directory after its descendants have been removed.
5. If descendant evaluation from criterion 4 encounters a FIFO, socket, device,
   or any other non-directory non-regular non-symlink filesystem object, the
   run fails as an accepted-run runtime failure under `FR-0102`.
6. If such an unexpected direct page-folder entry is a FIFO, socket, device, or
   any other non-directory non-regular non-symlink filesystem object, the run
   fails as an accepted-run runtime failure under `FR-0102`.
7. If removing a stale page-folder direct entry from criteria 3 or 4 fails
   after accepted run work has begun, the run fails as an accepted-run runtime
   failure under `FR-0102`.

**Dependencies**:
- `FR-0080`
- `FR-0102`
- `FR-0154`
- `FR-0188`

**Traceability**:
- Area: resume and recovery
- Observable evidence: sanitized canonical page-folder contents after resume

### FR-0211
**Requirement**: A resumed export run shall sanitize inherited `attachments/`
direct entries before retaining the regenerated result.

**Applicability**:
- accepted resumed export runs whose regenerated retained result requires one or
  more `attachments/` directories

**Rationale**:
- Operators need regenerated resumed exports to retain only the attachment
  payload files required for the new run state.

**Acceptance Criteria**:
1. If an `attachments/` directory is required for a retained page, the product
   evaluates that path using non-following filesystem metadata; if it exists as
   a non-directory object, the run fails as an accepted-run runtime failure
   under `FR-0102`.
2. For each required `attachments/` directory, the product evaluates every
   direct entry using non-following filesystem metadata before deciding whether
   that entry is a retained attachment payload file for that page under
   `FR-0075`.
3. If a direct `attachments/` entry from criterion 2 is not a retained
   attachment payload file and is a regular file or symbolic link, the product
   removes that path itself without following a symbolic-link target.
4. If such an unexpected `attachments/` entry is a directory, the product
   removes it recursively by evaluating descendants using non-following
   filesystem metadata, removing regular files as files and symbolic links as
   links without following targets, traversing only directory descendants, and
   removing each directory after its descendants have been removed.
5. If descendant evaluation from criterion 4 encounters a FIFO, socket, device,
   or any other non-directory non-regular non-symlink filesystem object, the
   run fails as an accepted-run runtime failure under `FR-0102`.
6. If such an unexpected `attachments/` entry is a FIFO, socket, device, or any
   other non-directory non-regular non-symlink filesystem object, the run fails
   as an accepted-run runtime failure under `FR-0102`.
7. If removing a stale attachment entry from criteria 3 or 4 fails after
   accepted run work has begun, the run fails as an accepted-run runtime failure
   under `FR-0102`.

**Dependencies**:
- `FR-0075`
- `FR-0102`
- `FR-0154`
- `FR-0188`

**Traceability**:
- Area: resume and recovery
- Observable evidence: sanitized attachment directories after resume
