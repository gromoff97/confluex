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
- `FR-0001`
- `FR-0002`
- `FR-0003`
- `FR-0004`
- `FR-0005`
- `FR-0006`
- `FR-0036`

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
