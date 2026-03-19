# Requirements Agent Guide

This file defines how humans and AI agents must read, add, modify, and delete
requirements in the Confluex documentation set.

## Reading Rules

1. Read `docs/README.md` first.
2. Read `docs/FOUNDATIONS.md` before interpreting any normative requirement.
3. Read only the relevant `docs/FR-<AREA>.md` files for the current task.
4. Treat `docs/TRACEABILITY-MODEL.md` and `docs/GLOSSARY.md` as supporting
   documents unless the task explicitly depends on them.
5. Do not infer new requirements from examples, rationale, or explanatory text.

## Requirement ID Rules

- Every normative requirement uses a globally unique `FR-<NNN>` identifier.
- The identifier format is fixed-width with four digits, for example `FR-0001`.
- New IDs are allocated from the next unused global number.
- Assigned IDs are stable and shall not be renumbered or reused.
- Moving a requirement between `docs/FR-<AREA>.md` files shall not change its
  `FR-<NNN>` identifier.

## Requirement Card Format

Every normative requirement card shall use this structure:

```md
### FR-<NNN>
**Requirement**: The product shall ...

**Applicability**:
- ...

**Rationale**:
- ...

**Acceptance Criteria**:
1. ...
2. ...

**Dependencies**:
- `FR-....`

**Traceability**:
- Area: ...
- Observable evidence: ...
```

## CIRCUS MATTA Gate

Every new or materially changed requirement shall satisfy CIRCUS MATTA:

- Complete
- Independent
- Realisable
- Consistent
- Unambiguous
- Specific to the product and operator context
- Measurable
- Acceptable
- Testable
- Traceable
- Achievable

A requirement that does not satisfy CIRCUS MATTA shall be revised, narrowed,
split, or rejected before it is accepted in normative form.

## Adding A Requirement

1. Choose the correct `docs/FR-<AREA>.md` file for the requirement's behavior.
2. Confirm that the requirement expresses exactly one independently meaningful
   normative obligation.
3. Allocate the next unused global `FR-<NNN>` identifier.
4. Write the full requirement card with applicability, rationale, acceptance
   criteria, dependencies, and traceability.
5. Update any affected references, tests, or supporting docs that point to the
   requirement.

## Modifying A Requirement

- Keep the existing `FR-<NNN>` identifier unless the requirement meaning changes
  so much that it becomes a new requirement.
- Update `Acceptance Criteria`, `Dependencies`, and `Traceability` together with
  the normative statement when the requirement meaning changes materially.
- Preserve one-to-one intent between the requirement statement and its
  acceptance criteria.

## Deleting A Requirement

- Do not silently renumber later requirements.
- Do not reuse the deleted requirement's `FR-<NNN>` identifier.
- Prefer replacing a removed requirement with an explicit superseding
  requirement or documenting the removal in change history rather than
  pretending it never existed.

## Migration Rule

The legacy `FR-<AREA>-NNN` identifiers are retained only in
`docs/TRACEABILITY-MODEL.md` as a historical crosswalk. All new normative work
shall use the global `FR-<NNN>` identifier scheme.
