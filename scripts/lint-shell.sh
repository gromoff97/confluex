#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SHELLCHECK_BIN="${SHELLCHECK_BIN:-$ROOT_DIR/tools/shellcheck/shellcheck}"

if [[ ! -x "$SHELLCHECK_BIN" ]]; then
  printf 'ERROR: shellcheck binary not found or not executable: %s\n' "$SHELLCHECK_BIN" >&2
  printf 'Expected local install at %s\n' "$ROOT_DIR/tools/shellcheck/shellcheck" >&2
  printf 'Run %s first.\n' "$ROOT_DIR/scripts/install-shellcheck.sh" >&2
  exit 1
fi

"$SHELLCHECK_BIN" \
  "$ROOT_DIR/confluex" \
  "$ROOT_DIR/lib/confluex/main.sh" \
  "$ROOT_DIR/lib/confluex/cli.sh" \
  "$ROOT_DIR/lib/confluex/util.sh" \
  "$ROOT_DIR/scripts/install-shellcheck.sh" \
  "$ROOT_DIR/scripts/lint-shell.sh" \
  "$ROOT_DIR/scripts/test-smoke.sh"
