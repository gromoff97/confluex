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
**Requirement**: The output-root selector shall control the logical plain
output root for export-related runs.

**Applicability**:
- accepted non-help `export` invocations
- accepted non-help `plan` invocations

**Rationale**:
- Operators need deterministic control of the output-root location.

**Acceptance Criteria**:
1. If `--out <path>` is supplied, it selects the logical plain output root for
   the run.
2. If `--out <path>` is omitted and `CONFLUEX_OUTPUT_ROOT` has an effective
   value under `FR-0219`, that value selects the logical plain output root for
   the run.
3. The selected logical plain output-root path is the path-normalized absolute
   path produced from the operator-supplied path source under `FR-0158` and
   normalized under `FR-0159` before existence checks, path comparison,
   artifact naming, summary reporting, or sibling artifact path derivation.
4. If neither `--out <path>` nor `CONFLUEX_OUTPUT_ROOT` selects an output root,
   the product generates the output root automatically.

**Dependencies**:
- `FR-0158`
- `FR-0159`
- `FR-0219`

**Traceability**:
- Area: option semantics
- Observable evidence: output-root location, path normalization, summary output

### FR-0022
**Requirement**: `--env-file <file>` shall select the invocation's env-file
configuration source.

**Applicability**:
- `export --env-file <file>`
- `plan --env-file <file>`
- `doctor --env-file <file>`

**Rationale**:
- Operators need a deterministic way to load invocation-local configuration from
  a file without relying only on shell profile state.

**Acceptance Criteria**:
1. `--env-file <file>` selects the env-file source for the current invocation.
2. Env-file path normalization, readability validation, parsing, and precedence
   are governed by `FR-0219`.
3. `--env-file <file>` is supported only by `export`, `plan`, and `doctor`.
4. Any command other than `export`, `plan`, or `doctor` used with `--env-file`
   is rejected.

**Dependencies**:
- `FR-0036`
- `FR-0219`

**Traceability**:
- Area: option semantics
- Observable evidence: selected env-file reads and unsupported-command rejection

### FR-0023
**Requirement**: `export` and `plan` shall use fail-fast page processing unless
best-effort page processing is requested.

**Applicability**:
- accepted non-help `export` invocations
- accepted non-help `plan` invocations

**Rationale**:
- Operators need a deterministic default failure policy and an explicit
  best-effort override.

**Acceptance Criteria**:
1. If `--no-fail-fast` is omitted, page-scoped failures governed by `FR-0095`
   use that card's fail-fast branch.
2. If `--no-fail-fast` is supplied, page-scoped failures governed by `FR-0095`
   use the best-effort branch requested by `FR-0027`.
3. This card governs only selection between the default fail-fast branch and the
   `--no-fail-fast` branch; page-failure recording and final outcome selection
   remain governed by their authoritative report and outcome cards.

**Dependencies**:
- `FR-0027`
- `FR-0095`

**Traceability**:
- Area: option semantics
- Observable evidence: continued processing or stop after page-local failure

### FR-0024
**Requirement**: Public path-valued option inputs shall use one invocation-local
source model.

**Applicability**:
- `export --out <path>`
- `plan --out <path>`
- non-help invocations using `--log-file <file>`
- env-file and process-environment values selected by `FR-0219`

**Rationale**:
- Operators need path inputs to resolve the same way whether supplied on the
  command line, in an env file, or in the process environment.

**Acceptance Criteria**:
1. The public path-valued selectors are exactly `--out <path>`,
   `CONFLUEX_OUTPUT_ROOT`, `--log-file <file>`, and `CONFLUEX_LOG_FILE`.
2. `--out <path>` and `CONFLUEX_OUTPUT_ROOT` select the logical plain
   output-root path governed by `FR-0021`.
3. `--log-file <file>` and `CONFLUEX_LOG_FILE` select the persistent
   log-artifact path governed by `FR-0029`.
4. Each selected path value is normalized under `FR-0158` and `FR-0159` before
   the path is used for artifact naming, existence checks, or path comparison.

**Dependencies**:
- `FR-0021`
- `FR-0029`
- `FR-0158`
- `FR-0159`
- `FR-0219`

**Traceability**:
- Area: option semantics
- Observable evidence: effective output-root and log-file paths

### FR-0025
**Requirement**: Public numeric run-control inputs shall use one
invocation-local source model.

**Applicability**:
- `export` and `plan` numeric run-control options
- env-file and process-environment values selected by `FR-0219`

**Rationale**:
- Operators need run-control values to have the same validation and precedence
  across command-line, env-file, and process-environment sources.

**Acceptance Criteria**:
1. The public numeric run-control selectors are exactly `--max-pages <n>`,
   `CONFLUEX_MAX_PAGES`, `--max-download-mib <n>`,
   `CONFLUEX_MAX_DOWNLOAD_MIB`, `--sleep-ms <n>`, `CONFLUEX_SLEEP_MS`,
   `--max-find-candidates <n>`, `CONFLUEX_MAX_FIND_CANDIDATES`,
   `--link-depth <n>`, and `CONFLUEX_LINK_DEPTH`.
2. Effective values selected from the command line, env file, or process
   environment are validated with the numeric syntax governed by `FR-0014`.
3. The selected `max-pages` and `max-download-mib` values are consumed by
   `FR-0034`.
4. The selected `sleep-ms` value is consumed by `FR-0035`.
5. The selected `max-find-candidates` value is consumed by `FR-0157`.
6. The selected `link-depth` value is consumed by `FR-0218`.

**Dependencies**:
- `FR-0014`
- `FR-0034`
- `FR-0035`
- `FR-0157`
- `FR-0218`
- `FR-0219`

**Traceability**:
- Area: option semantics
- Observable evidence: effective run limits, pacing, candidate bounds, and link
  depth

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
**Requirement**: The log-file selector shall request a persistent log artifact.

**Applicability**:
- accepted non-help invocations that include `--log-file <file>`
- accepted non-help invocations with effective `CONFLUEX_LOG_FILE`

**Rationale**:
- Operators need a persistent log separate from run reports.

**Acceptance Criteria**:
1. If `--log-file <file>` is supplied, it selects the requested persistent
   log-artifact path.
2. If `--log-file <file>` is omitted and `CONFLUEX_LOG_FILE` has an effective
   value under `FR-0219`, that value selects the requested persistent
   log-artifact path.
3. The effective persistent log-artifact path is the path-normalized absolute
   path produced from the selected path source under `FR-0158` and normalized
   under `FR-0159` before the persistent log-artifact behavior governed by
   `FR-0134` begins.
4. The creation, overwrite, and path-conflict behavior for the selected
   persistent log-artifact path is governed by `FR-0134`.
5. Command support and rejection behavior for `--log-file <file>` are governed
   by `FR-0036`.

**Dependencies**:
- `FR-0013`
- `FR-0019`
- `FR-0036`
- `FR-0134`
- `FR-0158`
- `FR-0159`
- `FR-0219`

**Traceability**:
- Area: option semantics
- Observable evidence: persistent log-file creation, overwrite, or rejection

### FR-0030
**Requirement**: Configured public option-equivalent values shall use the same
value validation as command-line option values.

**Applicability**:
- effective option-equivalent values selected from env files under `FR-0219`
- effective option-equivalent values selected from the process environment
  under `FR-0219`

**Rationale**:
- Operators need env-file and process-environment inputs that select public
  option behavior to fail the same way as equivalent command-line inputs.

**Acceptance Criteria**:
1. A configured value selected for `CONFLUEX_OUTPUT_ROOT` is validated as the
   path value consumed by `FR-0021`.
2. A configured value selected for `CONFLUEX_LOG_FILE` is validated as the path
   value consumed by `FR-0029`.
3. Configured values selected for `CONFLUEX_MAX_PAGES`,
   `CONFLUEX_MAX_DOWNLOAD_MIB`, `CONFLUEX_SLEEP_MS`,
   `CONFLUEX_MAX_FIND_CANDIDATES`, and `CONFLUEX_LINK_DEPTH` are validated by
   the corresponding numeric syntax rules in `FR-0014`.
4. Effective Confluence access values selected under `FR-0219` are interpreted
   by the remote-access context rules in `FR-0216`, and `doctor` configuration
   readiness serialization is governed by `FR-0040`.
5. If a configured option-equivalent value fails the validation required by
   criteria 1 through 3,
   the invocation is rejected before command work begins.

**Dependencies**:
- `FR-0014`
- `FR-0021`
- `FR-0029`
- `FR-0040`
- `FR-0216`
- `FR-0219`

**Traceability**:
- Area: option semantics
- Observable evidence: invalid configured value rejection

### FR-0031
**Requirement**: `doctor` public options shall select diagnostic checks and
diagnostic artifacts only.

**Applicability**:
- accepted non-help `doctor` invocations

**Rationale**:
- Operators need diagnostics to report readiness without starting export or
  planning work.

**Acceptance Criteria**:
1. `--page-id <id>` requests the page-access diagnostic governed by `FR-0039`.
2. `--env-file <file>` selects configuration for the current diagnostic
   invocation under `FR-0219`.
3. `--log-file <file>` selects a persistent diagnostic log artifact governed by
   `FR-0134`.
4. A `doctor` invocation does not select an output root, run-stop limit,
   inter-page delay, candidate limit, link depth, resume mode, metadata
   retention mode, or ZIP archive mode.

**Dependencies**:
- `FR-0020`
- `FR-0022`
- `FR-0029`
- `FR-0039`
- `FR-0134`
- `FR-0219`

**Traceability**:
- Area: option semantics
- Observable evidence: diagnostic stdout and persistent log behavior

### FR-0032
**Requirement**: Public flag options shall consume no following argv token as a
value.

**Applicability**:
- non-help invocations using public flag options

**Rationale**:
- Operators need flag parsing to be deterministic when a flag is followed by
  another option token or positional-looking token.

**Acceptance Criteria**:
1. Public flag options are exactly `--resume`, `--no-fail-fast`,
   `--keep-metadata`, and `--zip`.
2. A public flag option consumes only its own argv token.
3. The argv token immediately following a public flag option remains available
   for normal option parsing, valued-option value consumption, or positional
   operand rejection under `FR-0036`.

**Dependencies**:
- `FR-0036`

**Traceability**:
- Area: option semantics
- Observable evidence: argv parsing for public flag options

### FR-0033
**Requirement**: Public valued options shall consume exactly one following argv
token as their value.

**Applicability**:
- non-help invocations using public valued options

**Rationale**:
- Operators need valued-option parsing to be independent of whether the value
  begins with `-` or `--`.

**Acceptance Criteria**:
1. Public valued options are exactly `--page-id`, `--out`, `--env-file`,
   `--log-file`, `--max-pages`, `--max-download-mib`, `--sleep-ms`,
   `--max-find-candidates`, and `--link-depth`.
2. Each public valued option consumes exactly the immediately following argv
   token as its value.
3. If no argv token follows a public valued option, the invocation is rejected
   for a missing option value under `FR-0013`.

**Dependencies**:
- `FR-0013`
- `FR-0036`

**Traceability**:
- Area: option semantics
- Observable evidence: argv parsing and missing-value rejection

### FR-0034
**Requirement**: The run-stop limit options shall bound accepted export or plan
runs.

**Applicability**:
- `export --max-pages <n>`
- `plan --max-pages <n>`
- `export` and `plan` with effective `CONFLUEX_MAX_PAGES`
- `export --max-download-mib <n>`
- `plan --max-download-mib <n>`
- `export` and `plan` with effective `CONFLUEX_MAX_DOWNLOAD_MIB`

**Rationale**:
- Operators need explicit controls that can stop a run before it grows beyond the
  intended size.

**Acceptance Criteria**:
1. If `--max-pages <n>` or effective `CONFLUEX_MAX_PAGES` selects a max-pages
   value, that value stops further page processing when `n` processed pages
   have been reached.
2. When the nth page reaches processed-page status under `FR-0127`, the product
   completes the remaining required processing for that nth page before applying
   the `--max-pages` stop; no later queued page begins processing.
3. If `--max-download-mib <n>` or effective `CONFLUEX_MAX_DOWNLOAD_MIB` selects
   a max-download-mib value, that value stops further byte-contributing
   page-processing or attachment activity once the current run's accumulated
   downloaded volume reaches or exceeds `n * 1,048,576` bytes, where the
   counted volume is exactly the sum of the content-byte and metadata-byte
   counters defined by `FR-0120`.
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
11. If neither max-pages nor max-download-mib has an effective value, neither
    configured stop limit is active for that run.
12. If either configured stop limit stops the run, configured-stop status,
   retention, interrupt-reason serialization, and exit code are governed by
   `FR-0097`, `FR-0140`, and `FR-0118`.
13. Any command other than `export` or `plan` used with either option is
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
- `FR-0219`

**Traceability**:
- Area: option semantics
- Observable evidence: early-stop result, summary fields, exit code

### FR-0035
**Requirement**: `--sleep-ms <n>` shall control inter-page pacing.

**Applicability**:
- `export --sleep-ms <n>`
- `plan --sleep-ms <n>`
- `export` and `plan` with effective `CONFLUEX_SLEEP_MS`

**Rationale**:
- Operators need explicit control over request pacing.

**Acceptance Criteria**:
1. If `--sleep-ms <n>` is supplied, the effective per-page delay is `n`
   milliseconds.
2. If `--sleep-ms <n>` is omitted and `CONFLUEX_SLEEP_MS` has an effective value
   under `FR-0219`, the effective per-page delay is that value in milliseconds.
3. If neither `--sleep-ms <n>` nor `CONFLUEX_SLEEP_MS` supplies a sleep value,
   the effective per-page delay is `0` milliseconds.
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
- `FR-0127`
- `FR-0141`
- `FR-0219`

**Traceability**:
- Area: option semantics
- Observable evidence: inter-page pacing behavior

### FR-0157
**Requirement**: `--max-find-candidates <n>` shall bound title-resolution
candidate inspection.

**Applicability**:
- `export --max-find-candidates <n>`
- `plan --max-find-candidates <n>`
- `export` and `plan` with effective `CONFLUEX_MAX_FIND_CANDIDATES`

**Rationale**:
- Operators need explicit control over conservative title-resolution breadth.

**Acceptance Criteria**:
1. If `--max-find-candidates <n>` is supplied, the effective candidate limit for
   one title-resolution attempt is `n`.
2. If `--max-find-candidates <n>` is omitted and
   `CONFLUEX_MAX_FIND_CANDIDATES` has an effective value under `FR-0219`, the
   effective candidate limit for one title-resolution attempt is that value.
3. If neither `--max-find-candidates <n>` nor
   `CONFLUEX_MAX_FIND_CANDIDATES` supplies a candidate limit, title-resolution
   candidate inspection is unlimited.
4. When an effective candidate limit applies, the product inspects at most that
   many title candidates for any single title-resolution attempt.
5. If the effective candidate limit prevents unique resolution, the link remains
   unresolved.
6. Any command other than `export` or `plan` used with
   `--max-find-candidates` is rejected.

**Dependencies**:
- `FR-0219`

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
1. `export` supports only `--page-id`, `--out`, `--resume`,
   `--no-fail-fast`, `--keep-metadata`, `--zip`, `--env-file`, `--log-file`,
   `--max-pages`, `--max-download-mib`, `--sleep-ms`,
   `--max-find-candidates`, and `--link-depth`.
2. `plan` supports only `--page-id`, `--out`, `--no-fail-fast`,
   `--keep-metadata`, `--env-file`, `--log-file`, `--max-pages`,
   `--max-download-mib`, `--sleep-ms`, `--max-find-candidates`, and
   `--link-depth`.
3. `doctor` supports only `--page-id`, `--env-file`, and `--log-file`.
4. The supported options that take values use exactly these value placeholders in
   help output: `--page-id` uses `<id>`, `--out` uses `<path>`,
   `--env-file` uses `<file>`, `--log-file` uses `<file>`,
   `--max-pages` uses `<n>`, `--max-download-mib` uses `<n>`,
   `--sleep-ms` uses `<n>`, `--max-find-candidates` uses `<n>`, and
   `--link-depth` uses `<n>`.
5. Every supported option in criteria 1 through 3 that is not listed in
   criterion 4 is a flag option and has no value placeholder in help output.
6. No command accepts positional operands after the command token other than
   values consumed by the valued options in criterion 4.
7. Any non-option token that is not consumed as the value for one valued option
   is rejected under `FR-0019`.

**Dependencies**:
- `FR-0019`
- `FR-0004`

**Traceability**:
- Area: option semantics
- Observable evidence: command-specific option acceptance and rejection behavior

### FR-0037
**Requirement**: Effective public option values shall be selected from
invocation-local inputs only.

**Applicability**:
- accepted non-help `export` invocations
- accepted non-help `plan` invocations
- accepted non-help `doctor` invocations

**Rationale**:
- Operators need one reproducible precedence model that does not depend on
  machine-local saved state from earlier invocations.

**Acceptance Criteria**:
1. The only public input sources for effective option values are the current
   argv vector, the selected env file governed by `FR-0219`, and the current
   process environment.
2. Command-line option values take precedence over configured values according
   to `FR-0219`.
3. Env-file values take precedence over process-environment values according to
   `FR-0219`.
4. Effective option selection for one invocation does not persist values for a
   later invocation.

**Dependencies**:
- `FR-0036`
- `FR-0219`

**Traceability**:
- Area: option semantics
- Observable evidence: effective option values across repeated invocations

### FR-0121
**Requirement**: Markdown shall be the only materialized page payload format
for `export`.

**Applicability**:
- accepted `export` invocations

**Rationale**:
- Operators need one stable page payload contract for exported content.

**Acceptance Criteria**:
1. The effective page payload format for every accepted `export` invocation is
   Markdown (`md`).
2. The persisted page payload file for successful page materialization is
   `page.md` as governed by `FR-0074` and `FR-0080`.
3. Confluence storage content acquired under `FR-0070` is converter input, not a
   public export payload format.
4. This card governs only payload-format selection; page payload acquisition,
   normalization, persistence, and page-local payload failure behavior are
   governed by `FR-0074`.

**Dependencies**:
- `FR-0070`
- `FR-0074`
- `FR-0080`

**Traceability**:
- Area: option semantics
- Observable evidence: accepted format selection, default format behavior,
  retained page payload filenames

### FR-0220
**Requirement**: `--zip` shall request a retained ZIP archive for `export`.

**Applicability**:
- accepted `export --zip` invocations

**Rationale**:
- Operators need a portable retained artifact without losing the plain output
  root by default.

**Acceptance Criteria**:
1. If `--zip` is supplied on `export`, the run creates a ZIP archive after the
   plain output root has reached its final retained content.
2. If `--zip` is omitted, no ZIP archive is created by this option.
3. `--zip` is a flag option and consumes no following argv token as a value.
4. Any command other than `export` used with `--zip` is rejected.
5. ZIP packaging contains only the retained plain output root governed by
   `FR-0221`.

**Dependencies**:
- `FR-0036`
- `FR-0221`

**Traceability**:
- Area: option semantics
- Observable evidence: ZIP archive presence, unsupported command rejection,
  final artifact reporting

### FR-0218
**Requirement**: `--link-depth <n>` shall select the effective link-depth for
link-driven scope expansion.

**Applicability**:
- `export --link-depth <n>`
- `plan --link-depth <n>`
- `export` and `plan` with effective `CONFLUEX_LINK_DEPTH`

**Rationale**:
- Operators need explicit control over how many supported internal-link hops can
  expand the export scope.

**Acceptance Criteria**:
1. The effective link-depth is a canonical non-negative integer count of
   supported internal-link hops away from the root page child tree for one run.
2. If `--link-depth <n>` is supplied on `export` or `plan`, the effective
   link-depth for that run is `n`.
3. If `--link-depth <n>` is omitted and `CONFLUEX_LINK_DEPTH` has an effective
   value under `FR-0219`, the effective link-depth is that value.
4. If neither `--link-depth <n>` nor `CONFLUEX_LINK_DEPTH` supplies a
   link-depth value, the effective link-depth is `1`.
5. Any command other than `export` or `plan` used with `--link-depth` is
   rejected.
6. The selector chooses only the effective link-depth value; root child traversal
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
- `FR-0219`

**Traceability**:
- Area: option semantics
- Observable evidence: accepted link-depth selection, default link-depth
  behavior, unsupported command rejection
