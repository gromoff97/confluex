#!/usr/bin/env bats

source "${BATS_TEST_DIRNAME}/helpers/live_confluex_helper.bash"

setup() {
  bats_require_minimum_version 1.5.0
  export LIVE_TMP_ROOT
  LIVE_TMP_ROOT="$(mktemp -d)"
}

teardown() {
  rm -rf "$LIVE_TMP_ROOT"
}

run_live_cli() {
  run --keep-empty-lines --separate-stderr bash "$LIVE_CONFLUEX_REPO_ROOT/confluex" "$@"
  output="${output%$'\n'}"
  stderr="${stderr%$'\n'}"
}

assert_help_sections_in_order() {
  [[ "$output" == *$'Usage\n'*$'\nPurpose\n'*$'\nRequired options\n'*$'\nOptional options\n'*$'\nExamples\n'* ]] ||
    live_fail_test "expected help sections in order, got: $output"
}

assert_stderr_starts_with_error() {
  [[ "$stderr" == ERROR:\ * ]] ||
    live_fail_test "expected stderr to start with 'ERROR: ', got: $stderr"
}

@test "top-level help and zero-command invocation expose the docs-defined command surface" {
  run_live_cli --help
  [ "$status" -eq 0 ] || live_fail_test "top-level --help rejected: $status"
  live_assert_equal "" "$stderr" "top-level --help stderr"
  run node -e '
const text = process.argv[1];
const lines = text.split("\n");
const problems = [];
const usageIdx = lines.indexOf("Usage");
const commandsIdx = lines.indexOf("Commands");
const expected = ["export", "plan", "doctor", "config", "install", "uninstall", "selftest"];
if (usageIdx === -1) problems.push("missing_usage");
if (commandsIdx === -1) problems.push("missing_commands");
if (!(usageIdx !== -1 && commandsIdx !== -1 && usageIdx < commandsIdx)) problems.push("section_order");
const commandLines = lines.slice(commandsIdx + 1).filter((line) => line.trim());
const actual = commandLines.map((line) => line.trim().split(/\s+/)[0]);
if (JSON.stringify(actual) !== JSON.stringify(expected)) problems.push(`commands:${actual.join(",")}`);
for (const line of commandLines) {
  const match = line.match(/^  (export|plan|doctor|config|install|uninstall|selftest)\s+(.+)$/);
  if (!match) problems.push(`command_line:${line}`);
  else if (match[2].includes("\n") || match[2].trim() === "") problems.push(`purpose:${match[1]}`);
}
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
' "$output"
  [ "$status" -eq 0 ] || live_fail_test "$output"

  run_live_cli
  [ "$status" -eq 0 ] || live_fail_test "zero-command help rejected: $status"
  live_assert_equal "" "$stderr" "zero-command stderr"
  run node -e '
const text = process.argv[1];
const lines = text.split("\n");
const problems = [];
const usageIdx = lines.indexOf("Usage");
const commandsIdx = lines.indexOf("Commands");
const expected = ["export", "plan", "doctor", "config", "install", "uninstall", "selftest"];
if (usageIdx === -1) problems.push("missing_usage");
if (commandsIdx === -1) problems.push("missing_commands");
if (!(usageIdx !== -1 && commandsIdx !== -1 && usageIdx < commandsIdx)) problems.push("section_order");
const commandLines = lines.slice(commandsIdx + 1).filter((line) => line.trim());
const actual = commandLines.map((line) => line.trim().split(/\s+/)[0]);
if (JSON.stringify(actual) !== JSON.stringify(expected)) problems.push(`commands:${actual.join(",")}`);
for (const line of commandLines) {
  const match = line.match(/^  (export|plan|doctor|config|install|uninstall|selftest)\s+(.+)$/);
  if (!match) problems.push(`command_line:${line}`);
  else if (match[2].includes("\n") || match[2].trim() === "") problems.push(`purpose:${match[1]}`);
}
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
' "$output"
  [ "$status" -eq 0 ] || live_fail_test "$output"
}

@test "command help keeps required and optional sections distinct, including selftest explicit target help" {
  local command=""

  for command in export plan doctor config install uninstall selftest; do
    run_live_cli "$command" --help
    [ "$status" -eq 0 ] || live_fail_test "$command --help rejected: $status"
    assert_help_sections_in_order
    live_assert_equal "" "$stderr" "$command --help stderr"

    run node -e '
const command = process.argv[1];
const text = process.argv[2];
const sections = ["Usage", "Purpose", "Required options", "Optional options", "Examples"];
const expected = {
  export: {
    required: ["--page-id"],
    optional: ["--out", "--safe", "--critical", "--encrypt", "--confidential", "--resume", "--no-fail-fast", "--keep-metadata", "--zip", "--log-file", "--encryption-key", "--max-pages", "--max-download-mib", "--sleep-ms", "--max-find-candidates"]
  },
  plan: {
    required: ["--page-id"],
    optional: ["--out", "--safe", "--critical", "--encrypt", "--confidential", "--no-fail-fast", "--keep-metadata", "--log-file", "--encryption-key", "--max-pages", "--max-download-mib", "--sleep-ms", "--max-find-candidates"]
  },
  doctor: {
    required: [],
    optional: ["--page-id", "--verify-encryption", "--encryption-key", "--log-file"]
  },
  config: {
    required: [],
    optional: ["--encryption-key", "--clear-encryption-key"]
  },
  install: {
    required: [],
    optional: ["--install-dir"]
  },
  uninstall: {
    required: [],
    optional: ["--install-dir"]
  },
  selftest: {
    required: ["--url", "--login", "--password"],
    optional: []
  }
};
const lines = text.split("\n");
const problems = [];
let previous = -1;
for (const section of sections) {
  const idx = lines.indexOf(section);
  if (idx === -1) problems.push(`missing_section:${section}`);
  if (idx <= previous) problems.push(`section_order:${section}`);
  previous = idx;
}
function body(start, end) {
  const startIdx = lines.indexOf(start);
  let endIdx = end ? lines.indexOf(end) : lines.length;
  if (endIdx === -1) endIdx = lines.length;
  return lines.slice(startIdx + 1, endIdx).filter((line) => line.trim());
}
function optionTokens(start, end) {
  const rows = body(start, end).map((line) => line.trim());
  if (rows.length === 1 && rows[0] === "none") return [];
  return rows.map((line) => line.split(/\s+/)[0]);
}
const usageRows = body("Usage", "Purpose");
if (!usageRows.some((line) => line.trim().startsWith(`confluex ${command}`))) problems.push("usage_command");
const purposeRows = body("Purpose", "Required options");
if (purposeRows.length < 1 || purposeRows.some((line) => !line.trim())) problems.push("purpose");
if (command === "selftest") {
  const purpose = purposeRows.join(" ");
  for (const token of ["explicit-target live regression self-test workflow", "already running Confluence 7.13.7 stand", "fixture preparation", "live regression", "self-test report root"]) {
    if (!purpose.includes(token)) problems.push(`purpose_token:${token}`);
  }
}
if (command === "export" && !text.includes("confluex export --page-id <id>")) problems.push("export_example");
const required = optionTokens("Required options", "Optional options");
const optional = optionTokens("Optional options", "Examples");
if (JSON.stringify(required) !== JSON.stringify(expected[command].required)) problems.push(`required:${required.join(",")}`);
if (JSON.stringify(optional) !== JSON.stringify(expected[command].optional)) problems.push(`optional:${optional.join(",")}`);
if (expected[command].required.length === 0 && body("Required options", "Optional options").join("\n").trim() !== "none") problems.push("required_absence");
if (expected[command].optional.length === 0 && body("Optional options", "Examples").join("\n").trim() !== "none") problems.push("optional_absence");
const exampleRows = body("Examples", "Notes");
if (exampleRows.length < 1 || !exampleRows.some((line) => line.trim().startsWith(`confluex ${command}`))) problems.push("examples");
if (problems.length) {
  console.error(`${command}:` + problems.join(`\n${command}:`));
  process.exit(1);
}
' "$command" "$output"
    [ "$status" -eq 0 ] || live_fail_test "$output"
  done
}

@test "unknown commands and invalid export or plan invocations reject on stderr without side effects" {
  local export_out="$LIVE_TMP_ROOT/rejected-export"
  local plan_out="$LIVE_TMP_ROOT/rejected-plan"
  local existing_out="$LIVE_TMP_ROOT/existing-export"
  local invalid_resume_out="$LIVE_TMP_ROOT/invalid-resume"
  local missing_root_out="$LIVE_TMP_ROOT/missing-root-export"
  local export_log="$LIVE_TMP_ROOT/rejected-export.log"
  local unsupported_log="$LIVE_TMP_ROOT/rejected-unsupported.log"
  local root_page_id=""

  run_live_cli bogus
  [ "$status" -eq 1 ] || live_fail_test "unknown command exit code was $status"
  live_assert_equal "" "$output" "unknown command stdout"
  assert_stderr_starts_with_error
  [[ "$stderr" == *'ERROR: unknown_command bogus'* ]] || live_fail_test "unknown command stderr mismatch"

  run_live_cli export
  [ "$status" -eq 1 ] || live_fail_test "missing page-id exit code was $status"
  live_assert_equal "" "$output" "missing page-id stdout"
  assert_stderr_starts_with_error
  [[ "$stderr" == *'ERROR: missing_required_option --page-id'* ]] || live_fail_test "missing page-id stderr mismatch"

  run_live_cli export --page-id nope --out "$export_out" --log-file "$export_log"
  [ "$status" -eq 1 ] || live_fail_test "malformed export exit code was $status"
  live_assert_equal "" "$output" "malformed export stdout"
  assert_stderr_starts_with_error
  [[ "$stderr" == *'ERROR: invalid_option_value --page-id'* ]] || live_fail_test "malformed export stderr mismatch"
  [[ ! -e "$export_out" ]] || live_fail_test "rejected export created output root"
  [[ ! -e "$export_log" ]] || live_fail_test "rejected export created log file"

  run_live_cli export --page-id 12345 --max-find-candidates 0 --out "$export_out"
  [ "$status" -eq 1 ] || live_fail_test "invalid max-find-candidates exit code was $status"
  live_assert_equal "" "$output" "invalid max-find-candidates stdout"
  assert_stderr_starts_with_error
  [[ "$stderr" == *'ERROR: invalid_option_value --max-find-candidates'* ]] ||
    live_fail_test "invalid max-find-candidates stderr mismatch"

  run_live_cli export --page-id 12345 --max-pages 0 --out "$export_out"
  [ "$status" -eq 1 ] || live_fail_test "invalid max-pages exit code was $status"
  live_assert_equal "" "$output" "invalid max-pages stdout"
  assert_stderr_starts_with_error
  [[ "$stderr" == *'ERROR: invalid_option_value --max-pages'* ]] ||
    live_fail_test "invalid max-pages stderr mismatch"

  run_live_cli export --page-id 12345 --max-download-mib nope --out "$export_out"
  [ "$status" -eq 1 ] || live_fail_test "invalid max-download-mib exit code was $status"
  live_assert_equal "" "$output" "invalid max-download-mib stdout"
  assert_stderr_starts_with_error
  [[ "$stderr" == *'ERROR: invalid_option_value --max-download-mib'* ]] ||
    live_fail_test "invalid max-download-mib stderr mismatch"

  run_live_cli export --page-id 12345 --sleep-ms -1 --out "$export_out"
  [ "$status" -eq 1 ] || live_fail_test "invalid sleep-ms exit code was $status"
  live_assert_equal "" "$output" "invalid sleep-ms stdout"
  assert_stderr_starts_with_error
  [[ "$stderr" == *'ERROR: invalid_option_value --sleep-ms'* ]] ||
    live_fail_test "invalid sleep-ms stderr mismatch"

  run_live_cli export --page-id 12345 --page-format html --out "$export_out"
  [ "$status" -eq 1 ] || live_fail_test "unsupported page-format exit code was $status"
  live_assert_equal "" "$output" "unsupported page-format stdout"
  assert_stderr_starts_with_error
  [[ "$stderr" == *'ERROR: unsupported_option --page-format'* ]] || live_fail_test "unsupported page-format stderr mismatch"
  [[ ! -e "$export_out" ]] || live_fail_test "unsupported page-format created output root"

  run_live_cli export --page-id 12345 --out ''
  [ "$status" -eq 1 ] || live_fail_test "empty --out exit code was $status"
  live_assert_equal "" "$output" "empty --out stdout"
  assert_stderr_starts_with_error
  [[ "$stderr" == *'ERROR: invalid_option_value --out'* ]] || live_fail_test "empty --out stderr mismatch"

  run_live_cli export --page-id 12345 --log-file ''
  [ "$status" -eq 1 ] || live_fail_test "empty --log-file exit code was $status"
  live_assert_equal "" "$output" "empty --log-file stdout"
  assert_stderr_starts_with_error
  [[ "$stderr" == *'ERROR: invalid_option_value --log-file'* ]] || live_fail_test "empty --log-file stderr mismatch"

  run_live_cli export --page-id 12345 --encryption-key ''
  [ "$status" -eq 1 ] || live_fail_test "empty --encryption-key exit code was $status"
  live_assert_equal "" "$output" "empty --encryption-key stdout"
  assert_stderr_starts_with_error
  [[ "$stderr" == *'ERROR: invalid_option_value --encryption-key'* ]] || live_fail_test "empty --encryption-key stderr mismatch"

  for invalid_key in $'abc\tdef' $'abc\ndef' $'abc\rdef'; do
    run_live_cli export --page-id 12345 --encryption-key "$invalid_key" --out "$export_out"
    [ "$status" -eq 1 ] || live_fail_test "control-character --encryption-key exit code was $status"
    live_assert_equal "" "$output" "control-character --encryption-key stdout"
    assert_stderr_starts_with_error
    [[ "$stderr" == *'ERROR: invalid_option_value --encryption-key'* ]] ||
      live_fail_test "control-character --encryption-key stderr mismatch: $stderr"
  done

  run_live_cli config --encryption-key none
  [ "$status" -eq 1 ] || live_fail_test "reserved encryption key exit code was $status"
  live_assert_equal "" "$output" "reserved encryption key stdout"
  assert_stderr_starts_with_error
  [[ "$stderr" == *'ERROR: invalid_option_value --encryption-key'* ]] ||
    live_fail_test "reserved encryption key stderr mismatch"

  run_live_cli doctor --encryption-key 0123456789ABCDEF0123456789ABCDEF01234567
  [ "$status" -eq 1 ] || live_fail_test "doctor encryption-key without verify exit code was $status"
  live_assert_equal "" "$output" "doctor encryption-key without verify stdout"
  assert_stderr_starts_with_error
  [[ "$stderr" == *'ERROR: invalid_option_combination --encryption-key,--verify-encryption'* ]] ||
    live_fail_test "doctor encryption-key without verify stderr mismatch"

  run_live_cli export --page-id 12345 --clear-encryption-key --out "$export_out"
  [ "$status" -eq 1 ] || live_fail_test "export clear-encryption-key exit code was $status"
  live_assert_equal "" "$output" "export clear-encryption-key stdout"
  assert_stderr_starts_with_error
  [[ "$stderr" == *'ERROR: unsupported_option --clear-encryption-key'* ]] ||
    live_fail_test "export clear-encryption-key stderr mismatch"

  run_live_cli export --page-id 12345 --bogus --log-file "$unsupported_log"
  [ "$status" -eq 1 ] || live_fail_test "unknown option exit code was $status"
  live_assert_equal "" "$output" "unknown option stdout"
  assert_stderr_starts_with_error
  [[ "$stderr" == *'ERROR: unsupported_option --bogus'* ]] || live_fail_test "unknown option stderr mismatch"
  [[ ! -e "$unsupported_log" ]] || live_fail_test "unknown option created log file"

  run_live_cli config --clear-encryption-key --encryption-key 0123456789ABCDEF0123456789ABCDEF01234567
  [ "$status" -eq 1 ] || live_fail_test "ambiguous config exit code was $status"
  live_assert_equal "" "$output" "ambiguous config stdout"
  assert_stderr_starts_with_error
  [[ "$stderr" == *'ERROR: invalid_option_combination --clear-encryption-key,--encryption-key'* ]] ||
    live_fail_test "ambiguous config stderr mismatch"

  run_live_cli export --page-id 12345 --critical --no-fail-fast --out "$export_out"
  [ "$status" -eq 1 ] || live_fail_test "critical no-fail-fast exit code was $status"
  live_assert_equal "" "$output" "critical no-fail-fast stdout"
  assert_stderr_starts_with_error
  [[ "$stderr" == *'ERROR: invalid_option_combination --critical,--no-fail-fast'* ]] ||
    live_fail_test "critical no-fail-fast stderr mismatch"

  run_live_cli plan --page-id 12345 --confidential --no-fail-fast --out "$plan_out"
  [ "$status" -eq 1 ] || live_fail_test "confidential no-fail-fast exit code was $status"
  live_assert_equal "" "$output" "confidential no-fail-fast stdout"
  assert_stderr_starts_with_error
  [[ "$stderr" == *'ERROR: invalid_option_combination --confidential,--no-fail-fast'* ]] ||
    live_fail_test "confidential no-fail-fast stderr mismatch"

  mkdir -p "$plan_out"
  run_live_cli plan --page-id 12345 --resume --out "$plan_out"
  [ "$status" -eq 1 ] || live_fail_test "invalid plan exit code was $status"
  live_assert_equal "" "$output" "invalid plan stdout"
  assert_stderr_starts_with_error
  [[ "$stderr" == *'ERROR: unsupported_option --resume'* ]] || live_fail_test "invalid plan stderr mismatch"
  [[ ! -e "$plan_out/manifest.tsv" ]] || live_fail_test "rejected plan reused output root"

  run_live_cli doctor --max-find-candidates 1
  [ "$status" -eq 1 ] || live_fail_test "doctor unsupported max-find-candidates exit code was $status"
  live_assert_equal "" "$output" "doctor unsupported max-find-candidates stdout"
  assert_stderr_starts_with_error
  [[ "$stderr" == *'ERROR: unsupported_option --max-find-candidates'* ]] ||
    live_fail_test "doctor unsupported max-find-candidates stderr mismatch"

  if [[ -z "${CONFLUEX_LIVE_IDENTITY_FILE:-}" || -z "${CONFLUEX_LIVE_CLI_HOME:-}" ]]; then
    skip "existing output-root and root preflight validation require live identities and CLI home"
  fi
  root_page_id="$(node -e 'const fs=require("fs"); const data=JSON.parse(fs.readFileSync(process.env.CONFLUEX_LIVE_IDENTITY_FILE,"utf8")); process.stdout.write(String(data.root_page.page_id));')"

  mkdir -p "$existing_out"
  run --keep-empty-lines --separate-stderr env HOME="$CONFLUEX_LIVE_CLI_HOME" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    export \
    --page-id "$root_page_id" \
    --out "$existing_out"
  output="${output%$'\n'}"
  stderr="${stderr%$'\n'}"
  [ "$status" -eq 1 ] || live_fail_test "existing --out export exit code was $status"
  live_assert_equal "" "$output" "existing --out export stdout"
  assert_stderr_starts_with_error
  [[ "$stderr" == *'output directory already exists:'* ]] || live_fail_test "existing --out stderr mismatch: $stderr"
  [[ ! -e "$existing_out/summary.txt" ]] || live_fail_test "existing --out export wrote summary"

  mkdir -p "$invalid_resume_out"
  run --keep-empty-lines --separate-stderr env HOME="$CONFLUEX_LIVE_CLI_HOME" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    export \
    --page-id "$root_page_id" \
    --resume \
    --out "$invalid_resume_out"
  output="${output%$'\n'}"
  stderr="${stderr%$'\n'}"
  [ "$status" -eq 1 ] || live_fail_test "invalid resume export exit code was $status"
  live_assert_equal "" "$output" "invalid resume export stdout"
  assert_stderr_starts_with_error
  [[ "$stderr" == *'--resume requires an existing summary.txt'* || "$stderr" == *'--resume requires an existing manifest.tsv'* ]] ||
    live_fail_test "invalid resume stderr mismatch: $stderr"
  [[ ! -e "$invalid_resume_out/manifest.tsv" ]] || live_fail_test "invalid resume wrote manifest"

  run --keep-empty-lines --separate-stderr env HOME="$CONFLUEX_LIVE_CLI_HOME" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    export \
    --page-id 999999999999 \
    --out "$missing_root_out"
  output="${output%$'\n'}"
  stderr="${stderr%$'\n'}"
  [ "$status" -eq 1 ] || live_fail_test "missing root preflight exit code was $status"
  live_assert_equal "" "$output" "missing root preflight stdout"
  assert_stderr_starts_with_error
  [[ "$stderr" == *'ERROR: validation_failed FR-0017 --page-id 999999999999'* ]] ||
    live_fail_test "missing root preflight stderr mismatch"
  [[ ! -e "$missing_root_out" ]] || live_fail_test "missing root preflight created output root"

  run_live_cli plan --page-id 12345 --page-format html --log-file "$unsupported_log"
  [ "$status" -eq 1 ] || live_fail_test "plan unsupported option exit code was $status"
  live_assert_equal "" "$output" "plan unsupported option stdout"
  assert_stderr_starts_with_error
  [[ "$stderr" == *'ERROR: unsupported_option --page-format'* ]] || live_fail_test "plan unsupported option stderr mismatch"
  [[ ! -e "$unsupported_log" ]] || live_fail_test "plan unsupported option created log file"
}

@test "repeated options use deterministic last-value semantics and repeated flags stay idempotent" {
  local first_out="$LIVE_TMP_ROOT/repeated-first"
  local second_out="$LIVE_TMP_ROOT/repeated-second"
  local root_page_id=""

  if [[ -z "${CONFLUEX_LIVE_IDENTITY_FILE:-}" || -z "${CONFLUEX_LIVE_CLI_HOME:-}" ]]; then
    skip "repeated option regression requires live identities and CLI home"
  fi

  root_page_id="$(node -e 'const fs=require("fs"); const data=JSON.parse(fs.readFileSync(process.env.CONFLUEX_LIVE_IDENTITY_FILE,"utf8")); process.stdout.write(String(data.root_page.page_id));')"

  run --keep-empty-lines --separate-stderr env HOME="$CONFLUEX_LIVE_CLI_HOME" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    plan \
    --page-id 1 \
    --page-id "$root_page_id" \
    --out "$first_out" \
    --out "$second_out" \
    --safe \
    --safe
  output="${output%$'\n'}"
  stderr="${stderr%$'\n'}"
  [ "$status" -eq 0 ] || live_fail_test "repeated options run exited $status: $output $stderr"
  [[ ! -e "$first_out" ]] || live_fail_test "first repeated --out value was created"
  [[ -f "$second_out/summary.txt" ]] || live_fail_test "last repeated --out value was not used"
  [[ "$(awk -F= '$1 == "page_id" { print $2 }' "$second_out/summary.txt")" == "$root_page_id" ]] ||
    live_fail_test "last repeated --page-id value was not used"
}

@test "selftest rejects extra options and operands before any new report root is created" {
  local missing_report_root="$LIVE_TMP_ROOT/selftest-missing-report"
  local option_report_root="$LIVE_TMP_ROOT/selftest-option-report"
  local operand_report_root="$LIVE_TMP_ROOT/selftest-operand-report"

  run --keep-empty-lines --separate-stderr env CONFLUEX_SELFTEST_REPORT_ROOT="$missing_report_root" \
    bash "$LIVE_CONFLUEX_REPO_ROOT/confluex" selftest
  output="${output%$'\n'}"
  stderr="${stderr%$'\n'}"
  [ "$status" -eq 1 ] || live_fail_test "selftest missing target exit code was $status"
  live_assert_equal "" "$output" "selftest missing target stdout"
  assert_stderr_starts_with_error
  live_assert_equal 'ERROR: missing_required_option --url' "$stderr" "selftest missing target stderr"
  [[ ! -e "$missing_report_root" ]] || live_fail_test "rejected selftest missing target created report root"

  run --keep-empty-lines --separate-stderr env CONFLUEX_SELFTEST_REPORT_ROOT="$option_report_root" \
    bash "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    selftest --url http://127.0.0.1:8090 --login admin --password admin --safe
  output="${output%$'\n'}"
  stderr="${stderr%$'\n'}"
  [ "$status" -eq 1 ] || live_fail_test "selftest extra option exit code was $status"
  live_assert_equal "" "$output" "selftest extra option stdout"
  assert_stderr_starts_with_error
  [[ "$stderr" == *'ERROR: unsupported_option --safe'* ]] || live_fail_test "selftest extra option stderr mismatch"
  [[ ! -e "$option_report_root" ]] || live_fail_test "rejected selftest option created report root"

  run --keep-empty-lines --separate-stderr env CONFLUEX_SELFTEST_REPORT_ROOT="$operand_report_root" \
    bash "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    selftest --url http://127.0.0.1:8090 --login admin --password admin extra-operand
  output="${output%$'\n'}"
  stderr="${stderr%$'\n'}"
  [ "$status" -eq 1 ] || live_fail_test "selftest extra operand exit code was $status"
  live_assert_equal "" "$output" "selftest extra operand stdout"
  assert_stderr_starts_with_error
  [[ "$stderr" == *'ERROR: unsupported_positional_operand extra-operand'* ]] || live_fail_test "selftest extra operand stderr mismatch"
  [[ ! -e "$operand_report_root" ]] || live_fail_test "rejected selftest operand created report root"
}
