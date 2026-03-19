# AGENTS

## Scope
Rules for reading and changing tests under `tests/`.

## Read
- Identify the owning test layer before editing.
- Read the relevant `docs/FR-<AREA>.md` files before changing expectations.
- Read `lib/AGENTS.md` if implementation behavior is in scope.

## Change
- Add or update tests for changed behavior and new requirements.
- Keep test expectations aligned with canonical requirements.
- Preserve or add requirement traceability where the suite supports it.
- Do not invent behavior that is not defined in `docs/FR-<AREA>.md`.

## Verify
- Run the smallest relevant test set first.
- Run broader verification if the change crosses test layers or workflows.
- Confirm the tests still reflect the intended observable behavior.
