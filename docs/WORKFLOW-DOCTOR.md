# Doctor Workflow Guide

## Status
This file is non-normative.
Canonical requirements live in `docs/FOUNDATIONS.md` and `docs/FR-*.md`.

## Use This Guide When
- the task is about the `doctor` command
- the task is about environment readiness, page-access diagnostics, or encryption-recipient diagnostics

## Read First
1. `docs/FOUNDATIONS.md`
2. `docs/FR-CMD.md`
3. `docs/FR-OPT.md`
4. `docs/FR-DIAG.md`

## Read Next If Needed
- `docs/FR-CONF.md`
- `docs/FR-SEC.md`
- `docs/FR-OBS.md`

## Typical Task Routing
- add or change a `doctor` flag -> `docs/FR-OPT.md`, then `docs/FR-CMD.md`
- change readiness output -> `docs/FR-DIAG.md`
- change page-access behavior -> `docs/FR-DIAG.md`, then `docs/FR-VAL.md` if invocation acceptance changes
- change encryption verification routing -> `docs/FR-DIAG.md`, `docs/FR-SEC.md`, and `docs/FR-CONF.md`

## Precedence
If this file conflicts with any normative file, the normative file wins.
