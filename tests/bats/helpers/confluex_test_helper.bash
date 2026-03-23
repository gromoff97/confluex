#!/usr/bin/env bash

CONFLUEX_TEST_HELPER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFLUEX_REPO_ROOT="$(cd "$CONFLUEX_TEST_HELPER_DIR/../../.." && pwd)"
CONFLUEX_ORIGINAL_PATH="$PATH"

confluex_setup() {
  export CONFLUEX_TEST_ROOT
  export CONFLUEX_MOCK_BIN_DIR
  export CONFLUEX_WORK_DIR
  export CONFLUEX_TEST_HOME
  export CONFLUEX_TEST_XDG_CONFIG_HOME
  export CONFLUEX_BIN
  export CONFLUEX_FIXED_DATE_OUTPUT
  export REAL_DATE_BIN

  CONFLUEX_TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/confluex-bats.XXXXXX")"
  CONFLUEX_MOCK_BIN_DIR="$CONFLUEX_TEST_ROOT/mock-bin"
  CONFLUEX_WORK_DIR="$CONFLUEX_TEST_ROOT/work"
  CONFLUEX_TEST_HOME="$CONFLUEX_TEST_ROOT/home"
  CONFLUEX_TEST_XDG_CONFIG_HOME="$CONFLUEX_TEST_ROOT/xdg-config"
  CONFLUEX_BIN="$CONFLUEX_REPO_ROOT/confluex"
  CONFLUEX_FIXED_DATE_OUTPUT="20240101_010203"
  REAL_DATE_BIN="$(command -v date)"

  mkdir -p "$CONFLUEX_MOCK_BIN_DIR" "$CONFLUEX_WORK_DIR" "$CONFLUEX_TEST_HOME" "$CONFLUEX_TEST_XDG_CONFIG_HOME"
  cp "$CONFLUEX_TEST_HELPER_DIR/confluence-mock.sh" "$CONFLUEX_MOCK_BIN_DIR/confluence"
  cp "$CONFLUEX_TEST_HELPER_DIR/gpg-mock.sh" "$CONFLUEX_MOCK_BIN_DIR/gpg"
  cp "$CONFLUEX_TEST_HELPER_DIR/date-mock.sh" "$CONFLUEX_MOCK_BIN_DIR/date"
  chmod 755 "$CONFLUEX_MOCK_BIN_DIR/confluence" "$CONFLUEX_MOCK_BIN_DIR/gpg" "$CONFLUEX_MOCK_BIN_DIR/date"

  export HOME="$CONFLUEX_TEST_HOME"
  export XDG_CONFIG_HOME="$CONFLUEX_TEST_XDG_CONFIG_HOME"
  export PATH="$CONFLUEX_MOCK_BIN_DIR:$CONFLUEX_ORIGINAL_PATH"
  unset MOCK_GPG_FAIL

  CONFLUEX_LAST_STATUS=0
  CONFLUEX_LAST_OUTPUT=""
  CONFLUEX_LAST_STDOUT=""
  CONFLUEX_LAST_STDERR=""
}

confluex_teardown() {
  rm -rf "${CONFLUEX_TEST_ROOT:-}"
}

fail_test() {
  printf 'ASSERT FAILED: %s\n' "$*" >&2
  return 1
}

run_command() {
  local scenario="$1"
  shift
  local stdout_file="$CONFLUEX_TEST_ROOT/last-command.stdout"
  local stderr_file="$CONFLUEX_TEST_ROOT/last-command.stderr"

  if (
    cd "$CONFLUEX_WORK_DIR" &&
    SCENARIO="$scenario" "$@"
  ) >"$stdout_file" 2>"$stderr_file"; then
    CONFLUEX_LAST_STATUS=0
  else
    CONFLUEX_LAST_STATUS=$?
  fi

  CONFLUEX_LAST_STDOUT="$(cat "$stdout_file")"
  CONFLUEX_LAST_STDERR="$(cat "$stderr_file")"
  CONFLUEX_LAST_OUTPUT="$(printf '%s%s' "$CONFLUEX_LAST_STDOUT" "$CONFLUEX_LAST_STDERR")"
}

run_confluex() {
  local scenario="$1"
  shift
  run_command "$scenario" "$CONFLUEX_BIN" "$@"
}

assert_success() {
  [[ "$CONFLUEX_LAST_STATUS" -eq 0 ]] || fail_test "expected success, got status $CONFLUEX_LAST_STATUS with output: $CONFLUEX_LAST_OUTPUT"
}

assert_failure() {
  [[ "$CONFLUEX_LAST_STATUS" -ne 0 ]] || fail_test "expected failure, got success with output: $CONFLUEX_LAST_OUTPUT"
}

assert_status() {
  local expected="$1"
  [[ "$CONFLUEX_LAST_STATUS" -eq "$expected" ]] || fail_test "expected status $expected, got $CONFLUEX_LAST_STATUS with output: $CONFLUEX_LAST_OUTPUT"
}

assert_output_contains() {
  local needle="$1"
  [[ "$CONFLUEX_LAST_OUTPUT" == *"$needle"* ]] || fail_test "expected output to contain '$needle', got: $CONFLUEX_LAST_OUTPUT"
}

assert_output_not_contains() {
  local needle="$1"
  [[ "$CONFLUEX_LAST_OUTPUT" != *"$needle"* ]] || fail_test "did not expect output to contain '$needle', got: $CONFLUEX_LAST_OUTPUT"
}

assert_stdout_contains() {
  local needle="$1"
  [[ "$CONFLUEX_LAST_STDOUT" == *"$needle"* ]] || fail_test "expected stdout to contain '$needle', got: $CONFLUEX_LAST_STDOUT"
}

assert_stdout_not_contains() {
  local needle="$1"
  [[ "$CONFLUEX_LAST_STDOUT" != *"$needle"* ]] || fail_test "did not expect stdout to contain '$needle', got: $CONFLUEX_LAST_STDOUT"
}

assert_stdout_equals() {
  local expected="$1"
  [[ "$CONFLUEX_LAST_STDOUT" == "$expected" ]] || fail_test "expected stdout to equal '$expected', got: $CONFLUEX_LAST_STDOUT"
}

assert_stderr_contains() {
  local needle="$1"
  [[ "$CONFLUEX_LAST_STDERR" == *"$needle"* ]] || fail_test "expected stderr to contain '$needle', got: $CONFLUEX_LAST_STDERR"
}

assert_stderr_not_contains() {
  local needle="$1"
  [[ "$CONFLUEX_LAST_STDERR" != *"$needle"* ]] || fail_test "did not expect stderr to contain '$needle', got: $CONFLUEX_LAST_STDERR"
}

assert_stderr_empty() {
  [[ -z "$CONFLUEX_LAST_STDERR" ]] || fail_test "expected stderr to be empty, got: $CONFLUEX_LAST_STDERR"
}

assert_file_exists() {
  local path="$1"
  [[ -f "$path" ]] || fail_test "expected file to exist: $path"
}

assert_path_exists() {
  local path="$1"
  [[ -e "$path" ]] || fail_test "expected path to exist: $path"
}

assert_path_missing() {
  local path="$1"
  [[ ! -e "$path" ]] || fail_test "expected path to be absent: $path"
}

assert_dir_empty() {
  local path="$1"
  local first_entry
  [[ -d "$path" ]] || fail_test "expected directory to exist: $path"
  first_entry="$(find "$path" -mindepth 1 -print -quit)"
  [[ -z "$first_entry" ]] || fail_test "expected directory to stay empty: $path"
}

assert_file_contains() {
  local needle="$1"
  local path="$2"
  grep -F -- "$needle" "$path" >/dev/null 2>&1 || fail_test "expected '$needle' in $path"
}

assert_file_not_contains() {
  local needle="$1"
  local path="$2"
  if grep -F -- "$needle" "$path" >/dev/null 2>&1; then
    fail_test "did not expect '$needle' in $path"
  fi
}

assert_equal() {
  local expected="$1"
  local actual="$2"
  local label="$3"
  [[ "$expected" == "$actual" ]] || fail_test "$label expected '$expected', got '$actual'"
}

assert_no_default_output_dirs() {
  if compgen -G "$CONFLUEX_WORK_DIR/confluence_dump_*" >/dev/null; then
    fail_test "unexpected dump directory created in $CONFLUEX_WORK_DIR"
  fi
  if compgen -G "$CONFLUEX_WORK_DIR/confluence_plan_*" >/dev/null; then
    fail_test "unexpected plan directory created in $CONFLUEX_WORK_DIR"
  fi
}

generated_dir() {
  local glob_pattern="$1"
  local matches=()
  local match=""

  while IFS= read -r match; do
    matches+=("$match")
  done < <(find "$CONFLUEX_WORK_DIR" -maxdepth 1 -mindepth 1 -type d -name "$glob_pattern" | sort)

  [[ "${#matches[@]}" -eq 1 ]] || fail_test "expected exactly one directory matching $glob_pattern, got ${#matches[@]}"
  printf '%s\n' "${matches[0]}"
}

summary_value() {
  local file="$1"
  local key="$2"
  awk -F= -v key="$key" '$1 == key { print $2 }' "$file"
}

manifest_row_count() {
  local file="$1"
  awk 'NR > 1 { count += 1 } END { print count + 0 }' "$file"
}

manifest_page_count() {
  local file="$1"
  local page_id="$2"
  awk -F'\t' -v page_id="$page_id" 'NR > 1 && $1 == page_id { count += 1 } END { print count + 0 }' "$file"
}

assert_summary_value() {
  local file="$1"
  local key="$2"
  local expected="$3"
  local actual
  actual="$(summary_value "$file" "$key")"
  assert_equal "$expected" "$actual" "summary $key"
}

assert_standard_report_files() {
  local out_dir="$1"
  assert_file_exists "$out_dir/manifest.tsv"
  assert_file_exists "$out_dir/resolved-links.tsv"
  assert_file_exists "$out_dir/unresolved-links.tsv"
  assert_file_exists "$out_dir/failed-pages.tsv"
  assert_file_exists "$out_dir/scope-findings.tsv"
  assert_file_exists "$out_dir/summary.txt"
}

assert_summary_has_keys() {
  local file="$1"
  shift
  local key=""

  for key in "$@"; do
    grep -E "^${key}=" "$file" >/dev/null 2>&1 || fail_test "expected summary key '$key' in $file"
  done
}

assert_summary_keys_exact() {
  local file="$1"
  shift
  local actual_keys
  local expected_keys

  actual_keys="$(awk -F= 'NF == 0 { next } { print $1 }' "$file")"
  expected_keys="$(printf '%s\n' "$@")"
  [[ "$actual_keys" == "$expected_keys" ]] || fail_test "expected exact summary key order in $file, got: $actual_keys"
}

assert_summary_is_key_value_file() {
  local file="$1"
  awk 'NF == 0 { next } /^[^=]+=.*/ { next } { exit 1 }' "$file" || fail_test "expected key=value lines only in $file"
}

assert_failed_pages_four_columns() {
  local file="$1"
  awk -F'\t' 'NF != 4 { exit 1 }' "$file" || fail_test "expected failed-pages.tsv to have exactly 4 tab-separated columns in every row"
}

assert_scope_findings_four_columns() {
  local file="$1"
  awk -F'\t' 'NF != 4 { exit 1 }' "$file" || fail_test "expected scope-findings.tsv to have exactly 4 tab-separated columns in every row"
}

assert_manifest_folders_relative() {
  local file="$1"
  awk -F'\t' 'NR == 1 { next } $4 ~ /^\// { exit 1 }' "$file" || fail_test "expected manifest folder values to stay relative in $file"
}

page_payload_file_name_for_out_dir() {
  local out_dir="$1"
  local format

  format="$(summary_value "$out_dir/summary.txt" page_payload_format)"
  if [[ "$format" == "md" ]]; then
    printf 'page.md\n'
    return 0
  fi

  printf 'page.html\n'
}

assert_page_exported_as() {
  local out_dir="$1"
  local space_key="$2"
  local folder_name="$3"
  local page_id="$4"
  local payload_file="$5"

  assert_file_exists "$out_dir/pages/$space_key/${folder_name}__${page_id}/$payload_file"
}

assert_page_exported() {
  local out_dir="$1"
  local space_key="$2"
  local folder_name="$3"
  local page_id="$4"
  assert_page_exported_as "$out_dir" "$space_key" "$folder_name" "$page_id" "$(page_payload_file_name_for_out_dir "$out_dir")"
}

assert_page_markdown_exported() {
  local out_dir="$1"
  local space_key="$2"
  local folder_name="$3"
  local page_id="$4"
  assert_page_exported_as "$out_dir" "$space_key" "$folder_name" "$page_id" "page.md"
}

assert_page_html_exported() {
  local out_dir="$1"
  local space_key="$2"
  local folder_name="$3"
  local page_id="$4"
  assert_page_exported_as "$out_dir" "$space_key" "$folder_name" "$page_id" "page.html"
}

assert_page_missing() {
  local out_dir="$1"
  local space_key="$2"
  local folder_name="$3"
  local page_id="$4"
  assert_path_missing "$out_dir/pages/$space_key/${folder_name}__${page_id}"
}

assert_page_html_missing() {
  local out_dir="$1"
  local space_key="$2"
  local folder_name="$3"
  local page_id="$4"
  assert_path_missing "$out_dir/pages/$space_key/${folder_name}__${page_id}/page.html"
}

page_dir_for_id() {
  local out_dir="$1"
  local page_id="$2"
  local match

  match="$(find "$out_dir/pages" -mindepth 2 -maxdepth 2 -type d -name "*__${page_id}" | sort | head -n 1)"
  [[ -n "$match" ]] || fail_test "expected to find page directory for page id $page_id under $out_dir/pages"
  printf '%s\n' "$match"
}

assert_page_dir_component_length_at_most() {
  local out_dir="$1"
  local page_id="$2"
  local max_len="$3"
  local dir_name

  dir_name="$(basename "$(page_dir_for_id "$out_dir" "$page_id")")"
  (( ${#dir_name} <= max_len )) || fail_test "expected page dir component for $page_id to be at most $max_len chars, got ${#dir_name}: $dir_name"
}

assert_report_invariants() {
  local out_dir="$1"
  local command
  local final_status
  local payload_file

  command="$(summary_value "$out_dir/summary.txt" command)"
  final_status="$(summary_value "$out_dir/summary.txt" final_status)"
  payload_file="$(page_payload_file_name_for_out_dir "$out_dir")"

  if [[ "$command" == "plan" ]]; then
    awk -F'\t' 'NR == 1 { next } $6 != "plan" { exit 1 }' "$out_dir/manifest.tsv" ||
      fail_test "plan manifest contains non-plan rows in $out_dir/manifest.tsv"
    return 0
  fi

  awk -F'\t' 'NR == 1 { next } $6 != "export" { exit 1 }' "$out_dir/manifest.tsv" ||
    fail_test "export manifest contains non-export rows in $out_dir/manifest.tsv"

  awk -F'\t' 'NR == 1 { next } { print $1 "\t" $4 }' "$out_dir/manifest.tsv" |
    while IFS=$'\t' read -r page_id folder; do
      [[ -z "$folder" || "$folder" == "none" ]] && continue
      if [[ "$folder" != /* ]]; then
        folder="$out_dir/$folder"
      fi
      [[ -e "$folder" ]] || exit 9
      if [[ -f "$folder/$payload_file" ]]; then
        continue
      fi
      awk -F'\t' -v page_id="$page_id" 'NR == 1 { next } $1 == page_id && $3 == "page_payload" { found = 1 } END { exit(found ? 0 : 1) }' "$out_dir/failed-pages.tsv" ||
        exit 10
    done
  case "$?" in
    9)
      fail_test "manifest folder path missing in $out_dir"
      ;;
    10)
      fail_test "manifest row without payload file has no matching export failure in $out_dir"
      ;;
  esac

  awk -F'\t' 'NR == 1 { next } { print $1 }' "$out_dir/manifest.tsv" | sort -u > "$CONFLUEX_TEST_ROOT/manifest_ids.tmp"
  awk -F'\t' 'NR == 1 { next } { print $1 }' "$out_dir/failed-pages.tsv" | sort -u > "$CONFLUEX_TEST_ROOT/failed_ids.tmp"

  if [[ "$final_status" != "incomplete" && "$final_status" != "interrupted" ]]; then
    awk -F'\t' 'NR == 1 { next } { print $5 }' "$out_dir/resolved-links.tsv" | sort -u > "$CONFLUEX_TEST_ROOT/resolved_ids.tmp"
    while IFS= read -r target_id; do
      [[ -z "$target_id" ]] && continue
      if ! grep -Fx -- "$target_id" "$CONFLUEX_TEST_ROOT/manifest_ids.tmp" >/dev/null 2>&1 &&
        ! grep -Fx -- "$target_id" "$CONFLUEX_TEST_ROOT/failed_ids.tmp" >/dev/null 2>&1; then
        fail_test "resolved link target $target_id is neither exported nor failed in $out_dir"
      fi
    done < "$CONFLUEX_TEST_ROOT/resolved_ids.tmp"
  fi
}

config_file_path() {
  printf '%s/confluex/config\n' "$XDG_CONFIG_HOME"
}
