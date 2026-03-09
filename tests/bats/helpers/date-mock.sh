#!/usr/bin/env bash
set -euo pipefail

if [[ -n "${CONFLUEX_FIXED_DATE_OUTPUT:-}" ]]; then
  printf '%s\n' "$CONFLUEX_FIXED_DATE_OUTPUT"
  exit 0
fi

exec "${REAL_DATE_BIN:?}" "$@"
