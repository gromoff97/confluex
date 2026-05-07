# Confluex Pure TypeScript And Public Package Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert Confluex into a pure TypeScript-authored public CLI with a small exact public surface, private/internal stand selftest verification, TypeScript-authored tests, and npm package contents suitable for publication.

**Architecture:** Execute as phased cleanup with frequent atomic commits. Requirements define positive target inventories for public commands, public options, package contents, diagnostics, configuration, Markdown output, and reports. Public Confluex keeps product source and product tests; selftest-only fixtures, stand assets, golden snapshots, and live verification move to private/internal tooling outside the public repository and npm package.

**Tech Stack:** Node.js `>=20.11.0`, TypeScript, npm package `bin`, ESLint flat config with `typescript-eslint` typed strict rules, Node test runner against compiled TypeScript tests, Confluence REST Bearer token auth, `uvx` plus `confluence-markdown-exporter` as the external Markdown converter for this phase.

---

## Bootstrap For A New Thread

1. Read root `AGENTS.md`.
2. Read `designs/2026-05-07-confluex-pure-typescript-cleanup-design.md`.
3. Read `docs/AGENTS.md` before reviewing or editing `docs/`.
4. Read `lib/AGENTS.md` before reviewing or editing `lib/`.
5. Read `tests/AGENTS.md` before reviewing or editing `tests/`.
6. Use RTK for non-interactive shell commands. Fall back to explicit `distill` prompts only when RTK is unsuitable.
7. Use `apply_patch` for manual edits.
8. Do not rewrite Git history in this plan.
9. Commit after every coherent phase and after every large migration batch.
10. Keep product requirements positive: exact inventories and behavior that exists, not separate cards saying retired behavior is absent.

## Current State Snapshot

- Public entrypoint exists through `bin/confluex.js`, but it delegates into `dist/main.js`.
- `src/main.ts` exists, but it delegates into CommonJS runtime under `lib/confluex-node/`.
- Maintained product runtime is mostly JavaScript.
- Maintained product tests are JavaScript under `tests/node/`.
- Live/selftest assets are present under `tests/fixtures/` and `tests/live-bats/`.
- Public CLI currently still exposes `config` and `selftest`.
- Public CLI currently still exposes composite/encryption options.
- `uvx` is still required by `lib/confluex-node/payload/markdown-exporter.js`.
- Public npm package allowlist currently includes selftest assets and fixtures.

## Target Public Inventory

Public commands:

- `export`
- `plan`
- `doctor`

Public `export` options:

- `--page-id <id>`
- `--out <path>`
- `--resume`
- `--no-fail-fast`
- `--keep-metadata`
- `--zip`
- `--env-file <file>`
- `--log-file <file>`
- `--max-pages <n>`
- `--max-download-mib <n>`
- `--sleep-ms <n>`
- `--max-find-candidates <n>`
- `--link-depth <n>`

Public `plan` options:

- `--page-id <id>`
- `--out <path>`
- `--no-fail-fast`
- `--keep-metadata`
- `--env-file <file>`
- `--log-file <file>`
- `--max-pages <n>`
- `--max-download-mib <n>`
- `--sleep-ms <n>`
- `--max-find-candidates <n>`
- `--link-depth <n>`

Public `doctor` options:

- `--page-id <id>`
- `--env-file <file>`
- `--log-file <file>`

Public configuration inputs:

- `CONFLUEX_CONFLUENCE_BASE_URL`
- `CONFLUEX_CONFLUENCE_TOKEN`
- `CONFLUEX_OUTPUT_ROOT`
- `CONFLUEX_LOG_FILE`
- `CONFLUEX_MAX_PAGES`
- `CONFLUEX_MAX_DOWNLOAD_MIB`
- `CONFLUEX_SLEEP_MS`
- `CONFLUEX_MAX_FIND_CANDIDATES`
- `CONFLUEX_LINK_DEPTH`

Runtime prerequisites:

- Node.js `>=20.11.0`
- `uvx`
- Docker CLI only where public diagnostics still need Docker visibility

Npm package contents:

- public executable shim;
- generated public `dist/` runtime;
- `README.md`;
- `LICENSE`;
- `package.json`;
- explicitly allowed public docs if retained for users.

## File Responsibility Map

Requirements and docs:

- `docs/FR-CMD.md`: exact public command inventory.
- `docs/FR-OPT.md`: exact public option inventory and semantics.
- `docs/FR-VAL.md`: generic parser, missing required option, invalid value, unsupported option, unknown command diagnostics.
- `docs/FR-CONF.md`: env-file and token-only public configuration.
- `docs/FR-DIAG.md`: public `doctor` diagnostics and runtime prerequisites.
- `docs/FR-DATA.md`: Confluence REST acquisition and storage input contracts.
- `docs/FR-OUT.md`: Markdown output and ZIP output.
- `docs/FR-REP.md`: retained report files.
- `docs/FR-RUN.md`: public run lifecycle for `export` and `plan`.
- `docs/FR-LIFE.md`: npm install/update/package content contracts.
- `docs/FR-OBS.md`: observable stdout/stderr/report outcomes.
- `docs/FR-INT.md`: interruption and runtime failure outcomes.
- `README.md`: user-facing install, configuration, usage, prerequisites.
- `docs/release-hygiene.md`: publication checklist.

Public TypeScript runtime:

- `src/main.ts`: public CLI dispatch entrypoint.
- `src/cli/registry.ts`: command and option inventory.
- `src/cli/help.ts`: help rendering from registry.
- `src/cli/parse.ts`: argv tokenization.
- `src/cli/validate.ts`: public invocation validation.
- `src/cli/diagnostics.ts`: governed diagnostic serialization.
- `src/config/env-file.ts`: env-file parsing and source selection.
- `src/config/effective-options.ts`: CLI/env-file/process-env merge.
- `src/prereq/checks.ts`: Node and executable prerequisite probes.
- `src/remote/access.ts`: token-only Confluence REST context and requests.
- `src/commands/doctor.ts`: public diagnostics workflow.
- `src/commands/export-related.ts`: public `export` and `plan` workflow.
- `src/payload/markdown-exporter.ts`: `uvx` converter invocation.
- `src/payload/markdown.ts`: Markdown normalization and remnant diagnostics.
- `src/payload/markdown-localizer.ts`: internal link localization.
- `src/links/internal-target.ts`: supported internal link target parsing.
- `src/output/root.ts`: output root selection and preflight.
- `src/output/page-folder.ts`: page folder layout.
- `src/output/zip.ts`: deterministic ZIP retention.
- `src/output/log-file.ts`: persistent log handling.
- `src/path/format.ts`: path and diagnostic path serialization.
- `src/reports/run-report.ts`: retained public report text.

Public tests:

- `tests/**/*.test.ts`: TypeScript-authored product tests.
- `tests/helpers/**/*.ts`: TypeScript test helpers.
- `tsconfig.test.json`: test compilation config if tests run from compiled output.

Internal verification home:

- Recommended private sibling repository: `../confluex-verification`.
- It owns stand selftest runner, fixtures, golden snapshots, resettable stand contract checks, and all selftest-only tests.
- It depends on the built public CLI artifact or local public package tarball.

Service files that may remain JavaScript:

- `eslint.config.mjs`
- minimal npm executable shim if required by npm execution;
- tool-specific JS config files that contain no product runtime or product test logic.

## Phase 0: Baseline And Safety

**Goal:** Establish the exact starting state before any migration.

**Files:**

- Modify: none.

- [ ] Run current status.

```bash
rtk git status --short --branch
```

Expected: only design/plan documentation changes are present.

- [ ] Run current fast gates.

```bash
rtk npm run lint
rtk npm run typecheck
rtk npm run build
rtk npm run test:node
```

Expected: record exact pass/fail. If a baseline gate fails, stop and debug before migration edits.

- [ ] Run current package inventory check.

```bash
rtk bash -lc 'tmp=$(mktemp); npm pack --dry-run --json > "$tmp" && node -e '\''const fs=require("fs"); const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"))[0]; const files=p.files.map(f=>f.path); console.log(JSON.stringify({entryCount:files.length,hasSelftestAssets:files.some(f=>f.startsWith("tests/")),hasLibRuntime:files.some(f=>f.startsWith("lib/confluex-node/")),hasDist:files.some(f=>f.startsWith("dist/")),hasBin:files.some(f=>f.startsWith("bin/"))},null,2));'\'' "$tmp"; rm -f "$tmp"'
```

Expected: current inventory is documented before cleanup.

- [ ] Commit the design and plan if the user wants documentation committed before implementation.

```bash
rtk git add designs/2026-05-07-confluex-pure-typescript-cleanup-design.md plans/2026-05-07-confluex-pure-typescript-cleanup-implementation.md
rtk git commit -m "docs: plan pure typescript cleanup"
```

Expected: one docs-only commit.

## Phase 1: Requirements Corpus Audit

**Goal:** Make `docs/` describe the positive target product before code changes.

**Files:**

- Read first: `docs/AGENTS.md`
- Modify: `docs/FR-CMD.md`
- Modify: `docs/FR-OPT.md`
- Modify: `docs/FR-VAL.md`
- Modify: `docs/FR-CONF.md`
- Modify: `docs/FR-DIAG.md`
- Modify: `docs/FR-DATA.md`
- Modify: `docs/FR-OUT.md`
- Modify: `docs/FR-REP.md`
- Modify: `docs/FR-RUN.md`
- Modify: `docs/FR-LIFE.md`
- Modify: `docs/FR-OBS.md`
- Modify: `docs/FR-INT.md`
- Modify or remove if fully retired: `docs/FR-SEC.md`

- [ ] Read `docs/AGENTS.md`.

```bash
rtk sed -n '1,220p' docs/AGENTS.md
```

Expected: local docs rules are loaded before editing requirements.

- [ ] Build a requirements inventory.

```bash
rtk rg -n "selftest|config|install|uninstall|--safe|--encrypt|--confidential|--encryption-key|--clear-encryption-key|--verify-encryption|--page-format|HTML|html|gpg|docker|uvx|Markdown|markdown" docs
```

Expected: identify cards to update, retire, or keep as positive target behavior.

- [ ] Update command requirements to the exact public inventory.

Authoritative target: `export`, `plan`, `doctor`.

Expected: command cards define those commands and their help/dispatch behavior; retired command cards are removed or replaced by target inventory cards.

- [ ] Update option requirements to the exact public option inventory.

Expected: option cards define only retained public options and their direct behavior.

- [ ] Update validation requirements.

Expected: validation cards define generic unknown command, unsupported option, missing required option, invalid value, and invalid retained combination behavior. They do not enumerate retired historical options as separate requirements.

- [ ] Update configuration requirements.

Expected: token-only env/env-file model with public configuration inputs only.

- [ ] Update diagnostics requirements.

Expected: `doctor` reports public runtime prerequisites. If encryption is fully retired, `gpg` is not a public prerequisite. `uvx` remains the Markdown converter prerequisite.

- [ ] Update output/data/report/run requirements.

Expected: Markdown output is the public export format. Confluence storage input may be HTML/XML-like storage only as converter input, not as a public output format.

- [ ] Update lifecycle/package requirements.

Expected: package contents describe public executable shim, generated public runtime, README, license, package metadata, and explicitly allowed public docs. Tests, fixtures, internal stand assets, and selftest-only files are private verification artifacts, not npm package artifacts.

- [ ] Run docs residue scans.

```bash
rtk rg -n "selftest|config|install|uninstall|--safe|--encrypt|--confidential|--encryption-key|--clear-encryption-key|--verify-encryption|--page-format|HTML export|html export|gpg" docs
```

Expected: remaining hits are either positive target behavior, migration notes in non-requirement docs, or deliberate Confluence storage-input references.

- [ ] Commit.

```bash
rtk git add docs
rtk git commit -m "docs: define public cli inventory"
```

Expected: requirements-only commit.

## Phase 2: Public CLI Surface Cleanup

**Goal:** Make the executable public CLI expose only `export`, `plan`, and `doctor` with the target option inventories.

**Files:**

- Read first: `lib/AGENTS.md`
- Modify then later migrate: `lib/confluex-node/cli/registry.js`
- Modify then later migrate: `lib/confluex-node/cli/validate.js`
- Modify then later migrate: `lib/confluex-node/cli/parse.js`
- Modify then later migrate: `lib/confluex-node/cli/help.js`
- Modify then later migrate: `lib/confluex-node/main.js`
- Modify tests first: `tests/node/cli-help.test.js`
- Modify tests first: `tests/node/cli-parse.test.js`
- Modify tests first: `tests/node/cli-validation.test.js`
- Modify tests first: `tests/node/cli-subprocess.test.js`

- [ ] Read `lib/AGENTS.md`.

```bash
rtk sed -n '1,220p' lib/AGENTS.md
```

Expected: local runtime rules are loaded before editing `lib/`.

- [ ] Write failing tests for the target command inventory.

Expected test assertions:

- top-level help lists `export`, `plan`, `doctor`;
- `export --help`, `plan --help`, and `doctor --help` render governed sections;
- `config`, `selftest`, `install`, and `uninstall` follow generic unknown-command handling;
- public help contains no retired composite/encryption/selftest options.

- [ ] Run focused failing tests.

```bash
rtk node --test tests/node/cli-help.test.js tests/node/cli-parse.test.js tests/node/cli-validation.test.js tests/node/cli-subprocess.test.js
```

Expected: tests fail on current public surface.

- [ ] Update registry and dispatch.

Expected runtime changes:

- registry contains exactly `export`, `plan`, `doctor`;
- `main.js` dispatches only retained public commands;
- generic unknown-command path handles other command tokens.

- [ ] Update validator option definitions and combinations.

Expected runtime changes:

- retained public options validate as before;
- composite/encryption/config/selftest-specific combinations are gone;
- generic unsupported-option diagnostics handle tokens outside the inventory.

- [ ] Run focused tests until green.

```bash
rtk node --test tests/node/cli-help.test.js tests/node/cli-parse.test.js tests/node/cli-validation.test.js tests/node/cli-subprocess.test.js
```

Expected: pass.

- [ ] Run product command surface scan.

```bash
rtk rg -n "selftest|config|--safe|--encrypt|--confidential|--encryption-key|--clear-encryption-key|--verify-encryption" lib tests/node README.md docs
```

Expected: remaining hits are either not yet migrated private-verification material or planned docs references outside product requirements.

- [ ] Run gates.

```bash
rtk npm run lint
rtk npm run test:node
```

Expected: pass.

- [ ] Commit.

```bash
rtk git add lib tests docs README.md package.json package-lock.json
rtk git commit -m "feat: narrow public cli surface"
```

Expected: one atomic command-surface commit.

## Phase 3: Decommission Encryption And Config State

**Goal:** Remove product encryption-recipient persistence and the now-empty public config workflow.

**Files:**

- Modify/delete: `lib/confluex-node/commands/config.js`
- Modify/delete: `lib/confluex-node/config/store.js`
- Delete if unreferenced: `lib/confluex-node/encryption/archive.js`
- Delete if unreferenced: `lib/confluex-node/encryption/recipient.js`
- Modify: `lib/confluex-node/commands/doctor.js`
- Modify: `lib/confluex-node/commands/export-related.js`
- Modify tests: `tests/node/config-command.test.js`
- Modify tests: `tests/node/default-encryption-key-store.test.js`
- Modify tests: `tests/node/encryption-*.test.js`
- Modify tests: `tests/node/doctor-command.test.js`
- Modify tests: `tests/node/export-related-command.test.js`

- [ ] Write failing tests for the public configuration model.

Expected assertions:

- `doctor` reports only public prerequisites;
- `export` and `plan` do not read saved encryption recipient state;
- retained outputs are Markdown root and optional ZIP/log/report artifacts.

- [ ] Run focused tests.

```bash
rtk node --test tests/node/doctor-command.test.js tests/node/export-related-command.test.js tests/node/cli-validation.test.js
```

Expected: fail before code cleanup.

- [ ] Delete config command implementation and persisted store references.

Expected: no product runtime module reads or writes saved encryption recipient state.

- [ ] Delete encryption runtime only after references are removed.

```bash
rtk rg -n "encrypt|confidential|encryption|gpg|default_encryption" lib tests docs README.md package.json
```

Expected: remaining references are either requirements being updated in this phase or private verification migration notes.

- [ ] Update `doctor` prerequisite list.

Expected: `node_runtime` and `markdown_converter` remain; `docker_cli` remains only if public doctor still inspects public Docker readiness; `gpg` is gone when no public behavior uses it.

- [ ] Run focused tests until green.

```bash
rtk node --test tests/node/doctor-command.test.js tests/node/export-related-command.test.js tests/node/cli-validation.test.js tests/node/cli-subprocess.test.js
```

Expected: pass.

- [ ] Run gates.

```bash
rtk npm run lint
rtk npm run test:node
```

Expected: pass.

- [ ] Commit.

```bash
rtk git add lib tests docs README.md package.json package-lock.json
rtk git commit -m "feat: remove encryption config workflow"
```

Expected: one atomic feature-removal commit.

## Phase 4: Markdown-Only And HTML Residue Audit

**Goal:** Make Markdown the only public export format and remove stale HTML export selection residue.

**Files:**

- Modify: `docs/FR-DATA.md`
- Modify: `docs/FR-OUT.md`
- Modify: `docs/FR-REP.md`
- Modify: `docs/FR-RUN.md`
- Modify: `README.md`
- Modify runtime if scan finds residue: `lib/confluex-node/**`
- Modify tests if scan finds residue: `tests/node/**`

- [ ] Run residue scan.

```bash
rtk rg -n "--page-format|page format|HTML export|html export|dual-format|format=html|page_format|page-format" docs lib tests README.md package.json
```

Expected: identify stale public-format references.

- [ ] Run broad HTML classifier scan.

```bash
rtk rg -n "\\bHTML\\b|\\bhtml\\b" docs lib tests README.md
```

Expected: classify each hit as Confluence storage input, Markdown converter internals, or stale public export wording.

- [ ] Update positive Markdown requirements and docs.

Expected: docs describe Markdown output behavior and Confluence storage input behavior.

- [ ] Update tests and fixtures when stale public-format assertions exist.

Expected: no test expects an operator-selectable HTML export format.

- [ ] Run focused output tests.

```bash
rtk node --test tests/node/export-related-command.test.js tests/node/payload-markdown.test.js tests/node/payload-markdown-exporter.test.js
```

Expected: pass.

- [ ] Commit.

```bash
rtk git add docs lib tests README.md
rtk git commit -m "docs: enforce markdown output model"
```

Expected: one Markdown-only cleanup commit.

## Phase 5: Split Internal Selftest Verification

**Goal:** Move selftest-only code, fixtures, golden snapshots, and stand verification out of public Confluex.

**Files in Confluex:**

- Modify/delete: `lib/confluex-node/commands/selftest.js`
- Move/delete after private copy: `lib/confluex-node/selftest/**`
- Move/delete after private copy: `tests/fixtures/**`
- Move/delete after private copy: `tests/live-bats/**`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `docs/FR-LIFE.md`
- Modify: `docs/FR-CMD.md`
- Modify: `tests/node/selftest-*.test.js`

**Files in private verification repo:**

- Create: `../confluex-verification/package.json`
- Create: `../confluex-verification/src/**`
- Create: `../confluex-verification/tests/**`
- Move/copy then convert: fixtures, golden snapshots, live regression logic, stand reset checks.

- [ ] Create private verification repository if it does not exist.

```bash
rtk bash -lc 'test -d ../confluex-verification && echo exists || mkdir ../confluex-verification'
```

Expected: sibling directory exists. If it becomes a Git repository, keep it private and do not publish it as the public Confluex repo.

- [ ] Copy selftest assets to the private repository before deletion.

```bash
rtk bash -lc 'mkdir -p ../confluex-verification/imported && cp -R tests/fixtures tests/live-bats lib/confluex-node/selftest ../confluex-verification/imported/'
```

Expected: private copy exists before removing public copies.

- [ ] Create a private verification package scaffold.

Expected private package responsibilities:

- run a built Confluex CLI tarball or local executable;
- reset the stand;
- seed fixtures;
- run live export/plan/doctor checks;
- compare golden output;
- run negative auth/page-id/page-access/option tests.

- [ ] Remove public `selftest` dispatch and public selftest runtime from Confluex.

Expected: public Confluex runtime has no `selftest` command implementation.

- [ ] Remove selftest assets from public package allowlist.

Expected `package.json.files` no longer includes `tests/fixtures/` or `tests/live-bats/`.

- [ ] Add public package dry-run test.

Expected assertion:

- package contains public bin and public dist runtime;
- package contains README, license, package metadata;
- package does not contain tests, fixtures, golden snapshots, stand assets, or internal selftest files.

- [ ] Run package dry-run inventory.

```bash
rtk bash -lc 'tmp=$(mktemp); npm pack --dry-run --json > "$tmp" && node -e '\''const fs=require("fs"); const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"))[0]; const files=p.files.map(f=>f.path); console.log(JSON.stringify({entryCount:files.length,hasTests:files.some(f=>f.startsWith("tests/")),hasSelftest:files.some(f=>/selftest/i.test(f)),hasFixtures:files.some(f=>/fixtures|golden|live-bats/.test(f)),hasBin:files.some(f=>f.startsWith("bin/")),hasDist:files.some(f=>f.startsWith("dist/"))},null,2));'\'' "$tmp"; rm -f "$tmp"'
```

Expected: public package inventory matches target.

- [ ] Run gates.

```bash
rtk npm run lint
rtk npm run test:node
```

Expected: pass after public selftest removal.

- [ ] Commit Confluex changes.

```bash
rtk git add lib tests docs README.md package.json package-lock.json
rtk git commit -m "build: split internal selftest assets"
```

Expected: one public repo boundary commit.

- [ ] Commit private verification repo changes if initialized as a repository.

```bash
rtk git -C ../confluex-verification status --short --branch
```

Expected: private repo status reviewed separately.

## Phase 6: TypeScript Toolchain And Strict Lint

**Goal:** Establish strict TypeScript and TypeScript-aware linting before migrating runtime batches.

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tsconfig.json`
- Create: `tsconfig.test.json`
- Create: `eslint.config.mjs`
- Modify/delete: `scripts/lint-js.js`
- Modify/delete: `scripts/lint-shell.js`
- Modify: `.gitignore`

- [ ] Install lint dependencies.

```bash
rtk npm install --save-dev eslint @eslint/js typescript-eslint
```

Expected: `package.json` and `package-lock.json` update.

- [ ] Update TypeScript configs.

Expected `tsconfig.json` settings:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "declaration": true,
    "sourceMap": false
  }
}
```

- [ ] Add test TypeScript config.

Expected: `tsconfig.test.json` compiles `tests/**/*.ts` to `dist-tests/` and references product types.

- [ ] Add ESLint flat config.

Expected: `eslint.config.mjs` uses `@eslint/js`, `typescript-eslint`, strict type-checked configs, project service, and ignores generated directories.

- [ ] Update scripts.

Expected scripts:

```json
{
  "build": "tsc -p tsconfig.json",
  "typecheck": "tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json --noEmit",
  "build:test": "tsc -p tsconfig.test.json",
  "test": "npm run build && npm run build:test && node --test dist-tests/tests/**/*.test.js",
  "lint": "eslint . --max-warnings 0"
}
```

- [ ] Run lint and typecheck.

```bash
rtk npm run lint
rtk npm run typecheck
```

Expected: fail initially if JS/test files are not yet excluded or migrated. Adjust lint scope only to reflect the phased migration, not to hide final product source.

- [ ] Commit.

```bash
rtk git add package.json package-lock.json tsconfig.json tsconfig.test.json eslint.config.mjs scripts .gitignore
rtk git commit -m "build: add strict typescript linting"
```

Expected: tooling-only commit.

## Phase 7: Migrate Public Tests To TypeScript

**Goal:** Convert maintained public product tests from JavaScript to TypeScript.

**Files:**

- Move/modify: `tests/node/*.test.js` to `tests/*.test.ts` or `tests/node/*.test.ts`
- Create/modify: `tests/helpers/*.ts`
- Modify: `tsconfig.test.json`
- Modify: `package.json`

- [ ] Read `tests/AGENTS.md`.

```bash
rtk sed -n '1,220p' tests/AGENTS.md
```

Expected: local test rules are loaded before editing tests.

- [ ] Convert CLI tests first.

Batch files:

- `tests/node/cli-help.test.js`
- `tests/node/cli-parse.test.js`
- `tests/node/cli-validation.test.js`
- `tests/node/cli-subprocess.test.js`

Expected: TypeScript-authored tests compile and pass against current runtime.

- [ ] Run CLI test batch.

```bash
rtk npm run build:test
rtk node --test dist-tests/tests/node/cli-help.test.js dist-tests/tests/node/cli-parse.test.js dist-tests/tests/node/cli-validation.test.js dist-tests/tests/node/cli-subprocess.test.js
```

Expected: pass.

- [ ] Commit CLI test migration.

```bash
rtk git add tests tsconfig.test.json package.json
rtk git commit -m "test: migrate cli tests to typescript"
```

- [ ] Convert command workflow tests.

Batch files:

- `tests/node/doctor-command.test.js`
- `tests/node/export-related-command.test.js`
- report/output/path tests that remain public.

Expected: TypeScript-authored tests compile and pass.

- [ ] Run command workflow test batch.

```bash
rtk npm run build:test
rtk node --test dist-tests/tests/node/doctor-command.test.js dist-tests/tests/node/export-related-command.test.js
```

Expected: pass.

- [ ] Commit command test migration.

```bash
rtk git add tests tsconfig.test.json
rtk git commit -m "test: migrate command tests to typescript"
```

- [ ] Convert payload, remote, output, report, and prereq tests.

Expected: no maintained public product test remains `.js`.

- [ ] Run full test command.

```bash
rtk npm run test
```

Expected: pass.

- [ ] Run JS test source scan.

```bash
rtk rg --files tests | rg '\\.js$'
```

Expected: no maintained public product JavaScript tests.

- [ ] Commit remaining test migration.

```bash
rtk git add tests package.json tsconfig.test.json
rtk git commit -m "test: migrate public tests to typescript"
```

## Phase 8: Migrate Public Runtime To TypeScript

**Goal:** Replace `lib/confluex-node/**` with TypeScript-authored public runtime under `src/**`.

**Files:**

- Create/modify: `src/cli/*.ts`
- Create/modify: `src/config/*.ts`
- Create/modify: `src/prereq/*.ts`
- Create/modify: `src/remote/*.ts`
- Create/modify: `src/commands/*.ts`
- Create/modify: `src/payload/*.ts`
- Create/modify: `src/links/*.ts`
- Create/modify: `src/output/*.ts`
- Create/modify: `src/path/*.ts`
- Create/modify: `src/reports/*.ts`
- Modify: `src/main.ts`
- Delete after migration: `lib/confluex-node/**`

- [ ] Migrate CLI foundation.

Modules:

- `src/cli/diagnostics.ts`
- `src/cli/registry.ts`
- `src/cli/help.ts`
- `src/cli/parse.ts`
- `src/cli/validate.ts`

Expected: exported named types for commands, options, parse results, validation diagnostics.

- [ ] Run CLI tests.

```bash
rtk npm run build
rtk npm run build:test
rtk node --test dist-tests/tests/node/cli-help.test.js dist-tests/tests/node/cli-parse.test.js dist-tests/tests/node/cli-validation.test.js
```

Expected: pass.

- [ ] Commit CLI runtime migration.

```bash
rtk git add src tests tsconfig.json package.json
rtk git commit -m "refactor: migrate cli runtime to typescript"
```

- [ ] Migrate configuration and prereq modules.

Modules:

- `src/config/env-file.ts`
- `src/config/effective-options.ts`
- `src/prereq/checks.ts`

Expected: `unknown` external values are narrowed before product use.

- [ ] Run config/prereq tests.

```bash
rtk npm run test
```

Expected: pass.

- [ ] Commit config/prereq migration.

```bash
rtk git add src tests
rtk git commit -m "refactor: migrate config prerequisites to typescript"
```

- [ ] Migrate remote and payload modules.

Modules:

- `src/remote/access.ts`
- `src/payload/markdown-exporter.ts`
- `src/payload/markdown.ts`
- `src/payload/markdown-localizer.ts`
- `src/links/internal-target.ts`

Expected: token-only auth preserved; `uvx` invocation remains typed and child env sanitizes retired auth inputs.

- [ ] Run remote/payload tests.

```bash
rtk npm run test
```

Expected: pass.

- [ ] Commit remote/payload migration.

```bash
rtk git add src tests
rtk git commit -m "refactor: migrate payload runtime to typescript"
```

- [ ] Migrate output, report, and command workflows.

Modules:

- `src/output/root.ts`
- `src/output/page-folder.ts`
- `src/output/zip.ts`
- `src/output/log-file.ts`
- `src/path/format.ts`
- `src/reports/run-report.ts`
- `src/commands/doctor.ts`
- `src/commands/export-related.ts`
- `src/main.ts`

Expected: public `export`, `plan`, and `doctor` run from TypeScript-authored runtime.

- [ ] Run full gates.

```bash
rtk npm run lint
rtk npm run typecheck
rtk npm run build
rtk npm run test
```

Expected: pass.

- [ ] Delete migrated `lib/confluex-node/**`.

```bash
rtk rg -n "lib/confluex-node|\\.\\./lib/confluex-node|require\\(" src tests bin package.json README.md docs
```

Expected: no public runtime dependency on old CommonJS modules.

- [ ] Commit runtime migration.

```bash
rtk git add src lib tests bin package.json package-lock.json tsconfig.json
rtk git commit -m "refactor: migrate public runtime to typescript"
```

## Phase 9: Public Entrypoint And Package Boundary

**Goal:** Make npm package contents public-only and installable without tests or selftest assets.

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `bin/confluex.js` or replace with generated shim strategy
- Modify: `confluex`
- Modify: `.gitignore`
- Modify: `README.md`
- Modify: `docs/FR-LIFE.md`
- Modify: `docs/release-hygiene.md`

- [ ] Decide executable shim shape.

Expected: either a tiny checked-in JS shim that imports public `dist/main.js`, or a TypeScript-authored shim compiled into `dist/` with npm `bin` pointing at generated output.

- [ ] Update `package.json.files`.

Expected: allowlist contains public package files only.

- [ ] Add or update package dry-run test.

Expected test asserts package inventory is the positive publication inventory.

- [ ] Run package dry-run.

```bash
rtk bash -lc 'tmp=$(mktemp); npm pack --dry-run --json > "$tmp" && node -e '\''const fs=require("fs"); const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"))[0]; const files=p.files.map(f=>f.path); console.log(JSON.stringify({entryCount:files.length,files,hasTests:files.some(f=>f.startsWith("tests/")),hasLib:files.some(f=>f.startsWith("lib/")),hasSelftest:files.some(f=>/selftest|fixtures|golden|live-bats/i.test(f)),hasBin:files.some(f=>f.startsWith("bin/")),hasDist:files.some(f=>f.startsWith("dist/")),hasReadme:files.includes("README.md"),hasPackage:files.includes("package.json")},null,2));'\'' "$tmp"; rm -f "$tmp"'
```

Expected: package inventory matches target.

- [ ] Run installed tarball smoke.

```bash
rtk bash -lc 'tmpdir=$(mktemp -d); trap '\''rm -rf "$tmpdir"'\'' EXIT; npm pack --pack-destination "$tmpdir" >/dev/null; npm install --prefix "$tmpdir/prefix" -g "$tmpdir"/confluex-*.tgz >/dev/null; "$tmpdir/prefix/bin/confluex" --help; "$tmpdir/prefix/bin/confluex" doctor --help'
```

Expected: installed public CLI runs help and doctor help.

- [ ] Commit.

```bash
rtk git add package.json package-lock.json bin confluex docs README.md .gitignore tests
rtk git commit -m "build: publish public package contents"
```

Expected: one package-boundary commit.

## Phase 10: Private Verification Selftest Coverage

**Goal:** Ensure internal TypeScript selftest verifies the public package and all public command/option behavior against the stand.

**Files in private repo `../confluex-verification`:**

- Create/modify: `package.json`
- Create/modify: `tsconfig.json`
- Create/modify: `eslint.config.mjs`
- Create/modify: `src/runner.ts`
- Create/modify: `src/stand/reset.ts`
- Create/modify: `src/fixtures/**`
- Create/modify: `src/golden/**`
- Create/modify: `tests/**/*.test.ts`

- [ ] Build private runner around public CLI artifact.

Expected runner inputs:

- `--cli <path>`;
- `--url <stand-base-url>`;
- `--token <stand-token>`;
- optional `--work-root <path>`.

- [ ] Add public command coverage.

Expected selftest scenarios:

- `confluex export --page-id <fixture-root>`;
- `confluex plan --page-id <fixture-root>`;
- `confluex doctor`;
- `confluex doctor --page-id <fixture-root>`.

- [ ] Add public option coverage.

Expected matrix covers every public option from the target inventory at least once.

- [ ] Add negative coverage.

Expected scenarios:

- missing required `--page-id`;
- invalid page id;
- invalid numeric limits;
- unsupported command token;
- unsupported option token;
- token rejection;
- inaccessible page;
- output root conflict;
- resume without compatible root;
- ZIP conflict.

- [ ] Add stand lifecycle coverage.

Expected:

- reset succeeds;
- fixture seed succeeds;
- export succeeds;
- golden comparison succeeds.

- [ ] Run private verification against resettable stand.

```bash
rtk bash -lc 'cd ../confluex-verification && npm run lint && npm run typecheck && npm run test'
```

Expected: private verification unit tests pass.

- [ ] Run live private selftest.

```bash
rtk bash -lc 'cd ../confluex-verification && npm run selftest -- --cli ../confluex/confluex --url http://127.0.0.1:8090 --token "$CONFLUEX_STAND_TOKEN"'
```

Expected: passed result. If token is not available in the environment, start the local resettable stand and read the token inside the shell without printing it.

- [ ] Commit private verification repo if initialized as Git.

```bash
rtk git -C ../confluex-verification status --short --branch
```

Expected: review private repo changes separately from public Confluex.

## Phase 11: README And Operator Documentation

**Goal:** Align user-facing docs with the final public product.

**Files:**

- Modify: `README.md`
- Modify: `docs/release-hygiene.md`
- Modify: public docs under `docs/` as needed

- [ ] Update README command list.

Expected: README describes `export`, `plan`, and `doctor` only.

- [ ] Update README option examples.

Expected: examples use exact public option inventory and token-only configuration.

- [ ] Update prerequisites.

Expected: Node.js `>=20.11.0` and `uvx` are documented. Docker is documented only for internal release verification if public `doctor` no longer reports Docker.

- [ ] Update package content documentation.

Expected: README explains user install/update/uninstall through npm and does not present internal selftest as a user workflow.

- [ ] Run docs scans.

```bash
rtk rg -n "selftest|config|--safe|--encrypt|--confidential|--encryption-key|--clear-encryption-key|--verify-encryption|--page-format|HTML export|html export" README.md docs
```

Expected: remaining hits are deliberate private verification notes or Confluence storage-input references.

- [ ] Commit.

```bash
rtk git add README.md docs
rtk git commit -m "docs: update public operator guide"
```

Expected: docs-only commit.

## Phase 12: Final Repository Cleanup

**Goal:** Ensure no old maintained JavaScript product source, no selftest public leakage, and no package leakage remain.

**Files:**

- Modify/delete based on scans.

- [ ] Run source inventory scan.

```bash
rtk bash -lc 'node - <<'\''NODE'\''\nconst {execFileSync}=require("node:child_process");\nconst files=execFileSync("rg",["--files"],{encoding:"utf8"}).trim().split(/\\n/).filter(Boolean);\nconst js=files.filter(f=>f.endsWith(".js") && !f.startsWith("dist/") && !["eslint.config.mjs"].includes(f));\nconsole.log(JSON.stringify({js},null,2));\nNODE'
```

Expected: only service JS or minimal executable shim remains outside generated `dist/`.

- [ ] Run legacy surface scan.

```bash
rtk rg -n "selftest|--safe|--encrypt|--confidential|--encryption-key|--clear-encryption-key|--verify-encryption|default_encryption|gpg|--page-format|HTML export|html export|lib/confluex-node" . -g '!node_modules' -g '!dist' -g '!dist-tests'
```

Expected: remaining hits are allowed service docs or internal planning docs, not public product runtime/docs.

- [ ] Run package dry-run inventory.

```bash
rtk bash -lc 'tmp=$(mktemp); npm pack --dry-run --json > "$tmp" && node -e '\''const fs=require("fs"); const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"))[0]; const files=p.files.map(f=>f.path); const bad=files.filter(f=>f.startsWith("tests/")||f.startsWith("lib/")||/selftest|fixtures|golden|live-bats|confluence-stand/i.test(f)); console.log(JSON.stringify({entryCount:files.length,bad,files},null,2));'\'' "$tmp"; rm -f "$tmp"'
```

Expected: `bad` is empty.

- [ ] Run full public gates.

```bash
rtk npm run lint
rtk npm run typecheck
rtk npm run build
rtk npm run test
rtk npm pack --dry-run --json
```

Expected: all pass.

- [ ] Run private live selftest gate.

```bash
rtk bash -lc 'cd ../confluex-verification && npm run selftest -- --cli ../confluex/confluex --url http://127.0.0.1:8090 --token "$CONFLUEX_STAND_TOKEN"'
```

Expected: passed result. If the environment variable name is standardized differently in the private repo, use that exact documented name and do not print the token.

- [ ] Commit final cleanup.

```bash
rtk git add .
rtk git commit -m "chore: finalize public repository cleanup"
```

Expected: final cleanup commit if scans required edits.

## Phase 13: Publication Readiness

**Goal:** Prepare for npm publication without publishing in this phase.

**Files:**

- Modify: `package.json`
- Modify: `README.md`
- Modify: `docs/release-hygiene.md`

- [ ] Verify package metadata.

Expected:

- publishable package name is selected;
- version is correct;
- license is public-publishable;
- repository URL is correct;
- `files` allowlist is exact;
- `bin` points to installed public executable.

- [ ] Run npm identity checks outside secrets.

```bash
rtk npm whoami
rtk npm view confluex name version --json
```

Expected: `npm whoami` succeeds for the publishing account. `npm view confluex` either returns package metadata or `E404` if the unscoped name is still available.

- [ ] Run final tarball smoke.

```bash
rtk bash -lc 'tmpdir=$(mktemp -d); trap '\''rm -rf "$tmpdir"'\'' EXIT; npm pack --pack-destination "$tmpdir" >/dev/null; npm install --prefix "$tmpdir/prefix" -g "$tmpdir"/confluex-*.tgz >/dev/null; "$tmpdir/prefix/bin/confluex" --help; "$tmpdir/prefix/bin/confluex" doctor --help'
```

Expected: installed CLI works from tarball.

- [ ] Commit publication metadata if changed.

```bash
rtk git add package.json package-lock.json README.md docs/release-hygiene.md
rtk git commit -m "build: prepare npm publication"
```

Expected: commit only if metadata or docs changed.

## Final Program Gates

Run these before declaring the program complete:

```bash
rtk npm run lint
rtk npm run typecheck
rtk npm run build
rtk npm run test
rtk bash -lc 'tmp=$(mktemp); npm pack --dry-run --json > "$tmp" && node -e '\''const fs=require("fs"); const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"))[0]; const files=p.files.map(f=>f.path); const bad=files.filter(f=>f.startsWith("tests/")||f.startsWith("lib/")||/selftest|fixtures|golden|live-bats|confluence-stand/i.test(f)); console.log(JSON.stringify({entryCount:files.length,bad},null,2)); process.exit(bad.length === 0 ? 0 : 1);'\'' "$tmp"; rm -f "$tmp"'
rtk bash -lc 'cd ../confluex-verification && npm run lint && npm run typecheck && npm run test'
```

Run one live stand verification before publication:

```bash
rtk bash -lc 'cd ../confluex-verification && npm run selftest -- --cli ../confluex/confluex --url http://127.0.0.1:8090 --token "$CONFLUEX_STAND_TOKEN"'
```

Expected: public gates pass, package inventory is clean, private verification passes, live stand verification passes.

## Suggested Commit Sequence

1. `docs: plan pure typescript cleanup`
2. `docs: define public cli inventory`
3. `feat: narrow public cli surface`
4. `feat: remove encryption config workflow`
5. `docs: enforce markdown output model`
6. `build: split internal selftest assets`
7. `build: add strict typescript linting`
8. `test: migrate cli tests to typescript`
9. `test: migrate command tests to typescript`
10. `test: migrate public tests to typescript`
11. `refactor: migrate cli runtime to typescript`
12. `refactor: migrate config prerequisites to typescript`
13. `refactor: migrate payload runtime to typescript`
14. `refactor: migrate public runtime to typescript`
15. `build: publish public package contents`
16. `docs: update public operator guide`
17. `chore: finalize public repository cleanup`
18. `build: prepare npm publication`

## Self-Review Checklist

- [ ] Every design goal maps to at least one phase.
- [ ] The plan keeps requirements positive by using exact target inventories.
- [ ] The plan separates public Confluex from private selftest verification.
- [ ] The plan keeps `uvx` in scope for this phase and does not replace the Markdown converter.
- [ ] The plan requires TypeScript-authored product source and tests.
- [ ] The plan allows service JavaScript configs and a tiny npm shim when appropriate.
- [ ] The plan requires full docs audit and README synchronization.
- [ ] The plan includes package dry-run and tarball install smoke.
- [ ] The plan includes private live stand verification before publication.
- [ ] The plan includes frequent atomic commits.
