# Configuration Requirements


### FR-0045
**Requirement**: `config` shall show the saved default encryption-recipient
state.

**Applicability**:
- `confluex config` with neither `--encryption-key` nor `--clear-encryption-key`

**Rationale**:
- Operators need an explicit way to inspect saved recipient state.

**Acceptance Criteria**:
1. An accepted non-help `config` invocation with neither `--encryption-key` nor
   `--clear-encryption-key` emits exactly one stdout line in the format
   `default_encryption_key=<value>`.
2. If a default encryption recipient is saved, `<value>` is the saved value.
3. If no default encryption recipient is saved, the line is exactly
   `default_encryption_key=none`, using the shared absence token defined by
   `FR-0125`.
4. Accepted `config` read-only invocations write nothing to `stderr` and exit
   `0`.

**Dependencies**:
- `FR-0010`
- `FR-0125`

**Traceability**:
- Area: configuration
- Observable evidence: stdout configuration line, empty stderr, exit code

### FR-0046
**Requirement**: `config` shall save a default encryption-recipient identity.

**Applicability**:
- `confluex config --encryption-key <value>`

**Rationale**:
- Operators need a saved default recipient that can be reused by encrypted runs.

**Acceptance Criteria**:
1. If `<value>` is allowed under `FR-0030`, `config --encryption-key <value>`
   saves that value as the default encryption recipient.
2. The same invocation emits exactly one stdout line
   `default_encryption_key=<value>`.
3. A later `confluex config` invocation with neither `--encryption-key` nor
   `--clear-encryption-key` emits the same saved value.
4. Accepted `config --encryption-key <value>` invocations write nothing to
   `stderr` and exit `0`.

**Dependencies**:
- `FR-0030`
- `FR-0045`

**Traceability**:
- Area: configuration
- Observable evidence: immediate stdout output and later persisted configuration
  state

### FR-0047
**Requirement**: `config` shall clear the saved default encryption-recipient
identity.

**Applicability**:
- `confluex config --clear-encryption-key`

**Rationale**:
- Operators need a deterministic way to remove a previously saved default.

**Acceptance Criteria**:
1. `config --clear-encryption-key` removes the saved default encryption
   recipient.
2. The same invocation emits exactly one stdout line
   `default_encryption_key=none`, using the shared absence token defined by
   `FR-0125`.
3. A later `confluex config` invocation with neither `--encryption-key` nor
   `--clear-encryption-key` emits `default_encryption_key=none`.
4. Accepted `config --clear-encryption-key` invocations write nothing to
   `stderr` and exit `0`.

**Dependencies**:
- `FR-0045`
- `FR-0032`
- `FR-0125`

**Traceability**:
- Area: configuration
- Observable evidence: immediate stdout output and later persisted configuration
  state
