#!/usr/bin/env bats

source "${BATS_TEST_DIRNAME}/helpers/confluex_test_helper.bash"

setup() {
  confluex_setup
}

teardown() {
  confluex_teardown
}

# Covers: FR-SAFE-003
@test "fail-fast stops on the first page-local failure while best-effort continues" {
  local fail_fast_out="$CONFLUEX_WORK_DIR/fail-fast"
  local best_effort_out="$CONFLUEX_WORK_DIR/best-effort"

  run_confluex fail_fast export --page-id 100 --out "$fail_fast_out"
  assert_failure
  assert_equal "0" "$(manifest_page_count "$fail_fast_out/manifest.tsv" 900)" "fail-fast later page count"
  assert_file_contains $'200\texport' "$fail_fast_out/failed-pages.tsv"

  run_confluex no_fail_fast export --page-id 100 --out "$best_effort_out" --no-fail-fast
  assert_success
  assert_equal "1" "$(manifest_page_count "$best_effort_out/manifest.tsv" 900)" "best-effort later page count"
  assert_file_contains $'200\texport' "$best_effort_out/failed-pages.tsv"
}

# Covers: FR-SAFE-002, FR-SAFE-005, FR-OBS-001
@test "runtime failures and configured stop conditions leave interpretable partial results" {
  local partial_out="$CONFLUEX_WORK_DIR/partial-runtime"
  local max_pages_out="$CONFLUEX_WORK_DIR/max-pages-limit"
  local limited_out="$CONFLUEX_WORK_DIR/max-download-limit"

  run_confluex partial_export_failure export --page-id 100 --out "$partial_out"
  assert_failure
  assert_file_exists "$partial_out/pages/ENG/Child_Page__200/page.html"
  assert_file_contains $'200\texport' "$partial_out/failed-pages.tsv"
  assert_failed_pages_two_columns "$partial_out/failed-pages.tsv"
  assert_summary_value "$partial_out/summary.txt" incomplete 1
  assert_summary_value "$partial_out/summary.txt" final_status incomplete
  assert_summary_value "$partial_out/summary.txt" interrupt_reason runtime_error
  assert_summary_has_keys "$partial_out/summary.txt" command root_page_id output_dir failed_operations downloaded_total_bytes interrupt_reason

  run_confluex basic export --page-id 100 --out "$max_pages_out" --max-pages 1
  assert_failure
  assert_summary_value "$max_pages_out/summary.txt" incomplete 1
  assert_summary_value "$max_pages_out/summary.txt" final_status incomplete
  assert_summary_value "$max_pages_out/summary.txt" interrupt_reason max_pages_reached
  assert_equal "1" "$(manifest_row_count "$max_pages_out/manifest.tsv")" "manifest row count for max-pages"
  assert_report_invariants "$max_pages_out"

  run_confluex max_download_limit export --page-id 100 --out "$limited_out" --max-download-mib 1
  assert_failure
  assert_summary_value "$limited_out/summary.txt" incomplete 1
  assert_summary_value "$limited_out/summary.txt" final_status incomplete
  assert_summary_value "$limited_out/summary.txt" interrupt_reason max_download_mib_reached
  assert_report_invariants "$limited_out"
}

# Covers: FR-SAFE-004
@test "interrupted export is marked incomplete and interrupted plan output is removed" {
  local export_out="$CONFLUEX_WORK_DIR/interrupt-export"
  local plan_out="$CONFLUEX_WORK_DIR/interrupt-plan"

  run_confluex interrupt_export export --page-id 100 --out "$export_out"
  assert_status 130
  assert_file_exists "$export_out/INCOMPLETE"
  assert_file_exists "$export_out/pages/ENG/Root_Page__100/page.html"
  assert_summary_value "$export_out/summary.txt" incomplete 1
  assert_summary_value "$export_out/summary.txt" final_status interrupted
  assert_summary_value "$export_out/summary.txt" interrupt_reason SIGINT
  assert_summary_has_keys "$export_out/summary.txt" command root_page_id output_dir processed_pages downloaded_total_bytes interrupt_reason

  run_confluex interrupt_dry_run plan --page-id 100 --out "$plan_out"
  assert_status 130
  assert_path_missing "$plan_out"
}

# Covers: FR-SEC-001
@test "explicit encryption creates an archive and preserves plain output on encryption failure" {
  local encrypted_out="$CONFLUEX_WORK_DIR/encrypted-export"
  local failing_out="$CONFLUEX_WORK_DIR/encryption-failure"

  run_confluex basic export --page-id 100 --out "$encrypted_out" --encryption-key KEY-ONE
  assert_success
  assert_path_missing "$encrypted_out"
  assert_file_exists "$encrypted_out.tar.gz.gpg"
  assert_file_exists "$encrypted_out.tar.gz.gpg.txt"
  assert_file_contains 'GPG key identity: KEY-ONE' "$encrypted_out.tar.gz.gpg.txt"
  assert_file_contains 'gpg --output encrypted-export.tar.gz --decrypt encrypted-export.tar.gz.gpg' "$encrypted_out.tar.gz.gpg.txt"
  assert_file_contains 'tar -xzf encrypted-export.tar.gz' "$encrypted_out.tar.gz.gpg.txt"

  export MOCK_GPG_FAIL=1
  run_confluex basic export --page-id 100 --out "$failing_out" --encryption-key KEY-TWO
  unset MOCK_GPG_FAIL
  assert_failure
  assert_path_exists "$failing_out"
  assert_path_missing "$failing_out.tar.gz.gpg"
  assert_summary_value "$failing_out/summary.txt" encryption_enabled 1
  assert_summary_value "$failing_out/summary.txt" encryption_successful 0
  assert_summary_value "$failing_out/summary.txt" final_status encryption_failed
}

# Covers: FR-CONF-001, FR-SEC-001
@test "configured encryption keys are used by default and explicit keys override them" {
  local configured_out="$CONFLUEX_WORK_DIR/configured-encryption"
  local override_out="$CONFLUEX_WORK_DIR/override-encryption"

  run_confluex basic config --encryption-key DEFAULT-KEY
  assert_success

  run_confluex basic export --page-id 100 --out "$configured_out"
  assert_success
  assert_file_exists "$configured_out.tar.gz.gpg.txt"
  assert_file_contains 'GPG key identity: DEFAULT-KEY' "$configured_out.tar.gz.gpg.txt"

  run_confluex basic export --page-id 100 --out "$override_out" --encryption-key EXPLICIT-KEY
  assert_success
  assert_file_exists "$override_out.tar.gz.gpg.txt"
  assert_file_contains 'GPG key identity: EXPLICIT-KEY' "$override_out.tar.gz.gpg.txt"
}

# Covers: FR-SEC-001
@test "encrypted exports can be decrypted and extracted back into an interpretable run layout" {
  local encrypted_out="$CONFLUEX_WORK_DIR/roundtrip-encrypted-export"
  local restore_dir="$CONFLUEX_WORK_DIR/roundtrip-restore"

  run_confluex basic export --page-id 100 --out "$encrypted_out" --encryption-key ROUNDTRIP-KEY
  assert_success
  assert_path_missing "$encrypted_out"
  assert_file_exists "$encrypted_out.tar.gz.gpg"
  assert_file_exists "$encrypted_out.tar.gz.gpg.txt"

  mkdir -p "$restore_dir"
  (
    cd "$restore_dir" &&
    gpg --output roundtrip-encrypted-export.tar.gz --decrypt "$encrypted_out.tar.gz.gpg" &&
    tar -xzf roundtrip-encrypted-export.tar.gz
  )

  assert_file_exists "$restore_dir/roundtrip-encrypted-export/manifest.tsv"
  assert_file_exists "$restore_dir/roundtrip-encrypted-export/summary.txt"
  assert_file_exists "$restore_dir/roundtrip-encrypted-export/resolved-links.tsv"
  assert_file_exists "$restore_dir/roundtrip-encrypted-export/unresolved-links.tsv"
  assert_file_exists "$restore_dir/roundtrip-encrypted-export/failed-pages.tsv"
  assert_file_exists "$restore_dir/roundtrip-encrypted-export/scope-findings.tsv"
  assert_page_exported "$restore_dir/roundtrip-encrypted-export" ENG Root_Page 100
  assert_page_exported "$restore_dir/roundtrip-encrypted-export" ENG Child_Page 200
  assert_page_exported "$restore_dir/roundtrip-encrypted-export" ENG Linked_Page 300
  assert_report_invariants "$restore_dir/roundtrip-encrypted-export"
  assert_summary_value "$restore_dir/roundtrip-encrypted-export/summary.txt" critical_mode 0
  assert_summary_value "$restore_dir/roundtrip-encrypted-export/summary.txt" support_profile bounded_confluence_storage_v1
  assert_summary_value "$restore_dir/roundtrip-encrypted-export/summary.txt" scope_trust trusted
  assert_summary_value "$restore_dir/roundtrip-encrypted-export/summary.txt" encryption_enabled 1
  assert_summary_value "$restore_dir/roundtrip-encrypted-export/summary.txt" encryption_successful 1
  assert_summary_value "$restore_dir/roundtrip-encrypted-export/summary.txt" final_status success
}

# Covers: FR-SEC-001, FR-OBS-001
@test "confidential mode removes plain output when encryption fails" {
  local confidential_out="$CONFLUEX_WORK_DIR/confidential-export"

  export MOCK_GPG_FAIL=1
  run_confluex basic export --page-id 100 --out "$confidential_out" --confidential --encryption-key LOCKED-KEY
  unset MOCK_GPG_FAIL
  assert_failure
  assert_path_missing "$confidential_out"
  assert_path_missing "$confidential_out.tar.gz.gpg"
  assert_file_exists "$confidential_out.status.txt"
  assert_summary_value "$confidential_out.status.txt" confidential_mode 1
  assert_summary_value "$confidential_out.status.txt" final_status encryption_failed
  assert_summary_value "$confidential_out.status.txt" blocking_reasons encryption_failed
}
