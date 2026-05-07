# Invocation Validation Requirements


### FR-0011
**Requirement**: The product shall reject unknown top-level commands explicitly.

**Applicability**:
- `confluex <command>` where `<command>` is not supported

**Rationale**:
- Operators need a clear rejection when they invoke a command that does not
  exist.

**Acceptance Criteria**:
1. If the invocation is not one of the exact help shapes governed by `FR-0007`
   or `FR-0008` and the first argv token after the program path is not a
   public command token governed by `FR-0004`, the invocation is rejected under
   the rejected-invocation stream, side-effect, and exit-code contracts governed
   by `FR-0019` and `FR-0118`.
2. The first stderr line uses the exact unknown-command diagnostic template
   governed by `FR-0146`.
3. Because criterion 1 takes the `FR-0019` rejected-invocation branch, no
   accepted-command workflow or product-owned state mutation begins.

**Dependencies**:
- `FR-0007`
- `FR-0008`
- `FR-0004`
- `FR-0019`
- `FR-0118`
- `FR-0146`

**Traceability**:
- Area: invocation validation
- Observable evidence: stderr error output, absence of workflow side effects

### FR-0012
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
   traversal, payload export, attachment download, report generation, output
   root reuse, or ZIP packaging begins.
3. If the rejected command is `doctor`, rejection occurs before dependency
   probing, page-access diagnostics, support-profile reporting,
   supported-link-form reporting, next-action computation, or persistent log
   creation begins.

**Dependencies**:
- `FR-0004`
- `FR-0008`
- `FR-0036`

**Traceability**:
- Area: invocation validation
- Observable evidence: rejection timing, absence of command work

### FR-0013
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
3. An empty string supplied to `--out`, `--log-file`, or `--env-file` causes
   rejection.
4. For every valued option defined by `FR-0036`, the option consumes the
   immediately following argv token as its value even when that token begins with
   `-` or `--`.
5. If no argv token follows a valued option, the invocation is rejected for a
   missing required value before value-specific validation.

**Dependencies**:
- `FR-0020`
- `FR-0021`
- `FR-0033`
- `FR-0036`

**Traceability**:
- Area: invocation validation
- Observable evidence: stderr error output, absence of command work

### FR-0014
**Requirement**: Canonical numeric product values shall use one deterministic
decimal syntax.

**Applicability**:
- non-help invocations using numeric options
- governed report fields, lifecycle lines, and artifact paths that serialize
  canonical page identifiers or numeric product values

**Rationale**:
- Operators need deterministic numeric validation boundaries.

**Acceptance Criteria**:
1. A canonical non-negative integer value is one or more ASCII digits `0`
   through `9`, contains no sign character, decimal point, grouping character,
   TAB, LF, CR, leading ASCII space, trailing ASCII space, or leading zero
   unless the entire value is exactly `0`, and is interpreted in base 10.
2. A canonical positive integer value is a canonical non-negative integer value
   whose interpreted numeric value is greater than zero.
3. A canonical page identifier is a canonical non-negative integer value from
   criterion 1.
4. `--page-id` requires a non-empty canonical page identifier.
5. `--max-find-candidates` requires a canonical positive integer value.
6. `--max-pages` requires a canonical positive integer value.
7. `--max-download-mib` requires a canonical positive integer value.
8. `--sleep-ms` requires a canonical non-negative integer value.
9. `--link-depth` requires a canonical non-negative integer value.

**Dependencies**:
- None

**Traceability**:
- Area: invocation validation
- Observable evidence: rejection output for malformed numeric values

### FR-0015
**Requirement**: The product shall reject public option combinations that fail
an option-specific prerequisite.

**Applicability**:
- non-help invocations using public options with command-specific prerequisites

**Rationale**:
- Operators need prerequisite failures to be rejected before the invocation
  reaches command work.

**Acceptance Criteria**:
1. `export --resume` requires an explicit `--out <path>` value and is rejected
   when `--out <path>` is omitted, as governed by `FR-0026`.
2. `--resume` on any command other than `export` is rejected as an unsupported
   command-option combination under `FR-0012`.
3. `--zip` on any command other than `export` is rejected as an unsupported
   command-option combination under `FR-0012`.
4. This card governs only command-surface prerequisite rejection; resume-root
   compatibility after the prerequisite is satisfied remains governed by
   `FR-0103`.

**Dependencies**:
- `FR-0012`
- `FR-0026`
- `FR-0103`

**Traceability**:
- Area: invocation validation
- Observable evidence: rejection output, absence of command work

### FR-0016
**Requirement**: The product shall reject reuse of an explicit output root unless
the invocation is a valid resume scenario.

**Applicability**:
- `export` and `plan` with `--out <path>`

**Rationale**:
- Operators need protection against accidental overwrite or silent reuse of prior
  result locations.

**Acceptance Criteria**:
1. `export` or `plan` with `--out <path>` pointing to an existing path is
   rejected unless the invocation is a valid `export --resume --out <path>`
   scenario.
2. `plan` with an existing explicit output root is rejected because `plan` does
   not support resume.
3. `export --resume --out <path>` is accepted only when `<path>` is recovery
   compatible under `FR-0103`.

**Dependencies**:
- `FR-0021`
- `FR-0026`
- `FR-0103`

**Traceability**:
- Area: invocation validation
- Observable evidence: rejection or acceptance of existing output roots

### FR-0017
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
1. Root-page preflight uses the remote-access context from `FR-0216`.
2. The governed Confluence request target for root-page preflight is method
   `GET`, target path `/rest/api/content/<page_id>`, and absent query
   component, where `<page_id>` is the effective `--page-id` value after
   command-surface validation under `FR-0014`.
3. Root-page preflight succeeds only when the effective request from criteria 1
   and 2 completes with HTTP status `200`, the response body is valid UTF-8
   JSON text, the JSON value is an object, that object contains string field
   `id`, and that `id` value is a canonical page identifier under `FR-0014`.
4. The canonical resolved root page identifier established by a successful
   root-page preflight is the response object's `id` value from criterion 3,
   not merely the raw command-line token.
5. If root-page preflight using the remote-access context from `FR-0216`
   determines that the target page is missing, inaccessible, cannot be
   resolved to a page identity, or cannot be tested because that context is
   unusable for the current invocation, the invocation is rejected.
6. For criterion 5, missing, inaccessible, unresolved, or untestable includes
   unusable remote-access context, request creation failure, request transport
   failure, any HTTP status other than `200`, invalid UTF-8 response bytes,
   invalid JSON response text, a non-object JSON response, missing `id`, a
   non-string `id`, or an `id` that is not canonical under `FR-0014`.
7. Rejection occurs before traversal, payload export, attachment download,
   report generation, or output-root reuse begins.
8. Rejection output identifies the target `--page-id`.
9. If root-page preflight succeeds, it establishes one canonical resolved root
   page identifier for that run, serialized with the canonical page-identifier
   syntax required by `FR-0014`, and later requirements that refer to the run's
   root `page_id` use that resolved identifier.

**Dependencies**:
- `FR-0014`
- `FR-0216`

**Traceability**:
- Area: invocation validation
- Observable evidence: rejection timing, stderr error output

### FR-0212
**Requirement**: Invocation acceptance shall use one shared threshold.

**Applicability**:
- all non-help supported invocations

**Rationale**:
- Rejection, runtime-failure, exit-code, and side-effect rules need one
  objective boundary between pre-acceptance validation and accepted work.

**Acceptance Criteria**:
1. An invocation becomes accepted only after every rejection-capable validation
   and preflight requirement that applies to that command has completed without
   rejection and immediately before the command-specific accepted-work
   threshold from criteria 5 and 6 is crossed.
2. Any failure or validation outcome observed before criterion 1 is
   pre-acceptance and is not an accepted-command or accepted-run runtime
   failure.
3. For `export` and `plan`, pre-acceptance work occurs in this order:
   command-surface validation; root-page preflight under `FR-0017`;
   explicit-output-root rejection under `FR-0016`, including resume-root
   compatibility evaluation under `FR-0103` when `export --resume --out <path>`
   applies; and generated output-root candidate selection under `FR-0055` when
   no output-root selector supplies a path.
4. Creating or reusing an output root, creating or replacing a persistent log
   artifact, traversing Confluence data, generating reports, materializing page
   payloads, downloading attachments, or creating a ZIP archive occurs only
   after criterion 1.
5. For `export` and `plan`, the accepted-work threshold from criterion 1 is the
   shared accepted-run execution threshold governed by `FR-0180`.
6. For `doctor`, the accepted-work threshold from criterion 1 is the first
   governed diagnostic step needed for that invocation: dependency probing
   under `FR-0038`, page-access diagnostics under `FR-0039` when `--page-id`
   is supplied, support-profile reporting under `FR-0041`, supported-link-form
   reporting under `FR-0044`, or next-action computation under `FR-0042`.

**Dependencies**:
- `FR-0016`
- `FR-0017`
- `FR-0038`
- `FR-0039`
- `FR-0041`
- `FR-0042`
- `FR-0044`
- `FR-0055`
- `FR-0103`
- `FR-0180`

**Traceability**:
- Area: invocation validation
- Observable evidence: branch selection between rejection and accepted work

### FR-0018
**Requirement**: Repeated option occurrences shall have deterministic semantics.

**Applicability**:
- non-help invocations with repeated options

**Rationale**:
- Operators and automation need repeatable semantics for repeated flags and
  valued options.

**Acceptance Criteria**:
1. Repeating a flag option as defined by `FR-0036` is treated as one request
   rather than rejected solely because the flag was repeated.
2. Repeating a valued option makes the last supplied value the effective value.
3. If repeated values make the invocation invalid under a more specific
   requirement, the invocation is rejected according to that more specific
   requirement.

**Dependencies**:
- `FR-0015`
- `FR-0036`

**Traceability**:
- Area: invocation validation
- Observable evidence: effective option behavior under repeated occurrences

### FR-0019
**Requirement**: Rejected invocations shall be observable and side-effect free.

**Applicability**:
- all rejected invocations

**Rationale**:
- Operators need a rejected invocation to be visibly rejected and free of hidden
  product side effects.

**Acceptance Criteria**:
1. A rejected invocation is any invocation whose failure is observed before
   invocation acceptance under `FR-0212`.
2. Rejection output is written to `stderr`.
3. The first line of rejection output begins with `ERROR: `.
4. Rejected invocations write nothing to `stdout`.
5. Rejection stderr is UTF-8 text with LF line endings and at least one line.
6. The first stderr line is `ERROR: <message>`, where `<message>` is non-empty
   after removing leading and trailing ASCII space and contains no TAB, LF, or
   CR.
7. Additional stderr lines, if any, are non-governed diagnostic text and do not
   define additional rejection status values.
8. If the rejected invocation targets `export` or `plan`, the CLI does not
   create or reuse an output root.
9. If the operator supplied `--log-file` on a rejected invocation, the CLI does
   not create, append, or overwrite that persistent log artifact.
10. If the rejected invocation targets `doctor`, the CLI does not probe local
    dependencies, perform page-access diagnostics, emit diagnostic stdout, or
    create, append, or overwrite a persistent log artifact.
11. If the rejected invocation targets an unsupported command token, the CLI
    does not dispatch to any public workflow governed by `FR-0129`.

**Dependencies**:
- `FR-0009`
- `FR-0129`
- `FR-0212`

**Traceability**:
- Area: invocation validation
- Observable evidence: stderr, exit code, absence of output-root and log-file
  side effects

### FR-0146
**Requirement**: Validation rejection diagnostics shall use one deterministic
first-line precedence and serialization rule.

**Applicability**:
- rejected invocations

**Rationale**:
- Operators and tests need one authoritative diagnostic when several validation
  failures are possible for the same argv.

**Acceptance Criteria**:
1. The first stderr line for a rejected invocation is exactly one of the
   templates defined by criteria 10 through 18.
2. If the first non-help command token is not a supported command, the selected
   template is `ERROR: unknown_command <command_token>`, where
   `<command_token>` is that raw argv token serialized as a diagnostic token
   under criterion 7.
3. For a known command, the product completes command-surface validation over
   the complete argv before emitting any command-surface diagnostic. That
   validation enumerates missing option values, unsupported options, unsupported
   positional operands, invalid effective option values, invalid option
   combinations, and missing required options that are determinable without
   traversal, filesystem mutation, network access, report artifact creation, or
   run-artifact creation.
4. Command-surface diagnostics from criterion 3 are selected using this
   precedence order after repeated-option effective values are determined under
   `FR-0018`: missing option value, unsupported option, unsupported positional
   operand, invalid option value, invalid option combination, then missing
   required option.
5. If multiple command-surface failures in the same precedence class are
   enumerated by criterion 3, selection is deterministic as follows:
   missing-option-value selects the earliest raw argv token that is missing its
   value; unsupported-option selects the earliest raw argv token that began with
   `-` or `--`; unsupported-positional-operand selects the earliest raw argv
   token rejected as a positional operand; invalid-option-value selects the
   canonical option token that appears earliest in that command's supported
   option list from `FR-0036`; invalid-option-combination selects the involved
   canonical option-token list whose serialized `<option_tokens>` value is
   bytewise lexicographically smallest; and missing-required-option selects the
   missing canonical option token that appears earliest in that command's
   supported option list from `FR-0036`.
6. If command-surface validation from criterion 3 finds no failure and a later
   validation or preflight operation rejects the invocation before command work
   mutates product-owned state, the product enumerates every such rejection that
   can be determined before mutation without violating any earlier-timing rule
   from another applicable rejecting requirement and without executing
   traversal, filesystem mutation, network access beyond explicitly required
   preflight probes, report artifact creation, or run-artifact creation. If one
   applicable rejecting requirement explicitly requires the
   invocation to reject before another rejecting preflight begins, that
   earlier-ordering rule takes precedence and `FR-0146` does not require the
   later preflight to be executed or enumerated. The diagnostic class is other
   validation rejection and the selected `<requirement_id>` is the lowest
   numeric owning `FR-<NNNN>` id across all enumerated rejecting operations,
   excluding exactly these generic cards: `FR-0010`, `FR-0019`, and
   `FR-0118`.
7. A diagnostic token serializes the raw argv token bytes supplied by the
   operating system by emitting bytes `0x21` through `0x7E` except `%` as their
   ASCII character and emitting every other byte, including `%`, as `%` followed
   by two uppercase hexadecimal digits.
8. On POSIX, the raw argv token bytes for criterion 7 are the exact bytes
   supplied to the process argv entry. On Windows, the raw argv token bytes for
   criterion 7 are the UTF-8 encoding of the Windows argv string after Windows
   command-line parsing.
9. The raw argv token bytes do not need to be valid UTF-8 for diagnostic token
   serialization on platforms that supply argv bytes. The serialized diagnostic
   token contains no ASCII space, TAB, LF, or CR.
10. A missing option value diagnostic is exactly
   `ERROR: missing_option_value <option_token>`, where `<option_token>` is the
   canonical valued option token from `FR-0036`.
11. An unsupported option diagnostic is exactly
   `ERROR: unsupported_option <option_token>`, where `<option_token>` is the raw
   argv token that began with `-` or `--`, was not accepted as a supported
   option for that command, and is serialized as a diagnostic token under
   criterion 7.
12. An unsupported positional operand diagnostic is exactly
   `ERROR: unsupported_positional_operand <operand_token>`, where
   `<operand_token>` is the raw argv token rejected under `FR-0036` and
   serialized as a diagnostic token under criterion 7.
13. An invalid option value diagnostic is exactly
   `ERROR: invalid_option_value <option_token>`, where `<option_token>` is the
   canonical option token whose effective value failed validation.
14. An invalid option combination diagnostic is exactly
   `ERROR: invalid_option_combination <option_tokens>`, where
   `<option_tokens>` is the involved canonical option tokens sorted in ascending
   bytewise lexicographic order and serialized as the delimited token-list form
   defined by `FR-0126`.
15. A missing required option diagnostic is exactly
    `ERROR: missing_required_option <option_token>`, where `<option_token>` is
    the missing canonical option token from `FR-0036`.
16. An unknown-command diagnostic is exactly the template from criterion 2.
17. If the selected owning requirement id from criterion 6 is `FR-0017`, the
    validation rejection diagnostic is exactly
    `ERROR: validation_failed FR-0017 --page-id <diagnostic_token>`, where
    `<diagnostic_token>` is the effective `--page-id` value serialized under
    criterion 7.
18. Any other validation rejection diagnostic is exactly
    `ERROR: validation_failed <requirement_id>`, where `<requirement_id>` is the
    selected owning requirement id from criterion 6.
19. Additional stderr lines, if any, are non-governed diagnostic text and do not
    define additional rejection status values or alter the first-line class.

**Dependencies**:
- `FR-0010`
- `FR-0017`
- `FR-0018`
- `FR-0019`
- `FR-0036`
- `FR-0118`
- `FR-0126`

**Traceability**:
- Area: invocation validation
- Observable evidence: first stderr line for rejected invocations

### FR-0122
**Requirement**: Unsupported public-command options shall be rejected by the
closed option set before command work begins.

**Applicability**:
- non-help invocations using an option token outside the command's closed
  option set

**Rationale**:
- Operators need unknown options to fail visibly under the same closed inventory
  used by help and parsing.

**Acceptance Criteria**:
1. For a public command token governed by `FR-0004`, any option token not
   present in that command's closed option set from `FR-0036` is rejected as an
   unsupported option.
2. Unsupported-option rejection occurs before invocation acceptance under
   `FR-0212`.
3. Unsupported-option diagnostics are selected and serialized under `FR-0146`.
4. This card does not introduce command-specific historical option aliases or
   compatibility fallbacks.

**Dependencies**:
- `FR-0004`
- `FR-0012`
- `FR-0036`
- `FR-0146`
- `FR-0212`

**Traceability**:
- Area: invocation validation
- Observable evidence: unsupported-option rejection before command work

### FR-0131
**Requirement**: Remote-access diagnostics and run preflight shall require a
usable token-only Confluence access context.

**Applicability**:
- non-help `export` invocations
- non-help `plan` invocations
- non-help `doctor --page-id <id>` invocations

**Rationale**:
- Operators need access failures caused by missing or invalid public
  configuration inputs to occur before traversal or page diagnostics proceed.

**Acceptance Criteria**:
1. `export` and `plan` require a usable remote-access context under `FR-0216`
   before root-page preflight can succeed.
2. `doctor --page-id <id>` requires a usable remote-access context under
   `FR-0216` before page-access diagnostics can report `page_access=ok`.
3. Missing, empty, or invalid `CONFLUEX_CONFLUENCE_BASE_URL` or
   `CONFLUEX_CONFLUENCE_TOKEN` values are classified through the governing
   root-page preflight or page-access diagnostic branch rather than by a
   command-line target option.

**Dependencies**:
- `FR-0017`
- `FR-0039`
- `FR-0216`

**Traceability**:
- Area: invocation validation
- Observable evidence: root-page preflight and doctor page-access diagnostics
