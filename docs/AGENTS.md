# AGENTS

## Scope
Rules for reading and changing `docs/`.

## Read
- Read only the relevant `FR-<AREA>.md` files for the task.
- Do not treat `AGENTS.md` as a source of product behavior.
- Do not infer requirements from non-requirement text.

## Requirement Quality
- Every new or materially changed requirement shall satisfy CIRCUS MATTA: Complete, Independent, Realisable, Consistent, Unambiguous, Specific to the product and operator context, Measurable, Acceptable, Testable, Traceable, Achievable.
- A requirement that fails CIRCUS MATTA shall be revised, split, narrowed, or rejected.

## Requirement Shape
- Use stable global IDs in the form `FR-<NNN>`.
- Each requirement shall express one independently meaningful obligation.
- Each requirement card shall contain:
  `Requirement`
  `Applicability`
  `Rationale`
  `Acceptance Criteria`
  `Dependencies`
  `Traceability`

## Change
- Add or modify a requirement only in the correct `FR-<AREA>.md`.
- Keep IDs stable. Do not renumber or reuse them.
- Update acceptance criteria, dependencies, and traceability with any material requirement change.
- Do not duplicate requirements across files.
- Do not place product requirements in `AGENTS.md`.
