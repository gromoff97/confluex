# Confluex Documentation

This directory contains the authoritative Confluex functional requirements
documentation set.

## File Roles

Operational files:

- `docs/README.md` defines the docs index and required reading order.
- `docs/AGENTS.md` defines how humans and AI agents must read and maintain the
  requirements set.

Normative files:

- `docs/FOUNDATIONS.md` defines the global contract for interpretation,
  precedence, and requirement quality.
- `docs/FR-*.md` files define area-specific functional requirements.
- `docs/CONFORMANCE-OUTCOME-MATRIX.md` defines the outcome matrix.
- `docs/TRACEABILITY-MODEL.md` defines traceability semantics and the legacy
  crosswalk from `FR-<AREA>-NNN` IDs to `FR-<NNN>` IDs.
- `docs/GLOSSARY.md` defines shared terminology.

## Required Reading Order

1. Read `docs/README.md`.
2. Read `docs/AGENTS.md`.
3. Read `docs/FOUNDATIONS.md`.
4. Read only the `docs/FR-<AREA>.md` files relevant to the task.
5. Read `docs/CONFORMANCE-OUTCOME-MATRIX.md`,
   `docs/TRACEABILITY-MODEL.md`, or `docs/GLOSSARY.md` only when needed by the
   task.

## Requirement Area Files

- `docs/FR-CMD.md` - command surface requirements.
- `docs/FR-UX.md` - operator experience requirements.
- `docs/FR-VAL.md` - invocation validation requirements.
- `docs/FR-OPT.md` - option semantics requirements.
- `docs/FR-DIAG.md` - diagnostics requirements.
- `docs/FR-CONF.md` - configuration requirements.
- `docs/FR-LIFE.md` - installation lifecycle requirements.
- `docs/FR-RUN.md` - run lifecycle requirements.
- `docs/FR-SCOPE.md` - scope discovery requirements.
- `docs/FR-DATA.md` - data acquisition requirements.
- `docs/FR-OUT.md` - output and artifact requirements.
- `docs/FR-REP.md` - report requirements.
- `docs/FR-SAFE.md` - safety requirements.
- `docs/FR-INT.md` - interruption and runtime-failure requirements.
- `docs/FR-RES.md` - resume and recovery requirements.
- `docs/FR-SEC.md` - encryption requirements.
- `docs/FR-OBS.md` - observability and outcome requirements.

## Self-Contained Docs Domain

This `docs/` directory is the authoritative requirements domain for Confluex.
Use the root `README.md` only as the repository-level entry point.
