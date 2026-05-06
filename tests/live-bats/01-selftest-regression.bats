#!/usr/bin/env bats

source "${BATS_TEST_DIRNAME}/helpers/live_confluex_helper.bash"

setup() {
  bats_require_minimum_version 1.5.0

  live_require_env CONFLUEX_LIVE_SELFTEST_URL
  live_require_env CONFLUEX_LIVE_SELFTEST_LOGIN
  live_require_env CONFLUEX_LIVE_SELFTEST_PASSWORD
  live_require_env CONFLUEX_LIVE_CLI_HOME
}

run_selftest() {
  run --keep-empty-lines --separate-stderr env HOME="$CONFLUEX_LIVE_CLI_HOME" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    selftest \
    --url "$CONFLUEX_LIVE_SELFTEST_URL" \
    --login "$CONFLUEX_LIVE_SELFTEST_LOGIN" \
    --password "$CONFLUEX_LIVE_SELFTEST_PASSWORD"
}

report_root_from_stdout() {
  node -e '
const line = process.argv[1];
const status = process.argv[2];
const prefix = `selftest_result=${status} report_root=`;
if (!line.startsWith(prefix)) {
  process.exit(1);
}
process.stdout.write(JSON.parse(line.slice(prefix.length)));
  ' "$1" "$2"
}

summary_value() {
  node -e '
const fs = require("fs");
const path = require("path");
const reportRoot = process.argv[1];
const key = process.argv[2];
const summary = Object.fromEntries(
  fs.readFileSync(path.join(reportRoot, "summary.txt"), "utf8")
    .trimEnd()
    .split("\n")
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    })
);
process.stdout.write(summary[key] || "");
  ' "$1" "$2"
}

@test "clean stand selftest succeeds and retains governed artifacts" {
  local report_root=""

  run_selftest
  output="${output%$'\n'}"
  stderr="${stderr%$'\n'}"

  [ "$status" -eq 0 ] || live_fail_test "selftest exited $status: $output $stderr"
  [[ "$output" == selftest_result=passed\ report_root=* ]] ||
    live_fail_test "selftest stdout mismatch: $output"
  live_assert_equal "" "$stderr" "selftest stderr"

  report_root="$(report_root_from_stdout "$output" passed)" ||
    live_fail_test "could not parse report root from: $output"

  live_assert_equal "passed" "$(summary_value "$report_root" bootstrap_status)" "bootstrap_status"
  live_assert_equal "passed" "$(summary_value "$report_root" fixture_apply_status)" "fixture_apply_status"
  live_assert_equal "passed" "$(summary_value "$report_root" prepare_expected_data_status)" "prepare_expected_data_status"
  live_assert_equal "passed" "$(summary_value "$report_root" live_regression_status)" "live_regression_status"
  live_assert_equal "passed" "$(summary_value "$report_root" selftest_status)" "selftest_status"

  run test -s "$report_root/identities.json"
  [ "$status" -eq 0 ]

  run test -d "$report_root/expected"
  [ "$status" -eq 0 ]

  run test -s "$report_root/live-bats.tap"
  [ "$status" -eq 0 ]

  run grep -Fx '# live-bats-file tests/live-bats/live-regression.bats' "$report_root/live-bats.tap"
  [ "$status" -eq 0 ]
}

@test "dirty stand selftest fails before fixture apply" {
  local report_root=""

  run_selftest
  output="${output%$'\n'}"
  stderr="${stderr%$'\n'}"

  [ "$status" -eq 4 ] || live_fail_test "dirty selftest exited $status: $output $stderr"
  [[ "$output" == selftest_result=failed\ report_root=* ]] ||
    live_fail_test "dirty selftest stdout mismatch: $output"
  live_assert_equal "" "$stderr" "dirty selftest stderr"

  report_root="$(report_root_from_stdout "$output" failed)" ||
    live_fail_test "could not parse dirty report root from: $output"

  live_assert_equal "failed" "$(summary_value "$report_root" bootstrap_status)" "bootstrap_status"
  live_assert_equal "not_run" "$(summary_value "$report_root" fixture_apply_status)" "fixture_apply_status"
  live_assert_equal "not_run" "$(summary_value "$report_root" prepare_expected_data_status)" "prepare_expected_data_status"
  live_assert_equal "not_run" "$(summary_value "$report_root" live_regression_status)" "live_regression_status"
  live_assert_equal "failed" "$(summary_value "$report_root" selftest_status)" "selftest_status"

  run test ! -s "$report_root/live-bats.tap"
  [ "$status" -eq 0 ]

  run cat "$report_root/identities.json"
  [ "$status" -eq 0 ]
  live_assert_equal "{}" "$output" "dirty identities default"
}
