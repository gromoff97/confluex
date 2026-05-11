# Installation Lifecycle Requirements


### FR-0215
**Requirement**: The root Cargo package manifest shall define the Confluex CLI
build surface.

**Applicability**:
- product source build metadata
- release verification
- local development verification

**Rationale**:
- Confluex is Cargo-only for this project phase, so build ownership must come
  from the root Cargo manifest instead of a secondary package adapter or nested
  package layout.

**Acceptance Criteria**:
1. The product root contains `Cargo.toml` and `Cargo.lock`.
2. The root `Cargo.toml` defines one package named exactly `confluex`.
3. The root `Cargo.toml` defines one binary named exactly `confluex` with path
   `src/main.rs`.
4. The canonical release build command is exactly `cargo build --release`.
5. The canonical check command is exactly `cargo check`.
6. The canonical lint command is exactly
   `cargo clippy --all-targets -- -D warnings`.

**Dependencies**:
- None

**Traceability**:
- Area: installation lifecycle
- Observable evidence: Cargo manifests and Cargo build commands

### FR-0048
**Requirement**: Fresh local build shall use Cargo release build.

**Applicability**:
- operator build documentation
- external verification
- local development setup

**Rationale**:
- Operators and maintainers need one build path that matches the Rust runtime
  architecture.

**Acceptance Criteria**:
1. The documented fresh local build command is exactly
   `cargo build --release`.
2. A successful fresh local build creates the command binary at
   `target/release/confluex` on Unix-like platforms.
3. Fresh local build validation runs the smoke checks governed by `FR-0051`.
4. Fresh local build documentation does not require a secondary package manager.

**Dependencies**:
- `FR-0215`
- `FR-0051`

**Traceability**:
- Area: installation lifecycle
- Observable evidence: Cargo release build and built binary execution

### FR-0049
**Requirement**: Update shall use source update plus Cargo rebuild.

**Applicability**:
- operator update documentation
- local development update verification

**Rationale**:
- Cargo-only updates should replace source and rebuild the same native CLI
  binary rather than using a separate installer state.

**Acceptance Criteria**:
1. Update documentation describes updating the source checkout before rebuilding.
2. The documented rebuild command after source update is exactly
   `cargo build --release`.
3. Update validation runs the smoke checks governed by `FR-0051` after rebuild.

**Dependencies**:
- `FR-0048`
- `FR-0051`

**Traceability**:
- Area: installation lifecycle
- Observable evidence: source update docs and Cargo rebuild output

### FR-0050
**Requirement**: Removal shall remove the Cargo-built binary or build artifacts
selected by the operator.

**Applicability**:
- operator removal documentation
- local cleanup verification

**Rationale**:
- Cargo-only local builds leave build artifacts under the Cargo target
  directory; removal is cleanup of those artifacts or copied binaries chosen by
  the operator.

**Acceptance Criteria**:
1. Removal documentation identifies `target/release/confluex` as the canonical
   local release binary path on Unix-like platforms.
2. Removal documentation may recommend `cargo clean` when the operator wants to
   remove Cargo target build artifacts.
3. Removal documentation does not describe global package-manager uninstall
   state.

**Dependencies**:
- `FR-0048`

**Traceability**:
- Area: installation lifecycle
- Observable evidence: cleanup docs and absence of selected local artifact

### FR-0051
**Requirement**: Cargo-built binary smoke checks shall validate command help.

**Applicability**:
- local build checks
- release verification
- external verification

**Rationale**:
- A successful Rust build must still prove the public command surface is
  executable.

**Acceptance Criteria**:
1. Cargo-built binary smoke checks run these commands in order:
   `target/release/confluex --help`,
   `target/release/confluex setup --help`, and
   `target/release/confluex export --help`.
2. The `target/release/confluex --help` command follows the top-level help
   contract governed by `FR-0007`.
3. Each command-help invocation follows the command-help contract governed by
   `FR-0008`.
4. Any smoke command output containing a runtime loader-resolution stack trace,
   an unhandled exception stack trace, or a missing Rust runtime path fails
   Cargo-built binary validation.
5. Cargo-built binary smoke checks are executed by the external verification
   project, not by product-internal test code.
6. The expected smoke artifacts are stdout, stderr, and exit code for each
   smoke command.

**Dependencies**:
- `FR-0007`
- `FR-0008`
- `FR-0118`

**Traceability**:
- Area: installation lifecycle
- Observable evidence: built command stdout, stderr, and exit codes

### FR-0166
**Requirement**: Release verification shall review tracked Cargo product source.

**Applicability**:
- release verification
- source-content review
- external verification

**Rationale**:
- Cargo-only release readiness needs reviewable source contents that exclude
  test harnesses, private local paths, and obsolete adapter files.

**Acceptance Criteria**:
1. Release verification reviews tracked Cargo product source rather than a
   package archive.
2. The product source review requires `Cargo.toml`, `Cargo.lock`,
   `README.md`, `LICENSE`, `src/main.rs`, and `docs/man/man1/confluex.1`.
3. The product source review rejects removed package manifest files, removed
   package-adapter files, product-internal tests, stand files, Superpowers
   artifacts, scan output, and private local paths.
4. The canonical external verification project path is
   `/home/gromoff97/IdeaProjects/confluex-test`.

**Dependencies**:
- `FR-0215`

**Traceability**:
- Area: installation lifecycle
- Observable evidence: tracked-source inventory review

### FR-0167
**Requirement**: Command execution shall use the Cargo-built native runtime
directly.

**Applicability**:
- built `confluex` command invocations
- external regression verification

**Rationale**:
- Cargo should execute the Rust binary directly so command behavior is not
  mediated by a legacy runtime shim.

**Acceptance Criteria**:
1. The release binary path for external verification is exactly
   `target/release/confluex` on Unix-like platforms.
2. External verification invokes the release binary directly unless
   `CONFLUEX_BIN` explicitly selects another binary.
3. The product source contains no public command shim and no public legacy
   runtime directory.

**Dependencies**:
- `FR-0215`

**Traceability**:
- Area: installation lifecycle
- Observable evidence: direct Cargo-built binary dispatch

### FR-0168
**Requirement**: Installation documentation shall provide a crates.io install,
setup, export, and help quick start.

**Applicability**:
- README and operator lifecycle docs

**Rationale**:
- Operators need concise installation and first-export instructions that match
  the published Cargo package page.

**Acceptance Criteria**:
1. README quick-start documentation includes `cargo install confluex`,
   `confluex setup`, `confluex export --page-id <id> --plan-only --out <path>`,
   `confluex export --page-id <id> --out <path> --zip`, `confluex --help`, and
   `confluex export --help`.
2. README setup documentation states that setup asks for the Confluence base URL
   and token, and that token input is hidden.
3. README export documentation states that `--plan-only` inspects export scope
   without writing page Markdown.
4. README export documentation states that `--zip` creates a ZIP archive.
5. README source-build documentation includes `cargo build --release`,
   `./target/release/confluex --help`, and
   `man ./docs/man/man1/confluex.1`.

**Dependencies**:
- `FR-0048`
- `FR-0169`
- `FR-0222`

**Traceability**:
- Area: installation lifecycle
- Observable evidence: README lifecycle sections

### FR-0169
**Requirement**: Publication shall use Cargo native crates.io publication.

**Applicability**:
- publication preparation
- release checklist

**Rationale**:
- Cargo native publication is the conventional release path for a Cargo
  package. Release version selection and commit creation are maintainer-owned
  steps before publication.

**Acceptance Criteria**:
1. The release version is the `version` value in `Cargo.toml`.
2. The release version is formatted as `x.y.z`, where `x`, `y`, and `z` are
   non-negative decimal integers without signs or separators other than dots.
3. The maintainer commits the release version change before publication.
4. The dry-run command is exactly `cargo publish --dry-run`.
5. The publish command is exactly `cargo publish`.
6. Publication publishes the `confluex` crate to crates.io.
7. Publication has no additional required release action after
   `cargo publish` completes successfully.

**Dependencies**:
- `FR-0166`
- `FR-0215`

**Traceability**:
- Area: installation lifecycle
- Observable evidence: Cargo publish output and crates.io package version

### FR-0170
**Requirement**: Local development setup shall use Cargo.

**Applicability**:
- developer setup documentation
- local smoke checks

**Rationale**:
- Maintainers need development commands that match the product's only build
  system.

**Acceptance Criteria**:
1. Local development setup documentation uses `cargo check` for
   compile validation.
2. Local development setup documentation uses
   `cargo clippy --all-targets -- -D warnings` for lint validation.
3. Local release build testing uses `cargo build --release`.
4. Local smoke testing uses the Cargo-built binary smoke checks governed by
   `FR-0051`.

**Dependencies**:
- `FR-0048`
- `FR-0051`
- `FR-0166`
- `FR-0215`

**Traceability**:
- Area: installation lifecycle
- Observable evidence: local Cargo commands and smoke output

### FR-0245
**Requirement**: Lifecycle documentation shall use Cargo commands for build,
update, validation, and removal workflows.

**Applicability**:
- operator lifecycle documentation
- smoke documentation

**Rationale**:
- Lifecycle instructions must match the tool that owns the product build state.

**Acceptance Criteria**:
1. Fresh local build documentation uses the Cargo command governed by `FR-0048`.
2. Update documentation uses the source-update and Cargo rebuild behavior
   governed by `FR-0049`.
3. Removal documentation uses the local cleanup behavior governed by `FR-0050`.
4. Smoke documentation validates the public command inventory governed by
   `FR-0222` through the Cargo-built binary smoke checks governed by `FR-0051`.

**Dependencies**:
- `FR-0222`
- `FR-0048`
- `FR-0049`
- `FR-0050`
- `FR-0051`
- `FR-0215`

**Traceability**:
- Area: installation lifecycle
- Observable evidence: lifecycle docs and built-command smoke output

### FR-0172
**Requirement**: Lifecycle failures shall produce actionable Cargo, build,
configuration, or Confluence next steps.

**Applicability**:
- build, update, cleanup, and smoke documentation

**Rationale**:
- Operators need failures to identify whether Cargo, source checkout state,
  native binary execution, configuration, or Confluence access is the next
  problem.

**Acceptance Criteria**:
1. Lifecycle docs distinguish Cargo build failure, missing built native binary,
   missing token configuration, native Markdown materialization failure, and
   Confluence access failure.
2. Lifecycle validation failures do not print token values, Authorization
   header values, cookies, or full process environments.
3. When smoke validation fails because the built runtime cannot execute, the
   next action names Cargo rebuild or source-content verification rather than
   Confluence troubleshooting.

**Dependencies**:
- `FR-0039`
- `FR-0255`
- `FR-0118`
- `FR-0166`

**Traceability**:
- Area: installation lifecycle
- Observable evidence: lifecycle troubleshooting docs and smoke failure output
