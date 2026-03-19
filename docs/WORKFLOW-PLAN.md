# Plan Workflow Guide

## Status
This file is non-normative.
Canonical requirements live in `docs/FOUNDATIONS.md` and `docs/FR-*.md`.

## Use This Guide When
- the task is about the `plan` command
- the task is about dry-run scope discovery without payload export

## Read First
1. `docs/FOUNDATIONS.md`
2. `docs/FR-CMD.md`
3. `docs/FR-OPT.md`
4. `docs/FR-RUN.md`

## Read Next If Needed
- `docs/FR-SCOPE.md`
- `docs/FR-DATA.md`
- `docs/FR-OUT.md`
- `docs/FR-REP.md`
- `docs/FR-SAFE.md`
- `docs/FR-OBS.md`
- `docs/FR-SEC.md`

## Typical Task Routing
- change planning-mode scope behavior -> `docs/FR-RUN.md`, `docs/FR-SCOPE.md`, and `docs/FR-DATA.md`
- change metadata persistence in `plan` -> `docs/FR-OPT.md` and `docs/FR-OUT.md`
- change plan report semantics -> `docs/FR-REP.md`, then `docs/FR-OBS.md`
- change plan safety or incomplete outcomes -> `docs/FR-SAFE.md`, then `docs/FR-OBS.md`

## Precedence
If this file conflicts with any normative file, the normative file wins.
