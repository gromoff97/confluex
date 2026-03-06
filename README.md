# Confluex

`confluex` exports a Confluence page tree, downloads attachments, parses page storage XML, and pulls in linked Confluence pages that are referenced from page content.

## What It Does

- exports the full child tree of a root page
- downloads page HTML and attachments
- follows supported internal page links found in page content
- writes reports about exported, unresolved, and failed pages
- supports a safe planning mode before a real export

## Requirements

- `bash`
- `node`
- `confluence` CLI installed and already configured

## Install

Install to the default user location:

```bash
./confluex install
```

Install to a custom directory:

```bash
./confluex install --install-dir /usr/local/bin
```

Uninstall:

```bash
confluex uninstall
```

Or with an explicit location:

```bash
confluex uninstall --install-dir /usr/local/bin
```

`uninstall` is idempotent: if nothing is installed there, it reports that nothing was removed.

## Quick Start

Check your environment:

```bash
confluex doctor
```

Check access to a specific root page:

```bash
confluex doctor --page-id 12345
```

Build a plan without downloading HTML or attachments:

```bash
confluex plan --page-id 12345 --out ./plan
```

Run a full export:

```bash
confluex export --page-id 12345 --out ./dump
```

Run an encrypted export for a GPG recipient:

```bash
confluex export --page-id 12345 --out ./dump --encrypt-for you@example.com
```

Run a more conservative export:

```bash
confluex export --page-id 12345 --out ./dump --safe
```

Legacy syntax is still supported:

```bash
confluex --page-id 12345 --out ./dump
```

## Main Commands

### `export`

Performs a real export:

- exports page HTML
- downloads attachments
- follows supported internal links
- writes reports

Example:

```bash
confluex export --page-id 12345 --out ./dump
```

### `plan`

Dry-run mode:

- walks the same graph
- parses storage XML
- resolves links
- does not download HTML
- does not download attachments

Example:

```bash
confluex plan --page-id 12345 --out ./plan
```

### `doctor`

Checks:

- required local commands
- `confluence` CLI availability
- page access, if `--page-id` is provided

Examples:

```bash
confluex doctor
confluex doctor --page-id 12345
```

### `install`

Copies the script and libraries into an install directory.

Options:

- `--install-dir DIR`: target directory for the installed `confluex` binary
- `--install`: direct flag alias for `install`

### `uninstall`

Removes the installed script and its `lib/confluex` directory from the selected install root.

Options:

- `--install-dir DIR`: uninstall from a custom install location
- `--uninstall`: direct flag alias for `uninstall`

## Options

### Required For `export` And `plan`

- `--page-id ID`: root Confluence page id to process

### Output

- `--out DIR`: explicit output directory for reports and exported pages

If `--out` is not given, `confluex` generates a directory automatically:

- export: `confluence_dump_<page_id>_<timestamp>`
- plan: `confluence_plan_<page_id>_<timestamp>`

If the generated name already exists, `confluex` adds a numeric suffix.

If an explicit `--out` already exists, `confluex` stops with an error.

### Safety

- `--safe`: applies conservative defaults for production usage
- `--max-pages N`: stop after `N` processed pages
- `--max-download-mib N`: stop after `N` MiB downloaded in total
- `--sleep-ms N`: sleep `N` milliseconds between processed pages
- `--max-find-candidates N`: cap title-resolution fan-out for `confluence find`

`--safe` applies these defaults unless you override them explicitly:

- `--max-find-candidates 5`
- `--max-pages 200`
- `--max-download-mib 256`
- `--sleep-ms 200`

### Behavior

- `--no-fail-fast`: continue after page-local failures instead of aborting the whole run
- `--keep-metadata`: persist page metadata files in output
- `--log-file FILE`: write a persistent run log to `FILE`
- `--encrypt-for KEY`: create `<out>.tar.gz.gpg` for GPG recipient `KEY` and remove the plain output directory after successful encryption

### Generic

- `-h`, `--help`: show command usage and examples

`--no-fail-fast`:

- best-effort mode
- continues after page-local failures

`--keep-metadata`:

- keeps `_info.txt`
- keeps `_storage.xml`
- in `plan`, also keeps `_attachments_preview.txt`

Without `--keep-metadata`, those files are not persisted in output.

## Command Reference

### `confluex export`

Use when you want a real export.

Typical options:

- `--page-id ID`
- `--out DIR`
- `--safe`
- `--no-fail-fast`
- `--keep-metadata`
- `--log-file FILE`
- `--encrypt-for KEY`

### `confluex plan`

Use when you want to inspect what would be exported without downloading HTML and attachments.

Typical options:

- `--page-id ID`
- `--out DIR`
- `--safe`
- `--keep-metadata`
- `--log-file FILE`

### `confluex doctor`

Use when you want to verify the local setup.

Typical options:

- no options: verify local commands only
- `--page-id ID`: also verify access to a specific page

### `confluex install`

Use when you want `confluex` available from anywhere in the shell.

Typical options:

- `--install-dir DIR`

### `confluex uninstall`

Use when you want to remove a prior self-installation.

Typical options:

- `--install-dir DIR`

## What Gets Exported

`confluex` exports:

- the root page
- the full recursive child tree of the root page
- linked Confluence pages found in supported internal link forms

`confluex` does not automatically export:

- descendants of a linked page, unless they are also in the root tree or linked independently
- external links
- non-page objects that merely contain `id`-like fields

## Supported Internal Link Forms

- child tree results from `confluence children`
- `ri:content-id`
- `ri:page` title links
- macro page parameters
- internal `href` links containing `pageId`

## Output Structure

Typical export output:

```text
dump/
  pages/
    ENG/
      Root_Page__100/
        page.html
        attachments/
  manifest.tsv
  resolved-links.tsv
  unresolved-links.tsv
  failed-pages.tsv
  summary.txt
```

If `--encrypt-for` is used and encryption succeeds:

- `dump/` is removed
- `dump.tar.gz.gpg` is created
- `dump.tar.gz.gpg.txt` is created with decrypt/unpack commands

## Reports

### `manifest.tsv`

One row per processed page:

- page id
- space
- title
- folder
- discovery source
- mode
- attachment count

### `resolved-links.tsv`

Resolved semantic dependencies between pages.

### `unresolved-links.tsv`

Links that were detected but could not be resolved safely.

### `failed-pages.tsv`

Page-local failures such as:

- `info`
- `edit`
- `export`

### `summary.txt`

Operational summary, including:

- command
- mode
- output directory
- processed page counts
- root/tree/linked breakdown
- resolved and unresolved link counts
- failure counts
- downloaded bytes
- incomplete status

## Interrupt Behavior

If you interrupt a real export with `Ctrl+C`:

- already written data stays on disk
- `INCOMPLETE` is written
- `summary.txt` marks the run as incomplete

If you interrupt a plan run with `Ctrl+C`:

- the plan output directory is removed

## Examples

Export normally:

```bash
confluex export --page-id 12345 --out ./dump
```

Export with best-effort behavior:

```bash
confluex export --page-id 12345 --out ./dump --no-fail-fast
```

Export and keep metadata for debugging:

```bash
confluex export --page-id 12345 --out ./dump --keep-metadata --log-file ./confluex.log
```

Export and encrypt for a GPG recipient:

```bash
confluex export --page-id 12345 --out ./dump --encrypt-for you@example.com
```

Plan conservatively:

```bash
confluex plan --page-id 12345 --out ./plan --safe
```

Limit total work:

```bash
confluex export --page-id 12345 --out ./dump --max-pages 50 --max-download-mib 100
```

## Troubleshooting

### `doctor` fails

Run:

```bash
confluex doctor --page-id 12345
```

Check:

- `node` is installed
- `confluence` CLI is installed
- `confluence` CLI is already authenticated
- you have access to the selected page

### Export stops early

Check `summary.txt`:

- `interrupt_reason=max_pages_reached`
- `interrupt_reason=max_download_mib_reached`
- `interrupt_reason=runtime_error`
- `interrupt_reason=SIGINT`

### Page was not downloaded

Check:

- `unresolved-links.tsv`
- `failed-pages.tsv`
- `summary.txt`

### Decrypt and extract an encrypted export

If the result is `dump.tar.gz.gpg`, decrypt it:

```bash
gpg --output dump.tar.gz --decrypt dump.tar.gz.gpg
```

Then extract it:

```bash
tar -xzf dump.tar.gz
```

One-shot variant:

```bash
gpg --decrypt dump.tar.gz.gpg > dump.tar.gz && tar -xzf dump.tar.gz
```

If `confluex` created `dump.tar.gz.gpg.txt`, the same commands are written there as a reminder.

## Quality

The functional and UX contract is formalized in:

- `REQUIREMENTS.md`

Black-box smoke tests live in:

- `scripts/test-smoke.sh`
