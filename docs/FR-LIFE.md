# Installation Lifecycle Requirements


### FR-0215
**Requirement**: The npm package manifest shall define one publishable Confluex
CLI package.

**Applicability**:
- package metadata used for local install, package dry-run, or publish

**Rationale**:
- Operators need Confluex to install through the standard npm package model.

**Acceptance Criteria**:
1. `package.json` contains a lowercase package `name`, a semver `version`, a
   non-empty `description`, a `bin.confluex` mapping exactly equal to
   `./bin/confluex`, and a `files` allowlist.
2. The `files` allowlist is exactly this ordered JSON string array:
   `["bin/", "docs/man/", "README.md", "LICENSE", "package.json"]`.
3. The publishable package path inventory is closed to these path classes:
   `package.json`, `README.md`, `LICENSE`, `bin/confluex`, and regular files
   whose package-relative path begins with `docs/man/`.
4. The package-public docs inventory is exactly `README.md`, `LICENSE`, and
   `docs/man/man1/confluex.1`.
5. Package metadata does not mark the package `private` when publication is the
   active lifecycle target.

**Dependencies**:
- None

**Traceability**:
- Area: installation lifecycle
- Observable evidence: package metadata and package dry-run contents

### FR-0048
**Requirement**: Fresh installation shall use npm package installation.

**Applicability**:
- operator installation documentation
- package installation smoke checks

**Rationale**:
- Operators need one canonical installation workflow that matches how npm CLI
  packages are normally distributed.

**Acceptance Criteria**:
1. The documented fresh install command is `npm install -g <package-name>`.
2. A successful fresh install exposes `confluex` on `PATH` through the npm
   `bin` mapping governed by `FR-0215`.
3. A fresh install is valid only when the installed-package smoke checks
   governed by `FR-0051` pass.
4. Fresh install validation uses the installed `confluex` command exposed by
   the npm `bin` mapping governed by `FR-0215`.

**Dependencies**:
- `FR-0215`
- `FR-0051`

**Traceability**:
- Area: installation lifecycle
- Observable evidence: install docs, installed `confluex` command, smoke output

### FR-0049
**Requirement**: Package update shall use npm package update semantics.

**Applicability**:
- operator update documentation
- package update smoke checks

**Rationale**:
- Operators need updates to use the same package manager that installed the CLI.

**Acceptance Criteria**:
1. The documented update command is `npm install -g <package-name>@latest`.
2. Update validation uses the installed-package smoke checks governed by
   `FR-0051`.
3. Update documentation identifies npm as the update mechanism.

**Dependencies**:
- `FR-0048`
- `FR-0051`

**Traceability**:
- Area: installation lifecycle
- Observable evidence: update docs and installed-command smoke output

### FR-0050
**Requirement**: Package removal shall use npm package uninstall semantics.

**Applicability**:
- operator uninstall documentation
- package uninstall smoke checks

**Rationale**:
- Operators need removal to be owned by the package manager rather than a
  manifest-driven Confluex subcommand.

**Acceptance Criteria**:
1. The documented uninstall command is `npm uninstall -g <package-name>`.
2. Uninstall validation confirms the npm global package is removed or no longer
   resolves to the removed package.
3. Uninstall documentation identifies npm as the removal mechanism.

**Dependencies**:
- `FR-0048`

**Traceability**:
- Area: installation lifecycle
- Observable evidence: uninstall docs and package-manager result

### FR-0051
**Requirement**: Installed-package smoke checks shall validate installed command
and manual resolution.

**Applicability**:
- local package install checks
- package update checks
- release verification
- external Docker verification

**Rationale**:
- A package that only renders top-level help can still be missing lazy-loaded
  runtime paths.

**Acceptance Criteria**:
1. Installed-package smoke checks run these commands in order:
   `confluex --help`, `confluex setup --help`,
   `confluex export --help`, and `man -w confluex`.
2. The `confluex --help` command follows the top-level help contract governed
   by `FR-0007`.
3. Each command-help invocation follows the command-help contract governed by
   `FR-0008`.
4. The `man -w confluex` command resolves the installed manual page whose
   package source path is governed by `FR-0215`.
5. Any smoke command output containing a JavaScript module-resolution stack
   trace, an unhandled exception stack trace, or a missing packaged-runtime
   path fails installed-package validation.
6. Installed-package smoke checks are executed by the external verification
   project in Docker, not by product-internal test code.
7. The installed-package Docker verification command is
   `npm --prefix /home/gromoff97/IdeaProjects/confluex-test run verify:install`.
8. The expected installed-smoke artifacts are stdout, stderr, exit code for each
   smoke command and the `man -w confluex` resolved manual path.

**Dependencies**:
- `FR-0007`
- `FR-0008`
- `FR-0118`

**Traceability**:
- Area: installation lifecycle
- Observable evidence: installed command stdout, stderr, and exit codes

### FR-0166
**Requirement**: Package dry-run shall review publishable contents before
publication.

**Applicability**:
- release verification
- package-content review
- external Docker verification

**Rationale**:
- Package publication needs reviewable contents that include runtime files and
  exclude secrets or irrelevant bulk.

**Acceptance Criteria**:
1. Release verification runs `npm pack --dry-run` or an equivalent package
   content listing.
2. The package content review normalizes each listed path by removing exactly
   one leading `package/` prefix when that prefix is present.
3. The normalized package content listing contains `package.json`, `README.md`,
   `LICENSE`, and `bin/confluex`.
4. Every normalized package content path belongs to exactly one package path
   class from the closed inventory governed by `FR-0215`.
5. Package content review is executed by the external verification project in
   Docker and must reject product-internal tests, stand files, Superpowers
   artifacts, scan output, and private workspace paths.
6. The canonical external verification project path is
   `/home/gromoff97/IdeaProjects/confluex-test`.
7. The package-content verification command is
   `npm --prefix /home/gromoff97/IdeaProjects/confluex-test run verify:remediation-tarball`.
8. Successful package-content verification emits `tarball_verification_ok files=<count>`,
   where `<count>` is a canonical non-negative integer.

**Dependencies**:
- `FR-0215`

**Traceability**:
- Area: installation lifecycle
- Observable evidence: package dry-run file list

### FR-0167
**Requirement**: The installed command shall execute the packaged native
runtime directly.

**Applicability**:
- installed `confluex` command invocations

**Rationale**:
- npm should expose the Rust binary directly so command behavior is not mediated
  by a legacy JavaScript shim.

**Acceptance Criteria**:
1. The package contains one executable public native binary at `bin/confluex`
   for the command name `confluex`.
2. The `bin.confluex` mapping governed by `FR-0215` points directly to that
   native binary.
3. The package contains no public JavaScript command shim and no public `dist/`
   runtime directory.

**Dependencies**:
- `FR-0215`

**Traceability**:
- Area: installation lifecycle
- Observable evidence: package `bin`, installed command dispatch

### FR-0168
**Requirement**: Installation documentation shall provide a quick start and
delegate full usage details to the installed manual.

**Applicability**:
- README and operator installation docs

**Rationale**:
- Operators need concise package lifecycle instructions and a way to validate
  the installed tool.

**Acceptance Criteria**:
1. README quick-start documentation includes fresh install, update, uninstall,
   `confluex setup`, one `confluex export --page-id <id> --plan-only`
   example, one `confluex export --page-id <id> --zip` example, and
   `man confluex`.
2. README quick-start documentation identifies npm as the package manager for
   install, update, and uninstall.
3. README quick-start documentation identifies the installed manual as the full
   operator reference.

**Dependencies**:
- `FR-0048`
- `FR-0049`
- `FR-0050`
- `FR-0222`

**Traceability**:
- Area: installation lifecycle
- Observable evidence: README lifecycle sections

### FR-0169
**Requirement**: Publication shall be gated by package and history hygiene.

**Applicability**:
- publication preparation

**Rationale**:
- Public package publication should not leak internal paths, secrets, or
  irrelevant history.

**Acceptance Criteria**:
1. Publication preparation runs forbidden-reference and secret scans before
   publish.
2. If forbidden history references are present, history cleanup is a separate
   explicitly approved phase before push or publish.
3. Publication uses `npm publish --access public` for scoped public packages and
   `npm publish` for unscoped public packages.
4. Publication requires npm authentication compatible with the account's 2FA or
   token policy.

**Dependencies**:
- `FR-0166`

**Traceability**:
- Area: installation lifecycle
- Observable evidence: release checklist, scan output, publish command choice

### FR-0170
**Requirement**: Local development installation shall use npm's local package
mechanisms.

**Applicability**:
- developer setup documentation
- local package smoke checks

**Rationale**:
- Maintainers need to test the same package shape operators install.

**Acceptance Criteria**:
1. Local development install documentation uses `npm install` for dependencies.
2. Local package install testing uses either `npm install -g <package-path>` or
   a tarball created by `npm pack`.
3. Local package smoke testing uses the installed-package smoke checks governed
   by `FR-0051`.

**Dependencies**:
- `FR-0048`
- `FR-0051`
- `FR-0166`
- `FR-0215`

**Traceability**:
- Area: installation lifecycle
- Observable evidence: local install docs and smoke commands

### FR-0245
**Requirement**: Package lifecycle documentation shall use npm commands for
package install, update, and removal workflows.

**Applicability**:
- operator lifecycle documentation
- package smoke documentation

**Rationale**:
- Operators need package lifecycle instructions to match the package manager
  that owns installation state.

**Acceptance Criteria**:
1. Fresh package installation documentation uses the npm command governed by
   `FR-0048`.
2. Package update documentation uses the npm command governed by `FR-0049`.
3. Package removal documentation uses the npm command governed by `FR-0050`.
4. Package smoke documentation validates the public command inventory governed
   by `FR-0222` through the installed-package smoke checks governed by
   `FR-0051`.

**Dependencies**:
- `FR-0222`
- `FR-0048`
- `FR-0049`
- `FR-0050`
- `FR-0051`
- `FR-0215`

**Traceability**:
- Area: installation lifecycle
- Observable evidence: lifecycle docs and installed-command smoke output

### FR-0172
**Requirement**: Lifecycle failures shall produce actionable package-manager
next steps.

**Applicability**:
- installation, update, uninstall, and package smoke documentation

**Rationale**:
- Operators need failures to identify whether npm, package contents, native
  binary execution, configuration, or Confluence access is the next problem.

**Acceptance Criteria**:
1. Lifecycle docs distinguish npm installation failure, missing packaged native
   binary execution, missing token configuration, native Markdown
   materialization failure, and Confluence access failure.
2. Lifecycle validation failures do not print token values, Authorization header
   values, cookies, or full process environments.
3. When package smoke fails because the installed runtime cannot load, the next
   action names package reinstall or package-content verification rather than
   Confluence troubleshooting.

**Dependencies**:
- `FR-0039`
- `FR-0255`
- `FR-0118`
- `FR-0166`

**Traceability**:
- Area: installation lifecycle
- Observable evidence: lifecycle troubleshooting docs and smoke failure output
