# Traceability Model


The following matrix is a family-level traceability aid. Individual requirement
blocks remain the primary traceability source.

| Requirement Group | Product Area | Customer Concern | Primary Observable Evidence |
|---|---|---|---|
| `FR-CMD-*` | command surface | correct workflow entry | top-level help, command help, accepted workflow entry |
| `FR-UX-*` | operator experience | clear usage and actionable feedback | help output, stdout, stderr |
| `FR-VAL-*` | invocation validation | reject invalid or unsafe invocations before work begins | rejection timing, stderr, exit code |
| `FR-OPT-*` | option semantics | explicit operator intent | workflow behavior, report values, rejection behavior |
| `FR-DIAG-*` | diagnostics | readiness and support-profile visibility | `doctor` stdout contract |
| `FR-CONF-*` | configuration | saved encryption-recipient state | `config` stdout contract and persistence |
| `FR-LIFE-*` | installation lifecycle | safe self-install and self-removal | lifecycle result lines, manifest, filesystem footprint |
| `FR-RUN-*` | run lifecycle | predictable workflow identity and lifecycle | `RUN_*` lines, output-root naming |
| `FR-SCOPE-*` | scope discovery | correct page scope without guesswork | manifest, link reports, scope findings |
| `FR-DATA-*` | data acquisition | sufficient black-box data collection | reports and persisted payload artifacts |
| `FR-OUT-*` | output structure | predictable artifact layout | filesystem layout and sidecar artifacts |
| `FR-REP-*` | report schemas | stable machine-readable run interpretation | report files and `summary.txt` |
| `FR-SAFE-*` | safety controls | interpretable bounded and degraded outcomes | warnings, partial artifacts, summary fields |
| `FR-INT-*` | interruption semantics | correct handling of interrupted or failed runs | retained or removed output roots, summary fields |
| `FR-RES-*` | resume and recovery | safe reuse of compatible export results | resume acceptance, regenerated reports |
| `FR-SEC-*` | encryption | secure delivery and confidentiality-first behavior | encrypted artifacts, status sidecars, warnings |
| `FR-OBS-*` | outcomes and observability | stable statuses, counts, and exit codes | `summary.txt`, `RUN_COMPLETE`, exit code |

## Legacy ID Crosswalk

| Legacy ID | New ID | File |
|---|---|---|
| `FR-CMD-001` | `FR-0001` | `docs/FR-CMD.md` |
| `FR-CMD-002` | `FR-0002` | `docs/FR-CMD.md` |
| `FR-CMD-003` | `FR-0003` | `docs/FR-CMD.md` |
| `FR-CMD-004` | `FR-0004` | `docs/FR-CMD.md` |
| `FR-CMD-005` | `FR-0005` | `docs/FR-CMD.md` |
| `FR-CMD-006` | `FR-0006` | `docs/FR-CMD.md` |
| `FR-UX-001` | `FR-0007` | `docs/FR-UX.md` |
| `FR-UX-002` | `FR-0008` | `docs/FR-UX.md` |
| `FR-UX-003` | `FR-0009` | `docs/FR-UX.md` |
| `FR-UX-004` | `FR-0010` | `docs/FR-UX.md` |
| `FR-VAL-001` | `FR-0011` | `docs/FR-VAL.md` |
| `FR-VAL-002` | `FR-0012` | `docs/FR-VAL.md` |
| `FR-VAL-003` | `FR-0013` | `docs/FR-VAL.md` |
| `FR-VAL-004` | `FR-0014` | `docs/FR-VAL.md` |
| `FR-VAL-005` | `FR-0015` | `docs/FR-VAL.md` |
| `FR-VAL-006` | `FR-0016` | `docs/FR-VAL.md` |
| `FR-VAL-007` | `FR-0017` | `docs/FR-VAL.md` |
| `FR-VAL-008` | `FR-0018` | `docs/FR-VAL.md` |
| `FR-VAL-009` | `FR-0019` | `docs/FR-VAL.md` |
| `FR-OPT-001` | `FR-0020` | `docs/FR-OPT.md` |
| `FR-OPT-002` | `FR-0021` | `docs/FR-OPT.md` |
| `FR-OPT-003` | `FR-0022` | `docs/FR-OPT.md` |
| `FR-OPT-004` | `FR-0023` | `docs/FR-OPT.md` |
| `FR-OPT-005` | `FR-0024` | `docs/FR-OPT.md` |
| `FR-OPT-006` | `FR-0025` | `docs/FR-OPT.md` |
| `FR-OPT-007` | `FR-0026` | `docs/FR-OPT.md` |
| `FR-OPT-008` | `FR-0027` | `docs/FR-OPT.md` |
| `FR-OPT-009` | `FR-0028` | `docs/FR-OPT.md` |
| `FR-OPT-010` | `FR-0029` | `docs/FR-OPT.md` |
| `FR-OPT-011` | `FR-0030` | `docs/FR-OPT.md` |
| `FR-OPT-012` | `FR-0031` | `docs/FR-OPT.md` |
| `FR-OPT-013` | `FR-0032` | `docs/FR-OPT.md` |
| `FR-OPT-014` | `FR-0033` | `docs/FR-OPT.md` |
| `FR-OPT-015` | `FR-0034` | `docs/FR-OPT.md` |
| `FR-OPT-016` | `FR-0035` | `docs/FR-OPT.md` |
| `FR-OPT-017` | `FR-0036` | `docs/FR-OPT.md` |
| `FR-OPT-018` | `FR-0037` | `docs/FR-OPT.md` |
| `FR-DIAG-001` | `FR-0038` | `docs/FR-DIAG.md` |
| `FR-DIAG-002` | `FR-0039` | `docs/FR-DIAG.md` |
| `FR-DIAG-003` | `FR-0040` | `docs/FR-DIAG.md` |
| `FR-DIAG-004` | `FR-0041` | `docs/FR-DIAG.md` |
| `FR-DIAG-005` | `FR-0042` | `docs/FR-DIAG.md` |
| `FR-DIAG-006` | `FR-0043` | `docs/FR-DIAG.md` |
| `FR-DIAG-007` | `FR-0044` | `docs/FR-DIAG.md` |
| `FR-CONF-001` | `FR-0045` | `docs/FR-CONF.md` |
| `FR-CONF-002` | `FR-0046` | `docs/FR-CONF.md` |
| `FR-CONF-003` | `FR-0047` | `docs/FR-CONF.md` |
| `FR-LIFE-001` | `FR-0048` | `docs/FR-LIFE.md` |
| `FR-LIFE-002` | `FR-0049` | `docs/FR-LIFE.md` |
| `FR-LIFE-003` | `FR-0050` | `docs/FR-LIFE.md` |
| `FR-LIFE-004` | `FR-0051` | `docs/FR-LIFE.md` |
| `FR-RUN-001` | `FR-0052` | `docs/FR-RUN.md` |
| `FR-RUN-002` | `FR-0053` | `docs/FR-RUN.md` |
| `FR-RUN-003` | `FR-0054` | `docs/FR-RUN.md` |
| `FR-RUN-004` | `FR-0055` | `docs/FR-RUN.md` |
| `FR-RUN-005` | `FR-0056` | `docs/FR-RUN.md` |
| `FR-RUN-006` | `FR-0057` | `docs/FR-RUN.md` |
| `FR-RUN-007` | `FR-0058` | `docs/FR-RUN.md` |
| `FR-SCOPE-001` | `FR-0059` | `docs/FR-SCOPE.md` |
| `FR-SCOPE-002` | `FR-0060` | `docs/FR-SCOPE.md` |
| `FR-SCOPE-003` | `FR-0061` | `docs/FR-SCOPE.md` |
| `FR-SCOPE-004` | `FR-0062` | `docs/FR-SCOPE.md` |
| `FR-SCOPE-005` | `FR-0063` | `docs/FR-SCOPE.md` |
| `FR-SCOPE-006` | `FR-0064` | `docs/FR-SCOPE.md` |
| `FR-SCOPE-007` | `FR-0065` | `docs/FR-SCOPE.md` |
| `FR-SCOPE-008` | `FR-0066` | `docs/FR-SCOPE.md` |
| `FR-SCOPE-009` | `FR-0067` | `docs/FR-SCOPE.md` |
| `FR-SCOPE-010` | `FR-0068` | `docs/FR-SCOPE.md` |
| `FR-DATA-001` | `FR-0069` | `docs/FR-DATA.md` |
| `FR-DATA-002` | `FR-0070` | `docs/FR-DATA.md` |
| `FR-DATA-003` | `FR-0071` | `docs/FR-DATA.md` |
| `FR-DATA-004` | `FR-0072` | `docs/FR-DATA.md` |
| `FR-DATA-005` | `FR-0073` | `docs/FR-DATA.md` |
| `FR-DATA-006` | `FR-0074` | `docs/FR-DATA.md` |
| `FR-DATA-007` | `FR-0075` | `docs/FR-DATA.md` |
| `FR-OUT-001` | `FR-0076` | `docs/FR-OUT.md` |
| `FR-OUT-002` | `FR-0077` | `docs/FR-OUT.md` |
| `FR-OUT-003` | `FR-0078` | `docs/FR-OUT.md` |
| `FR-OUT-004` | `FR-0079` | `docs/FR-OUT.md` |
| `FR-OUT-005` | `FR-0080` | `docs/FR-OUT.md` |
| `FR-OUT-006` | `FR-0081` | `docs/FR-OUT.md` |
| `FR-OUT-007` | `FR-0082` | `docs/FR-OUT.md` |
| `FR-OUT-008` | `FR-0083` | `docs/FR-OUT.md` |
| `FR-OUT-009` | `FR-0084` | `docs/FR-OUT.md` |
| `FR-REP-001` | `FR-0085` | `docs/FR-REP.md` |
| `FR-REP-002` | `FR-0086` | `docs/FR-REP.md` |
| `FR-REP-003` | `FR-0087` | `docs/FR-REP.md` |
| `FR-REP-004` | `FR-0088` | `docs/FR-REP.md` |
| `FR-REP-005` | `FR-0089` | `docs/FR-REP.md` |
| `FR-REP-006` | `FR-0090` | `docs/FR-REP.md` |
| `FR-REP-007` | `FR-0091` | `docs/FR-REP.md` |
| `FR-REP-008` | `FR-0092` | `docs/FR-REP.md` |
| `FR-REP-009` | `FR-0093` | `docs/FR-REP.md` |
| `FR-SAFE-001` | `FR-0094` | `docs/FR-SAFE.md` |
| `FR-SAFE-002` | `FR-0095` | `docs/FR-SAFE.md` |
| `FR-SAFE-003` | `FR-0096` | `docs/FR-SAFE.md` |
| `FR-SAFE-004` | `FR-0097` | `docs/FR-SAFE.md` |
| `FR-SAFE-005` | `FR-0098` | `docs/FR-SAFE.md` |
| `FR-SAFE-006` | `FR-0099` | `docs/FR-SAFE.md` |
| `FR-INT-001` | `FR-0100` | `docs/FR-INT.md` |
| `FR-INT-002` | `FR-0101` | `docs/FR-INT.md` |
| `FR-INT-003` | `FR-0102` | `docs/FR-INT.md` |
| `FR-RES-001` | `FR-0103` | `docs/FR-RES.md` |
| `FR-RES-002` | `FR-0104` | `docs/FR-RES.md` |
| `FR-RES-003` | `FR-0105` | `docs/FR-RES.md` |
| `FR-RES-004` | `FR-0106` | `docs/FR-RES.md` |
| `FR-SEC-001` | `FR-0107` | `docs/FR-SEC.md` |
| `FR-SEC-002` | `FR-0108` | `docs/FR-SEC.md` |
| `FR-SEC-003` | `FR-0109` | `docs/FR-SEC.md` |
| `FR-SEC-004` | `FR-0110` | `docs/FR-SEC.md` |
| `FR-SEC-005` | `FR-0111` | `docs/FR-SEC.md` |
| `FR-SEC-006` | `FR-0112` | `docs/FR-SEC.md` |
| `FR-OBS-001` | `FR-0113` | `docs/FR-OBS.md` |
| `FR-OBS-002` | `FR-0114` | `docs/FR-OBS.md` |
| `FR-OBS-003` | `FR-0115` | `docs/FR-OBS.md` |
| `FR-OBS-004` | `FR-0116` | `docs/FR-OBS.md` |
| `FR-OBS-005` | `FR-0117` | `docs/FR-OBS.md` |
| `FR-OBS-006` | `FR-0118` | `docs/FR-OBS.md` |
| `FR-OBS-007` | `FR-0119` | `docs/FR-OBS.md` |
| `FR-OBS-008` | `FR-0120` | `docs/FR-OBS.md` |
