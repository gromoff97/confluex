#!/usr/bin/env bash

LIVE_CONFLUEX_HELPER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC2034
LIVE_CONFLUEX_REPO_ROOT="$(cd "$LIVE_CONFLUEX_HELPER_DIR/../../.." && pwd)"

live_fail_test() {
  printf 'ASSERT FAILED: %s\n' "$*" >&2
  return 1
}

live_assert_equal() {
  local expected="$1"
  local actual="$2"
  local label="$3"
  [[ "$expected" == "$actual" ]] || live_fail_test "$label expected '$expected', got '$actual'"
}

live_require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    skip "$name is required for this live test"
  fi
}
