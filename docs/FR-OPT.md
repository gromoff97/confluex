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
- None

**Traceability**:
- Area: option semantics
- Observable evidence: workflow behavior, page-access diagnostics, rejection

### FR-0021
**Requirement**: `--out <path>` shall control the logical plain output root for
export-related runs.

**Applicability**:
- accepted non-help `export` invocations
- accepted non-help `plan` invocations

**Rationale**:
- Operators need deterministic control of the output-root location.

**Acceptance Criteria**:
1. `--out <path>` selects the logical plain output root for the run.
2. The selected logical plain output-root path is the path-normalized absolute
   path produced from the operator-supplied path source under `FR-0158` and
   normalized under `FR-0159` before existence checks, path comparison,
   artifact naming, summary reporting, or sidecar-path derivation.
3. If the operator omits `--out`, the product generates the output root
   automatically.

**Dependencies**:
- `FR-0158`
- `FR-0159`

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
- None

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
2. A completed run under `--critical` is evaluated under the fail-closed outcome
   rule defined by `FR-0096`.
3. Any command other than `export` or `plan` used with `--critical` is rejected.

**Dependencies**:
- `FR-0022`
- `FR-0096`

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
2. If no effective encryption recipient is available, the invocation is rejected
   by this card before root-page preflight, traversal, output-root reuse, or
   artifact creation begins.
3. If an effective encryption recipient is available, recipient preflight
   validation and rejection for a failed preflight are governed by `FR-0108`;
   this card does not own the failed-preflight diagnostic.
4. Any command other than `export` or `plan` used with `--encrypt` is rejected.

**Dependencies**:
- `FR-0037`
- `FR-0108`

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
2. Under `--confidential`, the effective encryption recipient must match the
   full 40-hex GPG fingerprint syntax from criterion 3; otherwise the invocation
   is rejected.
3. A full 40-hex GPG fingerprint is exactly 40 ASCII characters matching the
   regular expression `^[0-9A-Fa-f]{40}$`. Hexadecimal letter case is ignored
   for this syntax check, and a matching fingerprint is normalized to uppercase
   before any later comparison or diagnostic serialization in this corpus.
4. If encryption fails after any plaintext run artifact has been written, the
   run applies the confidentiality-preserving failure behavior defined by
   `FR-0110`.
5. `--encrypt --confidential` has the same accepted semantics as
   `--confidential` alone.
6. Any command other than `export` or `plan` used with `--confidential` is
   rejected.

**Dependencies**:
- `FR-0024`
- `FR-0023`
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
- `export --resume --out <path>`

**Rationale**:
- Operators need explicit, safe reuse of compatible prior export results.

**Acceptance Criteria**:
1. `--resume` is supported only for `export`.
2. `export --resume` requires `--out`.
3. `export --resume --out <path>` is accepted only when `<path>` is an existing
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
  failures encountered while processing one page.

**Acceptance Criteria**:
1. Under `--no-fail-fast`, a page-scoped failure condition that another
   requirement explicitly requires to be recorded in `failed-pages.tsv` does
   not stop the entire run immediately.
2. Any command other than `export` or `plan` used with `--no-fail-fast` is
   rejected.

**Dependencies**:
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
2. In `export`, the resulting metadata file retention and page-folder layout are
   governed by `FR-0080`.
3. In `plan`, the resulting metadata file retention and page-folder layout are
   governed by `FR-0081`.
4. `--keep-metadata` does not by itself request page payload persistence or
   downloaded attachment payload persistence beyond what the authoritative
   output-structure and data-acquisition cards already require.
5. Any command other than `export` or `plan` used with `--keep-metadata` is
   rejected.

**Dependencies**:
- `FR-0080`
- `FR-0081`

**Traceability**:
- Area: option semantics
- Observable evidence: presence or absence of metadata artifacts

### FR-0029
**Requirement**: `--log-file <file>` shall request a persistent log artifact.

**Applicability**:
- accepted non-help invocations that include `--log-file <file>`

**Rationale**:
- Operators need a persistent log separate from run reports.

**Acceptance Criteria**:
1. `--log-file <file>` selects the requested persistent log-artifact path.
2. The effective persistent log-artifact path is the path-normalized absolute
   path produced from the operator-supplied path source under `FR-0158` and
   normalized under `FR-0159` before the persistent log-artifact behavior
   governed by `FR-0134` begins.
3. The creation, overwrite, and path-conflict behavior for the selected
   persistent log-artifact path is governed by `FR-0134`.
4. Command support and rejection behavior for `--log-file <file>` are governed
   by `FR-0036`.

**Dependencies**:
- `FR-0013`
- `FR-0019`
- `FR-0036`
- `FR-0134`
- `FR-0158`
- `FR-0159`

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
3. In `config`, `--encryption-key <value>` supplies the recipient value whose
   saved-state mutation and readback contract are governed by `FR-0046`.
4. The value is rejected if it is empty, is not valid UTF-8 text, or contains
   TAB, LF, or CR.
5. The exact value `none` is rejected because `none` is the reserved absence
   token defined by `FR-0125`.
6. In `doctor`, the accepted-usage prerequisite for `--encryption-key <value>`
   is governed by `FR-0031`.

**Dependencies**:
- `FR-0046`
- `FR-0031`
- `FR-0125`

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
   diagnostic outcome and observable output remain governed exclusively by
   `FR-0040`.
3. Any command other than `doctor` used with `--verify-encryption` is rejected.
4. In `doctor`, `--encryption-key <value>` is accepted only when
   `--verify-encryption` is also present.

**Dependencies**:
- `FR-0040`
- `FR-0030`
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
1. `config --clear-encryption-key` requests the saved default-recipient removal
   whose state mutation and readback contract are governed by `FR-0047`.
2. Any command other than `config` used with `--clear-encryption-key` is
   rejected.

**Dependencies**:
- `FR-0047`

**Traceability**:
- Area: option semantics
- Observable evidence: configuration state after clear

### FR-0033
**Requirement**: `--install-dir <dir>` shall select the target installation
directory.

**Applicability**:
- accepted non-help invocations that include `--install-dir <dir>`

**Rationale**:
- Operators need deterministic control over the installation target.

**Acceptance Criteria**:
1. `install --install-dir <dir>` uses the path-normalized absolute path produced
   from the operator-supplied path source under `FR-0158` and normalized under
   `FR-0159` for `<dir>` as the installation target instead of the default
   target location.
2. `uninstall --install-dir <dir>` uses the path-normalized absolute path
   produced from the operator-supplied path source under `FR-0158` and
   normalized under `FR-0159` for `<dir>` as the removal target instead of the
   default target location.
3. Lifecycle validation for `install` or `uninstall` uses that normalized target
   path for filesystem checks and target-path comparisons.
4. Command support and rejection behavior for `--install-dir <dir>` are
   governed by `FR-0036`.

**Dependencies**:
- `FR-0036`
- `FR-0158`
- `FR-0159`

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
2. When the nth page reaches processed-page status under `FR-0127`, the product
   completes the remaining required processing for that nth page before applying
   the `--max-pages` stop; no later queued page begins processing.
3. `--max-download-mib <n>` stops further byte-contributing page-processing or
   attachment activity once the current run's accumulated downloaded volume
   reaches or exceeds `n * 1,048,576` bytes, where the counted volume is
   exactly the sum of the content-byte and metadata-byte counters defined by
   `FR-0120`.
4. The download-limit threshold is evaluated after each completed
   byte-contributing operation that adds bytes to either counter from
   `FR-0120`.
5. For criterion 4, completed byte-contributing operations are exactly: one
   page-metadata acquisition for one page, one storage-content acquisition for
   one page, one child-listing acquisition for one source page, one page-id
   lookup for one page-id-based link-resolution attempt under `FR-0064`, one
   title-resolution candidate acquisition for one title-based link-resolution
   attempt, one attachment-preview acquisition for one page in `plan`, one
   page-payload materialization for one page in `export`, one attachment-data
   acquisition needed to determine `attachment_count` for one processed page in
   `export`, and one attachment-payload download for one attachment in
   `export`.
6. Byte-contributing operations from criterion 5 are evaluated for the
   download-limit threshold in the same order in which their bytes are added to
   the counters defined by `FR-0120`; operations that add zero bytes do not
   create a download-limit evaluation point.
7. For one page whose processing begins, whether or not that page later reaches
   processed-page status under `FR-0127`, byte-contributing operations are
   attempted and evaluated in this order when they are required and not skipped
   by a prior stop or failure: page-metadata acquisition, storage-content
   acquisition, child-listing acquisition, then supported-link-resolution
   byte-contributing operations in the supported-link evaluation order governed
   by `FR-0141`, where each such operation is either the page-id lookup from
   `FR-0064` or the title-resolution candidate acquisition from `FR-0072`
   required for that supported link, then attachment-preview acquisition for
   `plan`, page-payload materialization for `export`, attachment-data
   acquisition needed to determine `attachment_count` for `export`, and
   attachment-payload downloads for `export`. Attachment-payload downloads for
   one page are ordered by ascending bytewise lexicographic order of source
   filename; invalid or duplicate source filenames fail under `FR-0075` before
   any tied or invalid attachment payload bytes are downloaded.
8. If one completed byte-contributing operation both records a page-local
   failure and makes the accumulated downloaded volume reach or exceed the
   threshold, the page-local failure remains recorded and the configured-stop
   outcome is selected after that operation unless a runtime failure or signal
   interruption later takes precedence under its authoritative requirement.
9. If the operation evaluated by criterion 4 makes the accumulated downloaded
   volume reach or exceed the threshold, that operation's bytes remain counted,
   artifacts produced by that operation are retained or cleaned up according to
   the operation's normal success or failure requirements, and no later
   byte-contributing operation that would add bytes to either counter begins.
10. If both configured stop limits would stop the run at the same decision point,
   interrupt-reason precedence is governed by `FR-0140`.
11. If either configured stop limit stops the run, configured-stop status,
   retention, interrupt-reason serialization, and exit code are governed by
   `FR-0097`, `FR-0140`, and `FR-0118`.
12. Any command other than `export` or `plan` used with either option is
   rejected.

**Dependencies**:
- `FR-0014`
- `FR-0064`
- `FR-0069`
- `FR-0070`
- `FR-0071`
- `FR-0072`
- `FR-0073`
- `FR-0074`
- `FR-0075`
- `FR-0141`
- `FR-0127`
- `FR-0120`
- `FR-0097`
- `FR-0140`
- `FR-0118`

**Traceability**:
- Area: option semantics
- Observable evidence: early-stop result, summary fields, exit code

### FR-0035
**Requirement**: `--sleep-ms <n>` shall control inter-page pacing.

**Applicability**:
- `export --sleep-ms <n>`
- `plan --sleep-ms <n>`

**Rationale**:
- Operators need explicit control over request pacing.

**Acceptance Criteria**:
1. If `--sleep-ms <n>` is supplied, the effective per-page delay is `n`
   milliseconds.
2. If `--sleep-ms <n>` is not supplied and `--safe` is in effect, the effective
   per-page delay is the safe-profile delay defined by `FR-0022`.
3. If neither `--sleep-ms` nor `--safe` supplies a sleep value, the effective
   per-page delay is `0` milliseconds.
4. The effective per-page delay is applied after a page reaches processed-page
   status under `FR-0127` and before the next queued page begins processing
   under `FR-0141`.
5. The delay from criterion 4 is not applied before processing the first page.
6. The delay from criterion 4 is not applied after the last processed page when
   no later queued page will begin processing.
7. The delay from criterion 4 is not applied after a page-local failure,
   configured stop, runtime failure, or signal interruption when that condition
   prevents the next queued page from beginning processing.
8. A page that fails before reaching processed-page status under `FR-0127` does
   not trigger the delay from criterion 4.
9. Any command other than `export` or `plan` used with `--sleep-ms` is
   rejected.

**Dependencies**:
- `FR-0022`
- `FR-0127`
- `FR-0141`

**Traceability**:
- Area: option semantics
- Observable evidence: inter-page pacing behavior

### FR-0157
**Requirement**: `--max-find-candidates <n>` shall bound title-resolution
candidate inspection.

**Applicability**:
- `export --max-find-candidates <n>`
- `plan --max-find-candidates <n>`

**Rationale**:
- Operators need explicit control over conservative title-resolution breadth.

**Acceptance Criteria**:
1. If `--max-find-candidates <n>` is supplied, the effective candidate limit for
   one title-resolution attempt is `n`.
2. If `--max-find-candidates <n>` is not supplied and `--safe` is in effect,
   the effective candidate limit is the safe-profile candidate limit defined by
   `FR-0022`.
3. If neither `--max-find-candidates` nor `--safe` supplies a candidate limit,
   title-resolution candidate inspection is unlimited.
4. When an effective candidate limit applies, the product inspects at most that
   many title candidates for any single title-resolution attempt.
5. If the effective candidate limit prevents unique resolution, the link remains
   unresolved.
6. Any command other than `export` or `plan` used with
   `--max-find-candidates` is rejected.

**Dependencies**:
- `FR-0022`

**Traceability**:
- Area: option semantics
- Observable evidence: unresolved title-resolution outcomes, bounded candidate
  inspection

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
   `--max-download-mib`, `--sleep-ms`, `--max-find-candidates`, and
   `--link-depth`.
2. `plan` supports only `--page-id`, `--out`, `--safe`, `--critical`,
   `--encrypt`, `--confidential`, `--no-fail-fast`, `--keep-metadata`,
   `--log-file`, `--encryption-key`, `--max-pages`, `--max-download-mib`,
   `--sleep-ms`, `--max-find-candidates`, and `--link-depth`.
3. `doctor` supports only `--page-id`, `--verify-encryption`,
   `--encryption-key`, and `--log-file`.
4. `config` supports only `--encryption-key` and `--clear-encryption-key`.
5. `install` supports only `--install-dir`.
6. `uninstall` supports only `--install-dir`.
7. `selftest` supports only `--url`, `--login`, and `--password`.
8. The supported options that take values use exactly these value placeholders in
   help output: `--page-id` uses `<id>`, `--out` uses `<path>`,
   `--page-format` uses `<format>`, `--log-file` uses `<file>`,
   `--encryption-key` uses `<value>`, `--max-pages` uses `<n>`,
   `--max-download-mib` uses `<n>`, `--sleep-ms` uses `<n>`,
   `--max-find-candidates` uses `<n>`, `--link-depth` uses `<n>`,
   `--install-dir` uses `<dir>`, `--url` uses `<base-url>`, `--login` uses
   `<username>`, and `--password` uses `<password>`.
9. Every supported option in criteria 1 through 7 that is not listed in
   criterion 8 is a flag option and has no value placeholder in help output.
10. No command accepts positional operands after the command token other than
   values consumed by the valued options in criterion 8.
11. Any non-option token that is not consumed as the value for one valued option
   is rejected under `FR-0019`.

**Dependencies**:
- `FR-0019`
- `FR-0129`

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
2. Otherwise, if the shared saved default encryption recipient state defined by
   `FR-0045` contains a saved default encryption recipient, that saved default
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
3. `--page-format md` selects the Markdown page representation and the
   `page.md` payload file required by `FR-0074`.
4. `--page-format html` selects the HTML page representation and the
   `page.html` payload file required by `FR-0074`.
5. This card governs only page payload format selection; page payload
   acquisition, normalization, persistence, and page-local payload failure
   behavior are governed by `FR-0074`.
6. Any command other than `export` used with `--page-format` is rejected.

**Dependencies**:
- `FR-0012`
- `FR-0074`

**Traceability**:
- Area: option semantics
- Observable evidence: accepted format selection, default format behavior,
  rejection

### FR-0218
**Requirement**: `--link-depth <n>` shall select the effective link-depth for
link-driven scope expansion.

**Applicability**:
- `export --link-depth <n>`
- `plan --link-depth <n>`

**Rationale**:
- Operators need explicit control over how many supported internal-link hops can
  expand the export scope.

**Acceptance Criteria**:
1. The effective link-depth is a canonical non-negative integer count of
   supported internal-link hops away from the root page child tree for one run.
2. If `--link-depth <n>` is supplied on `export` or `plan`, the effective
   link-depth for that run is `n`.
3. If `--link-depth` is omitted from `export` or `plan`, the effective
   link-depth is `1`.
4. Any command other than `export` or `plan` used with `--link-depth` is
   rejected.
5. The option selects only the effective link-depth value; root child traversal
   is governed by `FR-0060`, link-driven scope expansion is governed by
   `FR-0061` and `FR-0062`, and deterministic queue ordering is governed by
   `FR-0141`.

**Dependencies**:
- `FR-0014`
- `FR-0036`
- `FR-0060`
- `FR-0061`
- `FR-0062`
- `FR-0141`

**Traceability**:
- Area: option semantics
- Observable evidence: accepted link-depth selection, default link-depth
  behavior, unsupported command rejection
