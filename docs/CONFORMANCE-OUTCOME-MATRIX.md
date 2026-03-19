# Conformance Outcome Matrix


The following matrix is a derived navigation aid. If it ever appears to conflict
with an individual `FR-*` requirement, the individual requirement prevails.

| Scenario | Plain output root on disk after command returns | `INCOMPLETE` present | Encrypted archive present | Status sidecar present | `final_status` | Exit code |
|---|---|---|---|---|---|---|
| Invocation rejected before command work starts | No | No | No | No | not persisted | `1` |
| `export` or `plan` rejected by root-page preflight | No | No | No | No | not persisted | `1` |
| Plain `export` completed with `blocking_reasons=none` | Yes | No | No | No | `success` | `0` |
| Plain `export` completed with findings and without `--critical` | Yes | No | No | No | `success_with_findings` | `0` |
| `export` under `--critical` completed with findings | Yes | No | No | No | `policy_failed` | `2` |
| Encrypted `export` under `--critical` completed with findings | No | No | Yes | No | `policy_failed` | `2` |
| `export` stopped by configured limit | Yes | Yes | No | No | `incomplete` | `3` |
| `export` stopped by runtime failure after work started | Yes | Yes | No | No | `incomplete` | `4` |
| `export` interrupted by signal | Yes | Yes | No | No | `interrupted` | `130` |
| Encrypted `export` completed with `blocking_reasons=none` | No | No | Yes | No | `success` | `0` |
| Encrypted `export` completed with findings and without `--critical` | No | No | Yes | No | `success_with_findings` | `0` |
| Standard encrypted `export` run with encryption failure | Yes | No | No | No | `encryption_failed` | `5` |
| Confidential `export` run with encryption failure | No | No | No | Yes | `encryption_failed` via `<out>.status.txt` | `5` |
| Plain `plan` completed with `blocking_reasons=none` | Yes | No | No | No | `success` | `0` |
| Plain `plan` completed with findings and without `--critical` | Yes | No | No | No | `success_with_findings` | `0` |
| `plan` under `--critical` completed with findings | Yes | No | No | No | `policy_failed` | `2` |
| `plan` stopped by configured limit | Yes | Yes | No | No | `incomplete` | `3` |
| `plan` stopped by runtime failure after work started | No | No | No | No | not persisted because the output root is removed | `4` |
| Encrypted `plan` completed with `blocking_reasons=none` | No | No | Yes | No | `success` | `0` |
| Encrypted `plan` completed with findings and without `--critical` | No | No | Yes | No | `success_with_findings` | `0` |
| Encrypted `plan` under `--critical` completed with findings | No | No | Yes | No | `policy_failed` | `2` |
| Standard encrypted `plan` run with encryption failure | Yes | No | No | No | `encryption_failed` | `5` |
| Confidential `plan` run with encryption failure | No | No | No | Yes | `encryption_failed` via `<out>.status.txt` | `5` |
| `plan` interrupted by signal | No | No | No | No | not persisted because the output root is removed | `130` |
