# Confluex

`confluex` is a token-authenticated CLI for exporting Confluence pages to
Markdown.

## Build

```bash
cargo build --release -p confluex
```

Run the built CLI:

```bash
./target/release/confluex --help
```

## Setup

```bash
./target/release/confluex setup
```

`setup` asks for the Confluence base URL and token. Token input is hidden.

## Inspect Scope

```bash
./target/release/confluex export --page-id 12345 --plan-only --out ./plan
```

## First Export

```bash
./target/release/confluex export --page-id 12345 --out ./dump --zip
```

## Manual

Read the full command reference source:

```bash
man ./docs/man/man1/confluex.1
```

## Publish

Publish requires crates.io credentials. Set and commit the release version in
`crates/confluex/Cargo.toml` before publishing.

```bash
cargo publish --dry-run -p confluex
cargo publish -p confluex
```
