# Export Workflow Guide

## Status
This file is non-normative.
Canonical requirements live in `docs/FOUNDATIONS.md` and `docs/FR-*.md`.

## Use This Guide When
- the task is about the `export` command
- the task is about materialized payload, attachments, encryption, or resume-aware export behavior

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
- `docs/FR-SEC.md`
- `docs/FR-OBS.md`
- `docs/FR-RES.md`

## Typical Task Routing
- add or change an export option -> `docs/FR-OPT.md`, then `docs/FR-CMD.md`
- change output tree or payload layout -> `docs/FR-OUT.md`, then `docs/FR-REP.md`
- change export scope rules -> `docs/FR-SCOPE.md`, `docs/FR-DATA.md`, and `docs/FR-RUN.md`
- change encrypted export or confidential behavior -> `docs/FR-SEC.md`, `docs/FR-SAFE.md`, and `docs/FR-OBS.md`
- change resume behavior -> `docs/FR-RES.md`, then `docs/FR-OBS.md`

## Precedence
If this file conflicts with any normative file, the normative file wins.
