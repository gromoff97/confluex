#!/usr/bin/env bats

source "${BATS_TEST_DIRNAME}/helpers/confluex_test_helper.bash"

setup() {
  confluex_setup
}

teardown() {
  confluex_teardown
}

# Covers: FR-0001, FR-0003
@test "help exposes the public command surface and operator options" {
  run_confluex basic --help

  assert_success
  assert_output_contains 'confluex export --page-id <id> [OPTIONS]'
  assert_output_contains 'confluex plan --page-id <id> [OPTIONS]'
  assert_output_contains 'confluex doctor [--page-id <id>]'
  assert_output_contains 'confluex config [--encryption-key KEY | --clear-encryption-key]'
  assert_output_contains 'confluex install [--install-dir DIR]'
  assert_output_contains 'confluex uninstall [--install-dir DIR]'
  assert_output_contains '--safe'
  assert_output_contains '--critical'
  assert_output_contains '--confidential'
  assert_output_contains '--resume'
  assert_output_contains '--max-pages N'
  assert_output_contains '--max-download-mib N'
  assert_output_contains '--sleep-ms N'
  assert_output_contains '--max-find-candidates N'
  assert_output_contains '--keep-metadata'
  assert_output_contains '--encryption-key KEY'
  assert_output_contains '--verify-encryption'
  assert_no_default_output_dirs
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

  run_confluex basic export --page-id 100 --max-pages nope
  assert_failure
  assert_output_contains 'ERROR: --max-pages must be a non-negative integer'
  assert_no_default_output_dirs

  run_confluex basic export --page-id 100 --max-download-mib nope
  assert_failure
  assert_output_contains 'ERROR: --max-download-mib must be a non-negative integer'
  assert_no_default_output_dirs

  run_confluex basic export --page-id 100 --sleep-ms nope
  assert_failure
  assert_output_contains 'ERROR: --sleep-ms must be a non-negative integer'
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

  run_confluex basic export --page-id 100 --critical --no-fail-fast
  assert_failure
  assert_output_contains 'ERROR: --critical cannot be combined with --no-fail-fast'
  assert_no_default_output_dirs

  run_confluex basic export --page-id 100 --confidential
  assert_failure
  assert_output_contains '--confidential requires an explicit or saved encryption key'
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
page_id	space_key	title	folder	discovered_by	mode	attachment_count
100	ENG	Root Page	$escaped_external	root	export	1
EOF
  cat > "$escaped_out/summary.txt" <<'EOF'
command=export
root_page_id=100
support_profile=bounded_confluence_storage_v1
resume_schema_version=1
final_status=incomplete
EOF

  run_confluex basic export --page-id 100 --resume --out "$escaped_out"
  assert_failure
  assert_path_exists "$escaped_external/page.html"
  assert_file_contains 'external payload' "$escaped_external/page.html"
  assert_output_contains 'resume'

  cat > "$traversed_out/manifest.tsv" <<EOF
page_id	space_key	title	folder	discovered_by	mode	attachment_count
100	ENG	Root Page	$(basename "$traversed_out")/../$(basename "$traversed_external")	root	export	1
EOF
  cat > "$traversed_out/summary.txt" <<'EOF'
command=export
root_page_id=100
support_profile=bounded_confluence_storage_v1
resume_schema_version=1
final_status=incomplete
EOF

  run_confluex basic export --page-id 100 --resume --out "$traversed_out"
  assert_failure
  assert_path_exists "$traversed_external/page.html"
  assert_file_contains 'traversed payload' "$traversed_external/page.html"
  assert_output_contains 'resume'

  mkdir -p "$compatible_pages/attachments"
  printf 'reused root payload\n' > "$compatible_pages/page.html"
  printf 'reused root attachment\n' > "$compatible_pages/attachments/readme.txt"
  cat > "$incompatible_out/manifest.tsv" <<EOF
page_id	space_key	title	folder	discovered_by	mode	attachment_count
100	ENG	Root Page	$(basename "$incompatible_out")/pages/ENG/Root_Page__100	root	export	1
EOF
  cat > "$incompatible_out/summary.txt" <<'EOF'
command=export
root_page_id=999
support_profile=bounded_confluence_storage_v1
resume_schema_version=1
final_status=incomplete
EOF

  run_confluex basic export --page-id 100 --resume --out "$incompatible_out"
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
@test "doctor checks local prerequisites and optional page access" {
  run_confluex basic doctor
  assert_success
  assert_output_contains 'confluex doctor'
  assert_output_contains '[INFO] support profile: bounded_confluence_storage_v1'
  assert_output_contains 'supported link forms: child tree, ri:content-entity, ri:page, ri:url(pageId), ri:url(space/title), ac:parameter(page), href(pageId), href(space/title)'
  assert_output_contains '[OK] bash:'
  assert_output_contains '[OK] node:'
  assert_output_contains '[OK] confluence:'
  assert_output_contains '[INFO] node version:'
  assert_output_contains '[INFO] confluence version:'
  assert_output_contains '[INFO] gpg version:'
  assert_output_contains '[WARN] auth check skipped (no --page-id)'

  run_confluex basic doctor --page-id 100
  assert_success
  assert_output_contains '[OK] access to page 100'
  assert_output_contains 'title: Root Page'
  assert_output_contains 'space: ENG'

  run_confluex basic doctor --verify-encryption
  assert_failure
  assert_output_contains '[FAIL] no encryption key provided and no saved default encryption key is configured'

  run_confluex basic doctor --verify-encryption --encryption-key READYKEY
  assert_success
  assert_output_contains '[OK] encryption recipient available: READYKEY'
  assert_output_contains 'source: cli'

  run_confluex preflight_failure doctor --page-id 100
  assert_failure
  assert_output_contains '[FAIL] cannot access page 100 via confluence-cli'
}

# Covers: FR-0038, FR-0045
@test "doctor does not attempt to validate a saved encryption key identity" {
  run_confluex basic config --encryption-key NOT-A-REAL-GPG-IDENTITY
  assert_success

  run_confluex basic doctor
  assert_success
  assert_output_contains '[OK] bash:'
  assert_output_contains '[WARN] auth check skipped (no --page-id)'
  assert_output_not_contains 'default encryption key'
  assert_output_not_contains 'NOT-A-REAL-GPG-IDENTITY'

  export MOCK_GPG_MISSING_KEY=NOT-A-REAL-GPG-IDENTITY
  run_confluex basic doctor --verify-encryption
  unset MOCK_GPG_MISSING_KEY
  assert_failure
  assert_output_contains '[FAIL] encryption recipient not available: NOT-A-REAL-GPG-IDENTITY'
  assert_output_contains 'source: config'
}

# Covers: FR-0045
@test "confidential mode warns when a persistent log file is enabled" {
  local out_dir="$CONFLUEX_WORK_DIR/confidential-log-warning"
  local log_file="$CONFLUEX_WORK_DIR/confidential.log"
  local fingerprint="0123456789ABCDEF0123456789ABCDEF01234567"

  run_confluex basic export --page-id 100 --out "$out_dir" --confidential --encryption-key "$fingerprint" --log-file "$log_file"
  assert_success
  assert_output_contains '--confidential does not protect persistent log files'
  assert_file_exists "$log_file"
}

# Covers: FR-0045
@test "config shows, saves, and clears the default encryption key identity" {
  local config_file
  config_file="$(config_file_path)"

  run_confluex basic config
  assert_success
  assert_output_contains 'default encryption key: <not set>'

  run_confluex basic config --encryption-key 0123456789ABCDEF
  assert_success
  assert_output_contains 'Saved default encryption key'
  assert_file_exists "$config_file"
  assert_file_contains 'encryption_key=0123456789ABCDEF' "$config_file"

  run_confluex basic config
  assert_success
  assert_output_contains 'default encryption key: 0123456789ABCDEF'

  run_confluex basic config --clear-encryption-key
  assert_success
  assert_output_contains 'Cleared default encryption key'
  assert_path_missing "$config_file"

  run_confluex basic config --encryption-key A --clear-encryption-key
  assert_failure
  assert_output_contains 'ERROR: config cannot combine --encryption-key with --clear-encryption-key'
}

# Covers: FR-0048
@test "install and uninstall provide a self-contained CLI lifecycle" {
  local install_dir="$CONFLUEX_WORK_DIR/install-bin"
  local install_lib_dir="$install_dir/lib/confluex"

  run_confluex basic install --install-dir "$install_dir"
  assert_success
  assert_file_exists "$install_dir/confluex"
  assert_path_exists "$install_lib_dir"

  run_command basic "$install_dir/confluex" --help
  assert_success
  assert_output_contains 'Usage:'

  run_confluex basic uninstall --install-dir "$install_dir"
  assert_success
  assert_output_contains "Removed $install_dir/confluex"
  assert_output_contains "Removed $install_lib_dir"
  assert_path_missing "$install_dir/confluex"
  assert_path_missing "$install_lib_dir"

  run_confluex basic uninstall --install-dir "$install_dir"
  assert_success
  assert_output_contains "Nothing to uninstall from $install_dir"
}
