#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFLUEX_BIN="$ROOT_DIR/confluex"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/confluex-smoke.XXXXXX")"
MOCK_BIN_DIR="$TEST_ROOT/mock-bin"
WORK_DIR="$TEST_ROOT/work"

cleanup() {
  rm -rf "$TEST_ROOT"
}

trap cleanup EXIT

mkdir -p "$MOCK_BIN_DIR" "$WORK_DIR"

cat > "$MOCK_BIN_DIR/confluence" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

SCENARIO="${SCENARIO:-basic}"

emit_info() {
  local page_id="$1"
  local title="$2"
  local space_key="$3"
  printf 'ID: %s\n' "$page_id"
  printf 'Title: %s\n' "$title"
  printf 'Space Key: %s\n' "$space_key"
  printf 'URL: https://example.invalid/spaces/%s/pages/%s\n' "$space_key" "$page_id"
}

scenario_info() {
  local scenario="$1"
  local page_id="$2"

  case "$scenario:$page_id" in
    basic:100|duplicate_paths:100|linked_no_descendants:100|cycle_links:100|ambiguous_title:100|cross_space:100|link_forms:100|fail_fast:100|no_fail_fast:100|non_page_child_ids:100|title_with_colon:100|find_output_without_ids:100|find_candidate_limit:100|duplicate_child_entries:100|same_page_four_forms:100|code_block_pageid_text:100|repeated_title_links:100|content_id_only_link:100|unicode_entity_title:100|inaccessible_tree_page:100|children_command_fails:100|children_malformed_json:100|find_partial_candidate_info_failure:100|shared_find_cache_across_pages:100|rediscovered_after_visit:100|single_quote_multiline_page_link:100|broken_storage_xml:100|edit_fail_fast:100|info_fail_fast:100|root_repeated_in_children:100|case_sensitive_title_match:100|whitespace_variant_title:100|mixed_valid_and_broken_links:100|conflicting_content_id_and_title:100|empty_title_info:100|candidate_info_title_mismatch:100|title_link_to_tree_page:100|mixed_valid_broken_ambiguous_links:100|root_referenced_again:100|invalid_content_id_valid_title:100|linked_page_edit_failure_after_resolution:100|children_title_mismatch:100|shared_linked_page_two_sources:100|broken_links_with_invalid_id:100|dry_run_attachments_failure:100|linked_page_info_failure_after_resolution:100|child_without_title_in_children:100)
      emit_info 100 "Root Page" "ENG"
      ;;
    preflight_failure:100)
      exit 1
      ;;
    empty_current_space_title:100)
      printf 'ID: 100\n'
      printf 'Title: Root Page\n'
      printf 'Space Key: \n'
      printf 'URL: https://example.invalid/pages/100\n'
      ;;
    basic:200|duplicate_paths:200|linked_no_descendants:200|cycle_links:200|non_page_child_ids:200|duplicate_child_entries:200|inaccessible_tree_page:200|shared_find_cache_across_pages:200|rediscovered_after_visit:200|edit_fail_fast:200|root_referenced_again:200|shared_linked_page_two_sources:200|child_without_title_in_children:200)
      emit_info 200 "Child Page" "ENG"
      ;;
    basic:300|duplicate_paths:300|linked_no_descendants:300|cycle_links:300|link_forms:300|non_page_child_ids:300|duplicate_child_entries:300|same_page_four_forms:300|content_id_only_link:300|rediscovered_after_visit:300|title_link_to_tree_page:300|mixed_valid_broken_ambiguous_links:300|invalid_content_id_valid_title:300|shared_linked_page_two_sources:300)
      emit_info 300 "Linked Page" "ENG"
      ;;
    shared_linked_page_two_sources:201)
      emit_info 201 "Second Child" "ENG"
      ;;
    linked_page_edit_failure_after_resolution:998)
      emit_info 998 "Locked Page" "ENG"
      ;;
    linked_page_info_failure_after_resolution:999)
      exit 1
      ;;
    children_title_mismatch:200)
      emit_info 200 "Actual Child Page" "ENG"
      ;;
    candidate_info_title_mismatch:993)
      emit_info 993 "Actually Different Page" "ENG"
      ;;
    title_link_to_tree_page:200)
      emit_info 200 "Child Page" "ENG"
      ;;
    title_link_to_tree_page:300)
      emit_info 300 "Linked Page" "ENG"
      ;;
    mixed_valid_broken_ambiguous_links:600|mixed_valid_broken_ambiguous_links:601)
      emit_info "$page_id" "Common Page" "ENG"
      ;;
    root_referenced_again:700)
      emit_info 700 "Root Page" "ENG"
      ;;
    space_from_url_only:100)
      printf 'ID: 100\n'
      printf 'Title: Root Page\n'
      printf 'Space Key: \n'
      printf 'URL: https://example.invalid/spaces/ENG/pages/100\n'
      ;;
    space_from_url_only:994)
      printf 'ID: 994\n'
      printf 'Title: URL Space Page\n'
      printf 'Space Key: \n'
      printf 'URL: https://example.invalid/spaces/OPS/pages/994\n'
      ;;
    shared_find_cache_across_pages:201)
      emit_info 201 "Second Child" "ENG"
      ;;
    shared_find_cache_across_pages:970)
      emit_info 970 "Shared Cache Page" "ENG"
      ;;
    find_partial_candidate_info_failure:961)
      emit_info 961 "Exact Match Page" "ENG"
      ;;
    single_quote_multiline_page_link:980)
      emit_info 980 "Single Quote Page" "ENG"
      ;;
    case_sensitive_title_match:990)
      emit_info 990 "linked page" "ENG"
      ;;
    whitespace_variant_title:991)
      emit_info 991 "Linked   Page" "ENG"
      ;;
    empty_current_space_title:995)
      emit_info 995 "Space Unknown Page" "OTHER"
      ;;
    empty_current_space_title:996)
      emit_info 996 "Space Unknown Page" "OPS"
      ;;
    mixed_valid_and_broken_links:300)
      emit_info 300 "Linked Page" "ENG"
      ;;
    conflicting_content_id_and_title:300)
      emit_info 300 "Linked Page" "ENG"
      ;;
    empty_title_info:992)
      printf 'ID: 992\n'
      printf 'Title: \n'
      printf 'Space Key: ENG\n'
      printf 'URL: https://example.invalid/spaces/ENG/pages/992\n'
      ;;
    linked_no_descendants:400)
      emit_info 400 "Linked Descendant" "ENG"
      ;;
    ambiguous_title:600|ambiguous_title:601)
      emit_info "$page_id" "Common Page" "ENG"
      ;;
    cross_space:500)
      emit_info 500 "Shared Page" "OTHER"
      ;;
    link_forms:501)
      emit_info 501 "Param Linked" "OTHER"
      ;;
    link_forms:502)
      emit_info 502 "Href Linked" "ENG"
      ;;
    self_link:700)
      emit_info 700 "Self Page" "ENG"
      ;;
    fail_fast:900|no_fail_fast:900)
      emit_info 900 "Later Page" "ENG"
      ;;
    title_with_colon:800)
      emit_info 800 "API: Overview" "ENG"
      ;;
    find_output_without_ids:850)
      emit_info 850 "Numeric Noise Page" "ENG"
      ;;
    find_candidate_limit:860|find_candidate_limit:861|find_candidate_limit:862|find_candidate_limit:863)
      emit_info "$page_id" "Popular Page" "ENG"
      ;;
    repeated_title_links:910)
      emit_info 910 "Repeated Page" "ENG"
      ;;
    unicode_entity_title:930)
      emit_info 930 "R&D Привет" "ENG"
      ;;
    root_repeated_in_children:200)
      emit_info 200 "Child Page" "ENG"
      ;;
    edit_fail_fast:900|info_fail_fast:900)
      emit_info 900 "Later Page" "ENG"
      ;;
    *)
      exit 1
      ;;
  esac
}

scenario_children() {
  local scenario="$1"
  local page_id="$2"

  case "$scenario:$page_id" in
    basic:100|linked_no_descendants:100|cycle_links:100)
      cat <<'JSON'
{"results":[{"id":"200","title":"Child Page","children":[]}]}
JSON
      ;;
    duplicate_paths:100)
      cat <<'JSON'
{"results":[{"id":"200","title":"Child Page","children":[]},{"id":"300","title":"Linked Page","children":[]}]}
JSON
      ;;
    fail_fast:100|no_fail_fast:100)
      cat <<'JSON'
{"results":[{"id":"200","title":"Child Page","children":[]},{"id":"900","title":"Later Page","children":[]}]}
JSON
      ;;
    edit_fail_fast:100|info_fail_fast:100)
      cat <<'JSON'
{"results":[{"id":"200","title":"Child Page","children":[]},{"id":"900","title":"Later Page","children":[]}]}
JSON
      ;;
    self_link:700|ambiguous_title:100|cross_space:100|link_forms:100|title_with_colon:100|find_output_without_ids:100|find_candidate_limit:100|same_page_four_forms:100|code_block_pageid_text:100|repeated_title_links:100|content_id_only_link:100|unicode_entity_title:100|case_sensitive_title_match:100|whitespace_variant_title:100|empty_current_space_title:100|mixed_valid_and_broken_links:100|conflicting_content_id_and_title:100|empty_title_info:100|candidate_info_title_mismatch:100|space_from_url_only:100|invalid_content_id_valid_title:100|linked_page_edit_failure_after_resolution:100|broken_links_with_invalid_id:100|dry_run_attachments_failure:100|linked_page_info_failure_after_resolution:100)
      cat <<'JSON'
{"results":[]}
JSON
      ;;
    child_without_title_in_children:100)
      cat <<'JSON'
{"results":[{"id":"200","children":[]}]}
JSON
      ;;
    children_title_mismatch:100)
      cat <<'JSON'
{"results":[{"id":"200","title":"Stale Child Title","children":[]}]}
JSON
      ;;
    shared_linked_page_two_sources:100)
      cat <<'JSON'
{"results":[{"id":"200","title":"Child Page","children":[]},{"id":"201","title":"Second Child","children":[]}]}
JSON
      ;;
    title_link_to_tree_page:100)
      cat <<'JSON'
{"results":[{"id":"200","title":"Child Page","children":[]},{"id":"300","title":"Linked Page","children":[]}]}
JSON
      ;;
    mixed_valid_broken_ambiguous_links:100)
      cat <<'JSON'
{"results":[]}
JSON
      ;;
    root_referenced_again:100)
      cat <<'JSON'
{"results":[{"id":"200","title":"Child Page","children":[]}]}
JSON
      ;;
    children_command_fails:100)
      exit 1
      ;;
    children_malformed_json:100)
      printf '{this is not valid json\n'
      ;;
    find_partial_candidate_info_failure:100|single_quote_multiline_page_link:100|broken_storage_xml:100)
      cat <<'JSON'
{"results":[]}
JSON
      ;;
    shared_find_cache_across_pages:100)
      cat <<'JSON'
{"results":[{"id":"200","title":"Child Page","children":[]},{"id":"201","title":"Second Child","children":[]}]}
JSON
      ;;
    rediscovered_after_visit:100)
      cat <<'JSON'
{"results":[{"id":"300","title":"Linked Page","children":[]},{"id":"200","title":"Child Page","children":[]}]}
JSON
      ;;
    root_repeated_in_children:100)
      cat <<'JSON'
{"results":[{"id":"100","title":"Root Page","children":[]},{"id":"200","title":"Child Page","children":[]}]}
JSON
      ;;
    non_page_child_ids:100)
      cat <<'JSON'
{"results":[{"id":"200","title":"Child Page","children":[]}],"metadata":{"id":"999","title":"Not A Page","url":"/metadata/999"}}
JSON
      ;;
    duplicate_child_entries:100)
      cat <<'JSON'
{"results":[{"id":"200","title":"Child Page","children":[]},{"id":"200","title":"Child Page","children":[]},{"id":"300","title":"Linked Page","children":[]}]}
JSON
      ;;
    inaccessible_tree_page:100)
      cat <<'JSON'
{"results":[{"id":"200","title":"Child Page","children":[]},{"id":"940","title":"Forbidden Page","children":[]}]}
JSON
      ;;
    linked_no_descendants:300)
      cat <<'JSON'
{"results":[{"id":"400","title":"Linked Descendant","children":[]}]}
JSON
      ;;
    *)
      cat <<'JSON'
{"results":[]}
JSON
      ;;
  esac
}

scenario_edit() {
  local scenario="$1"
  local page_id="$2"
  local output="$3"

  case "$scenario:$page_id" in
    basic:100|linked_no_descendants:100|cycle_links:100|non_page_child_ids:100|dry_run_attachments_failure:100)
      cat > "$output" <<'XML'
<ac:link><ri:page ri:space-key="ENG" ri:content-title="Linked Page" /></ac:link>
XML
      ;;
    children_command_fails:100|children_malformed_json:100|root_repeated_in_children:100)
      cat > "$output" <<'XML'
<p>root only export</p>
XML
      ;;
    find_partial_candidate_info_failure:100)
      cat > "$output" <<'XML'
<ac:link><ri:page ri:space-key="ENG" ri:content-title="Exact Match Page" /></ac:link>
XML
      ;;
    candidate_info_title_mismatch:100)
      cat > "$output" <<'XML'
<ac:link><ri:page ri:space-key="ENG" ri:content-title="Expected Page" /></ac:link>
XML
      ;;
    invalid_content_id_valid_title:100)
      cat > "$output" <<'XML'
<ri:page ri:content-id="997" ri:space-key="ENG" ri:content-title="Linked Page" />
XML
      ;;
    linked_page_edit_failure_after_resolution:100)
      cat > "$output" <<'XML'
<ac:link><ri:page ri:space-key="ENG" ri:content-title="Locked Page" /></ac:link>
XML
      ;;
    linked_page_info_failure_after_resolution:100)
      cat > "$output" <<'XML'
<ri:content-entity ri:content-id="999" />
XML
      ;;
    children_title_mismatch:100)
      cat > "$output" <<'XML'
<p>root page</p>
XML
      ;;
    shared_linked_page_two_sources:100)
      cat > "$output" <<'XML'
<p>root page</p>
XML
      ;;
    shared_linked_page_two_sources:200)
      cat > "$output" <<'XML'
<ri:content-entity ri:content-id="300" />
XML
      ;;
    shared_linked_page_two_sources:201)
      cat > "$output" <<'XML'
<ac:link><ri:page ri:space-key="ENG" ri:content-title="Linked Page" /></ac:link>
XML
      ;;
    child_without_title_in_children:100)
      cat > "$output" <<'XML'
<p>root page</p>
XML
      ;;
    broken_links_with_invalid_id:100)
      cat > "$output" <<'XML'
<ri:content-entity ri:content-id="997" />
<ac:link><ri:page ri:space-key="ENG" ri:content-title="Missing Page" /></ac:link>
<ac:link><ri:page ri:space-key="ENG" ri:content-title="Common Page" /></ac:link>
XML
      ;;
    case_sensitive_title_match:100)
      cat > "$output" <<'XML'
<ac:link><ri:page ri:space-key="ENG" ri:content-title="Linked Page" /></ac:link>
XML
      ;;
    whitespace_variant_title:100)
      cat > "$output" <<'XML'
<ac:link><ri:page ri:space-key="ENG" ri:content-title="Linked Page" /></ac:link>
XML
      ;;
    empty_current_space_title:100)
      cat > "$output" <<'XML'
<ac:link><ri:page ri:content-title="Space Unknown Page" /></ac:link>
XML
      ;;
    mixed_valid_and_broken_links:100)
      cat > "$output" <<'XML'
<ri:content-entity ri:content-id="300" />
<ac:link><ri:page ri:space-key="ENG" ri:content-title="Missing Page" /></ac:link>
XML
      ;;
    mixed_valid_broken_ambiguous_links:100)
      cat > "$output" <<'XML'
<ri:content-entity ri:content-id="300" />
<ac:link><ri:page ri:space-key="ENG" ri:content-title="Missing Page" /></ac:link>
<ac:link><ri:page ri:space-key="ENG" ri:content-title="Common Page" /></ac:link>
XML
      ;;
    conflicting_content_id_and_title:100)
      cat > "$output" <<'XML'
<ri:page ri:content-id="300" ri:space-key="ENG" ri:content-title="Wrong Page" />
XML
      ;;
    title_link_to_tree_page:100)
      cat > "$output" <<'XML'
<ac:link><ri:page ri:space-key="ENG" ri:content-title="Linked Page" /></ac:link>
XML
      ;;
    title_link_to_tree_page:200|title_link_to_tree_page:300)
      cat > "$output" <<'XML'
<p>tree page</p>
XML
      ;;
    root_referenced_again:100)
      cat > "$output" <<'XML'
<p>root page</p>
XML
      ;;
    root_referenced_again:200)
      cat > "$output" <<'XML'
<ac:link><ri:page ri:space-key="ENG" ri:content-title="Root Page" /></ac:link>
<a href="/pages/viewpage.action?pageId=100">root href</a>
XML
      ;;
    space_from_url_only:100)
      cat > "$output" <<'XML'
<ri:content-entity ri:content-id="994" />
XML
      ;;
    empty_title_info:100)
      cat > "$output" <<'XML'
<ri:content-entity ri:content-id="992" />
XML
      ;;
    shared_find_cache_across_pages:100)
      cat > "$output" <<'XML'
<p>root page</p>
XML
      ;;
    shared_find_cache_across_pages:200|shared_find_cache_across_pages:201)
      cat > "$output" <<'XML'
<ac:link><ri:page ri:space-key="ENG" ri:content-title="Shared Cache Page" /></ac:link>
XML
      ;;
    shared_find_cache_across_pages:970)
      cat > "$output" <<'XML'
<p>shared cache target</p>
XML
      ;;
    rediscovered_after_visit:100|root_repeated_in_children:200)
      cat > "$output" <<'XML'
<p>tree page</p>
XML
      ;;
    rediscovered_after_visit:200)
      cat > "$output" <<'XML'
<ac:link><ri:page ri:space-key="ENG" ri:content-title="Linked Page" /></ac:link>
XML
      ;;
    rediscovered_after_visit:300)
      cat > "$output" <<'XML'
<p>already visited page</p>
XML
      ;;
    single_quote_multiline_page_link:100)
      cat > "$output" <<'XML'
<ac:link>
  <ri:page
    ri:space-key='ENG'
    ri:content-title='Single Quote Page'
  />
</ac:link>
XML
      ;;
    single_quote_multiline_page_link:980)
      cat > "$output" <<'XML'
<p>single quote target</p>
XML
      ;;
    broken_storage_xml:100)
      cat > "$output" <<'XML'
<ac:link><ri:page ri:space-key="ENG" ri:content-title="Unclosed Link"
XML
      ;;
    duplicate_child_entries:100|inaccessible_tree_page:100)
      cat > "$output" <<'XML'
<p>root page</p>
XML
      ;;
    basic:200|linked_no_descendants:200|non_page_child_ids:200)
      cat > "$output" <<'XML'
<p>child page</p>
XML
      ;;
    duplicate_child_entries:200|duplicate_child_entries:300|inaccessible_tree_page:200)
      cat > "$output" <<'XML'
<p>child export</p>
XML
      ;;
    basic:300|linked_no_descendants:300|non_page_child_ids:300)
      cat > "$output" <<'XML'
<p>linked page</p>
XML
      ;;
    linked_no_descendants:400)
      cat > "$output" <<'XML'
<p>linked descendant</p>
XML
      ;;
    duplicate_paths:200)
      cat > "$output" <<'XML'
<ri:content-entity ri:content-id="300" />
XML
      ;;
    duplicate_paths:300)
      cat > "$output" <<'XML'
<p>already in tree</p>
XML
      ;;
    duplicate_paths:100)
      cat > "$output" <<'XML'
<ac:link><ri:page ri:space-key="ENG" ri:content-title="Linked Page" /></ac:link>
<ac:link><ri:page ri:space-key="ENG" ri:content-title="Linked Page" /></ac:link>
<a href="/pages/viewpage.action?pageId=300">duplicate id link</a>
XML
      ;;
    cycle_links:200)
      cat > "$output" <<'XML'
<ri:content-entity ri:content-id="300" />
XML
      ;;
    cycle_links:300)
      cat > "$output" <<'XML'
<ri:content-entity ri:content-id="100" />
XML
      ;;
    ambiguous_title:100)
      cat > "$output" <<'XML'
<ac:link><ri:page ri:space-key="ENG" ri:content-title="Common Page" /></ac:link>
XML
      ;;
    ambiguous_title:600|ambiguous_title:601)
      cat > "$output" <<'XML'
<p>common page</p>
XML
      ;;
    cross_space:100)
      cat > "$output" <<'XML'
<ac:link><ri:page ri:space-key="OTHER" ri:content-title="Shared Page" /></ac:link>
XML
      ;;
    cross_space:500)
      cat > "$output" <<'XML'
<p>shared page</p>
XML
      ;;
    link_forms:100)
      cat > "$output" <<'XML'
<ri:content-entity ri:content-id="300" />
<ac:parameter ac:name="page">OTHER:Param Linked</ac:parameter>
<a href="/pages/viewpage.action?pageId=502">internal href</a>
<a href="https://external.invalid/path?pageId=999">external href</a>
XML
      ;;
    link_forms:300|link_forms:501|link_forms:502)
      cat > "$output" <<'XML'
<p>linked by content</p>
XML
      ;;
    self_link:700)
      cat > "$output" <<'XML'
<ac:link><ri:page ri:space-key="ENG" ri:content-title="Self Page" /></ac:link>
<a href="/pages/viewpage.action?pageId=700">self by id</a>
XML
      ;;
    fail_fast:100|no_fail_fast:100|fail_fast:900|no_fail_fast:900)
      cat > "$output" <<'XML'
<p>export test</p>
XML
      ;;
    title_with_colon:100)
      cat > "$output" <<'XML'
<ac:parameter ac:name="page">API: Overview</ac:parameter>
XML
      ;;
    title_with_colon:800)
      cat > "$output" <<'XML'
<p>api overview</p>
XML
      ;;
    find_output_without_ids:100)
      cat > "$output" <<'XML'
<ac:link><ri:page ri:space-key="ENG" ri:content-title="Numeric Noise Page" /></ac:link>
XML
      ;;
    find_output_without_ids:850)
      cat > "$output" <<'XML'
<p>numeric noise page</p>
XML
      ;;
    find_candidate_limit:100)
      cat > "$output" <<'XML'
<ac:link><ri:page ri:space-key="ENG" ri:content-title="Popular Page" /></ac:link>
XML
      ;;
    find_candidate_limit:860|find_candidate_limit:861|find_candidate_limit:862|find_candidate_limit:863)
      cat > "$output" <<'XML'
<p>popular page</p>
XML
      ;;
    find_partial_candidate_info_failure:961)
      cat > "$output" <<'XML'
<p>exact match page</p>
XML
      ;;
    candidate_info_title_mismatch:993|case_sensitive_title_match:990|whitespace_variant_title:991|empty_current_space_title:995|empty_current_space_title:996|mixed_valid_and_broken_links:300|mixed_valid_broken_ambiguous_links:300|conflicting_content_id_and_title:300|empty_title_info:992|space_from_url_only:994|children_title_mismatch:200|shared_linked_page_two_sources:300|child_without_title_in_children:200)
      cat > "$output" <<'XML'
<p>target page</p>
XML
      ;;
    linked_page_edit_failure_after_resolution:998)
      cat > "$output" <<'XML'
<p>locked page metadata</p>
XML
      ;;
    same_page_four_forms:100)
      cat > "$output" <<'XML'
<ri:content-entity ri:content-id="300" />
<ac:link><ri:page ri:space-key="ENG" ri:content-title="Linked Page" /></ac:link>
<ac:parameter ac:name="page">ENG:Linked Page</ac:parameter>
<a href="/pages/viewpage.action?pageId=300">internal href</a>
XML
      ;;
    same_page_four_forms:300)
      cat > "$output" <<'XML'
<p>same page via many link forms</p>
XML
      ;;
    code_block_pageid_text:100)
      cat > "$output" <<'XML'
<ac:plain-text-body><![CDATA[<a href="/pages/viewpage.action?pageId=889">not a real link</a>]]></ac:plain-text-body>
<code>pageId=888</code>
<pre><a href="/pages/viewpage.action?pageId=887">still not a link</a></pre>
XML
      ;;
    repeated_title_links:100)
      {
        i=1
        while (( i <= 100 )); do
          printf '%s\n' '<ac:link><ri:page ri:space-key="ENG" ri:content-title="Repeated Page" /></ac:link>'
          i=$((i + 1))
        done
      } > "$output"
      ;;
    repeated_title_links:910)
      cat > "$output" <<'XML'
<p>repeated page</p>
XML
      ;;
    content_id_only_link:100)
      cat > "$output" <<'XML'
<ri:page ri:content-id="300" />
XML
      ;;
    content_id_only_link:300)
      cat > "$output" <<'XML'
<p>content-id only page</p>
XML
      ;;
    unicode_entity_title:100)
      cat > "$output" <<'XML'
<ac:link><ri:page ri:space-key="ENG" ri:content-title="R&amp;D Привет" /></ac:link>
XML
      ;;
    unicode_entity_title:930)
      cat > "$output" <<'XML'
<p>unicode and entities page</p>
XML
      ;;
    edit_fail_fast:100|edit_fail_fast:900|info_fail_fast:100|info_fail_fast:900)
      cat > "$output" <<'XML'
<p>export test</p>
XML
      ;;
    fail_fast:200|no_fail_fast:200)
      cat > "$output" <<'XML'
<p>will fail on export</p>
XML
      ;;
    edit_fail_fast:200)
      exit 1
      ;;
    *)
      exit 1
      ;;
  esac
}

scenario_attachments() {
  local scenario="$1"
  local page_id="$2"

  case "$scenario:$page_id" in
    dry_run_attachments_failure:100)
      exit 1
      ;;
    self_link:700)
      printf 'self.txt\n'
      ;;
    *)
      printf 'readme.txt\n'
      ;;
  esac
}

scenario_find() {
  local scenario="$1"
  local title="$2"
  local space_key="${3:-}"

  case "$scenario:$title:$space_key" in
    basic:Linked\ Page:ENG|linked_no_descendants:Linked\ Page:ENG|cycle_links:Linked\ Page:ENG|duplicate_paths:Linked\ Page:ENG|non_page_child_ids:Linked\ Page:ENG|rediscovered_after_visit:Linked\ Page:ENG|title_link_to_tree_page:Linked\ Page:ENG|shared_linked_page_two_sources:Linked\ Page:ENG)
      printf 'ID: 300\n'
      ;;
    same_page_four_forms:Linked\ Page:ENG|content_id_only_link:Linked\ Page:ENG)
      printf 'ID: 300\n'
      ;;
    cross_space:Shared\ Page:OTHER)
      printf 'ID: 500\n'
      ;;
    link_forms:Param\ Linked:OTHER)
      printf 'ID: 501\n'
      ;;
    ambiguous_title:Common\ Page:ENG)
      printf 'ID: 600\nID: 601\n'
      ;;
    self_link:Self\ Page:ENG)
      printf 'ID: 700\n'
      ;;
    title_with_colon:API:\ Overview:ENG)
      printf 'ID: 800\n'
      ;;
    find_output_without_ids:Numeric\ Noise\ Page:ENG)
      printf 'Found 123 results on 2024-01-01\n'
      ;;
    find_candidate_limit:Popular\ Page:ENG)
      printf 'ID: 860\nID: 861\nID: 862\nID: 863\n'
      ;;
    repeated_title_links:Repeated\ Page:ENG)
      printf 'ID: 910\n'
      ;;
    find_partial_candidate_info_failure:Exact\ Match\ Page:ENG)
      printf 'ID: 960\nID: 961\n'
      ;;
    candidate_info_title_mismatch:Expected\ Page:ENG)
      printf 'ID: 993\n'
      ;;
    linked_page_info_failure_after_resolution:Info\ Missing\ Page:ENG)
      printf 'ID: 999\n'
      ;;
    linked_page_edit_failure_after_resolution:Locked\ Page:ENG)
      printf 'ID: 998\n'
      ;;
    shared_find_cache_across_pages:Shared\ Cache\ Page:ENG)
      printf 'ID: 970\n'
      ;;
    single_quote_multiline_page_link:Single\ Quote\ Page:ENG)
      printf 'ID: 980\n'
      ;;
    case_sensitive_title_match:Linked\ Page:ENG)
      printf 'ID: 990\n'
      ;;
    whitespace_variant_title:Linked\ Page:ENG)
      printf 'ID: 991\n'
      ;;
    empty_current_space_title:Space\ Unknown\ Page:)
      printf 'ID: 995\nID: 996\n'
      ;;
    mixed_valid_broken_ambiguous_links:Common\ Page:ENG)
      printf 'ID: 600\nID: 601\n'
      ;;
    broken_links_with_invalid_id:Common\ Page:ENG)
      printf 'ID: 600\nID: 601\n'
      ;;
    root_referenced_again:Root\ Page:ENG)
      printf 'ID: 100\n'
      ;;
    unicode_entity_title:R\&D\ Привет:ENG)
      printf 'ID: 930\n'
      ;;
    *)
      exit 1
      ;;
  esac
}

scenario_export() {
  local scenario="$1"
  local page_id="$2"
  local dest="$3"
  local file_name="$4"
  local attachments_dir="$5"

  case "$scenario:$page_id" in
    fail_fast:200|no_fail_fast:200)
      exit 1
      ;;
    linked_page_edit_failure_after_resolution:998)
      exit 1
      ;;
  esac

  mkdir -p "$dest/$attachments_dir"
  printf '<html><body>page %s scenario %s</body></html>\n' "$page_id" "$scenario" > "$dest/$file_name"
  printf 'attachment for %s\n' "$page_id" > "$dest/$attachments_dir/readme.txt"
}

cmd="${1:-}"
shift || true


case "$cmd" in
  info)
    scenario_info "$SCENARIO" "${1:-}"
    ;;
  children)
    scenario_children "$SCENARIO" "${1:-}"
    ;;
  edit)
    page_id="${1:-}"
    shift
    output=""
    while (($# > 0)); do
      case "$1" in
        --output)
          output="$2"
          shift 2
          ;;
        *)
          shift
          ;;
      esac
    done
    scenario_edit "$SCENARIO" "$page_id" "$output"
    ;;
  attachments)
    scenario_attachments "$SCENARIO" "${1:-}"
    ;;
  find)
    title="${1:-}"
    shift || true
    space_key=""
    while (($# > 0)); do
      case "$1" in
        --space)
          space_key="$2"
          shift 2
          ;;
        *)
          shift
          ;;
      esac
    done
    scenario_find "$SCENARIO" "$title" "$space_key"
    ;;
  export)
    page_id="${1:-}"
    shift
    dest=""
    file_name=""
    attachments_dir=""
    while (($# > 0)); do
      case "$1" in
        --dest)
          dest="$2"
          shift 2
          ;;
        --file)
          file_name="$2"
          shift 2
          ;;
        --attachments-dir)
          attachments_dir="$2"
          shift 2
          ;;
        *)
          shift
          ;;
      esac
    done
    scenario_export "$SCENARIO" "$page_id" "$dest" "$file_name" "$attachments_dir"
    ;;
  *)
    exit 1
    ;;
esac
EOF

chmod 755 "$MOCK_BIN_DIR/confluence"
export PATH="$MOCK_BIN_DIR:$PATH"

assert_file_exists() {
  local path="$1"
  [[ -f "$path" ]] || {
    printf 'ASSERT FAILED: expected file to exist: %s\n' "$path" >&2
    exit 1
  }
}

assert_path_exists() {
  local path="$1"
  [[ -e "$path" ]] || {
    printf 'ASSERT FAILED: expected path to exist: %s\n' "$path" >&2
    exit 1
  }
}

assert_path_missing() {
  local path="$1"
  [[ ! -e "$path" ]] || {
    printf 'ASSERT FAILED: expected path to be absent: %s\n' "$path" >&2
    exit 1
  }
}

assert_contains() {
  local needle="$1"
  local file="$2"
  grep -F -- "$needle" "$file" >/dev/null 2>&1 || {
    printf 'ASSERT FAILED: expected "%s" in %s\n' "$needle" "$file" >&2
    exit 1
  }
}

assert_not_contains() {
  local needle="$1"
  local file="$2"
  if grep -F -- "$needle" "$file" >/dev/null 2>&1; then
    printf 'ASSERT FAILED: did not expect "%s" in %s\n' "$needle" "$file" >&2
    exit 1
  fi
}

assert_equal() {
  local expected="$1"
  local actual="$2"
  local label="$3"
  if [[ "$expected" != "$actual" ]]; then
    printf 'ASSERT FAILED: %s expected "%s", got "%s"\n' "$label" "$expected" "$actual" >&2
    exit 1
  fi
}

assert_standard_report_files() {
  local out_dir="$1"
  assert_file_exists "$out_dir/manifest.tsv"
  assert_file_exists "$out_dir/resolved-links.tsv"
  assert_file_exists "$out_dir/unresolved-links.tsv"
  assert_file_exists "$out_dir/failed-pages.tsv"
  assert_file_exists "$out_dir/summary.txt"
}

assert_no_default_output_dirs() {
  local work_dir="$1"
  if compgen -G "$work_dir/confluence_dump_*" >/dev/null; then
    printf 'ASSERT FAILED: unexpected dump directory created in %s\n' "$work_dir" >&2
    exit 1
  fi
  if compgen -G "$work_dir/confluence_plan_*" >/dev/null; then
    printf 'ASSERT FAILED: unexpected dry-run directory created in %s\n' "$work_dir" >&2
    exit 1
  fi
}

assert_single_generated_dir() {
  local work_dir="$1"
  local glob_pattern="$2"
  local matches=()

  while IFS= read -r match; do
    matches+=("$match")
  done < <(find "$work_dir" -maxdepth 1 -mindepth 1 -type d -name "$glob_pattern" | sort)

  if (( ${#matches[@]} != 1 )); then
    printf 'ASSERT FAILED: expected exactly one directory matching %s in %s, got %s\n' "$glob_pattern" "$work_dir" "${#matches[@]}" >&2
    exit 1
  fi

  printf '%s\n' "${matches[0]}"
}

assert_page_exported() {
  local out_dir="$1"
  local space_key="$2"
  local folder_name="$3"
  local page_id="$4"
  assert_file_exists "$out_dir/pages/$space_key/${folder_name}__${page_id}/page.html"
}

assert_page_missing() {
  local out_dir="$1"
  local space_key="$2"
  local folder_name="$3"
  local page_id="$4"
  assert_path_missing "$out_dir/pages/$space_key/${folder_name}__${page_id}"
}

assert_page_html_missing() {
  local out_dir="$1"
  local space_key="$2"
  local folder_name="$3"
  local page_id="$4"
  assert_path_missing "$out_dir/pages/$space_key/${folder_name}__${page_id}/page.html"
}

assert_report_invariants() {
  local out_dir="$1"
  local dry_run
  local base_dir
  dry_run="$(summary_value "$out_dir/summary.txt" dry_run)"
  base_dir="$(dirname "$out_dir")"

  if [[ "$dry_run" == "1" ]]; then
    awk -F'\t' '
      NR == 1 { next }
      $6 != "dry-run" { exit 1 }
    ' "$out_dir/manifest.tsv" || {
      printf 'ASSERT FAILED: dry-run manifest contains non-dry-run rows in %s\n' "$out_dir/manifest.tsv" >&2
      exit 1
    }
    return 0
  fi

  awk -F'\t' '
    NR == 1 { next }
    $6 != "export" { exit 1 }
  ' "$out_dir/manifest.tsv" || {
    printf 'ASSERT FAILED: export manifest contains non-export rows in %s\n' "$out_dir/manifest.tsv" >&2
    exit 1
  }

  awk -F'\t' '
    NR == 1 { next }
    { print $1 "\t" $4 }
  ' "$out_dir/manifest.tsv" | while IFS=$'\t' read -r page_id folder; do
    [[ -z "$folder" ]] && continue
    if [[ "$folder" != /* ]]; then
      folder="$base_dir/$folder"
    fi
    assert_path_exists "$folder"
    if [[ -f "$folder/page.html" ]]; then
      continue
    fi
    if ! awk -F'\t' -v page_id="$page_id" '$1 == page_id && $2 == "export" { found = 1 } END { exit(found ? 0 : 1) }' "$out_dir/failed-pages.tsv"; then
      printf 'ASSERT FAILED: manifest row for page %s has no page.html and no export failure in %s\n' "$page_id" "$out_dir" >&2
      exit 1
    fi
  done

  awk -F'\t' '
    NR == 1 { next }
    { print $1 }
  ' "$out_dir/manifest.tsv" | sort -u > "$TEST_ROOT/manifest_ids.tmp"

  awk -F'\t' '
    { print $1 }
  ' "$out_dir/failed-pages.tsv" | sort -u > "$TEST_ROOT/failed_ids.tmp"

  awk -F'\t' '
    NR == 1 { next }
    { print $5 }
  ' "$out_dir/resolved-links.tsv" | sort -u > "$TEST_ROOT/resolved_ids.tmp"

  while IFS= read -r target_id; do
    [[ -z "$target_id" ]] && continue
    if ! grep -Fx -- "$target_id" "$TEST_ROOT/manifest_ids.tmp" >/dev/null 2>&1 \
      && ! grep -Fx -- "$target_id" "$TEST_ROOT/failed_ids.tmp" >/dev/null 2>&1; then
      printf 'ASSERT FAILED: resolved link target %s is neither exported nor failed in %s\n' "$target_id" "$out_dir" >&2
      exit 1
    fi
  done < "$TEST_ROOT/resolved_ids.tmp"
}

summary_value() {
  local file="$1"
  local key="$2"
  awk -F= -v key="$key" '$1 == key { print $2 }' "$file"
}

manifest_row_count() {
  local file="$1"
  awk 'NR > 1 { count += 1 } END { print count + 0 }' "$file"
}

manifest_page_count() {
  local file="$1"
  local page_id="$2"
  awk -F'\t' -v page_id="$page_id" 'NR > 1 && $1 == page_id { count += 1 } END { print count + 0 }' "$file"
}


run_cmd() {
  local log_file="$1"
  local scenario="$2"
  shift 2
  (
    cd "$WORK_DIR"
    SCENARIO="$scenario" "$@"
  ) >"$log_file" 2>&1
}

test_unknown_option_suggestion() {
  local log_file="$TEST_ROOT/unknown.log"
  if run_cmd "$log_file" basic "$CONFLUEX_BIN" --pageid 100; then
    printf 'ASSERT FAILED: unknown option test should fail\n' >&2
    exit 1
  fi
  assert_contains 'Did you mean: --page-id ?' "$log_file"
  assert_no_default_output_dirs "$WORK_DIR"
}

test_install_conflict_rejected() {
  local log_file="$TEST_ROOT/install-conflict.log"
  if run_cmd "$log_file" basic "$CONFLUEX_BIN" --install --page-id 100; then
    printf 'ASSERT FAILED: install conflict test should fail\n' >&2
    exit 1
  fi
  assert_contains '--install cannot be combined with --page-id' "$log_file"
  assert_no_default_output_dirs "$WORK_DIR"
}

test_install_dir_requires_install() {
  local log_file="$TEST_ROOT/install-dir.log"
  if run_cmd "$log_file" basic "$CONFLUEX_BIN" --page-id 100 --install-dir /tmp/confluex-bin; then
    printf 'ASSERT FAILED: install-dir without install should fail\n' >&2
    exit 1
  fi
  assert_contains '--install-dir requires --install' "$log_file"
  assert_no_default_output_dirs "$WORK_DIR"
}

test_empty_log_file_rejected() {
  local log_file="$TEST_ROOT/empty-log-file.log"
  if run_cmd "$log_file" basic "$CONFLUEX_BIN" --page-id 100 --log-file=; then
    printf 'ASSERT FAILED: empty log-file should fail\n' >&2
    exit 1
  fi
  assert_contains '--log-file requires a non-empty file path' "$log_file"
  assert_no_default_output_dirs "$WORK_DIR"
}

test_missing_page_id_is_rejected() {
  local log_file="$TEST_ROOT/missing-page-id.log"
  if run_cmd "$log_file" basic "$CONFLUEX_BIN"; then
    printf 'ASSERT FAILED: missing-page-id scenario should fail\n' >&2
    exit 1
  fi
  assert_contains 'ERROR: --page-id is required' "$log_file"
  assert_no_default_output_dirs "$WORK_DIR"
}

test_invalid_page_id_is_rejected() {
  local log_file="$TEST_ROOT/invalid-page-id.log"
  if run_cmd "$log_file" basic "$CONFLUEX_BIN" --page-id nope; then
    printf 'ASSERT FAILED: invalid-page-id scenario should fail\n' >&2
    exit 1
  fi
  assert_contains 'ERROR: --page-id must be numeric, got: nope' "$log_file"
  assert_no_default_output_dirs "$WORK_DIR"
}

test_invalid_max_find_candidates_is_rejected() {
  local log_file="$TEST_ROOT/invalid-max-find.log"
  if run_cmd "$log_file" basic "$CONFLUEX_BIN" --page-id 100 --max-find-candidates 0; then
    printf 'ASSERT FAILED: invalid-max-find scenario should fail\n' >&2
    exit 1
  fi
  assert_contains 'ERROR: --max-find-candidates must be a positive integer' "$log_file"
  assert_no_default_output_dirs "$WORK_DIR"
}

test_help_does_not_create_output_dirs() {
  local log_file="$TEST_ROOT/help.log"
  run_cmd "$log_file" basic "$CONFLUEX_BIN" --help

  assert_contains 'Usage:' "$log_file"
  assert_no_default_output_dirs "$WORK_DIR"
}

test_install_writes_executable_to_requested_dir() {
  local install_dir="$WORK_DIR/install-bin"
  local log_file="$TEST_ROOT/install.log"
  run_cmd "$log_file" basic "$CONFLUEX_BIN" --install --install-dir "$install_dir"

  assert_file_exists "$install_dir/confluex"
  run_cmd "$TEST_ROOT/install-help.log" basic "$install_dir/confluex" --help
  assert_contains 'Usage:' "$TEST_ROOT/install-help.log"
  assert_no_default_output_dirs "$WORK_DIR"
}

test_basic_export_downloads_tree_and_linked_page() {
  local out_dir="$WORK_DIR/basic-export"
  local log_file="$TEST_ROOT/basic-export.log"
  run_cmd "$log_file" basic "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"

  assert_file_exists "$out_dir/pages/ENG/Root_Page__100/page.html"
  assert_file_exists "$out_dir/pages/ENG/Child_Page__200/page.html"
  assert_file_exists "$out_dir/pages/ENG/Linked_Page__300/page.html"
  assert_equal "3" "$(summary_value "$out_dir/summary.txt" processed_pages)" "basic processed_pages"
  assert_equal "1" "$(summary_value "$out_dir/summary.txt" resolved_links)" "basic resolved_links"
  assert_path_exists "$out_dir/summary.txt"
  assert_contains 'downloaded_total_bytes=' "$out_dir/summary.txt"
  assert_contains 'downloaded_content_bytes=' "$out_dir/summary.txt"
  assert_contains 'downloaded_metadata_bytes=' "$out_dir/summary.txt"
}

test_page_id_equals_syntax_works() {
  local out_dir="$WORK_DIR/page-id-equals"
  local log_file="$TEST_ROOT/page-id-equals.log"
  run_cmd "$log_file" basic "$CONFLUEX_BIN" --page-id=100 --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"
  assert_page_exported "$out_dir" ENG Root_Page 100
  assert_page_exported "$out_dir" ENG Child_Page 200
  assert_page_exported "$out_dir" ENG Linked_Page 300
}

test_linked_page_does_not_pull_its_descendants() {
  local out_dir="$WORK_DIR/no-descendants"
  local log_file="$TEST_ROOT/no-descendants.log"
  run_cmd "$log_file" linked_no_descendants "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"

  assert_file_exists "$out_dir/pages/ENG/Linked_Page__300/page.html"
  assert_path_missing "$out_dir/pages/ENG/Linked_Descendant__400"
  assert_equal "3" "$(summary_value "$out_dir/summary.txt" processed_pages)" "no-descendants processed_pages"
}

test_duplicate_paths_do_not_duplicate_exports() {
  local out_dir="$WORK_DIR/duplicate-paths"
  local log_file="$TEST_ROOT/duplicate-paths.log"
  run_cmd "$log_file" duplicate_paths "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"

  assert_page_exported "$out_dir" ENG Root_Page 100
  assert_page_exported "$out_dir" ENG Child_Page 200
  assert_page_exported "$out_dir" ENG Linked_Page 300
  assert_equal "3" "$(manifest_row_count "$out_dir/manifest.tsv")" "duplicate-paths manifest rows"
  assert_equal "1" "$(manifest_page_count "$out_dir/manifest.tsv" 300)" "duplicate-paths page 300 count"
}

test_cycle_links_do_not_loop() {
  local out_dir="$WORK_DIR/cycle-links"
  local log_file="$TEST_ROOT/cycle-links.log"
  run_cmd "$log_file" cycle_links "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"

  assert_page_exported "$out_dir" ENG Root_Page 100
  assert_page_exported "$out_dir" ENG Child_Page 200
  assert_page_exported "$out_dir" ENG Linked_Page 300
  assert_equal "3" "$(summary_value "$out_dir/summary.txt" processed_pages)" "cycle-links processed_pages"
  assert_equal "1" "$(manifest_page_count "$out_dir/manifest.tsv" 100)" "cycle-links root count"
  assert_equal "1" "$(manifest_page_count "$out_dir/manifest.tsv" 300)" "cycle-links linked count"
}

test_self_link_does_not_duplicate_page() {
  local out_dir="$WORK_DIR/self-link"
  local log_file="$TEST_ROOT/self-link.log"
  run_cmd "$log_file" self_link "$CONFLUEX_BIN" --page-id 700 --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"

  assert_page_exported "$out_dir" ENG Self_Page 700
  assert_equal "1" "$(summary_value "$out_dir/summary.txt" processed_pages)" "self-link processed_pages"
  assert_equal "1" "$(manifest_row_count "$out_dir/manifest.tsv")" "self-link manifest rows"
}

test_ambiguous_title_stays_unresolved() {
  local out_dir="$WORK_DIR/ambiguous"
  local log_file="$TEST_ROOT/ambiguous.log"
  run_cmd "$log_file" ambiguous_title "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"

  assert_equal "1" "$(summary_value "$out_dir/summary.txt" unresolved_links)" "ambiguous unresolved_links"
  assert_equal "0" "$(summary_value "$out_dir/summary.txt" resolved_links)" "ambiguous resolved_links"
  assert_path_missing "$out_dir/pages/ENG/Common_Page__600"
  assert_path_missing "$out_dir/pages/ENG/Common_Page__601"
}

test_cross_space_title_link_resolves_correctly() {
  local out_dir="$WORK_DIR/cross-space"
  local log_file="$TEST_ROOT/cross-space.log"
  run_cmd "$log_file" cross_space "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"

  assert_file_exists "$out_dir/pages/OTHER/Shared_Page__500/page.html"
  assert_equal "2" "$(manifest_row_count "$out_dir/manifest.tsv")" "cross-space manifest rows"
}

test_children_parser_ignores_non_page_ids() {
  local out_dir="$WORK_DIR/non-page-child-ids"
  local log_file="$TEST_ROOT/non-page-child-ids.log"
  run_cmd "$log_file" non_page_child_ids "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"

  assert_path_missing "$out_dir/pages/NO_SPACE/Not_A_Page__999"
  assert_equal "3" "$(summary_value "$out_dir/summary.txt" processed_pages)" "non-page-child-ids processed_pages"
}

test_page_param_with_colon_space_stays_same_space_title() {
  local out_dir="$WORK_DIR/title-with-colon"
  local log_file="$TEST_ROOT/title-with-colon.log"
  run_cmd "$log_file" title_with_colon "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"

  assert_equal "1" "$(summary_value "$out_dir/summary.txt" resolved_links)" "title-with-colon resolved_links"
  assert_file_exists "$out_dir/pages/ENG/API_Overview__800/page.html"
}

test_title_resolution_is_case_sensitive() {
  local out_dir="$WORK_DIR/case-sensitive-title"
  local log_file="$TEST_ROOT/case-sensitive-title.log"
  run_cmd "$log_file" case_sensitive_title_match "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"

  assert_equal "1" "$(summary_value "$out_dir/summary.txt" unresolved_links)" "case-sensitive-title unresolved_links"
  assert_equal "0" "$(summary_value "$out_dir/summary.txt" resolved_links)" "case-sensitive-title resolved_links"
  assert_path_missing "$out_dir/pages/ENG/linked_page__990"
}

test_title_resolution_does_not_normalize_internal_whitespace() {
  local out_dir="$WORK_DIR/whitespace-variant-title"
  local log_file="$TEST_ROOT/whitespace-variant-title.log"
  run_cmd "$log_file" whitespace_variant_title "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"

  assert_equal "1" "$(summary_value "$out_dir/summary.txt" unresolved_links)" "whitespace-variant-title unresolved_links"
  assert_equal "0" "$(summary_value "$out_dir/summary.txt" resolved_links)" "whitespace-variant-title resolved_links"
  assert_path_missing "$out_dir/pages/ENG/Linked_Page__991"
}

test_title_without_space_key_and_unknown_current_space_stays_unresolved() {
  local out_dir="$WORK_DIR/empty-current-space-title"
  local log_file="$TEST_ROOT/empty-current-space-title.log"
  run_cmd "$log_file" empty_current_space_title "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"

  assert_equal "1" "$(summary_value "$out_dir/summary.txt" unresolved_links)" "empty-current-space-title unresolved_links"
  assert_equal "0" "$(summary_value "$out_dir/summary.txt" resolved_links)" "empty-current-space-title resolved_links"
  assert_path_missing "$out_dir/pages/OTHER/Space_Unknown_Page__995"
  assert_path_missing "$out_dir/pages/OPS/Space_Unknown_Page__996"
}

test_candidate_info_title_mismatch_stays_unresolved() {
  local out_dir="$WORK_DIR/candidate-info-title-mismatch"
  local log_file="$TEST_ROOT/candidate-info-title-mismatch.log"
  run_cmd "$log_file" candidate_info_title_mismatch "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"

  assert_equal "1" "$(summary_value "$out_dir/summary.txt" unresolved_links)" "candidate-info-title-mismatch unresolved_links"
  assert_equal "0" "$(summary_value "$out_dir/summary.txt" resolved_links)" "candidate-info-title-mismatch resolved_links"
  assert_path_missing "$out_dir/pages/ENG/Actually_Different_Page__993"
}

test_invalid_content_id_takes_priority_over_valid_title() {
  local out_dir="$WORK_DIR/invalid-content-id-valid-title"
  local log_file="$TEST_ROOT/invalid-content-id-valid-title.log"
  run_cmd "$log_file" invalid_content_id_valid_title "$CONFLUEX_BIN" --page-id 100 --no-fail-fast --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"

  assert_equal "2" "$(summary_value "$out_dir/summary.txt" processed_pages)" "invalid-content-id-valid-title processed_pages"
  assert_equal "1" "$(summary_value "$out_dir/summary.txt" resolved_links)" "invalid-content-id-valid-title resolved_links"
  assert_equal "1" "$(summary_value "$out_dir/summary.txt" failed_operations)" "invalid-content-id-valid-title failed_operations"
  assert_path_missing "$out_dir/pages/ENG/Linked_Page__300"
}

test_duplicate_child_entries_do_not_duplicate_queueing() {
  local out_dir="$WORK_DIR/duplicate-child-entries"
  local log_file="$TEST_ROOT/duplicate-child-entries.log"
  run_cmd "$log_file" duplicate_child_entries "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"

  assert_page_exported "$out_dir" ENG Root_Page 100
  assert_page_exported "$out_dir" ENG Child_Page 200
  assert_page_exported "$out_dir" ENG Linked_Page 300
  assert_equal "3" "$(summary_value "$out_dir/summary.txt" processed_pages)" "duplicate-child-entries processed_pages"
  assert_equal "1" "$(manifest_page_count "$out_dir/manifest.tsv" 200)" "duplicate-child-entries manifest page 200 count"
}

test_title_link_to_page_already_in_tree_is_not_reexported() {
  local out_dir="$WORK_DIR/title-link-to-tree-page"
  local log_file="$TEST_ROOT/title-link-to-tree-page.log"
  run_cmd "$log_file" title_link_to_tree_page "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"

  assert_page_exported "$out_dir" ENG Root_Page 100
  assert_page_exported "$out_dir" ENG Child_Page 200
  assert_page_exported "$out_dir" ENG Linked_Page 300
  assert_equal "3" "$(summary_value "$out_dir/summary.txt" processed_pages)" "title-link-to-tree-page processed_pages"
  assert_equal "1" "$(summary_value "$out_dir/summary.txt" resolved_links)" "title-link-to-tree-page resolved_links"
}

test_shared_linked_page_from_two_sources_is_exported_once() {
  local out_dir="$WORK_DIR/shared-linked-page-two-sources"
  local log_file="$TEST_ROOT/shared-linked-page-two-sources.log"
  run_cmd "$log_file" shared_linked_page_two_sources "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"

  assert_page_exported "$out_dir" ENG Root_Page 100
  assert_page_exported "$out_dir" ENG Child_Page 200
  assert_page_exported "$out_dir" ENG Second_Child 201
  assert_page_exported "$out_dir" ENG Linked_Page 300
  assert_equal "4" "$(summary_value "$out_dir/summary.txt" processed_pages)" "shared-linked-page-two-sources processed_pages"
  assert_equal "2" "$(summary_value "$out_dir/summary.txt" resolved_links)" "shared-linked-page-two-sources resolved_links"
  assert_equal "2" "$(awk -F'\t' 'NR > 1 && $5 == 300 { count += 1 } END { print count + 0 }' "$out_dir/resolved-links.tsv")" "shared-linked-page-two-sources dependency count"
}

test_same_page_found_through_four_forms_exports_once() {
  local out_dir="$WORK_DIR/same-page-four-forms"
  local log_file="$TEST_ROOT/same-page-four-forms.log"
  run_cmd "$log_file" same_page_four_forms "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"

  assert_page_exported "$out_dir" ENG Root_Page 100
  assert_page_exported "$out_dir" ENG Linked_Page 300
  assert_equal "2" "$(summary_value "$out_dir/summary.txt" processed_pages)" "same-page-four-forms processed_pages"
  assert_equal "1" "$(summary_value "$out_dir/summary.txt" resolved_links)" "same-page-four-forms resolved_links"
  assert_equal "1" "$(manifest_page_count "$out_dir/manifest.tsv" 300)" "same-page-four-forms manifest page 300 count"
}

test_pageid_text_inside_code_blocks_is_ignored() {
  local out_dir="$WORK_DIR/code-block-pageid"
  local log_file="$TEST_ROOT/code-block-pageid.log"
  run_cmd "$log_file" code_block_pageid_text "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"

  assert_page_exported "$out_dir" ENG Root_Page 100
  assert_page_missing "$out_dir" NO_SPACE page_887 887
  assert_page_missing "$out_dir" NO_SPACE page_888 888
  assert_page_missing "$out_dir" NO_SPACE page_889 889
  assert_equal "1" "$(summary_value "$out_dir/summary.txt" processed_pages)" "code-block-pageid processed_pages"
  assert_equal "0" "$(summary_value "$out_dir/summary.txt" resolved_links)" "code-block-pageid resolved_links"
  assert_equal "0" "$(summary_value "$out_dir/summary.txt" unresolved_links)" "code-block-pageid unresolved_links"
}

test_children_command_failure_falls_back_to_root_only() {
  local out_dir="$WORK_DIR/children-command-fails"
  local log_file="$TEST_ROOT/children-command-fails.log"
  run_cmd "$log_file" children_command_fails "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"

  assert_equal "1" "$(summary_value "$out_dir/summary.txt" processed_pages)" "children-command-fails processed_pages"
  assert_equal "1" "$(manifest_row_count "$out_dir/manifest.tsv")" "children-command-fails manifest rows"
  assert_file_exists "$out_dir/pages/ENG/Root_Page__100/page.html"
  assert_contains 'failed to collect children for root page 100; continuing with root page only' "$log_file"
}

test_children_malformed_json_falls_back_to_root_only() {
  local out_dir="$WORK_DIR/children-malformed-json"
  local log_file="$TEST_ROOT/children-malformed-json.log"
  run_cmd "$log_file" children_malformed_json "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"

  assert_equal "1" "$(summary_value "$out_dir/summary.txt" processed_pages)" "children-malformed-json processed_pages"
  assert_equal "1" "$(manifest_row_count "$out_dir/manifest.tsv")" "children-malformed-json manifest rows"
  assert_file_exists "$out_dir/pages/ENG/Root_Page__100/page.html"
  assert_contains 'failed to parse children list for root page 100; continuing with root page only' "$log_file"
}

test_find_output_without_explicit_ids_is_skipped() {
  local out_dir="$WORK_DIR/find-output-without-ids"
  local log_file="$TEST_ROOT/find-output-without-ids.log"
  run_cmd "$log_file" find_output_without_ids "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"

  assert_equal "1" "$(summary_value "$out_dir/summary.txt" unresolved_links)" "find-output-without-ids unresolved_links"
  assert_path_missing "$out_dir/pages/ENG/Numeric_Noise_Page__850"
  assert_contains 'could not parse explicit page ids from find results' "$log_file"
}

test_find_candidate_limit_skips_wide_matches() {
  local out_dir="$WORK_DIR/find-candidate-limit"
  local log_file="$TEST_ROOT/find-candidate-limit.log"
  run_cmd "$log_file" find_candidate_limit "$CONFLUEX_BIN" --page-id 100 --max-find-candidates 3 --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"

  assert_equal "1" "$(summary_value "$out_dir/summary.txt" unresolved_links)" "find-candidate-limit unresolved_links"
  assert_path_missing "$out_dir/pages/ENG/Popular_Page__860"
  assert_contains 'returned 4 candidates; limit is 3, skipping' "$log_file"
}

test_find_resolution_survives_partial_candidate_info_failure() {
  local out_dir="$WORK_DIR/find-partial-candidate-info-failure"
  local log_file="$TEST_ROOT/find-partial-candidate-info-failure.log"
  run_cmd "$log_file" find_partial_candidate_info_failure "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"

  assert_equal "1" "$(summary_value "$out_dir/summary.txt" resolved_links)" "find-partial-candidate-info-failure resolved_links"
  assert_file_exists "$out_dir/pages/ENG/Exact_Match_Page__961/page.html"
}

test_repeated_title_links_use_single_find_resolution() {
  local out_dir="$WORK_DIR/repeated-title-links"
  local log_file="$TEST_ROOT/repeated-title-links.log"
  run_cmd "$log_file" repeated_title_links "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"

  assert_page_exported "$out_dir" ENG Root_Page 100
  assert_page_exported "$out_dir" ENG Repeated_Page 910
  assert_equal "2" "$(summary_value "$out_dir/summary.txt" processed_pages)" "repeated-title-links processed_pages"
  assert_equal "1" "$(summary_value "$out_dir/summary.txt" resolved_links)" "repeated-title-links resolved_links"
}

test_find_cache_is_reused_across_pages() {
  local out_dir="$WORK_DIR/shared-find-cache"
  local log_file="$TEST_ROOT/shared-find-cache.log"
  run_cmd "$log_file" shared_find_cache_across_pages "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"

  assert_page_exported "$out_dir" ENG Root_Page 100
  assert_page_exported "$out_dir" ENG Child_Page 200
  assert_page_exported "$out_dir" ENG Second_Child 201
  assert_page_exported "$out_dir" ENG Shared_Cache_Page 970
  assert_equal "4" "$(summary_value "$out_dir/summary.txt" processed_pages)" "shared-find-cache processed_pages"
  assert_equal "2" "$(summary_value "$out_dir/summary.txt" resolved_links)" "shared-find-cache resolved_links"
}

test_content_id_only_page_link_is_downloaded() {
  local out_dir="$WORK_DIR/content-id-only-link"
  local log_file="$TEST_ROOT/content-id-only-link.log"
  run_cmd "$log_file" content_id_only_link "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"

  assert_equal "2" "$(summary_value "$out_dir/summary.txt" processed_pages)" "content-id-only-link processed_pages"
  assert_equal "1" "$(summary_value "$out_dir/summary.txt" resolved_links)" "content-id-only-link resolved_links"
  assert_file_exists "$out_dir/pages/ENG/Linked_Page__300/page.html"
}

test_mixed_valid_and_broken_links_still_download_valid_target() {
  local out_dir="$WORK_DIR/mixed-valid-and-broken-links"
  local log_file="$TEST_ROOT/mixed-valid-and-broken-links.log"
  run_cmd "$log_file" mixed_valid_and_broken_links "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"

  assert_equal "1" "$(summary_value "$out_dir/summary.txt" resolved_links)" "mixed-valid-and-broken-links resolved_links"
  assert_equal "1" "$(summary_value "$out_dir/summary.txt" unresolved_links)" "mixed-valid-and-broken-links unresolved_links"
  assert_file_exists "$out_dir/pages/ENG/Linked_Page__300/page.html"
}

test_mixed_valid_broken_and_ambiguous_links_behave_independently() {
  local out_dir="$WORK_DIR/mixed-valid-broken-ambiguous-links"
  local log_file="$TEST_ROOT/mixed-valid-broken-ambiguous-links.log"
  run_cmd "$log_file" mixed_valid_broken_ambiguous_links "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"

  assert_equal "1" "$(summary_value "$out_dir/summary.txt" resolved_links)" "mixed-valid-broken-ambiguous-links resolved_links"
  assert_equal "2" "$(summary_value "$out_dir/summary.txt" unresolved_links)" "mixed-valid-broken-ambiguous-links unresolved_links"
  assert_file_exists "$out_dir/pages/ENG/Linked_Page__300/page.html"
  assert_path_missing "$out_dir/pages/ENG/Common_Page__600"
  assert_path_missing "$out_dir/pages/ENG/Common_Page__601"
}

test_conflicting_content_id_and_title_prefers_content_id() {
  local out_dir="$WORK_DIR/conflicting-content-id-and-title"
  local log_file="$TEST_ROOT/conflicting-content-id-and-title.log"
  run_cmd "$log_file" conflicting_content_id_and_title "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"

  assert_equal "1" "$(summary_value "$out_dir/summary.txt" resolved_links)" "conflicting-content-id-and-title resolved_links"
  assert_equal "0" "$(summary_value "$out_dir/summary.txt" unresolved_links)" "conflicting-content-id-and-title unresolved_links"
  assert_file_exists "$out_dir/pages/ENG/Linked_Page__300/page.html"
}

test_linked_page_edit_failure_after_resolution_is_reported() {
  local out_dir="$WORK_DIR/linked-page-edit-failure-after-resolution"
  local log_file="$TEST_ROOT/linked-page-edit-failure-after-resolution.log"
  run_cmd "$log_file" linked_page_edit_failure_after_resolution "$CONFLUEX_BIN" --page-id 100 --no-fail-fast --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"

  assert_equal "2" "$(summary_value "$out_dir/summary.txt" processed_pages)" "linked-page-edit-failure-after-resolution processed_pages"
  assert_equal "1" "$(summary_value "$out_dir/summary.txt" resolved_links)" "linked-page-edit-failure-after-resolution resolved_links"
  assert_equal "1" "$(summary_value "$out_dir/summary.txt" failed_operations)" "linked-page-edit-failure-after-resolution failed_operations"
  assert_path_missing "$out_dir/pages/ENG/Locked_Page__998/page.html"
}

test_root_referenced_again_via_title_and_id_is_not_reexported() {
  local out_dir="$WORK_DIR/root-referenced-again"
  local log_file="$TEST_ROOT/root-referenced-again.log"
  run_cmd "$log_file" root_referenced_again "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"

  assert_page_exported "$out_dir" ENG Root_Page 100
  assert_page_exported "$out_dir" ENG Child_Page 200
  assert_equal "2" "$(summary_value "$out_dir/summary.txt" processed_pages)" "root-referenced-again processed_pages"
  assert_equal "1" "$(summary_value "$out_dir/summary.txt" resolved_links)" "root-referenced-again resolved_links"
  assert_equal "1" "$(manifest_page_count "$out_dir/manifest.tsv" 100)" "root-referenced-again root manifest count"
}

test_unicode_and_entities_titles_resolve_correctly() {
  local out_dir="$WORK_DIR/unicode-entity-title"
  local log_file="$TEST_ROOT/unicode-entity-title.log"
  run_cmd "$log_file" unicode_entity_title "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"

  assert_equal "1" "$(summary_value "$out_dir/summary.txt" resolved_links)" "unicode-entity-title resolved_links"
  assert_file_exists "$out_dir/pages/ENG/R&D_Привет__930/page.html"
}

test_single_quoted_multiline_page_link_resolves() {
  local out_dir="$WORK_DIR/single-quote-multiline-page-link"
  local log_file="$TEST_ROOT/single-quote-multiline-page-link.log"
  run_cmd "$log_file" single_quote_multiline_page_link "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"

  assert_equal "1" "$(summary_value "$out_dir/summary.txt" resolved_links)" "single-quote-multiline-page-link resolved_links"
  assert_file_exists "$out_dir/pages/ENG/Single_Quote_Page__980/page.html"
}

test_broken_storage_xml_does_not_abort_run() {
  local out_dir="$WORK_DIR/broken-storage-xml"
  local log_file="$TEST_ROOT/broken-storage-xml.log"
  run_cmd "$log_file" broken_storage_xml "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"

  assert_equal "1" "$(summary_value "$out_dir/summary.txt" processed_pages)" "broken-storage-xml processed_pages"
  assert_equal "0" "$(summary_value "$out_dir/summary.txt" resolved_links)" "broken-storage-xml resolved_links"
  assert_file_exists "$out_dir/pages/ENG/Root_Page__100/page.html"
}

test_mixed_link_forms_are_detected() {
  local out_dir="$WORK_DIR/link-forms"
  local log_file="$TEST_ROOT/link-forms.log"
  run_cmd "$log_file" link_forms "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"

  assert_file_exists "$out_dir/pages/ENG/Linked_Page__300/page.html"
  assert_file_exists "$out_dir/pages/OTHER/Param_Linked__501/page.html"
  assert_file_exists "$out_dir/pages/ENG/Href_Linked__502/page.html"
  assert_equal "4" "$(manifest_row_count "$out_dir/manifest.tsv")" "link-forms manifest rows"
  assert_not_contains '999' "$out_dir/resolved-links.tsv"
}

test_external_pageid_like_href_does_not_trigger_download() {
  local out_dir="$WORK_DIR/external-pageid-href"
  local log_file="$TEST_ROOT/external-pageid-href.log"
  run_cmd "$log_file" link_forms "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"

  assert_page_exported "$out_dir" ENG Root_Page 100
  assert_page_exported "$out_dir" ENG Linked_Page 300
  assert_page_exported "$out_dir" OTHER Param_Linked 501
  assert_page_exported "$out_dir" ENG Href_Linked 502
  assert_page_missing "$out_dir" NO_SPACE page_999 999
}

test_rediscovered_already_visited_page_is_not_reexported() {
  local out_dir="$WORK_DIR/rediscovered-after-visit"
  local log_file="$TEST_ROOT/rediscovered-after-visit.log"
  run_cmd "$log_file" rediscovered_after_visit "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"

  assert_page_exported "$out_dir" ENG Root_Page 100
  assert_page_exported "$out_dir" ENG Child_Page 200
  assert_page_exported "$out_dir" ENG Linked_Page 300
  assert_equal "3" "$(summary_value "$out_dir/summary.txt" processed_pages)" "rediscovered-after-visit processed_pages"
  assert_equal "1" "$(summary_value "$out_dir/summary.txt" resolved_links)" "rediscovered-after-visit resolved_links"
  assert_equal "1" "$(manifest_page_count "$out_dir/manifest.tsv" 300)" "rediscovered-after-visit manifest page 300 count"
}

test_root_page_repeated_in_children_is_ignored() {
  local out_dir="$WORK_DIR/root-repeated-in-children"
  local log_file="$TEST_ROOT/root-repeated-in-children.log"
  run_cmd "$log_file" root_repeated_in_children "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"

  assert_page_exported "$out_dir" ENG Root_Page 100
  assert_page_exported "$out_dir" ENG Child_Page 200
  assert_equal "2" "$(summary_value "$out_dir/summary.txt" processed_pages)" "root-repeated-in-children processed_pages"
  assert_equal "1" "$(manifest_page_count "$out_dir/manifest.tsv" 100)" "root-repeated-in-children root manifest count"
}

test_children_title_is_ignored_in_favor_of_info_title() {
  local out_dir="$WORK_DIR/children-title-mismatch"
  local log_file="$TEST_ROOT/children-title-mismatch.log"
  run_cmd "$log_file" children_title_mismatch "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"

  assert_equal "2" "$(summary_value "$out_dir/summary.txt" processed_pages)" "children-title-mismatch processed_pages"
  assert_file_exists "$out_dir/pages/ENG/Actual_Child_Page__200/page.html"
  assert_path_missing "$out_dir/pages/ENG/Stale_Child_Title__200"
}

test_child_without_title_in_children_is_still_exported() {
  local out_dir="$WORK_DIR/child-without-title"
  local log_file="$TEST_ROOT/child-without-title.log"
  run_cmd "$log_file" child_without_title_in_children "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"
  assert_page_exported "$out_dir" ENG Root_Page 100
  assert_page_exported "$out_dir" ENG Child_Page 200
}

test_empty_title_in_info_uses_fallback_folder_name() {
  local out_dir="$WORK_DIR/empty-title-info"
  local log_file="$TEST_ROOT/empty-title-info.log"
  run_cmd "$log_file" empty_title_info "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"

  assert_equal "2" "$(summary_value "$out_dir/summary.txt" processed_pages)" "empty-title-info processed_pages"
  assert_file_exists "$out_dir/pages/ENG/page_992__992/page.html"
}

test_space_key_is_recovered_from_url_when_missing_in_info() {
  local out_dir="$WORK_DIR/space-from-url-only"
  local log_file="$TEST_ROOT/space-from-url-only.log"
  run_cmd "$log_file" space_from_url_only "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"

  assert_equal "2" "$(summary_value "$out_dir/summary.txt" processed_pages)" "space-from-url-only processed_pages"
  assert_file_exists "$out_dir/pages/OPS/URL_Space_Page__994/page.html"
}

test_multiple_broken_links_including_invalid_id_are_handled_independently() {
  local out_dir="$WORK_DIR/broken-links-with-invalid-id"
  local log_file="$TEST_ROOT/broken-links-with-invalid-id.log"
  run_cmd "$log_file" broken_links_with_invalid_id "$CONFLUEX_BIN" --page-id 100 --no-fail-fast --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"

  assert_equal "2" "$(summary_value "$out_dir/summary.txt" unresolved_links)" "broken-links-with-invalid-id unresolved_links"
  assert_equal "1" "$(summary_value "$out_dir/summary.txt" failed_operations)" "broken-links-with-invalid-id failed_operations"
  assert_equal "1" "$(summary_value "$out_dir/summary.txt" resolved_links)" "broken-links-with-invalid-id resolved_links"
  assert_path_missing "$out_dir/pages/ENG/Common_Page__600"
  assert_path_missing "$out_dir/pages/ENG/Common_Page__601"
}

test_dry_run_minimal_artifacts() {
  local out_dir="$WORK_DIR/dry-run-minimal"
  local log_file="$TEST_ROOT/dry-run-minimal.log"
  run_cmd "$log_file" basic "$CONFLUEX_BIN" --page-id 100 --dry-run --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"

  assert_file_exists "$out_dir/manifest.tsv"
  assert_file_exists "$out_dir/summary.txt"
  assert_path_missing "$out_dir/run.log"
  assert_path_missing "$out_dir/pages/ENG/Root_Page__100"
}

test_dry_run_keep_metadata() {
  local out_dir="$WORK_DIR/dry-run-keep"
  local log_file="$TEST_ROOT/dry-run-keep.log"
  run_cmd "$log_file" basic "$CONFLUEX_BIN" --page-id 100 --dry-run --keep-metadata --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"

  assert_file_exists "$out_dir/pages/ENG/Root_Page__100/_info.txt"
  assert_file_exists "$out_dir/pages/ENG/Root_Page__100/_storage.xml"
  assert_file_exists "$out_dir/pages/ENG/Root_Page__100/_attachments_preview.txt"
}

test_dry_run_attachment_listing_failure_does_not_abort_plan() {
  local out_dir="$WORK_DIR/dry-run-attachments-fail"
  local log_file="$TEST_ROOT/dry-run-attachments-fail.log"
  run_cmd "$log_file" dry_run_attachments_failure "$CONFLUEX_BIN" --page-id 100 --dry-run --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"
  assert_path_missing "$out_dir/pages/ENG/Root_Page__100/page.html"
  assert_contains 'could not list attachments for dry-run preview' "$log_file"
}

test_log_file_opt_in() {
  local out_dir="$WORK_DIR/export-with-log"
  local explicit_log="$WORK_DIR/custom.log"
  local log_file="$TEST_ROOT/export-with-log.log"
  run_cmd "$log_file" basic "$CONFLUEX_BIN" --page-id 100 --out "$out_dir" --log-file "$explicit_log"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"

  assert_page_exported "$out_dir" ENG Root_Page 100
  assert_page_exported "$out_dir" ENG Child_Page 200
  assert_page_exported "$out_dir" ENG Linked_Page 300
  assert_file_exists "$explicit_log"
  assert_contains 'starting' "$explicit_log"
}

test_export_downloads_attachments() {
  local out_dir="$WORK_DIR/export-attachments"
  local log_file="$TEST_ROOT/export-attachments.log"
  run_cmd "$log_file" basic "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"
  assert_file_exists "$out_dir/pages/ENG/Root_Page__100/attachments/readme.txt"
  assert_file_exists "$out_dir/pages/ENG/Child_Page__200/attachments/readme.txt"
  assert_file_exists "$out_dir/pages/ENG/Linked_Page__300/attachments/readme.txt"
}

test_export_keep_metadata_persists_metadata_files() {
  local out_dir="$WORK_DIR/export-keep-metadata"
  local log_file="$TEST_ROOT/export-keep-metadata.log"
  run_cmd "$log_file" basic "$CONFLUEX_BIN" --page-id 100 --keep-metadata --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"
  assert_page_exported "$out_dir" ENG Root_Page 100
  assert_file_exists "$out_dir/pages/ENG/Root_Page__100/_info.txt"
  assert_file_exists "$out_dir/pages/ENG/Root_Page__100/_storage.xml"
}

test_dry_run_with_log_file_writes_log_without_html() {
  local out_dir="$WORK_DIR/dry-run-with-log"
  local explicit_log="$WORK_DIR/dry-run.log"
  local log_file="$TEST_ROOT/dry-run-with-log.log"
  run_cmd "$log_file" basic "$CONFLUEX_BIN" --page-id 100 --dry-run --out "$out_dir" --log-file "$explicit_log"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"
  assert_file_exists "$explicit_log"
  assert_contains 'starting' "$explicit_log"
  assert_path_missing "$out_dir/pages/ENG/Root_Page__100/page.html"
}

test_default_output_dir_is_generated_for_export() {
  local log_file="$TEST_ROOT/default-out-export.log"
  run_cmd "$log_file" basic "$CONFLUEX_BIN" --page-id 100

  local generated_dir
  generated_dir="$(assert_single_generated_dir "$WORK_DIR" 'confluence_dump_*')"
  assert_standard_report_files "$generated_dir"
  assert_report_invariants "$generated_dir"
  assert_page_exported "$generated_dir" ENG Root_Page 100
}

test_default_output_dir_is_generated_for_dry_run() {
  local log_file="$TEST_ROOT/default-out-dry.log"
  run_cmd "$log_file" basic "$CONFLUEX_BIN" --page-id 100 --dry-run

  local generated_dir
  generated_dir="$(assert_single_generated_dir "$WORK_DIR" 'confluence_plan_*')"
  assert_standard_report_files "$generated_dir"
  assert_report_invariants "$generated_dir"
  assert_path_missing "$generated_dir/pages/ENG/Root_Page__100/page.html"
}

test_preflight_failure_stops_before_any_export() {
  local out_dir="$WORK_DIR/preflight-failure"
  local log_file="$TEST_ROOT/preflight-failure.log"
  if run_cmd "$log_file" preflight_failure "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"; then
    printf 'ASSERT FAILED: preflight-failure scenario should return non-zero\n' >&2
    exit 1
  fi

  assert_file_exists "$out_dir/manifest.tsv"
  assert_file_exists "$out_dir/resolved-links.tsv"
  assert_file_exists "$out_dir/unresolved-links.tsv"
  assert_file_exists "$out_dir/failed-pages.tsv"
  assert_path_missing "$out_dir/summary.txt"
  assert_path_missing "$out_dir/pages/ENG/Root_Page__100"
}

test_fail_fast_stops_after_first_page_failure() {
  local out_dir="$WORK_DIR/fail-fast"
  local log_file="$TEST_ROOT/fail-fast.log"
  if run_cmd "$log_file" fail_fast "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"; then
    printf 'ASSERT FAILED: fail-fast scenario should return non-zero\n' >&2
    exit 1
  fi

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"
  assert_page_exported "$out_dir" ENG Root_Page 100
  assert_page_html_missing "$out_dir" ENG Child_Page 200
  assert_equal "1" "$(summary_value "$out_dir/summary.txt" incomplete)" "fail-fast incomplete"
  assert_equal "2" "$(summary_value "$out_dir/summary.txt" processed_pages)" "fail-fast processed_pages"
  assert_path_missing "$out_dir/pages/ENG/Later_Page__900"
}

test_fail_fast_stops_after_edit_failure() {
  local out_dir="$WORK_DIR/edit-fail-fast"
  local log_file="$TEST_ROOT/edit-fail-fast.log"
  if run_cmd "$log_file" edit_fail_fast "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"; then
    printf 'ASSERT FAILED: edit-fail-fast scenario should return non-zero\n' >&2
    exit 1
  fi

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"
  assert_page_exported "$out_dir" ENG Root_Page 100
  assert_page_html_missing "$out_dir" ENG Child_Page 200
  assert_equal "1" "$(summary_value "$out_dir/summary.txt" incomplete)" "edit-fail-fast incomplete"
  assert_equal "2" "$(summary_value "$out_dir/summary.txt" processed_pages)" "edit-fail-fast processed_pages"
  assert_path_missing "$out_dir/pages/ENG/Later_Page__900"
  assert_contains $'200\tedit' "$out_dir/failed-pages.tsv"
}

test_fail_fast_stops_after_info_failure() {
  local out_dir="$WORK_DIR/info-fail-fast"
  local log_file="$TEST_ROOT/info-fail-fast.log"
  if run_cmd "$log_file" info_fail_fast "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"; then
    printf 'ASSERT FAILED: info-fail-fast scenario should return non-zero\n' >&2
    exit 1
  fi

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"
  assert_page_exported "$out_dir" ENG Root_Page 100
  assert_page_missing "$out_dir" ENG Child_Page 200
  assert_equal "1" "$(summary_value "$out_dir/summary.txt" incomplete)" "info-fail-fast incomplete"
  assert_equal "2" "$(summary_value "$out_dir/summary.txt" processed_pages)" "info-fail-fast processed_pages"
  assert_path_missing "$out_dir/pages/ENG/Later_Page__900"
  assert_contains $'200\tinfo' "$out_dir/failed-pages.tsv"
}

test_no_fail_fast_continues_after_failure() {
  local out_dir="$WORK_DIR/no-fail-fast"
  local log_file="$TEST_ROOT/no-fail-fast.log"
  run_cmd "$log_file" no_fail_fast "$CONFLUEX_BIN" --page-id 100 --no-fail-fast --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"

  assert_equal "0" "$(summary_value "$out_dir/summary.txt" incomplete)" "no-fail-fast incomplete"
  assert_equal "3" "$(summary_value "$out_dir/summary.txt" processed_pages)" "no-fail-fast processed_pages"
  assert_equal "1" "$(summary_value "$out_dir/summary.txt" failed_operations)" "no-fail-fast failed_operations"
  assert_file_exists "$out_dir/pages/ENG/Later_Page__900/page.html"
}

test_no_fail_fast_continues_after_inaccessible_tree_page() {
  local out_dir="$WORK_DIR/inaccessible-tree-page"
  local log_file="$TEST_ROOT/inaccessible-tree-page.log"
  run_cmd "$log_file" inaccessible_tree_page "$CONFLUEX_BIN" --page-id 100 --no-fail-fast --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"

  assert_equal "0" "$(summary_value "$out_dir/summary.txt" incomplete)" "inaccessible-tree-page incomplete"
  assert_equal "3" "$(summary_value "$out_dir/summary.txt" processed_pages)" "inaccessible-tree-page processed_pages"
  assert_equal "1" "$(summary_value "$out_dir/summary.txt" failed_operations)" "inaccessible-tree-page failed_operations"
  assert_file_exists "$out_dir/pages/ENG/Child_Page__200/page.html"
  assert_path_missing "$out_dir/pages/NO_SPACE/Forbidden_Page__940"
}

test_no_fail_fast_continues_after_linked_page_info_failure() {
  local out_dir="$WORK_DIR/linked-page-info-failure"
  local log_file="$TEST_ROOT/linked-page-info-failure.log"
  run_cmd "$log_file" linked_page_info_failure_after_resolution "$CONFLUEX_BIN" --page-id 100 --no-fail-fast --out "$out_dir"

  assert_standard_report_files "$out_dir"
  assert_report_invariants "$out_dir"
  assert_page_exported "$out_dir" ENG Root_Page 100
  assert_equal "2" "$(summary_value "$out_dir/summary.txt" processed_pages)" "linked-page-info-failure processed_pages"
  assert_equal "1" "$(summary_value "$out_dir/summary.txt" resolved_links)" "linked-page-info-failure resolved_links"
  assert_equal "1" "$(summary_value "$out_dir/summary.txt" failed_operations)" "linked-page-info-failure failed_operations"
  assert_page_missing "$out_dir" NO_SPACE page_999 999
}

test_unknown_option_suggestion
test_install_conflict_rejected
test_install_dir_requires_install
test_empty_log_file_rejected
test_missing_page_id_is_rejected
test_invalid_page_id_is_rejected
test_invalid_max_find_candidates_is_rejected
test_help_does_not_create_output_dirs
test_install_writes_executable_to_requested_dir
test_basic_export_downloads_tree_and_linked_page
test_page_id_equals_syntax_works
test_linked_page_does_not_pull_its_descendants
test_duplicate_paths_do_not_duplicate_exports
test_cycle_links_do_not_loop
test_self_link_does_not_duplicate_page
test_ambiguous_title_stays_unresolved
test_cross_space_title_link_resolves_correctly
test_children_parser_ignores_non_page_ids
test_page_param_with_colon_space_stays_same_space_title
test_title_resolution_is_case_sensitive
test_title_resolution_does_not_normalize_internal_whitespace
test_title_without_space_key_and_unknown_current_space_stays_unresolved
test_candidate_info_title_mismatch_stays_unresolved
test_invalid_content_id_takes_priority_over_valid_title
test_duplicate_child_entries_do_not_duplicate_queueing
test_title_link_to_page_already_in_tree_is_not_reexported
test_shared_linked_page_from_two_sources_is_exported_once
test_same_page_found_through_four_forms_exports_once
test_pageid_text_inside_code_blocks_is_ignored
test_children_command_failure_falls_back_to_root_only
test_children_malformed_json_falls_back_to_root_only
test_find_output_without_explicit_ids_is_skipped
test_find_candidate_limit_skips_wide_matches
test_find_resolution_survives_partial_candidate_info_failure
test_repeated_title_links_use_single_find_resolution
test_find_cache_is_reused_across_pages
test_content_id_only_page_link_is_downloaded
test_mixed_valid_and_broken_links_still_download_valid_target
test_mixed_valid_broken_and_ambiguous_links_behave_independently
test_conflicting_content_id_and_title_prefers_content_id
test_linked_page_edit_failure_after_resolution_is_reported
test_root_referenced_again_via_title_and_id_is_not_reexported
test_unicode_and_entities_titles_resolve_correctly
test_single_quoted_multiline_page_link_resolves
test_broken_storage_xml_does_not_abort_run
test_mixed_link_forms_are_detected
test_external_pageid_like_href_does_not_trigger_download
test_rediscovered_already_visited_page_is_not_reexported
test_root_page_repeated_in_children_is_ignored
test_children_title_is_ignored_in_favor_of_info_title
test_child_without_title_in_children_is_still_exported
test_empty_title_in_info_uses_fallback_folder_name
test_space_key_is_recovered_from_url_when_missing_in_info
test_multiple_broken_links_including_invalid_id_are_handled_independently
test_dry_run_minimal_artifacts
test_dry_run_keep_metadata
test_dry_run_attachment_listing_failure_does_not_abort_plan
test_log_file_opt_in
test_export_downloads_attachments
test_export_keep_metadata_persists_metadata_files
test_dry_run_with_log_file_writes_log_without_html
test_default_output_dir_is_generated_for_export
test_default_output_dir_is_generated_for_dry_run
test_preflight_failure_stops_before_any_export
test_fail_fast_stops_after_first_page_failure
test_fail_fast_stops_after_edit_failure
test_fail_fast_stops_after_info_failure
test_no_fail_fast_continues_after_failure
test_no_fail_fast_continues_after_inaccessible_tree_page
test_no_fail_fast_continues_after_linked_page_info_failure

printf 'Smoke tests passed.\n'
