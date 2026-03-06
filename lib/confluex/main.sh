#!/usr/bin/env bash
# shellcheck disable=SC1091
. "$CONFLUEX_LIB_DIR/util.sh"
# shellcheck disable=SC1091
. "$CONFLUEX_LIB_DIR/cli.sh"

# Runtime paths (initialized by confluex_init_runtime_paths).
OUT_DIR=""
PAGES_DIR=""
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
downloaded_metadata_bytes=0
downloaded_content_bytes=0
downloaded_total_bytes=0
root_count=0
tree_count=0
linked_count=0
other_count=0
CONFLUEX_STOP_REASON=""
CFG_MAX_DOWNLOAD_BYTES=0

# Crawl state.
declare -a QUEUE=()
declare -A QUEUED=()
declare -A VISITED=()
declare -A FIND_CACHE=()
declare -A DISCOVERED_BY=()
declare -A TITLE_BY_ID=()
declare -A SPACE_BY_ID=()
declare -A RECORDED_RESOLVED_LINKS=()
CONFLUEX_LAST_RESOLVED_ID=""

confluex_reset_state() {
  QUEUE=()
  QUEUED=()
  VISITED=()
  FIND_CACHE=()
  DISCOVERED_BY=()
  TITLE_BY_ID=()
  SPACE_BY_ID=()
  RECORDED_RESOLVED_LINKS=()
  CONFLUEX_LAST_RESOLVED_ID=""
  downloaded_metadata_bytes=0
  downloaded_content_bytes=0
  downloaded_total_bytes=0
  root_count=0
  tree_count=0
  linked_count=0
  other_count=0
  CONFLUEX_STOP_REASON=""
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

confluex_record_resolved_link() {
  local from_page_id="$1"
  local from_title="$2"
  local link_type="$3"
  local link_value="$4"
  local resolved_page_id="$5"
  local resolved_title="$6"
  local resolved_space="$7"
  local key="${from_page_id}|${resolved_page_id}"

  if [[ -n "${RECORDED_RESOLVED_LINKS[$key]+x}" ]]; then
    return 1
  fi

  RECORDED_RESOLVED_LINKS["$key"]=1
  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
    "$from_page_id" \
    "$(escape_tsv "$from_title")" \
    "$link_type" \
    "$(escape_tsv "$link_value")" \
    "$resolved_page_id" \
    "$(escape_tsv "$resolved_title")" \
    "$(escape_tsv "$resolved_space")" >> "$LINKS_FILE"
  return 0
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
    local rel="${file#"$attachments_dir"/}"
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

  if ! confluex_capture_stdout "$out_file" confluence attachments "$page_id"; then
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

confluex_temp_file() {
  local name="$1"
  printf '%s/%s\n' "$TMP_DIR" "$name"
}

confluex_file_size_bytes() {
  local path="$1"
  if [[ -f "$path" ]]; then
    wc -c < "$path" | tr -d ' '
  else
    printf '0\n'
  fi
}

confluex_dir_size_bytes() {
  local dir_path="$1"
  local total=0
  local file=""

  if [[ ! -d "$dir_path" ]]; then
    printf '0\n'
    return 0
  fi

  while IFS= read -r -d '' file; do
    total=$((total + $(confluex_file_size_bytes "$file")))
  done < <(find "$dir_path" -type f -print0)

  printf '%s\n' "$total"
}

confluex_bytes_to_mib() {
  local bytes="$1"
  awk -v bytes="$bytes" 'BEGIN { printf "%.2f", bytes / 1048576 }'
}

confluex_ms_to_seconds() {
  local ms="$1"
  awk -v ms="$ms" 'BEGIN { printf "%.3f", ms / 1000 }'
}

confluex_track_download_bytes() {
  local kind="$1"
  local bytes="${2:-0}"

  [[ "$bytes" =~ ^[0-9]+$ ]] || bytes=0
  downloaded_total_bytes=$((downloaded_total_bytes + bytes))

  case "$kind" in
    metadata)
      downloaded_metadata_bytes=$((downloaded_metadata_bytes + bytes))
      ;;
    content)
      downloaded_content_bytes=$((downloaded_content_bytes + bytes))
      ;;
  esac
}

confluex_compute_breakdown() {
  local page_id=""
  local reason=""

  root_count=0
  tree_count=0
  linked_count=0
  other_count=0

  for page_id in "${!VISITED[@]}"; do
    reason="${DISCOVERED_BY[$page_id]:-unknown}"
    case "$reason" in
      root)
        root_count=$((root_count + 1))
        ;;
      child:*)
        tree_count=$((tree_count + 1))
        ;;
      link-*)
        linked_count=$((linked_count + 1))
        ;;
      *)
        other_count=$((other_count + 1))
        ;;
    esac
  done
}

confluex_log_download_progress() {
  local label="$1"
  log_info "  download progress (${label}): total=$(confluex_bytes_to_mib "$downloaded_total_bytes") MiB, content=$(confluex_bytes_to_mib "$downloaded_content_bytes") MiB, metadata=$(confluex_bytes_to_mib "$downloaded_metadata_bytes") MiB"
}

confluex_sleep_between_pages_if_needed() {
  if (( CFG_SLEEP_MS > 0 )); then
    sleep "$(confluex_ms_to_seconds "$CFG_SLEEP_MS")"
  fi
}

confluex_limits_reached() {
  if (( CFG_MAX_PAGES > 0 )) && (( ${#VISITED[@]} >= CFG_MAX_PAGES )); then
    CONFLUEX_STOP_REASON="max_pages_reached"
    log_warn "stopping early: reached --max-pages=$CFG_MAX_PAGES"
    return 0
  fi

  if (( CFG_MAX_DOWNLOAD_BYTES > 0 )) && (( downloaded_total_bytes >= CFG_MAX_DOWNLOAD_BYTES )); then
    CONFLUEX_STOP_REASON="max_download_mib_reached"
    log_warn "stopping early: reached --max-download-mib=$CFG_MAX_DOWNLOAD_MIB"
    return 0
  fi

  return 1
}

confluex_capture_stdout() {
  local out_file="$1"
  shift

  if [[ -n "$LOG_FILE" ]]; then
    "$@" > "$out_file" 2>>"$LOG_FILE"
    return $?
  fi

  "$@" > "$out_file"
}

confluex_run_with_optional_log() {
  if [[ -n "$LOG_FILE" ]]; then
    "$@" >>"$LOG_FILE" 2>&1
    return $?
  fi

  "$@"
}

confluex_page_metadata_path() {
  local page_dir="$1"
  local name="$2"

  if (( CFG_KEEP_METADATA )); then
    printf '%s/%s\n' "$page_dir" "$name"
    return 0
  fi

  printf '%s\n' "$(confluex_temp_file "$name")"
}

confluex_cache_page_info_if_missing() {
  local page_id="$1"

  if [[ -n "${TITLE_BY_ID[$page_id]+x}" && -n "${SPACE_BY_ID[$page_id]+x}" ]]; then
    return 0
  fi

  local info_tmp="$TMP_DIR/info_cache_${page_id}.txt"
  if ! confluex_capture_stdout "$info_tmp" confluence info "$page_id"; then
    return 1
  fi
  confluex_track_download_bytes metadata "$(confluex_file_size_bytes "$info_tmp")"

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
  CONFLUEX_LAST_RESOLVED_ID=""

  if [[ -n "${FIND_CACHE[$cache_key]+x}" ]]; then
    if [[ -n "${FIND_CACHE[$cache_key]}" ]]; then
      CONFLUEX_LAST_RESOLVED_ID="${FIND_CACHE[$cache_key]}"
      return 0
    fi
    return 1
  fi

  local out_file="$TMP_DIR/find_${RANDOM}_${RANDOM}.txt"
  if [[ -n "$space_key" ]]; then
    if ! confluex_capture_stdout "$out_file" confluence find "$title" --space "$space_key"; then
      FIND_CACHE["$cache_key"]=""
      rm -f "$out_file"
      return 1
    fi
  else
    if ! confluex_capture_stdout "$out_file" confluence find "$title"; then
      FIND_CACHE["$cache_key"]=""
      rm -f "$out_file"
      return 1
    fi
  fi
  confluex_track_download_bytes metadata "$(confluex_file_size_bytes "$out_file")"

  local ids=()
  local id
  while IFS= read -r id; do
    [[ "$id" =~ ^[0-9]+$ ]] || continue
    ids+=("$id")
  done < <(sed -n 's/^[[:space:]]*ID:[[:space:]]*//p' "$out_file" | grep -Eo '^[0-9]+' | sort -u || true)

  if (( ${#ids[@]} == 0 )); then
    log_warn "could not parse explicit page ids from find results for [${space_key:-any}] $title; skipping"
    FIND_CACHE["$cache_key"]=""
    rm -f "$out_file"
    return 1
  fi

  if (( ${#ids[@]} > CFG_MAX_FIND_CANDIDATES )); then
    log_warn "find results for [${space_key:-any}] $title returned ${#ids[@]} candidates; limit is $CFG_MAX_FIND_CANDIDATES, skipping"
    FIND_CACHE["$cache_key"]=""
    rm -f "$out_file"
    return 1
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
    CONFLUEX_LAST_RESOLVED_ID="$resolved_id"
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
  if ! confluex_capture_stdout "$refs_file" confluex_extract_link_refs "$storage_file" "$space_key"; then
    log_warn "  failed to parse links for page $page_id"
    return 0
  fi

  while IFS=$'\x1f' read -r ref_type ref_a ref_b; do
    [[ -z "$ref_type" ]] && continue

    if [[ "$ref_type" == "id" ]]; then
      log_info "  found internal link by pageId: $ref_a"
      confluex_record_resolved_link "$page_id" "$title" "id" "$ref_a" "$ref_a" "${TITLE_BY_ID[$ref_a]:-}" "${SPACE_BY_ID[$ref_a]:-}" || true
      confluex_enqueue "$ref_a" "link-id:$page_id"
      continue
    fi

    if [[ "$ref_type" == "title" ]]; then
      local resolved_id=""
      log_info "  found internal link by title: [${ref_a:-same-space}] $ref_b"

      if confluex_resolve_by_title "$ref_b" "$ref_a"; then
        resolved_id="$CONFLUEX_LAST_RESOLVED_ID"
        log_info "    resolved link -> pageId $resolved_id"
        confluex_record_resolved_link \
          "$page_id" \
          "$title" \
          "title" \
          "${ref_a:+$ref_a:}$ref_b" \
          "$resolved_id" \
          "${TITLE_BY_ID[$resolved_id]:-}" \
          "${SPACE_BY_ID[$resolved_id]:-$ref_a}" || true
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
  local info_tmp
  local page_metadata_bytes=0
  local page_content_bytes=0
  info_tmp="$(confluex_temp_file "info_${page_id}.txt")"

  log_info "------------------------------------------------------------"
  log_info "processing page $page_id"
  log_info "  discovered by: ${DISCOVERED_BY[$page_id]:-unknown}"
  log_info "  mode: $([[ $CFG_DRY_RUN -eq 1 ]] && printf 'dry-run' || printf 'export')"

  if [[ "$page_id" == "$CFG_ROOT_ID" && -f "$PREFLIGHT_INFO_FILE" ]]; then
    cp "$PREFLIGHT_INFO_FILE" "$info_tmp"
  else
    if ! confluex_capture_stdout "$info_tmp" confluence info "$page_id"; then
      log_error "failed to get info for page $page_id"
      printf '%s\tinfo\n' "$page_id" >> "$FAILED"
      return 1
    fi
    page_metadata_bytes=$((page_metadata_bytes + $(confluex_file_size_bytes "$info_tmp")))
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
  if (( CFG_KEEP_METADATA || CFG_DRY_RUN == 0 )); then
    mkdir -p "$page_dir"
  fi

  TITLE_BY_ID["$page_id"]="$title"
  SPACE_BY_ID["$page_id"]="$space_key"

  if (( CFG_KEEP_METADATA )); then
    cp "$info_tmp" "$page_dir/_info.txt"
  fi

  log_info "  title: $title"
  log_info "  space: ${space_key:-<unknown>}"
  [[ -n "$page_url" ]] && log_info "  url: $page_url"
  log_info "  folder: $page_dir"

  local storage_file
  storage_file="$(confluex_page_metadata_path "$page_dir" "_storage.xml")"
  if confluex_run_with_optional_log confluence edit "$page_id" --output "$storage_file"; then
    page_metadata_bytes=$((page_metadata_bytes + $(confluex_file_size_bytes "$storage_file")))
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
    local attachments_preview_file
    attachments_preview_file="$(confluex_page_metadata_path "$page_dir" "_attachments_preview.txt")"
    log_info "  DRY-RUN: page content and attachments will NOT be downloaded"
    attachment_count="$(confluex_log_attachments_preview "$page_id" "$attachments_preview_file")"
    page_metadata_bytes=$((page_metadata_bytes + $(confluex_file_size_bytes "$attachments_preview_file")))
    confluex_track_download_bytes metadata "$page_metadata_bytes"
    log_info "  page download total: $(confluex_bytes_to_mib "$page_metadata_bytes") MiB metadata"
    confluex_log_download_progress "page $page_id"
    log_info "  DRY-RUN: would export page to $page_dir/page.html"
    log_info "  DRY-RUN: attachment preview lines logged: $attachment_count"
    confluex_record_manifest "$page_id" "$space_key" "$title" "$page_dir" "${DISCOVERED_BY[$page_id]:-unknown}" "dry-run" "$attachment_count"
    return 0
  fi

  log_info "  exporting page HTML + attachments"
  if confluex_run_with_optional_log confluence export "$page_id" --format html --dest "$page_dir" --file page.html --attachments-dir attachments; then
    log_info "  export complete"
  else
    log_warn "  export failed for page $page_id"
    printf '%s\texport\n' "$page_id" >> "$FAILED"
    if (( CFG_FAIL_FAST )); then
      return 1
    fi
  fi

  page_content_bytes=$((page_content_bytes + $(confluex_file_size_bytes "$page_dir/page.html")))
  page_content_bytes=$((page_content_bytes + $(confluex_dir_size_bytes "$page_dir/attachments")))
  confluex_track_download_bytes metadata "$page_metadata_bytes"
  confluex_track_download_bytes content "$page_content_bytes"
  log_info "  page download total: total=$(confluex_bytes_to_mib "$((page_metadata_bytes + page_content_bytes))") MiB, content=$(confluex_bytes_to_mib "$page_content_bytes") MiB, metadata=$(confluex_bytes_to_mib "$page_metadata_bytes") MiB"
  confluex_log_download_progress "page $page_id"
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
  confluex_compute_breakdown
}

confluex_write_summary() {
  local incomplete="$1"
  local reason="${2:-}"

  confluex_compute_counts

  {
    printf 'command=%s\n' "$CFG_COMMAND"
    printf 'root_page_id=%s\n' "$CFG_ROOT_ID"
    printf 'dry_run=%s\n' "$CFG_DRY_RUN"
    printf 'safe_mode=%s\n' "$CFG_SAFE_MODE"
    printf 'output_dir=%s\n' "$OUT_DIR"
    printf 'max_pages=%s\n' "$CFG_MAX_PAGES"
    printf 'max_download_mib=%s\n' "$CFG_MAX_DOWNLOAD_MIB"
    printf 'sleep_ms=%s\n' "$CFG_SLEEP_MS"
    printf 'processed_pages=%s\n' "$processed_count"
    printf 'root_pages=%s\n' "$root_count"
    printf 'tree_pages=%s\n' "$tree_count"
    printf 'linked_pages=%s\n' "$linked_count"
    printf 'other_pages=%s\n' "$other_count"
    printf 'manifest_rows=%s\n' "$manifest_count"
    printf 'resolved_links=%s\n' "$resolved_count"
    printf 'unresolved_links=%s\n' "$unresolved_count"
    printf 'failed_operations=%s\n' "$failed_count"
    printf 'downloaded_total_bytes=%s\n' "$downloaded_total_bytes"
    printf 'downloaded_total_mib=%s\n' "$(confluex_bytes_to_mib "$downloaded_total_bytes")"
    printf 'downloaded_content_bytes=%s\n' "$downloaded_content_bytes"
    printf 'downloaded_content_mib=%s\n' "$(confluex_bytes_to_mib "$downloaded_content_bytes")"
    printf 'downloaded_metadata_bytes=%s\n' "$downloaded_metadata_bytes"
    printf 'downloaded_metadata_mib=%s\n' "$(confluex_bytes_to_mib "$downloaded_metadata_bytes")"
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

confluex_cleanup_tmp_dir() {
  if [[ -n "$TMP_DIR" && -d "$TMP_DIR" ]]; then
    rm -rf "$TMP_DIR"
  fi
}

confluex_on_exit() {
  local exit_code="$1"

  if (( exit_code == 130 )); then
    confluex_cleanup_tmp_dir
    return 0
  fi

  confluex_cleanup_tmp_dir
}

confluex_init_runtime_paths() {
  local timestamp
  local base_out_dir
  local suffix=2
  timestamp="$(date +%Y%m%d_%H%M%S)"

  if [[ -z "$CFG_OUT_DIR" ]]; then
    if (( CFG_DRY_RUN )); then
      base_out_dir="confluence_plan_${CFG_ROOT_ID}_${timestamp}"
    else
      base_out_dir="confluence_dump_${CFG_ROOT_ID}_${timestamp}"
    fi

    OUT_DIR="$base_out_dir"
    while [[ -e "$OUT_DIR" ]]; do
      OUT_DIR="${base_out_dir}_${suffix}"
      suffix=$((suffix + 1))
    done
  else
    OUT_DIR="$CFG_OUT_DIR"
    if [[ -e "$OUT_DIR" ]]; then
      log_error "output directory already exists: $OUT_DIR"
      return 1
    fi
  fi

  PAGES_DIR="$OUT_DIR/pages"
  TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/confluex.${CFG_ROOT_ID}.XXXXXX")"
  LOG_FILE=""
  MANIFEST="$OUT_DIR/manifest.tsv"
  LINKS_FILE="$OUT_DIR/resolved-links.tsv"
  UNRESOLVED="$OUT_DIR/unresolved-links.tsv"
  FAILED="$OUT_DIR/failed-pages.tsv"
  SUMMARY="$OUT_DIR/summary.txt"
  PREFLIGHT_INFO_FILE="$(confluex_temp_file "preflight_info_${CFG_ROOT_ID}.txt")"

  if [[ -n "$CFG_LOG_FILE" ]]; then
    LOG_FILE="$CFG_LOG_FILE"
  fi

  mkdir -p "$PAGES_DIR"

  if [[ -n "$LOG_FILE" ]]; then
    mkdir -p "$(dirname "$LOG_FILE")"
    : > "$LOG_FILE"
  fi
  : > "$FAILED"
  printf 'page_id\tspace_key\ttitle\tfolder\tdiscovered_by\tmode\tattachment_count\n' > "$MANIFEST"
  printf 'from_page_id\tfrom_title\tlink_type\tlink_value\tresolved_page_id\tresolved_title\tresolved_space\n' > "$LINKS_FILE"
  printf 'from_page_id\tfrom_title\tspace_key\tlink_type\tlink_value\n' > "$UNRESOLVED"
}

confluex_collect_initial_queue() {
  local root_children_json="$TMP_DIR/root_children.json"
  local root_children_ids="$TMP_DIR/root_children_ids.txt"

  log_info "collecting recursive children for root page $CFG_ROOT_ID"
  if ! confluex_capture_stdout "$root_children_json" confluence children "$CFG_ROOT_ID" --recursive --format json; then
    log_warn "failed to collect children for root page $CFG_ROOT_ID; continuing with root page only"
    confluex_enqueue "$CFG_ROOT_ID" root
    return 0
  fi
  confluex_track_download_bytes metadata "$(confluex_file_size_bytes "$root_children_json")"

  confluex_enqueue "$CFG_ROOT_ID" root

  if ! confluex_capture_stdout "$root_children_ids" confluex_extract_children_ids "$root_children_json"; then
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
  if confluex_capture_stdout "$PREFLIGHT_INFO_FILE" confluence info "$CFG_ROOT_ID"; then
    confluex_track_download_bytes metadata "$(confluex_file_size_bytes "$PREFLIGHT_INFO_FILE")"
    confluex_log_download_progress "preflight"
    return 0
  fi

  log_error "preflight failed: cannot access page $CFG_ROOT_ID. Check confluence-cli authentication and permissions."
  return 1
}

confluex_run_doctor() {
  local ok=1
  local info_file=""
  local parsed=""
  local title=""
  local space_key=""
  local cmd=""

  printf 'confluex doctor\n'
  for cmd in bash node confluence sed awk grep sort find tr wc; do
    if command -v "$cmd" >/dev/null 2>&1; then
      printf '  [OK] %s: %s\n' "$cmd" "$(command -v "$cmd")"
    else
      printf '  [FAIL] %s not found\n' "$cmd"
      ok=0
    fi
  done

  if (( ok == 0 )); then
    return 1
  fi

  if [[ -z "$CFG_ROOT_ID" ]]; then
    printf '  [WARN] auth check skipped (no --page-id)\n'
    return 0
  fi

  info_file="$(mktemp "${TMPDIR:-/tmp}/confluex.doctor.${CFG_ROOT_ID}.XXXXXX")"
  if confluex_capture_stdout "$info_file" confluence info "$CFG_ROOT_ID"; then
    parsed="$(confluex_parse_info_file "$info_file")"
    IFS=$'\x1f' read -r title space_key _ <<< "$parsed"
    printf '  [OK] access to page %s\n' "$CFG_ROOT_ID"
    printf '       title: %s\n' "${title:-<unknown>}"
    printf '       space: %s\n' "${space_key:-<unknown>}"
    rm -f "$info_file"
    return 0
  fi

  rm -f "$info_file"
  printf '  [FAIL] cannot access page %s via confluence-cli\n' "$CFG_ROOT_ID"
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

    if confluex_limits_reached; then
      return 2
    fi

    if (( q_idx < ${#QUEUE[@]} )); then
      confluex_sleep_between_pages_if_needed
    fi
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

  if [[ "$CFG_COMMAND" == "doctor" ]]; then
    confluex_run_doctor
    return $?
  fi

  confluex_require_cmds bash node confluence sed awk grep sort find tr wc || return 1

  confluex_reset_state
  CFG_MAX_DOWNLOAD_BYTES=$((CFG_MAX_DOWNLOAD_MIB * 1048576))
  confluex_init_runtime_paths || return 1
  trap 'confluex_on_interrupt' INT TERM
  trap 'confluex_on_exit $?' EXIT

  log_info "starting"
  log_info "command: $CFG_COMMAND"
  log_info "root page id: $CFG_ROOT_ID"
  log_info "output dir: $OUT_DIR"
  log_info "dry-run: $CFG_DRY_RUN"
  log_info "safe-mode: $CFG_SAFE_MODE"
  log_info "fail-fast: $CFG_FAIL_FAST"
  log_info "keep-metadata: $CFG_KEEP_METADATA"
  log_info "max-find-candidates: $CFG_MAX_FIND_CANDIDATES"
  log_info "max-pages: $CFG_MAX_PAGES"
  log_info "max-download-mib: $CFG_MAX_DOWNLOAD_MIB"
  log_info "sleep-ms: $CFG_SLEEP_MS"
  if [[ -n "$LOG_FILE" ]]; then
    log_info "log-file: $LOG_FILE"
  else
    log_info "log-file: disabled"
  fi

  if ! confluex_preflight; then
    return 1
  fi

  confluex_collect_initial_queue

  if ! confluex_run_export; then
    if [[ -n "$CONFLUEX_STOP_REASON" ]]; then
      confluex_write_summary 1 "$CONFLUEX_STOP_REASON"
      log_warn "stopped early: $CONFLUEX_STOP_REASON"
      return 1
    fi
    confluex_write_summary 1 "runtime_error"
    log_error "aborted due to fail-fast mode"
    return 1
  fi

  confluex_write_summary 0 ""

  log_info "done"
  log_info "processed pages: $processed_count"
  log_info "tree pages: $tree_count"
  log_info "linked pages: $linked_count"
  log_info "manifest rows: $manifest_count"
  log_info "resolved links: $resolved_count"
  log_info "unresolved links: $unresolved_count"
  log_info "failed operations: $failed_count"
  log_info "summary: $SUMMARY"
  log_info "manifest: $MANIFEST"
  log_info "resolved links: $LINKS_FILE"
  log_info "unresolved links: $UNRESOLVED"
  log_info "downloaded total: $(confluex_bytes_to_mib "$downloaded_total_bytes") MiB"
  log_info "downloaded content: $(confluex_bytes_to_mib "$downloaded_content_bytes") MiB"
  log_info "downloaded metadata: $(confluex_bytes_to_mib "$downloaded_metadata_bytes") MiB"
  if [[ -n "$LOG_FILE" ]]; then
    log_info "run log: $LOG_FILE"
  fi

  if (( failed_count > 0 )); then
    if [[ -n "$LOG_FILE" ]]; then
      log_warn "some operations failed; see $FAILED and $LOG_FILE"
    else
      log_warn "some operations failed; see $FAILED"
    fi
  fi

  return 0
}
