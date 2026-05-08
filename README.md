# Confluex

`confluex` is a token-authenticated CLI for exporting Confluence pages to
Markdown.

## Install

```bash
npm install -g confluex
```

Update and uninstall use npm:

```bash
npm install -g confluex@latest
npm uninstall -g confluex
```

## Setup

```bash
confluex setup
```

`setup` asks for the Confluence base URL and token. Token input is hidden.

## First Plan

```bash
confluex plan --page-id 12345 --out ./plan
```

## First Export

```bash
confluex export --page-id 12345 --out ./dump --zip
```

## Manual

Read the full installed command reference:

```bash
man confluex
```
