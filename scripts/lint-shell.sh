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

mapfile -t shell_files < <(git -C "$ROOT_DIR" ls-files '*.sh' '*.bash')
shell_files=("$ROOT_DIR/confluex" "${shell_files[@]}")

for i in "${!shell_files[@]}"; do
  if (( i == 0 )); then
    continue
  fi
  shell_files[i]="$ROOT_DIR/${shell_files[i]}"
done

exec "$SHELLCHECK_BIN" "${shell_files[@]}"
