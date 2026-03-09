#!/usr/bin/env bash
set -euo pipefail

output=""
input=""
list_keys=0
recipient=""

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
      if [[ "$1" == "--recipient" ]]; then
        recipient="$2"
      fi
      shift 2
      ;;
    --list-keys)
      list_keys=1
      shift
      ;;
    --with-colons)
      shift
      ;;
    --batch|--yes|--encrypt|--decrypt)
      shift
      ;;
    --*)
      shift
      ;;
    *)
      if (( list_keys )); then
        recipient="$1"
      else
        input="$1"
      fi
      shift
      ;;
  esac
done

if (( list_keys )); then
  if [[ -n "${MOCK_GPG_MISSING_KEY:-}" && "$recipient" == "${MOCK_GPG_MISSING_KEY}" ]]; then
    exit 1
  fi
  [[ -n "$recipient" ]] || exit 1
  printf 'pub:-:4096:1:%s:::::::\n' "$recipient"
  exit 0
fi

[[ -n "$output" ]] || exit 1
[[ -n "$input" ]] || exit 1

cp "$input" "$output"
