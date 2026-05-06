# Confluex

`confluex` is a token-authenticated CLI for exporting Confluence pages to
Markdown.

Use it when you want to export a Confluence page tree without manually chaining `confluence` commands, guessing which linked pages were included, or reverse-engineering whether the result is complete enough to trust.

## What You Get

`confluex` can:

- export a root page and its full recursive child tree;
- follow supported internal page references found in page content;
- materialize page payload as Markdown plus attachments in `export`;
- build the same scope without materialized page payload or attachment downloads in `plan`;
- write machine-readable reports about exported pages, unresolved links, failures, and degraded scope;
- optionally package the final result as ZIP;
- optionally encrypt the final result for a GPG recipient.

What it does not do:

- it does not use username/password Basic auth for Confluence access;
- it does not create or import GPG keys;
- it does not claim universal support for every possible Confluence storage construct.

## Before You Start

You need:

- `node`;
- a Confluence base URL and personal access token;
- `gpg`, only if you want encrypted output.

Operational baseline:

- Node.js 20.11.0 or newer;
- `uvx` for the external Markdown converter;
- Docker CLI for local stand/selftest diagnostics;
- GnuPG 2.x if you want encrypted output.

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
entrypoint or package bin.

Package verification uses the same npm shape operators install:

```bash
npm install
npm run build
npm pack --dry-run
npm pack
npm install -g ./confluex-*.tgz
confluex --help
confluex doctor --help
```

## First-Time Setup

1. Verify that the environment is usable:

```bash
confluex doctor
```

2. Verify access to the root page you care about:

```bash
confluex doctor --page-id 12345
```

Set Confluence access with environment variables or a selected env file:

```bash
CONFLUEX_CONFLUENCE_BASE_URL=https://confluence.example
CONFLUEX_CONFLUENCE_TOKEN=your-token
```

The default env file is `./.confluex.env`; `--env-file FILE` selects only that
file. CLI options override env-file values, and env-file values override the
process environment.

3. If you plan to encrypt exports, verify the recipient before the first real run:

```bash
confluex doctor --verify-encryption --encryption-key 0123456789ABCDEF0123456789ABCDEF01234567
```

4. If you want a default encryption recipient, save it once:

```bash
confluex config --encryption-key 0123456789ABCDEF0123456789ABCDEF01234567
```

`config` stores only the recipient identity string. It does not import or validate key material by itself.

## Minimal Workflow

If you just want the shortest safe path:

1. Check the environment:

```bash
confluex doctor --page-id 12345
```

2. Build a no-payload preview:

```bash
confluex plan --page-id 12345 --out ./plan --safe
```

3. Inspect `./plan/summary.txt`.

Use this quick decision rule:

- continue to `export` if `final_status=success`;
- inspect `unresolved-links.tsv` and `scope-findings.tsv` before continuing if `final_status=success_with_findings`;
- stop and fix the situation first if `final_status=policy_failed`, `incomplete`, `interrupted`, or `encryption_failed`.

4. If the plan result looks acceptable, run the real export:

```bash
confluex export --page-id 12345 --out ./dump --safe
```

5. For critical usage, prefer:

```bash
confluex export --page-id 12345 --out ./dump --critical
```

That path is enough for most normal usage.

## Choosing The Right Mode

### `doctor`

Use `doctor` before a first run, after environment changes, or before a critical export.

It checks:

- local command availability;
- version or capability hints for `node`, `confluence`, and `gpg` where available;
- whether `confluence` CLI is reachable;
- page access, if `--page-id` is given;
- encryption-recipient availability, if `--verify-encryption` is requested;
- the current support profile and supported link forms.

Examples:

```bash
confluex doctor
confluex doctor --page-id 12345
confluex doctor --verify-encryption --encryption-key 0123456789ABCDEF0123456789ABCDEF01234567
```

### `plan`

Use `plan` when you want to understand scope without materializing page
Markdown or attachment payloads.

`plan` still:

- checks the root page;
- walks the same page graph as `export`;
- parses storage XML;
- resolves supported internal links;
- writes the same run-level reports.

`plan` does not persist page payload files or downloaded attachments.

Example:

```bash
confluex plan --page-id 12345 --out ./plan --safe
```

### `export`

Use `export` when you want the actual payload:

- exported page payload (`page.md`);
- downloaded attachments;
- report files and `summary.txt`.
- optional recovery from an earlier partial export through `--resume`.

Example:

```bash
confluex export --page-id 12345 --out ./dump --safe
```

## Choosing Safety And Confidentiality Flags

### `--safe`

Use `--safe` for routine production work when you want conservative defaults without fully fail-closed behavior.

It applies these defaults unless you override them explicitly:

- `--max-find-candidates 5`
- `--max-pages 200`
- `--max-download-mib 256`
- `--sleep-ms 200`

`--safe` reduces risk. It does not guarantee semantic completeness.

If you skip `--safe`, add an explicit positive `--max-pages` or `--max-download-mib` limit for routine work. Unbounded non-safe runs are expert mode and warn explicitly.

### `--critical`

Use `--critical` for fail-closed usage.

It:

- implies `--safe`;
- forbids `--no-fail-fast`;
- exits non-zero if unresolved links remain;
- exits non-zero if scope findings remain;
- exits non-zero if page-local failures remain;
- exits non-zero if the run ends incomplete.

Use it when a "usable but imperfect" result is worse than an explicit blocked result.

### `--confidential`

Use `--confidential` when encryption is mandatory and plain exported payload artifacts must not remain on disk if encryption fails.

It:

- implies `--critical`;
- requires an effective encryption key;
- requires that key, whether passed explicitly or loaded from saved config, to be provided as a full 40-hex GPG fingerprint;
- removes the plain payload if encryption fails;
- does not promise removal of every plaintext operational trace such as stderr output or a separately configured persistent log file.

Use it only when the machine already has the target public key in its GPG keyring.

### `--encrypt`

Use `--encrypt` when you want an encrypted final artifact while keeping standard-mode recovery semantics if encryption itself fails.

Pair it with `--encryption-key` to override the recipient for the current run, or save a default recipient once with `confluex config --encryption-key ...`.

## Common Commands

Normal export:

```bash
confluex export --page-id 12345 --out ./dump
```

Conservative export:

```bash
confluex export --page-id 12345 --out ./dump --safe
```

Critical export:

```bash
confluex export --page-id 12345 --out ./dump --critical
```

Best-effort export:

```bash
confluex export --page-id 12345 --out ./dump --no-fail-fast
```

Use `--no-fail-fast` only when partial collection is still useful.
Do not treat it as the normal mode for critical or trust-sensitive exports.

Keep metadata files for debugging:

```bash
confluex export --page-id 12345 --out ./dump --keep-metadata --log-file ./confluex.log
```

Encrypted export:

```bash
confluex export --page-id 12345 --out ./dump --encrypt --encryption-key 0123456789ABCDEF0123456789ABCDEF01234567
```

Confidential encrypted export:

```bash
confluex export --page-id 12345 --out ./dump --confidential --encryption-key 0123456789ABCDEF0123456789ABCDEF01234567
```

Resume a previous partial export without redownloading already materialized page payload when possible:

```bash
confluex export --page-id 12345 --out ./dump --resume
```

Planning run:

```bash
confluex plan --page-id 12345 --out ./plan --safe
```

Limit total work explicitly:

```bash
confluex export --page-id 12345 --out ./dump --max-pages 50 --max-download-mib 100 --sleep-ms 500
```

Inspect or clear the saved encryption key:

```bash
confluex config
confluex config --clear-encryption-key
```

## Options You Will Actually Care About

- `--page-id ID`: required for `export` and `plan`, optional for page-access checks in `doctor`.
- `--out DIR`: explicit output directory. If omitted, `confluex` generates one.
- `--safe`: conservative defaults.
- `--critical`: fail-closed mode.
- `--encrypt`: request encrypted output delivery.
- `--confidential`: encrypted fail-closed mode that removes plaintext on encryption failure.
- `--resume`: only for `export`, continue from an existing explicit output directory and reuse prior page payload when safe.
- `--no-fail-fast`: continue after page-local failures.
- `--keep-metadata`: persist `_info.txt`, `_storage.xml`, and in `plan` also `_attachments_preview.txt`.
- `--zip`: only for `export`, retain a ZIP archive beside the plain output root.
- `--env-file FILE`: read configuration from this env file instead of `./.confluex.env`.
- `--log-file FILE`: write a persistent log file.
- `--encryption-key KEY`: use this GPG recipient for the current run.
- `--clear-encryption-key`: only for `config`, remove the saved default encryption key.
- `--verify-encryption`: only for `doctor`.
- `--max-pages N`: stop after `N` processed pages.
- `--max-download-mib N`: stop after `N` MiB downloaded in total.
- `--sleep-ms N`: pause between processed pages.
- `--max-find-candidates N`: bound title-resolution fan-out.
- `--link-depth N`: follow supported internal links up to `N` hops from the root child tree. Default: `1`; `0` disables link-driven scope expansion.

If you provide `--out`, that path must not already exist unless you are intentionally continuing a previous export with `--resume`.

`--resume` rules:

- only valid with `confluex export`;
- requires an explicit `--out`;
- `--out` must already exist and contain a prior `manifest.tsv` and `summary.txt`;
- the prior `summary.txt` must describe a compatible export for the same root page and support profile;
- manifest folder entries used for reuse must stay inside the active output root;
- reuses page payload only when the prior run already materialized that page's export payload;
- still rebuilds traversal, page metadata, and link discovery from the root page again.

If you omit `--out`, `confluex` creates:

- `confluence_dump_<page_id>_<timestamp>` for `export`;
- `confluence_plan_<page_id>_<timestamp>` for `plan`.

## What Gets Exported

The run scope includes:

- the root page;
- the full recursive child tree of the root page;
- linked Confluence pages discovered through supported internal reference forms up to the effective `--link-depth`.

The run does not automatically include:

- descendants of a linked page, unless they are separately discovered;
- pages reachable only through links beyond the effective `--link-depth`;
- external links;
- arbitrary internal-looking constructs outside the supported profile.

By default, `--link-depth 1` keeps the previous bounded behavior: direct links from root-tree pages are included, but links inside those linked pages are not expanded. Use `--link-depth 2` or higher only when the linked-page graph is intentionally part of the export scope.

Currently supported internal discovery forms include:

- child tree results from `confluence children`;
- `ri:content-id`;
- `ri:page` title references;
- macro page parameters;
- internal `href` references carrying `pageId`;
- internal `href` references carrying a resolvable `space/title` path;
- `ri:url` references carrying a resolvable `pageId`;
- `ri:url` references carrying a resolvable `space/title` path.

When the tool sees an internal-looking construct outside this profile, or when scope knowledge is only partial, it records that explicitly instead of pretending the run is fully trusted.

## Output Layout

Typical `export` result:

```text
dump/
  pages/
    ENG/
      Root_Page__100/
        page.md
        attachments/
  manifest.tsv
  resolved-links.tsv
  unresolved-links.tsv
  failed-pages.tsv
  scope-findings.tsv
  summary.txt
```

Typical `plan` result has the same top-level reports, but no `page.md` and no downloaded attachments.

By default metadata files are not persisted. With `--keep-metadata`, page folders also include:

- `_info.txt`
- `_storage.xml`
- `_attachments_preview.txt` in `plan`

If encryption succeeds:

- the plain output directory is removed;
- `<out>.tar.gz.gpg` is created;
- `<out>.tar.gz.gpg.txt` is created with decrypt/extract commands.

If you rerun with `--resume`, the same output root is reused intentionally. `manifest.tsv`, `resolved-links.tsv`, `unresolved-links.tsv`, `failed-pages.tsv`, `scope-findings.tsv`, and `summary.txt` are regenerated for the new run, while already materialized page payload may be reused page-by-page.

## How To Read The Result

### Start With `summary.txt`

This is the first file to check after every run.

Important fields:

- `final_status`
- `blocking_reasons`
- `scope_trust`
- `scope_findings`
- `processed_pages`
- `resume_mode`
- `resume_schema_version`
- `reused_pages`
- `fresh_pages`
- `resolved_links`
- `unresolved_links`
- `failed_operations`
- `incomplete`
- `interrupt_reason`
- `encryption_enabled`
- `encryption_successful`
- `support_profile`

### `final_status`

The important values are:

- `success`: no blocking condition was recorded.
- `success_with_findings`: the run finished, but unresolved links or scope findings remain.
- `policy_failed`: the run completed enough to be interpretable, but `--critical` blocked it.
- `incomplete`: the run stopped early because of a runtime limit or error.
- `interrupted`: the operator interrupted the run.
- `encryption_failed`: the export finished but final encryption did not succeed.

### Exit Codes

`confluex` keeps `summary.txt` as the detailed diagnostic surface, but the command exit status is also stable enough for automation:

- `0`: success
- `2`: critical policy failure (`final_status=policy_failed`)
- `3`: configured stop condition such as `--max-pages` or `--max-download-mib`
- `4`: runtime failure during export processing (`final_status=incomplete` with `interrupt_reason=runtime_error`)
- `5`: encryption failure, including missing or unavailable recipients detected in preflight
- `130`: interrupted by signal

### `blocking_reasons`

This explains why a result is not a clean success.

Common values:

- `unresolved_links`
- `scope_findings`
- `failed_operations`
- combinations of those

### `scope_trust`

- `trusted`: no machine-readable reason to doubt the supported-scope interpretation was recorded.
- `degraded`: the run is still readable, but you should not assume semantic completeness blindly.

### Recovery Fields

- `resume_mode=1` means the run intentionally reused an existing explicit output root.
- `reused_pages` tells you how many page payloads were carried forward from the earlier run instead of being downloaded again.
- `fresh_pages` tells you how many page payloads were materialized during the current rerun.

If `resume_mode=1` but `reused_pages=0`, then the rerun did not actually avoid any page payload downloads.

### Other Important Reports

`manifest.tsv`

- one row per processed page;
- tells you which pages were included;
- includes a portable relative folder path.

`resolved-links.tsv`

- shows which content references were resolved to actual pages.

`unresolved-links.tsv`

- shows links that looked relevant but could not be resolved safely.

`failed-pages.tsv`

- shows page-local operations that failed, such as `info`, `edit`, or `export`.

`scope-findings.tsv`

- shows why the run is not fully trusted, for example unsupported internal-looking references, partial title inspection, child traversal uncertainty, or parse failures.

## Encryption

If you use `--encryption-key`, prefer a full fingerprint.

You can:

- save a default key with `confluex config --encryption-key ...`;
- override that saved key per run with `--encryption-key`;
- verify recipient availability with `confluex doctor --verify-encryption`.

When encryption is enabled for `export` or `plan` with `--encrypt` or `--confidential`, `confluex` validates the effective recipient before traversal begins. A missing or unavailable recipient fails the run before page payload is materialized.

To decrypt an encrypted result:

```bash
gpg --output dump.tar.gz --decrypt dump.tar.gz.gpg
tar -xzf dump.tar.gz
```

One-shot variant:

```bash
gpg --decrypt dump.tar.gz.gpg > dump.tar.gz && tar -xzf dump.tar.gz
```

If `--confidential` was used and encryption fails, inspect process stderr, the persistent log file if you used `--log-file`, and `<out>.status.txt` if present. Plain payload artifacts are intentionally removed in that mode, but plaintext operational traces outside the payload can still remain.

## Interrupts, Limits, And Early Stops

If a run hits `--max-pages` or `--max-download-mib`, or if a runtime error stops it, `summary.txt` marks the run as incomplete and sets `interrupt_reason`.

If the partial result is still useful and you want to continue later, rerun the same root export with the same `--out` plus `--resume`. That recovery flow is meant specifically to avoid needless redownload of page payload that was already materialized successfully.

If you interrupt an `export` with `Ctrl+C`:

- already-written artifacts remain on disk;
- the result is marked incomplete/interrupted.

If you interrupt a `plan` with `Ctrl+C`:

- the temporary output directory is removed.

## Running The Functional Test Suite

The only supported full regression entrypoint is:

```bash
confluex selftest --url http://127.0.0.1:8090 --token test-token
```

It expects an already-running, clean Confluence 7.13.7 stand, applies the
project-owned fixture dataset, runs the governed live regression entrypoint,
and writes the self-test report. The stand reset lifecycle is managed through
the local stand reset API used by selftest.

There is no mock-backed regression suite.

## Linting

Linting and typechecking run through npm scripts.

Install the JS linter dependencies once:

```bash
npm install
```

Run the checks:

```bash
npm run lint
npm run typecheck
```

## Support Boundary

`confluex` is intentionally conservative.

It is designed to be:

- predictable;
- explicit about degraded trust;
- safe for critical usage when `--critical` or `--confidential` are chosen appropriately.

It is not designed to promise universal parsing of every possible Confluence storage variation. The supported profile is bounded and intentionally surfaced by `doctor`, `summary.txt`, and `scope-findings.tsv`.

If your workflow cannot tolerate bounded support plus explicit degraded-scope signaling, you should validate the specific target content model before relying on the tool operationally.

## Troubleshooting

### `doctor` fails

Check that:

- `node` is installed;
- `confluence` CLI is installed and authenticated;
- the page id is valid and accessible;
- the GPG recipient exists locally if `--verify-encryption` is requested.

### The run stopped earlier than expected

Open `summary.txt` first and inspect:

- `final_status`
- `blocking_reasons`
- `interrupt_reason`
- `scope_trust`

### The page you expected is missing

Check:

- `manifest.tsv`
- `unresolved-links.tsv`
- `scope-findings.tsv`
- `failed-pages.tsv`

### The export is usable but not clean

If `final_status=success_with_findings`, the run completed but you still need to review the findings before treating it as semantically clean.

For critical workflows, rerun with `--critical` so those conditions become explicit blockers.

## Contract And Tests

The requirements corpus lives under [`docs/`](docs/). Read
[`docs/AGENTS.md`](docs/AGENTS.md) first, then the relevant `FR-<AREA>.md`
files. Product behavior is defined only in `FR-<AREA>.md`.

The live black-box assertions live under `tests/selftest/`, and all retained
test assets live under `tests/`.
