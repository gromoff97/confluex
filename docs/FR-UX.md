# Operator Experience Requirements


### FR-0007
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
- `FR-0001`
- `FR-0002`
- `FR-0003`
- `FR-0004`
- `FR-0005`
- `FR-0006`

**Traceability**:
- Area: operator experience
- Observable evidence: top-level help output, stdout, exit code

### FR-0008
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
   the shared absence token defined by `FR-0125`.
5. If a command has no optional options, the `Optional options` section states
   the shared absence token defined by `FR-0125`.
6. Each supported option of the target command appears exactly once under either
   `Required options` or `Optional options`.
7. Within `Required options` and `Optional options`, entries appear in the same
   relative order as that command's supported option list in `FR-0036`,
   restricted to the options assigned to that section.
8. Command help includes at least one example invocation that is accepted under
   this document when its placeholders are replaced with conforming values.
9. Command help exits `0`, writes nothing to `stderr`, and performs no command
   work other than rendering help.

**Dependencies**:
- `FR-0001`
- `FR-0002`
- `FR-0003`
- `FR-0004`
- `FR-0005`
- `FR-0006`
- `FR-0036`
- `FR-0125`

**Traceability**:
- Area: operator experience
- Observable evidence: command help output on stdout

### FR-0009
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
- `FR-0017`
- `FR-0094`
- `FR-0111`

**Traceability**:
- Area: operator experience
- Observable evidence: stderr warning and error output

### FR-0010
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
- `FR-0042`
- `FR-0047`
- `FR-0049`
- `FR-0058`

**Traceability**:
- Area: operator experience
- Observable evidence: stdout and stderr stream selection

### FR-0123
**Requirement**: `export --help` shall document the supported materialized page
export formats explicitly.

**Applicability**:
- `confluex export --help`

**Rationale**:
- Operators need command help that makes Markdown and HTML export support
  discoverable without consulting other requirement files.

**Acceptance Criteria**:
1. The `--page-format <format>` entry in `confluex export --help` identifies
   Markdown (`md`) and HTML (`html`) as the supported materialized page export
   formats.
2. The same help entry states that omitting `--page-format` defaults the
   materialized page export format to Markdown (`md`).
3. The `Examples` section contains at least one accepted `export` example that
   omits `--page-format` and at least one accepted `export` example that uses
   `--page-format html`.

**Dependencies**:
- `FR-0001`
- `FR-0008`
- `FR-0036`
- `FR-0121`
- `FR-0122`

**Traceability**:
- Area: operator experience
- Observable evidence: `confluex export --help` option text and examples

### FR-0124
**Requirement**: Quoted path strings shall use one stable serialization across
governed CLI text and report files.

**Applicability**:
- all governed stdout lines, stderr lines, and report-file fields that use a
  quoted path string

**Rationale**:
- Operators and automation need one reusable path-serialization rule rather than
  card-local quoting conventions.

**Acceptance Criteria**:
1. A quoted path string begins with `"` and ends with `"` and has no
   surrounding whitespace outside those delimiters.
2. The interior is serialized exactly as a JSON string body for the path value
   with UTF-8 text preserved directly and only the required JSON escapes used.
3. Deserializing that JSON string body yields the exact path value with no
   added, removed, or normalized path characters.
4. Cards that reuse the quoted path-string primitive may constrain whether the
   underlying path must be absolute, relative, existing, or non-existing, but
   they do not redefine the quoting or escaping rules.

**Dependencies**:
- `FR-0010`

**Traceability**:
- Area: operator experience
- Observable evidence: quoted path values in stdout, stderr, and report files

### FR-0125
**Requirement**: The shared absence token shall use one stable serialization
across governed CLI text and report files.

**Applicability**:
- all governed stdout lines, stderr lines, and report-file fields that use a
  scalar absence token

**Rationale**:
- Operators and automation need one reusable absence-token rule rather than
  card-local spellings for missing values.

**Acceptance Criteria**:
1. The shared absence token is exactly the lowercase ASCII text `none`.
2. When a governed line or field uses the shared absence token, the entire
   serialized field value is exactly `none` with no quoting, surrounding
   whitespace, or additional delimiters.
3. Cards that reuse the shared absence token may constrain what absence means
   for that specific field or line, but they do not redefine the token's
   spelling, casing, or surrounding serialization.
4. A more specific card may replace the shared absence token only by explicitly
   defining another absence representation for that exact field or line.

**Dependencies**:

**Traceability**:
- Area: operator experience
- Observable evidence: stable missing-value serialization in governed text and
  report fields

### FR-0126
**Requirement**: Delimited token lists shall use one stable serialization across
governed CLI text and report files.

**Applicability**:
- all governed stdout lines, stderr lines, and report-file fields that use a
  token list rather than a scalar token

**Rationale**:
- Operators and automation need one reusable list-serialization rule rather than
  card-local delimiter and spacing conventions.

**Acceptance Criteria**:
1. A delimited token list serializes items using ASCII commas with no
   surrounding spaces.
2. A serialized token list contains no empty elements, leading delimiter,
   trailing delimiter, or repeated delimiter.
3. A single-item token list serializes as that one token with no comma.
4. Cards that reuse the delimited token-list primitive may constrain the token
   vocabulary, ordering, uniqueness, and whether the shared absence token
   defined by `FR-0125` may replace the list entirely, but they do not redefine
   the delimiter or spacing rules.

**Dependencies**:
- `FR-0125`

**Traceability**:
- Area: operator experience
- Observable evidence: stable token-list serialization in governed text and
  report fields
