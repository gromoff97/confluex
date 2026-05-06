# Confluex Cleanup And Distribution Design

Date: 2026-05-06

## Context

Confluex has outgrown the current mixed runtime and test shape. The codebase
still contains Basic-auth concepts, HTML export mode, shell wrappers, Bats
tests, scattered test assets, stale install documentation, and requirements
that no longer match the intended product.

The target product is a TypeScript-first CLI that exports Confluence pages to
Markdown, can be installed and updated normally, can be configured through CLI
options or env files, and is verified through a real Confluence test stand.

## Goals

- Use token-only Confluence authentication everywhere.
- Remove the user-facing concept of password.
- Keep Markdown as the only page payload format.
- Add optional ZIP packaging for export results.
- Provide concise default diagnostics for auth, network, and page-access
  failures.
- Replace shell/Bash scripting where practical with TypeScript or Node-based
  tooling.
- Move test-related assets under `tests/`.
- Make maintained regression run through `confluex selftest` against a real
  stand, including positive and negative cases.
- Add a stand reset mechanism so selftest does not require deleting and
  recreating containers.
- Support a default env file and explicit `--env-file`.
- Make CLI options override env-file values.
- Align install, update, uninstall, and package layout with common npm package
  conventions.
- Validate runtime prerequisites before relying on them.
- Keep requirements, README, code, and tests synchronized.
- Remove obsolete behavior instead of keeping deprecated aliases or fallback
  code.

## Non-Goals

- Do not add unauthenticated production Confluence access.
- Do not keep deprecated compatibility for removed options unless a requirement
  explicitly forces a temporary bridge.
- Do not keep unit/Bats tests as the long-term product-regression layer.
- Do not remove current tests before equivalent selftest coverage exists.
- Do not require Docker container deletion as the normal stand reset path.
- Do not invent nonstandard npm packaging when the official package model is
  enough.

## Authentication

Real Confluence commands use:

```text
CONFLUEX_CONFLUENCE_BASE_URL
CONFLUEX_CONFLUENCE_TOKEN
```

REST calls send:

```text
Authorization: Bearer <token>
```

Remove and do not accept:

```text
CONFLUEX_CONFLUENCE_USERNAME
CONFLUEX_CONFLUENCE_PASSWORD
--login
--password
```

`selftest` also uses token-oriented inputs. Preferred shape:

```text
confluex selftest --url <url> --token <token>
```

If the stand needs changes to support token-oriented selftest, those changes
belong to this work.

## Proxy Handling

Confluex should not require users to edit shell profile proxy exports.

For Confluence access, Confluex should bypass inherited proxy variables by
default unless a future requirement defines explicit proxy opt-in. Child
processes used for Confluence payload acquisition must receive a sanitized
environment without:

```text
http_proxy
https_proxy
HTTP_PROXY
HTTPS_PROXY
all_proxy
ALL_PROXY
```

Public package installation and operator-managed npm/uvx tooling may still use
the user's normal proxy configuration.

## Env File

Confluex supports a canonical default env file and an explicit env-file option.

Canonical default file:

```text
./.confluex.env
```

Rules:

- If `./.confluex.env` exists and `--env-file` is not supplied, Confluex reads
  `./.confluex.env`.
- If `--env-file <file>` is supplied, Confluex reads only that file and ignores
  `./.confluex.env`.
- CLI options override values loaded from the selected env file.
- If no env file is selected, CLI options alone may satisfy required inputs.
- Env-file values do not create hidden fallbacks for missing required options;
  after merging, required effective options must still fail fast when absent.
- Secret values from env files are never logged.

Effective precedence:

```text
CLI option > selected env file > process environment > no value
```

Every supported CLI option that makes sense outside help should have an env
equivalent. The requirements must define exact names, accepted values, and
absence semantics.

## Markdown-Only Export

Remove HTML payload export as a product feature:

- remove `--page-format html`;
- remove `page.html` as a normal payload artifact;
- remove HTML golden data and HTML regression cases;
- update help and README to present Markdown as the only page payload format;
- keep diagnostics for HTML-like remnants inside generated Markdown if they
  help detect poor conversion quality.

Storage snapshots such as `_storage.xml` are separate metadata/debug artifacts
and are not an HTML payload mode.

## ZIP Packaging

Add:

```text
confluex export --page-id <id> --zip
```

`--zip` creates a `.zip` archive after export output is complete. The archive
contains the retained export content, reports, attachments, and metadata that
are present in the output root.

Initial behavior:

- keep the plain output root by default;
- record the ZIP path in summary/report output;
- use deterministic file ordering inside the archive;
- fail clearly if ZIP creation fails;
- define exact precedence with `--encrypt` before implementing combined use.

## Diagnostics And Logging

Default diagnostics must be concise but useful. No separate debug flag is
required for normal auth/page-access troubleshooting.

Default diagnostics should include:

- command phase;
- page id or endpoint class;
- `auth_mode=token`;
- whether proxy variables were ignored for Confluence access;
- HTTP status code when available;
- Confluence/Tomcat auth hints when present, including `X-Seraph-LoginReason`
  and `WWW-Authenticate`;
- network error class when no HTTP response exists;
- a concrete next action when known.

Default diagnostics must not include:

- token values;
- `Authorization` header values;
- cookies;
- full response bodies;
- full process environments;
- repeated noisy copies of the same failure.

## Legacy Deletion Policy

Removed behavior is deleted, not kept as deprecated compatibility.

Remove obsolete:

- password-oriented options and env names;
- HTML page-format code paths;
- stale docs for older runtime assumptions;
- dead directories such as empty Docker leftovers;
- shell wrappers and shell helpers when TypeScript/Node can own the behavior;
- old tests once equivalent selftest coverage exists.

Do not keep hidden aliases or fallback code. If something cannot be deleted
safely, stop and document the blocker instead of leaving it silently.

## Shell Removal And TypeScript Direction

The target runtime is TypeScript-first.

Remove shell scripting where practical:

- replace Bash wrappers with npm `bin` entrypoints backed by Node/TypeScript;
- replace shell lint and shell helper scripts with npm scripts or TypeScript
  utilities where practical;
- replace Bats product regression with selftest cases;
- keep shell only where it is the smallest unavoidable boundary, and document
  why it remains.

CLI invocation should follow npm package conventions:

- package exposes a `bin` entry named `confluex`;
- installed users run `confluex ...`;
- local development may run `npm run build` and `node dist/...` or npm package
  bin links, depending on the final package layout.

TypeScript migration must include:

- `tsconfig`;
- source/output layout;
- typecheck script;
- TypeScript-aware lint;
- npm package `files` allowlist;
- install verification against built output;
- no checked-in build output unless the packaging decision explicitly requires
  it.

## Test Layout

Everything test-related lives under `tests/`.

Move or keep under `tests/`:

- fixtures;
- expected data;
- golden snapshots;
- seed data;
- stand-specific regression helpers;
- comparison scripts;
- selftest assets;
- negative-case data.

The repository root should not contain standalone test fixtures or test helper
directories.

## Selftest-Only Regression Target

The long-term product-regression suite runs through:

```text
confluex selftest
```

Selftest must execute against the real stand and cover both positive and
negative cases:

- valid token;
- invalid token;
- inaccessible page;
- malformed page id;
- proxy-variable bypass;
- Markdown export;
- ZIP packaging;
- legacy option rejection;
- env-file precedence;
- install/update/uninstall smoke;
- report/logging contracts;
- stand reset.

Unit tests, Bats tests, and similar standalone tests are temporary migration
scaffolding only. Delete them after selftest covers the same requirement.

The implementation plan must include a migration matrix:

```text
old test class -> selftest case -> covered requirement ids -> deletion status
```

Static checks remain outside selftest because they are code-quality gates, not
product-regression tests.

## Stand Reset

`confluence-stand` should reset to a clean ready baseline without deleting
containers or volumes.

Acceptable shapes:

- local-only HTTP reset endpoint;
- stand-local reset command inside the running container;
- another explicit local stand API that selftest can call.

Reset must:

- restore database and Confluence home to a prepared baseline;
- preserve patched runtime/image bits;
- return a clear success/failure signal;
- be safe for local testing only;
- avoid normal Docker delete/recreate cycles.

Once available, selftest uses reset before applying fixtures.

## NPM Packaging And Distribution

Use the normal npm package model.

Package conventions to follow:

- `package.json` has a valid lowercase package name and version.
- `bin` maps the `confluex` command to the built CLI entrypoint.
- `files` allowlists publishable runtime files.
- README explains usage.
- package contents are reviewed before publish to avoid secrets and irrelevant
  files.
- local package install is tested with `npm install /path/to/package` or a
  packed tarball before publishing.
- scoped public packages use `npm publish --access public`; unscoped public
  packages use `npm publish`.
- publishing requires npm account/auth policy compatible with npm 2FA or token
  requirements.

Installation docs must include:

- fresh install;
- update existing install;
- uninstall;
- local development install;
- prerequisites;
- how to validate the installed tool.

Preferred user-facing install target:

```text
npm install -g <package-name>
```

Preferred update:

```text
npm install -g <package-name>@latest
```

Preferred uninstall:

```text
npm uninstall -g <package-name>
```

The existing `confluex install` and `confluex uninstall` commands must either
be aligned with the npm package story or removed from the public command
surface. Do not keep two competing installation models unless requirements
define their relationship.

Reference npm documentation used for this packaging direction:

- [package.json `bin`, `files`, `engines`, and package metadata](https://docs.npmjs.com/cli/v11/configuring-npm/package-json)
- [Creating and publishing scoped public packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/)
- [Creating and publishing unscoped public packages](https://docs.npmjs.com/creating-and-publishing-unscoped-public-packages)
- [npm config files and `.npmrc`](https://docs.npmjs.com/cli/v11/configuring-npm/npmrc)

## Prerequisite Validation

Confluex validates required prerequisites before relying on them.

Validate at least:

- supported Node version;
- required runtime dependencies available through the package;
- `uvx` or replacement Markdown converter availability if still external;
- reachable Confluence base URL when a network command needs it;
- token presence for token-required commands;
- ZIP support when `--zip` is selected;
- stand reset capability when selftest requires reset.

Validation failures should produce concise errors with next actions. They must
not fail later as incidental stack traces.

## History Cleanup Before Publication

Before pushing or publishing, repository history must not contain forbidden
internal planning paths or references. This is a release hygiene requirement.

Required verification:

```text
git log --all --name-only
git grep -I -n -i <forbidden-pattern> $(git rev-list --all)
```

If forbidden references are present, rewrite history before publication. This
step must be performed only when explicitly approved for that phase.

## Requirement Updates

Update requirements before or together with behavior changes.

Required areas:

- command surface;
- option semantics;
- env-file precedence;
- token-only configuration;
- diagnostics and logging;
- Markdown-only payload output;
- ZIP artifacts;
- install/update/uninstall lifecycle;
- npm package distribution;
- prerequisite validation;
- selftest phases;
- stand reset;
- interruption/failure semantics;
- report fields.

Requirement cards must remain self-contained, testable, and mutually
consistent.

## Verification Strategy

Every phase must run relevant quality gates.

Minimum static gates:

- lint;
- typecheck after TypeScript migration;
- package dry-run or equivalent package-content check;
- install smoke after packaging changes.

Minimum live gates:

- selftest positive cases;
- selftest negative cases;
- real stand reset;
- real Markdown export;
- real ZIP export;
- real token auth failure diagnostics.

If a required gate cannot run, the phase result must state exactly what was not
run and why.

## Rollout Order

1. Update requirements for token-only, env-file, Markdown-only, ZIP, install,
   selftest, and stand reset.
2. Add env-file parser and precedence model.
3. Convert auth to token-only.
4. Improve default diagnostics.
5. Remove HTML payload mode.
6. Add ZIP packaging.
7. Add stand reset capability.
8. Expand selftest to cover positive and negative product behavior.
9. Move test assets under `tests/`.
10. Delete replaced unit/Bats tests using the migration matrix.
11. Move runtime toward TypeScript and remove shell where practical.
12. Align package metadata with npm conventions.
13. Implement install/update/uninstall documentation and validation.
14. Remove obsolete install model if npm distribution supersedes it.
15. Run full quality and selftest gates.
16. Perform explicitly approved history cleanup before publication.

## Self-Review

- Password is removed as a product concept.
- Env-file precedence is explicit.
- Unit/Bats deletion is gated by selftest coverage.
- Static quality gates remain even after product regression moves to selftest.
- NPM package guidance follows official npm concepts: `package.json`, `bin`,
  `files`, local install testing, scoped/unscoped publish differences, and
  publish authentication requirements.
- History cleanup is documented as a future approved phase, not an action to
  perform implicitly.
