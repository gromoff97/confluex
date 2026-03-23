# Interruption And Runtime-Failure Requirements


### FR-0100
**Requirement**: An interrupted `export` run shall leave an inspectable partial
plain output root.

**Applicability**:
- accepted `export` runs interrupted after the output root has been created

**Rationale**:
- Operators need a real export interrupted mid-run to remain inspectable rather
  than disappear.

**Acceptance Criteria**:
1. Already written artifacts in the plain output root remain on disk.
2. The retained plain output root satisfies the interrupted-or-incomplete
   top-level export layout required by `FR-0077`.
3. The retained plain output root is reported using the signal-interruption
   outcome defined by `FR-0113` and `FR-0116`.

**Dependencies**:
- `FR-0077`
- `FR-0098`
- `FR-0113`
- `FR-0116`

**Traceability**:
- Area: interruption
- Observable evidence: retained export root, marker file, summary fields

### FR-0101
**Requirement**: An interrupted `plan` run shall not leave a misleading partial
output root.

**Applicability**:
- accepted `plan` runs interrupted before completion

**Rationale**:
- Operators should not mistake an interrupted plan root for a valid final plan.

**Acceptance Criteria**:
1. The product removes the plain output root created for the interrupted plan
   run.
2. The removed path does not retain a partial report set.

**Dependencies**:
- `FR-0099`
- `FR-0085`

**Traceability**:
- Area: interruption
- Observable evidence: absence of the interrupted plan output root

### FR-0102
**Requirement**: Runtime failure after accepted run execution has begun shall be
reported explicitly.

**Applicability**:
- accepted `export` and `plan` runs that fail after root-page preflight
  succeeds and after any output-root creation, resume-reuse work, page
  processing, report generation, or encryption work for that run begins

**Rationale**:
- Operators need a runtime failure to be visible and distinguishable from
  configured-stop or clean outcomes.

**Acceptance Criteria**:
1. If a runtime failure stops an `export` run after accepted run execution has
   begun, the plain output root remains on disk and the retained result is
   reported using the runtime-failure incomplete outcome defined by `FR-0113`
   and `FR-0116`.
2. If a runtime failure stops a `plan` run after accepted run execution has
   begun, the product removes the plain output root created for that run and
   does not leave a partial report set behind at that path.
3. Runtime failure after accepted run execution has begun causes exit code `4`
   for all workflows governed by this card.

**Dependencies**:
- `FR-0085`
- `FR-0098`
- `FR-0113`
- `FR-0116`
- `FR-0118`

**Traceability**:
- Area: interruption
- Observable evidence: summary fields, removed plan root, exit code
