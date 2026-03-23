# Encryption Requirements


### FR-0107
**Requirement**: A successfully encrypted run shall be materialized as an
encrypted archive plus decrypt/extract instructions.

**Applicability**:
- accepted encrypted `export` and `plan` runs

**Rationale**:
- Operators need one encrypted result artifact plus clear operator instructions.

**Acceptance Criteria**:
1. Successful encryption creates `<out>.tar.gz.gpg`.
2. Successful encryption creates the instruction sidecar defined by `FR-0083`.
3. After successful encryption, the plain output root is removed from disk.
4. If the encrypted archive is decrypted and extracted into an empty directory,
   extraction creates exactly one top-level directory whose basename is the
   basename component of `<out>`.
5. That extracted top-level directory contains the report set required by
   `FR-0085` and the top-level artifact layout required by `FR-0077` for
   `export` or `FR-0078` for `plan`, whichever matches the originating
   command.

**Dependencies**:
- `FR-0083`
- `FR-0085`

**Traceability**:
- Area: encryption
- Observable evidence: encrypted archive, instruction sidecar, absence of plain
  output root

### FR-0108
**Requirement**: Encryption-recipient validation shall occur before traversal or
any run-artifact creation begins.

**Applicability**:
- non-help `export` and `plan` invocations with encryption requested

**Rationale**:
- Operators need encryption failures caused by invalid recipients to happen
  before the CLI starts expensive or sensitive run work.

**Acceptance Criteria**:
1. If encryption is enabled, the product validates the effective recipient
   before traversal, output-root reuse, or artifact creation begins.
2. If the effective recipient fails validation, the invocation is rejected.

**Dependencies**:
- `FR-0024`
- `FR-0025`
- `FR-0030`
- `FR-0037`

**Traceability**:
- Area: encryption
- Observable evidence: rejection timing before traversal or artifact creation

### FR-0109
**Requirement**: Standard encrypted mode shall preserve plaintext output on
encryption failure.

**Applicability**:
- accepted `export --encrypt`
- accepted `plan --encrypt`

**Rationale**:
- Operators need a recoverable standard encrypted mode that does not discard the
  plaintext result when encryption itself fails.

**Acceptance Criteria**:
1. If encryption fails in standard encrypted mode, the plain output root remains
   available on disk.
2. If encryption fails in standard encrypted mode, the final status follows the
   encryption-failure outcome defined by `FR-0113`.
3. If encryption fails in standard encrypted mode, the failed encrypted path is
   not presented as a successful encrypted result.

**Dependencies**:
- `FR-0024`
- `FR-0113`

**Traceability**:
- Area: encryption
- Observable evidence: retained plain output root, summary final status

### FR-0110
**Requirement**: Confidential mode shall remove the plain output root on
encryption failure.

**Applicability**:
- accepted `export --confidential`
- accepted `plan --confidential`

**Rationale**:
- Operators in confidentiality-first mode need encryption failure to avoid
  leaving plaintext payload behind.

**Acceptance Criteria**:
1. If `--confidential` is in effect and encryption fails after any plaintext run
   artifact has been written, the plain output root is removed from disk.
2. If `--confidential` encryption fails, the product applies the status-sidecar
   contract defined by `FR-0084`.

**Dependencies**:
- `FR-0025`
- `FR-0084`

**Traceability**:
- Area: encryption
- Observable evidence: absence of plain output root, status sidecar contents

### FR-0111
**Requirement**: Confidential mode shall warn about unprotected persistent logs.

**Applicability**:
- accepted confidential-mode runs with `--log-file`

**Rationale**:
- Operators need an explicit warning that a persistent log is not covered by
  plaintext-payload cleanup.

**Acceptance Criteria**:
1. If `--confidential` is combined with `--log-file`, the product emits an
   explicit warning to `stderr`.
2. The first line of that warning begins with `WARNING: `.
3. The warning identifies that the persistent log file remains outside
   plaintext-cleanup guarantees.

**Dependencies**:
- `FR-0029`
- `FR-0009`

**Traceability**:
- Area: encryption
- Observable evidence: stderr warning output

### FR-0112
**Requirement**: Encryption shall begin only for completed run results that
reach the encryption phase.

**Applicability**:
- accepted encrypted `export` and `plan` runs

**Rationale**:
- Operators need encryption to run only for completed results, not for
  interrupted or incomplete partial runs.

**Acceptance Criteria**:
1. If encryption is requested and the pre-encryption outcome is `success`,
   `success_with_findings`, or `policy_failed`, the encryption phase begins.
2. If the run ends because of a configured stop condition, a runtime failure, or
   a signal interruption, the encryption phase does not begin.
3. If the encryption phase does not begin and `summary.txt` is persisted,
   `summary.txt` reports `encryption_successful=0`.

**Dependencies**:
- `FR-0113`
- `FR-0119`

**Traceability**:
- Area: encryption
- Observable evidence: presence or absence of encryption phase and encrypted
  artifacts
