# Resume And Recovery Requirements


### FR-0103
**Requirement**: Resume compatibility shall be checked by machine-readable
recovery criteria.

**Applicability**:
- `export --resume --out <dir>`

**Rationale**:
- Operators need explicit compatibility gating before prior export output is
  reused.

**Acceptance Criteria**:
1. A candidate resume root contains at least `manifest.tsv`, `summary.txt`, and
   `INCOMPLETE` from a prior plain export run.
2. The prior `summary.txt` reports `command=export`,
   `support_profile=default`, `page_payload_format` equal to the current
   invocation's effective page payload format, `resume_mode=0`,
   `encryption_successful=0`, and `resume_schema_version=2`, and its `page_id`
   value equals the current invocation's canonical resolved root page
   identifier established by root-page preflight under `FR-0017`.
3. The prior `summary.txt` reports `final_status=incomplete` or
   `final_status=interrupted`.
4. Report counts in the existing output root remain internally consistent with
   the report-derived summary fields.
5. If any compatibility check fails, the invocation is rejected before reuse
   begins.

**Dependencies**:
- `FR-0026`
- `FR-0017`
- `FR-0092`
- `FR-0090`
- `FR-0117`
- `FR-0119`
- `FR-0121`

**Traceability**:
- Area: resume and recovery
- Observable evidence: acceptance or rejection of resume roots

### FR-0104
**Requirement**: A resumed export run shall rediscover scope from the root page.

**Applicability**:
- accepted `export --resume --out <dir>` runs

**Rationale**:
- Operators need resume to continue from the current root-page truth, not to
  trust the prior manifest blindly.

**Acceptance Criteria**:
1. A resumed export run validates root-page accessibility again.
2. A resumed export run rediscovers run scope from the root page again rather
   than treating the previous manifest as final scope truth.

**Dependencies**:
- `FR-0017`
- `FR-0059`

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
1. A prior page payload may be reused only when the prior manifest identifies the
   page and its `folder` path still resolves inside the active output root to
   payload for that same page, and that folder contains the page payload file
   required by the current invocation's effective page payload format and does
   not contain the page payload file of the other supported format.
2. If prior payload cannot be safely attributed to the same page, or if that
   folder contains the page payload file of a different supported format, the product
   materializes fresh payload instead of reusing it.
3. If a prior `folder` path resolves outside the active output root, the resume
   invocation is rejected.

**Dependencies**:
- `FR-0103`
- `FR-0079`
- `FR-0086`
- `FR-0080`
- `FR-0121`

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
3. For a non-resume export run or any `plan` run, `summary.txt` reports
   `resume_mode=0`.
4. If payload for a page is reused in a resumed export run, the regenerated
   `manifest.tsv` still contains exactly one row for that page.

**Dependencies**:
- `FR-0105`
- `FR-0090`

**Traceability**:
- Area: resume and recovery
- Observable evidence: regenerated report files and summary resume fields
