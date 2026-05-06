#!/usr/bin/env bats

source "${BATS_TEST_DIRNAME}/helpers/live_confluex_helper.bash"

setup() {
  bats_require_minimum_version 1.5.0
}

@test "successful markdown root tree export matches golden snapshot" {
  live_require_env CONFLUEX_SELFTEST_REPORT_ROOT
  live_require_env CONFLUEX_SELFTEST_CONFLUENCE_BASE_URL
  live_require_env CONFLUEX_SELFTEST_CONFLUENCE_USERNAME
  live_require_env CONFLUEX_SELFTEST_CONFLUENCE_PASSWORD

  local root_page_id=""
  local export_out="$CONFLUEX_SELFTEST_REPORT_ROOT/export/export-root-tree-md"
  local expected_root="$CONFLUEX_SELFTEST_REPORT_ROOT/expected/golden/export-root-tree-md"

  root_page_id="$(node -e 'const fs=require("fs"); const data=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(data.root_page.page_id)' "$CONFLUEX_SELFTEST_REPORT_ROOT/identities.json")"

  rm -rf "$export_out"
  run --keep-empty-lines --separate-stderr env \
    HOME="$(mktemp -d)" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    export \
    --page-id "$root_page_id" \
    --page-format md \
    --out "$export_out"
  [ "$status" -eq 0 ] || live_fail_test "export exited $status: $output $stderr"
  live_assert_equal "WARNING: unbounded_run use --safe or --max-pages or --max-download-mib" "$stderr" "export stderr"

  run node "$BATS_TEST_DIRNAME/helpers/compare-golden-snapshot.js" \
    "$CONFLUEX_SELFTEST_REPORT_ROOT" \
    "$expected_root" \
    "$export_out"
  [ "$status" -eq 0 ] || live_fail_test "$output $stderr"
}
