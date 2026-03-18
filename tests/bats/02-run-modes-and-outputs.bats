#!/usr/bin/env bats

source "${BATS_TEST_DIRNAME}/helpers/confluex_test_helper.bash"

setup() {
  confluex_setup
}

teardown() {
  confluex_teardown
}

# Covers: FR-RUN-001, FR-RUN-002, FR-GRAPH-001, FR-GRAPH-002, FR-LINK-001
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

# Covers: FR-RUN-003, FR-OUT-004
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
  assert_summary_value "$out_dir/summary.txt" dry_run 1
  assert_report_invariants "$out_dir"

  run_confluex basic plan --page-id 100 --out "$meta_out_dir" --keep-metadata
  assert_success
  assert_file_exists "$meta_out_dir/pages/ENG/Root_Page__100/_info.txt"
  assert_file_exists "$meta_out_dir/pages/ENG/Root_Page__100/_storage.xml"
  assert_file_exists "$meta_out_dir/pages/ENG/Root_Page__100/_attachments_preview.txt"
  assert_page_html_missing "$meta_out_dir" ENG Root_Page 100
}

# Covers: FR-OUT-004
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

# Covers: FR-GRAPH-002
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

# Covers: FR-GRAPH-002
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

# Covers: FR-LINK-002
@test "ambiguous title links stay unresolved instead of being guessed" {
  local out_dir="$CONFLUEX_WORK_DIR/ambiguous-link"

  run_confluex ambiguous_title export --page-id 100 --out "$out_dir"

  assert_success
  assert_equal "1" "$(manifest_row_count "$out_dir/manifest.tsv")" "manifest row count"
  assert_file_contains $'100\tRoot Page\tENG\ttitle\tENG:Common Page' "$out_dir/unresolved-links.tsv"
  assert_equal "0" "$(manifest_page_count "$out_dir/manifest.tsv" 600)" "manifest page count for 600"
  assert_equal "0" "$(manifest_page_count "$out_dir/manifest.tsv" 601)" "manifest page count for 601"
  assert_summary_value "$out_dir/summary.txt" final_status success_with_findings
  assert_summary_value "$out_dir/summary.txt" blocking_reasons unresolved_links
}

# Covers: FR-LINK-001, FR-LINK-003
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

# Covers: FR-LINK-001, FR-LINK-005, FR-OBS-001
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
  assert_file_contains $'100\tlink_support\tunsupported_internal_reference\tri:url:/spaces/ENG/overview' "$unsupported_out/scope-findings.tsv"
}

# Covers: FR-LINK-003
@test "link-like text inside code-like or plain-text content does not expand scope" {
  local out_dir="$CONFLUEX_WORK_DIR/code-text-lookalikes"

  run_confluex code_block_pageid_text export --page-id 100 --out "$out_dir"

  assert_success
  assert_equal "1" "$(manifest_row_count "$out_dir/manifest.tsv")" "manifest row count"
  assert_equal "0" "$(manifest_page_count "$out_dir/manifest.tsv" 887)" "manifest page count for 887"
  assert_equal "0" "$(manifest_page_count "$out_dir/manifest.tsv" 888)" "manifest page count for 888"
  assert_equal "0" "$(manifest_page_count "$out_dir/manifest.tsv" 889)" "manifest page count for 889"
}

# Covers: FR-LINK-005, FR-OBS-001
@test "partially inspectable title resolution records scope findings" {
  local out_dir="$CONFLUEX_WORK_DIR/partially-visible-title-resolution"

  run_confluex partially_visible_title_resolution export --page-id 100 --out "$out_dir"

  assert_success
  assert_page_exported "$out_dir" ENG Root_Page 100
  assert_page_exported "$out_dir" ENG Hidden_Page 701
  assert_summary_value "$out_dir/summary.txt" final_status success_with_findings
  assert_summary_value "$out_dir/summary.txt" blocking_reasons scope_findings
  assert_summary_value "$out_dir/summary.txt" scope_trust degraded
  assert_file_contains $'100\ttitle_resolution\ttitle_candidates_inaccessible\t[ENG] Hidden Page' "$out_dir/scope-findings.tsv"
}

# Covers: FR-LINK-004
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

# Covers: FR-LINK-004
@test "rediscovered pages that point back to the root are not re-exported" {
  local out_dir="$CONFLUEX_WORK_DIR/root-rediscovery"

  run_confluex root_referenced_again export --page-id 100 --out "$out_dir"

  assert_success
  assert_equal "2" "$(manifest_row_count "$out_dir/manifest.tsv")" "manifest row count"
  assert_equal "1" "$(manifest_page_count "$out_dir/manifest.tsv" 100)" "root manifest count"
}

# Covers: FR-OUT-001, FR-OUT-002, FR-OUT-003, FR-REP-001, FR-REP-002, FR-REP-003, FR-OBS-001
@test "export output tree and report files stay stable enough for black-box inspection" {
  local out_dir="$CONFLUEX_WORK_DIR/output-contract"

  run_confluex basic export --page-id 100 --out "$out_dir"

  assert_success
  assert_standard_report_files "$out_dir"
  assert_path_exists "$out_dir/pages"
  assert_file_contains $'page_id\tspace_key\ttitle\tfolder\tdiscovered_by\tmode\tattachment_count' "$out_dir/manifest.tsv"
  assert_manifest_folders_relative "$out_dir/manifest.tsv"
  assert_file_contains $'from_page_id\tfrom_title\tlink_type\tlink_value\tresolved_page_id\tresolved_title\tresolved_space' "$out_dir/resolved-links.tsv"
  assert_file_contains $'from_page_id\tfrom_title\tspace_key\tlink_type\tlink_value' "$out_dir/unresolved-links.tsv"
  assert_file_contains $'page_id\tscope_area\tfinding_type\tdetail' "$out_dir/scope-findings.tsv"
  assert_summary_is_key_value_file "$out_dir/summary.txt"
  assert_summary_has_keys "$out_dir/summary.txt" \
    command root_page_id dry_run safe_mode critical_mode confidential_mode support_profile scope_trust encryption_enabled encryption_successful encryption_key encryption_key_source encrypted_archive output_dir path_provenance final_status blocking_reasons \
    max_pages max_download_mib sleep_ms processed_pages root_pages tree_pages linked_pages other_pages resume_mode reused_pages fresh_pages manifest_rows \
    resolved_links unresolved_links scope_findings failed_operations downloaded_total_bytes downloaded_total_mib downloaded_content_bytes \
    downloaded_content_mib downloaded_metadata_bytes downloaded_metadata_mib incomplete
  assert_summary_value "$out_dir/summary.txt" command export
  assert_summary_value "$out_dir/summary.txt" root_page_id 100
  assert_summary_value "$out_dir/summary.txt" dry_run 0
  assert_summary_value "$out_dir/summary.txt" critical_mode 0
  assert_summary_value "$out_dir/summary.txt" confidential_mode 0
  assert_summary_value "$out_dir/summary.txt" resume_mode 0
  assert_summary_value "$out_dir/summary.txt" reused_pages 0
  assert_summary_value "$out_dir/summary.txt" fresh_pages 0
  assert_summary_value "$out_dir/summary.txt" support_profile bounded_confluence_storage_v1
  assert_summary_value "$out_dir/summary.txt" scope_trust trusted
  assert_summary_value "$out_dir/summary.txt" encryption_enabled 0
  assert_summary_value "$out_dir/summary.txt" encryption_successful 0
  assert_summary_value "$out_dir/summary.txt" path_provenance runtime_origin
  assert_summary_value "$out_dir/summary.txt" final_status success
  assert_summary_value "$out_dir/summary.txt" blocking_reasons ''
  assert_summary_value "$out_dir/summary.txt" scope_findings 0
  assert_summary_value "$out_dir/summary.txt" incomplete 0
  assert_summary_value "$out_dir/summary.txt" processed_pages 3
  assert_summary_value "$out_dir/summary.txt" manifest_rows 3
  assert_failed_pages_two_columns "$out_dir/failed-pages.tsv"
  assert_scope_findings_four_columns "$out_dir/scope-findings.tsv"
}

# Covers: FR-RUN-004, FR-OUT-001, FR-REP-003, FR-OBS-001
@test "resume mode reuses already materialized page payload from a prior failed export" {
  local out_dir="$CONFLUEX_WORK_DIR/resume-reuse"

  run_confluex resume_reuse_fail export --page-id 100 --out "$out_dir"
  assert_failure
  assert_summary_value "$out_dir/summary.txt" final_status incomplete
  assert_summary_value "$out_dir/summary.txt" failed_operations 1
  assert_page_exported "$out_dir" ENG Root_Page 100
  assert_page_exported "$out_dir" ENG Child_Page 200
  assert_page_missing "$out_dir" ENG Later_Page 900
  assert_file_contains 'scenario resume_reuse_fail' "$out_dir/pages/ENG/Root_Page__100/page.html"
  assert_file_contains 'scenario resume_reuse_fail' "$out_dir/pages/ENG/Child_Page__200/page.html"

  run_confluex resume_reuse_success export --page-id 100 --out "$out_dir" --resume
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

# Covers: FR-OUT-003
@test "page folder naming stays bounded for long and Unicode-heavy titles" {
  local out_dir="$CONFLUEX_WORK_DIR/long-unicode-title"

  run_confluex long_unicode_title export --page-id 100 --out "$out_dir"

  assert_success
  assert_standard_report_files "$out_dir"
  assert_summary_value "$out_dir/summary.txt" final_status success
  assert_page_dir_component_length_at_most "$out_dir" 100 85
}

# Covers: FR-DATA-001, FR-DIAG-001
@test "alternate info output variants still parse into a valid export run" {
  local out_dir="$CONFLUEX_WORK_DIR/info-variant"

  run_confluex info_variant export --page-id 100 --out "$out_dir"

  assert_success
  assert_page_exported "$out_dir" ENG Root_Page 100
  assert_summary_value "$out_dir/summary.txt" final_status success
}

# Covers: FR-SAFE-001, FR-SAFE-002, FR-OUT-001
@test "safe mode applies default limits, explicit overrides win, and generated output roots stay unique" {
  local out_dir="$CONFLUEX_WORK_DIR/safe-plan"
  local override_out="$CONFLUEX_WORK_DIR/safe-plan-override"

  run_confluex basic plan --page-id 100 --out "$out_dir" --safe
  assert_success
  assert_summary_value "$out_dir/summary.txt" max_pages 200
  assert_summary_value "$out_dir/summary.txt" max_download_mib 256
  assert_summary_value "$out_dir/summary.txt" sleep_ms 200

  run_confluex basic plan --page-id 100 --out "$override_out" --safe --max-pages 7 --max-download-mib 9 --sleep-ms 5
  assert_success
  assert_summary_value "$override_out/summary.txt" max_pages 7
  assert_summary_value "$override_out/summary.txt" max_download_mib 9
  assert_summary_value "$override_out/summary.txt" sleep_ms 5

  mkdir -p "$CONFLUEX_WORK_DIR/confluence_dump_100_20240101_010203"
  run_confluex basic export --page-id 100
  assert_success
  assert_path_exists "$(generated_dir 'confluence_dump_100_20240101_010203_2')"
}

# Covers: FR-SCALE-001, FR-SAFE-001
@test "unbounded non-safe export and plan runs warn explicitly" {
  local unbounded_plan="$CONFLUEX_WORK_DIR/unbounded-plan"
  local unbounded_export="$CONFLUEX_WORK_DIR/unbounded-export"
  local bounded_export="$CONFLUEX_WORK_DIR/bounded-export"
  local safe_plan="$CONFLUEX_WORK_DIR/safe-plan-warning-check"

  run_confluex basic plan --page-id 100 --out "$unbounded_plan"
  assert_success
  assert_output_contains 'without --safe'
  assert_output_contains 'effectively unbounded'

  run_confluex basic export --page-id 100 --out "$unbounded_export"
  assert_success
  assert_output_contains 'without --safe'
  assert_output_contains 'effectively unbounded'

  run_confluex basic export --page-id 100 --out "$bounded_export" --max-pages 10
  assert_success
  assert_output_not_contains 'effectively unbounded'

  run_confluex basic plan --page-id 100 --out "$safe_plan" --safe
  assert_success
  assert_output_not_contains 'effectively unbounded'
}

# Covers: FR-GRAPH-001, FR-LINK-005, FR-SAFE-006
@test "pagination hints in child traversal degrade scope trust and block critical mode" {
  local findings_out="$CONFLUEX_WORK_DIR/paged-children-findings"
  local critical_out="$CONFLUEX_WORK_DIR/paged-children-critical"

  run_confluex paged_children export --page-id 100 --out "$findings_out"
  assert_success
  assert_summary_value "$findings_out/summary.txt" final_status success_with_findings
  assert_summary_value "$findings_out/summary.txt" blocking_reasons scope_findings
  assert_summary_value "$findings_out/summary.txt" scope_trust degraded
  assert_file_contains $'100\ttree_scope\tchildren_pagination_hint\thasMore_true' "$findings_out/scope-findings.tsv"

  run_confluex paged_children export --page-id 100 --out "$critical_out" --critical
  assert_status 2
  assert_summary_value "$critical_out/summary.txt" final_status policy_failed
  assert_summary_value "$critical_out/summary.txt" blocking_reasons scope_findings
  assert_summary_value "$critical_out/summary.txt" scope_trust degraded
}

# Covers: FR-SAFE-001, FR-SAFE-006, FR-OBS-001
@test "critical mode implies safe defaults and blocks unresolved scope" {
  local clean_out="$CONFLUEX_WORK_DIR/critical-clean"
  local unresolved_out="$CONFLUEX_WORK_DIR/critical-unresolved"
  local override_out="$CONFLUEX_WORK_DIR/critical-overrides"
  local degraded_out="$CONFLUEX_WORK_DIR/critical-degraded-scope"

  run_confluex basic export --page-id 100 --out "$clean_out" --critical
  assert_success
  assert_summary_value "$clean_out/summary.txt" critical_mode 1
  assert_summary_value "$clean_out/summary.txt" safe_mode 1
  assert_summary_value "$clean_out/summary.txt" max_pages 200
  assert_summary_value "$clean_out/summary.txt" max_download_mib 256
  assert_summary_value "$clean_out/summary.txt" sleep_ms 200
  assert_summary_value "$clean_out/summary.txt" final_status success

  run_confluex basic export --page-id 100 --out "$override_out" --critical --max-pages 7 --max-download-mib 9 --sleep-ms 5
  assert_success
  assert_summary_value "$override_out/summary.txt" max_pages 7
  assert_summary_value "$override_out/summary.txt" max_download_mib 9
  assert_summary_value "$override_out/summary.txt" sleep_ms 5

  run_confluex ambiguous_title export --page-id 100 --out "$unresolved_out" --critical
  assert_status 2
  assert_summary_value "$unresolved_out/summary.txt" critical_mode 1
  assert_summary_value "$unresolved_out/summary.txt" final_status policy_failed
  assert_summary_value "$unresolved_out/summary.txt" blocking_reasons unresolved_links
  assert_file_contains $'100\tRoot Page\tENG\ttitle\tENG:Common Page' "$unresolved_out/unresolved-links.tsv"

  run_confluex children_unavailable export --page-id 100 --out "$degraded_out" --critical
  assert_status 2
  assert_summary_value "$degraded_out/summary.txt" critical_mode 1
  assert_summary_value "$degraded_out/summary.txt" final_status policy_failed
  assert_summary_value "$degraded_out/summary.txt" blocking_reasons scope_findings
  assert_summary_value "$degraded_out/summary.txt" scope_trust degraded
  assert_file_contains $'100\ttree_scope\tchildren_unavailable\troot child traversal unavailable' "$degraded_out/scope-findings.tsv"
}
