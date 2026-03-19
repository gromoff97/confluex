# AGENTS

## Scope
Repo routing, precedence, and cross-domain review only.

## Route
- Requirements or docs changes: read `docs/AGENTS.md`.
- Code changes under `lib/`: read `lib/AGENTS.md`.
- Test changes under `tests/`: read `tests/AGENTS.md`.
- Mixed changes: read every relevant local `AGENTS.md`.

## Precedence
- Local `AGENTS.md` is normative inside its subtree.
- The more specific `AGENTS.md` wins for subtree-local workflow.
- Product behavior is defined only in `docs/FR-<AREA>.md`.
- `AGENTS.md` files must not duplicate product requirements.

## Review
- Check whether behavior-changing code requires requirements updates.
- Check whether changed requirements require code updates.
- Check whether changed behavior or changed requirements require test updates.
- Check whether docs, code, and tests still agree.
