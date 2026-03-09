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

emit_info_variant() {
  local page_id="$1"
  local title="$2"
  local space_key="$3"
  printf 'ID: %s\n' "$page_id"
  printf 'Page Title: %s\n' "$title"
  printf 'SpaceKey: %s\n' "$space_key"
  printf 'URL: https://example.invalid/spaces/%s/pages/%s\n' "$space_key" "$page_id"
}

scenario_info() {
  local scenario="$1"
  local page_id="$2"

  case "$scenario:$page_id" in
    basic:100|duplicate_paths:100|cycle_links:100|ambiguous_title:100|linked_no_descendants:100|link_forms:100|fail_fast:100|no_fail_fast:100|partial_export_failure:100|interrupt_export:100|interrupt_dry_run:100|max_download_limit:100|code_block_pageid_text:100|invalid_content_id_valid_title:100|root_referenced_again:100|children_unavailable:100|unsupported_internal_url:100|ri_url_pageid:100|display_url_title:100|paged_children:100|partially_visible_title_resolution:100)
      emit_info 100 "Root Page" "ENG"
      ;;
    info_variant:100)
      emit_info_variant 100 "Root Page" "ENG"
      ;;
    long_unicode_title:100)
      emit_info 100 "Очень длинный заголовок / с символами : * ? < > и повтором ОченьДлинныйОченьДлинныйОченьДлинныйОченьДлинныйОченьДлинный" "ENG"
      ;;
    partially_visible_title_resolution:700)
      exit 1
      ;;
    preflight_failure:100)
      exit 1
      ;;
    basic:200|duplicate_paths:200|cycle_links:200|linked_no_descendants:200|fail_fast:200|no_fail_fast:200|partial_export_failure:200|root_referenced_again:200|paged_children:200)
      emit_info 200 "Child Page" "ENG"
      ;;
    basic:300|duplicate_paths:300|cycle_links:300|linked_no_descendants:300|link_forms:300|invalid_content_id_valid_title:300|ri_url_pageid:300|display_url_title:300)
      emit_info 300 "Linked Page" "ENG"
      ;;
    partially_visible_title_resolution:701)
      emit_info 701 "Hidden Page" "ENG"
      ;;
    link_forms:501)
      emit_info 501 "Param Linked" "OTHER"
      ;;
    link_forms:502)
      emit_info 502 "Href Linked" "ENG"
      ;;
    ambiguous_title:600|ambiguous_title:601)
      emit_info "$page_id" "Common Page" "ENG"
      ;;
    fail_fast:900|no_fail_fast:900|partial_export_failure:900)
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
    basic:100|cycle_links:100|linked_no_descendants:100)
      cat <<'JSON'
{"results":[{"id":"200","title":"Child Page","children":[]}]}
JSON
      ;;
    duplicate_paths:100)
      cat <<'JSON'
{"results":[{"id":"200","title":"Child Page","children":[]},{"id":"300","title":"Linked Page","children":[]}]}
JSON
      ;;
    fail_fast:100|no_fail_fast:100|partial_export_failure:100)
      cat <<'JSON'
{"results":[{"id":"200","title":"Child Page","children":[]},{"id":"900","title":"Later Page","children":[]}]}
JSON
      ;;
    root_referenced_again:100)
      cat <<'JSON'
{"results":[{"id":"200","title":"Child Page","children":[]}]}
JSON
      ;;
    children_unavailable:100)
      exit 1
      ;;
    paged_children:100)
      cat <<'JSON'
{"results":[{"id":"200","title":"Child Page","children":[]}],"hasMore":true,"_links":{"next":"/rest/api/content/100/child/page?start=1"}}
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
    basic:100|linked_no_descendants:100|cycle_links:100)
      cat > "$output" <<'XML'
<ac:link><ri:page ri:space-key="ENG" ri:content-title="Linked Page" /></ac:link>
XML
      ;;
    code_block_pageid_text:100)
      cat > "$output" <<'XML'
<ac:plain-text-body><![CDATA[<a href="/pages/viewpage.action?pageId=889">not a real link</a>]]></ac:plain-text-body>
<code>pageId=888</code>
<pre><a href="/pages/viewpage.action?pageId=887">still not a link</a></pre>
XML
      ;;
    invalid_content_id_valid_title:100)
      cat > "$output" <<'XML'
<ri:page ri:content-id="997" ri:space-key="ENG" ri:content-title="Linked Page" />
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
    basic:200|linked_no_descendants:200)
      cat > "$output" <<'XML'
<p>child page</p>
XML
      ;;
    basic:300|linked_no_descendants:300)
      cat > "$output" <<'XML'
<p>linked page</p>
XML
      ;;
    duplicate_paths:100)
      cat > "$output" <<'XML'
<ac:link><ri:page ri:space-key="ENG" ri:content-title="Linked Page" /></ac:link>
<ac:link><ri:page ri:space-key="ENG" ri:content-title="Linked Page" /></ac:link>
<a href="/pages/viewpage.action?pageId=300">duplicate id link</a>
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
    unsupported_internal_url:100)
      cat > "$output" <<'XML'
<ac:link><ri:url ri:value="/spaces/ENG/overview" /></ac:link>
XML
      ;;
    ri_url_pageid:100)
      cat > "$output" <<'XML'
<ac:link><ri:url ri:value="/pages/viewpage.action?pageId=300" /></ac:link>
XML
      ;;
    display_url_title:100)
      cat > "$output" <<'XML'
<a href="/display/ENG/Linked+Page">display link</a>
<ac:link><ri:url ri:value="/display/ENG/Linked+Page" /></ac:link>
XML
      ;;
    partially_visible_title_resolution:100)
      cat > "$output" <<'XML'
<ac:link><ri:page ri:space-key="ENG" ri:content-title="Hidden Page" /></ac:link>
XML
      ;;
    ri_url_pageid:300|display_url_title:300|info_variant:100|children_unavailable:100|long_unicode_title:100|paged_children:100|paged_children:200|partially_visible_title_resolution:701)
      cat > "$output" <<'XML'
<p>page body</p>
XML
      ;;
    fail_fast:100|no_fail_fast:100|fail_fast:200|no_fail_fast:200|fail_fast:900|no_fail_fast:900|partial_export_failure:100|partial_export_failure:200|partial_export_failure:900)
      cat > "$output" <<'XML'
<p>export test</p>
XML
      ;;
    interrupt_export:100|interrupt_dry_run:100|max_download_limit:100)
      cat > "$output" <<'XML'
<p>root page</p>
XML
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
    interrupt_dry_run:100)
      printf 'readme.txt\n'
      kill -INT "$(ps -o ppid= -p "$PPID" | tr -d ' ')"
      sleep 1
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
    basic:Linked\ Page:ENG|duplicate_paths:Linked\ Page:ENG|cycle_links:Linked\ Page:ENG|linked_no_descendants:Linked\ Page:ENG)
      printf 'ID: 300\n'
      ;;
    link_forms:Param\ Linked:OTHER)
      printf 'ID: 501\n'
      ;;
    display_url_title:Linked\ Page:ENG)
      printf 'ID: 300\n'
      ;;
    ambiguous_title:Common\ Page:ENG)
      printf 'ID: 600\nID: 601\n'
      ;;
    partially_visible_title_resolution:Hidden\ Page:ENG)
      printf 'ID: 700\nID: 701\n'
      ;;
    root_referenced_again:Root\ Page:ENG)
      printf 'ID: 100\n'
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
    partial_export_failure:200)
      mkdir -p "$dest/$attachments_dir"
      printf '<html><body>page %s scenario %s</body></html>\n' "$page_id" "$scenario" > "$dest/$file_name"
      printf 'attachment for %s\n' "$page_id" > "$dest/$attachments_dir/readme.txt"
      exit 1
      ;;
    interrupt_export:100)
      mkdir -p "$dest/$attachments_dir"
      printf '<html><body>page %s scenario %s</body></html>\n' "$page_id" "$scenario" > "$dest/$file_name"
      printf 'attachment for %s\n' "$page_id" > "$dest/$attachments_dir/readme.txt"
      kill -INT "$PPID"
      sleep 1
      ;;
    max_download_limit:100)
      mkdir -p "$dest/$attachments_dir"
      dd if=/dev/zero bs=1048576 count=2 2>/dev/null | tr '\0' 'x' > "$dest/$file_name"
      printf 'attachment for %s\n' "$page_id" > "$dest/$attachments_dir/readme.txt"
      return 0
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
    shift || true
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
    shift || true
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
