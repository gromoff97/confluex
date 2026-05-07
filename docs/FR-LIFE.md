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
   non-empty `description`, an `engines.node` constraint exactly equal to
   `>=20.11.0`, a `bin.confluex` mapping exactly equal to
   `./bin/confluex.js`, and a `files` allowlist.
2. The `files` allowlist is exactly this ordered JSON string array:
   `["bin/", "dist/", "README.md", "LICENSE", "package.json"]`.
3. The publishable package path inventory is closed to these path classes:
   `package.json`, `README.md`, `LICENSE`, `bin/confluex.js`, and regular
   files whose package-relative path begins with `dist/`.
4. The package-public docs inventory beyond `README.md` and `LICENSE` is empty
   for this lifecycle target.
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
**Requirement**: Installed-package smoke checks shall validate real command
dispatch.

**Applicability**:
- local package install checks
- package update checks
- release verification

**Rationale**:
- A package that only renders top-level help can still be missing lazy-loaded
  runtime paths.

**Acceptance Criteria**:
1. Installed-package smoke checks run these commands in order:
   `confluex --help`, `confluex doctor --help`, `confluex doctor`.
2. The `confluex --help` command follows the top-level help contract governed
   by `FR-0007`.
3. The `confluex doctor --help` command follows the command-help contract
   governed by `FR-0008`.
4. The `confluex doctor` command is invoked without `--page-id` and without
   requiring `CONFLUEX_CONFLUENCE_TOKEN`; it follows the accepted `doctor`
   stdout, stderr, and exit-code contract governed by `FR-0043`.
5. The `confluex doctor` smoke command validates the package path that loads the
   Markdown payload module through the `markdown_converter` diagnostic governed
   by `FR-0038`.
6. Any smoke command output containing a JavaScript module-resolution stack
   trace, an unhandled exception stack trace, or a missing packaged-runtime
   path fails installed-package validation.

**Dependencies**:
- `FR-0007`
- `FR-0008`
- `FR-0038`
- `FR-0043`
- `FR-0074`
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

**Rationale**:
- Package publication needs reviewable contents that include runtime files and
  exclude secrets or irrelevant bulk.

**Acceptance Criteria**:
1. Release verification runs `npm pack --dry-run` or an equivalent package
   content listing.
2. The package content review normalizes each listed path by removing exactly
   one leading `package/` prefix when that prefix is present.
3. The normalized package content listing contains `package.json`, `README.md`,
   `LICENSE`, `bin/confluex.js`, and at least one path beginning with `dist/`.
4. Every normalized package content path belongs to exactly one package path
   class from the closed inventory governed by `FR-0215`.

**Dependencies**:
- `FR-0215`

**Traceability**:
- Area: installation lifecycle
- Observable evidence: package dry-run file list

### FR-0167
**Requirement**: The installed command shall dispatch through the packaged
runtime.

**Applicability**:
- installed `confluex` command invocations

**Rationale**:
- npm should expose a small command shim while command behavior remains owned by
  the packaged runtime.

**Acceptance Criteria**:
1. The package contains one executable public shim at `bin/confluex.js` for the
   command name `confluex`.
2. The public shim delegates to the generated public `dist/` runtime included
   by `FR-0215`.
3. The public shim resolves its runtime target through package-relative paths
   inside the closed package path inventory governed by `FR-0215`.

**Dependencies**:
- `FR-0215`

**Traceability**:
- Area: installation lifecycle
- Observable evidence: package `bin`, installed command dispatch

### FR-0168
**Requirement**: Installation documentation shall cover the supported lifecycle
and prerequisites.

**Applicability**:
- README and operator installation docs

**Rationale**:
- Operators need concise package lifecycle instructions and a way to validate
  the installed tool.

**Acceptance Criteria**:
1. Installation docs include fresh install, update, uninstall, local development
   install, the Node.js `>=20.11.0` runtime prerequisite, the `uvx` Markdown
   converter prerequisite, env-file configuration, token setup, and installed
   command validation.
2. Installation docs identify npm as the package manager for install, update,
   and uninstall.
3. Installation docs identify the public CLI commands from `FR-0222` as the
   installed command surface operators can validate after package setup.

**Dependencies**:
- `FR-0048`
- `FR-0049`
- `FR-0050`
- `FR-0222`
- `FR-0219`

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
- Operators need failures to identify whether npm, Node, package contents, or
  runtime prerequisites are the next problem.

**Acceptance Criteria**:
1. Lifecycle docs distinguish npm installation failure, unsupported Node.js
   versions lower than `20.11.0`, missing runtime dependency, missing token
   configuration, and Confluence access failure.
2. Lifecycle validation failures do not print token values, Authorization header
   values, cookies, or full process environments.
3. When package smoke fails because the installed runtime cannot load, the next
   action names package reinstall or package-content verification rather than
   Confluence troubleshooting.

**Dependencies**:
- `FR-0038`
- `FR-0039`
- `FR-0234`
- `FR-0118`
- `FR-0166`

**Traceability**:
- Area: installation lifecycle
- Observable evidence: lifecycle troubleshooting docs and smoke failure output
