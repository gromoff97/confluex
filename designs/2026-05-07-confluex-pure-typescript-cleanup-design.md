# Confluex Pure TypeScript And Legacy Surface Cleanup Design

Date: 2026-05-07

## Context

Confluex is currently npm-packageable and has a TypeScript entrypoint, but most
runtime code still lives as CommonJS JavaScript under `lib/confluex-node/`.
Tests and lint helpers are also still JavaScript. This creates a mixed codebase:
TypeScript checks only the package shell, while the behavior-heavy runtime is
outside the type system.

The product surface also still contains options and commands that no longer fit
the desired direction. Confluex does not need backward compatibility for legacy
behavior. If an option is a composite alias, leads mostly to validation errors,
or exists only to preserve old workflows, it should be removed rather than kept
as a hidden fallback.

## Goals

- Move maintained product source code to TypeScript.
- Remove the old CommonJS runtime as a maintained source layer.
- Keep generated JavaScript only as build output under `dist/`.
- Move maintained product tests to TypeScript, including internal selftest tooling that
  lives outside the public Confluex repository.
- Define the public CLI as a small exact command and option surface.
- Decommission legacy and composite CLI surface instead of preserving
  compatibility.
- Keep selftest-only code out of the publishable/public Confluex repository.
- Keep token-only Confluence access.
- Keep full live verification through the resettable Confluence stand.
- Define Markdown as the only public export format.
- Ensure internal selftest coverage exercises all retained public options,
  important option combinations, and negative paths.
- Audit the complete `docs/` requirement corpus and align it to CIRCUS MATTA
  style and current product behavior.
- Update README and related operator documentation to match the final command
  surface, prerequisites, package contents, and verification workflow.
- Add TypeScript-aware linting with zero warnings and zero errors.
- Make type failures fail fast during local and release verification.

## Non-Goals

- Do not publish to npm in this phase.
- Do not replace the external Markdown converter in this phase.
- Do not keep deprecated aliases for removed commands or options.
- Do not preserve backward compatibility for removed invocation shapes.
- Do not rewrite repository history as part of this migration.
- Do not remove the resettable Confluence stand requirement.
- Do not make the public Confluex repository own Confluence stand code,
  selftest fixtures, golden snapshots, or selftest-only test harnesses.

## Commit Policy

Work should be split into small, atomic commits. Commit after each coherent
unit of change, such as:

- requirements alignment;
- command-surface removal;
- TypeScript runtime migration batch;
- TypeScript test migration batch;
- lint/tooling upgrade;
- selftest/private verification split;
- documentation/README synchronization;
- package-content cleanup.

Prefer more commits over fewer commits. Do not batch unrelated behavior,
requirement, tooling, and documentation changes into one large commit when they
can be reviewed independently.

## Target Runtime Shape

The product source should become TypeScript-first:

- `src/` owns maintained product runtime code.
- `bin/confluex` or `bin/confluex.js` is a minimal executable shim only.
- `dist/` contains generated JavaScript and declarations after `npm run build`.
- `lib/confluex-node/` is removed after its modules have been migrated.
- Source `.js` files are removed from maintained public runtime and scripts.
- Source `.js` files are removed from maintained public tests.
- Existing package entrypoints continue to execute built code from `dist/`.

Generated JavaScript is acceptable only as build output. It must not become a
second maintained implementation.

Service files are not product source. Existing JavaScript config files, package
tooling config, or a tiny npm executable shim may remain JavaScript when that is
the natural format for the tool and the file does not contain product runtime or
product test logic.

Selftest implementation is no longer part of the public repository shape. It
should move to private/internal release-verification tooling or a separate
non-public repository that can depend on the public CLI package. That internal
selftest implementation should also be TypeScript-source, not JavaScript.

## Command Surface

The target top-level commands are:

- `export`
- `plan`
- `doctor`

Requirements should describe this exact public command inventory and the
accepted behavior for each command. Use one authoritative exact inventory
instead of retired-behavior cards. Old commands are decommissioned by retiring
their old cards, deleting their code paths, and keeping generic unknown-command
handling for any token outside the current inventory.

## Public Option Surface

The public option inventory is defined by direct behavior, not presets or
aliases:

- `export` supports:
  `--page-id`, `--out`, `--resume`, `--no-fail-fast`, `--keep-metadata`,
  `--zip`, `--env-file`, `--log-file`, `--max-pages`,
  `--max-download-mib`, `--sleep-ms`, `--max-find-candidates`, and
  `--link-depth`.
- `plan` supports:
  `--page-id`, `--out`, `--no-fail-fast`, `--keep-metadata`, `--env-file`,
  `--log-file`, `--max-pages`, `--max-download-mib`, `--sleep-ms`,
  `--max-find-candidates`, and `--link-depth`.
- `doctor` supports:
  `--page-id`, `--env-file`, and `--log-file`.

Requirements should describe this exact public option inventory and each
option's accepted behavior. Use one authoritative exact inventory instead of
retired-behavior cards. Old options are decommissioned by retiring their old
cards, deleting their code paths, and keeping generic unsupported-option
handling for any option outside the current inventory.

If implementation review finds another option that only expands to other
options, has no direct product behavior, or exists mainly to reject users,
decommission it and update the authoritative command/option inventories.

## Legacy Decommissioning Work

The migration must delete code, docs, tests, requirements, and examples for
legacy surfaces that are outside the target inventories. This includes the
former safe preset, encryption-recipient persistence, public selftest command
surface, install/uninstall lifecycle commands, and HTML export selection.

The saved default encryption recipient store is decommissioned with its
persistence, diagnostics, command handling, tests, and documentation.
Encryption-related runtime helpers that exist only for the decommissioned
surface should also be deleted.

Public-repository selftest assets and stand-only support files move out of
Confluex. This includes checked-in fixtures, golden snapshots, live Bats
entrypoints, selftest report builders, selftest Confluence clients, and runtime
modules used only by selftest.

`gpg` is a runtime prerequisite only if remaining public product behavior uses
it. If encryption behavior is fully decommissioned, `doctor` should report the
remaining public prerequisites only.

The product format model is Markdown-only. Requirements should state Markdown
output behavior and Confluence storage input behavior. HTML storage may still
appear where it is Confluence input storage consumed by the Markdown converter;
the public export format is Markdown.

## Authentication

Confluence access remains token-only:

- `CONFLUEX_CONFLUENCE_BASE_URL`
- `CONFLUEX_CONFLUENCE_TOKEN`
- `Authorization: Bearer <token>`

Child process environments should be built from the public configuration model:
base URL, token, and tool-specific controls. Legacy username/password inputs are
decommissioned with the old auth model.

The resettable Confluence stand remains required for internal release
verification. Internal verification tooling owns the stand interaction outside
the public Confluex repository and npm package.

## Markdown Conversion

The external Markdown converter remains in scope for this phase. `uvx` is still
a runtime prerequisite while the product invokes `confluence-markdown-exporter`.

This design deliberately does not replace the converter. Removing `uvx` should
be designed separately because it changes Markdown fidelity, golden snapshots,
and export failure modes.

## TypeScript Strictness

`tsconfig.json` should remain strict and become stricter where practical:

- `strict: true`
- `noUncheckedIndexedAccess: true`
- `exactOptionalPropertyTypes: true`
- `noImplicitOverride: true`
- `noFallthroughCasesInSwitch: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `forceConsistentCasingInFileNames: true`

The migration should avoid `any`. Temporary `unknown` boundaries are acceptable
only at external inputs such as CLI argv, environment variables, filesystem
bytes, process results, JSON parsing, and HTTP responses. Those boundaries must
be narrowed before values enter product logic.

Public module interfaces should use explicit exported types. Command runners,
validators, report builders, Confluence clients, and payload converters should
have named input and result types.

## Linting

Add TypeScript-aware ESLint using flat config and `typescript-eslint` typed
rules. The lint command should fail on warnings:

```bash
eslint . --max-warnings 0
```

Use type-aware strict configurations, including strict type-checked rules. The
linter should reject unsafe type escapes, unhandled promises, unused code,
implicit `any`, and untyped error-prone access patterns.

Keep shell linting only for shell files that remain. If no maintained shell
files remain, remove the shell lint helper.

## Requirements And Documentation

Audit every requirement file under `docs/`, following local `docs/AGENTS.md`
rules. Bring the corpus into CIRCUS MATTA shape where it is not already aligned:
clear authority, independent testability, exact tokens, deterministic ordering,
exact value semantics, and no duplicated ownership.

Requirements should be written as positive target-state obligations: the public
commands, public options, accepted workflows, generated artifacts, package
contents, diagnostics, and supported configuration sources. Use exact
inventories and retired-card cleanup instead of retired-behavior FR cards. Legacy
disappears because the authoritative inventories are exact and the
implementation is reduced to those inventories.

Update requirements before or alongside behavior changes:

- command surface requirements, using the exact public command inventory;
- option semantics requirements;
- validation requirements;
- diagnostics requirements;
- configuration requirements;
- lifecycle/package requirements and public repository contents;
- data/output/report requirements for Markdown-only output and retained
  artifacts;
- README examples and prerequisites.

Requirements, code, tests, README, package contents, and public repository
contents must agree after the migration.

README and related operator docs must be updated for:

- public install and package contents;
- supported commands and options;
- token-only configuration;
- `uvx` as the still-required Markdown converter prerequisite;
- internal release verification being separate from user workflows.

## Testing Strategy

The migration is behavior-preserving except for intentional legacy removals and
the removal of public selftest from Confluex. Product tests that remain in the
public Confluex repository must be migrated to TypeScript rather than deleted
unless their covered behavior is removed. Selftest-only tests and fixtures
should move to private/internal verification tooling instead of remaining in the
public Confluex repository, and that internal tooling must also use TypeScript
for maintained test code.

Internal selftest coverage must explicitly exercise:

- every public command in the exact public inventory;
- every public option in the exact public inventory;
- meaningful public option combinations;
- missing required option failures;
- unsupported command and unsupported option failures;
- invalid value failures;
- token auth success and token auth rejection;
- inaccessible page and malformed page-id failures;
- stand reset, fixture seed, export, and golden comparison success;
- public CLI help and validation snapshots that exactly match the target
  command and option inventories.

Coverage evidence should be documented in a migration matrix or equivalent
review artifact so removed tests are traceable to replacement coverage or to
removed behavior.

Required verification:

```bash
npm run lint
npm run typecheck
npm run build
npm run test
npm pack --dry-run --json
```

`npm run test` must execute TypeScript-authored tests. If tests are run from
compiled output, the source of truth remains `.ts`; checked-in maintained
JavaScript tests are not acceptable.

Before publishing, run a full live selftest against the resettable Confluence
stand from private/internal verification tooling:

```bash
<internal-selftest-runner> --cli <built-confluex> --url <stand-base-url> --token <stand-token>
```

The selftest must reset the stand, seed fixtures, run live regression, compare
golden output, and finish with an explicit passed result. The selftest runner,
fixtures, and golden snapshots are not public Confluex artifacts.

## Release Hygiene

Do not publish in this phase. Package dry-run is still required because the
migration changes source layout and package contents.

The public repository and npm package contain the publication inventory:
TypeScript-authored public source as appropriate for the repository, generated
public `dist/` JavaScript for the npm package, the public executable shim,
README, license, package metadata, and explicitly allowed public docs.

Release hygiene verifies the positive publication inventory: public runtime,
public executable shim, README, license, package metadata, and any other
explicitly allowed public docs. It should also run defensive scans for legacy
residue, local paths, internal tooling references, secrets, and unexpected
binaries before publication.

## Open Implementation Notes

- Choose whether executable shim source is TypeScript-generated or a tiny
  checked-in JavaScript shim. The product goal is no old JavaScript runtime; a
  minimal npm bin shim may remain only if npm execution needs it.
- Decide the private/internal home for selftest and stand verification assets
  before deleting them from the public Confluex repository.
- Decide whether TypeScript tests run directly through a TS-aware runner or run
  from compiled test output. In both cases, the maintained test source is
  TypeScript.
- Re-evaluate every remaining option during implementation. Remove options that
  are aliases, composite presets, or validation-only leftovers.
