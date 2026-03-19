# Confluex Functional Requirements

## 1. Document Purpose

This document defines the black-box functional requirements for `confluex`.
It is intended to be strong enough for design, implementation, review, and
acceptance of the CLI without relying on source-code inspection, README text, or
informal project knowledge.

The intended customer context is a user or automation pipeline that needs to:

- export a Confluence root page and its recursive child tree;
- include supported internally linked pages without silently guessing unsupported
  semantics;
- receive deterministic machine-readable artifacts and outcomes;
- distinguish the exact final outcomes `success`, `success_with_findings`,
  `policy_failed`, `interrupted`, `incomplete`, and `encryption_failed`;
- resume eligible export work safely;
- deliver results in encrypted form when required.

## 2. Requirement Quality Contract (CIRCUS MATTA)

This document is intentionally written to satisfy CIRCUS MATTA for black-box CLI
requirements:

- **Completeness**: it covers command surface, options, validation, diagnostics,
  configuration, lifecycle, traversal, data acquisition, artifact layout,
  reporting, safety, interruption, recovery, encryption, observability, and exit
  codes.
- **Independent**: each `FR-*` requirement package describes one primary
  externally observable contract.
- **Realisable** and **Achievable**: requirements constrain product behavior, not
  hidden implementation strategy.
- **Consistency**: one vocabulary is used for commands, options, files, report
  names, status tokens, and result semantics.
- **Unambiguity**: operator-visible behavior, persisted artifacts, and
  machine-readable contracts are stated explicitly.
- **Specific**: the requirements describe a deterministic, security-aware,
  automation-friendly Confluence export CLI rather than a generic content tool.
- **Measurable** and **Testable**: every requirement is written so that
  conformance can be determined from invocations and observable outputs.
- **Acceptable**: requirements preserve operator value and product intent rather
  than accidental implementation detail.
- **Traceable**: each requirement has a stable identifier, explicit dependencies,
  and an observable evidence target.

## 3. Reading Rules

The following reading rules are normative for this document:

- Requirements describe only externally observable behavior.
- If two requirements overlap, the more specific requirement prevails.
- A listed `Dependencies` entry means the dependent requirement relies on the
  referenced requirement for interpretation, acceptance, or outcome derivation;
  it does not relax or override the dependent requirement's own text.
- `Dependencies` lists identify the minimum direct normative prerequisites used
  by a requirement and are not required to enumerate every related requirement
  in the document.
- Exact literals in backticks are normative when they define commands, options,
  file names, directory names, headings, report headers, summary keys, closed
  token vocabularies, or complete operator-visible machine-readable lines.
- Free-text explanatory fields such as `error_summary`, `detail`, and
  line-by-line persistent log content are not fixed verbatim unless a requirement
  explicitly fixes them.
- A rejected invocation is an invocation that exits non-zero before traversal,
  payload export, attachment download, report generation, output-root reuse,
  configuration mutation, installation writes, or uninstallation writes begin.
- A command begins command work when it first performs any externally observable
  behavior other than rendering help output or reporting a rejected invocation.
- A canonical page identifier is the unsigned base-10 page-id string containing
  only ASCII digits `0` through `9`, with no sign, no separators, and no leading
  zeroes unless the value is exactly `0`.
- A positive integer is an unsigned base-10 integer string containing only ASCII
  digits `0` through `9`, with numeric value greater than `0`, no sign, and no
  separators.
- A non-negative integer is an unsigned base-10 integer string containing only
  ASCII digits `0` through `9`, with numeric value greater than or equal to
  `0`, no sign, and no separators.
- A quoted path string is a double-quoted path value that escapes backslash,
  double quote, TAB, LF, and CR as `\\`, `\"`, `\t`, `\n`, and `\r`.
- Unless a more specific requirement says otherwise, ascending lexicographic
  order means ascending bytewise lexicographic order of the final serialized
  value being compared.
- Unless a more specific requirement says otherwise, continuing to later pages
  means continuing only to pages whose processing has not yet begun, whether
  those pages were already discovered or are discovered later in the same run.
- In literal option names and machine-readable field names such as
  `--encryption-key` and `default_encryption_key`, the word `key` denotes an
  encryption-recipient identity token and not secret key material.
- A valid install manifest is a UTF-8 text file with LF line endings, exactly
  one non-empty relative path per line, no duplicate lines, and no path that
  resolves outside the selected installation target.
- Unless a more specific requirement says otherwise, recording a scope finding
  for a condition means writing exactly one corresponding data row to
  `scope-findings.tsv`.
- Unless a more specific requirement says otherwise, classifying a condition as
  a page-local failure means writing exactly one corresponding data row to
  `failed-pages.tsv`.
- Unless a more specific requirement says otherwise, one underlying condition is
  reported in at most one of `failed-pages.tsv` or `scope-findings.tsv`; a
  page-local failure row and a scope-finding row are not both emitted for the
  same condition.
- If one page qualifies for multiple discovery paths, its single
  `discovery_source` classification uses this precedence order:
  `root`, then `tree`, then `linked`.
- Unless a more specific requirement says otherwise, report-content rules apply
  only when the corresponding report remains on disk as part of a plain output
  root or inside a successfully created encrypted archive.
- If no retained run result exists, requirements that mention `summary.txt` or
  other report files do not imply that duplicate standalone copies are created
  elsewhere; in that case the required outcome evidence is limited to the
  stdout lines, exit code, and sidecar artifacts explicitly required by this
  document.
- For report-set requirements, a retained run result means either a plain output
  root that remains on disk or a successfully created encrypted archive;
  standalone sidecar files are not report-set containers.
- Unless a more specific requirement says otherwise, `INCOMPLETE` denotes a
  top-level marker path named exactly `INCOMPLETE`; this document constrains its
  presence, absence, and location, but not its file type or file content.

## 4. Product Intent And Boundary

- `confluex` is an orchestration CLI over Confluence export tooling; it is not a
  replacement for Confluence itself.
- The product is responsible for predictable export planning and execution,
  including traversal, supported link discovery, output materialization, report
  generation, resumable export behavior, and optional encryption.
- The product is not responsible for creating, configuring, or repairing external
  Confluence access credentials.
- The product is not responsible for creating, importing, generating, or deleting
  GPG key material.
- The product shall not store or use encryption-recipient identities except as
  explicitly permitted by this document.

## 5. Command Surface Requirements

### FR-CMD-001
**Requirement**: The product shall expose `export` as a top-level command.

**Applicability**:
- `confluex --help`
- `confluex export`
- `confluex export --help`

**Rationale**:
- Operators need a distinct workflow for materialized export runs.

**Acceptance Criteria**:
1. Top-level help lists `export` as a supported command.
2. `confluex export --help` identifies `export` as the materialized export
   workflow.
3. An accepted `confluex export ...` invocation starts the export workflow rather
   than any other workflow.

**Dependencies**:
- `FR-VAL-001`
- `FR-UX-001`

**Traceability**:
- Area: command surface
- Observable evidence: top-level help output, command help output, workflow entry

### FR-CMD-002
**Requirement**: The product shall expose `plan` as a top-level command.

**Applicability**:
- `confluex --help`
- `confluex plan`
- `confluex plan --help`

**Rationale**:
- Operators need a distinct workflow for dry-run planning.

**Acceptance Criteria**:
1. Top-level help lists `plan` as a supported command.
2. `confluex plan --help` identifies `plan` as the dry-run planning workflow.
3. An accepted `confluex plan ...` invocation starts the planning workflow rather
   than any other workflow.

**Dependencies**:
- `FR-VAL-001`
- `FR-UX-001`

**Traceability**:
- Area: command surface
- Observable evidence: top-level help output, command help output, workflow entry

### FR-CMD-003
**Requirement**: The product shall expose `doctor` as a top-level command.

**Applicability**:
- `confluex --help`
- `confluex doctor`
- `confluex doctor --help`

**Rationale**:
- Operators need a distinct diagnostic workflow.

**Acceptance Criteria**:
1. Top-level help lists `doctor` as a supported command.
2. `confluex doctor --help` identifies `doctor` as the diagnostic workflow.
3. An accepted `confluex doctor ...` invocation starts diagnostics rather than
   any other workflow.

**Dependencies**:
- `FR-VAL-001`
- `FR-UX-001`

**Traceability**:
- Area: command surface
- Observable evidence: top-level help output, command help output, workflow entry

### FR-CMD-004
**Requirement**: The product shall expose `config` as a top-level command.

**Applicability**:
- `confluex --help`
- `confluex config`
- `confluex config --help`

**Rationale**:
- Operators need a distinct workflow for saved encryption-recipient state.

**Acceptance Criteria**:
1. Top-level help lists `config` as a supported command.
2. `confluex config --help` identifies `config` as the configuration workflow.
3. An accepted `confluex config ...` invocation starts configuration behavior
   rather than any other workflow.

**Dependencies**:
- `FR-VAL-001`
- `FR-UX-001`

**Traceability**:
- Area: command surface
- Observable evidence: top-level help output, command help output, workflow entry

### FR-CMD-005
**Requirement**: The product shall expose `install` as a top-level command.

**Applicability**:
- `confluex --help`
- `confluex install`
- `confluex install --help`

**Rationale**:
- Operators need a distinct workflow for self-installation.

**Acceptance Criteria**:
1. Top-level help lists `install` as a supported command.
2. `confluex install --help` identifies `install` as the installation workflow.
3. An accepted `confluex install ...` invocation starts installation behavior
   rather than any other workflow.

**Dependencies**:
- `FR-VAL-001`
- `FR-UX-001`

**Traceability**:
- Area: command surface
- Observable evidence: top-level help output, command help output, workflow entry

### FR-CMD-006
**Requirement**: The product shall expose `uninstall` as a top-level command.

**Applicability**:
- `confluex --help`
- `confluex uninstall`
- `confluex uninstall --help`

**Rationale**:
- Operators need a distinct workflow for self-removal.

**Acceptance Criteria**:
1. Top-level help lists `uninstall` as a supported command.
2. `confluex uninstall --help` identifies `uninstall` as the uninstallation
   workflow.
3. An accepted `confluex uninstall ...` invocation starts uninstallation behavior
   rather than any other workflow.

**Dependencies**:
- `FR-VAL-001`
- `FR-UX-001`

**Traceability**:
- Area: command surface
- Observable evidence: top-level help output, command help output, workflow entry

## 6. Operator Experience Requirements

### FR-UX-001
**Requirement**: Top-level help shall support immediate command discovery.

**Applicability**:
- `confluex --help`
- `confluex` with no command and no help flag

**Rationale**:
- Operators need to discover available workflows and their purposes without
  trying commands blindly.

**Acceptance Criteria**:
1. `confluex --help` writes help output to `stdout`.
2. Top-level help contains the headings `Usage` and `Commands` in that order.
3. Under `Commands`, supported top-level commands appear exactly once each in
   this exact order: `export`, `plan`, `doctor`, `config`, `install`,
   `uninstall`.
4. Under `Commands`, each supported top-level command has exactly one one-line
   purpose statement.
5. `confluex` with no command and no help flag prints the same top-level help
   output as `confluex --help` and exits `0`.
6. `confluex --help` exits `0` and writes nothing to `stderr`.

**Dependencies**:
- `FR-CMD-001`
- `FR-CMD-002`
- `FR-CMD-003`
- `FR-CMD-004`
- `FR-CMD-005`
- `FR-CMD-006`

**Traceability**:
- Area: operator experience
- Observable evidence: top-level help output, stdout, exit code

### FR-UX-002
**Requirement**: Command help shall distinguish required and optional usage
correctly.

**Applicability**:
- `confluex <command> --help`

**Rationale**:
- Operators need command help that can be used directly without consulting other
  project files.

**Acceptance Criteria**:
1. Command help writes to `stdout`.
2. Command help contains the sections `Usage`, `Purpose`, `Required options`,
   `Optional options`, and `Examples` in that order.
3. A trailing `Notes` section is allowed only when the command needs to explain
   mutually exclusive or dependent options.
4. If a command has no required options, the `Required options` section states
   `none`.
5. If a command has no optional options, the `Optional options` section states
   `none`.
6. Each supported option of the target command appears exactly once under either
   `Required options` or `Optional options`.
7. Command help includes at least one example invocation that is accepted under
   this document when its placeholders are replaced with conforming values.
8. Command help exits `0`, writes nothing to `stderr`, and performs no command
   work other than rendering help.

**Dependencies**:
- `FR-CMD-001`
- `FR-CMD-002`
- `FR-CMD-003`
- `FR-CMD-004`
- `FR-CMD-005`
- `FR-CMD-006`
- `FR-OPT-017`

**Traceability**:
- Area: operator experience
- Observable evidence: command help output on stdout

### FR-UX-003
**Requirement**: Validation and warning messages shall be actionable.

**Applicability**:
- rejected invocations
- warnings emitted during accepted `export`, `plan`, or `doctor` invocations

**Rationale**:
- Operators need to know what to correct without inspecting code or logs.

**Acceptance Criteria**:
1. If a required option is missing, the error output identifies the missing
   option.
2. If an unsupported option or invalid option combination causes rejection, the
   error output identifies the relevant option name or names.
3. If the unbounded-run warning is emitted, it is written to `stderr` and the
   first line begins with `WARNING: `.
4. If the unbounded-run warning is emitted, it identifies the condition that made
   the run effectively unbounded.
5. If the confidential-mode log warning is emitted, it is written to `stderr`,
   the first line begins with `WARNING: `, and it identifies that `--log-file`
   remains outside plaintext-cleanup guarantees.

**Dependencies**:
- `FR-VAL-007`
- `FR-SAFE-001`
- `FR-SEC-005`

**Traceability**:
- Area: operator experience
- Observable evidence: stderr warning and error output

### FR-UX-004
**Requirement**: Operator-visible stream usage shall separate information from
warnings and errors.

**Applicability**:
- all accepted and rejected invocations

**Rationale**:
- Operators and automation need consistent stream routing.

**Acceptance Criteria**:
1. Informational output for accepted commands is written to `stdout`.
2. Required warnings are written to `stderr`.
3. Rejected-invocation errors are written to `stderr`.

**Dependencies**:
- `FR-DIAG-005`
- `FR-CONF-003`
- `FR-LIFE-002`
- `FR-RUN-007`

**Traceability**:
- Area: operator experience
- Observable evidence: stdout and stderr stream selection

## 7. Invocation Validation Requirements

### FR-VAL-001
**Requirement**: The product shall reject unknown top-level commands explicitly.

**Applicability**:
- `confluex <command>` where `<command>` is not supported

**Rationale**:
- Operators need a clear rejection when they invoke a command that does not
  exist.

**Acceptance Criteria**:
1. An unknown top-level command causes immediate rejection.
2. Rejection output identifies the rejected command token.
3. No command workflow begins.

**Dependencies**:
- `FR-UX-003`

**Traceability**:
- Area: invocation validation
- Observable evidence: stderr error output, absence of workflow side effects

### FR-VAL-002
**Requirement**: The product shall reject unsupported command-option
combinations before command work begins.

**Applicability**:
- non-help invocations with unsupported options

**Rationale**:
- Operators need the CLI to fail before it performs work under an invalid
  interpretation.

**Acceptance Criteria**:
1. Supplying an option to a command that does not support that option causes
   rejection.
2. If the rejected command is `export` or `plan`, rejection occurs before
   traversal, payload export, attachment download, report generation, or output
   root reuse begins.
3. If the rejected command is `doctor`, `config`, `install`, or `uninstall`,
   rejection occurs before command-specific state changes begin.

**Dependencies**:
- `FR-CMD-001`
- `FR-CMD-002`
- `FR-CMD-003`
- `FR-CMD-004`
- `FR-CMD-005`
- `FR-CMD-006`
- `FR-UX-002`
- `FR-OPT-017`

**Traceability**:
- Area: invocation validation
- Observable evidence: rejection timing, absence of command work

### FR-VAL-003
**Requirement**: The product shall reject missing required options or required
option values before command work begins.

**Applicability**:
- non-help invocations

**Rationale**:
- Operators need invalid invocations to fail before the CLI reaches an unsafe or
  undefined state.

**Acceptance Criteria**:
1. Omitting `--page-id` from `export` or `plan` causes rejection.
2. Omitting a required value for an option that takes a value causes rejection.
3. An empty string supplied to `--out`, `--log-file`, `--install-dir`, or
   `--encryption-key` causes rejection.

**Dependencies**:
- `FR-OPT-001`
- `FR-OPT-002`
- `FR-OPT-010`
- `FR-OPT-011`
- `FR-OPT-014`

**Traceability**:
- Area: invocation validation
- Observable evidence: stderr error output, absence of command work

### FR-VAL-004
**Requirement**: The product shall reject malformed numeric option values.

**Applicability**:
- non-help invocations using numeric options

**Rationale**:
- Operators need deterministic numeric validation boundaries.

**Acceptance Criteria**:
1. `--page-id` requires a canonical page identifier.
2. `--max-find-candidates` requires a positive integer.
3. `--max-pages` requires a positive integer.
4. `--max-download-mib` requires a positive integer.
5. `--sleep-ms` requires a non-negative integer.

**Dependencies**:
- `FR-OPT-001`
- `FR-OPT-015`
- `FR-OPT-016`

**Traceability**:
- Area: invocation validation
- Observable evidence: rejection output for malformed numeric values

### FR-VAL-005
**Requirement**: The product shall reject ambiguous or prohibited option
combinations.

**Applicability**:
- non-help invocations using mutually exclusive or prohibited combinations

**Rationale**:
- Operators need explicit rejection when option intent is contradictory.

**Acceptance Criteria**:
1. `config --clear-encryption-key --encryption-key <value>` is rejected.
2. `export` or `plan` with both `--critical` and `--no-fail-fast` is rejected.
3. `export` or `plan` with both `--confidential` and `--no-fail-fast` is
   rejected.

**Dependencies**:
- `FR-OPT-004`
- `FR-OPT-006`
- `FR-OPT-013`

**Traceability**:
- Area: invocation validation
- Observable evidence: rejection output, absence of command work

### FR-VAL-006
**Requirement**: The product shall reject reuse of an explicit output root unless
  the invocation is a valid resume scenario.

**Applicability**:
- `export` and `plan` with `--out <dir>`

**Rationale**:
- Operators need protection against accidental overwrite or silent reuse of prior
  result locations.

**Acceptance Criteria**:
1. `export` or `plan` with `--out <dir>` pointing to an existing path is rejected
   unless the invocation is a valid `export --resume --out <dir>` scenario.
2. `plan` with an existing explicit output root is rejected because `plan` does
   not support resume.
3. `export --resume --out <dir>` is accepted only when `<dir>` is recovery
   compatible under `FR-RES-001`.

**Dependencies**:
- `FR-OPT-002`
- `FR-OPT-007`
- `FR-RES-001`

**Traceability**:
- Area: invocation validation
- Observable evidence: rejection or acceptance of existing output roots

### FR-VAL-007
**Requirement**: Root-page preflight shall reject inaccessible root pages before
traversal, payload export, attachment download, report generation, or
output-root reuse begins.

**Applicability**:
- `export`
- `plan`

**Rationale**:
- Operators need root-page failures to stop the run before traversal or payload
  work begins.

**Acceptance Criteria**:
1. If root-page preflight determines that the target page is missing,
   inaccessible, or cannot be resolved to a page identity, the invocation is
   rejected.
2. Rejection occurs before traversal, payload export, attachment download,
   report generation, or output-root reuse begins.
3. Rejection output identifies the target `--page-id`.
4. If root-page preflight succeeds, it establishes one canonical resolved root
   page identifier for that run, and later requirements that refer to the run's
   root `page_id` use that resolved identifier.

**Dependencies**:
- `FR-OPT-001`
- `FR-RUN-001`

**Traceability**:
- Area: invocation validation
- Observable evidence: rejection timing, stderr error output

### FR-VAL-008
**Requirement**: Repeated option occurrences shall have deterministic semantics.

**Applicability**:
- non-help invocations with repeated options

**Rationale**:
- Operators and automation need repeatable semantics for repeated flags and
  valued options.

**Acceptance Criteria**:
1. Repeating a boolean-like flag is treated as one request rather than rejected
   solely because the flag was repeated.
2. Repeating a valued option makes the last supplied value the effective value.
3. If repeated values make the invocation invalid under a more specific
   requirement, the invocation is rejected according to that more specific
   requirement.

**Dependencies**:
- `FR-VAL-005`

**Traceability**:
- Area: invocation validation
- Observable evidence: effective option behavior under repeated occurrences

### FR-VAL-009
**Requirement**: Rejected invocations shall be observable and side-effect free.

**Applicability**:
- all rejected invocations

**Rationale**:
- Operators need a rejected invocation to be visibly rejected and free of hidden
  product side effects.

**Acceptance Criteria**:
1. Rejection output is written to `stderr`.
2. The first line of rejection output begins with `ERROR: `.
3. Rejected invocations exit `1`.
4. If the rejected invocation targets `export` or `plan`, the CLI does not
   create or reuse an output root.
5. If the operator supplied `--log-file` on a rejected invocation, the CLI does
   not create, append, or overwrite that persistent log artifact.

**Dependencies**:
- `FR-UX-003`
- `FR-UX-004`

**Traceability**:
- Area: invocation validation
- Observable evidence: stderr, exit code, absence of output-root and log-file
  side effects

## 8. Option Semantics Requirements

### FR-OPT-001
**Requirement**: `--page-id <id>` shall select the target root page or page to
diagnose.

**Applicability**:
- `export --page-id <id>`
- `plan --page-id <id>`
- `doctor --page-id <id>`

**Rationale**:
- Operators need one explicit page selector for run scope or access diagnosis.

**Acceptance Criteria**:
1. In `export` and `plan`, `--page-id <id>` selects the root page for the run.
2. In `doctor`, `--page-id <id>` requests page-access verification for that page.
3. Any command other than `export`, `plan`, or `doctor` used with `--page-id` is
   rejected.

**Dependencies**:
- `FR-VAL-002`
- `FR-VAL-003`
- `FR-VAL-004`

**Traceability**:
- Area: option semantics
- Observable evidence: workflow behavior, page-access diagnostics, rejection

### FR-OPT-002
**Requirement**: `--out <dir>` shall control the logical plain output root for
export-related runs.

**Applicability**:
- `export --out <dir>`
- `plan --out <dir>`

**Rationale**:
- Operators need deterministic control of the output-root location.

**Acceptance Criteria**:
1. `--out <dir>` selects the logical plain output root for the run.
2. If `<dir>` is relative, the product resolves it against the process current
   working directory and collapses `.` and `..` segments before existence checks
   and artifact creation.
3. Unless the resolved path is a filesystem root path, the logical plain output
   root is normalized to remove trailing path separators before later path
   comparison, artifact naming, summary reporting, or sidecar-path derivation.
4. If the operator omits `--out`, the product generates the output root
   automatically.

**Dependencies**:
- `FR-VAL-006`
- `FR-RUN-004`
- `FR-OBS-003`

**Traceability**:
- Area: option semantics
- Observable evidence: output-root location, path normalization, summary output

### FR-OPT-003
**Requirement**: `--safe` shall request a conservative run profile.

**Applicability**:
- `export --safe`
- `plan --safe`

**Rationale**:
- Operators need a single option that applies conservative defaults for
  production-style runs.

**Acceptance Criteria**:
1. Without explicit overrides, `--safe` applies these defaults:
   `--max-find-candidates 5`, `--max-pages 200`,
   `--max-download-mib 256`, and `--sleep-ms 200`.
2. Explicit operator-supplied values for those options override the safe-profile
   defaults.
3. Any command other than `export` or `plan` used with `--safe` is rejected.

**Dependencies**:
- `FR-VAL-002`
- `FR-SAFE-001`

**Traceability**:
- Area: option semantics
- Observable evidence: effective limit and throttle behavior

### FR-OPT-004
**Requirement**: `--critical` shall request fail-closed policy behavior.

**Applicability**:
- `export --critical`
- `plan --critical`

**Rationale**:
- Operators need a mode that treats a completed run with remaining findings as a
  fail-closed policy outcome.

**Acceptance Criteria**:
1. `--critical` applies the semantic effect of `--safe`.
2. If a completed run under `--critical` still has unresolved links, scope
   findings, or failed page-local operations, the run uses
   `final_status=policy_failed`.
3. Any command other than `export` or `plan` used with `--critical` is rejected.

**Dependencies**:
- `FR-SAFE-003`
- `FR-OBS-001`

**Traceability**:
- Area: option semantics
- Observable evidence: final status, exit code, safe-profile defaults

### FR-OPT-005
**Requirement**: `--encrypt` shall request standard encrypted-run behavior.

**Applicability**:
- `export --encrypt`
- `plan --encrypt`

**Rationale**:
- Operators need a standard encrypted delivery mode that preserves plaintext on
  encryption failure.

**Acceptance Criteria**:
1. `--encrypt` requests encrypted-run behavior for that run.
2. If no effective encryption recipient is available, or if the effective
   recipient fails preflight validation under `FR-SEC-002`, the invocation is
   rejected.
3. Any command other than `export` or `plan` used with `--encrypt` is rejected.

**Dependencies**:
- `FR-SEC-002`
- `FR-SEC-001`
- `FR-SEC-003`
- `FR-OPT-018`

**Traceability**:
- Area: option semantics
- Observable evidence: encryption preflight, encrypted artifacts, rejection

### FR-OPT-006
**Requirement**: `--confidential` shall request encrypted fail-closed behavior
with plaintext cleanup on encryption failure.

**Applicability**:
- `export --confidential`
- `plan --confidential`

**Rationale**:
- Operators need a confidentiality-first mode for security-sensitive exports.

**Acceptance Criteria**:
1. `--confidential` applies the semantic effect of both `--encrypt` and
   `--critical`.
2. Under `--confidential`, the effective encryption recipient must be expressed
   as a full 40-hex GPG fingerprint; otherwise the invocation is rejected.
3. If encryption fails after any plaintext run artifact has been written, the
   run applies the plaintext-cleanup and status-sidecar behavior defined by
   `FR-SEC-004`.
4. `--encrypt --confidential` has the same accepted semantics as
   `--confidential` alone.
5. Any command other than `export` or `plan` used with `--confidential` is
   rejected.

**Dependencies**:
- `FR-OPT-005`
- `FR-SEC-004`
- `FR-SEC-005`
- `FR-OPT-018`

**Traceability**:
- Area: option semantics
- Observable evidence: rejection rules, final artifact set, warning behavior

### FR-OPT-007
**Requirement**: `--resume` shall request recovery from a prior export output
root.

**Applicability**:
- `export --resume --out <dir>`

**Rationale**:
- Operators need explicit, safe reuse of compatible prior export results.

**Acceptance Criteria**:
1. `--resume` is supported only for `export`.
2. `export --resume` requires `--out`.
3. `export --resume --out <dir>` is accepted only when `<dir>` is an existing
   recovery-compatible output root under `FR-RES-001`.
4. Any command other than `export` used with `--resume` is rejected.

**Dependencies**:
- `FR-VAL-006`
- `FR-RES-001`

**Traceability**:
- Area: option semantics
- Observable evidence: acceptance or rejection of resume invocations

### FR-OPT-008
**Requirement**: `--no-fail-fast` shall request best-effort page processing.

**Applicability**:
- `export --no-fail-fast`
- `plan --no-fail-fast`

**Rationale**:
- Operators need a mode that keeps processing eligible later pages despite
  page-local failures.

**Acceptance Criteria**:
1. Under `--no-fail-fast`, a page-local failure does not stop the entire run
   immediately.
2. Any command other than `export` or `plan` used with `--no-fail-fast` is
   rejected.

**Dependencies**:
- `FR-VAL-005`
- `FR-SAFE-002`

**Traceability**:
- Area: option semantics
- Observable evidence: continued processing after page-local failure

### FR-OPT-009
**Requirement**: `--keep-metadata` shall control persistence of per-page metadata
artifacts.

**Applicability**:
- `export --keep-metadata`
- `plan --keep-metadata`

**Rationale**:
- Operators need explicit control over whether metadata artifacts remain in final
  output.

**Acceptance Criteria**:
1. `--keep-metadata` requests persistence of per-page metadata artifacts that
   would otherwise be omitted from the final output.
2. In `export`, if `--keep-metadata` is in effect and page-level metadata
   acquisition succeeds for a processed page, the product persists `_info.txt`
   and `_storage.xml`.
3. In `plan`, if `--keep-metadata` is in effect and page-level metadata
   acquisition succeeds for a processed page, the product persists `_info.txt`
   and `_storage.xml`.
4. In `plan`, if `--keep-metadata` is in effect and attachment-preview data is
   acquired for a page, the product also persists `_attachments_preview.txt`
   for that page.
5. Any command other than `export` or `plan` used with `--keep-metadata` is
   rejected.

**Dependencies**:
- `FR-DATA-005`
- `FR-OUT-005`
- `FR-OUT-006`

**Traceability**:
- Area: option semantics
- Observable evidence: presence or absence of metadata artifacts

### FR-OPT-010
**Requirement**: `--log-file <file>` shall request a persistent log artifact.

**Applicability**:
- `export --log-file <file>`
- `plan --log-file <file>`
- `doctor --log-file <file>`

**Rationale**:
- Operators may need a persistent log separate from run reports.

**Acceptance Criteria**:
1. `--log-file <file>` selects the requested persistent log-artifact path.
2. If `<file>` is relative, the product resolves it against the process current
   working directory and collapses `.` and `..` segments before any log write
   occurs.
3. If the parent directory of the effective log path does not exist, the product
   creates the missing parent directories before writing the log.
4. If the effective log path already exists as a regular file, the product
   replaces its previous contents with only the current invocation's log text.
5. If the effective log path resolves to an existing directory, or if any
   ancestor path segment needed to create its parent path is not a directory, the
   invocation is rejected.
6. Any command other than `export`, `plan`, or `doctor` used with `--log-file`
   is rejected.

**Dependencies**:
- `FR-VAL-003`
- `FR-VAL-009`
- `FR-SEC-005`

**Traceability**:
- Area: option semantics
- Observable evidence: persistent log-file creation, overwrite, or rejection

### FR-OPT-011
**Requirement**: `--encryption-key <value>` shall provide a command-specific
encryption-recipient identity.

**Applicability**:
- `export --encryption-key <value>`
- `plan --encryption-key <value>`
- `doctor --verify-encryption --encryption-key <value>`
- `config --encryption-key <value>`

**Rationale**:
- Operators need an explicit encryption-recipient override and configuration
  input.

**Acceptance Criteria**:
1. In `export` and `plan`, `--encryption-key <value>` is the effective recipient
   for the current run and overrides any saved default.
2. In `doctor --verify-encryption`, `--encryption-key <value>` is the effective
   recipient to verify.
3. In `config`, `--encryption-key <value>` saves that value as the default
   encryption recipient.
4. The value is rejected if it contains TAB, LF, or CR.
5. The exact value `none` is rejected because `none` is the reserved absence
   token in this document.
6. In `doctor`, `--encryption-key <value>` without `--verify-encryption` is
   rejected.

**Dependencies**:
- `FR-VAL-003`
- `FR-CONF-002`
- `FR-OPT-012`

**Traceability**:
- Area: option semantics
- Observable evidence: effective-recipient selection, configuration state,
  rejection behavior

### FR-OPT-012
**Requirement**: `--verify-encryption` shall request recipient verification in
`doctor`.

**Applicability**:
- `doctor --verify-encryption`

**Rationale**:
- Operators need an explicit way to verify that the effective recipient is usable
  before running encrypted exports.

**Acceptance Criteria**:
1. `doctor --verify-encryption` requests the encryption-recipient diagnostics
   defined by `FR-DIAG-003` using recipient selection from `FR-OPT-018`.
2. If no explicit `--encryption-key` and no saved default recipient exist, the
   command reports that there is no recipient to verify.
3. Any command other than `doctor` used with `--verify-encryption` is rejected.

**Dependencies**:
- `FR-DIAG-003`
- `FR-OPT-018`

**Traceability**:
- Area: option semantics
- Observable evidence: `doctor` encryption-recipient diagnostics

### FR-OPT-013
**Requirement**: `--clear-encryption-key` shall request deletion of the saved
default encryption recipient.

**Applicability**:
- `config --clear-encryption-key`

**Rationale**:
- Operators need an explicit way to remove the saved default recipient.

**Acceptance Criteria**:
1. `config --clear-encryption-key` removes the saved default encryption
   recipient.
2. Any command other than `config` used with `--clear-encryption-key` is
   rejected.

**Dependencies**:
- `FR-CONF-003`
- `FR-VAL-005`

**Traceability**:
- Area: option semantics
- Observable evidence: configuration state after clear

### FR-OPT-014
**Requirement**: `--install-dir <dir>` shall select the target installation
directory.

**Applicability**:
- `install --install-dir <dir>`
- `uninstall --install-dir <dir>`

**Rationale**:
- Operators need deterministic control over the installation target.

**Acceptance Criteria**:
1. `install --install-dir <dir>` installs into that target location.
2. `uninstall --install-dir <dir>` uninstalls from that target location.
3. If `<dir>` is relative, the product resolves it against the process current
   working directory and collapses `.` and `..` segments before lifecycle
   validation begins.
4. Any command other than `install` or `uninstall` used with `--install-dir` is
   rejected.

**Dependencies**:
- `FR-LIFE-001`
- `FR-LIFE-002`

**Traceability**:
- Area: option semantics
- Observable evidence: target installation path, lifecycle result lines

### FR-OPT-015
**Requirement**: The run-stop limit options shall bound accepted export or plan
runs.

**Applicability**:
- `export --max-pages <n>`
- `plan --max-pages <n>`
- `export --max-download-mib <n>`
- `plan --max-download-mib <n>`

**Rationale**:
- Operators need explicit controls that can stop a run before it grows beyond the
  intended size.

**Acceptance Criteria**:
1. `--max-pages <n>` stops further page processing when `n` processed pages have
   been reached.
2. `--max-download-mib <n>` stops further page or attachment download activity
   once the accumulated downloaded volume reaches or exceeds
   `n * 1,048,576` bytes.
3. If either configured stop limit stops the run, the result is reported as a
   configured stop condition.
4. Any command other than `export` or `plan` used with either option is
   rejected.

**Dependencies**:
- `FR-VAL-004`
- `FR-SAFE-001`
- `FR-SAFE-004`

**Traceability**:
- Area: option semantics
- Observable evidence: early-stop result, summary fields, exit code

### FR-OPT-016
**Requirement**: The traversal-tuning options shall control pacing and title
candidate breadth.

**Applicability**:
- `export --sleep-ms <n>`
- `plan --sleep-ms <n>`
- `export --max-find-candidates <n>`
- `plan --max-find-candidates <n>`

**Rationale**:
- Operators need explicit control over request pacing and conservative title
  resolution breadth.

**Acceptance Criteria**:
1. `--sleep-ms <n>` applies a per-page delay of `n` milliseconds between
   processed pages.
2. `--max-find-candidates <n>` inspects at most `n` title candidates for any
   single title-resolution attempt.
3. If the candidate limit prevents unique resolution, the link remains
   unresolved.
4. Any command other than `export` or `plan` used with either option is
   rejected.

**Dependencies**:
- `FR-VAL-004`
- `FR-SCOPE-006`

**Traceability**:
- Area: option semantics
- Observable evidence: inter-page pacing behavior, unresolved title-resolution
  outcomes

### FR-OPT-017
**Requirement**: Each command shall support only one closed option set.

**Applicability**:
- all non-help invocations

**Rationale**:
- Operators and automation need option support to be explicit and closed rather
  than inferred indirectly.

**Acceptance Criteria**:
1. `export` supports only `--page-id`, `--out`, `--safe`, `--critical`,
   `--encrypt`, `--confidential`, `--resume`, `--no-fail-fast`,
   `--keep-metadata`, `--log-file`, `--encryption-key`, `--max-pages`,
   `--max-download-mib`, `--sleep-ms`, and `--max-find-candidates`.
2. `plan` supports only `--page-id`, `--out`, `--safe`, `--critical`,
   `--encrypt`, `--confidential`, `--no-fail-fast`, `--keep-metadata`,
   `--log-file`, `--encryption-key`, `--max-pages`, `--max-download-mib`,
   `--sleep-ms`, and `--max-find-candidates`.
3. `doctor` supports only `--page-id`, `--verify-encryption`,
   `--encryption-key`, and `--log-file`.
4. `config` supports only `--encryption-key` and `--clear-encryption-key`.
5. `install` supports only `--install-dir`.
6. `uninstall` supports only `--install-dir`.

**Dependencies**:
- `FR-OPT-001`
- `FR-OPT-002`
- `FR-OPT-003`
- `FR-OPT-004`
- `FR-OPT-005`
- `FR-OPT-006`
- `FR-OPT-007`
- `FR-OPT-008`
- `FR-OPT-009`
- `FR-OPT-010`
- `FR-OPT-011`
- `FR-OPT-012`
- `FR-OPT-013`
- `FR-OPT-014`
- `FR-OPT-015`
- `FR-OPT-016`

**Traceability**:
- Area: option semantics
- Observable evidence: command-specific option acceptance and rejection behavior

### FR-OPT-018
**Requirement**: Effective encryption-recipient selection shall use one
deterministic precedence order.

**Applicability**:
- `export` with `--encrypt` or `--confidential`
- `plan` with `--encrypt` or `--confidential`
- `doctor --verify-encryption`

**Rationale**:
- Operators need encryption validation and diagnostics to interpret recipient
  selection the same way in every workflow.

**Acceptance Criteria**:
1. If `--encryption-key <value>` is supplied on the current command and accepted,
   that value is the effective encryption recipient for that command.
2. Otherwise, if a saved default encryption recipient exists, the saved default
   is the effective encryption recipient for that command.
3. Otherwise, no effective encryption recipient exists for that command.
4. `config` is not itself a consumer of an effective encryption recipient; it
   only reads, writes, or clears the saved default recipient state.

**Dependencies**:
- `FR-OPT-011`
- `FR-CONF-001`
- `FR-CONF-002`
- `FR-CONF-003`

**Traceability**:
- Area: option semantics
- Observable evidence: recipient selection in `doctor`, encryption preflight,
  rejection or acceptance of encrypted runs

## 9. Diagnostics Requirements

### FR-DIAG-001
**Requirement**: `doctor` shall report environment readiness for required local
dependencies.

**Applicability**:
- accepted non-help `doctor` invocations

**Rationale**:
- Operators need a deterministic readiness report before they start using the
  CLI.

**Acceptance Criteria**:
1. `doctor` checks exactly these environment-readiness dependencies:
   `parser_runtime`, `confluence_cli`, and `gpg`.
2. `doctor` emits exactly one stdout line for each dependency in the format
   `dependency_<label>=<state>`.
3. Dependency lines appear in this exact order:
   `dependency_parser_runtime=...`,
   `dependency_confluence_cli=...`,
   `dependency_gpg=...`.
4. `<state>` uses only `absent`, `present:unknown_version`, or
   `present:<version_text>`.
5. In `present:<version_text>`, `<version_text>` is trimmed of leading and
   trailing whitespace and contains no TAB, LF, or CR.

**Dependencies**:
- `FR-UX-004`

**Traceability**:
- Area: diagnostics
- Observable evidence: `doctor` stdout dependency lines

### FR-DIAG-002
**Requirement**: `doctor` shall support optional page-access diagnostics.

**Applicability**:
- accepted non-help `doctor` invocations

**Rationale**:
- Operators need a deterministic way to confirm whether a candidate root page is
  accessible before planning or exporting.

**Acceptance Criteria**:
1. `doctor` without `--page-id` emits exactly one stdout line `page_access=skipped`.
2. `doctor --page-id <id>` emits `page_access=ok` when the page is accessible.
3. `doctor --page-id <id>` emits `page_access=failed` when the page is not
   accessible.
4. `doctor --page-id <id>` emits exactly one stdout line
   `page_identity=<page_id>` only when page access succeeds.
5. In `page_identity=<page_id>`, `<page_id>` is the canonical resolved page
   identifier rather than merely the raw command-line token.

**Dependencies**:
- `FR-OPT-001`

**Traceability**:
- Area: diagnostics
- Observable evidence: `page_access` and `page_identity` lines

### FR-DIAG-003
**Requirement**: `doctor` shall support optional encryption-recipient
diagnostics.

**Applicability**:
- accepted non-help `doctor` invocations

**Rationale**:
- Operators need to know whether the effective recipient is missing, valid, or
  invalid before requesting encrypted runs.

**Acceptance Criteria**:
1. `doctor` without `--verify-encryption` emits exactly one stdout line
   `encryption_recipient=skipped`.
2. `doctor --verify-encryption` with no effective recipient emits exactly one
   stdout line `encryption_recipient=missing`.
3. `doctor --verify-encryption` with a valid effective recipient emits exactly
   one stdout line `encryption_recipient=ok`.
4. `doctor --verify-encryption` with an invalid effective recipient emits
   exactly one stdout line `encryption_recipient=failed`.

**Dependencies**:
- `FR-OPT-011`
- `FR-OPT-012`
- `FR-OPT-018`

**Traceability**:
- Area: diagnostics
- Observable evidence: `encryption_recipient` line

### FR-DIAG-004
**Requirement**: `doctor` shall report the active support profile.

**Applicability**:
- accepted non-help `doctor` invocations

**Rationale**:
- Operators need to know what internal-link profile the product claims to
  support.

**Acceptance Criteria**:
1. `doctor` emits exactly one stdout line `support_profile=default`.
2. In every `export` or `plan` report set, `summary.txt` reports
   `support_profile=default`.

**Dependencies**:
- `FR-OBS-007`
- `FR-REP-006`

**Traceability**:
- Area: diagnostics
- Observable evidence: `support_profile` line

### FR-DIAG-005
**Requirement**: `doctor` shall expose machine-readable next-step guidance.

**Applicability**:
- accepted non-help `doctor` invocations

**Rationale**:
- Operators need a machine-readable summary of what to fix next.

**Acceptance Criteria**:
1. `doctor` emits exactly one stdout line `next_action=<value>`.
2. `<value>` uses either `none` or a comma-separated list of one or more unique
   tokens chosen from `install_parser_runtime`, `install_confluence_cli`,
   `install_gpg`, `check_page_access`, `set_encryption_key`, and
   `fix_encryption_key`.
3. If all checked dependencies are present, `page_access` is not `failed`, and
   `encryption_recipient` is neither `missing` nor `failed`,
   `next_action=none`.
4. If `next_action` is not `none`, tokens appear only in this order:
   `install_parser_runtime`, `install_confluence_cli`, `install_gpg`,
   `check_page_access`, `set_encryption_key`, `fix_encryption_key`.

**Dependencies**:
- `FR-DIAG-001`
- `FR-DIAG-002`
- `FR-DIAG-003`

**Traceability**:
- Area: diagnostics
- Observable evidence: `next_action` line

### FR-DIAG-006
**Requirement**: Accepted `doctor` invocations shall use one closed stdout
contract.

**Applicability**:
- accepted non-help `doctor` invocations

**Rationale**:
- Operators and automation need a deterministic, line-oriented diagnostic
  contract.

**Acceptance Criteria**:
1. The required informational lines appear on `stdout` in this exact order:
   dependency lines, `page_access`, optional `page_identity`,
   `encryption_recipient`, `support_profile`, `supported_link_forms`,
   `next_action`.
2. Accepted `doctor` invocations emit no additional informational stdout lines.
3. Accepted `doctor` invocations write no informational output to `stderr`.
4. Accepted `doctor` invocations exit `0`.

**Dependencies**:
- `FR-DIAG-001`
- `FR-DIAG-004`
- `FR-DIAG-005`
- `FR-DIAG-007`
- `FR-UX-004`

**Traceability**:
- Area: diagnostics
- Observable evidence: stdout line order, empty stderr, exit code

### FR-DIAG-007
**Requirement**: `doctor` shall report the documented supported link forms.

**Applicability**:
- accepted non-help `doctor` invocations

**Rationale**:
- Operators need an explicit machine-readable statement of which internal-link
  forms are actually supported for link-driven scope expansion.

**Acceptance Criteria**:
1. `doctor` emits exactly one stdout line
   `supported_link_forms=child_result,content_id,page_ref,macro_param,href_page_id,href_space_title,ri_url_page_id,ri_url_space_title`.
2. The serialized supported-link-form set matches the documented support set for
   scope expansion.

**Dependencies**:
- `FR-SCOPE-005`

**Traceability**:
- Area: diagnostics
- Observable evidence: `supported_link_forms` line

## 10. Configuration Requirements

### FR-CONF-001
**Requirement**: `config` shall show the saved default encryption-recipient
state.

**Applicability**:
- `confluex config` with neither `--encryption-key` nor `--clear-encryption-key`

**Rationale**:
- Operators need an explicit way to inspect saved recipient state.

**Acceptance Criteria**:
1. An accepted non-help `config` invocation with neither `--encryption-key` nor
   `--clear-encryption-key` emits exactly one stdout line in the format
   `default_encryption_key=<value>`.
2. If a default encryption recipient is saved, `<value>` is the saved value.
3. If no default encryption recipient is saved, the line is exactly
   `default_encryption_key=none`.
4. Accepted `config` read-only invocations write nothing to `stderr` and exit
   `0`.

**Dependencies**:
- `FR-UX-004`

**Traceability**:
- Area: configuration
- Observable evidence: stdout configuration line, empty stderr, exit code

### FR-CONF-002
**Requirement**: `config` shall save a default encryption-recipient identity.

**Applicability**:
- `confluex config --encryption-key <value>`

**Rationale**:
- Operators need a saved default recipient that can be reused by encrypted runs.

**Acceptance Criteria**:
1. If `<value>` is allowed under `FR-OPT-011`, `config --encryption-key <value>`
   saves that value as the default encryption recipient.
2. The same invocation emits exactly one stdout line
   `default_encryption_key=<value>`.
3. A later `confluex config` invocation with neither `--encryption-key` nor
   `--clear-encryption-key` emits the same saved value.
4. Accepted `config --encryption-key <value>` invocations write nothing to
   `stderr` and exit `0`.

**Dependencies**:
- `FR-OPT-011`
- `FR-CONF-001`

**Traceability**:
- Area: configuration
- Observable evidence: immediate stdout output and later persisted configuration
  state

### FR-CONF-003
**Requirement**: `config` shall clear the saved default encryption-recipient
identity.

**Applicability**:
- `confluex config --clear-encryption-key`

**Rationale**:
- Operators need a deterministic way to remove a previously saved default.

**Acceptance Criteria**:
1. `config --clear-encryption-key` removes the saved default encryption
   recipient.
2. The same invocation emits exactly one stdout line
   `default_encryption_key=none`.
3. A later `confluex config` invocation with neither `--encryption-key` nor
   `--clear-encryption-key` emits `default_encryption_key=none`.
4. Accepted `config --clear-encryption-key` invocations write nothing to
   `stderr` and exit `0`.

**Dependencies**:
- `FR-CONF-001`
- `FR-OPT-013`

**Traceability**:
- Area: configuration
- Observable evidence: immediate stdout output and later persisted configuration
  state

## 11. Installation Lifecycle Requirements

### FR-LIFE-001
**Requirement**: `install` shall create a runnable self-contained CLI footprint.

**Applicability**:
- accepted non-help `install` invocations

**Rationale**:
- Operators need a deterministic installation footprint that can later be
  removed safely.

**Acceptance Criteria**:
1. If `--install-dir` is omitted on POSIX, the target installation location is
   `$HOME/.local/bin`.
2. If `--install-dir` is omitted on Windows, the target installation location is
   `%USERPROFILE%\\.local\\bin`.
3. The installed command exposed to the operator is named `confluex`.
4. The product places the CLI entrypoint and all Confluex-owned runtime support
   files under the resolved target location and not outside it.
5. If the target path does not exist, the product creates it, including missing
   parent directories, before installation writes begin.
6. If the target path exists and is not a directory, the invocation is rejected.
7. An accepted install creates `<target>/.confluex-install-manifest.txt`.
8. The install manifest lists each Confluex-owned path exactly once as a
   relative path inside `<target>`, including
   `.confluex-install-manifest.txt` itself.
9. The install manifest is a valid install manifest as defined in Section 3.

**Dependencies**:
- `FR-OPT-014`
- `FR-VAL-009`

**Traceability**:
- Area: installation lifecycle
- Observable evidence: installed footprint, installation manifest, rejection

### FR-LIFE-002
**Requirement**: Accepted `install` invocations shall report one machine-readable
result line.

**Applicability**:
- accepted non-help `install` invocations

**Rationale**:
- Operators and automation need a deterministic installation result contract.

**Acceptance Criteria**:
1. An accepted `install` invocation emits exactly one stdout line
   `install_result=installed target="<absolute_path>"`.
2. `<absolute_path>` is the resolved absolute installation target serialized as a
   quoted path string.
3. Accepted `install` invocations write nothing to `stderr` and exit `0`.

**Dependencies**:
- `FR-LIFE-001`
- `FR-UX-004`

**Traceability**:
- Area: installation lifecycle
- Observable evidence: install result line, empty stderr, exit code

### FR-LIFE-003
**Requirement**: `uninstall` shall remove only the Confluex-owned footprint from
the selected target.

**Applicability**:
- accepted non-help `uninstall` invocations

**Rationale**:
- Operators need uninstall to be safe, idempotent, and bounded to the owned
  footprint.

**Acceptance Criteria**:
1. If `--install-dir` is omitted on POSIX, the target installation location is
   `$HOME/.local/bin`.
2. If `--install-dir` is omitted on Windows, the target installation location is
   `%USERPROFILE%\\.local\\bin`.
3. If the target path exists and is not a directory, the invocation is rejected.
4. If the target path is absent, `uninstall` completes idempotently and does not
   treat that state as an error.
5. If the target path exists but `.confluex-install-manifest.txt` is absent,
   `uninstall` completes idempotently and does not treat that state as an error.
6. If `.confluex-install-manifest.txt` is present but is not a valid install
   manifest, the invocation is rejected before any filesystem removal begins.
7. If a valid install manifest is present, `uninstall` removes every path listed
   in that manifest, including `.confluex-install-manifest.txt`, and removes no
   Confluex-owned path that is absent from that manifest.
8. `uninstall` does not modify or remove unrelated files or directories in the
   target path.

**Dependencies**:
- `FR-LIFE-001`
- `FR-OPT-014`

**Traceability**:
- Area: installation lifecycle
- Observable evidence: remaining target contents, idempotent behavior, rejection

### FR-LIFE-004
**Requirement**: Accepted `uninstall` invocations shall report one
machine-readable result line.

**Applicability**:
- accepted non-help `uninstall` invocations

**Rationale**:
- Operators and automation need a deterministic uninstallation result contract.

**Acceptance Criteria**:
1. If any Confluex-owned footprint was removed, `uninstall` emits exactly one
   stdout line `uninstall_result=removed target="<absolute_path>"`.
2. If no Confluex-owned footprint was present to remove, `uninstall` emits
   exactly one stdout line `uninstall_result=absent target="<absolute_path>"`.
3. `<absolute_path>` is the resolved absolute target serialized as a quoted path
   string.
4. Accepted `uninstall` invocations write nothing to `stderr` and exit `0`.

**Dependencies**:
- `FR-LIFE-003`
- `FR-UX-004`

**Traceability**:
- Area: installation lifecycle
- Observable evidence: uninstall result line, empty stderr, exit code

## 12. Run Lifecycle Requirements

### FR-RUN-001
**Requirement**: `export` and `plan` shall share one scope-discovery model.

**Applicability**:
- accepted `export` and `plan` runs

**Rationale**:
- Operators need planning and materialized export to reason about the same page
  scope.

**Acceptance Criteria**:
1. Both workflows require a root page id.
2. Both workflows validate root-page accessibility before traversal begins.
3. Both workflows apply the same scope-discovery rules in Section 13 to the same
   root page.
4. Differences between `export` and `plan` are limited to command-specific
   payload acquisition, persistence, encryption, and output-retention
   requirements stated elsewhere in this document.

**Dependencies**:
- `FR-SCOPE-001`
- `FR-SCOPE-008`

**Traceability**:
- Area: run lifecycle
- Observable evidence: accepted run behavior, scope reports

### FR-RUN-002
**Requirement**: `export` shall materialize page content and attachment payloads.

**Applicability**:
- accepted `export` runs

**Rationale**:
- Operators need a workflow that produces materialized page and attachment
  payloads.

**Acceptance Criteria**:
1. `export` materializes page HTML for successfully processed pages.
2. `export` materializes attachment payload files for processed pages when
   attachment-download work for those pages succeeds.
3. `export` produces the run-level report set.

**Dependencies**:
- `FR-DATA-006`
- `FR-DATA-007`
- `FR-REP-001`

**Traceability**:
- Area: run lifecycle
- Observable evidence: page payload folders, attachments, report set

### FR-RUN-003
**Requirement**: `plan` shall remain a dry-run planning workflow.

**Applicability**:
- accepted `plan` runs

**Rationale**:
- Operators need planning output without the cost and risk of payload
  materialization.

**Acceptance Criteria**:
1. `plan` acquires only the data required by Sections 13, 14, and 16 to
   discover pages, resolve supported links, determine attachment counts, and
   produce the run-level report set.
2. `plan` does not persist `page.html`.
3. `plan` does not persist downloaded attachment payload files.

**Dependencies**:
- `FR-DATA-005`
- `FR-REP-001`

**Traceability**:
- Area: run lifecycle
- Observable evidence: report set without materialized content payload

### FR-RUN-004
**Requirement**: Automatically generated output-root names shall identify the
workflow and root page.

**Applicability**:
- `export` without `--out`
- `plan` without `--out`

**Rationale**:
- Operators need generated output roots that are readable and collision-safe.

**Acceptance Criteria**:
1. `export` without `--out` generates the base directory name
   `confluence_dump_<page_id>_<YYYYMMDDTHHMMSSZ>`.
2. `plan` without `--out` generates the base directory name
   `confluence_plan_<page_id>_<YYYYMMDDTHHMMSSZ>`.
3. `<page_id>` is the canonical resolved root page identifier.
4. The timestamp is the run start time in UTC.
5. If the generated base directory name already exists, the product appends the
   smallest suffix `_<n>` with `n` starting at `1` that yields a non-existing
   path.
6. A generated output root is created as a direct child of the process current
   working directory.

**Dependencies**:
- `FR-OPT-002`
- `FR-OBS-003`

**Traceability**:
- Area: run lifecycle
- Observable evidence: generated output-root name and location

### FR-RUN-005
**Requirement**: Accepted export-related runs shall emit a deterministic
`RUN_START` line.

**Applicability**:
- accepted non-help `export` and `plan` runs

**Rationale**:
- Operators need one machine-readable start signal with run identity.

**Acceptance Criteria**:
1. The run emits exactly one stdout line in the format
   `RUN_START command=<command> page_id=<page_id> output_root="<absolute_path>"`.
2. `<command>` is `export` or `plan`.
3. `<page_id>` is the canonical resolved root page identifier.
4. `<absolute_path>` is the absolute logical plain output-root path for the run,
   serialized as a quoted path string; whenever the run later retains a report
   set, `summary.txt` reports the same path as `output_root`.
5. `RUN_START` is emitted only after root-page preflight succeeds and the
   logical plain output-root path has been determined.

**Dependencies**:
- `FR-VAL-007`
- `FR-REP-006`

**Traceability**:
- Area: run lifecycle
- Observable evidence: `RUN_START` line on stdout

### FR-RUN-006
**Requirement**: Accepted export-related runs shall emit deterministic
`RUN_PHASE` lines.

**Applicability**:
- accepted non-help `export` and `plan` runs

**Rationale**:
- Operators need coarse-grained phase visibility during long-running runs.

**Acceptance Criteria**:
1. If the run enters `scope_discovery`, `page_processing`, `report_generation`,
   or `encryption`, it emits exactly one stdout line
   `RUN_PHASE phase=<phase>` for that phase.
2. `RUN_PHASE phase=encryption` is emitted only if encryption is requested and
   the encryption phase actually begins.
3. Emitted `RUN_PHASE` lines appear in lifecycle order and each phase line
   appears at most once.

**Dependencies**:
- `FR-SEC-006`

**Traceability**:
- Area: run lifecycle
- Observable evidence: `RUN_PHASE` lines on stdout

### FR-RUN-007
**Requirement**: Accepted export-related runs that reach completion handling
shall emit a deterministic `RUN_COMPLETE` line.

**Applicability**:
- accepted non-help `export` and `plan` runs except those terminated solely by
  signal interruption before completion handling begins

**Rationale**:
- Operators need one machine-readable completion signal with the final status and
  final artifact location.

**Acceptance Criteria**:
1. The run emits exactly one stdout line in the format
   `RUN_COMPLETE final_status=<status> artifact=<artifact_value>`.
2. `<status>` uses the exact `final_status` vocabulary defined by `FR-OBS-001`.
3. If a plain output root, encrypted archive, or status sidecar remains on disk,
   `<artifact_value>` is the absolute path to that artifact serialized as a
   quoted path string.
4. If no inspectable run artifact remains on disk, `<artifact_value>` is exactly
   `none`.
5. `RUN_COMPLETE` is emitted after the final status and final artifact location
   have been determined and before process exit.

**Dependencies**:
- `FR-OBS-001`
- `FR-INT-002`
- `FR-SEC-004`

**Traceability**:
- Area: run lifecycle
- Observable evidence: `RUN_COMPLETE` line on stdout

## 13. Scope Discovery Requirements

### FR-SCOPE-001
**Requirement**: Successful root-page preflight shall always place the root page
in scope.

**Applicability**:
- accepted `export` and `plan` runs

**Rationale**:
- Operators need the selected root page to remain part of the run scope even if
  later work is degraded.

**Acceptance Criteria**:
1. After successful root-page preflight, the root page is in scope.
2. Later traversal or processing failure does not retroactively remove the root
   page from scope.

**Dependencies**:
- `FR-VAL-007`

**Traceability**:
- Area: scope discovery
- Observable evidence: manifest and summary interpretation

### FR-SCOPE-002
**Requirement**: The run scope shall include the full recursive child tree of
the root page.

**Applicability**:
- accepted `export` and `plan` runs

**Rationale**:
- The customer expects root-driven export, not just a single page export.

**Acceptance Criteria**:
1. Any page that is a descendant of the root page through recursive child
   traversal is in scope.
2. If recursive child knowledge is incomplete, the run records the applicable
   `child_listing` scope-finding row defined by `FR-DATA-003` rather than
   silently treating the child tree as complete.

**Dependencies**:
- `FR-DATA-003`
- `FR-REP-005`

**Traceability**:
- Area: scope discovery
- Observable evidence: manifest, scope-findings report

### FR-SCOPE-003
**Requirement**: The run scope shall include linked pages discovered from
root-tree page content through supported internal-link forms.

**Applicability**:
- accepted `export` and `plan` runs

**Rationale**:
- Operators need the export scope to include supported internal page references
  from the root-tree content.

**Acceptance Criteria**:
1. If a supported internal link in a root-tree page resolves to one unique target
   page, that target page is added to scope.
2. If the same linked page is discovered from multiple sources, the target page
   still appears only once in scope.

**Dependencies**:
- `FR-SCOPE-005`
- `FR-SCOPE-006`

**Traceability**:
- Area: scope discovery
- Observable evidence: manifest rows for linked pages

### FR-SCOPE-004
**Requirement**: Link-driven scope expansion shall be single-hop from root-tree
pages only.

**Applicability**:
- accepted `export` and `plan` runs

**Rationale**:
- Operators need bounded linked-page expansion rather than uncontrolled graph
  traversal.

**Acceptance Criteria**:
1. A page added to scope only because it was linked from a root-tree page does
   not add its own descendants solely because it is in scope.
2. Links found while processing a linked page that is not itself in the root
   child tree do not expand scope further.

**Dependencies**:
- `FR-SCOPE-003`

**Traceability**:
- Area: scope discovery
- Observable evidence: bounded scope contents in manifest and link reports

### FR-SCOPE-005
**Requirement**: The product shall support only documented internal-link forms
for link-driven scope expansion.

**Applicability**:
- accepted `export` and `plan` runs

**Rationale**:
- Operators need a bounded, explicit support profile rather than implicit claims
  of universal Confluence-markup support.

**Acceptance Criteria**:
1. Supported discovery forms are exactly:
   `child_result`, `content_id`, `page_ref`, `macro_param`, `href_page_id`,
   `href_space_title`, `ri_url_page_id`, and `ri_url_space_title`.
2. Link forms outside that documented set do not count as supported discovery
   forms.

**Dependencies**:
- `FR-SEC-001`

**Traceability**:
- Area: scope discovery
- Observable evidence: supported-link-form diagnostics, link resolution outcomes

### FR-SCOPE-006
**Requirement**: Link resolution shall be conservative and prefer unresolved
outcomes over guessed outcomes.

**Applicability**:
- accepted `export` and `plan` runs

**Rationale**:
- Operators need the product to avoid inventing page relationships it cannot
  justify.

**Acceptance Criteria**:
1. A discovered internal link is resolved only when it can be mapped to one
   unique target page identity.
2. If a discovered internal link does not resolve to one unique target page
   identity, it remains unresolved.
3. If title-candidate inspection is limited by `--max-find-candidates` and a
   unique target cannot be proven within that limit, the link remains
   unresolved.

**Dependencies**:
- `FR-OPT-016`
- `FR-REP-003`

**Traceability**:
- Area: scope discovery
- Observable evidence: resolved-links and unresolved-links reports

### FR-SCOPE-007
**Requirement**: False-positive link-like content shall not expand run scope.

**Applicability**:
- accepted `export` and `plan` runs

**Rationale**:
- Operators need scope expansion tied to real supported internal links, not to
  incidental text patterns.

**Acceptance Criteria**:
1. External links do not expand run scope.
2. Link-like text inside code-like or plain-text content that is not a supported
   link form does not expand run scope.
3. Child results that are not pages do not expand page scope.

**Dependencies**:
- `FR-SCOPE-005`

**Traceability**:
- Area: scope discovery
- Observable evidence: absence of false-positive pages in manifest

### FR-SCOPE-008
**Requirement**: Unsupported internal-looking reference patterns shall be
surfaced as scope findings.

**Applicability**:
- accepted `export` and `plan` runs

**Rationale**:
- Operators need explicit visibility when a run may be semantically incomplete
  because the product met the edge of its support profile.

**Acceptance Criteria**:
1. If the product encounters a reference pattern outside the supported discovery
   profile that still carries a Confluence page identifier or a Confluence
   `space/title` path, the run records exactly one `scope-findings.tsv` row with
   `finding_area=unsupported_pattern` and
   `finding_type=unsupported_internal_pattern`.
2. If at least one scope finding exists, `summary.txt` reports
   `scope_trust=degraded`.
3. If no scope findings exist, `summary.txt` reports `scope_trust=trusted`.

**Dependencies**:
- `FR-REP-005`
- `FR-OBS-002`

**Traceability**:
- Area: scope discovery
- Observable evidence: scope-findings report, summary scope-trust field

### FR-SCOPE-009
**Requirement**: Duplicate discovery paths and cycles shall not cause duplicate
page processing or unbounded traversal.

**Applicability**:
- accepted `export` and `plan` runs

**Rationale**:
- Operators need one stable page result per page even when the graph contains
  duplicate edges or cycles.

**Acceptance Criteria**:
1. A page is processed at most once per run.
2. Multiple discovery paths to the same page do not create duplicate processing.
3. Cyclic links and self-links do not create unbounded traversal.

**Dependencies**:
- `FR-SCOPE-003`
- `FR-SCOPE-004`

**Traceability**:
- Area: scope discovery
- Observable evidence: one manifest row per processed page, bounded completion

### FR-SCOPE-010
**Requirement**: Each processed page shall use one deterministic
`discovery_source` classification.

**Applicability**:
- accepted `export` and `plan` runs

**Rationale**:
- Operators need one stable page-classification rule when the same page is
  discovered through more than one scope path.

**Acceptance Criteria**:
1. The root page row in `manifest.tsv` uses `discovery_source=root`.
2. A non-root page that is part of the recursive child tree uses
   `discovery_source=tree` even if the same page is also discovered through a
   supported internal link.
3. A non-root page that is outside the recursive child tree and enters scope
   only through supported internal-link expansion uses
   `discovery_source=linked`.
4. No processed page is reported with more than one `discovery_source` value.

**Dependencies**:
- `FR-SCOPE-001`
- `FR-SCOPE-002`
- `FR-SCOPE-003`
- `FR-SCOPE-004`

**Traceability**:
- Area: scope discovery
- Observable evidence: `manifest.tsv` page classification

## 14. Data Acquisition Requirements

### FR-DATA-001
**Requirement**: The product shall acquire page metadata required for
black-box reporting.

**Applicability**:
- accepted `export` and `plan` runs

**Rationale**:
- Operators need page identifiers, titles, and space context in reports.

**Acceptance Criteria**:
1. For each processed page, the product acquires the data needed to report
   `page_id` and `page_title`.
2. When the page source provides a space key, the product acquires it as
   `space_key`.
3. If the page source does not provide a space key, the `space_key` field in
   `manifest.tsv` is serialized as an empty field.
4. If a page-local failure must be reported before page identity is known, the
   unavailable `page_id` and `page_title` field values are serialized as `none`.
5. If page-metadata acquisition for a page prevents the page's remaining
   required processing for the active command, the run records exactly one
   `failed-pages.tsv` row with `operation=page_metadata` for that condition.
6. If `--no-fail-fast` is not in effect, a `page_metadata` page-local failure
   stops further page processing after the failure is recorded.
7. If `--no-fail-fast` is in effect, a `page_metadata` page-local failure does
   not by itself prevent processing of later pages.

**Dependencies**:
- `FR-REP-001`
- `FR-REP-004`
- `FR-SAFE-002`

**Traceability**:
- Area: data acquisition
- Observable evidence: manifest and failed-pages field population

### FR-DATA-002
**Requirement**: The product shall acquire storage content required for
supported link discovery.

**Applicability**:
- accepted `export` and `plan` runs

**Rationale**:
- Supported internal-link discovery depends on page storage content.

**Acceptance Criteria**:
1. If a page is in scope, the product acquires that page's storage content for
   supported internal-link inspection.
2. If a storage-content problem affects supported-link inspection but does not
   prevent the page's remaining required processing for the active command, the
   run records exactly one `scope-findings.tsv` row with
   `finding_area=storage_content` and
   `finding_type=storage_unavailable`.
3. If storage content is acquired but cannot be interpreted well enough to
   complete supported-link inspection, and that interpretation problem does not
   prevent the page's remaining required processing for the active command, the
   run records exactly one `scope-findings.tsv` row with
   `finding_area=storage_content` and
   `finding_type=storage_uninterpretable`.
4. If storage-content acquisition or interpretation for a page prevents the
   page's remaining required processing for the active command, the run records
   exactly one `failed-pages.tsv` row with `operation=storage_content` for that
   condition and does not also record a scope-finding row for the same
   condition.
5. If `--no-fail-fast` is not in effect, a `storage_content` page-local failure
   stops further page processing after the failure is recorded.
6. If `--no-fail-fast` is in effect, a `storage_content` page-local failure
   does not by itself prevent processing of later pages.

**Dependencies**:
- `FR-SCOPE-005`
- `FR-REP-004`
- `FR-REP-005`
- `FR-SAFE-002`

**Traceability**:
- Area: data acquisition
- Observable evidence: link reports, scope-findings report, failed-pages report

### FR-DATA-003
**Requirement**: The product shall acquire child-listing data required for
recursive root-tree traversal.

**Applicability**:
- accepted `export` and `plan` runs

**Rationale**:
- Recursive child traversal requires explicit child-listing data.

**Acceptance Criteria**:
1. If the run includes the root page, the product acquires child-listing data
   needed to discover descendants recursively.
2. If child-listing data is known to be partial or paginated for scope
   determination, the run records exactly one `scope-findings.tsv` row with
   `finding_area=child_listing` and `finding_type=partial_listing` for that
   condition.
3. If child-listing completeness cannot be established for any reason other
   than the known partial-or-paginated case in criterion 2, and tree coverage
   therefore remains incomplete, the run records exactly one
   `scope-findings.tsv` row with `finding_area=child_listing` and
   `finding_type=incomplete_tree` for that condition.
4. If child-listing acquisition or interpretation for a page prevents that
   page's remaining required processing for the active command, the run records
   exactly one `failed-pages.tsv` row with `operation=child_listing` for that
   condition.
5. If `--no-fail-fast` is not in effect, a `child_listing` page-local failure
   stops further page processing after the failure is recorded.
6. If `--no-fail-fast` is in effect, a `child_listing` page-local failure does
   not by itself prevent processing of later pages.

**Dependencies**:
- `FR-SCOPE-002`
- `FR-REP-004`
- `FR-REP-005`
- `FR-SAFE-002`

**Traceability**:
- Area: data acquisition
- Observable evidence: scope-findings report, child-tree coverage in manifest

### FR-DATA-004
**Requirement**: The product shall acquire title-resolution candidate data when
title-based link resolution is attempted.

**Applicability**:
- accepted `export` and `plan` runs that attempt title-based resolution

**Rationale**:
- Conservative title resolution depends on visible candidate data.

**Acceptance Criteria**:
1. When title-based link resolution is attempted, the product acquires search
   results and candidate identity data for that attempt.
2. If `--max-find-candidates` prevents inspection of more candidates and unique
   resolution cannot be proven within that limit, the link is recorded in
   `unresolved-links.tsv` with `resolution_reason=candidate_limit`.
3. If candidate data is unavailable or incomplete for reasons other than the
   configured candidate limit and unique resolution therefore cannot be proven,
   the link is recorded in `unresolved-links.tsv` with
   `resolution_reason=insufficient_data`, and the run records exactly one
   `scope-findings.tsv` row with `finding_area=title_resolution` and
   `finding_type=candidate_visibility_incomplete` for that condition.
4. If title-resolution data acquisition or interpretation for a page prevents
   that page's remaining required processing for the active command, the run
   records exactly one `failed-pages.tsv` row with
   `operation=title_resolution` for that condition.
5. If `--no-fail-fast` is not in effect, a `title_resolution` page-local
   failure stops further page processing after the failure is recorded.
6. If `--no-fail-fast` is in effect, a `title_resolution` page-local failure
   does not by itself prevent processing of later pages.

**Dependencies**:
- `FR-SCOPE-006`
- `FR-REP-003`
- `FR-REP-004`
- `FR-REP-005`
- `FR-SAFE-002`

**Traceability**:
- Area: data acquisition
- Observable evidence: unresolved-links report, scope-findings report

### FR-DATA-005
**Requirement**: `plan` shall acquire attachment-preview data without
downloading attachment payload files.

**Applicability**:
- accepted `plan` runs

**Rationale**:
- Planning requires attachment visibility without materializing attachment
  payloads.

**Acceptance Criteria**:
1. If a processed page has attachments, `plan` acquires enough attachment-preview
   data to determine `attachment_count` without downloading attachment payload
   files.
2. If attachment-preview acquisition for a processed page fails, the run records
   exactly one `failed-pages.tsv` row with `operation=attachment_preview` for
   that condition.
3. If a page's attachment-preview acquisition fails and that page still appears
   in `manifest.tsv`, that row serializes `attachment_count=none`.
4. If `--no-fail-fast` is not in effect, an `attachment_preview` page-local
   failure stops further page processing after the failure is recorded.
5. If `--no-fail-fast` is in effect, an `attachment_preview` page-local failure
   does not by itself prevent processing of later pages.
6. `plan` never persists attachment payload files.

**Dependencies**:
- `FR-REP-001`
- `FR-SAFE-002`
- `FR-OUT-006`

**Traceability**:
- Area: data acquisition
- Observable evidence: manifest attachment counts, failed-pages rows, absence of
  attachment payload files

### FR-DATA-006
**Requirement**: `export` shall acquire and persist page HTML payload.

**Applicability**:
- accepted `export` runs

**Rationale**:
- Materialized export requires persisted page HTML for successfully exported
  pages.

**Acceptance Criteria**:
1. If a page is successfully materialized in `export`, the product persists
   `page.html` in that page's payload folder.
2. If page HTML materialization for a page fails, the run records exactly one
   `failed-pages.tsv` row with `operation=page_html` for that condition.
3. If `--no-fail-fast` is not in effect, a `page_html` page-local failure stops
   further page processing after the failure is recorded.
4. If `--no-fail-fast` is in effect, a `page_html` page-local failure does not
   by itself prevent processing of later pages.

**Dependencies**:
- `FR-RUN-002`
- `FR-SAFE-002`
- `FR-OUT-005`

**Traceability**:
- Area: data acquisition
- Observable evidence: `page.html` presence, failed-pages report

### FR-DATA-007
**Requirement**: `export` shall acquire and persist attachment payload files when
attachments are present.

**Applicability**:
- accepted `export` runs

**Rationale**:
- Materialized export requires attachment payloads for pages whose
  attachment-download work succeeds.

**Acceptance Criteria**:
1. If a processed page in `export` has attachments, the product acquires enough
   attachment data to determine `attachment_count` for that page unless
   attachment-download work fails before the count can be determined.
2. If attachment-download work succeeds for a processed page in `export`, the
   product persists that page's attachment payload files under that page's
   `attachments/` folder.
3. If a page still appears in `manifest.tsv` after attachment-download work for
   that page and the product did not determine `attachment_count`, that manifest
   row serializes `attachment_count=none`.
4. Each page-local attachment-download failure is recorded in
   `failed-pages.tsv` with `operation=attachment_download`.
5. If `--no-fail-fast` is not in effect, an `attachment_download` page-local
   failure stops further page processing after the failure is recorded.
6. If `--no-fail-fast` is in effect, an `attachment_download` page-local
   failure does not by itself prevent processing of later pages.
7. Persisted attachment payload files reside directly inside that page's
   `attachments/` folder and do not escape it.

**Dependencies**:
- `FR-RUN-002`
- `FR-SAFE-002`
- `FR-OUT-005`
- `FR-REP-002`

**Traceability**:
- Area: data acquisition
- Observable evidence: attachment files, failed-pages report

## 15. Output And Artifact Requirements

### FR-OUT-001
**Requirement**: Every accepted `export` or `plan` run shall have exactly one
logical plain output root.

**Applicability**:
- accepted `export` and `plan` runs

**Rationale**:
- Operators need one authoritative filesystem location for a run result.

**Acceptance Criteria**:
1. If the operator supplies `--out`, the resolved logical plain output-root path
   is the output root.
2. If the operator omits `--out`, the product generates exactly one output root.
3. If the chosen output-root path does not exist, the product creates that
   directory path, including missing parent directories, before writing run
   artifacts.

**Dependencies**:
- `FR-OPT-002`
- `FR-RUN-004`

**Traceability**:
- Area: output structure
- Observable evidence: created or reused output-root path

### FR-OUT-002
**Requirement**: A plain `export` output root shall have a stable top-level
artifact layout.

**Applicability**:
- `export` runs whose plain output root remains on disk

**Rationale**:
- Operators need a deterministic top-level layout for materialized export runs.

**Acceptance Criteria**:
1. The top level contains `pages/`, `manifest.tsv`, `resolved-links.tsv`,
   `unresolved-links.tsv`, `failed-pages.tsv`, `scope-findings.tsv`, and
   `summary.txt`.
2. If the plain export output root represents an interrupted or incomplete run,
   the top level also contains `INCOMPLETE`.

**Dependencies**:
- `FR-REP-001`
- `FR-INT-001`

**Traceability**:
- Area: output structure
- Observable evidence: top-level export artifact set

### FR-OUT-003
**Requirement**: A plain `plan` output root shall have a stable top-level
artifact layout.

**Applicability**:
- `plan` runs whose plain output root remains on disk

**Rationale**:
- Operators need a deterministic top-level layout for planning runs.

**Acceptance Criteria**:
1. The top level contains `manifest.tsv`, `resolved-links.tsv`,
   `unresolved-links.tsv`, `failed-pages.tsv`, `scope-findings.tsv`, and
   `summary.txt`.
2. If `plan` persisted any per-page metadata artifacts, the top level also
   contains `pages/`.
3. If the plain plan output root remains on disk because the run ended in a
   configured stop condition, the top level also contains `INCOMPLETE`.

**Dependencies**:
- `FR-REP-001`
- `FR-SAFE-004`

**Traceability**:
- Area: output structure
- Observable evidence: top-level plan artifact set

### FR-OUT-004
**Requirement**: Each processed page shall map to exactly one payload folder when
per-page artifacts are persisted.

**Applicability**:
- `export`
- `plan` with persisted per-page metadata

**Rationale**:
- Operators need a deterministic, page-scoped payload layout.

**Acceptance Criteria**:
1. Each persisted page has exactly one payload folder under `pages/`.
2. If the page source provides a space key, the payload folder path is
   `pages/<space_key_segment>/<page_folder>/`.
3. If the page source does not provide a space key, the payload folder path is
   `pages/_no_space/<page_folder>/`.
4. `<page_folder>` is exactly `page__<page_id>`.
5. For a non-empty `space_key`, `<space_key_segment>` is one deterministic
   single-segment encoding of that exact `space_key`.
6. Within one run, identical non-empty `space_key` values map to the same
   `<space_key_segment>`, and different non-empty `space_key` values map to
   different `<space_key_segment>` values.
7. `<space_key_segment>` and `<page_folder>` each occupy exactly one filesystem
   path segment and do not contain path separators, `.` segments, or `..`
   segments.
8. For each persisted page, the `folder` field in `manifest.tsv` is the
   authoritative relative path to that payload folder.

**Dependencies**:
- `FR-DATA-001`
- `FR-REP-001`

**Traceability**:
- Area: output structure
- Observable evidence: persisted page folder paths, manifest `folder` values

### FR-OUT-005
**Requirement**: Export page payload folders shall have a stable file structure.

**Applicability**:
- accepted `export` runs

**Rationale**:
- Operators need predictable placement of materialized content and metadata.

**Acceptance Criteria**:
1. A successfully materialized export page payload folder contains `page.html`.
2. If the page has persisted attachments, the folder contains `attachments/`.
3. If `--keep-metadata` is in effect and metadata acquisition succeeded, the
   folder also contains `_info.txt` and `_storage.xml`.

**Dependencies**:
- `FR-DATA-006`
- `FR-DATA-007`
- `FR-OPT-009`

**Traceability**:
- Area: output structure
- Observable evidence: file structure within export page payload folders

### FR-OUT-006
**Requirement**: Plan page payload folders shall have a stable file structure
when metadata persistence is enabled.

**Applicability**:
- accepted `plan` runs

**Rationale**:
- Operators need predictable metadata persistence in planning mode without
  accidental content export.

**Acceptance Criteria**:
1. Without `--keep-metadata`, `plan` does not persist `page.html`, attachments,
   `_info.txt`, or `_storage.xml`.
2. With `--keep-metadata` and successful metadata acquisition, a persisted plan
   page folder contains `_info.txt` and `_storage.xml`.
3. With `--keep-metadata` and acquired attachment-preview data, the persisted
   plan page folder also contains `_attachments_preview.txt`.

**Dependencies**:
- `FR-DATA-005`
- `FR-OPT-009`

**Traceability**:
- Area: output structure
- Observable evidence: file structure within plan page payload folders

### FR-OUT-007
**Requirement**: Top-level run artifacts shall have one stable functional
meaning.

**Applicability**:
- all runs that leave run artifacts on disk

**Rationale**:
- Operators need each artifact to have one authoritative interpretation.

**Acceptance Criteria**:
1. `manifest.tsv` means the authoritative list of processed pages.
2. `resolved-links.tsv` means the authoritative list of resolved source-to-target
   link dependencies.
3. `unresolved-links.tsv` means the authoritative list of discovered links that
   were not resolved to one unique target page.
4. `failed-pages.tsv` means the authoritative list of page-local failures.
5. `scope-findings.tsv` means the authoritative list of conditions that reduce
   confidence in scope completeness.
6. `summary.txt` means the authoritative machine-readable summary of run outcome.
7. `INCOMPLETE` means that the plain output root does not represent a cleanly
   completed plain run result.

**Dependencies**:
- `FR-REP-001`

**Traceability**:
- Area: output structure
- Observable evidence: stable artifact naming and interpretation

### FR-OUT-008
**Requirement**: Successful encrypted runs shall create a deterministic
instruction sidecar derived from the logical plain output-root path.

**Applicability**:
- runs with successful encryption

**Rationale**:
- Operators need a deterministic instruction-sidecar path for decrypt and
  extract guidance.

**Acceptance Criteria**:
1. If encryption succeeds, the product creates `<out>.tar.gz.gpg.txt`.
2. That instruction sidecar is UTF-8 text with LF line endings.
3. The instruction sidecar contains at least one line explaining how to decrypt
   the encrypted archive and at least one line explaining how to extract the
   decrypted archive.
4. The instruction sidecar path is a sibling path derived by
   appending its suffix to the logical plain output-root path string and is not
   created outside that parent directory.

**Dependencies**:
- `FR-SEC-001`

**Traceability**:
- Area: output structure
- Observable evidence: instruction sidecar path and contents

### FR-OUT-009
**Requirement**: Confidential-mode encryption failure shall create a
deterministic status sidecar derived from the logical plain output-root path.

**Applicability**:
- confidential-mode encryption failure

**Rationale**:
- Operators need a deterministic status-sidecar path that records
  confidential-mode encryption failure without leaving the plain output root
  behind.

**Acceptance Criteria**:
1. If confidential-mode encryption fails, the product creates `<out>.status.txt`.
2. `<out>.status.txt` is UTF-8 text with LF line endings and contains the line
   `final_status=encryption_failed`.
3. The status sidecar path is a sibling path derived by appending its suffix to
   the logical plain output-root path string and is not created outside that
   parent directory.

**Dependencies**:
- `FR-SEC-004`

**Traceability**:
- Area: output structure
- Observable evidence: status sidecar path and contents

## 16. Report Requirements

### FR-REP-001
**Requirement**: Every retained run result that this document defines as a
report-set container shall contain a complete report set.

**Applicability**:
- plain output roots that remain on disk
- successfully created encrypted archives

**Rationale**:
- Operators need one standard report set to interpret any retained result.

**Acceptance Criteria**:
1. If a plain `export` or `plan` output root remains on disk after a run, it
   contains `manifest.tsv`, `resolved-links.tsv`, `unresolved-links.tsv`,
   `failed-pages.tsv`, `scope-findings.tsv`, and `summary.txt`.
2. If the final result is an encrypted artifact, the report set is included
   inside that encrypted result under the single extracted top-level directory
   defined by `FR-SEC-001`.
3. If a `plan` run removes its output root after interruption or runtime failure,
   the removed path does not retain a partial report set.

**Dependencies**:
- `FR-OUT-002`
- `FR-OUT-003`
- `FR-SEC-001`

**Traceability**:
- Area: reports
- Observable evidence: presence or absence of the full report set

### FR-REP-002
**Requirement**: `manifest.tsv` shall use a stable schema and stable page
classification vocabulary.

**Applicability**:
- all report sets

**Rationale**:
- Operators and automation need one authoritative page inventory with stable
  structure and page classification.

**Acceptance Criteria**:
1. `manifest.tsv` is UTF-8 text with LF line endings and one header row.
2. The header row is exactly
   `page_id<TAB>space_key<TAB>page_title<TAB>folder<TAB>discovery_source<TAB>run_mode<TAB>attachment_count`.
3. `manifest.tsv` contains exactly one data row for each processed page.
4. Data rows are sorted first by `discovery_source` using the order `root`,
   `tree`, `linked`, then by ascending lexicographic order of the serialized
   `folder` value, with `none` sorted before any relative path value.
5. `folder` is the authoritative relative payload-folder path when per-page
   artifacts for that page remain on disk; otherwise `folder=none`.
6. `run_mode` uses only `export` or `plan`.
7. `discovery_source` uses only `root`, `tree`, or `linked`.
8. `attachment_count` uses either a non-negative base-10 integer or `none`.
9. Each manifest row's `discovery_source` value follows the classification rules
   in `FR-SCOPE-010`.

**Dependencies**:
- `FR-DATA-001`
- `FR-OUT-004`
- `FR-SCOPE-001`
- `FR-SCOPE-010`
- `FR-SCOPE-003`
- `FR-DATA-005`
- `FR-DATA-007`

**Traceability**:
- Area: reports
- Observable evidence: `manifest.tsv` header, rows, sort order, and values

### FR-REP-003
**Requirement**: `resolved-links.tsv` and `unresolved-links.tsv` shall use stable
link-report schemas.

**Applicability**:
- all report sets

**Rationale**:
- Operators need deterministic reporting of resolved and unresolved link
  outcomes.

**Acceptance Criteria**:
1. `resolved-links.tsv` is UTF-8 text with LF line endings and one header row.
2. The `resolved-links.tsv` header is exactly
   `source_page_id<TAB>source_title<TAB>link_kind<TAB>raw_link_value<TAB>target_page_id<TAB>target_space_key<TAB>target_title`.
3. `unresolved-links.tsv` is UTF-8 text with LF line endings and one header row.
4. The `unresolved-links.tsv` header is exactly
   `source_page_id<TAB>source_title<TAB>link_kind<TAB>raw_link_value<TAB>resolution_reason`.
5. `resolved-links.tsv` contains one row per resolved source-to-target link
   dependency.
6. `unresolved-links.tsv` contains one row per discovered link that remained
   unresolved.
7. `link_kind` uses only `child_result`, `content_id`, `page_ref`,
   `macro_param`, `href_page_id`, `href_space_title`, `ri_url_page_id`, or
   `ri_url_space_title`.
8. `resolution_reason` uses only `not_found`, `not_unique`, `candidate_limit`,
   or `insufficient_data`.

**Dependencies**:
- `FR-SCOPE-005`
- `FR-SCOPE-006`

**Traceability**:
- Area: reports
- Observable evidence: link report headers and row values

### FR-REP-004
**Requirement**: `failed-pages.tsv` shall use a stable schema for page-local
failures.

**Applicability**:
- all report sets

**Rationale**:
- Operators need one authoritative report of page-local failures.

**Acceptance Criteria**:
1. `failed-pages.tsv` is UTF-8 text with LF line endings and one header row.
2. The header row is exactly
   `page_id<TAB>page_title<TAB>operation<TAB>error_summary`.
3. `failed-pages.tsv` contains one row for each page-local failure.
4. `operation` uses only `page_metadata`, `storage_content`, `child_listing`,
   `title_resolution`, `attachment_preview`, `page_html`, or
   `attachment_download`.
5. If a failed page-local operation cannot be attributed to a known page
   identifier or title at reporting time, the unavailable field value is `none`.

**Dependencies**:
- `FR-DATA-001`
- `FR-DATA-002`
- `FR-DATA-003`
- `FR-DATA-004`
- `FR-DATA-005`
- `FR-DATA-006`
- `FR-DATA-007`

**Traceability**:
- Area: reports
- Observable evidence: failed-pages schema and operation values

### FR-REP-005
**Requirement**: `scope-findings.tsv` shall use a stable schema for scope and
support-profile findings.

**Applicability**:
- all report sets

**Rationale**:
- Operators need one authoritative report of findings that reduce confidence in
  scope completeness.

**Acceptance Criteria**:
1. `scope-findings.tsv` is UTF-8 text with LF line endings and one header row.
2. The header row is exactly
   `page_id<TAB>finding_area<TAB>finding_type<TAB>detail`.
3. `scope-findings.tsv` contains one row for each scope finding.
4. `finding_area` uses only `child_listing`, `storage_content`,
   `title_resolution`, or `unsupported_pattern`.
5. `finding_type` uses only `incomplete_tree`, `partial_listing`,
   `storage_unavailable`, `storage_uninterpretable`,
   `candidate_visibility_incomplete`, or `unsupported_internal_pattern`.
6. If a finding cannot be attributed to one page identity, the `page_id` value
   is `none`.

**Dependencies**:
- `FR-SCOPE-002`
- `FR-SCOPE-008`
- `FR-DATA-002`
- `FR-DATA-003`
- `FR-DATA-004`

**Traceability**:
- Area: reports
- Observable evidence: scope-findings schema and controlled values

### FR-REP-006
**Requirement**: `summary.txt` shall use a stable machine-readable schema.

**Applicability**:
- all report sets

**Rationale**:
- Operators and automation need one deterministic summary contract.

**Acceptance Criteria**:
1. `summary.txt` is UTF-8 text with LF line endings and `key=value` lines.
2. `summary.txt` contains these keys exactly once each and in this exact order:
   `command`, `page_id`, `output_root`, `output_path_provenance`,
   `support_profile`, `final_status`, `scope_trust`, `processed_pages`,
   `root_pages`, `tree_pages`, `linked_pages`, `other_pages`,
   `resolved_links`, `unresolved_links`, `scope_findings`,
   `failed_operations`, `downloaded_mib_total`,
   `downloaded_mib_content`, `downloaded_mib_metadata`,
   `blocking_reasons`, `interrupt_reason`, `resume_mode`,
   `resume_schema_version`, `reused_pages`, `fresh_pages`,
   `encryption_enabled`, and `encryption_successful`, and no additional keys.
3. Count keys use non-negative base-10 integers unless a more specific
   requirement defines decimal formatting.
4. Boolean-like keys use `0` or `1`.
5. Token-like keys use `none` when no value applies unless a more specific
   requirement defines another value.

**Dependencies**:
- `FR-OBS-001`
- `FR-OBS-008`

**Traceability**:
- Area: reports
- Observable evidence: `summary.txt` key order and serialization

### FR-REP-007
**Requirement**: The required TSV reports shall preserve one-record-per-line
machine readability.

**Applicability**:
- all required `*.tsv` reports

**Rationale**:
- Operators and automation need deterministic TSV serialization without embedded
  control characters.

**Acceptance Criteria**:
1. Each header row and each data row in every required TSV report occupies
   exactly one physical line terminated by LF.
2. No serialized TSV field value contains TAB, LF, or CR.
3. Each required TSV data row contains exactly the same number of TAB-separated
   fields as its header row.
4. If a source value would otherwise contain TAB, LF, or CR, the product
   normalizes each such character to a single ASCII space before TSV
   serialization.

**Dependencies**:
- `FR-REP-002`
- `FR-REP-003`
- `FR-REP-004`
- `FR-REP-005`

**Traceability**:
- Area: reports
- Observable evidence: TSV row and field serialization

### FR-REP-008
**Requirement**: Summary and report counts shall remain arithmetically
consistent.

**Applicability**:
- all report sets

**Rationale**:
- Operators need summary counts that can be trusted against the report files.

**Acceptance Criteria**:
1. `processed_pages` equals the number of data rows in `manifest.tsv`.
2. `root_pages`, `tree_pages`, `linked_pages`, and `other_pages` equal the
   number of manifest rows in those categories; `other_pages` is `0` for all
   runs governed by this document.
3. `resolved_links`, `unresolved_links`, `scope_findings`, and
   `failed_operations` equal the number of data rows in their corresponding
   report files.
4. `resume_mode=1` requires `processed_pages = reused_pages + fresh_pages`.

**Dependencies**:
- `FR-REP-002`
- `FR-OBS-005`
- `FR-OBS-008`

**Traceability**:
- Area: reports
- Observable evidence: internal consistency between report files and summary

### FR-REP-009
**Requirement**: Required TSV reports shall use deterministic data-row ordering.

**Applicability**:
- all required `*.tsv` reports

**Rationale**:
- Operators and automation need repeated runs with the same report content to
  serialize rows in a predictable order.

**Acceptance Criteria**:
1. `manifest.tsv` data-row ordering is governed only by `FR-REP-002`.
2. In `resolved-links.tsv`, `unresolved-links.tsv`, `failed-pages.tsv`, and
   `scope-findings.tsv`, data rows are sorted in ascending bytewise
   lexicographic order of the complete serialized data row.
3. If a required TSV report has no data rows, the file still contains its
   header row and no data rows.

**Dependencies**:
- `FR-REP-002`
- `FR-REP-003`
- `FR-REP-004`
- `FR-REP-005`
- `FR-REP-007`

**Traceability**:
- Area: reports
- Observable evidence: deterministic data-row ordering and header-only empty
  reports

## 17. Safety Requirements

### FR-SAFE-001
**Requirement**: The product shall warn about effectively unbounded non-safe
runs.

**Applicability**:
- accepted `export` and `plan` runs

**Rationale**:
- Operators need an explicit warning when a run may grow without practical
  bounds.

**Acceptance Criteria**:
1. If `export` or `plan` is invoked without `--safe`, without a positive
   `--max-pages`, and without a positive `--max-download-mib`, the product emits
   an explicit warning that the run is effectively unbounded.
2. The unbounded-run warning recommends at least one of `--safe`,
   `--max-pages`, or `--max-download-mib`.
3. The product does not emit the unbounded-run warning if `--safe` is in effect
   or either positive limit is in effect.

**Dependencies**:
- `FR-UX-003`
- `FR-OPT-003`
- `FR-OPT-015`

**Traceability**:
- Area: safety
- Observable evidence: stderr warning output

### FR-SAFE-002
**Requirement**: The product shall distinguish fail-fast behavior from
best-effort behavior.

**Applicability**:
- accepted `export` and `plan` runs

**Rationale**:
- Operators need to choose whether page-local failures stop the run or remain
  visible while later work continues.

**Acceptance Criteria**:
1. Without `--no-fail-fast`, a page-local failure stops further page processing
   immediately unless a more specific requirement explicitly classifies that
   condition as non-fatal.
2. With `--no-fail-fast`, a page-local failure is recorded and the run continues
   to later pages that have not yet been processed unless another stop condition
   ends the run.
3. Recorded page-local failures remain visible in the report set in both modes.

**Dependencies**:
- `FR-OPT-008`
- `FR-REP-004`

**Traceability**:
- Area: safety
- Observable evidence: continued processing behavior and failed-pages reporting

### FR-SAFE-003
**Requirement**: `--critical` shall act as a fail-closed policy overlay.

**Applicability**:
- accepted `export --critical` and `plan --critical` runs

**Rationale**:
- Operators need a mode that blocks completion when findings remain.

**Acceptance Criteria**:
1. If a completed run under `--critical` has unresolved links, scope findings, or
   failed page-local operations, `summary.txt` reports
   `final_status=policy_failed`.
2. If a run under `--critical` would otherwise qualify for a clean success,
   `summary.txt` reports `final_status=success`.
3. If a run under `--critical` ends because of interruption, runtime failure, or
   configured stop, the result uses the underlying non-policy outcome rather than
   `policy_failed`.

**Dependencies**:
- `FR-OPT-004`
- `FR-OBS-001`

**Traceability**:
- Area: safety
- Observable evidence: summary final status, exit code

### FR-SAFE-004
**Requirement**: Configured stop conditions shall yield explicit incomplete
outcomes.

**Applicability**:
- accepted `export` and `plan` runs stopped by configured limits

**Rationale**:
- Operators need limit-driven early stops to be clearly distinguishable from
  clean success.

**Acceptance Criteria**:
1. If `--max-pages` stops the run, `summary.txt` reports
   `final_status=incomplete` and `interrupt_reason=max_pages_limit_reached`.
2. If `--max-download-mib` stops the run, `summary.txt` reports
   `final_status=incomplete` and
   `interrupt_reason=max_download_limit_reached`.
3. If a configured stop condition occurs in `export`, the plain output root
   remains on disk as an inspectable partial result.
4. A configured stop condition causes exit code `3`.

**Dependencies**:
- `FR-OPT-015`
- `FR-OBS-004`
- `FR-OBS-006`

**Traceability**:
- Area: safety
- Observable evidence: summary fields, exit code

### FR-SAFE-005
**Requirement**: Partial results that remain on disk shall remain interpretable.

**Applicability**:
- accepted `export` and `plan` runs that leave partial results on disk

**Rationale**:
- Operators need retained partial results to remain machine-interpretable.

**Acceptance Criteria**:
1. If a partial plain output root remains on disk, it still contains the full
   report set.
2. If a partial plain output root remains on disk, the top level contains
   `INCOMPLETE`.
3. A partial result that remains on disk after signal interruption, runtime
   failure, or configured stop is distinguishable from clean success without
   reading internal logs.

**Dependencies**:
- `FR-REP-001`
- `FR-OUT-007`

**Traceability**:
- Area: safety
- Observable evidence: retained partial artifact set, summary status

### FR-SAFE-006
**Requirement**: `plan` shall preserve configured-stop results but discard
misleading abnormal partial results.

**Applicability**:
- accepted `plan` runs

**Rationale**:
- Operators need limited plan results to remain inspectable, but interrupted or
  failed plan roots should not masquerade as complete plans.

**Acceptance Criteria**:
1. If a `plan` run ends because `--max-pages` or `--max-download-mib` was
   reached, the plain output root remains on disk as an inspectable partial
   result.
2. If a `plan` run ends because of signal interruption, the product removes the
   plain output root created for that run.
3. If a `plan` run ends because of a runtime failure after work has started, the
   product removes the plain output root created for that run.

**Dependencies**:
- `FR-SAFE-004`
- `FR-INT-002`
- `FR-INT-003`

**Traceability**:
- Area: safety
- Observable evidence: retained or removed plan output roots

## 18. Interruption And Runtime-Failure Requirements

### FR-INT-001
**Requirement**: An interrupted `export` run shall leave an inspectable partial
plain output root.

**Applicability**:
- accepted `export` runs interrupted after the output root has been created

**Rationale**:
- Operators need a real export interrupted mid-run to remain inspectable rather
  than disappear.

**Acceptance Criteria**:
1. Already written artifacts in the plain output root remain on disk.
2. The top level contains `INCOMPLETE`.
3. `summary.txt` reports `final_status=interrupted` and
   `interrupt_reason=signal_interrupt`.

**Dependencies**:
- `FR-SAFE-005`
- `FR-OBS-004`

**Traceability**:
- Area: interruption
- Observable evidence: retained export root, marker file, summary fields

### FR-INT-002
**Requirement**: An interrupted `plan` run shall not leave a misleading partial
output root.

**Applicability**:
- accepted `plan` runs interrupted before completion

**Rationale**:
- Operators should not mistake an interrupted plan root for a valid final plan.

**Acceptance Criteria**:
1. The product removes the plain output root created for the interrupted plan
   run.
2. The removed path does not retain a partial report set.

**Dependencies**:
- `FR-SAFE-006`

**Traceability**:
- Area: interruption
- Observable evidence: absence of the interrupted plan output root

### FR-INT-003
**Requirement**: Runtime failure after command work has started shall be
reported explicitly.

**Applicability**:
- accepted invocations that fail after command work has started

**Rationale**:
- Operators need a runtime failure to be visible and distinguishable from
  configured-stop or clean outcomes.

**Acceptance Criteria**:
1. If a runtime failure stops an `export` run after work has started, the plain
   output root remains on disk and `summary.txt` reports
   `final_status=incomplete` and `interrupt_reason=runtime_error`.
2. If a runtime failure stops a `plan` run after work has started, the product
   removes the plain output root created for that run and does not leave a
   partial report set behind at that path.
3. Runtime failure after command work has started causes exit code `4` for all
   accepted workflows governed by this document.

**Dependencies**:
- `FR-SAFE-005`
- `FR-OBS-004`
- `FR-OBS-006`

**Traceability**:
- Area: interruption
- Observable evidence: summary fields, removed plan root, exit code

## 19. Resume And Recovery Requirements

### FR-RES-001
**Requirement**: Resume compatibility shall be checked by machine-readable
recovery criteria.

**Applicability**:
- `export --resume --out <dir>`

**Rationale**:
- Operators need explicit compatibility gating before prior export output is
  reused.

**Acceptance Criteria**:
1. A candidate resume root contains at least `manifest.tsv`, `summary.txt`, and
   `INCOMPLETE` from a prior plain export run.
2. The prior `summary.txt` reports `command=export`,
   `support_profile=default`, `resume_mode=0`, `encryption_successful=0`, and
   `resume_schema_version=1`, and its `page_id` value equals the current
   invocation's `--page-id` value.
3. The prior `summary.txt` reports `final_status=incomplete` or
   `final_status=interrupted`.
4. Report counts in the existing output root remain internally consistent with
   the report-derived summary fields.
5. If any compatibility check fails, the invocation is rejected before reuse
   begins.

**Dependencies**:
- `FR-OPT-007`
- `FR-REP-008`

**Traceability**:
- Area: resume and recovery
- Observable evidence: acceptance or rejection of resume roots

### FR-RES-002
**Requirement**: A resumed export run shall rediscover scope from the root page.

**Applicability**:
- accepted `export --resume --out <dir>` runs

**Rationale**:
- Operators need resume to continue from the current root-page truth, not to
  trust the prior manifest blindly.

**Acceptance Criteria**:
1. A resumed export run validates root-page accessibility again.
2. A resumed export run rediscovers run scope from the root page again rather
   than treating the previous manifest as final scope truth.

**Dependencies**:
- `FR-VAL-007`
- `FR-SCOPE-001`

**Traceability**:
- Area: resume and recovery
- Observable evidence: re-run scope and preflight behavior

### FR-RES-003
**Requirement**: Resume shall reuse only safely attributable page payload.

**Applicability**:
- accepted resumed export runs

**Rationale**:
- Operators need safe reuse rather than guessed reuse of prior page payload.

**Acceptance Criteria**:
1. A prior page payload may be reused only when the prior manifest identifies the
   page and its `folder` path still resolves inside the active output root to
   payload for that same page.
2. If prior payload cannot be safely attributed to the same page, the product
   materializes fresh payload instead of reusing it.
3. If a prior `folder` path resolves outside the active output root, the resume
   invocation is rejected.

**Dependencies**:
- `FR-RES-001`
- `FR-REP-002`

**Traceability**:
- Area: resume and recovery
- Observable evidence: payload reuse behavior, rejection behavior

### FR-RES-004
**Requirement**: A resumed export run shall regenerate run-level reports for the
new run.

**Applicability**:
- accepted resumed export runs

**Rationale**:
- Operators need reports that describe the current rerun, not stale prior
  report-state.

**Acceptance Criteria**:
1. A resumed export run regenerates `manifest.tsv`, `resolved-links.tsv`,
   `unresolved-links.tsv`, `failed-pages.tsv`, `scope-findings.tsv`, and
   `summary.txt` for the new run.
2. For a resumed export run, `summary.txt` reports `resume_mode=1`.
3. For a non-resume export run or any `plan` run, `summary.txt` reports
   `resume_mode=0`.
4. If payload for a page is reused in a resumed export run, the regenerated
   `manifest.tsv` still contains exactly one row for that page.

**Dependencies**:
- `FR-RES-003`
- `FR-REP-006`

**Traceability**:
- Area: resume and recovery
- Observable evidence: regenerated report files and summary resume fields

## 20. Encryption Requirements

### FR-SEC-001
**Requirement**: A successfully encrypted run shall be materialized as an
encrypted archive plus decrypt/extract instructions.

**Applicability**:
- accepted encrypted `export` and `plan` runs

**Rationale**:
- Operators need one encrypted result artifact plus clear operator instructions.

**Acceptance Criteria**:
1. Successful encryption creates `<out>.tar.gz.gpg`.
2. Successful encryption creates `<out>.tar.gz.gpg.txt`.
3. After successful encryption, the plain output root is removed from disk.
4. If the encrypted archive is decrypted and extracted into an empty directory,
   extraction creates exactly one top-level directory whose basename is the
   basename component of `<out>`.
5. That extracted top-level directory contains the report set required by
   `FR-REP-001` and the top-level artifact layout required by `FR-OUT-002` for
   `export` or `FR-OUT-003` for `plan`, whichever matches the originating
   command.

**Dependencies**:
- `FR-OUT-008`
- `FR-REP-001`

**Traceability**:
- Area: encryption
- Observable evidence: encrypted archive, instruction sidecar, absence of plain
  output root

### FR-SEC-002
**Requirement**: Encryption-recipient validation shall occur before traversal or
any run-artifact creation begins.

**Applicability**:
- non-help `export` and `plan` invocations with encryption requested

**Rationale**:
- Operators need encryption failures caused by invalid recipients to happen
  before the CLI starts expensive or sensitive run work.

**Acceptance Criteria**:
1. If encryption is enabled, the product validates the effective recipient
   before traversal, output-root reuse, or artifact creation begins.
2. If the effective recipient fails validation, the invocation is rejected.

**Dependencies**:
- `FR-OPT-005`
- `FR-OPT-006`
- `FR-OPT-011`
- `FR-OPT-018`

**Traceability**:
- Area: encryption
- Observable evidence: rejection timing before traversal or artifact creation

### FR-SEC-003
**Requirement**: Standard encrypted mode shall preserve plaintext output on
encryption failure.

**Applicability**:
- accepted `export --encrypt`
- accepted `plan --encrypt`

**Rationale**:
- Operators need a recoverable standard encrypted mode that does not discard the
  plaintext result when encryption itself fails.

**Acceptance Criteria**:
1. If encryption fails in standard encrypted mode, the plain output root remains
   available on disk.
2. If encryption fails in standard encrypted mode, `summary.txt` reports
   `final_status=encryption_failed`.
3. If encryption fails in standard encrypted mode, the failed encrypted path is
   not presented as a successful encrypted result.

**Dependencies**:
- `FR-OPT-005`
- `FR-OBS-001`

**Traceability**:
- Area: encryption
- Observable evidence: retained plain output root, summary final status

### FR-SEC-004
**Requirement**: Confidential mode shall remove the plain output root on
encryption failure.

**Applicability**:
- accepted `export --confidential`
- accepted `plan --confidential`

**Rationale**:
- Operators in confidentiality-first mode need encryption failure to avoid
  leaving plaintext payload behind.

**Acceptance Criteria**:
1. If `--confidential` is in effect and encryption fails after any plaintext run
   artifact has been written, the plain output root is removed from disk.
2. If `--confidential` encryption fails, the product creates `<out>.status.txt`.
3. `<out>.status.txt` contains the line `final_status=encryption_failed`.

**Dependencies**:
- `FR-OPT-006`
- `FR-OUT-009`

**Traceability**:
- Area: encryption
- Observable evidence: absence of plain output root, status sidecar contents

### FR-SEC-005
**Requirement**: Confidential mode shall warn about unprotected persistent logs.

**Applicability**:
- accepted confidential-mode runs with `--log-file`

**Rationale**:
- Operators need an explicit warning that a persistent log is not covered by
  plaintext-payload cleanup.

**Acceptance Criteria**:
1. If `--confidential` is combined with `--log-file`, the product emits an
   explicit warning to `stderr`.
2. The first line of that warning begins with `WARNING: `.
3. The warning identifies that the persistent log file remains outside
   plaintext-cleanup guarantees.

**Dependencies**:
- `FR-OPT-010`
- `FR-UX-003`

**Traceability**:
- Area: encryption
- Observable evidence: stderr warning output

### FR-SEC-006
**Requirement**: Encryption shall begin only for completed run results that
reach the encryption phase.

**Applicability**:
- accepted encrypted `export` and `plan` runs

**Rationale**:
- Operators need encryption to run only for completed results, not for
  interrupted or incomplete partial runs.

**Acceptance Criteria**:
1. If encryption is requested and the pre-encryption outcome is `success`,
   `success_with_findings`, or `policy_failed`, the encryption phase begins.
2. If the run ends because of a configured stop condition, a runtime failure, or
   a signal interruption, the encryption phase does not begin.
3. If the encryption phase does not begin and `summary.txt` is persisted,
   `summary.txt` reports `encryption_successful=0`.

**Dependencies**:
- `FR-OBS-001`
- `FR-OBS-007`

**Traceability**:
- Area: encryption
- Observable evidence: presence or absence of encryption phase and encrypted
  artifacts

## 21. Observability And Outcome Requirements

### FR-OBS-001
**Requirement**: `summary.txt` shall use a stable vocabulary for final run
status.

**Applicability**:
- all report sets

**Rationale**:
- Operators need one stable final-status vocabulary across clean completion,
  completion with findings, policy failure, incomplete completion,
  interruption, and encryption failure.

**Acceptance Criteria**:
1. `final_status` uses only `success`, `success_with_findings`,
   `policy_failed`, `incomplete`, `interrupted`, or `encryption_failed`.
2. A completed run that does not later end in encryption failure and has
   `blocking_reasons=none` uses `final_status=success`.
3. A completed run that does not later end in encryption failure and has
   `blocking_reasons` not equal to `none` uses
   `final_status=success_with_findings` unless `--critical` converts the outcome
   to `policy_failed`.
4. A configured stop condition or runtime failure that leaves the run incomplete
   uses `final_status=incomplete`.
5. Signal interruption uses `final_status=interrupted`.
6. Encryption failure after encryption was requested uses
   `final_status=encryption_failed`.

**Dependencies**:
- `FR-SAFE-003`
- `FR-SAFE-004`
- `FR-INT-001`
- `FR-SEC-003`

**Traceability**:
- Area: observability and outcomes
- Observable evidence: `summary.txt` final-status field, `RUN_COMPLETE`

### FR-OBS-002
**Requirement**: `summary.txt` shall use a stable vocabulary for scope trust.

**Applicability**:
- all report sets

**Rationale**:
- Operators need a compact summary of whether the product believes semantic scope
  completeness is trusted or degraded.

**Acceptance Criteria**:
1. `scope_trust` uses only `trusted` or `degraded`.
2. If `scope-findings.tsv` contains at least one data row, `scope_trust=degraded`.
3. If `scope-findings.tsv` contains no data rows, `scope_trust=trusted`.

**Dependencies**:
- `FR-SCOPE-008`
- `FR-REP-005`

**Traceability**:
- Area: observability and outcomes
- Observable evidence: `summary.txt` scope-trust field

### FR-OBS-003
**Requirement**: `summary.txt` shall use a stable vocabulary for output-path
provenance.

**Applicability**:
- all report sets

**Rationale**:
- Operators need to know whether the output root was generated or explicitly
  chosen.

**Acceptance Criteria**:
1. `output_path_provenance` uses only `explicit` or `generated`.
2. If the operator supplied `--out`, `output_path_provenance=explicit`.
3. If the product generated the output root automatically,
   `output_path_provenance=generated`.

**Dependencies**:
- `FR-OPT-002`
- `FR-RUN-004`

**Traceability**:
- Area: observability and outcomes
- Observable evidence: `summary.txt` output-path-provenance field

### FR-OBS-004
**Requirement**: `summary.txt` shall use stable vocabularies for blocking
reasons and interrupt reasons.

**Applicability**:
- all report sets

**Rationale**:
- Operators need a compact explanation of why the final status is not clean
  success.

**Acceptance Criteria**:
1. `blocking_reasons` uses `none` or a comma-separated list of one or more
   unique tokens chosen from `unresolved_links`, `scope_findings`, and
   `failed_operations`.
2. If `blocking_reasons` is not `none`, tokens appear only in this order:
   `unresolved_links`, `scope_findings`, `failed_operations`.
3. `interrupt_reason` uses only `none`, `max_pages_limit_reached`,
   `max_download_limit_reached`, `runtime_error`, or `signal_interrupt`.
4. `blocking_reasons=none` if and only if `summary.txt` reports
   `unresolved_links=0`, `scope_findings=0`, and `failed_operations=0`.
5. If `summary.txt` reports a value greater than `0` for `unresolved_links`,
   `scope_findings`, or `failed_operations`, the corresponding token appears
   exactly once in `blocking_reasons`.
6. `interrupt_reason=none` for completed runs and for encryption failures that
   occur after a completed pre-encryption run result has been produced.

**Dependencies**:
- `FR-SAFE-004`
- `FR-INT-003`
- `FR-REP-008`

**Traceability**:
- Area: observability and outcomes
- Observable evidence: `summary.txt` blocking-reasons and interrupt-reason fields

### FR-OBS-005
**Requirement**: `summary.txt` shall expose recovery accounting through stable
fields.

**Applicability**:
- all report sets

**Rationale**:
- Operators need to know whether resume actually reused payload and how much.

**Acceptance Criteria**:
1. `resume_mode` uses `0` or `1`.
2. `resume_schema_version` uses only `1`.
3. If `resume_mode=1`, `summary.txt` reports `reused_pages` and `fresh_pages`.
4. If `resume_mode=0`, `reused_pages=0` and `fresh_pages=<processed_pages>`.
5. If `resume_mode=1` and no payload was reused, `reused_pages=0`.

**Dependencies**:
- `FR-RES-004`
- `FR-REP-008`

**Traceability**:
- Area: observability and outcomes
- Observable evidence: recovery-accounting fields in `summary.txt`

### FR-OBS-006
**Requirement**: The CLI shall use stable exit codes for black-box automation.

**Applicability**:
- all invocations

**Rationale**:
- Operators and automation need exit codes that distinguish the major outcome
  classes.

**Acceptance Criteria**:
1. Rejected invocations exit `1`.
2. Accepted `export` and `plan` runs that terminate with
   `final_status=success` or `final_status=success_with_findings` exit `0`.
3. Accepted `doctor`, `config`, `install`, and `uninstall` invocations that
   complete according to this document exit `0`.
4. `policy_failed` exits `2`.
5. Configured stop conditions exit `3`.
6. Runtime failure after command work has started exits `4`.
7. `encryption_failed` exits `5`.
8. Signal interruption exits `130`.

**Dependencies**:
- `FR-VAL-009`
- `FR-INT-003`
- `FR-SAFE-004`

**Traceability**:
- Area: observability and outcomes
- Observable evidence: process exit code

### FR-OBS-007
**Requirement**: `summary.txt` shall use stable vocabularies and invariants for
the remaining required keys.

**Applicability**:
- all report sets

**Rationale**:
- Operators need the rest of the summary fields to remain stable and
  machine-readable.

**Acceptance Criteria**:
1. `command` uses only `export` or `plan`.
2. `support_profile` uses only `default`.
3. `output_root` reports the absolute logical plain output-root path serialized
   as a quoted path string, even if encryption later removes that directory from
   disk.
4. `page_id` reports the canonical resolved root page identifier.
5. `encryption_enabled=1` if encryption was requested; otherwise `0`.
6. `encryption_successful=1` if and only if an encrypted archive was created
   successfully for the run; otherwise `0`.

**Dependencies**:
- `FR-REP-006`
- `FR-SEC-006`

**Traceability**:
- Area: observability and outcomes
- Observable evidence: stable `summary.txt` key values

### FR-OBS-008
**Requirement**: `summary.txt` shall use stable counting semantics for
download-volume fields.

**Applicability**:
- all report sets

**Rationale**:
- Operators need download-volume metrics that are reproducible and
  machine-comparable.

**Acceptance Criteria**:
1. `downloaded_mib_total`, `downloaded_mib_content`, and
   `downloaded_mib_metadata` use non-negative decimal values serialized with
   exactly three digits after the decimal point.
2. Download-volume accounting is accumulated in whole bytes before MiB
   serialization.
3. `downloaded_mib_content` counts only bytes acquired during the current run for
   `page.html` materialization and attachment payload downloads.
4. `downloaded_mib_metadata` counts only bytes acquired during the current run
   for page metadata, storage-format data, and attachment-preview data.
5. `downloaded_mib_total` is derived from the exact arithmetic sum of the
   content-byte counter and the metadata-byte counter.
6. For MiB serialization, `1 MiB` means exactly `1,048,576` bytes.

**Dependencies**:
- `FR-DATA-001`
- `FR-DATA-002`
- `FR-DATA-003`
- `FR-DATA-004`
- `FR-DATA-005`
- `FR-DATA-006`
- `FR-DATA-007`

**Traceability**:
- Area: observability and outcomes
- Observable evidence: summary MiB fields and underlying report semantics

## 22. Conformance Outcome Matrix

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

## 23. Traceability Model

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

## 24. Glossary

- **accepted invocation**: A CLI invocation that passes validation and begins the
  requested command workflow.
- **command work**: The first externally observable workflow behavior of an
  accepted invocation other than help rendering.
- **completed run**: An accepted `export` or `plan` run that reaches
  `RUN_COMPLETE` without a signal interruption, configured stop condition, or
  runtime failure before completion handling.
- **blocking reason**: A run condition represented in `summary.txt` by the
  tokens `unresolved_links`, `scope_findings`, or `failed_operations`.
- **canonical page identifier**: The unsigned base-10 page-id string produced by
  successful page resolution or page-access verification.
- **child tree**: The recursive descendant tree of the root page.
- **effective encryption recipient**: The encryption-recipient identity in
  effect for the current command after applying this precedence order:
  accepted command-line `--encryption-key`, then saved default recipient, then
  no recipient.
- **logical plain output root**: The directory path selected explicitly or
  generated for a run before any optional encrypted replacement is created.
- **page-local failure**: A failure confined to one page's acquisition,
  interpretation, materialization, or attachment-processing work.
- **plain output root**: An unencrypted output-root directory that remains
  directly inspectable on disk.
- **processed page**: A page in run scope whose command-specific page-processing
  work begins after the product has established one unique page identity for
  that page. Each processed page is represented by exactly one row in
  `manifest.tsv` for the current run. In a resumed export run this includes
  pages whose payload was reused and pages materialized afresh. A scope
  candidate that fails before one unique page identity is established is not a
  processed page.
- **process current working directory**: The filesystem directory from which the
  CLI invocation is launched.
- **recovery-compatible output root**: An existing plain export output root whose
  prior reports satisfy the resume rules in this document.
- **rejected invocation**: A CLI invocation that fails validation before command
  work begins.
- **root page**: The page selected by `--page-id` as the starting point of an
  `export` or `plan` run.
- **runtime failure**: A non-page-local failure after command work has started
  that prevents the accepted command from completing according to its normal
  workflow.
- **scope finding**: A machine-readable finding that reduces confidence in scope
  completeness.
- **support profile**: The documented set of internal-link forms and parsing
  behaviors that the product claims to support.
