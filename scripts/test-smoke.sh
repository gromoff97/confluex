#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFLUEX_BIN="$ROOT_DIR/confluex"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/confluex-smoke.XXXXXX")"
MOCK_BIN_DIR="$TEST_ROOT/mock-bin"
WORK_DIR="$TEST_ROOT/work"

cleanup() {
  rm -rf "$TEST_ROOT"
}

trap cleanup EXIT

mkdir -p "$MOCK_BIN_DIR" "$WORK_DIR"

cat > "$MOCK_BIN_DIR/confluence" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

SCENARIO="${SCENARIO:-basic}"

emit_info() {
  local page_id="$1"
  local title="$2"
  local space_key="$3"
  printf 'ID: %s\n' "$page_id"
  printf 'Title: %s\n' "$title"
  printf 'Space Key: %s\n' "$space_key"
  printf 'URL: https://example.invalid/spaces/%s/pages/%s\n' "$space_key" "$page_id"
}

scenario_info() {
  local scenario="$1"
  local page_id="$2"

  case "$scenario:$page_id" in
    basic:100|duplicate_paths:100|linked_no_descendants:100|cycle_links:100|ambiguous_title:100|cross_space:100|link_forms:100|fail_fast:100|no_fail_fast:100|non_page_child_ids:100|title_with_colon:100|find_output_without_ids:100|find_candidate_limit:100)
      emit_info 100 "Root Page" "ENG"
      ;;
    basic:200|duplicate_paths:200|linked_no_descendants:200|cycle_links:200|non_page_child_ids:200)
      emit_info 200 "Child Page" "ENG"
      ;;
    basic:300|duplicate_paths:300|linked_no_descendants:300|cycle_links:300|link_forms:300|non_page_child_ids:300)
      emit_info 300 "Linked Page" "ENG"
      ;;
    linked_no_descendants:400)
      emit_info 400 "Linked Descendant" "ENG"
      ;;
    ambiguous_title:600|ambiguous_title:601)
      emit_info "$page_id" "Common Page" "ENG"
      ;;
    cross_space:500)
      emit_info 500 "Shared Page" "OTHER"
      ;;
    link_forms:501)
      emit_info 501 "Param Linked" "OTHER"
      ;;
    link_forms:502)
      emit_info 502 "Href Linked" "ENG"
      ;;
    self_link:700)
      emit_info 700 "Self Page" "ENG"
      ;;
    fail_fast:900|no_fail_fast:900)
      emit_info 900 "Later Page" "ENG"
      ;;
    title_with_colon:800)
      emit_info 800 "API: Overview" "ENG"
      ;;
    find_output_without_ids:850)
      emit_info 850 "Numeric Noise Page" "ENG"
      ;;
    find_candidate_limit:860|find_candidate_limit:861|find_candidate_limit:862|find_candidate_limit:863)
      emit_info "$page_id" "Popular Page" "ENG"
      ;;
    *)
      exit 1
      ;;
  esac
}

scenario_children() {
  local scenario="$1"
  local page_id="$2"

  case "$scenario:$page_id" in
    basic:100|linked_no_descendants:100|cycle_links:100)
      cat <<'JSON'
{"results":[{"id":"200","title":"Child Page","children":[]}]}
JSON
      ;;
    duplicate_paths:100)
      cat <<'JSON'
{"results":[{"id":"200","title":"Child Page","children":[]},{"id":"300","title":"Linked Page","children":[]}]}
JSON
      ;;
    fail_fast:100|no_fail_fast:100)
      cat <<'JSON'
{"results":[{"id":"200","title":"Child Page","children":[]},{"id":"900","title":"Later Page","children":[]}]}
JSON
      ;;
    self_link:700|ambiguous_title:100|cross_space:100|link_forms:100|title_with_colon:100|find_output_without_ids:100|find_candidate_limit:100)
      cat <<'JSON'
{"results":[]}
JSON
      ;;
    non_page_child_ids:100)
      cat <<'JSON'
{"results":[{"id":"200","title":"Child Page","children":[]}],"metadata":{"id":"999","title":"Not A Page","url":"/metadata/999"}}
JSON
      ;;
    linked_no_descendants:300)
      cat <<'JSON'
{"results":[{"id":"400","title":"Linked Descendant","children":[]}]}
JSON
      ;;
    *)
      cat <<'JSON'
{"results":[]}
JSON
      ;;
  esac
}

scenario_edit() {
  local scenario="$1"
  local page_id="$2"
  local output="$3"

  case "$scenario:$page_id" in
    basic:100|linked_no_descendants:100|cycle_links:100|duplicate_paths:100|non_page_child_ids:100)
      cat > "$output" <<'XML'
<ac:link><ri:page ri:space-key="ENG" ri:content-title="Linked Page" /></ac:link>
XML
      ;;
    basic:200|linked_no_descendants:200|non_page_child_ids:200)
      cat > "$output" <<'XML'
<p>child page</p>
XML
      ;;
    basic:300|linked_no_descendants:300|non_page_child_ids:300)
      cat > "$output" <<'XML'
<p>linked page</p>
XML
      ;;
    linked_no_descendants:400)
      cat > "$output" <<'XML'
<p>linked descendant</p>
XML
      ;;
    duplicate_paths:200)
      cat > "$output" <<'XML'
<ri:content-entity ri:content-id="300" />
XML
      ;;
    duplicate_paths:300)
      cat > "$output" <<'XML'
<p>already in tree</p>
XML
      ;;
    duplicate_paths:100)
      cat > "$output" <<'XML'
<ac:link><ri:page ri:space-key="ENG" ri:content-title="Linked Page" /></ac:link>
<ac:link><ri:page ri:space-key="ENG" ri:content-title="Linked Page" /></ac:link>
<a href="/pages/viewpage.action?pageId=300">duplicate id link</a>
XML
      ;;
    cycle_links:200)
      cat > "$output" <<'XML'
<ri:content-entity ri:content-id="300" />
XML
      ;;
    cycle_links:300)
      cat > "$output" <<'XML'
<ri:content-entity ri:content-id="100" />
XML
      ;;
    ambiguous_title:100)
      cat > "$output" <<'XML'
<ac:link><ri:page ri:space-key="ENG" ri:content-title="Common Page" /></ac:link>
XML
      ;;
    ambiguous_title:600|ambiguous_title:601)
      cat > "$output" <<'XML'
<p>common page</p>
XML
      ;;
    cross_space:100)
      cat > "$output" <<'XML'
<ac:link><ri:page ri:space-key="OTHER" ri:content-title="Shared Page" /></ac:link>
XML
      ;;
    cross_space:500)
      cat > "$output" <<'XML'
<p>shared page</p>
XML
      ;;
    link_forms:100)
      cat > "$output" <<'XML'
<ri:content-entity ri:content-id="300" />
<ac:parameter ac:name="page">OTHER:Param Linked</ac:parameter>
<a href="/pages/viewpage.action?pageId=502">internal href</a>
<a href="https://external.invalid/path?pageId=999">external href</a>
XML
      ;;
    link_forms:300|link_forms:501|link_forms:502)
      cat > "$output" <<'XML'
<p>linked by content</p>
XML
      ;;
    self_link:700)
      cat > "$output" <<'XML'
<ac:link><ri:page ri:space-key="ENG" ri:content-title="Self Page" /></ac:link>
<a href="/pages/viewpage.action?pageId=700">self by id</a>
XML
      ;;
    fail_fast:100|no_fail_fast:100|fail_fast:900|no_fail_fast:900)
      cat > "$output" <<'XML'
<p>export test</p>
XML
      ;;
    title_with_colon:100)
      cat > "$output" <<'XML'
<ac:parameter ac:name="page">API: Overview</ac:parameter>
XML
      ;;
    title_with_colon:800)
      cat > "$output" <<'XML'
<p>api overview</p>
XML
      ;;
    find_output_without_ids:100)
      cat > "$output" <<'XML'
<ac:link><ri:page ri:space-key="ENG" ri:content-title="Numeric Noise Page" /></ac:link>
XML
      ;;
    find_output_without_ids:850)
      cat > "$output" <<'XML'
<p>numeric noise page</p>
XML
      ;;
    find_candidate_limit:100)
      cat > "$output" <<'XML'
<ac:link><ri:page ri:space-key="ENG" ri:content-title="Popular Page" /></ac:link>
XML
      ;;
    find_candidate_limit:860|find_candidate_limit:861|find_candidate_limit:862|find_candidate_limit:863)
      cat > "$output" <<'XML'
<p>popular page</p>
XML
      ;;
    fail_fast:200|no_fail_fast:200)
      cat > "$output" <<'XML'
<p>will fail on export</p>
XML
      ;;
    *)
      exit 1
      ;;
  esac
}

scenario_attachments() {
  local scenario="$1"
  local page_id="$2"

  case "$scenario:$page_id" in
    self_link:700)
      printf 'self.txt\n'
      ;;
    *)
      printf 'readme.txt\n'
      ;;
  esac
}

scenario_find() {
  local scenario="$1"
  local title="$2"
  local space_key="${3:-}"

  case "$scenario:$title:$space_key" in
    basic:Linked\ Page:ENG|linked_no_descendants:Linked\ Page:ENG|cycle_links:Linked\ Page:ENG|duplicate_paths:Linked\ Page:ENG|non_page_child_ids:Linked\ Page:ENG)
      printf 'ID: 300\n'
      ;;
    cross_space:Shared\ Page:OTHER)
      printf 'ID: 500\n'
      ;;
    link_forms:Param\ Linked:OTHER)
      printf 'ID: 501\n'
      ;;
    ambiguous_title:Common\ Page:ENG)
      printf 'ID: 600\nID: 601\n'
      ;;
    self_link:Self\ Page:ENG)
      printf 'ID: 700\n'
      ;;
    title_with_colon:API:\ Overview:ENG)
      printf 'ID: 800\n'
      ;;
    find_output_without_ids:Numeric\ Noise\ Page:ENG)
      printf 'Found 123 results on 2024-01-01\n'
      ;;
    find_candidate_limit:Popular\ Page:ENG)
      printf 'ID: 860\nID: 861\nID: 862\nID: 863\n'
      ;;
    *)
      exit 1
      ;;
  esac
}

scenario_export() {
  local scenario="$1"
  local page_id="$2"
  local dest="$3"
  local file_name="$4"
  local attachments_dir="$5"

  case "$scenario:$page_id" in
    fail_fast:200|no_fail_fast:200)
      exit 1
      ;;
  esac

  mkdir -p "$dest/$attachments_dir"
  printf '<html><body>page %s scenario %s</body></html>\n' "$page_id" "$scenario" > "$dest/$file_name"
  printf 'attachment for %s\n' "$page_id" > "$dest/$attachments_dir/readme.txt"
}

cmd="${1:-}"
shift || true

case "$cmd" in
  info)
    scenario_info "$SCENARIO" "${1:-}"
    ;;
  children)
    scenario_children "$SCENARIO" "${1:-}"
    ;;
  edit)
    page_id="${1:-}"
    shift
    output=""
    while (($# > 0)); do
      case "$1" in
        --output)
          output="$2"
          shift 2
          ;;
        *)
          shift
          ;;
      esac
    done
    scenario_edit "$SCENARIO" "$page_id" "$output"
    ;;
  attachments)
    scenario_attachments "$SCENARIO" "${1:-}"
    ;;
  find)
    title="${1:-}"
    shift || true
    space_key=""
    while (($# > 0)); do
      case "$1" in
        --space)
          space_key="$2"
          shift 2
          ;;
        *)
          shift
          ;;
      esac
    done
    scenario_find "$SCENARIO" "$title" "$space_key"
    ;;
  export)
    page_id="${1:-}"
    shift
    dest=""
    file_name=""
    attachments_dir=""
    while (($# > 0)); do
      case "$1" in
        --dest)
          dest="$2"
          shift 2
          ;;
        --file)
          file_name="$2"
          shift 2
          ;;
        --attachments-dir)
          attachments_dir="$2"
          shift 2
          ;;
        *)
          shift
          ;;
      esac
    done
    scenario_export "$SCENARIO" "$page_id" "$dest" "$file_name" "$attachments_dir"
    ;;
  *)
    exit 1
    ;;
esac
EOF

chmod 755 "$MOCK_BIN_DIR/confluence"
export PATH="$MOCK_BIN_DIR:$PATH"

assert_file_exists() {
  local path="$1"
  [[ -f "$path" ]] || {
    printf 'ASSERT FAILED: expected file to exist: %s\n' "$path" >&2
    exit 1
  }
}

assert_path_exists() {
  local path="$1"
  [[ -e "$path" ]] || {
    printf 'ASSERT FAILED: expected path to exist: %s\n' "$path" >&2
    exit 1
  }
}

assert_path_missing() {
  local path="$1"
  [[ ! -e "$path" ]] || {
    printf 'ASSERT FAILED: expected path to be absent: %s\n' "$path" >&2
    exit 1
  }
}

assert_contains() {
  local needle="$1"
  local file="$2"
  grep -F -- "$needle" "$file" >/dev/null 2>&1 || {
    printf 'ASSERT FAILED: expected "%s" in %s\n' "$needle" "$file" >&2
    exit 1
  }
}

assert_not_contains() {
  local needle="$1"
  local file="$2"
  if grep -F -- "$needle" "$file" >/dev/null 2>&1; then
    printf 'ASSERT FAILED: did not expect "%s" in %s\n' "$needle" "$file" >&2
    exit 1
  fi
}

assert_equal() {
  local expected="$1"
  local actual="$2"
  local label="$3"
  if [[ "$expected" != "$actual" ]]; then
    printf 'ASSERT FAILED: %s expected "%s", got "%s"\n' "$label" "$expected" "$actual" >&2
    exit 1
  fi
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

run_cmd() {
  local log_file="$1"
  local scenario="$2"
  shift 2
  (
    cd "$WORK_DIR"
    SCENARIO="$scenario" "$@"
  ) >"$log_file" 2>&1
}

test_unknown_option_suggestion() {
  local log_file="$TEST_ROOT/unknown.log"
  if run_cmd "$log_file" basic "$CONFLUEX_BIN" --pageid 100; then
    printf 'ASSERT FAILED: unknown option test should fail\n' >&2
    exit 1
  fi
  assert_contains 'Did you mean: --page-id ?' "$log_file"
}

test_install_conflict_rejected() {
  local log_file="$TEST_ROOT/install-conflict.log"
  if run_cmd "$log_file" basic "$CONFLUEX_BIN" --install --page-id 100; then
    printf 'ASSERT FAILED: install conflict test should fail\n' >&2
    exit 1
  fi
  assert_contains '--install cannot be combined with --page-id' "$log_file"
}

test_install_dir_requires_install() {
  local log_file="$TEST_ROOT/install-dir.log"
  if run_cmd "$log_file" basic "$CONFLUEX_BIN" --page-id 100 --install-dir /tmp/confluex-bin; then
    printf 'ASSERT FAILED: install-dir without install should fail\n' >&2
    exit 1
  fi
  assert_contains '--install-dir requires --install' "$log_file"
}

test_empty_log_file_rejected() {
  local log_file="$TEST_ROOT/empty-log-file.log"
  if run_cmd "$log_file" basic "$CONFLUEX_BIN" --page-id 100 --log-file=; then
    printf 'ASSERT FAILED: empty log-file should fail\n' >&2
    exit 1
  fi
  assert_contains '--log-file requires a non-empty file path' "$log_file"
}

test_basic_export_downloads_tree_and_linked_page() {
  local out_dir="$WORK_DIR/basic-export"
  local log_file="$TEST_ROOT/basic-export.log"
  run_cmd "$log_file" basic "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_file_exists "$out_dir/pages/ENG/Root_Page__100/page.html"
  assert_file_exists "$out_dir/pages/ENG/Child_Page__200/page.html"
  assert_file_exists "$out_dir/pages/ENG/Linked_Page__300/page.html"
  assert_equal "3" "$(summary_value "$out_dir/summary.txt" processed_pages)" "basic processed_pages"
  assert_equal "1" "$(summary_value "$out_dir/summary.txt" resolved_links)" "basic resolved_links"
  assert_path_exists "$out_dir/summary.txt"
  assert_contains 'downloaded_total_bytes=' "$out_dir/summary.txt"
  assert_contains 'downloaded_content_bytes=' "$out_dir/summary.txt"
  assert_contains 'downloaded_metadata_bytes=' "$out_dir/summary.txt"
}

test_linked_page_does_not_pull_its_descendants() {
  local out_dir="$WORK_DIR/no-descendants"
  local log_file="$TEST_ROOT/no-descendants.log"
  run_cmd "$log_file" linked_no_descendants "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_file_exists "$out_dir/pages/ENG/Linked_Page__300/page.html"
  assert_path_missing "$out_dir/pages/ENG/Linked_Descendant__400"
  assert_equal "3" "$(summary_value "$out_dir/summary.txt" processed_pages)" "no-descendants processed_pages"
}

test_duplicate_paths_do_not_duplicate_exports() {
  local out_dir="$WORK_DIR/duplicate-paths"
  local log_file="$TEST_ROOT/duplicate-paths.log"
  run_cmd "$log_file" duplicate_paths "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_equal "3" "$(manifest_row_count "$out_dir/manifest.tsv")" "duplicate-paths manifest rows"
  assert_equal "1" "$(manifest_page_count "$out_dir/manifest.tsv" 300)" "duplicate-paths page 300 count"
}

test_cycle_links_do_not_loop() {
  local out_dir="$WORK_DIR/cycle-links"
  local log_file="$TEST_ROOT/cycle-links.log"
  run_cmd "$log_file" cycle_links "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_equal "3" "$(summary_value "$out_dir/summary.txt" processed_pages)" "cycle-links processed_pages"
  assert_equal "1" "$(manifest_page_count "$out_dir/manifest.tsv" 100)" "cycle-links root count"
  assert_equal "1" "$(manifest_page_count "$out_dir/manifest.tsv" 300)" "cycle-links linked count"
}

test_self_link_does_not_duplicate_page() {
  local out_dir="$WORK_DIR/self-link"
  local log_file="$TEST_ROOT/self-link.log"
  run_cmd "$log_file" self_link "$CONFLUEX_BIN" --page-id 700 --out "$out_dir"

  assert_equal "1" "$(summary_value "$out_dir/summary.txt" processed_pages)" "self-link processed_pages"
  assert_equal "1" "$(manifest_row_count "$out_dir/manifest.tsv")" "self-link manifest rows"
}

test_ambiguous_title_stays_unresolved() {
  local out_dir="$WORK_DIR/ambiguous"
  local log_file="$TEST_ROOT/ambiguous.log"
  run_cmd "$log_file" ambiguous_title "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_equal "1" "$(summary_value "$out_dir/summary.txt" unresolved_links)" "ambiguous unresolved_links"
  assert_equal "0" "$(summary_value "$out_dir/summary.txt" resolved_links)" "ambiguous resolved_links"
  assert_path_missing "$out_dir/pages/ENG/Common_Page__600"
  assert_path_missing "$out_dir/pages/ENG/Common_Page__601"
}

test_cross_space_title_link_resolves_correctly() {
  local out_dir="$WORK_DIR/cross-space"
  local log_file="$TEST_ROOT/cross-space.log"
  run_cmd "$log_file" cross_space "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_file_exists "$out_dir/pages/OTHER/Shared_Page__500/page.html"
  assert_equal "2" "$(manifest_row_count "$out_dir/manifest.tsv")" "cross-space manifest rows"
}

test_children_parser_ignores_non_page_ids() {
  local out_dir="$WORK_DIR/non-page-child-ids"
  local log_file="$TEST_ROOT/non-page-child-ids.log"
  run_cmd "$log_file" non_page_child_ids "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_path_missing "$out_dir/pages/NO_SPACE/Not_A_Page__999"
  assert_equal "3" "$(summary_value "$out_dir/summary.txt" processed_pages)" "non-page-child-ids processed_pages"
}

test_page_param_with_colon_space_stays_same_space_title() {
  local out_dir="$WORK_DIR/title-with-colon"
  local log_file="$TEST_ROOT/title-with-colon.log"
  run_cmd "$log_file" title_with_colon "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_equal "1" "$(summary_value "$out_dir/summary.txt" resolved_links)" "title-with-colon resolved_links"
  assert_file_exists "$out_dir/pages/ENG/API_Overview__800/page.html"
}

test_find_output_without_explicit_ids_is_skipped() {
  local out_dir="$WORK_DIR/find-output-without-ids"
  local log_file="$TEST_ROOT/find-output-without-ids.log"
  run_cmd "$log_file" find_output_without_ids "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_equal "1" "$(summary_value "$out_dir/summary.txt" unresolved_links)" "find-output-without-ids unresolved_links"
  assert_path_missing "$out_dir/pages/ENG/Numeric_Noise_Page__850"
  assert_contains 'could not parse explicit page ids from find results' "$log_file"
}

test_find_candidate_limit_skips_wide_matches() {
  local out_dir="$WORK_DIR/find-candidate-limit"
  local log_file="$TEST_ROOT/find-candidate-limit.log"
  run_cmd "$log_file" find_candidate_limit "$CONFLUEX_BIN" --page-id 100 --max-find-candidates 3 --out "$out_dir"

  assert_equal "1" "$(summary_value "$out_dir/summary.txt" unresolved_links)" "find-candidate-limit unresolved_links"
  assert_path_missing "$out_dir/pages/ENG/Popular_Page__860"
  assert_contains 'returned 4 candidates; limit is 3, skipping' "$log_file"
}

test_mixed_link_forms_are_detected() {
  local out_dir="$WORK_DIR/link-forms"
  local log_file="$TEST_ROOT/link-forms.log"
  run_cmd "$log_file" link_forms "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_file_exists "$out_dir/pages/ENG/Linked_Page__300/page.html"
  assert_file_exists "$out_dir/pages/OTHER/Param_Linked__501/page.html"
  assert_file_exists "$out_dir/pages/ENG/Href_Linked__502/page.html"
  assert_equal "4" "$(manifest_row_count "$out_dir/manifest.tsv")" "link-forms manifest rows"
  assert_not_contains '999' "$out_dir/resolved-links.tsv"
}

test_dry_run_minimal_artifacts() {
  local out_dir="$WORK_DIR/dry-run-minimal"
  local log_file="$TEST_ROOT/dry-run-minimal.log"
  run_cmd "$log_file" basic "$CONFLUEX_BIN" --page-id 100 --dry-run --out "$out_dir"

  assert_file_exists "$out_dir/manifest.tsv"
  assert_file_exists "$out_dir/summary.txt"
  assert_path_missing "$out_dir/run.log"
  assert_path_missing "$out_dir/pages/ENG/Root_Page__100"
}

test_dry_run_keep_metadata() {
  local out_dir="$WORK_DIR/dry-run-keep"
  local log_file="$TEST_ROOT/dry-run-keep.log"
  run_cmd "$log_file" basic "$CONFLUEX_BIN" --page-id 100 --dry-run --keep-metadata --out "$out_dir"

  assert_file_exists "$out_dir/pages/ENG/Root_Page__100/_info.txt"
  assert_file_exists "$out_dir/pages/ENG/Root_Page__100/_storage.xml"
  assert_file_exists "$out_dir/pages/ENG/Root_Page__100/_attachments_preview.txt"
}

test_log_file_opt_in() {
  local out_dir="$WORK_DIR/export-with-log"
  local explicit_log="$WORK_DIR/custom.log"
  local log_file="$TEST_ROOT/export-with-log.log"
  run_cmd "$log_file" basic "$CONFLUEX_BIN" --page-id 100 --out "$out_dir" --log-file "$explicit_log"

  assert_file_exists "$explicit_log"
  assert_contains 'starting' "$explicit_log"
}

test_fail_fast_stops_after_first_page_failure() {
  local out_dir="$WORK_DIR/fail-fast"
  local log_file="$TEST_ROOT/fail-fast.log"
  if run_cmd "$log_file" fail_fast "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"; then
    printf 'ASSERT FAILED: fail-fast scenario should return non-zero\n' >&2
    exit 1
  fi

  assert_equal "1" "$(summary_value "$out_dir/summary.txt" incomplete)" "fail-fast incomplete"
  assert_equal "2" "$(summary_value "$out_dir/summary.txt" processed_pages)" "fail-fast processed_pages"
  assert_path_missing "$out_dir/pages/ENG/Later_Page__900"
}

test_no_fail_fast_continues_after_failure() {
  local out_dir="$WORK_DIR/no-fail-fast"
  local log_file="$TEST_ROOT/no-fail-fast.log"
  run_cmd "$log_file" no_fail_fast "$CONFLUEX_BIN" --page-id 100 --no-fail-fast --out "$out_dir"

  assert_equal "0" "$(summary_value "$out_dir/summary.txt" incomplete)" "no-fail-fast incomplete"
  assert_equal "3" "$(summary_value "$out_dir/summary.txt" processed_pages)" "no-fail-fast processed_pages"
  assert_equal "1" "$(summary_value "$out_dir/summary.txt" failed_operations)" "no-fail-fast failed_operations"
  assert_file_exists "$out_dir/pages/ENG/Later_Page__900/page.html"
}

test_unknown_option_suggestion
test_install_conflict_rejected
test_install_dir_requires_install
test_empty_log_file_rejected
test_basic_export_downloads_tree_and_linked_page
test_linked_page_does_not_pull_its_descendants
test_duplicate_paths_do_not_duplicate_exports
test_cycle_links_do_not_loop
test_self_link_does_not_duplicate_page
test_ambiguous_title_stays_unresolved
test_cross_space_title_link_resolves_correctly
test_children_parser_ignores_non_page_ids
test_page_param_with_colon_space_stays_same_space_title
test_find_output_without_explicit_ids_is_skipped
test_find_candidate_limit_skips_wide_matches
test_mixed_link_forms_are_detected
test_dry_run_minimal_artifacts
test_dry_run_keep_metadata
test_log_file_opt_in
test_fail_fast_stops_after_first_page_failure
test_no_fail_fast_continues_after_failure

printf 'Smoke tests passed.\n'
