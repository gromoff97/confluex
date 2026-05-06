#!/usr/bin/env bats

source "${BATS_TEST_DIRNAME}/helpers/live_confluex_helper.bash"

setup() {
  bats_require_minimum_version 1.5.0

  if [[ -z "${CONFLUEX_LIVE_IDENTITY_FILE:-}" || -z "${CONFLUEX_LIVE_CLI_HOME:-}" || -z "${CONFLUEX_LIVE_REPORT_ROOT:-}" ]]; then
    skip "config/install/security/resume regression requires identities, CLI home, and report root"
  fi

  export ROOT_PAGE_ID
  export LINKED_PAGE_ID
  ROOT_PAGE_ID="$(node -e 'const fs=require("fs"); const data=JSON.parse(fs.readFileSync(process.env.CONFLUEX_LIVE_IDENTITY_FILE,"utf8")); process.stdout.write(String(data.root_page.page_id));')"
  LINKED_PAGE_ID="$(node -e 'const fs=require("fs"); const data=JSON.parse(fs.readFileSync(process.env.CONFLUEX_LIVE_IDENTITY_FILE,"utf8")); process.stdout.write(String(data.linked_page.page_id));')"
  export LIVE_LOCAL_TMP_ROOT
  LIVE_LOCAL_TMP_ROOT="$(mktemp -d)"
}

teardown() {
  rm -rf "$LIVE_LOCAL_TMP_ROOT"
}

summary_value() {
  local summary_path="$1"
  local key="$2"
  node -e '
const fs = require("fs");
const summary = Object.fromEntries(
  fs.readFileSync(process.argv[1], "utf8")
    .trim()
    .split("\n")
    .map((line) => {
      const idx = line.indexOf("=");
      return [line.slice(0, idx), line.slice(idx + 1)];
    })
);
process.stdout.write(summary[process.argv[2]] ?? "");
' "$summary_path" "$key"
}

tsv_data_row_count() {
  local tsv_path="$1"
  if [[ ! -f "$tsv_path" ]]; then
    printf '0\n'
    return 0
  fi
  awk 'END { print (NR > 0 ? NR - 1 : 0) }' "$tsv_path"
}

write_resume_candidate() {
  local out_dir="$1"
  local page_id="$2"
  local resume_mode="$3"
  local schema_version="$4"
  local processed_pages="$5"
  local include_incomplete="$6"
  local payload_format="${7:-md}"
  local final_status="${8:-incomplete}"

  mkdir -p "$out_dir"
  if (( include_incomplete )); then
    : > "$out_dir/INCOMPLETE"
  fi
  cat > "$out_dir/summary.txt" <<EOF
command=export
page_id=$page_id
output_root="$out_dir"
zip_path=none
output_path_provenance=explicit
support_profile=default
page_payload_format=$payload_format
final_status=$final_status
scope_trust=degraded
processed_pages=$processed_pages
root_pages=1
tree_pages=0
linked_pages=0
other_pages=0
resolved_links=0
unresolved_links=0
scope_findings=0
failed_operations=0
downloaded_mib_total=0.000
downloaded_mib_content=0.000
downloaded_mib_metadata=0.000
blocking_reasons=none
interrupt_reason=max_pages_limit_reached
resume_mode=$resume_mode
resume_schema_version=$schema_version
reused_pages=0
fresh_pages=1
encryption_enabled=0
encryption_successful=0
EOF
  cat > "$out_dir/manifest.tsv" <<EOF
page_id	space_key	page_title	folder	discovery_source	run_mode	attachment_count
$page_id	CFX	Resume Candidate	pages/space__434658/page__$page_id	root	export	0
EOF
  cat > "$out_dir/resolved-links.tsv" <<'EOF'
source_page_id	source_title	link_kind	raw_link_value	target_page_id	target_space_key	target_title
EOF
  cat > "$out_dir/unresolved-links.tsv" <<'EOF'
source_page_id	source_title	link_kind	raw_link_value	resolution_reason
EOF
  cat > "$out_dir/failed-pages.tsv" <<'EOF'
page_id	page_title	operation	error_summary
EOF
  cat > "$out_dir/scope-findings.tsv" <<'EOF'
page_id	finding_area	finding_type	detail
EOF
}

wait_for_manifest_rows() {
  local manifest_path="$1"
  local pid="$2"
  local label="$3"
  local attempts=240
  local rows=0

  while (( attempts > 0 )); do
    rows="$(tsv_data_row_count "$manifest_path")"
    if (( rows > 0 )); then
      return 0
    fi
    if ! kill -0 "$pid" 2>/dev/null; then
      live_fail_test "$label exited before writing any manifest row"
      return 1
    fi
    attempts=$((attempts - 1))
    sleep 0.25
  done

  live_fail_test "$label did not write a manifest row before timeout"
}

make_gpg_fingerprint() {
  local gpg_home="$1"
  local identity="confluex-selftest@example.invalid"

  mkdir -p "$gpg_home"
  chmod 700 "$gpg_home"
  GNUPGHOME="$gpg_home" gpg --batch --pinentry-mode loopback --passphrase '' \
    --quick-generate-key "$identity" rsa2048 encrypt 1d >/dev/null 2>&1
  GNUPGHOME="$gpg_home" gpg --with-colons --list-keys "$identity" 2>/dev/null |
    awk -F: '$1 == "fpr" { print $10; exit }'
}

make_signing_only_gpg_fingerprint() {
  local gpg_home="$1"
  local identity="confluex-signing-only@example.invalid"

  mkdir -p "$gpg_home"
  chmod 700 "$gpg_home"
  GNUPGHOME="$gpg_home" gpg --batch --pinentry-mode loopback --passphrase '' \
    --quick-generate-key "$identity" rsa2048 sign 1d >/dev/null 2>&1
  GNUPGHOME="$gpg_home" gpg --with-colons --list-keys "$identity" 2>/dev/null |
    awk -F: '$1 == "fpr" { print $10; exit }'
}

@test "config shows, saves, and clears the docs-defined default encryption recipient" {
  local home="$LIVE_LOCAL_TMP_ROOT/config-home"
  local xdg="$LIVE_LOCAL_TMP_ROOT/config-xdg"
  local key="0123456789ABCDEF0123456789ABCDEF01234567"

  mkdir -p "$home" "$xdg"

  run env HOME="$home" XDG_CONFIG_HOME="$xdg" "$LIVE_CONFLUEX_REPO_ROOT/confluex" config
  [ "$status" -eq 0 ]
  live_assert_equal "default_encryption_key=none" "$output" "empty config stdout"

  run env HOME="$home" XDG_CONFIG_HOME="$xdg" "$LIVE_CONFLUEX_REPO_ROOT/confluex" config --encryption-key "$key"
  [ "$status" -eq 0 ]
  live_assert_equal "default_encryption_key=$key" "$output" "saved config stdout"

  run env HOME="$home" XDG_CONFIG_HOME="$xdg" "$LIVE_CONFLUEX_REPO_ROOT/confluex" config
  [ "$status" -eq 0 ]
  live_assert_equal "default_encryption_key=$key" "$output" "shown config stdout"

  run env HOME="$home" XDG_CONFIG_HOME="$xdg" "$LIVE_CONFLUEX_REPO_ROOT/confluex" config --clear-encryption-key
  [ "$status" -eq 0 ]
  live_assert_equal "default_encryption_key=none" "$output" "cleared config stdout"
}

@test "log-file creates normalized persistent logs, overwrites old content, and rejects directories" {
  local workdir="$LIVE_LOCAL_TMP_ROOT/log-file-workdir"
  local log_path="$workdir/doctor.log"
  local log_dir="$LIVE_LOCAL_TMP_ROOT/log-file-directory"
  local export_out="$LIVE_LOCAL_TMP_ROOT/log-file-rejected-export"
  local inside_out="$LIVE_LOCAL_TMP_ROOT/log-file-inside-output"
  local inside_log="$inside_out/run.log"

  mkdir -p "$workdir" "$log_dir"
  printf 'stale log\n' > "$log_path"

  run --keep-empty-lines --separate-stderr env HOME="$CONFLUEX_LIVE_CLI_HOME" bash -lc \
    "cd '$workdir' && '$LIVE_CONFLUEX_REPO_ROOT/confluex' doctor --log-file './logs/../doctor.log'"
  output="${output%$'\n'}"
  stderr="${stderr%$'\n'}"
  [ "$status" -eq 0 ] || live_fail_test "doctor log-file exited $status: $output $stderr"
  live_assert_equal "" "$stderr" "doctor log-file stderr"
  [[ -f "$log_path" ]] || live_fail_test "normalized doctor log file missing"
  [[ "$(cat "$log_path")" != *'stale log'* ]] || live_fail_test "doctor log file was not overwritten"
  [[ "$(cat "$log_path")" == *'dependency_parser_runtime='* ]] || live_fail_test "doctor log missing current stdout contract"

  run --keep-empty-lines --separate-stderr env HOME="$CONFLUEX_LIVE_CLI_HOME" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    doctor \
    --log-file "$log_dir"
  output="${output%$'\n'}"
  stderr="${stderr%$'\n'}"
  [ "$status" -eq 1 ] || live_fail_test "doctor directory log-file exit code was $status"
  live_assert_equal "" "$output" "doctor directory log-file stdout"
  [[ "$stderr" == ERROR:\ *'--log-file must not resolve to a directory'* ]] ||
    live_fail_test "doctor directory log-file stderr mismatch: $stderr"

  run --keep-empty-lines --separate-stderr env HOME="$CONFLUEX_LIVE_CLI_HOME" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    export \
    --page-id "$LINKED_PAGE_ID" \
    --out "$export_out" \
    --log-file "$log_dir"
  output="${output%$'\n'}"
  stderr="${stderr%$'\n'}"
  [ "$status" -eq 1 ] || live_fail_test "export directory log-file exit code was $status"
  live_assert_equal "" "$output" "export directory log-file stdout"
  [[ "$stderr" == ERROR:\ *'--log-file must not resolve to a directory'* ]] ||
    live_fail_test "export directory log-file stderr mismatch: $stderr"
  [[ ! -e "$export_out" ]] || live_fail_test "rejected export directory log-file created output root"

  run --keep-empty-lines --separate-stderr env HOME="$CONFLUEX_LIVE_CLI_HOME" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    export \
    --page-id "$LINKED_PAGE_ID" \
    --out "$inside_out" \
    --log-file "$inside_log"
  output="${output%$'\n'}"
  stderr="${stderr%$'\n'}"
  [ "$status" -eq 1 ] || live_fail_test "inside-output log-file exit code was $status"
  live_assert_equal "" "$output" "inside-output log-file stdout"
  [[ "$stderr" == ERROR:\ *'--log-file must not be inside the output root'* ]] ||
    live_fail_test "inside-output log-file stderr mismatch: $stderr"
  [[ ! -e "$inside_out" ]] || live_fail_test "rejected inside-output log-file created output root"
}

@test "install and uninstall create and remove only the docs-defined Confluex-owned footprint" {
  local install_dir="$LIVE_LOCAL_TMP_ROOT/install-target/nested/bin"
  local default_home="$LIVE_LOCAL_TMP_ROOT/default-install-home"
  local default_target="$default_home/.local/bin"
  local windows_home="$LIVE_LOCAL_TMP_ROOT/windows-default-home"
  local windows_target="${windows_home}\\.local\\bin"
  local windows_target_quoted=""
  local windows_profile='C:\Users\Confluex'
  local windows_profile_target='C:\Users\Confluex\.local\bin'
  local windows_profile_target_quoted=""
  local non_directory_target="$LIVE_LOCAL_TMP_ROOT/not-a-directory"
  local invalid_manifest_dir="$LIVE_LOCAL_TMP_ROOT/invalid-manifest-target"
  local unsorted_manifest_dir="$LIVE_LOCAL_TMP_ROOT/unsorted-manifest-target"
  local unrelated="$install_dir/unrelated.txt"
  local invalid_owned="$invalid_manifest_dir/confluex"
  local invalid_unrelated="$invalid_manifest_dir/unrelated.txt"
  local unsorted_owned="$unsorted_manifest_dir/confluex"
  local unsorted_unrelated="$unsorted_manifest_dir/unrelated.txt"
  local nested_unrelated="$install_dir/lib/extra.txt"
  local scripts_unrelated="$install_dir/scripts/unrelated.sh"
  local fixtures_unrelated="$install_dir/fixtures/unrelated.txt"
  local fixtures_support_unrelated="$install_dir/tests/fixtures/confluence-7137/unrelated.local"
  local tests_support_unrelated="$install_dir/tests/live-bats/unrelated.local"
  local relative_workdir="$LIVE_LOCAL_TMP_ROOT/relative-install-workdir"
  local relative_target="$relative_workdir/bin"
  local relative_target_quoted=""

  mkdir -p \
    "$install_dir/lib" \
    "$install_dir/scripts" \
    "$install_dir/tests/fixtures/confluence-7137" \
    "$install_dir/tests/live-bats"
  printf 'keep me\n' > "$unrelated"
  printf 'keep script\n' > "$scripts_unrelated"
  printf 'keep fixture\n' > "$fixtures_unrelated"
  printf 'keep fixture support\n' > "$fixtures_support_unrelated"
  printf 'keep tests support\n' > "$tests_support_unrelated"

  run --keep-empty-lines --separate-stderr "$LIVE_CONFLUEX_REPO_ROOT/confluex" install --install-dir "$install_dir"
  output="${output%$'\n'}"
  stderr="${stderr%$'\n'}"
  [ "$status" -eq 0 ]
  live_assert_equal "install_result=installed target=\"$install_dir\"" "$output" "install stdout"
  live_assert_equal "" "$stderr" "install stderr"
  [[ -x "$install_dir/confluex" ]] || live_fail_test "installed confluex is not executable"
  [[ -f "$install_dir/.confluex-install-manifest.txt" ]] || live_fail_test "install manifest missing"
  run node -e '
const fs = require("fs");
const path = require("path");
const target = process.argv[1];
const manifest = path.join(target, ".confluex-install-manifest.txt");
const lines = fs.readFileSync(manifest, "utf8").split("\n");
if (lines.at(-1) === "") lines.pop();
const problems = [];
const sorted = [...lines].sort((a, b) => Buffer.from(a).compare(Buffer.from(b)));
if (lines.length === 0) problems.push("empty");
if (new Set(lines).size !== lines.length) problems.push("duplicates");
if (lines.join("\n") !== sorted.join("\n")) problems.push("not_sorted");
if (!lines.includes(".confluex-install-manifest.txt")) problems.push("missing_manifest_entry");
if (!lines.includes("confluex")) problems.push("missing_entrypoint");
for (const required of ["lib/confluex-node", "tests/fixtures/confluence-7137", "tests/live-bats"]) {
  if (!lines.includes(required)) problems.push(`missing_runtime_support:${required}`);
  if (!fs.existsSync(path.join(target, required))) problems.push(`missing_runtime_support_path:${required}`);
}
for (const unrelated of [
  "scripts/unrelated.sh",
  "fixtures/unrelated.txt",
  "tests/fixtures/confluence-7137/unrelated.local",
  "tests/live-bats/unrelated.local",
  "lib",
  "scripts",
  "fixtures",
  "docker",
  "tests"
]) {
  if (lines.includes(unrelated)) problems.push(`unrelated_manifest_entry:${unrelated}`);
}
for (const line of lines) {
  if (line === "" || path.isAbsolute(line) || line === "." || line === ".." || line.includes("/../") || line.startsWith("../") || line.includes("/./") || line.startsWith("./")) {
    problems.push(`invalid:${line}`);
  }
  const resolved = path.resolve(target, line);
  if (resolved !== target && !resolved.startsWith(`${target}${path.sep}`)) {
    problems.push(`outside:${line}`);
  }
}
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
' "$install_dir"
  [ "$status" -eq 0 ] || live_fail_test "install manifest invalid: $output"

  run "$install_dir/confluex" --help
  [ "$status" -eq 0 ]
  [[ "$output" == *'confluex <command> [options]'* ]] || live_fail_test "installed confluex help mismatch"
  run "$install_dir/confluex" selftest --help
  [ "$status" -eq 0 ]
  [[ "$output" == *'confluex selftest'* ]] || live_fail_test "installed selftest help mismatch"
  printf 'keep nested\n' > "$nested_unrelated"

  run --keep-empty-lines --separate-stderr "$LIVE_CONFLUEX_REPO_ROOT/confluex" uninstall --install-dir "$install_dir"
  output="${output%$'\n'}"
  stderr="${stderr%$'\n'}"
  [ "$status" -eq 0 ]
  live_assert_equal "uninstall_result=removed target=\"$install_dir\"" "$output" "uninstall stdout"
  live_assert_equal "" "$stderr" "uninstall stderr"
  [[ -f "$unrelated" ]] || live_fail_test "uninstall removed unrelated file"
  [[ -f "$scripts_unrelated" ]] || live_fail_test "uninstall removed unrelated scripts file"
  [[ -f "$fixtures_unrelated" ]] || live_fail_test "uninstall removed unrelated fixtures file"
  [[ -f "$fixtures_support_unrelated" ]] || live_fail_test "uninstall removed unrelated fixtures support file"
  [[ -f "$tests_support_unrelated" ]] || live_fail_test "uninstall removed unrelated tests support file"
  [[ -f "$nested_unrelated" ]] || live_fail_test "uninstall removed unrelated nested file"
  [[ ! -e "$install_dir/confluex" ]] || live_fail_test "uninstall left confluex executable"

  run --keep-empty-lines --separate-stderr "$LIVE_CONFLUEX_REPO_ROOT/confluex" uninstall --install-dir "$install_dir"
  output="${output%$'\n'}"
  stderr="${stderr%$'\n'}"
  [ "$status" -eq 0 ]
  live_assert_equal "uninstall_result=absent target=\"$install_dir\"" "$output" "idempotent uninstall stdout"
  live_assert_equal "" "$stderr" "idempotent uninstall stderr"

  mkdir -p "$relative_workdir/nested"
  relative_target_quoted="$(node -e 'process.stdout.write(JSON.stringify(process.argv[1]))' "$relative_target")"
  run --keep-empty-lines --separate-stderr bash -lc \
    "cd '$relative_workdir' && '$LIVE_CONFLUEX_REPO_ROOT/confluex' install --install-dir './nested/../bin/'"
  output="${output%$'\n'}"
  stderr="${stderr%$'\n'}"
  [ "$status" -eq 0 ]
  live_assert_equal "install_result=installed target=$relative_target_quoted" "$output" "relative install stdout"
  live_assert_equal "" "$stderr" "relative install stderr"
  [[ -x "$relative_target/confluex" ]] || live_fail_test "relative install target missing confluex"

  run --keep-empty-lines --separate-stderr bash -lc \
    "cd '$relative_workdir' && '$LIVE_CONFLUEX_REPO_ROOT/confluex' uninstall --install-dir './nested/../bin/'"
  output="${output%$'\n'}"
  stderr="${stderr%$'\n'}"
  [ "$status" -eq 0 ]
  live_assert_equal "uninstall_result=removed target=$relative_target_quoted" "$output" "relative uninstall stdout"
  live_assert_equal "" "$stderr" "relative uninstall stderr"
  [[ ! -e "$relative_target/confluex" ]] || live_fail_test "relative uninstall left confluex executable"

  mkdir -p "$default_home"
  run --keep-empty-lines --separate-stderr env HOME="$default_home" "$LIVE_CONFLUEX_REPO_ROOT/confluex" install
  output="${output%$'\n'}"
  stderr="${stderr%$'\n'}"
  [ "$status" -eq 0 ]
  live_assert_equal "install_result=installed target=\"$default_target\"" "$output" "default install stdout"
  live_assert_equal "" "$stderr" "default install stderr"
  [[ -x "$default_target/confluex" ]] || live_fail_test "default install target missing confluex"

  run --keep-empty-lines --separate-stderr env HOME="$default_home" "$LIVE_CONFLUEX_REPO_ROOT/confluex" uninstall
  output="${output%$'\n'}"
  stderr="${stderr%$'\n'}"
  [ "$status" -eq 0 ]
  live_assert_equal "uninstall_result=removed target=\"$default_target\"" "$output" "default uninstall stdout"
  live_assert_equal "" "$stderr" "default uninstall stderr"

  mkdir -p "$windows_home"
  windows_target_quoted="$(node -e 'process.stdout.write(JSON.stringify(process.argv[1]))' "$windows_target")"
  run --keep-empty-lines --separate-stderr env OS=Windows_NT USERPROFILE="$windows_home" HOME="$default_home" "$LIVE_CONFLUEX_REPO_ROOT/confluex" install
  output="${output%$'\n'}"
  stderr="${stderr%$'\n'}"
  [ "$status" -eq 0 ]
  live_assert_equal "install_result=installed target=$windows_target_quoted" "$output" "windows default install stdout"
  live_assert_equal "" "$stderr" "windows default install stderr"
  [[ -x "$windows_target/confluex" ]] || live_fail_test "windows default install target missing confluex"

  run --keep-empty-lines --separate-stderr env OS=Windows_NT USERPROFILE="$windows_home" HOME="$default_home" "$LIVE_CONFLUEX_REPO_ROOT/confluex" uninstall
  output="${output%$'\n'}"
  stderr="${stderr%$'\n'}"
  [ "$status" -eq 0 ]
  live_assert_equal "uninstall_result=removed target=$windows_target_quoted" "$output" "windows default uninstall stdout"
  live_assert_equal "" "$stderr" "windows default uninstall stderr"

  windows_profile_target_quoted="$(node -e 'process.stdout.write(JSON.stringify(process.argv[1]))' "$windows_profile_target")"
  run --keep-empty-lines --separate-stderr env OS=Windows_NT USERPROFILE="$windows_profile" HOME="$default_home" "$LIVE_CONFLUEX_REPO_ROOT/confluex" uninstall
  output="${output%$'\n'}"
  stderr="${stderr%$'\n'}"
  [ "$status" -eq 0 ]
  live_assert_equal "uninstall_result=absent target=$windows_profile_target_quoted" "$output" "windows shaped default target stdout"
  live_assert_equal "" "$stderr" "windows shaped default target stderr"

  printf 'not a directory\n' > "$non_directory_target"
  run --keep-empty-lines --separate-stderr "$LIVE_CONFLUEX_REPO_ROOT/confluex" install --install-dir "$non_directory_target"
  output="${output%$'\n'}"
  stderr="${stderr%$'\n'}"
  [ "$status" -eq 1 ] || live_fail_test "install non-directory exit code was $status"
  live_assert_equal "" "$output" "install non-directory stdout"
  [[ "$stderr" == ERROR:\ *'--install-dir must resolve to a directory path'* ]] ||
    live_fail_test "install non-directory stderr mismatch: $stderr"

  mkdir -p "$unsorted_manifest_dir"
  printf 'owned\n' > "$unsorted_owned"
  printf 'unrelated\n' > "$unsorted_unrelated"
  printf 'confluex\n.confluex-install-manifest.txt\n' > "$unsorted_manifest_dir/.confluex-install-manifest.txt"
  run --keep-empty-lines --separate-stderr "$LIVE_CONFLUEX_REPO_ROOT/confluex" uninstall --install-dir "$unsorted_manifest_dir"
  output="${output%$'\n'}"
  stderr="${stderr%$'\n'}"
  [ "$status" -eq 1 ] || live_fail_test "uninstall unsorted manifest exit code was $status"
  live_assert_equal "" "$output" "uninstall unsorted manifest stdout"
  [[ "$stderr" == ERROR:\ *'invalid install manifest'* ]] ||
    live_fail_test "uninstall unsorted manifest stderr mismatch: $stderr"
  [[ -f "$unsorted_owned" ]] || live_fail_test "unsorted manifest uninstall removed owned-looking file"
  [[ -f "$unsorted_unrelated" ]] || live_fail_test "unsorted manifest uninstall removed unrelated file"

  mkdir -p "$invalid_manifest_dir"
  printf 'owned\n' > "$invalid_owned"
  printf 'unrelated\n' > "$invalid_unrelated"
  printf '../escape\n' > "$invalid_manifest_dir/.confluex-install-manifest.txt"
  run --keep-empty-lines --separate-stderr "$LIVE_CONFLUEX_REPO_ROOT/confluex" uninstall --install-dir "$invalid_manifest_dir"
  output="${output%$'\n'}"
  stderr="${stderr%$'\n'}"
  [ "$status" -eq 1 ] || live_fail_test "uninstall invalid manifest exit code was $status"
  live_assert_equal "" "$output" "uninstall invalid manifest stdout"
  [[ "$stderr" == ERROR:\ *'invalid install manifest'* ]] ||
    live_fail_test "uninstall invalid manifest stderr mismatch: $stderr"
  [[ -f "$invalid_owned" ]] || live_fail_test "invalid manifest uninstall removed owned-looking file"
  [[ -f "$invalid_unrelated" ]] || live_fail_test "invalid manifest uninstall removed unrelated file"
}

@test "successful encrypted exports create the docs-defined archive instruction sidecar" {
  local gpg_home="$LIVE_LOCAL_TMP_ROOT/gnupg"
  local out="$LIVE_LOCAL_TMP_ROOT/encrypted-export"
  local plan_out="$LIVE_LOCAL_TMP_ROOT/encrypted-plan"
  local fingerprint=""
  local archive="$out.tar.gz.gpg"
  local tar_path="$out.tar.gz"
  local sidecar="$archive.txt"
  local extract_dir="$LIVE_LOCAL_TMP_ROOT/extracted-export"
  local plan_archive="$plan_out.tar.gz.gpg"
  local plan_tar_path="$plan_out.tar.gz"
  local plan_sidecar="$plan_archive.txt"
  local plan_extract_dir="$LIVE_LOCAL_TMP_ROOT/extracted-plan"
  local expected=""

  fingerprint="$(make_gpg_fingerprint "$gpg_home")"
  [[ "$fingerprint" =~ ^[A-F0-9]{40}$ ]] || live_fail_test "failed to create test GPG fingerprint"
  printf 'final_status=encryption_failed\n' > "$out.status.txt"

  run --keep-empty-lines --separate-stderr env HOME="$CONFLUEX_LIVE_CLI_HOME" GNUPGHOME="$gpg_home" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    export \
    --page-id "$LINKED_PAGE_ID" \
    --out "$out" \
    --safe \
    --encrypt \
    --encryption-key "$fingerprint"
  [ "$status" -eq 0 ] || live_fail_test "encrypted export exited $status: $output $stderr"

  [[ "$output" == *$'RUN_PHASE phase=encryption'* ]] ||
    live_fail_test "encrypted export did not emit encryption phase"
  [[ "$output" == *"RUN_COMPLETE final_status=success artifact=\"$archive\""* ]] ||
    live_fail_test "encrypted export did not prefer encrypted archive artifact: $output"
  [[ ! -d "$out" ]] || live_fail_test "encrypted export retained plain output root"
  [[ -f "$archive" ]] || live_fail_test "encrypted archive missing"
  [[ ! -f "$out.status.txt" ]] || live_fail_test "encrypted export retained stale status sidecar"
  [[ -f "$sidecar" ]] || live_fail_test "encrypted sidecar missing"

  expected="$(cat <<EOF
archive_path="$archive"
decrypt_output_path="$tar_path"
decrypt_command=gpg --output "$tar_path" --decrypt "$archive"
extract_command=tar -xzf "$tar_path"
EOF
)"
  live_assert_equal "$expected" "$(cat "$sidecar")" "encrypted sidecar contents"

  mkdir -p "$extract_dir"
  GNUPGHOME="$gpg_home" gpg --batch --yes --output "$tar_path" --decrypt "$archive" >/dev/null 2>&1 ||
    live_fail_test "encrypted export archive could not be decrypted"
  tar -xzf "$tar_path" -C "$extract_dir"
  run node -e '
const fs = require("fs");
const path = require("path");
const [extractDir, outName] = process.argv.slice(1);
const reportSet = [
  "failed-pages.tsv",
  "manifest.tsv",
  "resolved-links.tsv",
  "scope-findings.tsv",
  "summary.txt",
  "unresolved-links.tsv"
];
const entries = fs.readdirSync(extractDir).sort();
const root = path.join(extractDir, outName);
const rootEntries = fs.existsSync(root) ? fs.readdirSync(root).sort() : [];
const summary = fs.existsSync(path.join(root, "summary.txt"))
  ? Object.fromEntries(fs.readFileSync(path.join(root, "summary.txt"), "utf8").trim().split("\n").map((line) => {
      const idx = line.indexOf("=");
      return [line.slice(0, idx), line.slice(idx + 1)];
    }))
  : {};
const expectedRootEntries = [...reportSet, "pages"].sort();
const problems = [];
if (entries.length !== 1 || entries[0] !== outName) problems.push(`top_level:${entries.join(",")}`);
for (const name of expectedRootEntries) {
  if (!rootEntries.includes(name)) problems.push(`missing:${name}`);
}
for (const name of rootEntries) {
  if (!expectedRootEntries.includes(name)) problems.push(`unexpected:${name}`);
}
if (summary.encryption_enabled !== "1") problems.push(`encryption_enabled:${summary.encryption_enabled}`);
if (summary.encryption_successful !== "1") problems.push(`encryption_successful:${summary.encryption_successful}`);
if (problems.length) {
  console.error(problems.join("\\n"));
  process.exit(1);
}
' "$extract_dir" "$(basename "$out")"
  [ "$status" -eq 0 ] || live_fail_test "$output"

  run env HOME="$CONFLUEX_LIVE_CLI_HOME" GNUPGHOME="$gpg_home" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    plan \
    --page-id "$LINKED_PAGE_ID" \
    --out "$plan_out" \
    --safe \
    --encrypt \
    --encryption-key "$fingerprint"
  [ "$status" -eq 0 ] || live_fail_test "encrypted plan exited $status: $output $stderr"
  [[ "$output" == *$'RUN_PHASE phase=encryption'* ]] ||
    live_fail_test "encrypted plan did not emit encryption phase"
  [[ ! -d "$plan_out" ]] || live_fail_test "encrypted plan retained plain output root"
  [[ -f "$plan_archive" ]] || live_fail_test "encrypted plan archive missing"
  [[ -f "$plan_sidecar" ]] || live_fail_test "encrypted plan sidecar missing"
  expected="$(cat <<EOF
archive_path="$plan_archive"
decrypt_output_path="$plan_tar_path"
decrypt_command=gpg --output "$plan_tar_path" --decrypt "$plan_archive"
extract_command=tar -xzf "$plan_tar_path"
EOF
)"
  live_assert_equal "$expected" "$(cat "$plan_sidecar")" "encrypted plan sidecar contents"
  mkdir -p "$plan_extract_dir"
  GNUPGHOME="$gpg_home" gpg --batch --yes --output "$plan_tar_path" --decrypt "$plan_archive" >/dev/null 2>&1 ||
    live_fail_test "encrypted plan archive could not be decrypted"
  tar -xzf "$plan_tar_path" -C "$plan_extract_dir"
  run node -e '
const fs = require("fs");
const path = require("path");
const [extractDir, outName] = process.argv.slice(1);
const expectedRootEntries = [
  "failed-pages.tsv",
  "manifest.tsv",
  "resolved-links.tsv",
  "scope-findings.tsv",
  "summary.txt",
  "unresolved-links.tsv"
].sort();
const entries = fs.readdirSync(extractDir).sort();
const root = path.join(extractDir, outName);
const rootEntries = fs.existsSync(root) ? fs.readdirSync(root).sort() : [];
const summary = fs.existsSync(path.join(root, "summary.txt"))
  ? Object.fromEntries(fs.readFileSync(path.join(root, "summary.txt"), "utf8").trim().split("\n").map((line) => {
      const idx = line.indexOf("=");
      return [line.slice(0, idx), line.slice(idx + 1)];
    }))
  : {};
const problems = [];
if (entries.length !== 1 || entries[0] !== outName) problems.push(`top_level:${entries.join(",")}`);
for (const name of expectedRootEntries) {
  if (!rootEntries.includes(name)) problems.push(`missing:${name}`);
}
for (const name of rootEntries) {
  if (!expectedRootEntries.includes(name)) problems.push(`unexpected:${name}`);
}
if (summary.encryption_enabled !== "1") problems.push(`encryption_enabled:${summary.encryption_enabled}`);
if (summary.encryption_successful !== "1") problems.push(`encryption_successful:${summary.encryption_successful}`);
if (problems.length) {
  console.error(problems.join("\\n"));
  process.exit(1);
}
' "$plan_extract_dir" "$(basename "$plan_out")"
  [ "$status" -eq 0 ] || live_fail_test "$output"
}

@test "encrypted runs validate recipients before artifacts and preserve plaintext on standard encryption failure" {
  local invalid_out="$LIVE_LOCAL_TMP_ROOT/invalid-recipient-export"
  local confidential_bad_key_out="$LIVE_LOCAL_TMP_ROOT/confidential-bad-key-export"
  local stopped_encryption_out="$LIVE_LOCAL_TMP_ROOT/stopped-encryption-export"
  local failure_gpg_home="$LIVE_LOCAL_TMP_ROOT/gnupg-standard-failure"
  local valid_gpg_home="$LIVE_LOCAL_TMP_ROOT/gnupg-valid"
  local failure_out="$LIVE_LOCAL_TMP_ROOT/standard-failure-export"
  local signing_fingerprint=""
  local valid_fingerprint=""

  run env HOME="$CONFLUEX_LIVE_CLI_HOME" GNUPGHOME="$LIVE_LOCAL_TMP_ROOT/missing-gnupg" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    export \
    --page-id "$LINKED_PAGE_ID" \
    --out "$invalid_out" \
    --safe \
    --encrypt \
    --encryption-key "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"
  [ "$status" -eq 1 ] || live_fail_test "invalid-recipient encrypted export exited $status"
  [[ ! -e "$invalid_out" ]] || live_fail_test "invalid recipient created output root"
  [[ ! -e "$invalid_out.tar.gz.gpg" ]] || live_fail_test "invalid recipient created archive"
  [[ "$output" != *$'RUN_START '* ]] || live_fail_test "invalid recipient emitted RUN_START before preflight success"

  run env HOME="$CONFLUEX_LIVE_CLI_HOME" GNUPGHOME="$LIVE_LOCAL_TMP_ROOT/missing-gnupg" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    export \
    --page-id "$LINKED_PAGE_ID" \
    --out "$confidential_bad_key_out" \
    --safe \
    --confidential \
    --encryption-key "not-a-full-fingerprint"
  [ "$status" -eq 1 ] || live_fail_test "confidential bad-key export exited $status"
  [[ ! -e "$confidential_bad_key_out" ]] || live_fail_test "confidential bad key created output root"
  [[ ! -e "$confidential_bad_key_out.status.txt" ]] || live_fail_test "confidential bad key created status sidecar"

  valid_fingerprint="$(make_gpg_fingerprint "$valid_gpg_home")"
  [[ "$valid_fingerprint" =~ ^[A-F0-9]{40}$ ]] || live_fail_test "failed to create valid GPG fingerprint"
  run env HOME="$CONFLUEX_LIVE_CLI_HOME" GNUPGHOME="$valid_gpg_home" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    export \
    --page-id "$ROOT_PAGE_ID" \
    --out "$stopped_encryption_out" \
    --max-pages 1 \
    --encrypt \
    --encryption-key "$valid_fingerprint"
  [ "$status" -eq 3 ] || live_fail_test "configured-stop encrypted export exited $status"
  [[ -d "$stopped_encryption_out" ]] || live_fail_test "configured-stop encrypted export did not retain plain root"
  [[ ! -e "$stopped_encryption_out.tar.gz.gpg" ]] || live_fail_test "configured-stop encrypted export created archive"
  [[ "$output" != *$'RUN_PHASE phase=encryption'* ]] || live_fail_test "configured-stop encrypted export emitted encryption phase"

  signing_fingerprint="$(make_signing_only_gpg_fingerprint "$failure_gpg_home")"
  [[ "$signing_fingerprint" =~ ^[A-F0-9]{40}$ ]] || live_fail_test "failed to create signing-only GPG fingerprint"

  run env HOME="$CONFLUEX_LIVE_CLI_HOME" GNUPGHOME="$failure_gpg_home" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    export \
    --page-id "$LINKED_PAGE_ID" \
    --out "$failure_out" \
    --safe \
    --encrypt \
    --encryption-key "$signing_fingerprint"
  [ "$status" -eq 5 ] || live_fail_test "standard encryption failure exited $status: $output $stderr"
  [[ -d "$failure_out" ]] || live_fail_test "standard encryption failure did not preserve plain output root"
  [[ -f "$failure_out/summary.txt" ]] || live_fail_test "standard encryption failure summary missing"
  live_assert_equal "encryption_failed" "$(summary_value "$failure_out/summary.txt" final_status)" "standard encryption failure final_status"
  [[ ! -e "$failure_out.status.txt" ]] || live_fail_test "standard encryption failure created confidential status sidecar"
}

@test "confidential encryption failure removes plaintext and writes the docs-defined status sidecar" {
  local gpg_home="$LIVE_LOCAL_TMP_ROOT/gnupg-signing-only"
  local out="$LIVE_LOCAL_TMP_ROOT/confidential-export"
  local plan_out="$LIVE_LOCAL_TMP_ROOT/confidential-plan"
  local log_file="$LIVE_LOCAL_TMP_ROOT/confidential-export.log"
  local stdout_file="$LIVE_LOCAL_TMP_ROOT/confidential-export.stdout"
  local stderr_file="$LIVE_LOCAL_TMP_ROOT/confidential-export.stderr"
  local plan_stdout_file="$LIVE_LOCAL_TMP_ROOT/confidential-plan.stdout"
  local plan_stderr_file="$LIVE_LOCAL_TMP_ROOT/confidential-plan.stderr"
  local fingerprint=""
  local status_sidecar="$out.status.txt"
  local plan_status_sidecar="$plan_out.status.txt"

  fingerprint="$(make_signing_only_gpg_fingerprint "$gpg_home")"
  [[ "$fingerprint" =~ ^[A-F0-9]{40}$ ]] || live_fail_test "failed to create signing-only GPG fingerprint"

  set +e
  env HOME="$CONFLUEX_LIVE_CLI_HOME" GNUPGHOME="$gpg_home" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    export \
    --page-id "$LINKED_PAGE_ID" \
    --out "$out" \
    --safe \
    --confidential \
    --log-file "$log_file" \
    --encryption-key "$fingerprint" \
    >"$stdout_file" 2>"$stderr_file"
  status="$?"
  set -e
  output="$(cat "$stdout_file")"
  stderr="$(cat "$stderr_file")"
  [ "$status" -eq 5 ] || live_fail_test "confidential encryption failure exited $status: $output $stderr"

  [[ "$stderr" == WARNING:\ *'--log-file remains outside plaintext-cleanup guarantees under --confidential'* ]] ||
    live_fail_test "confidential log warning missing: $stderr"
  [[ ! -d "$out" ]] || live_fail_test "confidential failure retained plain output root"
  [[ ! -f "$out.tar.gz.gpg" ]] || live_fail_test "confidential failure retained encrypted archive"
  [[ -f "$log_file" ]] || live_fail_test "confidential persistent log file missing"
  [[ -f "$status_sidecar" ]] || live_fail_test "confidential failure status sidecar missing"
  live_assert_equal "final_status=encryption_failed" "$(cat "$status_sidecar")" "confidential status sidecar"
  [[ "$output" == *'RUN_COMPLETE final_status=encryption_failed artifact='* ]] ||
    live_fail_test "confidential failure missing RUN_COMPLETE encryption_failed"

  set +e
  env HOME="$CONFLUEX_LIVE_CLI_HOME" GNUPGHOME="$gpg_home" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    plan \
    --page-id "$LINKED_PAGE_ID" \
    --out "$plan_out" \
    --safe \
    --confidential \
    --encryption-key "$fingerprint" \
    >"$plan_stdout_file" 2>"$plan_stderr_file"
  status="$?"
  set -e
  output="$(cat "$plan_stdout_file")"
  stderr="$(cat "$plan_stderr_file")"
  [ "$status" -eq 5 ] || live_fail_test "confidential plan encryption failure exited $status: $output $stderr"
  [[ ! -d "$plan_out" ]] || live_fail_test "confidential plan failure retained plain output root"
  [[ ! -f "$plan_out.tar.gz.gpg" ]] || live_fail_test "confidential plan failure retained encrypted archive"
  [[ -f "$plan_status_sidecar" ]] || live_fail_test "confidential plan failure status sidecar missing"
  live_assert_equal "final_status=encryption_failed" "$(cat "$plan_status_sidecar")" "confidential plan status sidecar"
  [[ "$output" == *'RUN_COMPLETE final_status=encryption_failed artifact='* ]] ||
    live_fail_test "confidential plan failure missing RUN_COMPLETE encryption_failed"
}

@test "resume validates a prior incomplete export, reuses safe page payloads, and regenerates reports" {
  local out="$LIVE_LOCAL_TMP_ROOT/resume-export"
  local unsafe_out="$LIVE_LOCAL_TMP_ROOT/resume-unsafe"
  local missing_marker_out="$LIVE_LOCAL_TMP_ROOT/resume-missing-marker"
  local wrong_page_out="$LIVE_LOCAL_TMP_ROOT/resume-wrong-page"
  local wrong_mode_out="$LIVE_LOCAL_TMP_ROOT/resume-wrong-mode"
  local wrong_schema_out="$LIVE_LOCAL_TMP_ROOT/resume-wrong-schema"
  local wrong_format_out="$LIVE_LOCAL_TMP_ROOT/resume-wrong-format"
  local stale_count_out="$LIVE_LOCAL_TMP_ROOT/resume-stale-count"
  local reused=""
  local fresh=""
  local processed=""

  mkdir -p "$unsafe_out"
  cat > "$unsafe_out/summary.txt" <<EOF
command=export
page_id=$ROOT_PAGE_ID
output_root="$unsafe_out"
zip_path=none
output_path_provenance=explicit
support_profile=default
page_payload_format=md
final_status=incomplete
scope_trust=degraded
processed_pages=1
root_pages=1
tree_pages=0
linked_pages=0
other_pages=0
resolved_links=0
unresolved_links=0
scope_findings=0
failed_operations=0
downloaded_mib_total=0.000
downloaded_mib_content=0.000
downloaded_mib_metadata=0.000
blocking_reasons=none
interrupt_reason=max_pages_limit_reached
resume_mode=0
resume_schema_version=2
reused_pages=0
fresh_pages=1
encryption_enabled=0
encryption_successful=0
EOF
  : > "$unsafe_out/INCOMPLETE"
  cat > "$unsafe_out/manifest.tsv" <<EOF
page_id	page_title	space_key	folder	discovery_source	attachment_count	status
$ROOT_PAGE_ID	Unsafe	none	../escape	root	0	success
EOF
  cat > "$unsafe_out/resolved-links.tsv" <<'EOF'
source_page_id	source_title	link_kind	raw_link_value	target_page_id	target_space_key	target_title
EOF
  cat > "$unsafe_out/unresolved-links.tsv" <<'EOF'
source_page_id	source_title	link_kind	raw_link_value	resolution_reason
EOF
  cat > "$unsafe_out/failed-pages.tsv" <<'EOF'
page_id	page_title	operation	error_summary
EOF
  cat > "$unsafe_out/scope-findings.tsv" <<'EOF'
page_id	finding_area	finding_type	detail
EOF
  run --keep-empty-lines --separate-stderr env HOME="$CONFLUEX_LIVE_CLI_HOME" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    export \
    --page-id "$ROOT_PAGE_ID" \
    --out "$unsafe_out" \
    --resume
  output="${output%$'\n'}"
  stderr="${stderr%$'\n'}"
  [ "$status" -eq 1 ] || live_fail_test "unsafe resume exited $status"
  live_assert_equal "" "$output" "unsafe resume stdout"
  [[ "$stderr" == ERROR:\ *'--resume requires normalized manifest folders inside'* ]] ||
    live_fail_test "unsafe resume stderr mismatch: $stderr"

  write_resume_candidate "$missing_marker_out" "$ROOT_PAGE_ID" 0 2 1 0
  run --keep-empty-lines --separate-stderr env HOME="$CONFLUEX_LIVE_CLI_HOME" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    export \
    --page-id "$ROOT_PAGE_ID" \
    --out "$missing_marker_out" \
    --resume
  output="${output%$'\n'}"
  stderr="${stderr%$'\n'}"
  [ "$status" -eq 1 ] || live_fail_test "missing-marker resume exited $status"
  live_assert_equal "" "$output" "missing-marker resume stdout"
  [[ "$stderr" == ERROR:\ *'--resume requires an existing INCOMPLETE marker'* ]] ||
    live_fail_test "missing-marker resume stderr mismatch: $stderr"

  write_resume_candidate "$wrong_page_out" "999999999" 0 2 1 1
  run --keep-empty-lines --separate-stderr env HOME="$CONFLUEX_LIVE_CLI_HOME" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    export \
    --page-id "$ROOT_PAGE_ID" \
    --out "$wrong_page_out" \
    --resume
  output="${output%$'\n'}"
  stderr="${stderr%$'\n'}"
  [ "$status" -eq 1 ] || live_fail_test "wrong-page resume exited $status"
  live_assert_equal "" "$output" "wrong-page resume stdout"
  [[ "$stderr" == ERROR:\ *'--resume requires matching page_id'* ]] ||
    live_fail_test "wrong-page resume stderr mismatch: $stderr"

  write_resume_candidate "$wrong_mode_out" "$ROOT_PAGE_ID" 1 2 1 1
  run --keep-empty-lines --separate-stderr env HOME="$CONFLUEX_LIVE_CLI_HOME" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    export \
    --page-id "$ROOT_PAGE_ID" \
    --out "$wrong_mode_out" \
    --resume
  output="${output%$'\n'}"
  stderr="${stderr%$'\n'}"
  [ "$status" -eq 1 ] || live_fail_test "wrong-mode resume exited $status"
  live_assert_equal "" "$output" "wrong-mode resume stdout"
  [[ "$stderr" == ERROR:\ *'--resume requires resume_mode=0'* ]] ||
    live_fail_test "wrong-mode resume stderr mismatch: $stderr"

  write_resume_candidate "$wrong_schema_out" "$ROOT_PAGE_ID" 0 1 1 1
  run --keep-empty-lines --separate-stderr env HOME="$CONFLUEX_LIVE_CLI_HOME" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    export \
    --page-id "$ROOT_PAGE_ID" \
    --out "$wrong_schema_out" \
    --resume
  output="${output%$'\n'}"
  stderr="${stderr%$'\n'}"
  [ "$status" -eq 1 ] || live_fail_test "wrong-schema resume exited $status"
  live_assert_equal "" "$output" "wrong-schema resume stdout"
  [[ "$stderr" == ERROR:\ *'--resume requires resume_schema_version=2'* ]] ||
    live_fail_test "wrong-schema resume stderr mismatch: $stderr"

  write_resume_candidate "$wrong_format_out" "$ROOT_PAGE_ID" 0 2 1 1 html
  run --keep-empty-lines --separate-stderr env HOME="$CONFLUEX_LIVE_CLI_HOME" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    export \
    --page-id "$ROOT_PAGE_ID" \
    --out "$wrong_format_out" \
    --resume
  output="${output%$'\n'}"
  stderr="${stderr%$'\n'}"
  [ "$status" -eq 1 ] || live_fail_test "wrong-format resume exited $status"
  live_assert_equal "" "$output" "wrong-format resume stdout"
  [[ "$stderr" == ERROR:\ *'--resume requires page_payload_format=md'* ]] ||
    live_fail_test "wrong-format resume stderr mismatch: $stderr"

  write_resume_candidate "$stale_count_out" "$ROOT_PAGE_ID" 0 2 2 1
  run --keep-empty-lines --separate-stderr env HOME="$CONFLUEX_LIVE_CLI_HOME" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    export \
    --page-id "$ROOT_PAGE_ID" \
    --out "$stale_count_out" \
    --resume
  output="${output%$'\n'}"
  stderr="${stderr%$'\n'}"
  [ "$status" -eq 1 ] || live_fail_test "stale-count resume exited $status"
  live_assert_equal "" "$output" "stale-count resume stdout"
  [[ "$stderr" == ERROR:\ *'--resume requires processed_pages=1'* ]] ||
    live_fail_test "stale-count resume stderr mismatch: $stderr"

  run env HOME="$CONFLUEX_LIVE_CLI_HOME" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    export \
    --page-id "$ROOT_PAGE_ID" \
    --out "$out" \
    --max-pages 1
  [ "$status" -eq 3 ] || live_fail_test "initial limited export exited $status"
  live_assert_equal "incomplete" "$(summary_value "$out/summary.txt" final_status)" "initial resume final_status"

  run env HOME="$CONFLUEX_LIVE_CLI_HOME" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    export \
    --page-id "$ROOT_PAGE_ID" \
    --out "$out" \
    --resume \
    --no-fail-fast
  [ "$status" -eq 0 ] || live_fail_test "resumed export exited $status: $output $stderr"

  live_assert_equal "1" "$(summary_value "$out/summary.txt" resume_mode)" "resume_mode"
  live_assert_equal "2" "$(summary_value "$out/summary.txt" resume_schema_version)" "resume_schema_version"
  reused="$(summary_value "$out/summary.txt" reused_pages)"
  fresh="$(summary_value "$out/summary.txt" fresh_pages)"
  processed="$(summary_value "$out/summary.txt" processed_pages)"
  [[ "$reused" =~ ^[1-9][0-9]*$ ]] || live_fail_test "expected reused_pages > 0, got $reused"
  [[ "$fresh" =~ ^[0-9]+$ ]] || live_fail_test "fresh_pages is not numeric: $fresh"
  [[ "$processed" =~ ^[0-9]+$ ]] || live_fail_test "processed_pages is not numeric: $processed"
  (( processed == reused + fresh )) ||
    live_fail_test "resume accounting mismatch: processed=$processed reused=$reused fresh=$fresh"
  [[ -f "$out/manifest.tsv" ]] || live_fail_test "resumed manifest missing"
  [[ -f "$out/summary.txt" ]] || live_fail_test "resumed summary missing"
}

@test "live runtime failures distinguish fail-fast, best-effort, and plan cleanup semantics" {
  local container="${CONFLUEX_LIVE_CONFLUENCE_CONTAINER_NAME:-}"
  local no_fail_out="$LIVE_LOCAL_TMP_ROOT/no-fail-fast-runtime"
  local fail_fast_export_out="$LIVE_LOCAL_TMP_ROOT/fail-fast-export-runtime"
  local fail_fast_plan_out="$LIVE_LOCAL_TMP_ROOT/fail-fast-plan-runtime"
  local no_fail_stdout="$LIVE_LOCAL_TMP_ROOT/no-fail-fast.stdout"
  local no_fail_stderr="$LIVE_LOCAL_TMP_ROOT/no-fail-fast.stderr"
  local fail_export_stdout="$LIVE_LOCAL_TMP_ROOT/fail-fast-export.stdout"
  local fail_export_stderr="$LIVE_LOCAL_TMP_ROOT/fail-fast-export.stderr"
  local fail_plan_stdout="$LIVE_LOCAL_TMP_ROOT/fail-fast-plan.stdout"
  local fail_plan_stderr="$LIVE_LOCAL_TMP_ROOT/fail-fast-plan.stderr"
  local no_fail_pid=""
  local fail_export_pid=""
  local fail_plan_pid=""
  local no_fail_status=0
  local fail_export_status=0
  local fail_plan_status=0
  local no_fail_failed_rows=0

  if [[ -z "$container" ]]; then
    skip "CONFLUEX_LIVE_CONFLUENCE_CONTAINER_NAME is required for runtime-failure interruption"
  fi

  env HOME="$CONFLUEX_LIVE_CLI_HOME" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    export \
    --page-id "$ROOT_PAGE_ID" \
    --out "$no_fail_out" \
    --safe \
    --no-fail-fast \
    --sleep-ms 8000 \
    >"$no_fail_stdout" 2>"$no_fail_stderr" &
  no_fail_pid="$!"

  env HOME="$CONFLUEX_LIVE_CLI_HOME" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    export \
    --page-id "$ROOT_PAGE_ID" \
    --out "$fail_fast_export_out" \
    --safe \
    --sleep-ms 8000 \
    >"$fail_export_stdout" 2>"$fail_export_stderr" &
  fail_export_pid="$!"

  env HOME="$CONFLUEX_LIVE_CLI_HOME" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    plan \
    --page-id "$ROOT_PAGE_ID" \
    --out "$fail_fast_plan_out" \
    --safe \
    --sleep-ms 8000 \
    >"$fail_plan_stdout" 2>"$fail_plan_stderr" &
  fail_plan_pid="$!"

  wait_for_manifest_rows "$no_fail_out/manifest.tsv" "$no_fail_pid" "no-fail-fast export"
  wait_for_manifest_rows "$fail_fast_export_out/manifest.tsv" "$fail_export_pid" "fail-fast export"
  wait_for_manifest_rows "$fail_fast_plan_out/manifest.tsv" "$fail_plan_pid" "fail-fast plan"

  docker stop "$container" >/dev/null

  wait "$no_fail_pid" || no_fail_status="$?"
  wait "$fail_export_pid" || fail_export_status="$?"
  wait "$fail_plan_pid" || fail_plan_status="$?"

  [ "$no_fail_status" -eq 0 ] || live_fail_test "no-fail-fast runtime export exited $no_fail_status: $(cat "$no_fail_stdout") $(cat "$no_fail_stderr")"
  [[ -d "$no_fail_out" ]] || live_fail_test "no-fail-fast runtime export did not retain output root"
  live_assert_equal "success_with_findings" "$(summary_value "$no_fail_out/summary.txt" final_status)" "no-fail-fast runtime final_status"
  [[ "$(summary_value "$no_fail_out/summary.txt" blocking_reasons)" == *'failed_operations'* ]] ||
    live_fail_test "no-fail-fast runtime blocking_reasons missing failed_operations"
  no_fail_failed_rows="$(tsv_data_row_count "$no_fail_out/failed-pages.tsv")"
  (( no_fail_failed_rows > 1 )) || live_fail_test "no-fail-fast did not continue to later page failures"

  [ "$fail_export_status" -eq 4 ] || live_fail_test "fail-fast runtime export exited $fail_export_status: $(cat "$fail_export_stdout") $(cat "$fail_export_stderr")"
  [[ -d "$fail_fast_export_out" ]] || live_fail_test "fail-fast runtime export did not retain partial output root"
  [[ -f "$fail_fast_export_out/INCOMPLETE" ]] || live_fail_test "fail-fast runtime export marker missing"
  [[ -f "$fail_fast_export_out/summary.txt" ]] || live_fail_test "fail-fast runtime export summary missing"
  live_assert_equal "incomplete" "$(summary_value "$fail_fast_export_out/summary.txt" final_status)" "fail-fast export runtime final_status"
  live_assert_equal "runtime_error" "$(summary_value "$fail_fast_export_out/summary.txt" interrupt_reason)" "fail-fast export runtime interrupt_reason"

  [ "$fail_plan_status" -eq 4 ] || live_fail_test "fail-fast runtime plan exited $fail_plan_status: $(cat "$fail_plan_stdout") $(cat "$fail_plan_stderr")"
  [[ ! -e "$fail_fast_plan_out" ]] || live_fail_test "fail-fast runtime plan retained misleading partial output root"
  [[ "$(cat "$fail_plan_stdout")" == *'RUN_COMPLETE final_status=incomplete artifact=none'* ]] ||
    live_fail_test "fail-fast runtime plan did not report artifact=none"
}
