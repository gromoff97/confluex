#!/usr/bin/env bash
set -euo pipefail

output=""
input=""

if [[ -n "${MOCK_GPG_FAIL:-}" ]]; then
  exit 1
fi

while (($# > 0)); do
  case "$1" in
    --output|-o)
      output="$2"
      shift 2
      ;;
    --recipient|--trust-model)
      shift 2
      ;;
    --batch|--yes|--encrypt|--decrypt)
      shift
      ;;
    --*)
      shift
      ;;
    *)
      input="$1"
      shift
      ;;
  esac
done

[[ -n "$output" ]] || exit 1
[[ -n "$input" ]] || exit 1

cp "$input" "$output"
