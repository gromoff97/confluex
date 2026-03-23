#!/usr/bin/env bats

source "${BATS_TEST_DIRNAME}/helpers/confluex_test_helper.bash"

setup() {
  confluex_setup
}

teardown() {
  confluex_teardown
}

assert_help_sections_in_order() {
  [[ "$CONFLUEX_LAST_STDOUT" == *$'Usage\n'*$'\nPurpose\n'*$'\nRequired options\n'*$'\nOptional options\n'*$'\nExamples\n'* ]] ||
    fail_test "expected help sections in order, got: $CONFLUEX_LAST_STDOUT"
}

help_section_body() {
  local start="$1"
  local end="$2"

  printf '%s\n' "$CONFLUEX_LAST_STDOUT" | awk -v start="$start" -v end="$end" '
    $0 == start { capture = 1; next }
    capture && $0 == end { exit }
    capture { print }
  '
}

assert_help_section_equals() {
  local start="$1"
  local end="$2"
  local expected="$3"
  local actual

  actual="$(help_section_body "$start" "$end")"
  [[ "$actual" == "$expected" ]] ||
    fail_test "expected $start section to equal '$expected', got: $actual"
}

assert_stderr_starts_with_error() {
  [[ "$CONFLUEX_LAST_STDERR" == ERROR:\ * ]] ||
    fail_test "expected stderr to start with 'ERROR: ', got: $CONFLUEX_LAST_STDERR"
}

# Covers: FR-0001, FR-0003
@test "help exposes the public command surface and command-specific help contracts" {
  local expected=""

  run_confluex basic --help

  assert_success
  expected="$(cat <<'EOF'
Usage
  confluex <command> [options]

Commands
  export     materialized export workflow
  plan       dry-run planning workflow
  doctor     diagnostic workflow
  config     configuration workflow
  install    installation workflow
  uninstall  uninstallation workflow
EOF
)"
  assert_stdout_equals "$expected"
  assert_stderr_empty

  run_confluex basic
  assert_success
  expected="$(cat <<'EOF'
Usage
  confluex <command> [options]

Commands
  export     materialized export workflow
  plan       dry-run planning workflow
  doctor     diagnostic workflow
  config     configuration workflow
  install    installation workflow
  uninstall  uninstallation workflow
EOF
)"
  assert_stdout_equals "$expected"
  assert_stderr_empty

  run_confluex basic export --help
  assert_success
  assert_output_contains 'Purpose'
  assert_output_contains '--encrypt'
  assert_output_contains '--page-format <format>'
  assert_output_contains 'Default: md.'
  assert_output_contains 'confluex export --page-id 12345 --out ./dump --page-format html'
  assert_stderr_empty
  assert_no_default_output_dirs
}

# Covers: FR-0008, FR-0123
@test "export help keeps required and optional sections distinct and documents page formats explicitly" {
  local expected_required='  --page-id <id>              Root Confluence page id to export.'
  local expected_optional=""
  local expected_examples=""

  run_confluex basic export --help

  assert_success
  assert_help_sections_in_order
  assert_stderr_empty
  assert_no_default_output_dirs

  expected_optional="$(cat <<'EOF'
  --out <dir>                 Output directory. Default: generated automatically.
  --safe                      Apply conservative defaults for routine runs.
  --critical                  Fail closed when findings or failures remain.
  --encrypt                   Request encrypted output delivery.
  --confidential              Request encrypted fail-closed delivery with plaintext cleanup on encryption failure.
  --resume                    Reuse a compatible existing export root selected by --out.
  --no-fail-fast              Continue after page-local runtime failures.
  --keep-metadata             Persist page metadata files such as _info.txt and _storage.xml.
  --page-format <format>      Persist page payload as md or html. Default: md.
  --log-file <file>           Write a persistent log artifact.
  --encryption-key <value>    Use this encryption recipient for the current command.
  --max-pages <n>             Stop after n processed pages.
  --max-download-mib <n>      Stop after downloading n MiB in total.
  --sleep-ms <n>              Sleep n ms between processed pages.
  --max-find-candidates <n>   Inspect at most n title-resolution candidates per link.
EOF
)"
  expected_examples="$(cat <<'EOF'
  confluex export --page-id 12345 --out ./dump
  confluex export --page-id 12345 --out ./dump --page-format html
  confluex export --page-id 12345 --out ./dump --encrypt --encryption-key 0123456789ABCDEF0123456789ABCDEF01234567
EOF
)"

  assert_help_section_equals 'Required options' 'Optional options' "$expected_required"
  assert_help_section_equals 'Optional options' 'Examples' "$expected_optional"
  assert_help_section_equals 'Examples' 'Notes' "$expected_examples"
  assert_output_contains $'Notes\n  --critical cannot be combined with --no-fail-fast.\n  --confidential implies --encrypt and --critical.\n  --resume requires an explicit --out directory and a compatible prior export result.'
}

# Covers: FR-0008
@test "non-export command help keeps required and optional sections distinct" {
  local expected_required=""
  local expected_optional=""
  local expected_examples=""
  local command=""

  for command in plan doctor config install uninstall; do
    run_confluex basic "$command" --help

    assert_success
    assert_help_sections_in_order
    assert_stderr_empty
    assert_no_default_output_dirs

    case "$command" in
      plan)
        expected_required='  --page-id <id>              Root Confluence page id to plan.'
        expected_optional="$(cat <<'EOF'
  --out <dir>                 Output directory. Default: generated automatically.
  --safe                      Apply conservative defaults for routine runs.
  --critical                  Fail closed when findings or failures remain.
  --encrypt                   Request encrypted output delivery.
  --confidential              Request encrypted fail-closed delivery with plaintext cleanup on encryption failure.
  --no-fail-fast              Continue after page-local runtime failures.
  --keep-metadata             Persist page metadata files such as _info.txt and _storage.xml.
  --log-file <file>           Write a persistent log artifact.
  --encryption-key <value>    Use this encryption recipient for the current command.
  --max-pages <n>             Stop after n processed pages.
  --max-download-mib <n>      Stop after downloading n MiB in total.
  --sleep-ms <n>              Sleep n ms between processed pages.
  --max-find-candidates <n>   Inspect at most n title-resolution candidates per link.
EOF
)"
        expected_examples="$(cat <<'EOF'
  confluex plan --page-id 12345 --out ./plan
  confluex plan --page-id 12345 --out ./plan --safe
  confluex plan --page-id 12345 --out ./plan --encrypt --encryption-key 0123456789ABCDEF0123456789ABCDEF01234567
EOF
)"
        assert_help_section_equals 'Required options' 'Optional options' "$expected_required"
        assert_help_section_equals 'Optional options' 'Examples' "$expected_optional"
        assert_help_section_equals 'Examples' 'Notes' "$expected_examples"
        assert_output_contains $'Notes\n  --critical cannot be combined with --no-fail-fast.\n  --confidential implies --encrypt and --critical.'
        ;;
      doctor)
        expected_required='  none'
        expected_optional="$(cat <<'EOF'
  --page-id <id>              Verify that a candidate root page is accessible.
  --verify-encryption         Verify the effective encryption recipient.
  --encryption-key <value>    Override the recipient used by --verify-encryption.
  --log-file <file>           Write a persistent log artifact.
EOF
)"
        expected_examples="$(cat <<'EOF'
  confluex doctor
  confluex doctor --page-id 12345
  confluex doctor --verify-encryption --encryption-key 0123456789ABCDEF0123456789ABCDEF01234567
EOF
)"
        assert_help_section_equals 'Required options' 'Optional options' "$expected_required"
        assert_help_section_equals 'Optional options' 'Examples' "$expected_optional"
        assert_help_section_equals 'Examples' 'Notes' "$expected_examples"
        assert_output_contains $'Notes\n  --encryption-key is accepted only together with --verify-encryption.'
        ;;
      config)
        expected_required='  none'
        expected_optional="$(cat <<'EOF'
  --encryption-key <value>    Save this default encryption recipient.
  --clear-encryption-key      Clear the saved default encryption recipient.
EOF
)"
        expected_examples="$(cat <<'EOF'
  confluex config
  confluex config --encryption-key 0123456789ABCDEF0123456789ABCDEF01234567
  confluex config --clear-encryption-key
EOF
)"
        assert_help_section_equals 'Required options' 'Optional options' "$expected_required"
        assert_help_section_equals 'Optional options' 'Examples' "$expected_optional"
        assert_help_section_equals 'Examples' 'Notes' "$expected_examples"
        assert_output_contains $'Notes\n  --encryption-key and --clear-encryption-key are mutually exclusive.'
        ;;
      install)
        expected_required='  none'
        expected_optional='  --install-dir <dir>         Install into this target directory. Default: ~/.local/bin on POSIX.'
        expected_examples="$(cat <<'EOF'
  confluex install
  confluex install --install-dir ./bin
EOF
)"
        assert_help_section_equals 'Required options' 'Optional options' "$expected_required"
        assert_help_section_equals 'Optional options' 'Examples' "$expected_optional"
        assert_help_section_equals 'Examples' 'Notes' "$expected_examples"
        assert_output_not_contains $'\nNotes\n'
        ;;
      uninstall)
        expected_required='  none'
        expected_optional='  --install-dir <dir>         Uninstall from this target directory. Default: ~/.local/bin on POSIX.'
        expected_examples="$(cat <<'EOF'
  confluex uninstall
  confluex uninstall --install-dir ./bin
EOF
)"
        assert_help_section_equals 'Required options' 'Optional options' "$expected_required"
        assert_help_section_equals 'Optional options' 'Examples' "$expected_optional"
        assert_help_section_equals 'Examples' 'Notes' "$expected_examples"
        assert_output_not_contains $'\nNotes\n'
        ;;
    esac
  done
}

# Covers: FR-0002, FR-0076
@test "invalid invocations are rejected before page-processing starts" {
  run_confluex basic export
  assert_failure
  assert_output_contains 'ERROR: --page-id is required'
  assert_no_default_output_dirs

  run_confluex basic export --page-id nope
  assert_failure
  assert_output_contains 'ERROR: --page-id must be numeric, got: nope'
  assert_no_default_output_dirs

  run_confluex basic export --page-id 100 --max-find-candidates 0
  assert_failure
  assert_output_contains 'ERROR: --max-find-candidates must be a positive integer'
  assert_no_default_output_dirs

  run_confluex basic export --page-id 100 --max-pages 0
  assert_failure
  assert_output_contains 'ERROR: --max-pages must be a positive integer'
  assert_no_default_output_dirs

  run_confluex basic export --page-id 100 --max-download-mib 0
  assert_failure
  assert_output_contains 'ERROR: --max-download-mib must be a positive integer'
  assert_no_default_output_dirs

  run_confluex basic export --page-id 100 --sleep-ms nope
  assert_failure
  assert_output_contains 'ERROR: --sleep-ms must be a non-negative integer'
  assert_no_default_output_dirs

  run_confluex basic export --page-id 100 --out=
  assert_failure
  assert_output_contains 'ERROR: --out requires a non-empty directory'
  assert_no_default_output_dirs

  run_confluex basic export --page-id 100 --log-file=
  assert_failure
  assert_output_contains 'ERROR: --log-file requires a non-empty file path'
  assert_no_default_output_dirs

  run_confluex basic export --page-id 100 --install-dir /tmp/confluex-bin
  assert_failure
  assert_output_contains 'ERROR: export and plan do not use --install-dir'
  assert_no_default_output_dirs

  run_confluex basic export --page-id 100 --encryption-key=
  assert_failure
  assert_output_contains 'ERROR: --encryption-key requires a non-empty GPG key identity'
  assert_no_default_output_dirs

  run_confluex basic export --page-id 100 --encrypt
  assert_failure
  assert_output_contains '--encrypt requires an explicit or saved encryption key'
  assert_no_default_output_dirs

  run_confluex basic export --page-id 100 --page-format pdf
  assert_failure
  assert_output_contains 'ERROR: --page-format must be one of: md, html'
  assert_no_default_output_dirs

  run_confluex basic export --page-id 100 --critical --no-fail-fast
  assert_failure
  assert_output_contains 'ERROR: --critical cannot be combined with --no-fail-fast'
  assert_no_default_output_dirs

  run_confluex basic export --page-id 100 --confidential
  assert_failure
  assert_output_contains '--encrypt requires an explicit or saved encryption key'
  assert_no_default_output_dirs

  run_confluex basic export --page-id 100 --resume
  assert_failure
  assert_output_contains 'ERROR: --resume requires an explicit --out directory'
  assert_no_default_output_dirs

  mkdir -p "$CONFLUEX_WORK_DIR/existing-out"
  run_confluex basic export --page-id 100 --out "$CONFLUEX_WORK_DIR/existing-out"
  assert_failure
  assert_output_contains 'output directory already exists:'
  assert_dir_empty "$CONFLUEX_WORK_DIR/existing-out"
  assert_path_missing "$CONFLUEX_WORK_DIR/existing-out/manifest.tsv"

  run_confluex basic export --page-id 100 --resume --out "$CONFLUEX_WORK_DIR/missing-resume"
  assert_failure
  assert_output_contains '--resume requires an existing output directory:'
  assert_no_default_output_dirs

  mkdir -p "$CONFLUEX_WORK_DIR/resume-no-manifest"
  run_confluex basic export --page-id 100 --resume --out "$CONFLUEX_WORK_DIR/resume-no-manifest"
  assert_failure
  assert_output_contains '--resume requires an existing manifest.tsv in'
  assert_path_missing "$CONFLUEX_WORK_DIR/resume-no-manifest/pages"

  : > "$CONFLUEX_WORK_DIR/not-a-dir"
  run_confluex basic export --page-id 100 --resume --out "$CONFLUEX_WORK_DIR/not-a-dir"
  assert_failure
  assert_output_contains '--resume requires an existing output directory, got non-directory path:'
}

# Covers: FR-0015, FR-0018
@test "prohibited combinations and repeated options keep deterministic semantics" {
  local repeated_safe_out="$CONFLUEX_WORK_DIR/repeated-safe"
  local repeated_format_out="$CONFLUEX_WORK_DIR/repeated-format"
  local config_file

  config_file="$(config_file_path)"

  run_confluex basic export --page-id 100 --out "$CONFLUEX_WORK_DIR/confidential-no-fail-fast" --confidential --no-fail-fast
  assert_failure
  assert_status 1
  assert_stdout_equals ''
  assert_stderr_starts_with_error
  assert_output_contains 'ERROR: --confidential cannot be combined with --no-fail-fast'
  assert_path_missing "$CONFLUEX_WORK_DIR/confidential-no-fail-fast"

  run_confluex basic export --page-id 100 --safe --safe --out "$repeated_safe_out"
  assert_success
  assert_standard_report_files "$repeated_safe_out"
  assert_summary_value "$repeated_safe_out/summary.txt" final_status success

  run_confluex basic export --page-id 100 --out "$repeated_format_out" --page-format=html --page-format=md
  assert_success
  assert_summary_value "$repeated_format_out/summary.txt" page_payload_format md
  assert_page_markdown_exported "$repeated_format_out" ENG Root_Page 100
  assert_page_html_missing "$repeated_format_out" ENG Root_Page 100

  run_confluex basic config --encryption-key FIRST --encryption-key SECOND
  assert_success
  assert_stdout_equals 'default_encryption_key=SECOND'
  assert_file_contains 'encryption_key=SECOND' "$config_file"
  assert_stderr_empty
}

# Covers: FR-0011, FR-0019
@test "unknown top-level commands reject explicitly without side effects" {
  run_confluex basic bogus

  assert_failure
  assert_status 1
  assert_stdout_equals ''
  assert_stderr_starts_with_error
  assert_output_contains 'ERROR: unknown command: bogus'
  assert_no_default_output_dirs
}

# Covers: FR-0012, FR-0019, FR-0121
@test "unsupported options reject before output roots or log artifacts are created" {
  local unknown_option_log="$CONFLUEX_WORK_DIR/rejected-export.log"
  local bad_plan_log="$CONFLUEX_WORK_DIR/rejected-plan.log"

  run_confluex basic export --page-id 100 --bogus --log-file "$unknown_option_log"
  assert_failure
  assert_status 1
  assert_stdout_equals ''
  assert_stderr_starts_with_error
  assert_output_contains 'ERROR: unknown option: --bogus'
  assert_no_default_output_dirs
  assert_path_missing "$unknown_option_log"

  run_confluex basic plan --page-id 100 --page-format html --log-file "$bad_plan_log"
  assert_failure
  assert_status 1
  assert_stdout_equals ''
  assert_stderr_starts_with_error
  assert_output_contains 'ERROR: --page-format is only valid with confluex export'
  assert_no_default_output_dirs
  assert_path_missing "$bad_plan_log"
}

# Covers: FR-0030
@test "config rejects reserved and control-character encryption key values" {
  local config_file
  config_file="$(config_file_path)"

  run_confluex basic config --encryption-key none
  assert_failure
  assert_status 1
  assert_stdout_equals ''
  assert_stderr_starts_with_error
  assert_output_contains 'ERROR: --encryption-key cannot be the reserved value none'
  assert_path_missing "$config_file"

  run_confluex basic config --encryption-key $'BAD\tKEY'
  assert_failure
  assert_status 1
  assert_stdout_equals ''
  assert_stderr_starts_with_error
  assert_output_contains 'ERROR: --encryption-key cannot contain TAB, LF, or CR'
  assert_path_missing "$config_file"
}

# Covers: FR-0076, FR-0055
@test "resume rejects manifest folders outside the active output root and incompatible prior state" {
  local escaped_out="$CONFLUEX_WORK_DIR/resume-escaped"
  local escaped_external="$CONFLUEX_WORK_DIR/external-reused-page"
  local traversed_out="$CONFLUEX_WORK_DIR/resume-traversed"
  local traversed_external="$CONFLUEX_WORK_DIR/external-traversed-page"
  local incompatible_out="$CONFLUEX_WORK_DIR/resume-incompatible"
  local compatible_pages="$incompatible_out/pages/ENG/Root_Page__100"

  mkdir -p "$escaped_out" "$escaped_external/attachments" "$traversed_out" "$traversed_external/attachments"
  printf 'external payload\n' > "$escaped_external/page.html"
  printf 'external attachment\n' > "$escaped_external/attachments/readme.txt"
  printf 'traversed payload\n' > "$traversed_external/page.html"
  printf 'traversed attachment\n' > "$traversed_external/attachments/readme.txt"
  cat > "$escaped_out/manifest.tsv" <<EOF
page_id	space_key	page_title	folder	discovery_source	run_mode	attachment_count
100	ENG	Root Page	$escaped_external	root	export	1
EOF
  cat > "$escaped_out/summary.txt" <<'EOF'
command=export
page_id=100
support_profile=default
page_payload_format=html
resume_mode=0
resume_schema_version=2
encryption_successful=0
final_status=incomplete
EOF

  run_confluex basic export --page-id 100 --resume --out "$escaped_out" --page-format html
  assert_failure
  assert_path_exists "$escaped_external/page.html"
  assert_file_contains 'external payload' "$escaped_external/page.html"
  assert_output_contains 'resume'

  cat > "$traversed_out/manifest.tsv" <<EOF
page_id	space_key	page_title	folder	discovery_source	run_mode	attachment_count
100	ENG	Root Page	$(basename "$traversed_out")/../$(basename "$traversed_external")	root	export	1
EOF
  cat > "$traversed_out/summary.txt" <<'EOF'
command=export
page_id=100
support_profile=default
page_payload_format=html
resume_mode=0
resume_schema_version=2
encryption_successful=0
final_status=incomplete
EOF

  run_confluex basic export --page-id 100 --resume --out "$traversed_out" --page-format html
  assert_failure
  assert_path_exists "$traversed_external/page.html"
  assert_file_contains 'traversed payload' "$traversed_external/page.html"
  assert_output_contains 'resume'

  mkdir -p "$compatible_pages/attachments"
  printf 'reused root payload\n' > "$compatible_pages/page.html"
  printf 'reused root attachment\n' > "$compatible_pages/attachments/readme.txt"
  cat > "$incompatible_out/manifest.tsv" <<EOF
page_id	space_key	page_title	folder	discovery_source	run_mode	attachment_count
100	ENG	Root Page	pages/ENG/Root_Page__100	root	export	1
EOF
  cat > "$incompatible_out/summary.txt" <<'EOF'
command=export
page_id=999
support_profile=default
page_payload_format=html
resume_mode=0
resume_schema_version=2
encryption_successful=0
final_status=incomplete
EOF

  run_confluex basic export --page-id 100 --resume --out "$incompatible_out" --page-format html
  assert_failure
  assert_file_contains 'reused root payload' "$compatible_pages/page.html"
  assert_output_contains 'resume'
}

# Covers: FR-0002, FR-0038, FR-0045, FR-0048
@test "subcommands reject incompatible options instead of silently accepting them" {
  run_confluex basic doctor --out "$CONFLUEX_WORK_DIR/doctor-out"
  assert_failure
  assert_output_contains 'ERROR: doctor does not use --out'
  assert_no_default_output_dirs

  run_confluex basic doctor --encryption-key TESTKEY
  assert_failure
  assert_output_contains 'ERROR: doctor only uses --encryption-key together with --verify-encryption'
  assert_no_default_output_dirs

  run_confluex basic doctor --critical
  assert_failure
  assert_output_contains 'ERROR: doctor does not use --critical'
  assert_no_default_output_dirs

  run_confluex basic doctor --resume
  assert_failure
  assert_output_contains 'ERROR: doctor does not use --resume'
  assert_no_default_output_dirs

  run_confluex basic config --page-id 100
  assert_failure
  assert_output_contains 'ERROR: config does not use --page-id'
  assert_no_default_output_dirs

  run_confluex basic config --install-dir "$CONFLUEX_WORK_DIR/install-bin"
  assert_failure
  assert_output_contains 'ERROR: config does not use --install-dir'
  assert_no_default_output_dirs

  run_confluex basic config --resume
  assert_failure
  assert_output_contains 'ERROR: config does not use --resume'
  assert_no_default_output_dirs

  run_confluex basic install --safe
  assert_failure
  assert_output_contains 'ERROR: install does not use --safe'
  assert_no_default_output_dirs

  run_confluex basic install --verify-encryption
  assert_failure
  assert_output_contains 'ERROR: install does not use --verify-encryption'
  assert_no_default_output_dirs

  run_confluex basic install --encrypt
  assert_failure
  assert_output_contains 'ERROR: install does not use --encrypt'
  assert_no_default_output_dirs

  run_confluex basic uninstall --encryption-key TESTKEY
  assert_failure
  assert_output_contains 'ERROR: uninstall does not use --encryption-key'
  assert_no_default_output_dirs

  run_confluex basic plan --page-id 100 --resume --out "$CONFLUEX_WORK_DIR/plan-resume"
  assert_failure
  assert_output_contains 'ERROR: plan does not use --resume'
  assert_no_default_output_dirs
}

# Covers: FR-0038
@test "doctor emits the machine-readable diagnostics contract" {
  local confluence_version='present:unknown_version'
  local expected=""

  run_confluex basic doctor
  assert_success
  expected="$(cat <<EOF
dependency_parser_runtime=present:$(node --version | sed -n '1p')
dependency_confluence_cli=$confluence_version
dependency_gpg=present:$(gpg --version | sed -n '1p')
page_access=skipped
encryption_recipient=skipped
support_profile=default
supported_link_forms=child_result,content_id,page_ref,macro_param,href_page_id,href_space_title,ri_url_page_id,ri_url_space_title
next_action=none
EOF
)"
  assert_stdout_equals "$expected"
  assert_stderr_empty

  run_confluex basic doctor --page-id 100
  assert_success
  expected="$(cat <<EOF
dependency_parser_runtime=present:$(node --version | sed -n '1p')
dependency_confluence_cli=$confluence_version
dependency_gpg=present:$(gpg --version | sed -n '1p')
page_access=ok
page_identity=100
encryption_recipient=skipped
support_profile=default
supported_link_forms=child_result,content_id,page_ref,macro_param,href_page_id,href_space_title,ri_url_page_id,ri_url_space_title
next_action=none
EOF
)"
  assert_stdout_equals "$expected"
  assert_stderr_empty

  run_confluex basic doctor --verify-encryption
  assert_success
  expected="$(cat <<EOF
dependency_parser_runtime=present:$(node --version | sed -n '1p')
dependency_confluence_cli=$confluence_version
dependency_gpg=present:$(gpg --version | sed -n '1p')
page_access=skipped
encryption_recipient=missing
support_profile=default
supported_link_forms=child_result,content_id,page_ref,macro_param,href_page_id,href_space_title,ri_url_page_id,ri_url_space_title
next_action=set_encryption_key
EOF
)"
  assert_stdout_equals "$expected"
  assert_stderr_empty

  run_confluex basic doctor --verify-encryption --encryption-key READYKEY
  assert_success
  expected="$(cat <<EOF
dependency_parser_runtime=present:$(node --version | sed -n '1p')
dependency_confluence_cli=$confluence_version
dependency_gpg=present:$(gpg --version | sed -n '1p')
page_access=skipped
encryption_recipient=ok
support_profile=default
supported_link_forms=child_result,content_id,page_ref,macro_param,href_page_id,href_space_title,ri_url_page_id,ri_url_space_title
next_action=none
EOF
)"
  assert_stdout_equals "$expected"
  assert_stderr_empty

  run_confluex preflight_failure doctor --page-id 100
  assert_success
  expected="$(cat <<EOF
dependency_parser_runtime=present:$(node --version | sed -n '1p')
dependency_confluence_cli=$confluence_version
dependency_gpg=present:$(gpg --version | sed -n '1p')
page_access=failed
encryption_recipient=skipped
support_profile=default
supported_link_forms=child_result,content_id,page_ref,macro_param,href_page_id,href_space_title,ri_url_page_id,ri_url_space_title
next_action=check_page_access
EOF
)"
  assert_stdout_equals "$expected"
  assert_stderr_empty
}

# Covers: FR-0038, FR-0045
@test "doctor does not attempt to validate a saved encryption key identity" {
  local expected=""
  local confluence_version='present:unknown_version'

  run_confluex basic config --encryption-key NOT-A-REAL-GPG-IDENTITY
  assert_success

  run_confluex basic doctor
  assert_success
  expected="$(cat <<EOF
dependency_parser_runtime=present:$(node --version | sed -n '1p')
dependency_confluence_cli=$confluence_version
dependency_gpg=present:$(gpg --version | sed -n '1p')
page_access=skipped
encryption_recipient=skipped
support_profile=default
supported_link_forms=child_result,content_id,page_ref,macro_param,href_page_id,href_space_title,ri_url_page_id,ri_url_space_title
next_action=none
EOF
)"
  assert_stdout_equals "$expected"
  assert_stderr_empty

  export MOCK_GPG_MISSING_KEY=NOT-A-REAL-GPG-IDENTITY
  run_confluex basic doctor --verify-encryption
  unset MOCK_GPG_MISSING_KEY
  assert_success
  expected="$(cat <<EOF
dependency_parser_runtime=present:$(node --version | sed -n '1p')
dependency_confluence_cli=$confluence_version
dependency_gpg=present:$(gpg --version | sed -n '1p')
page_access=skipped
encryption_recipient=failed
support_profile=default
supported_link_forms=child_result,content_id,page_ref,macro_param,href_page_id,href_space_title,ri_url_page_id,ri_url_space_title
next_action=fix_encryption_key
EOF
)"
  assert_stdout_equals "$expected"
  assert_stderr_empty
}

# Covers: FR-0009, FR-0010, FR-0045
@test "confidential mode warns when a persistent log file is enabled" {
  local out_dir="$CONFLUEX_WORK_DIR/confidential-log-warning"
  local log_file="$CONFLUEX_WORK_DIR/confidential.log"
  local fingerprint="0123456789ABCDEF0123456789ABCDEF01234567"

  run_confluex basic export --page-id 100 --out "$out_dir" --confidential --page-format html --encryption-key "$fingerprint" --log-file "$log_file"
  assert_success
  assert_stdout_contains 'RUN_START command=export page_id=100 output_root="'
  assert_stdout_contains 'RUN_COMPLETE final_status=success artifact="'
  assert_stdout_not_contains 'WARNING: '
  [[ "$CONFLUEX_LAST_STDERR" == WARNING:\ * ]] ||
    fail_test "expected stderr to start with 'WARNING: ', got: $CONFLUEX_LAST_STDERR"
  assert_stderr_contains '--confidential does not protect persistent log files'
  assert_file_exists "$log_file"
}

# Covers: FR-0045
@test "config shows, saves, and clears the default encryption key identity" {
  local config_file
  config_file="$(config_file_path)"

  run_confluex basic config
  assert_success
  assert_stdout_equals 'default_encryption_key=none'
  assert_stderr_empty

  run_confluex basic config --encryption-key 0123456789ABCDEF
  assert_success
  assert_stdout_equals 'default_encryption_key=0123456789ABCDEF'
  assert_file_exists "$config_file"
  assert_file_contains 'encryption_key=0123456789ABCDEF' "$config_file"
  assert_stderr_empty

  run_confluex basic config
  assert_success
  assert_stdout_equals 'default_encryption_key=0123456789ABCDEF'
  assert_stderr_empty

  run_confluex basic config --clear-encryption-key
  assert_success
  assert_stdout_equals 'default_encryption_key=none'
  assert_path_missing "$config_file"
  assert_stderr_empty

  run_confluex basic config --encryption-key A --clear-encryption-key
  assert_failure
  assert_output_contains 'ERROR: config cannot combine --encryption-key with --clear-encryption-key'
}

# Covers: FR-0048
@test "install and uninstall provide a self-contained CLI lifecycle" {
  local install_dir="$CONFLUEX_WORK_DIR/install-bin"
  local install_lib_dir="$install_dir/lib/confluex"
  local manifest_file="$install_dir/.confluex-install-manifest.txt"

  run_confluex basic install --install-dir "$install_dir"
  assert_success
  assert_file_exists "$install_dir/confluex"
  assert_path_exists "$install_lib_dir"
  assert_file_exists "$manifest_file"
  assert_stdout_equals "install_result=installed target=\"$install_dir\""
  assert_stderr_empty

  run_command basic "$install_dir/confluex" --help
  assert_success
  assert_output_contains 'Usage'

  run_confluex basic uninstall --install-dir "$install_dir"
  assert_success
  assert_stdout_equals "uninstall_result=removed target=\"$install_dir\""
  assert_path_missing "$install_dir/confluex"
  assert_path_missing "$install_lib_dir"
  assert_path_missing "$manifest_file"
  assert_stderr_empty

  run_confluex basic uninstall --install-dir "$install_dir"
  assert_success
  assert_stdout_equals "uninstall_result=absent target=\"$install_dir\""
  assert_stderr_empty
}
