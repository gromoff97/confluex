#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STANDARD_BIN="${STANDARD_BIN:-$ROOT_DIR/node_modules/.bin/standard}"

if [[ ! -x "$STANDARD_BIN" ]]; then
  cat >&2 <<EOF
ERROR: standard is not installed locally for this repository.

Install JS lint dependencies first:
  cd "$ROOT_DIR"
  npm install

Or point STANDARD_BIN to an explicit binary path.
EOF
  exit 1
fi

mapfile -t js_files < <(git -C "$ROOT_DIR" ls-files '*.js' '*.mjs')

if [[ "${#js_files[@]}" -eq 0 ]]; then
  printf 'No tracked JavaScript or MJS files found.\n'
  exit 0
fi

for i in "${!js_files[@]}"; do
  js_files[i]="$ROOT_DIR/${js_files[i]}"
done

exec "$STANDARD_BIN" "${js_files[@]}"
