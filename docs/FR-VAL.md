# Invocation Validation Requirements


### FR-0011
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
- `FR-0009`

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
   traversal, payload export, attachment download, report generation, or output
   root reuse begins.
3. If the rejected command is `doctor`, `config`, `install`, or `uninstall`,
   rejection occurs before command-specific state changes begin.

**Dependencies**:
- `FR-0001`
- `FR-0002`
- `FR-0003`
- `FR-0004`
- `FR-0005`
- `FR-0006`
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
3. An empty string supplied to `--out`, `--log-file`, `--install-dir`, or
   `--encryption-key` causes rejection.

**Dependencies**:
- `FR-0020`
- `FR-0021`
- `FR-0029`
- `FR-0030`
- `FR-0033`

**Traceability**:
- Area: invocation validation
- Observable evidence: stderr error output, absence of command work

### FR-0014
**Requirement**: The product shall reject malformed numeric option values.

**Applicability**:
- non-help invocations using numeric options

**Rationale**:
- Operators need deterministic numeric validation boundaries.

**Acceptance Criteria**:
1. `--page-id` requires a non-empty canonical page identifier serialized as one
   base-10 integer with no sign character, decimal point, grouping characters,
   or surrounding whitespace.
2. `--max-find-candidates` requires a positive integer.
3. `--max-pages` requires a positive integer.
4. `--max-download-mib` requires a positive integer.
5. `--sleep-ms` requires a non-negative integer.

**Dependencies**:
- `FR-0020`
- `FR-0034`
- `FR-0035`

**Traceability**:
- Area: invocation validation
- Observable evidence: rejection output for malformed numeric values

### FR-0015
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
- `FR-0023`
- `FR-0025`
- `FR-0032`

**Traceability**:
- Area: invocation validation
- Observable evidence: rejection output, absence of command work

### FR-0016
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
1. If root-page preflight determines that the target page is missing,
   inaccessible, or cannot be resolved to a page identity, the invocation is
   rejected.
2. Rejection occurs before traversal, payload export, attachment download,
   report generation, or output-root reuse begins.
3. Rejection output identifies the target `--page-id`.
4. If root-page preflight succeeds, it establishes one canonical resolved root
   page identifier for that run, serialized with the canonical page-identifier
   syntax required by `FR-0014`, and later requirements that refer to the run's
   root `page_id` use that resolved identifier.

**Dependencies**:
- `FR-0020`
- `FR-0014`
- `FR-0052`

**Traceability**:
- Area: invocation validation
- Observable evidence: rejection timing, stderr error output

### FR-0018
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
- `FR-0015`

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
1. Rejection output is written to `stderr`.
2. The first line of rejection output begins with `ERROR: `.
3. Rejected invocations exit `1`.
4. If the rejected invocation targets `export` or `plan`, the CLI does not
   create or reuse an output root.
5. If the operator supplied `--log-file` on a rejected invocation, the CLI does
   not create, append, or overwrite that persistent log artifact.

**Dependencies**:
- `FR-0009`
- `FR-0010`

**Traceability**:
- Area: invocation validation
- Observable evidence: stderr, exit code, absence of output-root and log-file
  side effects

### FR-0122
**Requirement**: The product shall reject unsupported page payload format
values before command work begins.

**Applicability**:
- non-help invocations using `--page-format <format>`

**Rationale**:
- Operators need deterministic validation of page payload format selection.

**Acceptance Criteria**:
1. `--page-format md` is accepted.
2. `--page-format html` is accepted.
3. Any other `--page-format` value, including the empty string, is rejected.
4. If the rejected command is `export`, rejection occurs before traversal, page
   payload materialization, attachment download, report generation, or
   output-root reuse begins.

**Dependencies**:
- `FR-0012`
- `FR-0013`
- `FR-0121`

**Traceability**:
- Area: invocation validation
- Observable evidence: acceptance or rejection of format values, absence of
  command work
