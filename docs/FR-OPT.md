# Option Semantics Requirements


### FR-0020
**Requirement**: `--page-id <id>` shall select the target root page.

**Applicability**:
- `export --page-id <id>`
- `export --plan-only --page-id <id>`

**Rationale**:
- Operators need one explicit page selector for run scope.

**Acceptance Criteria**:
1. In `export`, `--page-id <id>` selects the root page for the run.
2. Any command other than `export` used with `--page-id` is rejected.

**Dependencies**:
- None

**Traceability**:
- Area: option semantics
- Observable evidence: workflow behavior and rejection

### FR-0021
**Requirement**: The output-root selector shall control the logical plain
output root for export-related runs.

**Applicability**:
- accepted non-help `export` invocations

**Rationale**:
- Operators need deterministic control of the output-root location.

**Acceptance Criteria**:
1. If `--out <path>` is supplied, it selects the logical plain output root for
   the run.
2. If `--out <path>` is omitted and `outputRoot` has an effective JSON config
   value under `FR-0219`, that value selects the logical plain output root for
   the run.
3. The selected logical plain output-root path is the path-normalized absolute
   path produced from the operator-supplied path source under `FR-0158` and
   normalized under `FR-0159` before existence checks, path comparison,
   artifact naming, summary reporting, or sibling artifact path derivation.
4. If neither `--out <path>` nor `outputRoot` selects an output root,
   the product generates the output root automatically.

**Dependencies**:
- `FR-0158`
- `FR-0159`
- `FR-0219`

**Traceability**:
- Area: option semantics
- Observable evidence: output-root location, path normalization, summary output

### FR-0225
**Requirement**: `--config <file>` shall select the invocation's explicit JSON
configuration source.

**Applicability**:
- `export --config <file>`
- `export --plan-only --config <file>`

**Rationale**:
- Operators need a deterministic way to load invocation-local JSON
  configuration from a file without relying only on shell profile state.

**Acceptance Criteria**:
1. `--config <file>` selects the explicit JSON config source for the current
   invocation.
2. Config path normalization, readability validation, parsing, and precedence
   are governed by `FR-0219` and `FR-0246`.
3. `--config <file>` is supported only by `export`.
4. Any command other than `export` used with `--config` is rejected.

**Dependencies**:
- `FR-0036`
- `FR-0219`

**Traceability**:
- Area: option semantics
- Observable evidence: selected explicit config reads and unsupported-command
  rejection

### FR-0226
**Requirement**: `export` shall use fail-fast page processing unless
best-effort page processing is requested.

**Applicability**:
- accepted non-help `export` invocations

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

### FR-0227
**Requirement**: Public path-valued option inputs shall use one invocation-local
source model.

**Applicability**:
- `export --out <path>`
- JSON config values selected by `FR-0219`

**Rationale**:
- Operators need path inputs to resolve the same way whether supplied on the
  command line or in JSON config.

**Acceptance Criteria**:
1. The public path-valued selectors are exactly `--out <path>` and JSON config
   key `outputRoot`.
2. `--out <path>` and `outputRoot` select the logical plain output-root path
   governed by `FR-0021`.
3. Each selected path value is normalized under `FR-0158` and `FR-0159` before
   the path is used for artifact naming, existence checks, or path comparison.

**Dependencies**:
- `FR-0021`
- `FR-0158`
- `FR-0159`
- `FR-0219`

**Traceability**:
- Area: option semantics
- Observable evidence: effective output-root path

### FR-0228
**Requirement**: Public numeric run-control inputs shall use one
invocation-local source model.

**Applicability**:
- `export` numeric run-control options
- JSON config values selected by `FR-0219`

**Rationale**:
- Operators need run-control values to have the same validation and precedence
  across command-line and JSON config sources.

**Acceptance Criteria**:
1. The public numeric run-control selectors are exactly `--max-pages <n>`,
   JSON config key `maxPages`, `--max-download-mib <n>`, JSON config key
   `maxDownloadMib`, `--sleep-ms <n>`, JSON config key `sleepMs`,
   `--max-find-candidates <n>`, JSON config key `maxFindCandidates`,
   `--link-depth <n>`, and JSON config key `linkDepth`.
2. Effective values selected from the command line or JSON config are validated
   with the numeric syntax governed by `FR-0014` and the JSON numeric schema
   governed by `FR-0246`.
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
- `FR-0246`

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
2. `export --resume` requires `--out <path>` to be present on the current
   command line; a configured `outputRoot` does not satisfy this prerequisite.
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
- `export --plan-only --no-fail-fast`

**Rationale**:
- Operators need a mode that keeps processing eligible later pages despite
  failures encountered while processing one page.

**Acceptance Criteria**:
1. Under `--no-fail-fast`, a page-scoped failure condition that another
   requirement explicitly requires to be recorded in `failed-pages.tsv` does
   not stop the entire run immediately.
2. Any command other than `export` used with `--no-fail-fast` is
   rejected.

**Dependencies**:
- `FR-0095`

**Traceability**:
- Area: option semantics
- Observable evidence: continued processing after page-local failure

### FR-0247
**Requirement**: `--plan-only` shall select the export plan-only execution mode.

**Applicability**:
- `export --plan-only`

**Rationale**:
- Operators need a way to inspect export scope and reports before page payload
  materialization.

**Acceptance Criteria**:
1. If `--plan-only` is supplied on `export`, the execution mode is `plan_only`.
2. If `--plan-only` is omitted from `export`, the execution mode is
   `materialized`.
3. `--plan-only` does not select, imply, or mutate any other public option.
4. `export --plan-only --zip` is rejected as an invalid option combination.
5. `export --plan-only --resume` is rejected as an invalid option combination.
6. Any command other than `export` used with `--plan-only` is rejected.

**Dependencies**:
- `FR-0018`
- `FR-0036`
- `FR-0054`

**Traceability**:
- Area: option semantics
- Observable evidence: summary execution mode, command dispatch, invalid
  combination rejection

### FR-0248
**Requirement**: `--debug` shall request sanitized debug artifacts inside the
selected output root.

**Applicability**:
- `export --debug`
- `export --plan-only --debug`

**Rationale**:
- Operators need one diagnostic mode that captures enough local evidence to
  troubleshoot export failures without changing the selected workflow.

**Acceptance Criteria**:
1. If `--debug` is supplied on `export`, the run writes debug artifacts governed
   by `FR-0249`.
2. If `--debug` is omitted, the run does not write the `_debug/` artifact tree
   governed by `FR-0249`.
3. `--debug` does not select, imply, or mutate any other public option.
4. `--debug` never changes page scope, fail-fast behavior, generated output-root
   selection, ZIP selection, resume selection, child traversal, link depth, or
   configured run limits.
5. Any command other than `export` used with `--debug` is rejected.

**Dependencies**:
- `FR-0036`
- `FR-0249`

**Traceability**:
- Area: option semantics
- Observable evidence: debug artifact tree presence, unchanged run behavior

### FR-0252
**Requirement**: `--insecure` shall request insecure export transport for one
run.

**Applicability**:
- `export --insecure`
- `export --plan-only --insecure`

**Rationale**:
- Operators need insecure transport to be explicit and isolated to one export
  invocation.

**Acceptance Criteria**:
1. If `--insecure` is supplied on `export`, insecure transport is selected for
   that invocation as governed by `FR-0251`.
2. If `--insecure` is omitted from `export`, insecure transport is selected only
   when effective JSON config key `insecure` is `true` under `FR-0219`.
3. `--insecure` does not select, imply, or mutate any other public option.
4. `--insecure` never changes page scope, fail-fast behavior, generated
   output-root selection, ZIP selection, resume selection, child traversal, link
   depth, debug artifact selection, or configured run limits.
5. Any command other than `export` used with `--insecure` is rejected.

**Dependencies**:
- `FR-0036`
- `FR-0219`
- `FR-0251`

**Traceability**:
- Area: option semantics
- Observable evidence: insecure transport selection, warning emission,
  unchanged non-transport behavior

### FR-0229
**Requirement**: Configured public option-equivalent values shall use the same
value validation as command-line option values.

**Applicability**:
- effective option-equivalent values selected from explicit JSON config under
  `FR-0219`
- effective option-equivalent values selected from user JSON config under
  `FR-0219`

**Rationale**:
- Operators need JSON config inputs that select public option behavior to fail
  the same way as equivalent command-line inputs.

**Acceptance Criteria**:
1. A configured value selected for `outputRoot` is validated as the path value
   consumed by `FR-0021`.
2. Configured values selected for `maxPages`, `maxDownloadMib`, `sleepMs`,
   `maxFindCandidates`, and `linkDepth` are validated by the corresponding
   numeric syntax rules in `FR-0014` and `FR-0246`.
3. Effective Confluence access values selected under `FR-0219` are interpreted
   by the remote-access context rules in `FR-0216`.
4. If a configured option-equivalent value fails the validation required by
   criteria 1 through 2,
   the invocation is rejected before command work begins.

**Dependencies**:
- `FR-0014`
- `FR-0021`
- `FR-0216`
- `FR-0219`
- `FR-0246`

**Traceability**:
- Area: option semantics
- Observable evidence: invalid configured value rejection

### FR-0231
**Requirement**: Public flag options shall consume no following argv token as a
value.

**Applicability**:
- non-help invocations using public flag options

**Rationale**:
- Operators need flag parsing to be deterministic when a flag is followed by
  another option token or positional-looking token.

**Acceptance Criteria**:
1. Public flag options are exactly `--plan-only`, `--debug`, `--resume`,
   `--no-fail-fast`, `--zip`, `--include-children`, and `--insecure`.
2. A public flag option consumes only its own argv token.
3. The argv token immediately following a public flag option remains available
   for normal option parsing, valued-option value consumption, or positional
   operand rejection under `FR-0036`.

**Dependencies**:
- `FR-0036`

**Traceability**:
- Area: option semantics
- Observable evidence: argv parsing for public flag options

### FR-0232
**Requirement**: Public valued options shall consume exactly one following argv
token as their value.

**Applicability**:
- non-help invocations using public valued options

**Rationale**:
- Operators need valued-option parsing to be independent of whether the value
  begins with `-` or `--`.

**Acceptance Criteria**:
1. Public valued options are exactly `--page-id`, `--out`, `--config`,
   `--max-pages`, `--max-download-mib`, `--sleep-ms`,
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
**Requirement**: The run-stop limit options shall bound accepted export
runs.

**Applicability**:
- `export --max-pages <n>`
- `export --plan-only --max-pages <n>`
- `export` with effective JSON config key `maxPages`
- `export --max-download-mib <n>`
- `export --plan-only --max-download-mib <n>`
- `export` with effective JSON config key `maxDownloadMib`

**Rationale**:
- Operators need explicit controls that can stop a run before it grows beyond the
  intended size.

**Acceptance Criteria**:
1. If `--max-pages <n>` or effective JSON config key `maxPages` selects a max-pages
   value, that value stops further page processing when `n` processed pages
   have been reached.
2. When the nth page reaches processed-page status under `FR-0127`, the product
   completes the remaining required processing for that nth page before applying
   the `--max-pages` stop; no later queued page begins processing.
3. If `--max-download-mib <n>` or effective JSON config key `maxDownloadMib` selects
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
   attempt, one attachment-preview acquisition for one page in `plan_only`
   execution mode, one page-payload materialization for one page in
   `materialized` execution mode, one attachment-data acquisition needed to
   determine `attachment_count` for one processed page in `materialized`
   execution mode, and one attachment-payload download for one attachment in
   `materialized` execution mode.
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
   `plan_only` execution mode, page-payload materialization for
   `materialized` execution mode, attachment-data acquisition needed to
   determine `attachment_count` for `materialized` execution mode, and
   attachment-payload downloads for `materialized` execution mode.
   Attachment-payload downloads for
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
13. Any command other than `export` used with either option is
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
- `export --plan-only --sleep-ms <n>`
- `export` with effective JSON config key `sleepMs`

**Rationale**:
- Operators need explicit control over request pacing.

**Acceptance Criteria**:
1. If `--sleep-ms <n>` is supplied, the effective per-page delay is `n`
   milliseconds.
2. If `--sleep-ms <n>` is omitted and JSON config key `sleepMs` has an
   effective value under `FR-0219`, the effective per-page delay is that value
   in milliseconds.
3. If neither `--sleep-ms <n>` nor `sleepMs` supplies a sleep value,
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
9. Any command other than `export` used with `--sleep-ms` is
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
- `export --plan-only --max-find-candidates <n>`
- `export` with effective JSON config key `maxFindCandidates`

**Rationale**:
- Operators need explicit control over conservative title-resolution breadth.

**Acceptance Criteria**:
1. If `--max-find-candidates <n>` is supplied, the effective candidate limit for
   one title-resolution attempt is `n`.
2. If `--max-find-candidates <n>` is omitted and JSON config key
   `maxFindCandidates` has an effective value under `FR-0219`, the effective
   candidate limit for one title-resolution attempt is that value.
3. If neither `--max-find-candidates <n>` nor `maxFindCandidates` supplies a
   candidate limit, title-resolution candidate inspection is unlimited.
4. When an effective candidate limit applies, the product inspects at most that
   many title candidates for any single title-resolution attempt.
5. If the effective candidate limit prevents unique resolution, the link remains
   unresolved.
6. Any command other than `export` used with `--max-find-candidates` is
   rejected.

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
1. `export` supports only `--page-id`, `--out`, `--plan-only`, `--debug`,
   `--resume`, `--no-fail-fast`, `--zip`, `--include-children`, `--config`,
   `--insecure`, `--max-pages`, `--max-download-mib`, `--sleep-ms`,
   `--max-find-candidates`, and `--link-depth`.
2. `setup` supports no options.
3. The supported options that take values use exactly these value placeholders in
   help output: `--page-id` uses `<id>`, `--out` uses `<path>`,
   `--config` uses `<file>`, `--max-pages` uses `<n>`,
   `--max-download-mib` uses `<n>`, `--sleep-ms` uses `<n>`,
   `--max-find-candidates` uses `<n>`, and `--link-depth` uses `<n>`.
4. Every supported option in criteria 1 through 2 that is not listed in
   criterion 3 is a flag option and has no value placeholder in help output.
5. No command accepts positional operands after the command token other than
   values consumed by the valued options in criterion 3.
6. Any non-option token that is not consumed as the value for one valued option
   is rejected under `FR-0019`.

**Dependencies**:
- `FR-0019`
- `FR-0222`

**Traceability**:
- Area: option semantics
- Observable evidence: command-specific option acceptance and rejection behavior

### FR-0233
**Requirement**: Effective public option values shall be selected from
invocation-local inputs only.

**Applicability**:
- accepted non-help `export` invocations

**Rationale**:
- Operators need one reproducible precedence model for each invocation.

**Acceptance Criteria**:
1. Effective values selected from public command-line options take precedence
   according to `FR-0219`.
2. Effective values selected from explicit JSON config take precedence according
   to `FR-0219`.
3. Effective values selected from user JSON configuration take precedence
   according to `FR-0219`.
4. Effective credential values selected from the process environment take
   precedence according to `FR-0219`.

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
- accepted `export` invocations in `materialized` execution mode

**Rationale**:
- Operators need one stable page payload contract for exported content.

**Acceptance Criteria**:
1. The effective page payload format for every accepted `export` invocation in
   `materialized` execution mode is Markdown (`md`).
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
- `export` invocations with or without `--zip`

**Rationale**:
- Operators need a portable retained artifact without losing the plain output
  root by default.

**Acceptance Criteria**:
1. Supplying `--zip` on `export` selects a ZIP-packaging request for that
   invocation.
2. Omitting `--zip` on `export` selects no ZIP-packaging request for that
   invocation.
3. `--zip` is a flag option and consumes no following argv token as a value.
4. Any command other than `export` used with `--zip` is rejected.
5. ZIP artifact path derivation, creation timing, archive contents, retained
   plain-root relationship, `summary.txt` `zip_path`, and ZIP packaging failure
   behavior are governed by `FR-0221` and `FR-0238`.

**Dependencies**:
- `FR-0036`
- `FR-0221`
- `FR-0238`

**Traceability**:
- Area: option semantics
- Observable evidence: ZIP-packaging request selection and unsupported command
  rejection

### FR-0234
**Requirement**: `--include-children` shall select recursive child traversal for
one run.

**Applicability**:
- `export --include-children`
- `export --plan-only --include-children`

**Rationale**:
- Operators need child-tree traversal to be explicit because default runs should
  not expand scope through Confluence child hierarchy.

**Acceptance Criteria**:
1. `--include-children` is a flag option with no value.
2. If `--include-children` is supplied on `export`, recursive child
   traversal is selected for that run.
3. If `--include-children` is omitted from `export`, recursive child
   traversal is not selected for that run.
4. Any command other than `export` used with `--include-children` is
   rejected.
5. The selector chooses only recursive child traversal. Link-driven scope
   expansion is governed by `FR-0061`, `FR-0062`, and `FR-0218`.

**Dependencies**:
- `FR-0036`
- `FR-0060`
- `FR-0061`
- `FR-0062`
- `FR-0218`

**Traceability**:
- Area: option semantics
- Observable evidence: accepted child-traversal selection, default child
  traversal absence, unsupported command rejection

### FR-0218
**Requirement**: `--link-depth <n>` shall select the effective link-depth for
link-driven scope expansion.

**Applicability**:
- `export --link-depth <n>`
- `export --plan-only --link-depth <n>`
- `export` with effective JSON config key `linkDepth`

**Rationale**:
- Operators need explicit control over how many supported internal-link hops can
  expand the export scope.

**Acceptance Criteria**:
1. The effective link-depth is a canonical non-negative integer count of
   supported internal-link hops away from pages already in scope for one run.
2. If `--link-depth <n>` is supplied on `export`, the effective
   link-depth for that run is `n`.
3. If `--link-depth <n>` is omitted and JSON config key `linkDepth` has an
   effective value under `FR-0219`, the effective link-depth is that value.
4. If neither `--link-depth <n>` nor `linkDepth` supplies a link-depth value,
   the effective link-depth is `1`.
5. Any command other than `export` used with `--link-depth` is
   rejected.
6. The selector chooses only the effective link-depth value; recursive child
   traversal selection is governed by `FR-0234`, link-driven scope expansion is
   governed by `FR-0061` and `FR-0062`, and deterministic queue ordering is
   governed by `FR-0141`.

**Dependencies**:
- `FR-0014`
- `FR-0036`
- `FR-0060`
- `FR-0061`
- `FR-0062`
- `FR-0141`
- `FR-0219`
- `FR-0234`

**Traceability**:
- Area: option semantics
- Observable evidence: accepted link-depth selection, default link-depth
  behavior, unsupported command rejection
