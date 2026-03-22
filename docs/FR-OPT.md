# Option Semantics Requirements


### FR-0020
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
- `FR-0012`
- `FR-0013`
- `FR-0014`

**Traceability**:
- Area: option semantics
- Observable evidence: workflow behavior, page-access diagnostics, rejection

### FR-0021
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
- `FR-0016`
- `FR-0055`
- `FR-0115`

**Traceability**:
- Area: option semantics
- Observable evidence: output-root location, path normalization, summary output

### FR-0022
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
- `FR-0012`
- `FR-0094`

**Traceability**:
- Area: option semantics
- Observable evidence: effective limit and throttle behavior

### FR-0023
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
- `FR-0096`
- `FR-0113`

**Traceability**:
- Area: option semantics
- Observable evidence: final status, exit code, safe-profile defaults

### FR-0024
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
   recipient fails preflight validation under `FR-0108`, the invocation is
   rejected.
3. Any command other than `export` or `plan` used with `--encrypt` is rejected.

**Dependencies**:
- `FR-0108`
- `FR-0107`
- `FR-0109`
- `FR-0037`

**Traceability**:
- Area: option semantics
- Observable evidence: encryption preflight, encrypted artifacts, rejection

### FR-0025
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
   `FR-0110`.
4. `--encrypt --confidential` has the same accepted semantics as
   `--confidential` alone.
5. Any command other than `export` or `plan` used with `--confidential` is
   rejected.

**Dependencies**:
- `FR-0024`
- `FR-0110`
- `FR-0111`
- `FR-0037`

**Traceability**:
- Area: option semantics
- Observable evidence: rejection rules, final artifact set, warning behavior

### FR-0026
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
   recovery-compatible output root under `FR-0103`.
4. Any command other than `export` used with `--resume` is rejected.

**Dependencies**:
- `FR-0016`
- `FR-0103`

**Traceability**:
- Area: option semantics
- Observable evidence: acceptance or rejection of resume invocations

### FR-0027
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
- `FR-0015`
- `FR-0095`

**Traceability**:
- Area: option semantics
- Observable evidence: continued processing after page-local failure

### FR-0028
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
   and `_storage.xml` but does not thereby request page payload persistence.
4. In `plan`, if `--keep-metadata` is in effect and attachment-preview data is
   acquired for a page, the product also persists `_attachments_preview.txt`
   for that page but does not thereby request downloaded attachment payload
   persistence.
5. Any command other than `export` or `plan` used with `--keep-metadata` is
   rejected.

**Dependencies**:
- `FR-0073`
- `FR-0080`
- `FR-0081`

**Traceability**:
- Area: option semantics
- Observable evidence: presence or absence of metadata artifacts

### FR-0029
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
- `FR-0013`
- `FR-0019`
- `FR-0111`

**Traceability**:
- Area: option semantics
- Observable evidence: persistent log-file creation, overwrite, or rejection

### FR-0030
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
   token in the requirements corpus.
6. In `doctor`, `--encryption-key <value>` without `--verify-encryption` is
   rejected.

**Dependencies**:
- `FR-0013`
- `FR-0046`
- `FR-0031`

**Traceability**:
- Area: option semantics
- Observable evidence: effective-recipient selection, configuration state,
  rejection behavior

### FR-0031
**Requirement**: `--verify-encryption` shall request recipient verification in
`doctor`.

**Applicability**:
- `doctor --verify-encryption`

**Rationale**:
- Operators need an explicit way to verify that the effective recipient is usable
  before running encrypted exports.

**Acceptance Criteria**:
1. `doctor --verify-encryption` requests the encryption-recipient diagnostics
   defined by `FR-0040` using recipient selection from `FR-0037`.
2. If no explicit `--encryption-key` and no saved default recipient exist, the
   command reports that there is no recipient to verify.
3. Any command other than `doctor` used with `--verify-encryption` is rejected.

**Dependencies**:
- `FR-0040`
- `FR-0037`

**Traceability**:
- Area: option semantics
- Observable evidence: `doctor` encryption-recipient diagnostics

### FR-0032
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
- `FR-0047`
- `FR-0015`

**Traceability**:
- Area: option semantics
- Observable evidence: configuration state after clear

### FR-0033
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
- `FR-0048`
- `FR-0049`

**Traceability**:
- Area: option semantics
- Observable evidence: target installation path, lifecycle result lines

### FR-0034
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
- `FR-0014`
- `FR-0094`
- `FR-0097`

**Traceability**:
- Area: option semantics
- Observable evidence: early-stop result, summary fields, exit code

### FR-0035
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
- `FR-0014`
- `FR-0064`

**Traceability**:
- Area: option semantics
- Observable evidence: inter-page pacing behavior, unresolved title-resolution
  outcomes

### FR-0036
**Requirement**: Each command shall support only one closed option set.

**Applicability**:
- all non-help invocations

**Rationale**:
- Operators and automation need option support to be explicit and closed rather
  than inferred indirectly.

**Acceptance Criteria**:
1. `export` supports only `--page-id`, `--out`, `--safe`, `--critical`,
   `--encrypt`, `--confidential`, `--resume`, `--no-fail-fast`,
   `--keep-metadata`, `--page-format`, `--log-file`, `--encryption-key`, `--max-pages`,
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
- `FR-0020`
- `FR-0021`
- `FR-0022`
- `FR-0023`
- `FR-0024`
- `FR-0025`
- `FR-0026`
- `FR-0027`
- `FR-0028`
- `FR-0029`
- `FR-0030`
- `FR-0031`
- `FR-0032`
- `FR-0033`
- `FR-0034`
- `FR-0035`
- `FR-0121`

**Traceability**:
- Area: option semantics
- Observable evidence: command-specific option acceptance and rejection behavior

### FR-0037
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
- `FR-0030`
- `FR-0045`
- `FR-0046`
- `FR-0047`

**Traceability**:
- Area: option semantics
- Observable evidence: recipient selection in `doctor`, encryption preflight,
  rejection or acceptance of encrypted runs

### FR-0121
**Requirement**: `--page-format <format>` shall select the materialized page
payload format for `export`.

**Applicability**:
- `export --page-format <format>`

**Rationale**:
- Operators need explicit control over the persisted page payload format.

**Acceptance Criteria**:
1. `--page-format <format>` selects the page payload format for materialized
   page content in `export`.
2. Without `--page-format`, the effective page payload format is Markdown
   (`md`).
3. `--page-format md` selects Markdown page export and requests persistence of
   `page.md` for successfully materialized pages.
4. `--page-format html` selects HTML page export and requests persistence of
   `page.html` for successfully materialized pages.
5. Any command other than `export` used with `--page-format` is rejected.

**Dependencies**:
- `FR-0012`
- `FR-0074`
- `FR-0080`

**Traceability**:
- Area: option semantics
- Observable evidence: accepted format selection, default format behavior,
  rejection
