# Confluex

`confluex` is a token-authenticated CLI for exporting Confluence pages to
Markdown.

## Install

```bash
cargo install confluex
```

## Setup

```bash
confluex setup
```

`setup` asks for the Confluence base URL and token. Token input is hidden.

## Export

Inspect the export scope without writing page Markdown:

```bash
confluex export --page-id 12345 --plan-only --out ./plan
```

Export Markdown and create a ZIP archive:

```bash
confluex export --page-id 12345 --out ./dump --zip
```

Add `--include-children` when the export should traverse child pages.

## Help

```bash
confluex --help
confluex export --help
```

## Build From Source

From a source checkout:

```bash
cargo build --release
./target/release/confluex --help
man ./docs/man/man1/confluex.1
```
