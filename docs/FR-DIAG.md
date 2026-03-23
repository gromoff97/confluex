# Diagnostics Requirements


### FR-0038
**Requirement**: `doctor` shall report environment readiness for required local
dependencies.

**Applicability**:
- accepted non-help `doctor` invocations

**Rationale**:
- Operators need a deterministic readiness report before they start using the
  CLI.

**Acceptance Criteria**:
1. `doctor` checks exactly these environment-readiness dependencies:
   `parser_runtime`, `confluence_cli`, and `gpg`.
2. `doctor` emits exactly one stdout line for each dependency in the format
   `dependency_<label>=<state>`.
3. Dependency lines appear in this exact order:
   `dependency_parser_runtime=...`,
   `dependency_confluence_cli=...`,
   `dependency_gpg=...`.
4. `<state>` uses only `absent`, `present:unknown_version`, or
   `present:<version_text>`.
5. In `present:<version_text>`, `<version_text>` is trimmed of leading and
   trailing whitespace and contains no TAB, LF, or CR.

**Dependencies**:
- `FR-0010`

**Traceability**:
- Area: diagnostics
- Observable evidence: `doctor` stdout dependency lines

### FR-0039
**Requirement**: `doctor` shall support optional page-access diagnostics.

**Applicability**:
- accepted non-help `doctor` invocations

**Rationale**:
- Operators need a deterministic way to confirm whether a candidate root page is
  accessible before planning or exporting.

**Acceptance Criteria**:
1. `doctor` without `--page-id` emits exactly one stdout line `page_access=skipped`.
2. `doctor --page-id <id>` emits `page_access=ok` when the page is accessible.
3. `doctor --page-id <id>` emits `page_access=failed` when the page is not
   accessible.
4. `doctor --page-id <id>` emits exactly one stdout line
   `page_identity=<page_id>` only when page access succeeds.
5. In `page_identity=<page_id>`, `<page_id>` is the canonical resolved page
   identifier rather than merely the raw command-line token.

**Dependencies**:
- `FR-0020`

**Traceability**:
- Area: diagnostics
- Observable evidence: `page_access` and `page_identity` lines

### FR-0040
**Requirement**: `doctor` shall support optional encryption-recipient
diagnostics.

**Applicability**:
- accepted non-help `doctor` invocations

**Rationale**:
- Operators need to know whether the effective recipient is missing, valid, or
  invalid before requesting encrypted runs.

**Acceptance Criteria**:
1. `doctor` without `--verify-encryption` emits exactly one stdout line
   `encryption_recipient=skipped`.
2. `doctor --verify-encryption` with no effective recipient emits exactly one
   stdout line `encryption_recipient=missing`.
3. `doctor --verify-encryption` with a valid effective recipient emits exactly
   one stdout line `encryption_recipient=ok`.
4. `doctor --verify-encryption` with an invalid effective recipient emits
   exactly one stdout line `encryption_recipient=failed`.

**Dependencies**:
- `FR-0030`
- `FR-0031`
- `FR-0037`

**Traceability**:
- Area: diagnostics
- Observable evidence: `encryption_recipient` line

### FR-0041
**Requirement**: `doctor` shall report the active support profile.

**Applicability**:
- accepted non-help `doctor` invocations

**Rationale**:
- Operators need to know what internal-link profile the product claims to
  support.

**Acceptance Criteria**:
1. `doctor` emits exactly one stdout line `support_profile=default`.
2. The `support_profile` token emitted by `doctor` matches the
   `support_profile` token used by `summary.txt` in `export` and `plan` report
   sets.

**Dependencies**:
- `FR-0119`

**Traceability**:
- Area: diagnostics
- Observable evidence: `support_profile` line

### FR-0042
**Requirement**: `doctor` shall expose machine-readable next-step guidance.

**Applicability**:
- accepted non-help `doctor` invocations

**Rationale**:
- Operators need a machine-readable summary of what to fix next.

**Acceptance Criteria**:
1. `doctor` emits exactly one stdout line `next_action=<value>`.
2. `<value>` uses either `none` or a comma-separated list of one or more unique
   tokens chosen from `install_parser_runtime`, `install_confluence_cli`,
   `install_gpg`, `check_page_access`, `set_encryption_key`, and
   `fix_encryption_key`.
3. If all checked dependencies are present, `page_access` is not `failed`, and
   `encryption_recipient` is neither `missing` nor `failed`,
   `next_action=none`.
4. If `next_action` is not `none`, tokens appear only in this order:
   `install_parser_runtime`, `install_confluence_cli`, `install_gpg`,
   `check_page_access`, `set_encryption_key`, `fix_encryption_key`.

**Dependencies**:
- `FR-0038`
- `FR-0039`
- `FR-0040`

**Traceability**:
- Area: diagnostics
- Observable evidence: `next_action` line

### FR-0043
**Requirement**: Accepted `doctor` invocations shall use one closed stdout
contract.

**Applicability**:
- accepted non-help `doctor` invocations

**Rationale**:
- Operators and automation need a deterministic, line-oriented diagnostic
  contract.

**Acceptance Criteria**:
1. The required informational lines appear on `stdout` in this exact order:
   dependency lines, `page_access`, optional `page_identity`,
   `encryption_recipient`, `support_profile`, `supported_link_forms`,
   `next_action`.
2. Accepted `doctor` invocations emit no additional informational stdout lines.
3. Accepted `doctor` invocations write no informational output to `stderr`.
4. Accepted `doctor` invocations exit `0`.

**Dependencies**:
- `FR-0038`
- `FR-0041`
- `FR-0042`
- `FR-0044`
- `FR-0010`

**Traceability**:
- Area: diagnostics
- Observable evidence: stdout line order, empty stderr, exit code

### FR-0044
**Requirement**: `doctor` shall report the documented supported link forms.

**Applicability**:
- accepted non-help `doctor` invocations

**Rationale**:
- Operators need an explicit machine-readable statement of which internal-link
  forms are actually supported for link-driven scope expansion.

**Acceptance Criteria**:
1. `doctor` emits exactly one stdout line
   `supported_link_forms=child_result,content_id,page_ref,macro_param,href_page_id,href_space_title,ri_url_page_id,ri_url_space_title`.
2. The serialized supported-link-form set matches the documented support set for
   scope expansion.

**Dependencies**:
- `FR-0063`

**Traceability**:
- Area: diagnostics
- Observable evidence: `supported_link_forms` line
