# Command Surface Requirements


### FR-0001
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
- None

**Traceability**:
- Area: command surface
- Observable evidence: top-level help output, command help output, workflow entry

### FR-0002
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
- None

**Traceability**:
- Area: command surface
- Observable evidence: top-level help output, command help output, workflow entry

### FR-0003
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
- None

**Traceability**:
- Area: command surface
- Observable evidence: top-level help output, command help output, workflow entry

### FR-0004
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
- None

**Traceability**:
- Area: command surface
- Observable evidence: top-level help output, command help output, workflow entry

### FR-0005
**Requirement**: The product shall not expose `install` as a top-level command.

**Applicability**:
- `confluex --help`
- `confluex install`
- `confluex install --help`

**Rationale**:
- Installation is governed by the npm package lifecycle, so the CLI must not
  provide a competing self-installation workflow.

**Acceptance Criteria**:
1. Top-level help does not list `install` as a supported command.
2. `confluex install` and `confluex install --help` are rejected as unsupported
   command invocations under `FR-0012`.
3. No accepted Confluex CLI invocation creates, updates, verifies, or removes a
   package installation; package lifecycle behavior is governed by `FR-0048`
   through `FR-0051`.

**Dependencies**:
- `FR-0012`
- `FR-0048`
- `FR-0049`
- `FR-0050`
- `FR-0051`

**Traceability**:
- Area: command surface
- Observable evidence: top-level help output, unsupported-command rejection

### FR-0006
**Requirement**: The product shall not expose `uninstall` as a top-level
command.

**Applicability**:
- `confluex --help`
- `confluex uninstall`
- `confluex uninstall --help`

**Rationale**:
- Uninstallation is governed by the npm package lifecycle, so the CLI must not
  provide a competing self-removal workflow.

**Acceptance Criteria**:
1. Top-level help does not list `uninstall` as a supported command.
2. `confluex uninstall` and `confluex uninstall --help` are rejected as
   unsupported command invocations under `FR-0012`.
3. No accepted Confluex CLI invocation removes a package installation; package
   lifecycle behavior is governed by `FR-0048` through `FR-0051`.

**Dependencies**:
- `FR-0012`
- `FR-0048`
- `FR-0049`
- `FR-0050`
- `FR-0051`

**Traceability**:
- Area: command surface
- Observable evidence: top-level help output, unsupported-command rejection

### FR-0129
**Requirement**: The product shall expose `selftest` as the only supported
explicit-target live-regression command.

**Applicability**:
- `confluex --help`
- `confluex selftest --url <base-url> --token <token>`
- `confluex selftest --help`

**Rationale**:
- Operators and maintainers need one canonical command that uses an already
  running Confluence 7.13.7 stand, prepares governed fixture data, and runs the
  governed live-regression suite against that explicit target.

**Acceptance Criteria**:
1. Top-level help lists `selftest` as a supported command.
2. `confluex selftest --help` identifies `selftest` as the live regression
   self-test workflow.
3. An accepted `confluex selftest --url <base-url> --token <token>` invocation
   starts the self-test workflow against the operator-supplied target rather
   than any export, plan, diagnostic, or configuration workflow.

**Dependencies**:
- None

**Traceability**:
- Area: command surface
- Observable evidence: top-level help output, command help output, workflow entry
