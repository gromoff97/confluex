# Command Surface Requirements


### FR-0001
**Requirement**: The product shall expose `setup` as a top-level command.

**Applicability**:
- `confluex --help`
- `confluex setup`
- `confluex setup --help`

**Rationale**:
- Operators need one first-run workflow for validated persistent user
  configuration.

**Acceptance Criteria**:
1. Top-level help lists `setup` as a supported command in the command order
   governed by `FR-0222`.
2. `confluex setup --help` identifies `setup` as the interactive user
   configuration workflow.
3. An accepted `confluex setup` invocation starts the setup workflow rather
   than any other workflow.

**Dependencies**:
- `FR-0222`
- `FR-0053`
- `FR-0054`

**Traceability**:
- Area: command surface
- Observable evidence: top-level help output, command help output, workflow entry

### FR-0002
**Requirement**: The product shall expose `export` as a top-level command.

**Applicability**:
- `confluex --help`
- `confluex export`
- `confluex export --help`

**Rationale**:
- Operators need one export workflow that can either inspect scope or
  materialize Markdown output.

**Acceptance Criteria**:
1. Top-level help lists `export` as a supported command in the command order
   governed by `FR-0222`.
2. `confluex export --help` identifies `export` as the Confluence export
   workflow.
3. An accepted `confluex export ...` invocation starts the export workflow
   rather than any other workflow.
4. The export workflow supports the materialized execution mode governed by
   `FR-0053` and the plan-only execution mode governed by `FR-0054`.

**Dependencies**:
- `FR-0222`

**Traceability**:
- Area: command surface
- Observable evidence: top-level help output, command help output, workflow entry

### FR-0222
**Requirement**: The public top-level command inventory shall be exactly
`setup` and `export` in that order.

**Applicability**:
- `confluex --help`
- non-help command dispatch
- command-help dispatch

**Rationale**:
- Operators and automation need one authoritative command surface with
  deterministic ordering.

**Acceptance Criteria**:
1. The public top-level command tokens are exactly `setup` and `export`.
2. Everywhere the public command inventory is serialized as an ordered list, the
   order is exactly `setup`, then `export`.
3. A first argv token after the program path equal to `setup` or `export` is
   classified as a supported command before option validation.
4. Any other first argv token after the program path is classified as an
   unsupported command under `FR-0011`, except for top-level help shapes
   governed by `FR-0007`.

**Dependencies**:
- `FR-0007`
- `FR-0011`

**Traceability**:
- Area: command surface
- Observable evidence: top-level help output, command dispatch, unsupported
  command rejection

### FR-0223
**Requirement**: Top-level help shall serialize one command summary entry for
each public top-level command.

**Applicability**:
- `confluex --help`

**Rationale**:
- Operators need top-level help to reflect the authoritative command inventory
  without requiring command-specific help probes.

**Acceptance Criteria**:
1. Top-level help emits exactly one command summary entry for each command token
   governed by `FR-0222`.
2. Command summary entries appear in the command order governed by `FR-0222`.
3. Each command summary entry contains the exact command token and a non-empty
   human-readable description on the same physical line.
4. This card governs only command summary entry presence and order; the broader
   top-level help stream contract remains governed by `FR-0007`.

**Dependencies**:
- `FR-0222`
- `FR-0007`

**Traceability**:
- Area: command surface
- Observable evidence: top-level help command summary lines

### FR-0224
**Requirement**: Command-help dispatch shall be available for each public
top-level command.

**Applicability**:
- `confluex setup --help`
- `confluex export --help`

**Rationale**:
- Operators need command-specific option guidance for every public workflow.

**Acceptance Criteria**:
1. For each command token governed by `FR-0222`, `confluex <command> --help`
   is a command-help invocation governed by `FR-0008`.
2. Command-help dispatch for each public command completes before command work
   or command-specific option validation begins.
3. Each public command's help output identifies the command token it documents.
4. This card governs only command-help availability for public commands; the
   command-help stream, line-order, and exit-code contract remains governed by
   `FR-0008`.

**Dependencies**:
- `FR-0222`
- `FR-0008`

**Traceability**:
- Area: command surface
- Observable evidence: command help output and no workflow side effects

### FR-0242
**Requirement**: Non-help command dispatch shall route each public command token
to exactly one public workflow.

**Applicability**:
- accepted non-help `confluex setup` invocations
- accepted non-help `confluex export ...` invocations

**Rationale**:
- Operators need accepted command tokens to select one deterministic workflow.

**Acceptance Criteria**:
1. Accepted non-help `setup` invocations route to the setup workflow governed by
   `FR-0043`.
2. Accepted non-help `export` invocations without `--plan-only` route to the
   materialized export execution mode governed by `FR-0053`.
3. Accepted non-help `export` invocations with `--plan-only` route to the
   plan-only export execution mode governed by `FR-0054`.
4. One accepted invocation routes to exactly one workflow from criteria 1
   through 3.

**Dependencies**:
- `FR-0043`
- `FR-0053`
- `FR-0054`

**Traceability**:
- Area: command surface
- Observable evidence: workflow entry
