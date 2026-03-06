#!/usr/bin/env bash

. "$CONFLUEX_LIB_DIR/util.sh"
. "$CONFLUEX_LIB_DIR/cli.sh"

INTERRUPTED=0

# Runtime paths (initialized by confluex_init_runtime_paths).
OUT_DIR=""
PAGES_DIR=""
META_DIR=""
TMP_DIR=""
LOG_FILE=""
MANIFEST=""
LINKS_FILE=""
UNRESOLVED=""
FAILED=""
SUMMARY=""
PREFLIGHT_INFO_FILE=""

# Counters (filled by confluex_compute_counts).
processed_count=0
failed_count=0
unresolved_count=0
resolved_count=0
manifest_count=0

# Crawl state.
declare -a QUEUE=()
declare -A QUEUED=()
declare -A VISITED=()
declare -A FIND_CACHE=()
declare -A DISCOVERED_BY=()
declare -A TITLE_BY_ID=()
declare -A SPACE_BY_ID=()
declare -A FOLDER_BY_ID=()

confluex_reset_state() {
  QUEUE=()
  QUEUED=()
  VISITED=()
  FIND_CACHE=()
  DISCOVERED_BY=()
  TITLE_BY_ID=()
  SPACE_BY_ID=()
  FOLDER_BY_ID=()
}

confluex_parse_info_file() {
  local file="$1"
  node "$CONFLUEX_LIB_DIR/parsers.js" parse-info "$file"
}

confluex_extract_children_ids() {
  local json_file="$1"
  node "$CONFLUEX_LIB_DIR/parsers.js" extract-children "$json_file"
}

confluex_extract_link_refs() {
  local xml_file="$1"
  local current_space="$2"
  node "$CONFLUEX_LIB_DIR/parsers.js" extract-links "$xml_file" "$current_space"
}

confluex_page_folder_for() {
  local page_id="$1"
  local space_key="$2"
  local title="$3"
  local safe_space
  local safe_title

  safe_space="$(sanitize_name "${space_key:-NO_SPACE}")"
  safe_title="$(sanitize_name "${title:-page_$page_id}")"
  printf '%s/%s/%s__%s\n' "$PAGES_DIR" "$safe_space" "$safe_title" "$page_id"
}

confluex_record_manifest() {
  local page_id="$1"
  local space_key="$2"
  local title="$3"
  local folder="$4"
  local discovered_by="$5"
  local mode="$6"
  local attachment_count="$7"

  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
    "$page_id" \
    "$(escape_tsv "$space_key")" \
    "$(escape_tsv "$title")" \
    "$(escape_tsv "$folder")" \
    "$(escape_tsv "$discovered_by")" \
    "$mode" \
    "$attachment_count" >> "$MANIFEST"
}

confluex_enqueue() {
  local id="$1"
  local reason="$2"

  [[ "$id" =~ ^[0-9]+$ ]] || return 0
  if [[ -n "${VISITED[$id]+x}" || -n "${QUEUED[$id]+x}" ]]; then
    return 0
  fi

  QUEUE+=("$id")
  QUEUED["$id"]=1
  DISCOVERED_BY["$id"]="$reason"
  log_info "queued page $id (reason: $reason)"
}

confluex_log_attachments_from_export() {
  local attachments_dir="$1"

  if [[ ! -d "$attachments_dir" ]]; then
    log_info "    attachments: none"
    printf '0\n'
    return 0
  fi

  local count=0
  while IFS= read -r -d '' file; do
    count=$((count + 1))
    local rel="${file#$attachments_dir/}"
    log_info "    attachment downloaded: $rel"
  done < <(find "$attachments_dir" -type f -print0 | sort -z)

  if (( count == 0 )); then
    log_info "    attachments: none"
  else
    log_info "    attachments total: $count"
  fi

  printf '%s\n' "$count"
}

confluex_log_attachments_preview() {
  local page_id="$1"
  local out_file="$2"

  if ! confluence attachments "$page_id" > "$out_file" 2>>"$LOG_FILE"; then
    log_warn "    could not list attachments for dry-run preview"
    printf '0\n'
    return 0
  fi

  local line_count=0
  while IFS= read -r line; do
    line="$(trim "$line")"
    [[ -z "$line" ]] && continue
    line_count=$((line_count + 1))
    log_info "    attachment candidate: $line"
  done < "$out_file"

  printf '%s\n' "$line_count"
}

confluex_cache_page_info_if_missing() {
  local page_id="$1"

  if [[ -n "${TITLE_BY_ID[$page_id]+x}" && -n "${SPACE_BY_ID[$page_id]+x}" ]]; then
    return 0
  fi

  local info_tmp="$TMP_DIR/info_cache_${page_id}.txt"
  if ! confluence info "$page_id" > "$info_tmp" 2>>"$LOG_FILE"; then
    return 1
  fi

  local parsed
  local title
  local space_key
  parsed="$(confluex_parse_info_file "$info_tmp")"
  IFS=$'\x1f' read -r title space_key _ <<< "$parsed"

  TITLE_BY_ID["$page_id"]="$title"
  SPACE_BY_ID["$page_id"]="$space_key"
  return 0
}

confluex_resolve_by_title() {
  local title="$1"
  local space_key="$2"
  local cache_key="${space_key}|${title}"

  if [[ -n "${FIND_CACHE[$cache_key]+x}" ]]; then
    [[ -n "${FIND_CACHE[$cache_key]}" ]] && printf '%s\n' "${FIND_CACHE[$cache_key]}"
    return 0
  fi

  local out_file="$TMP_DIR/find_${RANDOM}_${RANDOM}.txt"
  if [[ -n "$space_key" ]]; then
    if ! confluence find "$title" --space "$space_key" > "$out_file" 2>>"$LOG_FILE"; then
      FIND_CACHE["$cache_key"]=""
      rm -f "$out_file"
      return 1
    fi
  else
    if ! confluence find "$title" > "$out_file" 2>>"$LOG_FILE"; then
      FIND_CACHE["$cache_key"]=""
      rm -f "$out_file"
      return 1
    fi
  fi

  local ids=()
  local id
  while IFS= read -r id; do
    [[ "$id" =~ ^[0-9]+$ ]] || continue
    ids+=("$id")
  done < <(sed -n 's/^[[:space:]]*ID:[[:space:]]*//p' "$out_file" | grep -Eo '^[0-9]+' | sort -u || true)

  if (( ${#ids[@]} == 0 )); then
    while IFS= read -r id; do
      [[ "$id" =~ ^[0-9]+$ ]] || continue
      ids+=("$id")
    done < <(grep -Eo '[0-9]{3,}' "$out_file" | sort -u || true)
  fi

  local resolved_id=""
  local ambiguous=0

  for id in "${ids[@]}"; do
    if ! confluex_cache_page_info_if_missing "$id"; then
      continue
    fi

    local candidate_title="${TITLE_BY_ID[$id]:-}"
    local candidate_space="${SPACE_BY_ID[$id]:-}"

    [[ -n "$candidate_title" ]] || continue
    if [[ -n "$space_key" && "$candidate_space" != "$space_key" ]]; then
      continue
    fi
    if [[ "$candidate_title" != "$title" ]]; then
      continue
    fi

    if [[ -z "$resolved_id" ]]; then
      resolved_id="$id"
    else
      ambiguous=1
      break
    fi
  done

  rm -f "$out_file"

  if (( ambiguous )); then
    log_warn "ambiguous title resolution for [${space_key:-any}] $title; skipping"
    FIND_CACHE["$cache_key"]=""
    return 1
  fi

  if [[ -n "$resolved_id" ]]; then
    FIND_CACHE["$cache_key"]="$resolved_id"
    printf '%s\n' "$resolved_id"
    return 0
  fi

  FIND_CACHE["$cache_key"]=""
  return 1
}

confluex_process_links_for_page() {
  local page_id="$1"
  local title="$2"
  local space_key="$3"
  local storage_file="$4"

  local refs_file="$TMP_DIR/refs_${page_id}.txt"
  if ! confluex_extract_link_refs "$storage_file" "$space_key" > "$refs_file" 2>>"$LOG_FILE"; then
    log_warn "  failed to parse links for page $page_id"
    return 0
  fi

  while IFS=$'\x1f' read -r ref_type ref_a ref_b; do
    [[ -z "$ref_type" ]] && continue

    if [[ "$ref_type" == "id" ]]; then
      log_info "  found internal link by pageId: $ref_a"
      printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
        "$page_id" \
        "$(escape_tsv "$title")" \
        "id" \
        "$ref_a" \
        "$ref_a" \
        "" \
        "" >> "$LINKS_FILE"
      confluex_enqueue "$ref_a" "link-id:$page_id"
      continue
    fi

    if [[ "$ref_type" == "title" ]]; then
      local resolved_id=""
      log_info "  found internal link by title: [${ref_a:-same-space}] $ref_b"

      if resolved_id="$(confluex_resolve_by_title "$ref_b" "$ref_a" 2>/dev/null)"; then
        log_info "    resolved link -> pageId $resolved_id"
        printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
          "$page_id" \
          "$(escape_tsv "$title")" \
          "title" \
          "$(escape_tsv "${ref_a:+$ref_a:}$ref_b")" \
          "$resolved_id" \
          "$(escape_tsv "${TITLE_BY_ID[$resolved_id]:-}")" \
          "$(escape_tsv "${SPACE_BY_ID[$resolved_id]:-$ref_a}")" >> "$LINKS_FILE"
        confluex_enqueue "$resolved_id" "link-title:$page_id"
      else
        log_warn "    could not resolve link: [${ref_a:-same-space}] $ref_b"
        printf '%s\t%s\t%s\t%s\t%s\n' \
          "$page_id" \
          "$(escape_tsv "$title")" \
          "$(escape_tsv "$space_key")" \
          "title" \
          "$(escape_tsv "${ref_a:+$ref_a:}$ref_b")" >> "$UNRESOLVED"
      fi
    fi
  done < "$refs_file"
}

confluex_process_page() {
  local page_id="$1"
  local info_tmp="$TMP_DIR/info_${page_id}.txt"

  log_info "------------------------------------------------------------"
  log_info "processing page $page_id"
  log_info "  discovered by: ${DISCOVERED_BY[$page_id]:-unknown}"
  log_info "  mode: $([[ $CFG_DRY_RUN -eq 1 ]] && printf 'dry-run' || printf 'export')"

  if [[ "$page_id" == "$CFG_ROOT_ID" && -f "$PREFLIGHT_INFO_FILE" ]]; then
    cp "$PREFLIGHT_INFO_FILE" "$info_tmp"
  else
    if ! confluence info "$page_id" > "$info_tmp" 2>>"$LOG_FILE"; then
      log_error "failed to get info for page $page_id"
      printf '%s\tinfo\n' "$page_id" >> "$FAILED"
      return 1
    fi
  fi

  local parsed
  local title
  local space_key
  local page_url
  parsed="$(confluex_parse_info_file "$info_tmp")"
  IFS=$'\x1f' read -r title space_key page_url <<< "$parsed"
  [[ -z "$title" ]] && title="page_$page_id"

  local page_dir
  page_dir="$(confluex_page_folder_for "$page_id" "$space_key" "$title")"
  mkdir -p "$page_dir"

  TITLE_BY_ID["$page_id"]="$title"
  SPACE_BY_ID["$page_id"]="$space_key"
  FOLDER_BY_ID["$page_id"]="$page_dir"

  cp "$info_tmp" "$page_dir/_info.txt"

  log_info "  title: $title"
  log_info "  space: ${space_key:-<unknown>}"
  [[ -n "$page_url" ]] && log_info "  url: $page_url"
  log_info "  folder: $page_dir"

  local storage_file="$page_dir/_storage.xml"
  if confluence edit "$page_id" --output "$storage_file" >>"$LOG_FILE" 2>&1; then
    log_info "  saved storage XML: $storage_file"
    confluex_process_links_for_page "$page_id" "$title" "$space_key" "$storage_file"
  else
    log_warn "  failed to export storage XML for page $page_id"
    printf '%s\tedit\n' "$page_id" >> "$FAILED"
    if (( CFG_FAIL_FAST )); then
      return 1
    fi
  fi

  local attachment_count=0
  if (( CFG_DRY_RUN )); then
    log_info "  DRY-RUN: page content and attachments will NOT be downloaded"
    attachment_count="$(confluex_log_attachments_preview "$page_id" "$page_dir/_attachments_preview.txt")"
    log_info "  DRY-RUN: would export page to $page_dir/page.html"
    log_info "  DRY-RUN: attachment preview lines logged: $attachment_count"
    confluex_record_manifest "$page_id" "$space_key" "$title" "$page_dir" "${DISCOVERED_BY[$page_id]:-unknown}" "dry-run" "$attachment_count"
    return 0
  fi

  log_info "  exporting page HTML + attachments"
  if confluence export "$page_id" --format html --dest "$page_dir" --file page.html --attachments-dir attachments >>"$LOG_FILE" 2>&1; then
    log_info "  export complete"
  else
    log_warn "  export failed for page $page_id"
    printf '%s\texport\n' "$page_id" >> "$FAILED"
    if (( CFG_FAIL_FAST )); then
      return 1
    fi
  fi

  attachment_count="$(confluex_log_attachments_from_export "$page_dir/attachments")"
  confluex_record_manifest "$page_id" "$space_key" "$title" "$page_dir" "${DISCOVERED_BY[$page_id]:-unknown}" "export" "$attachment_count"
  return 0
}

confluex_compute_counts() {
  processed_count="${#VISITED[@]}"
  failed_count="$(count_lines "$FAILED")"
  unresolved_count="$(count_minus_header "$UNRESOLVED")"
  resolved_count="$(count_minus_header "$LINKS_FILE")"
  manifest_count="$(count_minus_header "$MANIFEST")"
}

confluex_write_summary() {
  local incomplete="$1"
  local reason="${2:-}"

  confluex_compute_counts

  {
    printf 'root_page_id=%s\n' "$CFG_ROOT_ID"
    printf 'dry_run=%s\n' "$CFG_DRY_RUN"
    printf 'output_dir=%s\n' "$OUT_DIR"
    printf 'processed_pages=%s\n' "$processed_count"
    printf 'manifest_rows=%s\n' "$manifest_count"
    printf 'resolved_links=%s\n' "$resolved_count"
    printf 'unresolved_links=%s\n' "$unresolved_count"
    printf 'failed_operations=%s\n' "$failed_count"
    printf 'incomplete=%s\n' "$incomplete"
    if [[ -n "$reason" ]]; then
      printf 'interrupt_reason=%s\n' "$reason"
    fi
  } > "$SUMMARY"
}

confluex_mark_incomplete() {
  local reason="$1"

  if [[ -z "$OUT_DIR" || ! -d "$OUT_DIR" ]]; then
    return 0
  fi

  {
    printf 'interrupted_at=%s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
    printf 'reason=%s\n' "$reason"
    printf 'root_page_id=%s\n' "$CFG_ROOT_ID"
    printf 'dry_run=%s\n' "$CFG_DRY_RUN"
  } > "$OUT_DIR/INCOMPLETE"
}

confluex_on_interrupt() {
  local reason="SIGINT"
  trap - INT TERM
  INTERRUPTED=1
  set +e

  if (( CFG_DRY_RUN )); then
    if [[ -n "$LOG_FILE" && -f "$LOG_FILE" ]]; then
      log_warn "interrupted (dry-run); removing $OUT_DIR"
    else
      printf 'WARN: interrupted (dry-run); removing %s\n' "$OUT_DIR" >&2
    fi
    if [[ -n "$OUT_DIR" && -d "$OUT_DIR" ]]; then
      rm -rf "$OUT_DIR"
    fi
  else
    if [[ -n "$LOG_FILE" && -f "$LOG_FILE" ]]; then
      log_warn "interrupted; marking export as incomplete"
    else
      printf 'WARN: interrupted; marking export as incomplete\n' >&2
    fi
    confluex_mark_incomplete "$reason"
    if [[ -n "$SUMMARY" ]]; then
      confluex_write_summary 1 "$reason"
    fi
  fi

  exit 130
}

confluex_init_runtime_paths() {
  local timestamp
  timestamp="$(date +%Y%m%d_%H%M%S)"

  if [[ -z "$CFG_OUT_DIR" ]]; then
    if (( CFG_DRY_RUN )); then
      OUT_DIR="confluence_plan_${CFG_ROOT_ID}_${timestamp}"
    else
      OUT_DIR="confluence_dump_${CFG_ROOT_ID}_${timestamp}"
    fi
  else
    OUT_DIR="$CFG_OUT_DIR"
  fi

  PAGES_DIR="$OUT_DIR/pages"
  META_DIR="$OUT_DIR/_meta"
  TMP_DIR="$OUT_DIR/_tmp"
  LOG_FILE="$OUT_DIR/run.log"
  MANIFEST="$OUT_DIR/manifest.tsv"
  LINKS_FILE="$OUT_DIR/resolved-links.tsv"
  UNRESOLVED="$OUT_DIR/unresolved-links.tsv"
  FAILED="$OUT_DIR/failed-pages.tsv"
  SUMMARY="$OUT_DIR/summary.txt"
  PREFLIGHT_INFO_FILE="$TMP_DIR/preflight_info_${CFG_ROOT_ID}.txt"

  mkdir -p "$PAGES_DIR" "$META_DIR" "$TMP_DIR"

  : > "$LOG_FILE"
  : > "$FAILED"
  printf 'page_id\tspace_key\ttitle\tfolder\tdiscovered_by\tmode\tattachment_count\n' > "$MANIFEST"
  printf 'from_page_id\tfrom_title\tlink_type\tlink_value\tresolved_page_id\tresolved_title\tresolved_space\n' > "$LINKS_FILE"
  printf 'from_page_id\tfrom_title\tspace_key\tlink_type\tlink_value\n' > "$UNRESOLVED"
}

confluex_collect_initial_queue() {
  local root_children_json="$TMP_DIR/root_children.json"
  local root_children_ids="$TMP_DIR/root_children_ids.txt"

  log_info "collecting recursive children for root page $CFG_ROOT_ID"
  if ! confluence children "$CFG_ROOT_ID" --recursive --format json > "$root_children_json" 2>>"$LOG_FILE"; then
    log_warn "failed to collect children for root page $CFG_ROOT_ID; continuing with root page only"
    confluex_enqueue "$CFG_ROOT_ID" root
    return 0
  fi

  confluex_enqueue "$CFG_ROOT_ID" root

  if ! confluex_extract_children_ids "$root_children_json" > "$root_children_ids" 2>>"$LOG_FILE"; then
    log_warn "failed to parse children list for root page $CFG_ROOT_ID; continuing with root page only"
    return 0
  fi

  while IFS= read -r child_id; do
    [[ -z "$child_id" ]] && continue
    [[ "$child_id" == "$CFG_ROOT_ID" ]] && continue
    log_info "found child page in tree: $child_id"
    confluex_enqueue "$child_id" "child:$CFG_ROOT_ID"
  done < "$root_children_ids"
}

confluex_preflight() {
  log_info "preflight: checking confluence-cli access"
  if confluence info "$CFG_ROOT_ID" > "$PREFLIGHT_INFO_FILE" 2>>"$LOG_FILE"; then
    return 0
  fi

  log_error "preflight failed: cannot access page $CFG_ROOT_ID. Check confluence-cli authentication and permissions."
  return 1
}

confluex_run_export() {
  local q_idx=0
  local page_id=""

  while (( q_idx < ${#QUEUE[@]} )); do
    page_id="${QUEUE[$q_idx]}"
    q_idx=$((q_idx + 1))

    [[ -n "${VISITED[$page_id]+x}" ]] && continue
    if ! confluex_process_page "$page_id"; then
      VISITED["$page_id"]=1
      if (( CFG_FAIL_FAST )); then
        return 1
      fi
      continue
    fi

    VISITED["$page_id"]=1
  done

  return 0
}

confluex_main() {
  local script_path="$1"
  local script_lib_dir="$2"
  shift 2

  CFG_HELP_ONLY=0
  if ! confluex_parse_args "$@"; then
    confluex_usage >&2
    return 1
  fi

  if (( CFG_HELP_ONLY )); then
    return 0
  fi

  if (( CFG_INSTALL )); then
    confluex_install "$script_path" "$script_lib_dir"
    return 0
  fi

  confluex_require_cmds bash node confluence sed awk grep sort find tr wc || return 1

  confluex_reset_state
  confluex_init_runtime_paths
  trap 'confluex_on_interrupt' INT TERM

  log_info "starting"
  log_info "root page id: $CFG_ROOT_ID"
  log_info "output dir: $OUT_DIR"
  log_info "dry-run: $CFG_DRY_RUN"
  log_info "fail-fast: $CFG_FAIL_FAST"

  if ! confluex_preflight; then
    return 1
  fi

  confluex_collect_initial_queue

  if ! confluex_run_export; then
    confluex_write_summary 1 "runtime_error"
    log_error "aborted due to fail-fast mode"
    return 1
  fi

  confluex_write_summary 0 ""

  log_info "done"
  log_info "processed pages: $processed_count"
  log_info "manifest rows: $manifest_count"
  log_info "resolved links: $resolved_count"
  log_info "unresolved links: $unresolved_count"
  log_info "failed operations: $failed_count"
  log_info "summary: $SUMMARY"
  log_info "manifest: $MANIFEST"
  log_info "resolved links: $LINKS_FILE"
  log_info "unresolved links: $UNRESOLVED"
  log_info "run log: $LOG_FILE"

  if (( failed_count > 0 )); then
    log_warn "some operations failed; see $FAILED and $LOG_FILE"
  fi

  return 0
}
