# Confluex

`confluex` is a token-authenticated CLI for exporting Confluence pages to
Markdown.

Use it when you want to export a Confluence page tree, preview the same scope
before materializing payload files, or diagnose whether the local environment and
Confluence page access are ready.

## Public Command Surface

The public top-level commands are:

- `export`: materialize a Markdown export.
- `plan`: build the same scope and reports without page payload or attachment
  downloads.
- `doctor`: report local prerequisites, token configuration, optional page
  access, support profile, and supported link forms.

## Prerequisites

You need:

- Node.js `>=20.11.0`.
- `uvx` on `PATH` for the Markdown converter runtime.
- A Confluence base URL and personal access token.

Install the packaged CLI with npm:

```bash
npm install -g confluex
```

Update and uninstall use npm as well:

```bash
npm install -g confluex@latest
npm uninstall -g confluex
```

For local development, use `npm install` in the repository and run the local
entrypoint or package bin. Package verification uses the same npm shape
operators install:

```bash
npm install
npm run build
npm pack --dry-run
npm pack
npm install -g ./confluex-*.tgz
confluex --help
confluex doctor --help
confluex doctor
```

The public npm package contains the executable shim, generated public `dist/`
runtime, `README.md`, `LICENSE`, and `package.json`.

## Configuration

Confluex uses token-only Confluence access. Set public configuration through the
process environment or an env file:

```bash
CONFLUEX_CONFLUENCE_BASE_URL=https://confluence.example
CONFLUEX_CONFLUENCE_TOKEN=your-token
```

The default env file is `./.confluex.env`. Supplying `--env-file <file>` selects
only that file for the invocation. Command-line option values take precedence
over env-file values; env-file values take precedence over process environment
values.

Public configuration keys are:

- `CONFLUEX_CONFLUENCE_BASE_URL`
- `CONFLUEX_CONFLUENCE_TOKEN`
- `CONFLUEX_OUTPUT_ROOT`
- `CONFLUEX_LOG_FILE`
- `CONFLUEX_MAX_PAGES`
- `CONFLUEX_MAX_DOWNLOAD_MIB`
- `CONFLUEX_SLEEP_MS`
- `CONFLUEX_MAX_FIND_CANDIDATES`
- `CONFLUEX_LINK_DEPTH`

## First Run

Check local readiness:

```bash
confluex doctor
```

Check access to a page:

```bash
confluex doctor --page-id 12345
```

Preview the export scope:

```bash
confluex plan --page-id 12345 --out ./plan
```

Materialize the Markdown export:

```bash
confluex export --page-id 12345 --out ./dump
```

Create a ZIP archive beside the plain output root:

```bash
confluex export --page-id 12345 --out ./dump --zip
```

## Public Options

`export` supports:

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

`plan` supports:

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

`doctor` supports:

- `--page-id <id>`
- `--env-file <file>`
- `--log-file <file>`

`--page-id <id>` is required for `export` and `plan`, and optional for page
access diagnostics in `doctor`.

`--out <path>` selects the plain output root for `export` and `plan`. If it is
omitted, Confluex generates an output root. `CONFLUEX_OUTPUT_ROOT` can also
select the output root when `--out` is omitted.

`--resume` is supported only by `export`, requires `--out <path>`, and reuses a
compatible prior export output root when possible.

`--no-fail-fast` requests best-effort page processing for `export` and `plan`.
Without it, page-scoped failures use fail-fast processing.

`--keep-metadata` retains per-page metadata artifacts. In `export`, page payload
remains Markdown. In `plan`, metadata can be retained without materializing page
payload or downloaded attachments.

`--zip` is supported only by `export` and requests a ZIP archive beside the
plain output root after the retained plain output root is complete.

`--log-file <file>` writes a persistent log artifact. `CONFLUEX_LOG_FILE` can
also select the log path when `--log-file` is omitted.

Run-control options can also be selected from their matching public
configuration keys:

- `--max-pages <n>`
- `--max-download-mib <n>`
- `--sleep-ms <n>`
- `--max-find-candidates <n>`
- `--link-depth <n>`

## Scope

The run scope includes:

- the root page;
- the full recursive child tree of the root page;
- linked Confluence pages discovered through supported internal reference forms
  up to the effective `--link-depth`.

The run does not automatically include:

- descendants of a linked page unless they are separately discovered;
- pages reachable only through links beyond the effective `--link-depth`;
- external links;
- internal-looking constructs outside the supported profile.

By default, `--link-depth 1` includes direct links from root-tree pages but does
not expand links inside those linked pages.

`doctor` reports the supported link forms for the current public support
profile. When Confluex sees an internal-looking construct outside that profile,
or when scope knowledge is partial, it records that in reports instead of
claiming full trust.

## Output Layout

`export` produces Markdown payload and reports:

```text
dump/
  pages/
    space__454E47/
      page__100/
        page.md
        attachments/
  manifest.tsv
  resolved-links.tsv
  unresolved-links.tsv
  failed-pages.tsv
  scope-findings.tsv
  summary.txt
```

`plan` produces the same top-level reports without `page.md` and without
downloaded attachment payloads. With `--keep-metadata`, plan can retain
metadata snapshots for processed pages.

With `--zip`, `export` also creates a ZIP archive beside the plain output root.
The plain output root remains available for inspection and recovery.

If you rerun with `--resume`, the same explicit output root is reused
intentionally when it is compatible. Reports are regenerated for the new run,
while compatible already materialized page payload can be reused page by page.

## Reading Results

Start with `summary.txt`. Important fields include:

- `final_status`
- `blocking_reasons`
- `scope_trust`
- `processed_pages`
- `resume_mode`
- `reused_pages`
- `fresh_pages`
- `resolved_links`
- `unresolved_links`
- `failed_operations`
- `incomplete`
- `interrupt_reason`
- `zip_path`
- `support_profile`

`final_status` values are:

- `success`: no blocking condition was recorded.
- `success_with_findings`: the run finished with blocking reasons to review.
- `incomplete`: a configured stop condition or runtime failure left the run
  incomplete.
- `interrupted`: the operator interrupted the run.

Exit codes are:

- `0`: success, success with findings, completed `doctor`, or help.
- `1`: rejected invocation.
- `3`: configured stop condition.
- `4`: runtime failure or accepted `doctor` runtime failure.
- `130`: interrupted by signal.

Other report files:

- `manifest.tsv`: processed pages and retained folder paths.
- `resolved-links.tsv`: source-to-target links resolved to pages.
- `unresolved-links.tsv`: discovered links that did not resolve to one page.
- `failed-pages.tsv`: page-local failures.
- `scope-findings.tsv`: conditions that reduce scope confidence.

## Interrupts And Limits

If a run hits `--max-pages` or `--max-download-mib`, `summary.txt` marks the run
as incomplete and records the stop reason.

If an `export` run is interrupted after the output root exists, the retained
plain output root remains on disk and is marked interrupted. If a `plan` run is
interrupted, the plan cleanup branch governs whether a partial root remains.

To continue a compatible partial export, rerun the same root page with the same
explicit `--out <path>` and add `--resume`.

## Troubleshooting

### `doctor` reports an unsupported Node runtime

Use Node.js `>=20.11.0`.

### `doctor` reports a missing Markdown converter

Install `uvx` and ensure it is on `PATH`.

### `doctor --page-id` reports missing configuration

Set `CONFLUEX_CONFLUENCE_BASE_URL` and `CONFLUEX_CONFLUENCE_TOKEN` in the
process environment or selected env file.

### The run stopped earlier than expected

Open `summary.txt` and inspect `final_status`, `blocking_reasons`,
`interrupt_reason`, and `scope_trust`.

### The page you expected is missing

Check `manifest.tsv`, `unresolved-links.tsv`, `scope-findings.tsv`, and
`failed-pages.tsv`.

## Contract

The requirements corpus lives under [`docs/`](docs/). Read
[`docs/AGENTS.md`](docs/AGENTS.md) first, then the relevant `FR-<AREA>.md`
files. Product behavior is defined only in `FR-<AREA>.md`.
