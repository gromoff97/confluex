# Confluex Cleanup Implementation Plan

**Goal:** Turn Confluex into a token-only, Markdown-only, TypeScript-first npm CLI with real-stand selftest coverage and no long-lived shell/unit-test product regression layer.

**Architecture:** Execute as a phased program. Each phase first updates canonical requirements, then code, then selftest coverage, then docs, then quality gates. Do not delete old tests or shell entrypoints until replacement coverage and invocation paths exist.

**Tech Stack:** Node.js, TypeScript target, npm package `bin`, Confluence REST, external Markdown converter until replaced or validated, Docker-backed `confluence-stand`, ZIP archive creation, selftest live regression.

---

## Bootstrap For A New Thread

Start here if this plan is opened in a fresh conversation.

1. Read root `AGENTS.md`.
2. Read `designs/2026-05-06-confluex-cleanup-design.md`.
3. Read `docs/AGENTS.md`, `lib/AGENTS.md`, and `tests/AGENTS.md` before touching those trees.
4. For behavior changes, read the relevant `docs/FR-<AREA>.md` files first.
5. Work directly in the current branch unless the user explicitly asks for a worktree.
6. Commit frequently.
7. Do not rewrite Git history unless the active phase is explicitly publication hygiene and the user explicitly approves it in that phase.
8. Do not add internal planning-tool paths or references to tracked files.
9. Do not delete existing tests until replacement selftest coverage exists and is recorded in the migration matrix.
10. Do not keep removed behavior as deprecated aliases or hidden fallbacks.

Current repository path:

```text
this repository root
```

Related stand project path:

```text
../confluence-stand
```

Current known state at plan creation:

- Runtime is JavaScript CommonJS under `lib/confluex-node`.
- Target runtime is TypeScript-first, npm-distributable CLI.
- Current package is private and not yet a normal npm CLI package.
- Current tests include temporary `tests/node` and `tests/live-bats` layers.
- Target product regression is `confluex selftest` against a real stand.
- Current Confluence auth still contains username/password Basic-auth concepts.
- Target auth is token-only Bearer.
- Current export still contains HTML page-format support.
- Target export is Markdown-only.
- Current stand reset requires Docker lifecycle work.
- Target stand reset avoids container/volume delete-recreate cycles.

Important real-world auth facts:

- Real Confluence accepted Bearer token REST access.
- Real Confluence rejected Basic login/password with HTTP `401` and `X-Seraph-LoginReason: AUTHENTICATED_FAILED`.
- Inherited corporate proxy variables can break internal Confluence access.
- Confluence network child processes must sanitize proxy variables by default.

## Required First Move In Any Implementation Thread

Before writing code, create or update a small phase-specific task plan from this program plan. Do not try to implement all phases in one pass.

Recommended first implementation thread:

```text
Phase 1 + Phase 2 + Phase 3 only:
requirements alignment, env-file config, token-only auth, proxy isolation, diagnostics
```

Do not start TypeScript migration, test deletion, npm publishing, or history cleanup in the first implementation thread.

## Scope Check

The design spans several subsystems: requirements, auth/config, export output, diagnostics, stand reset, selftest, test migration, TypeScript migration, npm distribution, and history hygiene. Implement it as phases, not as one mega-change.

Each phase must end with:

- updated requirements when behavior changes;
- updated README or operator docs when UX changes;
- selftest coverage for product behavior;
- static quality checks;
- a commit.

Do not rewrite Git history again unless the active phase is explicitly the publication-hygiene phase.

## File Responsibility Map

Requirements:

- `docs/FR-CMD.md`: command surface.
- `docs/FR-CONF.md`: Confluence access configuration.
- `docs/FR-OPT.md`: CLI option semantics.
- `docs/FR-VAL.md`: validation and rejection.
- `docs/FR-DIAG.md`: doctor diagnostics.
- `docs/FR-OBS.md`: logs, summaries, status lines.
- `docs/FR-DATA.md`: Confluence data acquisition.
- `docs/FR-OUT.md`: output files and artifacts.
- `docs/FR-REP.md`: report file sets.
- `docs/FR-RUN.md`: run lifecycle and selftest behavior.
- `docs/FR-LIFE.md`: install/update/uninstall lifecycle.
- `docs/FR-INT.md`: interruption and failure branches.
- `docs/FR-SEC.md`: interaction with encryption.

Runtime:

- `lib/confluex-node/main.js`: command dispatch.
- `lib/confluex-node/cli/registry.js`: command/help metadata.
- `lib/confluex-node/cli/parse.js`: CLI token parsing.
- `lib/confluex-node/cli/validate.js`: option validation.
- `lib/confluex-node/remote/access.js`: Confluence auth and REST access.
- `lib/confluex-node/payload/markdown-exporter.js`: Markdown converter invocation.
- `lib/confluex-node/commands/doctor.js`: diagnostics workflow.
- `lib/confluex-node/commands/export-related.js`: plan/export workflow.
- `lib/confluex-node/reports/run-report.js`: report schema and summary fields.
- `lib/confluex-node/commands/selftest.js`: selftest orchestration.
- `lib/confluex-node/selftest/*`: stand fixture, expected data, live regression.
- `lib/confluex-node/commands/install.js`: current internal install command.
- `lib/confluex-node/commands/uninstall.js`: current internal uninstall command.

Packaging and scripts:

- `package.json`: scripts, dependencies, package metadata, npm `bin`.
- `package-lock.json`: dependency lock after npm changes.
- `confluex`: current launcher; target is removal or replacement with npm bin.
- `scripts/*`: shell helpers; target is TypeScript/Node replacement where practical.
- `README.md`: install, update, usage, env-file, prerequisites.

Tests and test assets:

- `tests/`: final home for all test assets.
- `tests/node/*`: temporary migration scaffolding.
- `tests/live-bats/*`: temporary migration scaffolding to replace with selftest.
- `fixtures/*`: move under `tests/` if retained.
- `docker/confluence-7137`: remove if still only dead leftover.

External stand:

- `../confluence-stand`: stand reset, token support, and stand docs live there, not in Confluex runtime.

## Phase 0: Baseline And Safety

**Goal:** Establish a clean starting point and prevent accidental publication/history work.

**Files:**

- Modify: none unless checks reveal untracked generated files.

- [ ] Run `git status --short --branch`.

Expected: clean worktree except planned files.

- [ ] Run forbidden-reference history check.

```bash
git log --all --name-only --pretty=format: | grep -iE "forbidden-pattern" || true
git grep -I -n -i "forbidden-pattern" "$(git rev-list --all)" -- . 2>/dev/null || true
```

Expected: no output for the real forbidden pattern used in the publication-hygiene phase.

- [ ] Run current fast quality baseline.

```bash
npm run lint
npm run test:node
```

Expected: record pass/fail before edits. If current baseline fails, commit no code until the failure is understood.

- [ ] Commit only if baseline documentation or ignore cleanup changes are needed.

Suggested commit: `chore: record cleanup baseline`.

## Phase 1: Requirements Alignment

**Goal:** Make the canonical requirements agree with the intended behavior before code changes.

**Files:**

- Modify: `docs/FR-CMD.md`
- Modify: `docs/FR-CONF.md`
- Modify: `docs/FR-OPT.md`
- Modify: `docs/FR-VAL.md`
- Modify: `docs/FR-DIAG.md`
- Modify: `docs/FR-OBS.md`
- Modify: `docs/FR-DATA.md`
- Modify: `docs/FR-OUT.md`
- Modify: `docs/FR-REP.md`
- Modify: `docs/FR-RUN.md`
- Modify: `docs/FR-LIFE.md`
- Modify: `docs/FR-INT.md`
- Modify: `docs/FR-SEC.md`

- [ ] Read the requirement-authoring rules.

Files:

```text
docs/AGENTS.md
```

Expected:

- New or changed requirement cards are self-contained.
- Stable IDs are not reused or renumbered.
- Each obligation has one authoritative home.
- Option cards own selection semantics.
- Output/report cards own resulting artifacts and status fields.

- [ ] Build a requirement impact map before editing.

Run:

```bash
rg -n "CONFLUEX_CONFLUENCE_USERNAME|CONFLUEX_CONFLUENCE_PASSWORD|--login|--password|--page-format|html|page.html|selftest|install|uninstall|archive|zip|proxy|doctor|Authorization|Basic|Bearer" docs/FR-*.md README.md
```

Expected:

- Identify every requirement card that still encodes old auth, HTML, or selftest behavior.
- Do not edit by blind search/replace.
- Decide the authoritative home for each changed obligation before writing.

- [ ] Update auth requirements: token-only, no username/password, no Basic fallback.

Acceptance:

- Real Confluence access uses `CONFLUEX_CONFLUENCE_BASE_URL` and `CONFLUEX_CONFLUENCE_TOKEN`.
- `--login`, `--password`, `CONFLUEX_CONFLUENCE_USERNAME`, and `CONFLUEX_CONFLUENCE_PASSWORD` are rejected or absent from real command contracts.
- Missing token fails before network access.
- `Authorization: Bearer <token>` is the only real Confluence auth mode.
- Basic auth is not retained as fallback, alias, or deprecated compatibility.

- [ ] Update env-file requirements.

Acceptance:

- Default env file path is exactly `./.confluex.env`.
- `--env-file <file>` selects only that file and ignores `./.confluex.env`.
- Effective precedence is exactly `CLI option > selected env file > process environment > no value`.
- Secret values are redacted from logs and reports.
- Every CLI option with an env equivalent has exact env name and absence semantics.
- Missing required effective options fail after merge and before work begins.

- [ ] Update Markdown-only requirements.

Acceptance:

- HTML page payload mode is removed.
- Markdown is the only page payload output.
- `_storage.xml` remains metadata, not HTML export.
- `--page-format html`, `page_payload_format=html`, and normal `page.html` output are removed from positive behavior.
- Any remaining mention of HTML is either a Markdown-quality remnant diagnostic or explicit removed/rejected behavior.

- [ ] Update ZIP requirements.

Acceptance:

- `--zip` selection is defined.
- ZIP path reporting is defined.
- ZIP failure branch is defined.
- Interaction with `--encrypt` has explicit precedence.
- ZIP archive contents and deterministic ordering are defined.
- Plain output retention with `--zip` is defined.

- [ ] Update diagnostics requirements.

Acceptance:

- `doctor` distinguishes missing token, rejected token, inaccessible page, transport failure, and converter auth failure.
- Logs include useful reason fields and never include secrets.
- `doctor` output has exact fields/tokens for auth and page-access diagnostics.
- `plan` and `export` page-local failures identify whether failure is auth, access, network, converter, or output related.

- [ ] Update selftest requirements.

Acceptance:

- `selftest --url <url> --token <token>` is the accepted shape.
- Positive and negative real-stand cases are governed.
- Test reset behavior is governed.
- Selftest no longer depends on Docker delete/recreate as the normal reset mechanism.
- Selftest remains explicit-target and does not discover arbitrary local containers.

- [ ] Update install/package requirements.

Acceptance:

- npm package installation/update/uninstall are represented.
- Existing internal `install`/`uninstall` is either aligned or marked for removal in requirements.
- Prerequisite validation is governed.
- Required package metadata, npm `bin`, and package dry-run validation are represented.
- Existing internal install cannot claim success from `--help` only.

- [ ] Run requirement consistency grep.

```bash
rg -n "CONFLUEX_CONFLUENCE_USERNAME|CONFLUEX_CONFLUENCE_PASSWORD|--login|--password|--page-format html|page_payload_format=html|page.html" docs README.md
```

Expected: remaining matches are either removed or intentionally described as removed/rejected behavior.

- [ ] Run requirement shape sanity checks.

Commands:

```bash
rg -n "TBD|TODO|FIXME|deprecated|fallback|username|password|Basic auth|page-format html|page_payload_format=html" docs/FR-*.md
rg -n "### FR-" docs/FR-*.md
```

Expected:

- No vague placeholders.
- No accidental deprecated/fallback language for removed behavior.
- Any `password` or `username` references are only non-Confluence domain text or explicit rejected behavior.

- [ ] Commit.

```bash
git add docs README.md
git commit -m "docs: align cleanup requirements"
```

## Phase 2: Env-File And Effective Config

**Goal:** Add the config merge layer used by all commands.

**Files:**

- Create: `lib/confluex-node/config/env-file.js`
- Create: `lib/confluex-node/config/effective-options.js`
- Modify: `lib/confluex-node/cli/registry.js`
- Modify: `lib/confluex-node/cli/validate.js`
- Modify: `lib/confluex-node/main.js`
- Temporary Test: `tests/node/config-env-file.test.js`

- [ ] Add temporary failing tests for default env-file loading.

Expected cases:

- reads `./.confluex.env` when present and `--env-file` is absent;
- explicit `--env-file` ignores `./.confluex.env`;
- CLI option overrides env-file value;
- env-file value overrides process environment;
- missing required effective value fails fast.

- [ ] Implement `parseEnvFile(path)`.

Rules:

- UTF-8 text.
- Ignore empty lines and lines starting with `#`.
- Accept `KEY=value`.
- Trim key whitespace.
- Preserve value bytes after the first `=`, except one optional pair of surrounding double quotes.
- Reject empty keys.
- Reject NUL.

- [ ] Implement `loadSelectedEnvFile(cwd, explicitPath)`.

Rules:

- if explicit path exists, load it;
- if explicit path does not exist, fail;
- if explicit path is absent and `./.confluex.env` exists, load it;
- if neither exists, return empty map.

- [ ] Implement `buildEffectiveOptions(parsedOptions, processEnv, selectedEnvFile)`.

Rules:

- CLI values win;
- selected env-file values map to option names;
- process env values are last;
- required values are checked by command validators.

- [ ] Add `--env-file <file>` to supported non-help command options where applicable.

Commands:

- `doctor`
- `plan`
- `export`
- `selftest`

- [ ] Run focused tests.

```bash
npm run test:node -- tests/node/config-env-file.test.js
```

- [ ] Commit.

```bash
git add lib/confluex-node/config lib/confluex-node/cli lib/confluex-node/main.js tests/node/config-env-file.test.js
git commit -m "feat: add env file configuration"
```

## Phase 3: Token-Only Auth And Proxy Isolation

**Goal:** Remove password auth from runtime and improve page-access diagnostics.

**Files:**

- Modify: `lib/confluex-node/remote/access.js`
- Modify: `lib/confluex-node/payload/markdown-exporter.js`
- Modify: `lib/confluex-node/commands/doctor.js`
- Modify: `lib/confluex-node/commands/export-related.js`
- Modify: `lib/confluex-node/reports/run-report.js`
- Temporary Test: `tests/node/remote-access.test.js`
- Temporary Test: `tests/node/doctor-command.test.js`
- Temporary Test: `tests/node/payload-markdown-exporter.test.js`

- [ ] Add failing tests for Bearer header and removed Basic behavior.

Expected:

- `Authorization` is `Bearer <token>`.
- username/password env does not create auth.
- missing token is validation failure.
- token is never printed in diagnostics.

- [ ] Implement token-only auth in `remote/access.js`.

Required output:

- no Basic auth helper;
- no username validation;
- no password reads;
- request headers include only Bearer auth for Confluence auth.

- [ ] Add proxy sanitizer for Confluence child-process environments.

Sanitize:

- `http_proxy`
- `https_proxy`
- `HTTP_PROXY`
- `HTTPS_PROXY`
- `all_proxy`
- `ALL_PROXY`

- [ ] Apply proxy sanitizer to Markdown exporter invocation.

Expected:

- inherited package-install proxy remains untouched outside Confluence child process;
- Confluence child env has proxy variables removed.

- [ ] Improve `doctor` page-access diagnostics.

Required reason classes:

- `missing_token`
- `auth_rejected`
- `page_inaccessible`
- `transport_tls`
- `transport_dns`
- `transport_timeout`
- `transport_connection_reset`
- `transport_proxy`
- `converter_auth_incompatible`

- [ ] Run focused tests.

```bash
npm run test:node -- tests/node/remote-access.test.js tests/node/doctor-command.test.js tests/node/payload-markdown-exporter.test.js
```

- [ ] Commit.

```bash
git add lib/confluex-node tests/node
git commit -m "feat: use token-only confluence auth"
```

## Phase 4: Markdown Exporter Compatibility Check

**Goal:** Prove the current Markdown exporter works with token-only auth or select a replacement path.

**Files:**

- Modify: `lib/confluex-node/payload/markdown-exporter.js`
- Modify: `tests/live-bats/live-regression.bats` only as temporary scaffolding if still present.
- Add under `tests/`: selftest case data for exporter auth.

- [ ] Run a real REST token check against the stand and real Confluence when available.

```bash
CONFLUEX_CONFLUENCE_BASE_URL="https://confluence.example" \
CONFLUEX_CONFLUENCE_TOKEN="<redacted>" \
./confluex doctor --page-id "<page-id>"
```

Expected: page access succeeds or fails with a classified reason.

- [ ] Run a Markdown payload smoke through the current exporter with token-only config.

Expected: actual Markdown content is produced for one known page.

- [ ] If the exporter requires username-shaped input, prove no Basic request is emitted.

Evidence:

- selftest covers token-only export;
- code comments explain why a neutral placeholder is safe if used.

- [ ] If token-only cannot work, stop implementation and choose a replacement converter before continuing.

No fallback to password auth is allowed.

- [ ] Commit if code or docs changed.

Suggested commit: `fix: validate markdown exporter token auth`.

## Phase 5: Remove HTML Payload Mode

**Goal:** Make Markdown the only page payload format.

**Files:**

- Modify: `lib/confluex-node/cli/registry.js`
- Modify: `lib/confluex-node/cli/validate.js`
- Modify: `lib/confluex-node/commands/export-related.js`
- Modify: `lib/confluex-node/reports/run-report.js`
- Modify: `README.md`
- Modify: `tests/` temporary tests and selftest cases.

- [ ] Add failing validation/selftest case: `--page-format html` is rejected.

- [ ] Remove HTML examples from help.

Expected:

- no `--page-format html` example;
- no `formats: md, html` text;
- Markdown described as only payload format.

- [ ] Remove HTML branch in export payload naming.

Expected:

- page payload file is `page.md`;
- no normal `page.html` materialization.

- [ ] Keep Markdown remnant diagnostics.

Expected:

- HTML-like remnants inside Markdown can still be reported as Markdown quality findings.

- [ ] Delete HTML golden data and HTML live-regression cases after replacement selftest cases exist.

- [ ] Run focused checks.

```bash
npm run lint
npm run test:node
```

- [ ] Commit.

```bash
git add lib tests README.md docs
git commit -m "feat: remove html payload mode"
```

## Phase 6: ZIP Packaging

**Goal:** Add `--zip` retained artifact support.

**Files:**

- Create: `lib/confluex-node/output/zip.js`
- Modify: `lib/confluex-node/cli/registry.js`
- Modify: `lib/confluex-node/cli/validate.js`
- Modify: `lib/confluex-node/commands/export-related.js`
- Modify: `lib/confluex-node/reports/run-report.js`
- Temporary Test: `tests/node/export-related-command.test.js`
- Selftest: add ZIP case under `tests/`.

- [ ] Add failing test for `export --zip`.

Expected:

- output root remains;
- `.zip` exists;
- summary includes ZIP path;
- archive contains `summary.txt`, reports, pages, attachments.

- [ ] Implement deterministic ZIP writer.

Rules:

- sorted relative paths;
- no absolute paths in archive;
- no directory traversal entries;
- fail if output root is missing.

- [ ] Define and implement `--zip` plus `--encrypt` precedence from requirements.

- [ ] Add selftest ZIP positive case.

- [ ] Run focused checks.

```bash
npm run lint
npm run test:node -- tests/node/export-related-command.test.js
```

- [ ] Commit.

```bash
git add lib tests docs README.md package.json package-lock.json
git commit -m "feat: add zip export packaging"
```

## Phase 7: Stand Reset And Token Support

**Goal:** Make the stand resettable without Docker delete/recreate and usable with token-oriented selftest.

**Files in Confluex:**

- Modify: `lib/confluex-node/commands/selftest.js`
- Modify: `lib/confluex-node/selftest/target-bootstrap.js`
- Modify: `lib/confluex-node/selftest/confluence-client.js`
- Modify: `lib/confluex-node/selftest/live-regression.js`
- Modify: `README.md`
- Add selftest assets under `tests/`.

**Files in stand project:**

- Modify: `../confluence-stand/Dockerfile`
- Modify: `../confluence-stand/scripts/runtime-entrypoint.sh` or replace it.
- Add reset handler or command in `../confluence-stand`.
- Update `../confluence-stand/README.md`.

- [ ] Design stand reset exact API before code.

Preferred local endpoint:

```text
POST http://127.0.0.1:8090/__confluence-stand/reset
```

Expected response:

```json
{"status":"reset","ready":true}
```

- [ ] Implement stand reset in stand project.

Required behavior:

- reset database and Confluence home to baseline;
- preserve patched image/runtime;
- return ready only after Confluence is accessible.

- [ ] Update Confluex selftest to call reset before fixture application.

- [ ] Update selftest CLI from `--login --password` to `--token`.

- [ ] Add positive and negative selftest cases.

Cases:

- valid token;
- invalid token;
- malformed page id;
- inaccessible page;
- reset then seed then export.

- [ ] Run stand selftest.

```bash
./confluex selftest --url http://127.0.0.1:8090 --token "<stand-token>"
```

- [ ] Commit Confluex changes.

```bash
git add lib tests docs README.md
git commit -m "feat: use token selftest with stand reset"
```

- [ ] Commit stand changes in `../confluence-stand`.

Suggested commit: `feat: add resettable token stand`.

## Phase 8: Test Migration And Test Layout

**Goal:** Move all test assets under `tests/` and delete replaced standalone tests.

**Files:**

- Move: `fixtures/*` -> `tests/fixtures/*`
- Move: test helper scripts under `tests/helpers/*`
- Modify: `lib/confluex-node/selftest/support-preflight.js`
- Modify: `lib/confluex-node/selftest/fixture-bundle.js`
- Modify: `package.json`
- Delete after coverage: `tests/node/*`
- Delete after coverage: `tests/live-bats/*`

- [ ] Create migration matrix file.

Path:

```text
tests/migration-matrix.md
```

Columns:

```text
old test class | selftest case | requirement ids | deletion status
```

- [ ] Move fixture assets under `tests/fixtures`.

- [ ] Update runtime paths to load test assets from `tests/fixtures`.

- [ ] Expand selftest to cover product behavior previously covered by node and Bats tests.

- [ ] Delete one replaced test group at a time.

Order:

- CLI validation tests;
- auth/doctor tests;
- export Markdown tests;
- report tests;
- install tests;
- safety/interruption tests.

- [ ] After each deletion, run selftest and static quality gates.

```bash
npm run lint
./confluex selftest --url http://127.0.0.1:8090 --token "<stand-token>"
```

- [ ] Commit after each replaced group.

Suggested commits:

- `test: migrate cli validation to selftest`
- `test: migrate auth diagnostics to selftest`
- `test: migrate export regression to selftest`

## Phase 9: TypeScript And Shell Removal

**Goal:** Move runtime and tooling toward TypeScript and remove shell wrappers/helpers where practical.

**Files:**

- Create: `tsconfig.json`
- Create: `src/`
- Create: `src/main.ts`
- Create: `bin/confluex.js`
- Modify: `package.json`
- Modify: `package-lock.json`
- Remove or replace: `confluex`
- Remove or replace: `scripts/lint-js.sh`
- Remove or replace: `scripts/lint-shell.sh`
- Remove or replace: `scripts/test-bats.sh`

- [ ] Add TypeScript dependencies and scripts.

Expected `package.json` scripts:

```json
{
  "build": "tsc -p tsconfig.json",
  "typecheck": "tsc -p tsconfig.json --noEmit",
  "lint": "eslint .",
  "selftest": "node dist/main.js selftest"
}
```

- [ ] Add npm `bin`.

Expected:

```json
{
  "bin": {
    "confluex": "./bin/confluex.js"
  }
}
```

- [ ] Create minimal JS bin shim.

Allowed because npm `bin` needs an executable entrypoint.

- [ ] Migrate modules incrementally from `lib/confluex-node` to `src`.

Order:

- CLI parse/validate/registry;
- config/env-file;
- remote access;
- doctor;
- payload;
- export;
- reports;
- selftest.

- [ ] Remove shell scripts after npm scripts replace them.

- [ ] Run quality gates.

```bash
npm run lint
npm run typecheck
npm run build
node ./bin/confluex.js --help
```

- [ ] Commit in small slices.

Suggested commits:

- `build: add typescript toolchain`
- `refactor: migrate cli core to typescript`
- `refactor: migrate confluence access to typescript`
- `chore: remove shell helper scripts`

## Phase 10: NPM Packaging And Install Model

**Goal:** Make install/update/uninstall canonical through npm or explicitly align internal commands.

**Files:**

- Modify: `package.json`
- Modify: `README.md`
- Modify: `docs/FR-LIFE.md`
- Modify: `lib/confluex-node/commands/install.js` or TypeScript successor.
- Modify: `lib/confluex-node/commands/uninstall.js` or TypeScript successor.

- [ ] Add package metadata.

Required:

- lowercase name;
- version;
- description;
- license decision;
- repository;
- engines;
- bin;
- files allowlist.

- [ ] Add package content check.

Command:

```bash
npm pack --dry-run
```

Expected:

- no secrets;
- no test-only bulk unless intentionally included;
- built CLI files included;
- README included.

- [ ] Test local install from tarball.

```bash
npm pack
npm install -g ./confluex-*.tgz
confluex --help
confluex doctor --page-id "<page-id>"
```

- [ ] Decide internal `confluex install` fate.

Preferred:

- remove internal install/uninstall if npm global install is canonical.

Allowed only if requirements define both:

- npm install model;
- internal install model;
- relationship and precedence.

- [ ] Update README.

Required sections:

- fresh install;
- update;
- uninstall;
- prerequisites;
- env file;
- token setup;
- selftest;
- package verification.

- [ ] Commit.

Suggested commit: `build: align npm package installation`.

## Phase 11: Prerequisite Validation

**Goal:** Fail early with actionable messages.

**Files:**

- Create: `src/prereq/checks.ts` or JS equivalent before TS migration.
- Modify: command entrypoint.
- Modify: `doctor`.
- Modify: `selftest`.
- Modify: README.

- [ ] Validate Node version.

- [ ] Validate token/base URL before network commands.

- [ ] Validate external converter availability if still external.

- [ ] Validate ZIP support when `--zip` is used.

- [ ] Validate stand reset capability before selftest fixture work.

- [ ] Add selftest negative cases for missing prerequisites where feasible.

- [ ] Commit.

Suggested commit: `feat: validate runtime prerequisites`.

## Phase 12: Publication Hygiene

**Goal:** Prepare for push/publish without forbidden references or sensitive files.

**Files:**

- Modify only if checks find publish blockers.

- [ ] Run forbidden-reference checks.

```bash
git log --all --name-only --pretty=format: | grep -iE "<forbidden-pattern>" || true
git grep -I -n -i "<forbidden-pattern>" "$(git rev-list --all)" -- . 2>/dev/null || true
```

- [ ] Run secret scan by filename and content patterns.

```bash
rg -n "password|token|secret|Authorization|PRIVATE KEY|BEGIN RSA|BEGIN OPENSSH" .
git log --all --name-only --pretty=format: | rg "secret|token|key|private|jar|pdf|zip|tgz"
```

- [ ] If history rewrite is required, stop and request explicit approval for that phase.

- [ ] Run package dry-run.

```bash
npm pack --dry-run
```

- [ ] Commit only documentation/checklist changes.

Suggested commit: `docs: add release hygiene checklist`.

## Final Program Gates

Run before considering the whole program complete:

```bash
npm run lint
npm run typecheck
npm run build
npm pack --dry-run
./confluex selftest --url http://127.0.0.1:8090 --token "<stand-token>"
```

If `./confluex` is removed by the TypeScript/npm phase, replace the last command with:

```bash
confluex selftest --url http://127.0.0.1:8090 --token "<stand-token>"
```

Run one real Confluence smoke when a valid token is available:

```bash
CONFLUEX_CONFLUENCE_BASE_URL="https://confluence.example" \
CONFLUEX_CONFLUENCE_TOKEN="<redacted>" \
confluex doctor --page-id "<page-id>"
```

## Commit Policy

Commit after every phase and after every large test migration group. Do not batch behavior, requirement, and test deletion into one huge commit unless the change is mechanically inseparable.

Recommended minimum sequence:

1. `docs: align cleanup requirements`
2. `feat: add env file configuration`
3. `feat: use token-only confluence auth`
4. `feat: remove html payload mode`
5. `feat: add zip export packaging`
6. `feat: use token selftest with stand reset`
7. `test: migrate product regression to selftest`
8. `build: add typescript toolchain`
9. `build: align npm package installation`
10. `docs: update install and operations guide`
