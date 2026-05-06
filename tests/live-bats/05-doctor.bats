#!/usr/bin/env bats

source "${BATS_TEST_DIRNAME}/helpers/live_confluex_helper.bash"

EXPECTATIONS_FILE="${CONFLUEX_LIVE_EXPECTATIONS_FILE:-${BATS_TEST_DIRNAME}/../../tests/fixtures/confluence-7137/expected/live-command-expectations.json}"

setup() {
  bats_require_minimum_version 1.5.0

  if [[ -z "${CONFLUEX_LIVE_IDENTITY_FILE:-}" || -z "${CONFLUEX_LIVE_CLI_HOME:-}" || -z "${CONFLUEX_LIVE_REPORT_ROOT:-}" ]]; then
    skip "doctor live regression requires identities, CLI home, and report root"
  fi

  export ROOT_PAGE_ID
  ROOT_PAGE_ID="$(node -e 'const fs=require("fs"); const data=JSON.parse(fs.readFileSync(process.env.CONFLUEX_LIVE_IDENTITY_FILE,"utf8")); process.stdout.write(String(data.root_page.page_id));')"
}

make_doctor_gpg_fingerprint() {
  local gpg_home="$1"
  local identity="confluex-doctor@example.invalid"

  mkdir -p "$gpg_home"
  chmod 700 "$gpg_home"
  GNUPGHOME="$gpg_home" gpg --batch --pinentry-mode loopback --passphrase '' \
    --quick-generate-key "$identity" rsa2048 encrypt 1d >/dev/null 2>&1
  GNUPGHOME="$gpg_home" gpg --with-colons --list-keys "$identity" |
    awk -F: '$1 == "fpr" { print $10; exit }'
}

@test "doctor emits the docs-defined stdout contract without optional checks" {
  run env HOME="$CONFLUEX_LIVE_CLI_HOME" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    doctor
  [ "$status" -eq 0 ]
  printf '%s\n' "$output" > "$CONFLUEX_LIVE_REPORT_ROOT/doctor.stdout"
  : > "$CONFLUEX_LIVE_REPORT_ROOT/doctor.stderr"

  run node -e '
const fs = require("fs");
const stdoutText = fs.readFileSync(process.argv[1], "utf8");
const expected = JSON.parse(fs.readFileSync(process.argv[2], "utf8")).doctor;
const lines = stdoutText.trim().split("\n");
const problems = [];
const dependencyPattern = /^dependency_(parser_runtime|confluence_cli|gpg)=(absent|present:unknown_version|present:[^\t\r\n]+)$/;
const expectedLines = [
  /^dependency_parser_runtime=(absent|present:unknown_version|present:[^\t\r\n]+)$/,
  /^dependency_confluence_cli=(absent|present:unknown_version|present:[^\t\r\n]+)$/,
  /^dependency_gpg=(absent|present:unknown_version|present:[^\t\r\n]+)$/,
  /^page_access=skipped$/,
  /^encryption_recipient=skipped$/,
  new RegExp(`^support_profile=${expected.support_profile}$`),
  new RegExp(`^supported_link_forms=${expected.supported_link_forms.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
  /^next_action=none$/
];
if (lines.length !== expectedLines.length) {
  problems.push(`line_count:${lines.length}`);
}
for (let idx = 0; idx < expectedLines.length && idx < lines.length; idx += 1) {
  if (!expectedLines[idx].test(lines[idx])) {
    problems.push(`line_${idx + 1}:${lines[idx]}`);
  }
}
for (const line of lines.slice(0, 3)) {
  if (!dependencyPattern.test(line)) {
    problems.push(`dependency_format:${line}`);
  }
}
if (problems.length) {
  console.error(problems.join("\\n"));
  process.exit(1);
}
' "$CONFLUEX_LIVE_REPORT_ROOT/doctor.stdout" "$EXPECTATIONS_FILE"
  [ "$status" -eq 0 ] || live_fail_test "$output"

  run test ! -s "$CONFLUEX_LIVE_REPORT_ROOT/doctor.stderr"
  [ "$status" -eq 0 ]
}

@test "doctor emits page-access diagnostics and the full docs-defined stdout contract for the canonical root" {
  run env HOME="$CONFLUEX_LIVE_CLI_HOME" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    doctor \
    --page-id "$ROOT_PAGE_ID"
  [ "$status" -eq 0 ]
  printf '%s\n' "$output" > "$CONFLUEX_LIVE_REPORT_ROOT/doctor.stdout"
  : > "$CONFLUEX_LIVE_REPORT_ROOT/doctor.stderr"

  run node -e '
const fs = require("fs");
const stdoutText = fs.readFileSync(process.argv[1], "utf8");
const expected = JSON.parse(fs.readFileSync(process.argv[2], "utf8")).doctor;
const rootPageId = process.argv[3];
const lines = stdoutText.trim().split("\n");
const problems = [];
const expectedLines = [
  /^dependency_parser_runtime=(absent|present:unknown_version|present:[^\t\r\n]+)$/,
  /^dependency_confluence_cli=(absent|present:unknown_version|present:[^\t\r\n]+)$/,
  /^dependency_gpg=(absent|present:unknown_version|present:[^\t\r\n]+)$/,
  /^page_access=ok$/,
  new RegExp(`^page_identity=${rootPageId}$`),
  new RegExp(`^encryption_recipient=${expected.encryption_recipient}$`),
  new RegExp(`^support_profile=${expected.support_profile}$`),
  new RegExp(`^supported_link_forms=${expected.supported_link_forms.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
  /^next_action=none$/
];
if (lines.length !== expectedLines.length) {
  problems.push(`line_count:${lines.length}`);
}
for (let idx = 0; idx < expectedLines.length && idx < lines.length; idx += 1) {
  if (!expectedLines[idx].test(lines[idx])) {
    problems.push(`line_${idx + 1}:${lines[idx]}`);
  }
}
if (problems.length) {
  console.error(problems.join("\\n"));
  process.exit(1);
}
' "$CONFLUEX_LIVE_REPORT_ROOT/doctor.stdout" "$EXPECTATIONS_FILE" "$ROOT_PAGE_ID"
  [ "$status" -eq 0 ] || live_fail_test "$output"

  run test ! -s "$CONFLUEX_LIVE_REPORT_ROOT/doctor.stderr"
  [ "$status" -eq 0 ]
}

@test "doctor reports failed page access without page identity and suggests check_page_access" {
  run --keep-empty-lines --separate-stderr env HOME="$CONFLUEX_LIVE_CLI_HOME" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    doctor \
    --page-id 999999999999
  output="${output%$'\n'}"
  stderr="${stderr%$'\n'}"
  [ "$status" -eq 0 ] || live_fail_test "doctor inaccessible page exited $status: $output $stderr"
  live_assert_equal "" "$stderr" "doctor inaccessible page stderr"

  run node -e '
const text = process.argv[1];
const expected = JSON.parse(process.argv[2]);
const lines = text.trim().split("\n");
const problems = [];
const expectedLines = [
  /^dependency_parser_runtime=(absent|present:unknown_version|present:[^\t\r\n]+)$/,
  /^dependency_confluence_cli=(absent|present:unknown_version|present:[^\t\r\n]+)$/,
  /^dependency_gpg=(absent|present:unknown_version|present:[^\t\r\n]+)$/,
  /^page_access=failed$/,
  /^encryption_recipient=skipped$/,
  new RegExp(`^support_profile=${expected.support_profile}$`),
  new RegExp(`^supported_link_forms=${expected.supported_link_forms.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
  /^next_action=check_page_access$/
];
if (lines.length !== expectedLines.length) problems.push(`line_count:${lines.length}`);
if (lines.some((line) => line.startsWith("page_identity="))) problems.push("unexpected_page_identity");
for (let idx = 0; idx < expectedLines.length && idx < lines.length; idx += 1) {
  if (!expectedLines[idx].test(lines[idx])) problems.push(`line_${idx + 1}:${lines[idx]}`);
}
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
  ' "$output" "$(node -e 'const fs=require("fs"); process.stdout.write(JSON.stringify(JSON.parse(fs.readFileSync(process.argv[1],"utf8")).doctor))' "$EXPECTATIONS_FILE")"
  [ "$status" -eq 0 ] || live_fail_test "$output"
}

@test "doctor next_action reports missing local dependency tokens in docs-defined order" {
  local shim_dir=""

  shim_dir="$(mktemp -d)"
  for command_name in bash node gpg dirname basename sed; do
    ln -s "$(command -v "$command_name")" "$shim_dir/$command_name"
  done

  run --keep-empty-lines --separate-stderr env HOME="$CONFLUEX_LIVE_CLI_HOME" PATH="$shim_dir" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    doctor
  output="${output%$'\n'}"
  stderr="${stderr%$'\n'}"
  rm -rf "$shim_dir"
  [ "$status" -eq 0 ] || live_fail_test "doctor missing dependency exited $status: $output $stderr"
  live_assert_equal "" "$stderr" "doctor missing dependency stderr"
  [[ "$output" == *$'dependency_confluence_cli=absent'* ]] ||
    live_fail_test "doctor missing dependency did not report absent confluence CLI: $output"
  [[ "$output" == *$'next_action=install_confluence_cli'* ]] ||
    live_fail_test "doctor missing dependency next_action mismatch: $output"
}

@test "doctor verifies missing, valid, invalid, and precedence-selected encryption recipients" {
  local tmp_root=""
  local gpg_home=""
  local fingerprint=""
  local config_home=""
  local config_xdg=""

  tmp_root="$(mktemp -d)"
  gpg_home="$tmp_root/gnupg"
  config_home="$tmp_root/home"
  config_xdg="$tmp_root/xdg"
  mkdir -p "$config_home" "$config_xdg"
  fingerprint="$(make_doctor_gpg_fingerprint "$gpg_home")"
  [[ "$fingerprint" =~ ^[A-F0-9]{40}$ ]] || live_fail_test "failed to create doctor GPG fingerprint"

  run env HOME="$config_home" XDG_CONFIG_HOME="$config_xdg" GNUPGHOME="$gpg_home" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    doctor \
    --verify-encryption
  [ "$status" -eq 0 ]
  [[ "$output" == *$'encryption_recipient=missing'* ]] || live_fail_test "doctor missing recipient mismatch: $output"
  [[ "$output" == *$'next_action=set_encryption_key'* ]] || live_fail_test "doctor missing recipient next_action mismatch: $output"

  run env HOME="$config_home" XDG_CONFIG_HOME="$config_xdg" GNUPGHOME="$gpg_home" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    config \
    --encryption-key "$fingerprint"
  [ "$status" -eq 0 ]

  run env HOME="$config_home" XDG_CONFIG_HOME="$config_xdg" GNUPGHOME="$gpg_home" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    doctor \
    --verify-encryption
  [ "$status" -eq 0 ]
  [[ "$output" == *$'encryption_recipient=ok'* ]] || live_fail_test "doctor saved valid recipient mismatch: $output"
  [[ "$output" == *$'next_action=none'* ]] || live_fail_test "doctor saved valid next_action mismatch: $output"

  run --keep-empty-lines --separate-stderr env HOME="$config_home" XDG_CONFIG_HOME="$config_xdg" GNUPGHOME="$gpg_home" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    doctor \
    --verify-encryption \
    --encryption-key none
  output="${output%$'\n'}"
  stderr="${stderr%$'\n'}"
  [ "$status" -eq 1 ] || live_fail_test "doctor reserved recipient exited $status"
  live_assert_equal "" "$output" "doctor reserved recipient stdout"
  [[ "$stderr" == ERROR:\ *'--encryption-key cannot be the reserved value none'* ]] ||
    live_fail_test "doctor reserved recipient stderr mismatch: $stderr"

  run env HOME="$config_home" XDG_CONFIG_HOME="$config_xdg" GNUPGHOME="$gpg_home" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    doctor \
    --verify-encryption \
    --encryption-key "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"
  [ "$status" -eq 0 ]
  [[ "$output" == *$'encryption_recipient=failed'* ]] || live_fail_test "doctor invalid cli recipient mismatch: $output"
  [[ "$output" == *$'next_action=fix_encryption_key'* ]] || live_fail_test "doctor invalid cli next_action mismatch: $output"

  rm -rf "$tmp_root"
}
