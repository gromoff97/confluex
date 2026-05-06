# Encryption Requirements


### FR-0107
**Requirement**: A successfully encrypted run shall be materialized as an
encrypted archive plus decrypt/extract instructions.

**Applicability**:
- accepted encrypted `export` and `plan` runs

**Rationale**:
- Operators need one encrypted result artifact plus clear operator instructions.

**Acceptance Criteria**:
1. `<out>` is the logical plain output-root path string selected under
   `FR-0076` before adding any encryption suffix.
2. Successful encryption creates `<out>.tar.gz.gpg`; if that path already exists
   as a regular file, encryption fails before modifying that path.
3. Encryption never creates, overwrites, appends to, removes, or selects a
   filesystem object at `<out>.tar.gz`.
4. If `<out>.tar.gz` exists before encryption begins, that path remains
   pre-existing non-authoritative data and is not part of the final retained
   result for the current run.
5. Successful encryption creates the instruction sidecar defined by `FR-0083`.
6. After successful encryption, the plain output root is removed from disk.
7. If the encrypted archive is decrypted and extracted into an empty directory,
   extraction creates exactly one top-level directory whose basename is the
   basename component of `<out>`.
8. That extracted top-level directory contains the report set required by
   `FR-0085` and the top-level artifact layout required by `FR-0077` for
   `export` or `FR-0078` for `plan`, whichever matches the originating
   command.
9. If `<out>.tar.gz.gpg` exists as a directory, symbolic link, FIFO, socket,
   device, or any other non-regular filesystem object before archive creation,
   encryption fails before modifying that path.
10. Before encryption modifies a current-run encrypted-archive path or
    instruction-sidecar path, it classifies existing `<out>.tar.gz.gpg` and
    `<out>.tar.gz.gpg.txt` paths using non-following filesystem metadata.
11. If classification under criterion 10 fails for either of those two paths,
    encryption fails before modifying any current-run encrypted-archive path or
    current-run instruction-sidecar path.
12. A pre-existing regular file at either path from criterion 10 remains
   non-authoritative and is never selected as the `RUN_COMPLETE` artifact for
   the current run.
13. If encryption fails after classifying a pre-existing regular file at one of
    the criterion-10 paths and before any current-run artifact is retained at
    that same path, that pre-existing file remains unchanged, remains
    non-authoritative, and is not part of the final retained result.
14. If removal of the plain output root fails after archive creation, encryption
   is not successful, the run uses `final_status=encryption_failed`, and the
   final retained result does not include the encrypted archive or instruction
   sidecar created by that encryption attempt.
15. If criterion 14 occurs, the plain output root remains on disk as the
   authoritative retained artifact; no confidential-mode status sidecar is
   created for this cleanup-failure branch.
16. If cleanup under criterion 14 cannot remove the encrypted archive or
   instruction sidecar created by that encryption attempt, those paths are
   non-authoritative cleanup-failure debris: they are not report-set containers,
   are not selected as the `RUN_COMPLETE` artifact, and do not change
   `final_status=encryption_failed`.
17. When successful encryption retains both the encrypted archive and the
   instruction sidecar, singular `RUN_COMPLETE artifact` selection is governed by
   `FR-0058`; the instruction sidecar is never selected ahead of the encrypted
   archive.

**Dependencies**:
- `FR-0076`
- `FR-0058`
- `FR-0083`
- `FR-0085`
- `FR-0077`
- `FR-0078`
- `FR-0113`
- `FR-0154`

**Traceability**:
- Area: encryption
- Observable evidence: encrypted archive, instruction sidecar, absence of plain
  output root

### FR-0108
**Requirement**: Encryption-recipient validation shall occur before traversal or
any run-artifact creation begins.

**Applicability**:
- non-help `export` and `plan` invocations with encryption requested
- `doctor --verify-encryption`

**Rationale**:
- Operators need encryption failures caused by invalid recipients to happen
  before the CLI starts expensive or sensitive run work.

**Acceptance Criteria**:
1. If encryption is enabled, the product validates the effective recipient
   before root-page preflight, traversal, output-root reuse, or artifact
   creation begins.
2. Recipient validation for `export`, `plan`, and `doctor` uses the local GPG
   keyring probe with exact process argument vector `["gpg", "--list-keys",
   "--with-colons", <effective_recipient>]` and no shell interpolation.
3. The effective recipient is valid if the probe in criterion 2 exits `0`.
4. The effective recipient is invalid if the probe in criterion 2 exits with any
   non-zero status, is terminated by a signal, cannot be spawned because `gpg`
   is absent from `PATH`, or cannot be spawned because the resolved `gpg` path is
   not executable.
5. Probe stderr, if any, is not interpreted by this requirements corpus for
   recipient-validity decisions.
6. If the effective recipient fails validation for `export` or `plan`, the
   invocation is rejected before root-page preflight, traversal, output-root
   reuse, or artifact creation begins. If recipient validation is the selected
   rejecting operation under `FR-0146`, the selected owning requirement id for
   the validation diagnostic is `FR-0108`.
7. If the effective recipient fails validation for
   `doctor --verify-encryption`, the invocation remains accepted, emits
   `encryption_recipient=failed` under `FR-0040`, and continues to use the
   accepted `doctor` stdout contract governed by `FR-0043`.

**Dependencies**:
- `FR-0040`
- `FR-0043`
- `FR-0030`
- `FR-0037`
- `FR-0017`
- `FR-0019`
- `FR-0146`

**Traceability**:
- Area: encryption
- Observable evidence: rejection timing before traversal or artifact creation

### FR-0109
**Requirement**: Standard encrypted mode shall preserve plaintext output on
encryption failure.

**Applicability**:
- accepted `export --encrypt` when `--confidential` is not in effect
- accepted `plan --encrypt` when `--confidential` is not in effect

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
4. If encryption fails in standard encrypted mode, the final retained result does
   not include `<out>.tar.gz.gpg`.
5. If encryption fails in standard encrypted mode, the final retained result does
   not include `<out>.tar.gz.gpg.txt`.
6. If encryption fails in standard encrypted mode, the final retained result does
   not include `<out>.tar.gz`.

**Dependencies**:
- `FR-0024`
- `FR-0025`
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
   artifact has been written, the plain output root is removed from disk except
   for the cleanup-failure branch governed by `FR-0107` and the
   confidential-mode cleanup-failure branch in criterion 3.
2. If `--confidential` encryption fails for any reason other than the
   cleanup-failure branch governed by `FR-0107` or the plain-root-retained
   confidential-mode cleanup-failure branch from criterion 3, the product
   applies the status-sidecar contract defined by `FR-0084`.
3. If `--confidential` encryption fails and removal of the plain output root
   fails in any encryption-failure timing not governed by `FR-0107`, the plain
   output root remains on disk as the authoritative retained artifact, no
   confidential-mode status sidecar is created, the retained-artifact selection
   branch consumed by `FR-0058` is the plain output root, and the
   final-status branch consumed by `FR-0113` is `encryption_failed`. This is the
   plain-root-retained confidential-mode cleanup-failure branch.
4. If `--confidential` encryption fails, the final retained result does not
   include `<out>.tar.gz.gpg`.
5. If `--confidential` encryption fails, the final retained result does not
   include `<out>.tar.gz.gpg.txt`.
6. If `--confidential` encryption fails, the final retained result does not
   include `<out>.tar.gz`.
7. If criterion 2 would otherwise apply and either the status-sidecar path
   defined by `FR-0084` exists as a regular file, directory, symbolic link,
   FIFO, socket, device, or any other filesystem object before sidecar
   creation, or sidecar creation or sidecar writing under `FR-0084` fails
   after the plain output root has been removed, the plain output root does not
   remain authoritative, no confidential-mode status sidecar is retained as an
   authoritative artifact, and any pre-existing or partially written
   sidecar-path object remains non-authoritative data; the retained-artifact
   selection branch consumed by `FR-0058` is no retained artifact. This is the
   sidecar-unretained confidential-mode no-retained-artifact branch.

**Dependencies**:
- `FR-0084`
- `FR-0107`
- `FR-0058`
- `FR-0113`
- `FR-0124`

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
1. If `--confidential` is combined with `--log-file`, the product emits the
   confidential-mode log warning whose stream, prefix, and identifying content
   are governed by `FR-0009`.

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
   a signal interruption before the encryption phase begins, the encryption phase
   does not begin.
3. If the encryption phase does not begin, the product creates no encrypted
   archive for that run.
4. If signal interruption is observed after the encryption phase begins and
   before the run determines the final artifact branch consumed by `FR-0058`,
   the run takes the encryption-interruption branch from criteria 5 through 7.
5. In the criterion 4 branch, stdout contains no `RUN_COMPLETE` line and no
   stdout line emitted after the interruption is observed.
6. In the criterion 4 branch, the process exits `130` under `FR-0118`.
7. In the criterion 4 branch, the product selects no authoritative retained
   artifact for the run; any plain output root, encrypted archive, instruction
   sidecar, status sidecar, or other derived encryption path left on disk by the
   interrupted encryption attempt is non-authoritative
   encryption-interruption debris; any such plain output root directory also
   satisfies `FR-0217`; and no such path is selected by `FR-0058`.

**Dependencies**:
- `FR-0058`
- `FR-0113`
- `FR-0118`
- `FR-0217`

**Traceability**:
- Area: encryption
- Observable evidence: presence or absence of encryption phase and encrypted
  artifacts

### FR-0149
**Requirement**: Encrypted-run report fields shall be finalized before final
artifact selection.

**Applicability**:
- accepted encrypted `export` and `plan` runs whose encryption phase begins

**Rationale**:
- Operators need retained report sets to describe the final encrypted-run
  outcome rather than the pre-encryption outcome.

**Acceptance Criteria**:
1. Before the run selects any encrypted archive, retained plain output root, or
   confidential-mode status sidecar as its final artifact, the product
   determines which encrypted-run branch from criteria 2 through 7 applies and
   finalizes every retained report-set container so that its `final_status`
   field satisfies `FR-0113` and its encryption fields satisfy `FR-0119` for
   that branch.
2. For successful encryption, the report set packaged into the encrypted archive
   has the same `final_status` value selected by the completed pre-encryption
   run outcome, and its `encryption_enabled` and `encryption_successful` values
   are the ones required by `FR-0119` for that successful encrypted-run branch.
3. For standard encrypted-mode failure governed by `FR-0109`, the retained plain
   output root's report set has `final_status=encryption_failed`, and its
   `encryption_enabled` and `encryption_successful` values are the ones
   required by `FR-0119` for that branch.
4. For the cleanup-failure branch governed by `FR-0107` where the plain output
   root remains authoritative, that retained plain output root's report set has
   `final_status=encryption_failed`, and its `encryption_enabled` and
   `encryption_successful` values are the ones required by `FR-0119` for that
   branch.
5. For confidential-mode encryption failure that removes the plain output root
   and retains only the status sidecar from `FR-0084`, no retained report-set
   container remains and no `summary.txt` is retained for that run.
6. For the sidecar-unretained confidential-mode no-retained-artifact branch
   governed by `FR-0110`, no retained report-set container remains and no
   `summary.txt` is retained for that run.
7. For confidential-mode cleanup failure governed by `FR-0110` where the plain
   output root remains authoritative, that retained plain output root's report
   set has `final_status=encryption_failed`, and its `encryption_enabled` and
   `encryption_successful` values are the ones required by `FR-0119` for that
   branch.
8. No retained report-set container for an encrypted run may retain `summary.txt`
   values that conflict with criteria 2 through 7.
9. Encrypted-run report finalization begins after the completed pre-encryption
   run outcome is known and completes before final artifact selection.
10. Encrypted-run report finalization covers only writing or replacing final
   report fields inside report-set containers and removing non-authoritative
   report-set containers needed to satisfy criteria 2 through 7.
11. If writing, replacing, or removing a report set as needed to satisfy
    criteria 2 through 7 fails during encrypted-run report finalization from
    criterion 10, the encrypted-finalization runtime-failure branch is governed
    by `FR-0189`.
12. Ordinary encryption work involved in producing or cleaning up
    branch-specific artifacts, including archive creation, GPG encryption,
    instruction-sidecar creation, and ordinary encryption-failure cleanup, is
    governed by `FR-0190`, `FR-0107`, `FR-0109`, and `FR-0110`, not by this
    card.

**Dependencies**:
- `FR-0058`
- `FR-0084`
- `FR-0085`
- `FR-0090`
- `FR-0107`
- `FR-0109`
- `FR-0110`
- `FR-0113`
- `FR-0119`
- `FR-0189`
- `FR-0190`

**Traceability**:
- Area: encryption
- Observable evidence: retained encrypted archive, retained plain root, status
  sidecar, `summary.txt` final fields

### FR-0189
**Requirement**: Encrypted-run report-finalization runtime failure shall use one
bounded no-artifact branch.

**Applicability**:
- accepted encrypted `export` and `plan` runs whose encrypted-run report
  finalization from `FR-0149` has begun

**Rationale**:
- Operators need failures during report finalization to remain distinguishable
  from ordinary encryption failures and to select no misleading final artifact.

**Acceptance Criteria**:
1. If writing, replacing, or removing a report set as needed to satisfy
   `FR-0149` fails during encrypted-run report finalization from `FR-0149`, the
   run takes the encrypted-finalization runtime-failure branch defined by
   criteria 2 through 7.
2. In this branch, `RUN_COMPLETE` is not emitted because final artifact
   determination did not complete.
3. In this branch, the process exit code is the accepted-run runtime-failure
   code governed by `FR-0118`.
4. In this branch, no encrypted archive, instruction sidecar, confidential-mode
   status sidecar, or plain output root is selected as an authoritative
   retained artifact for the run.
5. In this branch, any filesystem path left behind by the failed finalization
   attempt is non-authoritative encrypted-finalization debris. Any such
   directory root satisfies `FR-0217`. No such path is a report-set container
   for the final outcome or is selected by `FR-0058`.
6. In this branch, stdout contains no `RUN_COMPLETE` line and no stdout line
   emitted after the failure is observed.
7. In this branch, stderr is UTF-8 text with LF line endings, its first line is
   exactly `ERROR: runtime_failure encrypted_finalization`, and any additional
   stderr lines are non-governed diagnostic text.

**Dependencies**:
- `FR-0058`
- `FR-0118`
- `FR-0149`
- `FR-0217`

**Traceability**:
- Area: encryption
- Observable evidence: no selected retained artifact, stderr runtime-failure
  output

### FR-0190
**Requirement**: Ordinary encrypted-run failure cleanup around report
finalization shall remove derived archive artifacts before final artifact
selection.

**Applicability**:
- accepted encrypted `export` and `plan` runs whose encryption phase begins

**Rationale**:
- Operators need ordinary encryption failures to avoid leaving derived archive
  artifacts behind as misleading final results regardless of whether report
  finalization has already begun.

**Acceptance Criteria**:
1. Ordinary encryption work around encrypted-run report finalization includes
   archive creation, GPG encryption, instruction-sidecar creation, and cleanup
   of derived archive or sidecar files after an ordinary encryption failure;
   failures in that work are governed by `FR-0107`, `FR-0109`, or `FR-0110`,
   not by `FR-0189`.
2. For an ordinary encryption failure governed by `FR-0109` or `FR-0110`, the
   product attempts to remove any `<out>.tar.gz.gpg` or
   `<out>.tar.gz.gpg.txt` path created by that failed encryption attempt before
   final artifact selection.
3. If cleanup from criterion 2 fails, any remaining path from that failed
   encryption attempt is non-authoritative failed-encryption debris: it is not
   included in the final retained result, is not a report-set container, and is
   not selected by `FR-0058`.

**Dependencies**:
- `FR-0058`
- `FR-0107`
- `FR-0109`
- `FR-0110`
- `FR-0149`
- `FR-0189`

**Traceability**:
- Area: encryption
- Observable evidence: removal or non-authoritative status of failed-encryption
  archive artifacts
