# AGENTS

## Scope
Rules for reading and changing implementation under `lib/`.

## Read
- Identify the smallest owning code area before editing.
- Read the relevant `docs/FR-<AREA>.md` files before changing behavior.
- Read `tests/AGENTS.md` if the change affects observable behavior.

## Change
- Keep changes local to the owning area when possible.
- Treat CLI behavior, outputs, validation, safety, and observability changes as behavior changes.
- Update code to match canonical requirements.
- Do not use `AGENTS.md` as a source of product behavior.

## Verify
- Run the smallest relevant verification first.
- Run broader verification if behavior changed.
- Confirm the resulting behavior still matches the relevant requirements.
