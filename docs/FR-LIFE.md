# Installation Lifecycle Requirements


### FR-0215
**Requirement**: Installation lifecycle cards shall use one stable
`valid install manifest` term.

**Applicability**:
- installation lifecycle requirements that refer to a valid install manifest

**Rationale**:
- Install and uninstall cards need one visible definition of manifest validity
  before they use that term to branch installation state or removal behavior.

**Acceptance Criteria**:
1. In this card, `<target>` is the resolved target directory of the current
   `install` or `uninstall` invocation whose `.confluex-install-manifest.txt`
   bytes are being evaluated.
2. Whether `.confluex-install-manifest.txt` is a valid install manifest is
   determined from that file's bytes together with the `<target>` context from
   criterion 1 and does not depend on the current existence, type, or contents
   of the listed paths on disk.
3. A valid install manifest is UTF-8 text with LF line endings that contains one
   governed relative path per line.
4. A valid install manifest contains no empty lines, duplicate lines, TAB, NUL,
   CR, or bytes after the final LF.
5. Every line in a valid install manifest satisfies `FR-0150`.
6. Valid install-manifest lines are sorted in ascending bytewise lexicographic
   order of the serialized relative path.
7. Every path listed in a valid install manifest is inside `<target>`.
8. For installation lifecycle cards that consume a valid install manifest, the
   manifest-governed path set at `<target>` is exactly the set of target-relative
   paths listed by that manifest and no additional in-target path is governed by
   that manifest.

**Dependencies**:
- `FR-0150`

**Traceability**:
- Area: installation lifecycle
- Observable evidence: one visible manifest-validity contract used by install
  and uninstall cards

### FR-0048
**Requirement**: Accepted `install` invocations shall leave exactly one
authoritative installation state at the resolved target.

**Applicability**:
- non-help `install` invocations

**Rationale**:
- Operators need `install` to end either with one runnable authoritative
  footprint or with the prior authoritative state restored.

**Acceptance Criteria**:
1. Before installation writes begin, target resolution, rejection branches, and
   runtime-root overlap checks are governed by `FR-0166`.
2. A successfully completed accepted `install` invocation retains the runnable
   command path and runtime support footprint governed by `FR-0167` at the
   resolved target.
3. A successfully completed accepted `install` invocation retains the valid
   install manifest governed by `FR-0215`; that manifest is the authoritative
   record of the installed Confluex-owned footprint at the target.
4. If an accepted `install` invocation fails after installation writes begin and
   before the installed-command verification required by `FR-0167` criterion 13
   succeeds, rollback and debris handling are governed by `FR-0169`.
5. No accepted `install` invocation satisfies this requirement if it leaves a
   new authoritative installation state without satisfying criteria 2 and 3.

**Dependencies**:
- `FR-0166`
- `FR-0167`
- `FR-0168`
- `FR-0169`
- `FR-0215`

**Traceability**:
- Area: installation lifecycle
- Observable evidence: installed footprint, valid install manifest, rollback or
  restored prior installation

### FR-0049
**Requirement**: Accepted `install` invocations that complete shall report one
machine-readable result line.

**Applicability**:
- accepted non-help `install` invocations

**Rationale**:
- Operators and automation need a deterministic installation result contract.

**Acceptance Criteria**:
1. An accepted `install` invocation that completes the installation lifecycle
   defined by `FR-0048` emits exactly one stdout line
   `install_result=installed target=<quoted_path_string>`.
2. `<quoted_path_string>` is the resolved absolute installation target
   serialized as the quoted path string defined by `FR-0124`.
3. Accepted `install` invocations that complete write nothing to `stderr`.
4. The accepted invocation exit code is governed by `FR-0118`.
5. Accepted `install` invocations that fail after command work begins are
   governed by `FR-0142`.

**Dependencies**:
- `FR-0048`
- `FR-0118`
- `FR-0124`
- `FR-0142`

**Traceability**:
- Area: installation lifecycle
- Observable evidence: install result line, empty stderr, exit code

### FR-0050
**Requirement**: Accepted `uninstall` invocations shall bound removal to the
authoritative installed footprint at the resolved target.

**Applicability**:
- accepted non-help `uninstall` invocations

**Rationale**:
- Operators need uninstall to be safe, idempotent, and bounded to the owned
  footprint.

**Acceptance Criteria**:
1. Before filesystem removal begins, target resolution, idempotent absent-target
   handling, invalid-manifest rejection, and runtime-root overlap checks are
   governed by `FR-0170`.
2. When a valid install manifest is present at the resolved target, the only
   Confluex-owned removable footprint is the manifest-listed path set
   interpreted under `FR-0215` and removed under `FR-0171`.
3. `uninstall` removes no path absent from the valid install manifest, even if
   its name resembles a Confluex-owned path.
4. If the resolved target is absent, or if the resolved target is an existing
   directory whose manifest path is absent after the `FR-0170` checks succeed,
   `uninstall` completes idempotently without removing any path.
5. If a valid install manifest is present, removal ordering and failure after
   removal begins are governed by `FR-0171`.

**Dependencies**:
- `FR-0168`
- `FR-0170`
- `FR-0171`
- `FR-0215`

**Traceability**:
- Area: installation lifecycle
- Observable evidence: remaining target contents, idempotent behavior, rejection

### FR-0051
**Requirement**: Accepted `uninstall` invocations shall end in exactly one
governed completion branch.

**Applicability**:
- accepted non-help `uninstall` invocations

**Rationale**:
- Operators and automation need a deterministic uninstallation result contract.

**Acceptance Criteria**:
1. An accepted `uninstall` invocation reaches the `removed` completion branch
   only if it completes the manifest-driven removal workflow governed by
   `FR-0171` and removes at least one Confluex-owned path from the valid
   install manifest.
2. An accepted `uninstall` invocation reaches the `absent` completion branch
   only if `FR-0170` permits idempotent completion with no removed
   Confluex-owned path, including the absent-target and missing-manifest cases
   defined there.
3. Each completion branch from criteria 1 and 2 emits exactly one stdout result
   line under `FR-0172`.
4. A branch that fails after command work begins is not a completion branch and
   is governed by `FR-0142` instead of `FR-0172`.

**Dependencies**:
- `FR-0142`
- `FR-0170`
- `FR-0171`
- `FR-0172`
- `FR-0215`

**Traceability**:
- Area: installation lifecycle
- Observable evidence: `removed` versus `absent` completion branch and result
  line emission

### FR-0166
**Requirement**: `install` shall resolve a safe target location before writing.

**Applicability**:
- non-help `install` invocations

**Rationale**:
- Operators need a deterministic target location that is validated before any
  writes begin.

**Acceptance Criteria**:
1. If `--install-dir` is supplied, the target installation location is resolved
   under `FR-0033`.
2. If `--install-dir` is omitted on POSIX under `FR-0158`, and `$HOME` is
   present, succeeds as a governed path source under `FR-0158`, is absolute
   for POSIX under `FR-0159`, and path normalization of `$HOME` under
   `FR-0159` succeeds, the target installation location is the normalized
   `$HOME` path with child segments `.local` and `bin` appended and then
   normalized again under `FR-0159`.
3. If `--install-dir` is omitted on Windows under `FR-0158`, and
   `%USERPROFILE%` is present, succeeds as a governed path source under
   `FR-0158`, is absolute for Windows under `FR-0159`, and path normalization
   of `%USERPROFILE%` under `FR-0159` succeeds, the target installation
   location is the normalized `%USERPROFILE%` path with child segments
   `.local` and `bin` appended and then normalized again under `FR-0159`.
4. If `--install-dir` is omitted and the required environment value for the
   current platform from criterion 2 or 3 is absent, fails path-source
   acquisition under `FR-0158`, is not absolute for the current platform under
   `FR-0159`, or path normalization of that environment value under `FR-0159`
   fails, the invocation is rejected before invocation acceptance under
   `FR-0212` and before installation writes begin.
5. If the current platform under `FR-0158` is neither POSIX nor Windows,
   `install` is rejected before invocation acceptance under `FR-0212` and
   before installation writes begin.
6. The target path is evaluated using non-following filesystem metadata under
   `FR-0154` before installation writes begin. If that evaluation fails for a
   reason other than path absence, the invocation is rejected before
   invocation acceptance under `FR-0212` and before installation writes begin.
7. If the target path does not exist, the product creates it, including missing
   parent directories, before installation writes begin. If that creation
   fails, the accepted invocation fails under `FR-0142` before installation
   writes begin.
8. If the target path exists as a symbolic link, FIFO, socket, device, regular
   file, or any other non-directory filesystem object, the invocation is
   rejected before invocation acceptance under `FR-0212` and before
   installation writes begin.
9. Before installation writes begin, `install` evaluates every existing ancestor
   path segment from the filesystem root through the parent of the resolved
   target path using non-following filesystem metadata under `FR-0154`. If
   evaluation of any such ancestor fails, the invocation is rejected before
   invocation acceptance under `FR-0212` and before installation writes begin.
10. If any existing ancestor checked by criterion 9 is a symbolic link, regular
   file, FIFO, socket, device, or any other non-directory filesystem object,
   the invocation is rejected before invocation acceptance under `FR-0212` and
   before installation writes begin.
11. The currently executing Confluex runtime root and runtime-root source
   string are defined by `FR-0152`.
12. If the currently executing Confluex runtime-root source string defined by
   `FR-0152` fails path-source acquisition under `FR-0158`, or if path
   normalization of that runtime-root source string under `FR-0159` fails, the
   invocation is rejected before invocation acceptance under `FR-0212` and
   before installation writes begin. Otherwise, if the normalized resolved
   target installation location equals the normalized currently executing
   Confluex runtime root under `FR-0160`, or if either normalized path is a
   path-segment descendant of the other under `FR-0161`, `install` is rejected
   before invocation acceptance under `FR-0212` and before installation writes
   begin.

**Dependencies**:
- `FR-0019`
- `FR-0033`
- `FR-0142`
- `FR-0154`
- `FR-0158`
- `FR-0159`
- `FR-0160`
- `FR-0161`
- `FR-0152`
- `FR-0212`

**Traceability**:
- Area: installation lifecycle
- Observable evidence: target selection, rejection

### FR-0167
**Requirement**: `install` shall copy only the Confluex-owned runtime source
footprint into the target.

**Applicability**:
- non-help `install` invocations

**Rationale**:
- Operators need the installed footprint to be built from the executing
  runtime tree and not from unrelated filesystem content.

**Acceptance Criteria**:
1. The required runtime source inventory is the currently executing `confluex`
   entrypoint plus these support roots under the currently executing Confluex
   runtime root defined by `FR-0152`: `lib/confluex-node/`,
   `fixtures/confluence-7137/`, and
   `tests/live-bats/`.
2. Before installation writes begin, `install` evaluates each support root from
   criterion 1 using non-following filesystem metadata under `FR-0154`. If
   evaluation of any support root fails for a reason other than path absence,
   the accepted invocation fails under `FR-0142` before installation writes
   begin.
3. If any support root from criterion 1 is absent or is a symbolic link,
   regular file, FIFO, socket, device, or any other non-directory filesystem
   object, the accepted `install` invocation fails under `FR-0142` before
   installation writes begin.
4. Before installation writes begin, `install` evaluates every descendant
   reachable under each support root from criterion 1 using non-following
   filesystem metadata under `FR-0154`. If evaluation of any such descendant
   fails, the accepted invocation fails under `FR-0142` before installation
   writes begin.
5. If any descendant reachable under a support root from criterion 1 is a
   symbolic link, FIFO, socket, device, or any other non-directory non-regular
   filesystem object, the accepted `install` invocation fails under `FR-0142`
   before installation writes begin.
6. The installed runtime support footprint contains exactly the support-root
   directories from criterion 1 plus every regular-file and directory
   descendant reachable under those support roots, preserving each
   source-relative path under `<target>`.
7. The currently executing `confluex` entrypoint source must be readable as a
   regular file before installation writes begin; if it is not, the accepted
   `install` invocation fails under `FR-0142` before installation writes begin.
8. The installed command exposed to the operator is named `confluex`.
9. The installed command path is `<target>/confluex` on POSIX and
   `<target>\confluex.cmd` on Windows.
10. On POSIX, the installed command path is a regular file executable by the
   user account that invoked `install`.
11. On Windows, the installed command path is a regular `.cmd` file whose
   basename before the `.cmd` suffix is exactly `confluex`.
12. The Confluex-owned runtime support footprint installed under the resolved
   target location includes `lib/confluex-node/`,
   `fixtures/confluence-7137/`, and
   `tests/live-bats/`.
13. After installation completes, invoking the installed command path with a
   single `--help` argument exits `0`, writes only the top-level help stdout
   contract governed by `FR-0007`, and writes nothing to `stderr`. The
   verification subprocess stdout and stderr are consumed by the installation
   verification step and are not forwarded to the operator-visible stdout or
   stderr of the `install` invocation governed by `FR-0049`. On POSIX the
   invoked path is `<target>/confluex --help`. On Windows the exact installed
   command path `<target>\confluex.cmd` is invoked exactly once with exactly
   one argument `--help` using a process-creation method that does not
   reinterpret characters in the path as `cmd.exe` metacharacters,
   environment-variable expansions, or delayed-expansion expressions.
14. If `.confluex-install-manifest.txt` exists as a valid install manifest
   governed by `FR-0215` before installation writes begin, the prior
   authoritative installation is the set of existing target paths listed by
   that manifest.
15. Before replacing any target path required by criteria 8 through 12 or
   `.confluex-install-manifest.txt`, `install` evaluates the existing path
   using non-following filesystem metadata under `FR-0154`. If evaluation of
   any such path fails for a reason other than path absence, the accepted
   invocation fails under `FR-0142` before installation writes begin.
16. If the installed command path from criteria 8 through 11 or
   `.confluex-install-manifest.txt` already exists as a regular file or
   symbolic link before installation writes begin, the accepted install
   replaces that path itself only when a prior authoritative installation
   defined by criterion 14 exists and that path is listed in the prior
   authoritative installation's valid install manifest; the install does not
   follow a replaced symbolic link target.
17. If the installed command path from criteria 8 through 11 or
   `.confluex-install-manifest.txt` already exists as a regular file or
   symbolic link before installation writes begin and either no prior
   authoritative installation defined by criterion 14 exists or that path is
   absent from the prior authoritative installation's valid install manifest,
   the invocation is rejected before invocation acceptance under `FR-0212` and
   before installation writes begin.
18. If the installed command path from criteria 8 through 11 or
   `.confluex-install-manifest.txt` already exists as a directory, FIFO,
   socket, device, or any other non-regular non-symlink filesystem object
   before installation writes begin, the invocation is rejected before
   invocation acceptance under `FR-0212` and before installation writes begin.
19. If a runtime support directory root from criterion 12 already exists as a
   directory before installation writes begin and a prior authoritative
   installation defined by criterion 14 exists, the accepted install removes
   that directory root recursively before writing the corresponding directory
   tree supplied by the currently executing Confluex runtime root only when
   every existing path at that directory root and below is listed in the prior
   authoritative installation's valid install manifest.
20. If a runtime support directory root from criterion 12 already exists but is
   not a directory, the invocation is rejected before invocation acceptance
   under `FR-0212` and before installation writes begin.
21. If a runtime support directory root from criterion 12 already exists as a
   directory before installation writes begin and either no prior
   authoritative installation defined by criterion 14 exists or any existing
   path at that directory root or below is absent from the prior
   authoritative installation's valid install manifest, the invocation is
   rejected before invocation acceptance under `FR-0212` and before
   installation writes begin.
22. Recursive removal from criterion 19 evaluates every existing descendant
   using non-following filesystem metadata under `FR-0154`, removes symbolic
   links as links, removes regular files as files, traverses directory
   descendants without following symbolic links, and removes each directory
   only after its descendants have been removed.
23. If recursive removal from criterion 19 encounters a FIFO, socket, device,
   any other non-directory non-regular non-symlink filesystem object, or a
   descendant path that cannot be evaluated or removed, the accepted
   `install` invocation fails under `FR-0142` after recursive removal has
   begun.
24. On Windows, if any non-root path segment of the resolved target
    installation location contains `%` or `!`, the invocation is rejected
    before invocation acceptance under `FR-0212` and before installation writes
    begin because the `.cmd` launcher contract from criteria 9, 11, and 13
    would otherwise depend on command-processor expansion semantics for the
    target path.

**Dependencies**:
- `FR-0007`
- `FR-0049`
- `FR-0118`
- `FR-0019`
- `FR-0142`
- `FR-0154`
- `FR-0159`
- `FR-0152`
- `FR-0166`
- `FR-0168`
- `FR-0212`
- `FR-0215`

**Traceability**:
- Area: installation lifecycle
- Observable evidence: installed footprint, runtime source copy

### FR-0168
**Requirement**: `install` shall write a valid install manifest for the
installed footprint.

**Applicability**:
- accepted non-help `install` invocations

**Rationale**:
- Operators need a manifest that precisely records the owned target footprint
  for later safe removal.

**Acceptance Criteria**:
1. An accepted install creates `<target>/.confluex-install-manifest.txt`.
2. The Confluex-owned path set is the installed command path under `FR-0167`,
   `.confluex-install-manifest.txt`, and every directory and file recursively
   under the installed runtime support directories `lib/confluex-node/`,
   `fixtures/confluence-7137/`, and
   `tests/live-bats/` under `<target>`.
3. Parent directories outside `<target>` that the product created while
   creating `<target>` are not Confluex-owned paths and are not listed in the
   install manifest.
4. The install manifest lists each Confluex-owned path from criterion 2 exactly
   once as a governed relative path under `FR-0150` inside `<target>`.
5. Directory entries are listed without a trailing slash.
6. Install-manifest relative paths use the governed relative path serialization
   defined by `FR-0150`.
7. Each install-manifest relative path satisfies `FR-0150`.
8. If any Confluex-owned path from criterion 2 cannot be serialized as an
   install-manifest relative path satisfying criteria 4 through 7, the accepted
   `install` invocation fails under `FR-0142` before installation writes begin.
9. Install-manifest lines are sorted in ascending bytewise lexicographic order
   of the serialized relative path.
10. The install manifest retained by an accepted `install` invocation is a
    valid install manifest governed by `FR-0215`.
11. The Confluex-owned path set from criterion 2 includes the installed support
   root directories `lib/confluex-node/`,
   `fixtures/confluence-7137/`, and
   `tests/live-bats/` themselves, serialized without trailing slashes in the
   install manifest.
12. The Confluex-owned path set from criterion 2 excludes in-target parent
   container directories `lib/`, `scripts/`, `fixtures/`, `docker/`, and
   `tests/`; those parent container directories remain after uninstall even
   when they become empty.

**Dependencies**:
- `FR-0142`
- `FR-0150`
- `FR-0167`
- `FR-0215`

**Traceability**:
- Area: installation lifecycle
- Observable evidence: install manifest

### FR-0169
**Requirement**: `install` shall clean up failed installation attempts before
leaving debris.

**Applicability**:
- accepted non-help `install` invocations

**Rationale**:
- Operators need failed installs to leave either no owned footprint or only
  clearly non-authoritative debris.

**Acceptance Criteria**:
1. If an accepted utility-command runtime failure under `FR-0142` occurs after
   target-directory or missing-parent directory creation under `FR-0166`
   criterion 7 begins, or after recursive removal, replacement, directory
   creation, file copying, or manifest writing begins, and before the
   installed-command verification required by `FR-0167` criterion 13 succeeds,
   the product attempts rollback before the failed invocation completes.
2. If a prior authoritative installation under `FR-0167` existed before
   installation writes began, rollback from criterion 1 restores that prior
   authoritative installation by restoring its valid install manifest and every
   path from that installation that existed before the failed invocation at the
   same target-relative path, filesystem object kind, regular-file byte
   content, symbolic-link target string, and directory descendant contents that
   existed immediately before the failed invocation, while removing paths
   created only by the failed invocation that are not part of the restored
   prior authoritative installation.
3. If no prior authoritative installation under `FR-0167` existed before
   installation writes began, rollback from criterion 1 attempts to remove every
   Confluex-owned path created, replaced, or partially removed during that
   invocation, including any target directory or missing-parent directory
   created under `FR-0166` criterion 7 and any partial
   `.confluex-install-manifest.txt`. Created missing-parent directories outside
   the resolved target are removed in child-to-parent order only while they are
   empty and were created by the failed invocation.
4. If a prior authoritative installation under `FR-0167` existed before
   installation writes began, the failed invocation leaves that prior
   authoritative installation still valid and authoritative; no failed install
   branch that destroys or demotes that prior authoritative installation
   satisfies this requirement.
5. If rollback from criterion 3 succeeds, the failed invocation leaves no
   Confluex-owned footprint from that invocation.
6. If rollback from criterion 2 succeeds, the failed invocation leaves no path
   created only by that failed invocation outside the restored prior
   authoritative installation.
7. If rollback from criterion 2 or 3 fails and any remaining path at or below
   the resolved target created, replaced, or partially removed by that failed
   invocation is not governed by the authoritative installation state that
   remains after rollback, those remaining in-target paths are
   non-authoritative install-failure debris. A created missing-parent directory
   outside the resolved target that rollback attempted to remove but found
   non-empty is non-authoritative install cleanup residue, is not part of an
   authoritative installation state, does not require the marker from criterion
   8, and is not governed by the manifest-driven uninstall contract.
8. The bounded install-failure debris root from criterion 7 is the resolved
   target directory of that failed invocation. If criterion 7 holds, that
   target directory exists, satisfies `FR-0217`, and also contains one regular
   UTF-8 text marker file `.confluex-install-debris.txt` with LF line endings
   whose only text line is exactly `NON_AUTHORITATIVE_INSTALL_FAILURE`.
9. The install-specific marker file from criterion 8 ends with exactly one
   terminating LF and contains no other bytes; it is not part of any
   authoritative installation state and is never listed in a valid install
   manifest.
10. If no prior authoritative installation under `FR-0167` existed before
    installation writes began and criterion 7 holds, the remaining paths from
    criterion 7 are not a runnable installed footprint and are not removed by a
    later manifest-driven `uninstall`.

**Dependencies**:
- `FR-0142`
- `FR-0167`
- `FR-0168`
- `FR-0215`
- `FR-0217`

**Traceability**:
- Area: installation lifecycle
- Observable evidence: cleanup, debris

### FR-0170
**Requirement**: `uninstall` shall resolve and validate a safe removal target
before filesystem removal begins.

**Applicability**:
- non-help `uninstall` invocations

**Rationale**:
- Operators need uninstall to avoid touching the runtime tree or an invalid
  target before removal starts.

**Acceptance Criteria**:
1. If `--install-dir` is supplied, the removal target is resolved under
   `FR-0033`.
2. If `--install-dir` is omitted, the removal target uses the same default
   target resolution and unsupported-platform rejection rules as `FR-0166`,
   with filesystem removal replacing installation writes as the operation that
   must not begin before rejection.
3. Before any filesystem removal begins, the currently executing Confluex
   runtime root and runtime-root source string are defined by `FR-0152`. If
   that runtime-root source string fails path-source acquisition under
   `FR-0158`, or if path normalization of that runtime-root source string under
   `FR-0159` fails, the invocation is rejected before invocation acceptance
   under `FR-0212` and before filesystem removal begins. Otherwise, if the normalized resolved
   target equals the normalized currently executing Confluex runtime root under
   `FR-0160`, or if either normalized path is a path-segment descendant of the
   other under `FR-0161`, the invocation is rejected before invocation
   acceptance under `FR-0212` and before filesystem removal begins.
4. The target path is evaluated using non-following filesystem metadata under
   `FR-0154` before any filesystem removal begins. If that evaluation fails for
   a reason other than path absence, the invocation is rejected before
   invocation acceptance under `FR-0212` and before filesystem removal begins.
5. If the target path exists as a symbolic link, FIFO, socket, device, regular
   file, or any other non-directory filesystem object, the invocation is
   rejected before invocation acceptance under `FR-0212` and before filesystem
   removal begins.
6. If the target path is absent and criteria 3 and 4 do not fail, `uninstall`
   completes idempotently and does not treat that state as an error.
7. The `.confluex-install-manifest.txt` path is evaluated using non-following
   filesystem metadata under `FR-0154` before any filesystem removal begins. If
   the target path exists and that manifest-path evaluation fails for a reason
   other than path absence, the invocation is rejected before invocation
   acceptance under `FR-0212` and before filesystem removal begins. If the target path exists as a directory,
   criteria 3 and 4 do not fail, and that manifest path is absent, `uninstall`
   completes idempotently and does not treat that state as an error.
8. If `.confluex-install-manifest.txt` exists as a symbolic link, directory,
   FIFO, socket, device, or any other non-regular filesystem object, or exists
   as a regular file but is not a valid install manifest, the invocation is
   rejected before invocation acceptance under `FR-0212` and before any
   filesystem removal begins; a symbolic link at the manifest path is not
   followed.
9. Before filesystem removal begins, `uninstall` evaluates every existing
   ancestor path segment from the filesystem root through the parent of the
   resolved target path using non-following filesystem metadata under
   `FR-0154`. If evaluation of any such ancestor fails, the invocation is
   rejected before invocation acceptance under `FR-0212` and before
   filesystem removal begins.
10. If any existing ancestor checked by criterion 9 is a symbolic link, regular
   file, FIFO, socket, device, or any other non-directory filesystem object,
   the invocation is rejected before invocation acceptance under `FR-0212` and
   before filesystem removal begins.

**Dependencies**:
- `FR-0019`
- `FR-0033`
- `FR-0152`
- `FR-0154`
- `FR-0158`
- `FR-0159`
- `FR-0160`
- `FR-0161`
- `FR-0166`
- `FR-0212`
- `FR-0215`

**Traceability**:
- Area: installation lifecycle
- Observable evidence: target selection, idempotent behavior, rejection

### FR-0171
**Requirement**: `uninstall` shall remove only manifest-listed owned paths in
safe order.

**Applicability**:
- accepted non-help `uninstall` invocations

**Rationale**:
- Operators need removal to be bounded to the manifest and ordered so that
  shared containers are only removed when empty.

**Acceptance Criteria**:
1. Before filesystem removal begins, each valid-manifest relative path already
   satisfying `FR-0150` under `FR-0215` is joined to the resolved target path
   one path segment at a time without following symlinks.
2. Before removal, `uninstall` evaluates each manifest-listed path using
   non-following filesystem metadata under `FR-0154`. If evaluation of any
   listed path fails for a reason other than path absence, the accepted
   invocation fails under `FR-0142` before filesystem removal begins.
3. If any listed existing path is neither a regular file, a symbolic link, nor
   a directory, the accepted invocation fails under `FR-0142` before filesystem
   removal begins.
4. If a valid install manifest is present, `uninstall` removes every listed
   existing path that is a regular file or symbolic link except
   `.confluex-install-manifest.txt` in ascending bytewise lexicographic order of
   the manifest relative path, and removes no Confluex-owned path that is absent
   from that manifest.
5. A listed symbolic link is removed as the link itself; `uninstall` does not
   follow the symbolic link target.
6. After listed regular files and symbolic links have been processed, listed
   existing directories are considered for removal in descending path-depth
   order, where path depth is the number of path segments in the manifest
   relative path and ties are ordered by ascending bytewise lexicographic order
   of the manifest relative path.
7. A listed directory is removed only when it is empty at the moment it is
   considered under criterion 6; if a listed directory is not empty at that
   moment, the accepted invocation fails under `FR-0142` before
   `.confluex-install-manifest.txt` is removed.
8. `.confluex-install-manifest.txt` is removed last, only after every other
   listed existing regular file, symbolic link, and empty directory that can be
   removed under criteria 4 through 7 has been removed successfully.
9. `uninstall` does not modify or remove unrelated files or directories in the
   target path.
10. If removal of a listed regular file, listed symbolic link, listed empty
   directory, or `.confluex-install-manifest.txt` fails after filesystem
   removal begins, the accepted invocation fails under `FR-0142` and no
   successful uninstall result line is emitted.

**Dependencies**:
- `FR-0142`
- `FR-0150`
- `FR-0154`
- `FR-0168`
- `FR-0215`

**Traceability**:
- Area: installation lifecycle
- Observable evidence: remaining target contents, manifest-driven removal

### FR-0172
**Requirement**: `uninstall` shall report the completion result line for every
accepted completion branch.

**Applicability**:
- accepted non-help `uninstall` invocations

**Rationale**:
- Operators and automation need a deterministic uninstall completion signal.

**Acceptance Criteria**:
1. If any Confluex-owned footprint was removed during an accepted `uninstall`
   invocation that completes the uninstallation lifecycle defined by
   `FR-0171`, `uninstall` emits exactly one stdout line
   `uninstall_result=removed target=<quoted_path_string>`.
2. If no Confluex-owned footprint was removed during an accepted `uninstall`
   invocation that completes, `uninstall` emits exactly one stdout line
   `uninstall_result=absent target=<quoted_path_string>`. This branch applies
   when the target path is absent or when `.confluex-install-manifest.txt` is
   absent from an existing target directory.
3. For this card, Confluex-owned footprint means existing paths listed in a
   valid install manifest governed by `FR-0215`; files or directories whose
   names resemble Confluex-owned paths do not count as Confluex-owned footprint
   when no valid install manifest is present.
4. `<quoted_path_string>` is the resolved absolute target serialized as the
   quoted path string defined by `FR-0124`.
5. Accepted `uninstall` invocations that complete write nothing to `stderr`.
6. The accepted invocation exit code is governed by `FR-0118`.
7. Accepted `uninstall` invocations that fail after command work begins are
   governed by `FR-0142`.

**Dependencies**:
- `FR-0118`
- `FR-0124`
- `FR-0142`
- `FR-0168`
- `FR-0170`
- `FR-0171`
- `FR-0215`

**Traceability**:
- Area: installation lifecycle
- Observable evidence: uninstall result line, empty stderr, exit code
