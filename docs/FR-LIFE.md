# Installation Lifecycle Requirements


### FR-0048
**Requirement**: `install` shall create a runnable self-contained CLI footprint.

**Applicability**:
- accepted non-help `install` invocations

**Rationale**:
- Operators need a deterministic installation footprint that can later be
  removed safely.

**Acceptance Criteria**:
1. If `--install-dir` is omitted on POSIX, the target installation location is
   `$HOME/.local/bin`.
2. If `--install-dir` is omitted on Windows, the target installation location is
   `%USERPROFILE%\\.local\\bin`.
3. The installed command exposed to the operator is named `confluex`.
4. The product places the CLI entrypoint and all Confluex-owned runtime support
   files under the resolved target location and not outside it.
5. If the target path does not exist, the product creates it, including missing
   parent directories, before installation writes begin.
6. If the target path exists and is not a directory, the invocation is rejected.
7. An accepted install creates `<target>/.confluex-install-manifest.txt`.
8. The install manifest lists each Confluex-owned path exactly once as a
   relative path inside `<target>`, including
   `.confluex-install-manifest.txt` itself.
9. The install manifest is a valid install manifest as defined in Section 3.

**Dependencies**:
- `FR-0033`
- `FR-0019`

**Traceability**:
- Area: installation lifecycle
- Observable evidence: installed footprint, installation manifest, rejection

### FR-0049
**Requirement**: Accepted `install` invocations shall report one machine-readable
result line.

**Applicability**:
- accepted non-help `install` invocations

**Rationale**:
- Operators and automation need a deterministic installation result contract.

**Acceptance Criteria**:
1. An accepted `install` invocation emits exactly one stdout line
   `install_result=installed target="<absolute_path>"`.
2. `<absolute_path>` is the resolved absolute installation target serialized as a
   quoted path string.
3. Accepted `install` invocations write nothing to `stderr` and exit `0`.

**Dependencies**:
- `FR-0048`
- `FR-0010`

**Traceability**:
- Area: installation lifecycle
- Observable evidence: install result line, empty stderr, exit code

### FR-0050
**Requirement**: `uninstall` shall remove only the Confluex-owned footprint from
the selected target.

**Applicability**:
- accepted non-help `uninstall` invocations

**Rationale**:
- Operators need uninstall to be safe, idempotent, and bounded to the owned
  footprint.

**Acceptance Criteria**:
1. If `--install-dir` is omitted on POSIX, the target installation location is
   `$HOME/.local/bin`.
2. If `--install-dir` is omitted on Windows, the target installation location is
   `%USERPROFILE%\\.local\\bin`.
3. If the target path exists and is not a directory, the invocation is rejected.
4. If the target path is absent, `uninstall` completes idempotently and does not
   treat that state as an error.
5. If the target path exists but `.confluex-install-manifest.txt` is absent,
   `uninstall` completes idempotently and does not treat that state as an error.
6. If `.confluex-install-manifest.txt` is present but is not a valid install
   manifest, the invocation is rejected before any filesystem removal begins.
7. If a valid install manifest is present, `uninstall` removes every path listed
   in that manifest, including `.confluex-install-manifest.txt`, and removes no
   Confluex-owned path that is absent from that manifest.
8. `uninstall` does not modify or remove unrelated files or directories in the
   target path.

**Dependencies**:
- `FR-0048`
- `FR-0033`

**Traceability**:
- Area: installation lifecycle
- Observable evidence: remaining target contents, idempotent behavior, rejection

### FR-0051
**Requirement**: Accepted `uninstall` invocations shall report one
machine-readable result line.

**Applicability**:
- accepted non-help `uninstall` invocations

**Rationale**:
- Operators and automation need a deterministic uninstallation result contract.

**Acceptance Criteria**:
1. If any Confluex-owned footprint was removed, `uninstall` emits exactly one
   stdout line `uninstall_result=removed target="<absolute_path>"`.
2. If no Confluex-owned footprint was present to remove, `uninstall` emits
   exactly one stdout line `uninstall_result=absent target="<absolute_path>"`.
3. `<absolute_path>` is the resolved absolute target serialized as a quoted path
   string.
4. Accepted `uninstall` invocations write nothing to `stderr` and exit `0`.

**Dependencies**:
- `FR-0050`
- `FR-0010`

**Traceability**:
- Area: installation lifecycle
- Observable evidence: uninstall result line, empty stderr, exit code
