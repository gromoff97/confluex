#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BATS_BIN="${BATS_BIN:-}"

if [[ -z "$BATS_BIN" ]]; then
  BATS_BIN="$(command -v bats || true)"
fi

if [[ -z "$BATS_BIN" ]]; then
  cat >&2 <<'EOF'
ERROR: bats-core is not installed or not available on PATH.

This repository treats bats-core as an external dependency.
Install it separately, then rerun this script.

Supported usage patterns for this repository:
  1. Put `bats` on PATH through your preferred package manager or environment setup.
  2. Or export BATS_BIN=/absolute/path/to/bats before running this script.

Example:
  BATS_BIN="$HOME/.local/bin/bats" scripts/test-bats.sh
EOF
  exit 1
fi

exec "$BATS_BIN" "$ROOT_DIR/tests/bats"
