#!/usr/bin/env bats

source "${BATS_TEST_DIRNAME}/helpers/confluex_test_helper.bash"

setup() {
  confluex_setup
}

teardown() {
  confluex_teardown
}

# Covers: FR-0052, FR-0053, FR-0060, FR-0061
@test "basic export walks the root tree and linked pages into one interpretable result" {
  local out_dir="$CONFLUEX_WORK_DIR/basic-export"

  run_confluex basic export --page-id 100 --out "$out_dir"

  assert_success
  assert_standard_report_files "$out_dir"
  assert_page_exported "$out_dir" ENG Root_Page 100
  assert_page_exported "$out_dir" ENG Child_Page 200
  assert_page_exported "$out_dir" ENG Linked_Page 300
  assert_equal "3" "$(manifest_row_count "$out_dir/manifest.tsv")" "manifest row count"
  assert_summary_value "$out_dir/summary.txt" command export
  assert_summary_value "$out_dir/summary.txt" processed_pages 3
  assert_summary_value "$out_dir/summary.txt" root_pages 1
  assert_summary_value "$out_dir/summary.txt" tree_pages 1
  assert_summary_value "$out_dir/summary.txt" linked_pages 1
  assert_report_invariants "$out_dir"
}

# Covers: FR-0056, FR-0057, FR-0058
@test "accepted export and plan runs emit the machine-readable lifecycle contract on stdout" {
  local plain_out="$CONFLUEX_WORK_DIR/lifecycle-export"
  local encrypted_out="$CONFLUEX_WORK_DIR/lifecycle-encrypted"
  local plan_out="$CONFLUEX_WORK_DIR/lifecycle-plan"
  local expected_stdout=""

  run_confluex basic export --page-id 100 --out "$plain_out"
  assert_success
  printf -v expected_stdout '%s\n%s\n%s\n%s\n%s' \
    "RUN_START command=export page_id=100 output_root=\"$plain_out\"" \
    'RUN_PHASE phase=scope_discovery' \
    'RUN_PHASE phase=page_processing' \
    'RUN_PHASE phase=report_generation' \
    "RUN_COMPLETE final_status=success artifact=\"$plain_out\""
  assert_stdout_equals "$expected_stdout"

  run_confluex basic export --page-id 100 --out "$encrypted_out" --encrypt --encryption-key KEY-ONE
  assert_success
  printf -v expected_stdout '%s\n%s\n%s\n%s\n%s\n%s' \
    "RUN_START command=export page_id=100 output_root=\"$encrypted_out\"" \
    'RUN_PHASE phase=scope_discovery' \
    'RUN_PHASE phase=page_processing' \
    'RUN_PHASE phase=report_generation' \
    'RUN_PHASE phase=encryption' \
    "RUN_COMPLETE final_status=success artifact=\"${encrypted_out}.tar.gz.gpg\""
  assert_stdout_equals "$expected_stdout"

  run_confluex basic plan --page-id 100 --out "$plan_out"
  assert_success
  printf -v expected_stdout '%s\n%s\n%s\n%s\n%s' \
    "RUN_START command=plan page_id=100 output_root=\"$plan_out\"" \
    'RUN_PHASE phase=scope_discovery' \
    'RUN_PHASE phase=page_processing' \
    'RUN_PHASE phase=report_generation' \
    "RUN_COMPLETE final_status=success artifact=\"$plan_out\""
  assert_stdout_equals "$expected_stdout"
}

# Covers: FR-0028, FR-0054, FR-0081
@test "plan omits HTML and attachments and only persists metadata when requested" {
  local out_dir="$CONFLUEX_WORK_DIR/plan-default"
  local meta_out_dir="$CONFLUEX_WORK_DIR/plan-metadata"

  run_confluex basic plan --page-id 100 --out "$out_dir"
  assert_success
  assert_standard_report_files "$out_dir"
  assert_page_html_missing "$out_dir" ENG Root_Page 100
  assert_path_missing "$out_dir/pages/ENG/Root_Page__100/attachments"
  assert_path_missing "$out_dir/pages/ENG/Root_Page__100/_info.txt"
  assert_path_missing "$out_dir/pages/ENG/Root_Page__100/_storage.xml"
  assert_summary_value "$out_dir/summary.txt" command plan
  assert_summary_value "$out_dir/summary.txt" page_payload_format none
  assert_report_invariants "$out_dir"

  run_confluex basic plan --page-id 100 --out "$meta_out_dir" --keep-metadata
  assert_success
  assert_file_exists "$meta_out_dir/pages/ENG/Root_Page__100/_info.txt"
  assert_file_exists "$meta_out_dir/pages/ENG/Root_Page__100/_storage.xml"
  assert_file_exists "$meta_out_dir/pages/ENG/Root_Page__100/_attachments_preview.txt"
  assert_page_html_missing "$meta_out_dir" ENG Root_Page 100
}

# Covers: FR-0028, FR-0080
@test "export metadata persistence is controlled explicitly by keep-metadata" {
  local default_out="$CONFLUEX_WORK_DIR/export-default-metadata"
  local meta_out="$CONFLUEX_WORK_DIR/export-keep-metadata"

  run_confluex basic export --page-id 100 --out "$default_out"
  assert_success
  assert_path_missing "$default_out/pages/ENG/Root_Page__100/_info.txt"
  assert_path_missing "$default_out/pages/ENG/Root_Page__100/_storage.xml"

  run_confluex basic export --page-id 100 --out "$meta_out" --keep-metadata
  assert_success
  assert_file_exists "$meta_out/pages/ENG/Root_Page__100/_info.txt"
  assert_file_exists "$meta_out/pages/ENG/Root_Page__100/_storage.xml"
  assert_file_exists "$meta_out/pages/ENG/Child_Page__200/_info.txt"
  assert_file_exists "$meta_out/pages/ENG/Child_Page__200/_storage.xml"
}

# Covers: FR-0062
@test "linked pages do not automatically pull their descendants" {
  local out_dir="$CONFLUEX_WORK_DIR/no-linked-descendants"

  run_confluex linked_no_descendants export --page-id 100 --out "$out_dir"

  assert_success
  assert_page_exported "$out_dir" ENG Root_Page 100
  assert_page_exported "$out_dir" ENG Child_Page 200
  assert_page_exported "$out_dir" ENG Linked_Page 300
  assert_equal "3" "$(manifest_row_count "$out_dir/manifest.tsv")" "manifest row count"
  assert_page_missing "$out_dir" ENG Linked_Descendant 400
}

# Covers: FR-0062
@test "linked pages do not recursively expand scope through their own links" {
  local out_dir="$CONFLUEX_WORK_DIR/no-link-of-link-expansion"

  run_confluex linked_page_link_chain export --page-id 100 --out "$out_dir"

  assert_success
  assert_page_exported "$out_dir" ENG Root_Page 100
  assert_page_exported "$out_dir" ENG Child_Page 200
  assert_page_exported "$out_dir" ENG Linked_Page 300
  assert_equal "3" "$(manifest_row_count "$out_dir/manifest.tsv")" "manifest row count"
  assert_page_missing "$out_dir" ENG Linked_Of_Linked 400
  assert_equal "0" "$(manifest_page_count "$out_dir/manifest.tsv" 400)" "manifest page count for 400"
}

# Covers: FR-0064, FR-0113, FR-0116
@test "ambiguous title links stay unresolved instead of being guessed" {
  local out_dir="$CONFLUEX_WORK_DIR/ambiguous-link"

  run_confluex ambiguous_title export --page-id 100 --out "$out_dir"

  assert_success
  assert_equal "1" "$(manifest_row_count "$out_dir/manifest.tsv")" "manifest row count"
  assert_file_contains $'100\tRoot Page\tpage_ref\tENG:Common Page\tnot_unique' "$out_dir/unresolved-links.tsv"
  assert_equal "0" "$(manifest_page_count "$out_dir/manifest.tsv" 600)" "manifest page count for 600"
  assert_equal "0" "$(manifest_page_count "$out_dir/manifest.tsv" 601)" "manifest page count for 601"
  assert_summary_value "$out_dir/summary.txt" final_status success_with_findings
  assert_summary_value "$out_dir/summary.txt" blocking_reasons unresolved_links
}

# Covers: FR-0061, FR-0063, FR-0065
@test "supported internal link forms expand scope while external lookalikes do not" {
  local out_dir="$CONFLUEX_WORK_DIR/link-forms"

  run_confluex link_forms export --page-id 100 --out "$out_dir"

  assert_success
  assert_page_exported "$out_dir" ENG Root_Page 100
  assert_page_exported "$out_dir" ENG Linked_Page 300
  assert_page_exported "$out_dir" OTHER Param_Linked 501
  assert_page_exported "$out_dir" ENG Href_Linked 502
  assert_equal "4" "$(manifest_row_count "$out_dir/manifest.tsv")" "manifest row count"
  assert_equal "0" "$(manifest_page_count "$out_dir/manifest.tsv" 999)" "manifest page count for external lookalike"
}

# Covers: FR-0063, FR-0066, FR-0113, FR-0114
@test "ri:url and display-style internal references are supported while unsupported internal references become scope findings" {
  local supported_out="$CONFLUEX_WORK_DIR/ri-url-supported"
  local display_out="$CONFLUEX_WORK_DIR/display-url-supported"
  local unsupported_out="$CONFLUEX_WORK_DIR/unsupported-internal-url"

  run_confluex ri_url_pageid export --page-id 100 --out "$supported_out"
  assert_success
  assert_page_exported "$supported_out" ENG Root_Page 100
  assert_page_exported "$supported_out" ENG Linked_Page 300
  assert_summary_value "$supported_out/summary.txt" scope_trust trusted
  assert_summary_value "$supported_out/summary.txt" scope_findings 0

  run_confluex display_url_title export --page-id 100 --out "$display_out"
  assert_success
  assert_page_exported "$display_out" ENG Root_Page 100
  assert_page_exported "$display_out" ENG Linked_Page 300
  assert_summary_value "$display_out/summary.txt" scope_trust trusted
  assert_summary_value "$display_out/summary.txt" scope_findings 0

  run_confluex unsupported_internal_url export --page-id 100 --out "$unsupported_out"
  assert_success
  assert_summary_value "$unsupported_out/summary.txt" final_status success_with_findings
  assert_summary_value "$unsupported_out/summary.txt" blocking_reasons scope_findings
  assert_summary_value "$unsupported_out/summary.txt" scope_trust degraded
  assert_summary_value "$unsupported_out/summary.txt" scope_findings 1
  assert_file_contains $'100\tunsupported_pattern\tunsupported_internal_pattern\tri:url:/spaces/ENG/overview' "$unsupported_out/scope-findings.tsv"
}

# Covers: FR-0065
@test "link-like text inside code-like or plain-text content does not expand scope" {
  local out_dir="$CONFLUEX_WORK_DIR/code-text-lookalikes"

  run_confluex code_block_pageid_text export --page-id 100 --out "$out_dir"

  assert_success
  assert_equal "1" "$(manifest_row_count "$out_dir/manifest.tsv")" "manifest row count"
  assert_equal "0" "$(manifest_page_count "$out_dir/manifest.tsv" 887)" "manifest page count for 887"
  assert_equal "0" "$(manifest_page_count "$out_dir/manifest.tsv" 888)" "manifest page count for 888"
  assert_equal "0" "$(manifest_page_count "$out_dir/manifest.tsv" 889)" "manifest page count for 889"
}

# Covers: FR-0072, FR-0113, FR-0114
@test "partially inspectable title resolution records scope findings" {
  local out_dir="$CONFLUEX_WORK_DIR/partially-visible-title-resolution"

  run_confluex partially_visible_title_resolution export --page-id 100 --out "$out_dir"

  assert_success
  assert_page_exported "$out_dir" ENG Root_Page 100
  assert_page_exported "$out_dir" ENG Hidden_Page 701
  assert_summary_value "$out_dir/summary.txt" final_status success_with_findings
  assert_summary_value "$out_dir/summary.txt" blocking_reasons scope_findings
  assert_summary_value "$out_dir/summary.txt" scope_trust degraded
  assert_file_contains $'100\ttitle_resolution\tcandidate_visibility_incomplete\t[ENG] Hidden Page' "$out_dir/scope-findings.tsv"
}

# Covers: FR-0067
@test "duplicate discoveries and cycles do not cause duplicate processing" {
  local duplicate_out="$CONFLUEX_WORK_DIR/duplicate-paths"
  local cycle_out="$CONFLUEX_WORK_DIR/cycle-links"

  run_confluex duplicate_paths export --page-id 100 --out "$duplicate_out"
  assert_success
  assert_equal "3" "$(manifest_row_count "$duplicate_out/manifest.tsv")" "duplicate-path manifest rows"
  assert_equal "1" "$(manifest_page_count "$duplicate_out/manifest.tsv" 300)" "duplicate-path linked page count"

  run_confluex cycle_links export --page-id 100 --out "$cycle_out"
  assert_success
  assert_equal "3" "$(manifest_row_count "$cycle_out/manifest.tsv")" "cycle manifest rows"
  assert_equal "1" "$(manifest_page_count "$cycle_out/manifest.tsv" 100)" "cycle root page count"
}

# Covers: FR-0067
@test "rediscovered pages that point back to the root are not re-exported" {
  local out_dir="$CONFLUEX_WORK_DIR/root-rediscovery"

  run_confluex root_referenced_again export --page-id 100 --out "$out_dir"

  assert_success
  assert_equal "2" "$(manifest_row_count "$out_dir/manifest.tsv")" "manifest row count"
  assert_equal "1" "$(manifest_page_count "$out_dir/manifest.tsv" 100)" "root manifest count"
}

# Covers: FR-0076, FR-0077, FR-0085, FR-0086, FR-0087, FR-0089, FR-0090
@test "export output tree and report files stay stable enough for black-box inspection" {
  local out_dir="$CONFLUEX_WORK_DIR/output-contract"

  run_confluex basic export --page-id 100 --out "$out_dir" --page-format html

  assert_success
  assert_standard_report_files "$out_dir"
  assert_path_exists "$out_dir/pages"
  assert_file_contains $'page_id\tspace_key\tpage_title\tfolder\tdiscovery_source\trun_mode\tattachment_count' "$out_dir/manifest.tsv"
  assert_manifest_folders_relative "$out_dir/manifest.tsv"
  assert_file_contains $'source_page_id\tsource_title\tlink_kind\traw_link_value\ttarget_page_id\ttarget_space_key\ttarget_title' "$out_dir/resolved-links.tsv"
  assert_file_contains $'source_page_id\tsource_title\tlink_kind\traw_link_value\tresolution_reason' "$out_dir/unresolved-links.tsv"
  assert_file_contains $'page_id\tpage_title\toperation\terror_summary' "$out_dir/failed-pages.tsv"
  assert_file_contains $'page_id\tfinding_area\tfinding_type\tdetail' "$out_dir/scope-findings.tsv"
  assert_summary_is_key_value_file "$out_dir/summary.txt"
  assert_summary_keys_exact "$out_dir/summary.txt" \
    command page_id output_root output_path_provenance support_profile page_payload_format final_status scope_trust processed_pages root_pages tree_pages linked_pages other_pages \
    resolved_links unresolved_links scope_findings failed_operations downloaded_mib_total downloaded_mib_content downloaded_mib_metadata blocking_reasons interrupt_reason resume_mode \
    resume_schema_version reused_pages fresh_pages encryption_enabled encryption_successful
  assert_summary_value "$out_dir/summary.txt" command export
  assert_summary_value "$out_dir/summary.txt" page_id 100
  assert_summary_value "$out_dir/summary.txt" output_root "\"$out_dir\""
  assert_summary_value "$out_dir/summary.txt" output_path_provenance explicit
  assert_summary_value "$out_dir/summary.txt" page_payload_format html
  assert_summary_value "$out_dir/summary.txt" resume_mode 0
  assert_summary_value "$out_dir/summary.txt" reused_pages 0
  assert_summary_value "$out_dir/summary.txt" fresh_pages 3
  assert_summary_value "$out_dir/summary.txt" support_profile default
  assert_summary_value "$out_dir/summary.txt" scope_trust trusted
  assert_summary_value "$out_dir/summary.txt" encryption_enabled 0
  assert_summary_value "$out_dir/summary.txt" encryption_successful 0
  assert_summary_value "$out_dir/summary.txt" final_status success
  assert_summary_value "$out_dir/summary.txt" blocking_reasons none
  assert_summary_value "$out_dir/summary.txt" interrupt_reason none
  assert_summary_value "$out_dir/summary.txt" scope_findings 0
  assert_summary_value "$out_dir/summary.txt" processed_pages 3
  assert_failed_pages_four_columns "$out_dir/failed-pages.tsv"
  assert_scope_findings_four_columns "$out_dir/scope-findings.tsv"
}

# Covers: FR-0105, FR-0106, FR-0117
@test "resume mode reuses already materialized page payload from a prior failed export" {
  local out_dir="$CONFLUEX_WORK_DIR/resume-reuse"

  run_confluex resume_reuse_fail export --page-id 100 --out "$out_dir" --page-format html
  assert_failure
  assert_summary_value "$out_dir/summary.txt" final_status incomplete
  assert_summary_value "$out_dir/summary.txt" failed_operations 1
  assert_page_exported "$out_dir" ENG Root_Page 100
  assert_page_exported "$out_dir" ENG Child_Page 200
  assert_page_missing "$out_dir" ENG Later_Page 900
  assert_file_contains 'scenario resume_reuse_fail' "$out_dir/pages/ENG/Root_Page__100/page.html"
  assert_file_contains 'scenario resume_reuse_fail' "$out_dir/pages/ENG/Child_Page__200/page.html"

  run_confluex resume_reuse_success export --page-id 100 --out "$out_dir" --resume --page-format html
  assert_success
  assert_output_contains 'reusing existing page HTML + attachments from prior run'
  assert_summary_value "$out_dir/summary.txt" final_status success
  assert_summary_value "$out_dir/summary.txt" resume_mode 1
  assert_summary_value "$out_dir/summary.txt" reused_pages 2
  assert_summary_value "$out_dir/summary.txt" fresh_pages 1
  assert_summary_value "$out_dir/summary.txt" processed_pages 3
  assert_summary_value "$out_dir/summary.txt" failed_operations 0
  assert_page_exported "$out_dir" ENG Later_Page 900
  assert_file_contains 'scenario resume_reuse_fail' "$out_dir/pages/ENG/Root_Page__100/page.html"
  assert_file_contains 'scenario resume_reuse_fail' "$out_dir/pages/ENG/Child_Page__200/page.html"
  assert_file_contains 'scenario resume_reuse_success' "$out_dir/pages/ENG/Later_Page__900/page.html"
  assert_file_contains $'900\tENG\tLater Page' "$out_dir/manifest.tsv"
}

# Covers: FR-0079
@test "page folder naming stays bounded for long and Unicode-heavy titles" {
  local out_dir="$CONFLUEX_WORK_DIR/long-unicode-title"

  run_confluex long_unicode_title export --page-id 100 --out "$out_dir"

  assert_success
  assert_standard_report_files "$out_dir"
  assert_summary_value "$out_dir/summary.txt" final_status success
  assert_page_dir_component_length_at_most "$out_dir" 100 85
}

# Covers: FR-0069
@test "alternate info output variants still parse into a valid export run" {
  local out_dir="$CONFLUEX_WORK_DIR/info-variant"

  run_confluex info_variant export --page-id 100 --out "$out_dir"

  assert_success
  assert_page_exported "$out_dir" ENG Root_Page 100
  assert_summary_value "$out_dir/summary.txt" final_status success
}

# Covers: FR-0022, FR-0055
@test "safe mode applies default limits, explicit overrides win, and generated output roots stay unique" {
  local out_dir="$CONFLUEX_WORK_DIR/safe-plan"
  local override_out="$CONFLUEX_WORK_DIR/safe-plan-override"

  run_confluex basic plan --page-id 100 --out "$out_dir" --safe
  assert_success
  assert_output_contains 'safe-mode: 1'
  assert_output_contains 'max-pages: 200'
  assert_output_contains 'max-download-mib: 256'
  assert_output_contains 'sleep-ms: 200'

  run_confluex basic plan --page-id 100 --out "$override_out" --safe --max-pages 7 --max-download-mib 9 --sleep-ms 5
  assert_success
  assert_output_contains 'safe-mode: 1'
  assert_output_contains 'max-pages: 7'
  assert_output_contains 'max-download-mib: 9'
  assert_output_contains 'sleep-ms: 5'

  mkdir -p "$CONFLUEX_WORK_DIR/confluence_dump_100_20240101_010203"
  run_confluex basic export --page-id 100
  assert_success
  assert_path_exists "$(generated_dir 'confluence_dump_100_20240101_010203_2')"
}

# Covers: FR-0009, FR-0010, FR-0094
@test "unbounded non-safe export and plan runs warn explicitly" {
  local unbounded_plan="$CONFLUEX_WORK_DIR/unbounded-plan"
  local unbounded_export="$CONFLUEX_WORK_DIR/unbounded-export"
  local bounded_export="$CONFLUEX_WORK_DIR/bounded-export"
  local safe_plan="$CONFLUEX_WORK_DIR/safe-plan-warning-check"

  run_confluex basic plan --page-id 100 --out "$unbounded_plan"
  assert_success
  assert_stdout_contains 'RUN_START command=plan page_id=100 output_root="'
  assert_stdout_contains 'RUN_COMPLETE final_status=success artifact="'
  assert_stdout_not_contains 'WARNING: '
  [[ "$CONFLUEX_LAST_STDERR" == WARNING:\ * ]] ||
    fail_test "expected stderr to start with 'WARNING: ', got: $CONFLUEX_LAST_STDERR"
  assert_stderr_contains 'without --safe'
  assert_stderr_contains 'effectively unbounded'

  run_confluex basic export --page-id 100 --out "$unbounded_export"
  assert_success
  assert_stdout_contains 'RUN_START command=export page_id=100 output_root="'
  assert_stdout_contains 'RUN_COMPLETE final_status=success artifact="'
  assert_stdout_not_contains 'WARNING: '
  [[ "$CONFLUEX_LAST_STDERR" == WARNING:\ * ]] ||
    fail_test "expected stderr to start with 'WARNING: ', got: $CONFLUEX_LAST_STDERR"
  assert_stderr_contains 'without --safe'
  assert_stderr_contains 'effectively unbounded'

  run_confluex basic export --page-id 100 --out "$bounded_export" --max-pages 10
  assert_success
  assert_stdout_not_contains 'WARNING: '
  assert_stderr_not_contains 'effectively unbounded'

  run_confluex basic plan --page-id 100 --out "$safe_plan" --safe
  assert_success
  assert_stdout_not_contains 'WARNING: '
  assert_stderr_not_contains 'effectively unbounded'
}

# Covers: FR-0094, FR-0097, FR-0113
@test "synthetic stress graph keeps warnings and summary data interpretable" {
  local stress_out="$CONFLUEX_WORK_DIR/stress-graph-plan"
  local limited_out="$CONFLUEX_WORK_DIR/stress-graph-plan-limited"

  run_confluex stress_graph plan --page-id 100 --out "$stress_out"
  assert_success
  assert_output_contains 'effectively unbounded'
  assert_standard_report_files "$stress_out"
  assert_summary_value "$stress_out/summary.txt" final_status success
  assert_summary_value "$stress_out/summary.txt" processed_pages 31
  assert_summary_value "$stress_out/summary.txt" root_pages 1
  assert_summary_value "$stress_out/summary.txt" tree_pages 20
  assert_summary_value "$stress_out/summary.txt" linked_pages 10
  assert_summary_value "$stress_out/summary.txt" resolved_links 10
  assert_equal "31" "$(manifest_row_count "$stress_out/manifest.tsv")" "stress manifest row count"
  assert_report_invariants "$stress_out"

  run_confluex stress_graph plan --page-id 100 --out "$limited_out" --max-pages 12
  assert_status 3
  assert_output_not_contains 'effectively unbounded'
  assert_summary_value "$limited_out/summary.txt" final_status incomplete
  assert_summary_value "$limited_out/summary.txt" interrupt_reason max_pages_limit_reached
  assert_summary_value "$limited_out/summary.txt" processed_pages 12
  assert_summary_value "$limited_out/summary.txt" root_pages 1
  assert_summary_value "$limited_out/summary.txt" tree_pages 11
  assert_summary_value "$limited_out/summary.txt" linked_pages 0
  assert_summary_value "$limited_out/summary.txt" resolved_links 10
  assert_equal "12" "$(manifest_row_count "$limited_out/manifest.tsv")" "limited stress manifest row count"
  assert_report_invariants "$limited_out"
}

# Covers: FR-0071, FR-0096, FR-0113, FR-0114
@test "pagination hints in child traversal degrade scope trust and block critical mode" {
  local findings_out="$CONFLUEX_WORK_DIR/paged-children-findings"
  local critical_out="$CONFLUEX_WORK_DIR/paged-children-critical"

  run_confluex paged_children export --page-id 100 --out "$findings_out"
  assert_success
  assert_summary_value "$findings_out/summary.txt" final_status success_with_findings
  assert_summary_value "$findings_out/summary.txt" blocking_reasons scope_findings
  assert_summary_value "$findings_out/summary.txt" scope_trust degraded
  assert_file_contains $'100\tchild_listing\tpartial_listing\thasMore_true' "$findings_out/scope-findings.tsv"

  run_confluex paged_children export --page-id 100 --out "$critical_out" --critical
  assert_status 2
  assert_summary_value "$critical_out/summary.txt" final_status policy_failed
  assert_summary_value "$critical_out/summary.txt" blocking_reasons scope_findings
  assert_summary_value "$critical_out/summary.txt" scope_trust degraded
}

# Covers: FR-0023, FR-0096, FR-0113, FR-0114
@test "critical mode implies safe defaults and blocks unresolved scope" {
  local clean_out="$CONFLUEX_WORK_DIR/critical-clean"
  local unresolved_out="$CONFLUEX_WORK_DIR/critical-unresolved"
  local override_out="$CONFLUEX_WORK_DIR/critical-overrides"
  local degraded_out="$CONFLUEX_WORK_DIR/critical-degraded-scope"

  run_confluex basic export --page-id 100 --out "$clean_out" --critical
  assert_success
  assert_output_contains 'safe-mode: 1'
  assert_output_contains 'max-pages: 200'
  assert_output_contains 'max-download-mib: 256'
  assert_output_contains 'sleep-ms: 200'
  assert_summary_value "$clean_out/summary.txt" final_status success

  run_confluex basic export --page-id 100 --out "$override_out" --critical --max-pages 7 --max-download-mib 9 --sleep-ms 5
  assert_success
  assert_output_contains 'safe-mode: 1'
  assert_output_contains 'max-pages: 7'
  assert_output_contains 'max-download-mib: 9'
  assert_output_contains 'sleep-ms: 5'

  run_confluex ambiguous_title export --page-id 100 --out "$unresolved_out" --critical
  assert_status 2
  assert_summary_value "$unresolved_out/summary.txt" final_status policy_failed
  assert_summary_value "$unresolved_out/summary.txt" blocking_reasons unresolved_links
  assert_file_contains $'100\tRoot Page\tENG\ttitle\tENG:Common Page' "$unresolved_out/unresolved-links.tsv"

  run_confluex children_unavailable export --page-id 100 --out "$degraded_out" --critical
  assert_status 2
  assert_summary_value "$degraded_out/summary.txt" final_status policy_failed
  assert_summary_value "$degraded_out/summary.txt" blocking_reasons scope_findings
  assert_summary_value "$degraded_out/summary.txt" scope_trust degraded
  assert_file_contains $'100\tchild_listing\tincomplete_tree\troot child traversal unavailable' "$degraded_out/scope-findings.tsv"
}
