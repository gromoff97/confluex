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
SCOPE_FINDINGS=""
SUMMARY=""
PREFLIGHT_INFO_FILE=""
ENCRYPTED_ARCHIVE=""
ENCRYPTION_HINT_FILE=""
ENCRYPTION_SUCCESSFUL=0
CFG_ENCRYPTION_KEY_SOURCE="none"
RUN_BLOCKING_REASONS=""
CONFLUEX_SUPPORT_PROFILE="default"
CONFLUEX_RESUME_SCHEMA_VERSION="2"
CONFLUEX_EXIT_GENERIC_FAILURE=1
CONFLUEX_EXIT_POLICY_FAILED=2
CONFLUEX_EXIT_LIMIT_REACHED=3
CONFLUEX_EXIT_RUNTIME_ERROR=4
CONFLUEX_EXIT_ENCRYPTION_FAILURE=5

# Counters (filled by confluex_compute_counts).
processed_count=0
failed_count=0
unresolved_count=0
resolved_count=0
manifest_count=0
scope_findings_count=0
downloaded_metadata_bytes=0
downloaded_content_bytes=0
downloaded_total_bytes=0
root_count=0
tree_count=0
linked_count=0
other_count=0
resume_reused_pages=0
resume_fresh_pages=0
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
declare -A RECORDED_SCOPE_FINDINGS=()
declare -A RESUME_FOLDER_BY_ID=()
declare -A RESUME_MODE_BY_ID=()
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
  RECORDED_SCOPE_FINDINGS=()
  RESUME_FOLDER_BY_ID=()
  RESUME_MODE_BY_ID=()
  CONFLUEX_LAST_RESOLVED_ID=""
  downloaded_metadata_bytes=0
  downloaded_content_bytes=0
  downloaded_total_bytes=0
  root_count=0
  tree_count=0
  linked_count=0
  other_count=0
  resume_reused_pages=0
  resume_fresh_pages=0
  CONFLUEX_STOP_REASON=""
  ENCRYPTED_ARCHIVE=""
  ENCRYPTION_HINT_FILE=""
  ENCRYPTION_SUCCESSFUL=0
  CFG_ENCRYPTION_KEY_SOURCE="none"
  RUN_BLOCKING_REASONS=""
  scope_findings_count=0
}

confluex_apply_default_config() {
  local configured_key=""

  CFG_ENCRYPTION_KEY_SOURCE="none"

  if [[ "$CFG_COMMAND" != "export" && "$CFG_COMMAND" != "plan" ]]; then
    return 0
  fi

  if (( CFG_ENCRYPTION_KEY_SET )); then
    CFG_ENCRYPTION_KEY_SOURCE="cli"
    return 0
  fi

  configured_key="$(confluex_read_config_encryption_key)"
  if [[ -n "$configured_key" ]]; then
    CFG_ENCRYPTION_KEY="$configured_key"
    CFG_ENCRYPTION_KEY_SOURCE="config"
  fi
}

confluex_parse_info_file() {
  local file="$1"
  node "$CONFLUEX_LIB_DIR/parsers.js" parse-info "$file"
}

confluex_extract_children_ids() {
  local json_file="$1"
  node "$CONFLUEX_LIB_DIR/parsers.js" extract-children "$json_file"
}

confluex_inspect_children_payload() {
  local json_file="$1"
  node "$CONFLUEX_LIB_DIR/parsers.js" inspect-children "$json_file"
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

  safe_space="$(truncate_name "$(sanitize_name "${space_key:-NO_SPACE}")" 40)"
  safe_title="$(truncate_name "$(sanitize_name "${title:-page_$page_id}")" 80)"
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

confluex_manifest_folder_value() {
  local folder="$1"
  local out_basename
  local relative_inside_out

  out_basename="$(basename "$OUT_DIR")"
  relative_inside_out="${folder#"$OUT_DIR"/}"

  if [[ "$relative_inside_out" != "$folder" && -n "$relative_inside_out" ]]; then
    printf '%s/%s\n' "$out_basename" "$relative_inside_out"
    return 0
  fi

  printf '%s\n' "$folder"
}

confluex_summary_value() {
  local file="$1"
  local key="$2"

  awk -F= -v key="$key" '$1 == key { print substr($0, length(key) + 2); exit }' "$file"
}

confluex_path_is_within_out_dir() {
  local path="$1"

  [[ "$path" == "$OUT_DIR" || "$path" == "$OUT_DIR"/* ]]
}

confluex_path_has_relative_segments() {
  local path="$1"

  case "$path" in
    */../*|*/..|*/./*|*/.|*//*) return 0 ;;
  esac

  return 1
}

confluex_absolute_folder_from_manifest() {
  local folder="$1"
  local out_basename
  local out_parent
  local resolved=""

  out_basename="$(basename "$OUT_DIR")"
  out_parent="$(dirname "$OUT_DIR")"

  if [[ "$folder" == "$out_basename/"* ]]; then
    resolved="$(printf '%s/%s\n' "$out_parent" "$folder")"
  elif [[ "$folder" == "$OUT_DIR"/* ]]; then
    resolved="$folder"
  else
    log_error "--resume requires manifest folders to stay inside $OUT_DIR, got: $folder"
    return 1
  fi

  if confluex_path_has_relative_segments "$resolved"; then
    log_error "--resume requires normalized manifest folders inside $OUT_DIR, got: $folder"
    return 1
  fi

  if ! confluex_path_is_within_out_dir "$resolved"; then
    log_error "--resume requires manifest folders to stay inside $OUT_DIR, got: $folder"
    return 1
  fi

  printf '%s\n' "$resolved"
}

confluex_validate_resume_summary() {
  local summary_path="$OUT_DIR/summary.txt"
  local prior_command=""
  local prior_root_id=""
  local prior_support_profile=""
  local prior_schema=""

  if [[ ! -f "$summary_path" ]]; then
    log_error "--resume requires an existing summary.txt in $OUT_DIR"
    return 1
  fi

  prior_command="$(confluex_summary_value "$summary_path" command)"
  prior_root_id="$(confluex_summary_value "$summary_path" root_page_id)"
  prior_support_profile="$(confluex_summary_value "$summary_path" support_profile)"
  prior_schema="$(confluex_summary_value "$summary_path" resume_schema_version)"

  if [[ "$prior_command" != "export" ]]; then
    log_error "--resume requires a prior export summary in $OUT_DIR"
    return 1
  fi

  if [[ "$prior_root_id" != "$CFG_ROOT_ID" ]]; then
    log_error "--resume requires matching root_page_id in $OUT_DIR/summary.txt, got: ${prior_root_id:-<missing>}"
    return 1
  fi

  if [[ "$prior_support_profile" != "$CONFLUEX_SUPPORT_PROFILE" ]]; then
    log_error "--resume requires support_profile=$CONFLUEX_SUPPORT_PROFILE in $OUT_DIR/summary.txt, got: ${prior_support_profile:-<missing>}"
    return 1
  fi

  if [[ "$prior_schema" != "$CONFLUEX_RESUME_SCHEMA_VERSION" ]]; then
    log_error "--resume requires resume_schema_version=$CONFLUEX_RESUME_SCHEMA_VERSION in $OUT_DIR/summary.txt, got: ${prior_schema:-<missing>}"
    return 1
  fi

  return 0
}

confluex_load_resume_manifest() {
  local manifest_path="$OUT_DIR/manifest.tsv"
  local page_id=""
  local folder=""
  local mode=""
  local loaded_count=0

  if [[ ! -f "$manifest_path" ]]; then
    log_error "--resume requires an existing manifest.tsv in $OUT_DIR"
    return 1
  fi

  confluex_validate_resume_summary || return 1

  while IFS=$'\t' read -r page_id _ _ folder _ mode _; do
    [[ "$page_id" == "page_id" ]] && continue
    [[ "$page_id" =~ ^[0-9]+$ ]] || continue
    folder="$(confluex_absolute_folder_from_manifest "$folder")" || return 1
    RESUME_FOLDER_BY_ID["$page_id"]="$folder"
    RESUME_MODE_BY_ID["$page_id"]="$mode"
    loaded_count=$((loaded_count + 1))
  done < "$manifest_path"

  log_info "resume state loaded: $loaded_count manifest rows from $manifest_path"
  return 0
}

confluex_resume_folder_for_page() {
  local page_id="$1"

  if [[ -n "${RESUME_FOLDER_BY_ID[$page_id]+x}" ]]; then
    printf '%s\n' "${RESUME_FOLDER_BY_ID[$page_id]}"
    return 0
  fi

  return 1
}

confluex_resume_can_reuse_export_payload() {
  local page_id="$1"
  local page_dir="$2"

  if (( CFG_RESUME_MODE == 0 || CFG_DRY_RUN == 1 )); then
    return 1
  fi

  if [[ "${RESUME_MODE_BY_ID[$page_id]:-}" != "export" ]]; then
    return 1
  fi

  if [[ ! -f "$page_dir/page.html" ]]; then
    return 1
  fi

  return 0
}

confluex_count_existing_attachments() {
  local attachments_dir="$1"
  local count=0

  if [[ ! -d "$attachments_dir" ]]; then
    log_info "    reused attachments: none"
    printf '0\n'
    return 0
  fi

  while IFS= read -r -d '' _; do
    count=$((count + 1))
  done < <(find "$attachments_dir" -type f -print0 2>/dev/null)

  log_info "    reused attachments: $count"
  printf '%s\n' "$count"
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

confluex_record_scope_finding() {
  local page_id="$1"
  local scope_area="$2"
  local finding_type="$3"
  local detail="$4"
  local key="${page_id}|${scope_area}|${finding_type}|${detail}"

  if [[ -n "${RECORDED_SCOPE_FINDINGS[$key]+x}" ]]; then
    return 0
  fi

  RECORDED_SCOPE_FINDINGS["$key"]=1
  printf '%s\t%s\t%s\t%s\n' \
    "$page_id" \
    "$(escape_tsv "$scope_area")" \
    "$(escape_tsv "$finding_type")" \
    "$(escape_tsv "$detail")" >> "$SCOPE_FINDINGS"
}

confluex_scope_trust_state() {
  if (( scope_findings_count > 0 )); then
    printf 'degraded\n'
    return 0
  fi

  printf 'trusted\n'
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
    confluex_record_scope_finding "$page_id" "attachments" "attachments_preview_failed" "attachment preview unavailable"
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

confluex_archive_path_for_out_dir() {
  printf '%s.tar.gz.gpg\n' "$OUT_DIR"
}

confluex_status_path_for_out_dir() {
  printf '%s.status.txt\n' "$OUT_DIR"
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

confluex_page_links_expand_scope() {
  local page_id="$1"
  local reason="${DISCOVERED_BY[$page_id]:-unknown}"

  case "$reason" in
    root|child:*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
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
  local from_page_id="$1"
  local title="$2"
  local space_key="$3"
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
      confluex_record_scope_finding "$from_page_id" "title_resolution" "find_failed" "[${space_key:-any}] $title"
      FIND_CACHE["$cache_key"]=""
      rm -f "$out_file"
      return 1
    fi
  else
    if ! confluex_capture_stdout "$out_file" confluence find "$title"; then
      confluex_record_scope_finding "$from_page_id" "title_resolution" "find_failed" "[${space_key:-any}] $title"
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
    confluex_record_scope_finding "$from_page_id" "title_resolution" "find_output_unparseable" "[${space_key:-any}] $title"
    FIND_CACHE["$cache_key"]=""
    rm -f "$out_file"
    return 1
  fi

  if (( ${#ids[@]} > CFG_MAX_FIND_CANDIDATES )); then
    log_warn "find results for [${space_key:-any}] $title returned ${#ids[@]} candidates; limit is $CFG_MAX_FIND_CANDIDATES, skipping"
    confluex_record_scope_finding "$from_page_id" "title_resolution" "candidate_limit_exceeded" "[${space_key:-any}] $title"
    FIND_CACHE["$cache_key"]=""
    rm -f "$out_file"
    return 1
  fi

  local resolved_id=""
  local ambiguous=0
  local inaccessible_candidates=0

  for id in "${ids[@]}"; do
    if ! confluex_cache_page_info_if_missing "$id"; then
      inaccessible_candidates=$((inaccessible_candidates + 1))
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

  if (( inaccessible_candidates > 0 )); then
    confluex_record_scope_finding "$from_page_id" "title_resolution" "title_candidates_inaccessible" "[${space_key:-any}] $title"
  fi

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
    confluex_record_scope_finding "$page_id" "link_parsing" "storage_parse_failed" "_storage.xml"
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

    if [[ "$ref_type" == "unsupported" ]]; then
      log_warn "  unsupported internal reference detected: $ref_b"
      confluex_record_scope_finding "$page_id" "link_support" "$ref_a" "$ref_b"
      continue
    fi

    if [[ "$ref_type" == "title" ]]; then
      local resolved_id=""
      log_info "  found internal link by title: [${ref_a:-same-space}] $ref_b"

      if confluex_resolve_by_title "$page_id" "$ref_b" "$ref_a"; then
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
  local reused_export_payload=0
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
  if ! page_dir="$(confluex_resume_folder_for_page "$page_id")"; then
    page_dir="$(confluex_page_folder_for "$page_id" "$space_key" "$title")"
  fi

  if confluex_resume_can_reuse_export_payload "$page_id" "$page_dir"; then
    reused_export_payload=1
  elif (( CFG_RESUME_MODE )) && (( CFG_DRY_RUN == 0 )) && [[ -d "$page_dir" ]]; then
    rm -rf "$page_dir"
  fi

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
    if confluex_page_links_expand_scope "$page_id"; then
      confluex_process_links_for_page "$page_id" "$title" "$space_key" "$storage_file"
    else
      log_info "  skipping link-driven scope expansion for link-discovered page"
    fi
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
    confluex_record_manifest "$page_id" "$space_key" "$title" "$(confluex_manifest_folder_value "$page_dir")" "${DISCOVERED_BY[$page_id]:-unknown}" "dry-run" "$attachment_count"
    return 0
  fi

  if (( reused_export_payload )); then
    log_info "  reusing existing page HTML + attachments from prior run"
    resume_reused_pages=$((resume_reused_pages + 1))
  else
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
    if (( CFG_RESUME_MODE )); then
      resume_fresh_pages=$((resume_fresh_pages + 1))
    fi
  fi

  if (( reused_export_payload == 0 )); then
    page_content_bytes=$((page_content_bytes + $(confluex_file_size_bytes "$page_dir/page.html")))
    page_content_bytes=$((page_content_bytes + $(confluex_dir_size_bytes "$page_dir/attachments")))
  fi
  confluex_track_download_bytes metadata "$page_metadata_bytes"
  if (( reused_export_payload == 0 )); then
    confluex_track_download_bytes content "$page_content_bytes"
  fi
  log_info "  page download total: total=$(confluex_bytes_to_mib "$((page_metadata_bytes + page_content_bytes))") MiB, content=$(confluex_bytes_to_mib "$page_content_bytes") MiB, metadata=$(confluex_bytes_to_mib "$page_metadata_bytes") MiB"
  confluex_log_download_progress "page $page_id"
  if (( reused_export_payload )); then
    attachment_count="$(confluex_count_existing_attachments "$page_dir/attachments")"
  else
    attachment_count="$(confluex_log_attachments_from_export "$page_dir/attachments")"
  fi
  confluex_record_manifest "$page_id" "$space_key" "$title" "$(confluex_manifest_folder_value "$page_dir")" "${DISCOVERED_BY[$page_id]:-unknown}" "export" "$attachment_count"
  return 0
}

confluex_compute_counts() {
  processed_count="${#VISITED[@]}"
  failed_count="$(count_lines "$FAILED")"
  unresolved_count="$(count_minus_header "$UNRESOLVED")"
  resolved_count="$(count_minus_header "$LINKS_FILE")"
  manifest_count="$(count_minus_header "$MANIFEST")"
  scope_findings_count="$(count_minus_header "$SCOPE_FINDINGS")"
  confluex_compute_breakdown
}

confluex_join_csv() {
  local first=1
  local item=""

  for item in "$@"; do
    [[ -z "$item" ]] && continue
    if (( first )); then
      printf '%s' "$item"
      first=0
    else
      printf ',%s' "$item"
    fi
  done
}

confluex_collect_blocking_reasons() {
  local incomplete="$1"
  local reason="${2:-}"
  local reasons=()

  if (( failed_count > 0 )); then
    reasons+=("failed_operations")
  fi

  if (( unresolved_count > 0 )); then
    reasons+=("unresolved_links")
  fi

  if (( scope_findings_count > 0 )); then
    reasons+=("scope_findings")
  fi

  if (( incomplete == 1 )); then
    if [[ -n "$reason" ]]; then
      reasons+=("$reason")
    else
      reasons+=("incomplete")
    fi
  fi

  RUN_BLOCKING_REASONS="$(confluex_join_csv "${reasons[@]}")"
}

confluex_final_status_for_summary() {
  local incomplete="$1"
  local reason="${2:-}"

  if [[ "$reason" == "SIGINT" ]]; then
    printf 'interrupted\n'
    return 0
  fi

  if (( incomplete == 1 )); then
    printf 'incomplete\n'
    return 0
  fi

  if [[ -n "$CFG_ENCRYPTION_KEY" && "$ENCRYPTION_SUCCESSFUL" -eq 0 ]]; then
    printf 'encryption_failed\n'
    return 0
  fi

  if (( CFG_CRITICAL_MODE )) && [[ -n "$RUN_BLOCKING_REASONS" ]]; then
    printf 'policy_failed\n'
    return 0
  fi

  if [[ -n "$RUN_BLOCKING_REASONS" ]]; then
    printf 'success_with_findings\n'
    return 0
  fi

  printf 'success\n'
}

confluex_should_fail_critical_policy() {
  [[ -n "$RUN_BLOCKING_REASONS" ]] && (( CFG_CRITICAL_MODE ))
}

confluex_write_summary() {
  local incomplete="$1"
  local reason="${2:-}"
  local encryption_enabled=0
  local final_status=""

  confluex_compute_counts
  if [[ -n "$CFG_ENCRYPTION_KEY" ]]; then
    encryption_enabled=1
  fi
  confluex_collect_blocking_reasons "$incomplete" "$reason"
  final_status="$(confluex_final_status_for_summary "$incomplete" "$reason")"

  {
    printf 'command=%s\n' "$CFG_COMMAND"
    printf 'root_page_id=%s\n' "$CFG_ROOT_ID"
    printf 'dry_run=%s\n' "$CFG_DRY_RUN"
    printf 'safe_mode=%s\n' "$CFG_SAFE_MODE"
    printf 'critical_mode=%s\n' "$CFG_CRITICAL_MODE"
    printf 'confidential_mode=%s\n' "$CFG_CONFIDENTIAL_MODE"
    printf 'support_profile=%s\n' "$CONFLUEX_SUPPORT_PROFILE"
    printf 'scope_trust=%s\n' "$(confluex_scope_trust_state)"
    printf 'encryption_enabled=%s\n' "$encryption_enabled"
    printf 'encryption_successful=%s\n' "$ENCRYPTION_SUCCESSFUL"
    printf 'encryption_key=%s\n' "$CFG_ENCRYPTION_KEY"
    printf 'encryption_key_source=%s\n' "$CFG_ENCRYPTION_KEY_SOURCE"
    printf 'encrypted_archive=%s\n' "$ENCRYPTED_ARCHIVE"
    printf 'output_dir=%s\n' "$OUT_DIR"
    printf 'path_provenance=%s\n' "runtime_origin"
    printf 'resume_schema_version=%s\n' "$CONFLUEX_RESUME_SCHEMA_VERSION"
    printf 'final_status=%s\n' "$final_status"
    printf 'blocking_reasons=%s\n' "$RUN_BLOCKING_REASONS"
    printf 'max_pages=%s\n' "$CFG_MAX_PAGES"
    printf 'max_download_mib=%s\n' "$CFG_MAX_DOWNLOAD_MIB"
    printf 'sleep_ms=%s\n' "$CFG_SLEEP_MS"
    printf 'processed_pages=%s\n' "$processed_count"
    printf 'root_pages=%s\n' "$root_count"
    printf 'tree_pages=%s\n' "$tree_count"
    printf 'linked_pages=%s\n' "$linked_count"
    printf 'other_pages=%s\n' "$other_count"
    printf 'resume_mode=%s\n' "$CFG_RESUME_MODE"
    printf 'reused_pages=%s\n' "$resume_reused_pages"
    printf 'fresh_pages=%s\n' "$resume_fresh_pages"
    printf 'manifest_rows=%s\n' "$manifest_count"
    printf 'resolved_links=%s\n' "$resolved_count"
    printf 'unresolved_links=%s\n' "$unresolved_count"
    printf 'scope_findings=%s\n' "$scope_findings_count"
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

confluex_write_confidential_failure_status() {
  local status_file
  status_file="$(confluex_status_path_for_out_dir)"

  {
    printf 'command=%s\n' "$CFG_COMMAND"
    printf 'root_page_id=%s\n' "$CFG_ROOT_ID"
    printf 'critical_mode=%s\n' "$CFG_CRITICAL_MODE"
    printf 'confidential_mode=%s\n' "$CFG_CONFIDENTIAL_MODE"
    printf 'support_profile=%s\n' "$CONFLUEX_SUPPORT_PROFILE"
    printf 'scope_trust=%s\n' "unknown"
    printf 'encryption_enabled=%s\n' 1
    printf 'encryption_successful=%s\n' 0
    printf 'final_status=%s\n' "encryption_failed"
    printf 'blocking_reasons=%s\n' "encryption_failed"
    printf 'scope_findings=%s\n' 0
    printf 'path_provenance=%s\n' "runtime_origin"
    printf 'output_dir=%s\n' "$OUT_DIR"
  } > "$status_file"
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
      if (( CFG_RESUME_MODE )); then
        if [[ ! -d "$OUT_DIR" ]]; then
          log_error "--resume requires an existing output directory, got non-directory path: $OUT_DIR"
          return 1
        fi
      else
        log_error "output directory already exists: $OUT_DIR"
        return 1
      fi
    elif (( CFG_RESUME_MODE )); then
      log_error "--resume requires an existing output directory: $OUT_DIR"
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
  SCOPE_FINDINGS="$OUT_DIR/scope-findings.tsv"
  SUMMARY="$OUT_DIR/summary.txt"
  PREFLIGHT_INFO_FILE="$(confluex_temp_file "preflight_info_${CFG_ROOT_ID}.txt")"

  if [[ -n "$CFG_LOG_FILE" ]]; then
    LOG_FILE="$CFG_LOG_FILE"
  fi

  if (( CFG_RESUME_MODE )); then
    confluex_load_resume_manifest || return 1
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
  printf 'page_id\tscope_area\tfinding_type\tdetail\n' > "$SCOPE_FINDINGS"
}

confluex_collect_initial_queue() {
  local root_children_json="$TMP_DIR/root_children.json"
  local root_children_scan="$TMP_DIR/root_children_scan.txt"
  local scan_kind=""
  local scan_a=""
  local scan_b=""

  log_info "collecting recursive children for root page $CFG_ROOT_ID"
  if ! confluex_capture_stdout "$root_children_json" confluence children "$CFG_ROOT_ID" --recursive --format json; then
    log_warn "failed to collect children for root page $CFG_ROOT_ID; continuing with root page only"
    confluex_record_scope_finding "$CFG_ROOT_ID" "tree_scope" "children_unavailable" "root child traversal unavailable"
    confluex_enqueue "$CFG_ROOT_ID" root
    return 0
  fi
  confluex_track_download_bytes metadata "$(confluex_file_size_bytes "$root_children_json")"

  confluex_enqueue "$CFG_ROOT_ID" root

  if ! confluex_capture_stdout "$root_children_scan" confluex_inspect_children_payload "$root_children_json"; then
    log_warn "failed to parse children list for root page $CFG_ROOT_ID; continuing with root page only"
    confluex_record_scope_finding "$CFG_ROOT_ID" "tree_scope" "children_parse_failed" "recursive children payload unparseable"
    return 0
  fi

  while IFS=$'\x1f' read -r scan_kind scan_a scan_b; do
    [[ -z "$scan_kind" ]] && continue

    case "$scan_kind" in
      id)
        [[ -z "$scan_a" ]] && continue
        [[ "$scan_a" == "$CFG_ROOT_ID" ]] && continue
        log_info "found child page in tree: $scan_a"
        confluex_enqueue "$scan_a" "child:$CFG_ROOT_ID"
        ;;
      flag)
        confluex_record_scope_finding "$CFG_ROOT_ID" "tree_scope" "$scan_a" "$scan_b"
        ;;
    esac
  done < "$root_children_scan"
}

confluex_preflight() {
  if [[ -n "$CFG_ENCRYPTION_KEY" ]]; then
    log_info "preflight: checking encryption recipient"
    if ! confluex_validate_encryption_recipient "$CFG_ENCRYPTION_KEY"; then
      log_error "preflight failed: encryption recipient not available: $CFG_ENCRYPTION_KEY"
      return "$CONFLUEX_EXIT_ENCRYPTION_FAILURE"
    fi
  fi

  log_info "preflight: checking confluence-cli access"
  if confluex_capture_stdout "$PREFLIGHT_INFO_FILE" confluence info "$CFG_ROOT_ID"; then
    confluex_track_download_bytes metadata "$(confluex_file_size_bytes "$PREFLIGHT_INFO_FILE")"
    confluex_log_download_progress "preflight"
    return 0
  fi

  log_error "preflight failed: cannot access page $CFG_ROOT_ID. Check confluence-cli authentication and permissions."
  return "$CONFLUEX_EXIT_GENERIC_FAILURE"
}

confluex_write_encryption_instructions() {
  local archive_path="$1"
  local archive_name
  local tar_name
  local hint_file

  archive_name="$(basename "$archive_path")"
  tar_name="${archive_name%.gpg}"
  hint_file="${archive_path}.txt"

  {
    printf 'Encrypted archive: %s\n' "$archive_name"
    printf 'GPG key identity: %s\n' "$CFG_ENCRYPTION_KEY"
    printf '\n'
    printf 'Decrypt:\n'
    printf '  gpg --output %s --decrypt %s\n' "$tar_name" "$archive_name"
    printf '\n'
    printf 'Extract:\n'
    printf '  tar -xzf %s\n' "$tar_name"
    printf '\n'
    printf 'One-shot:\n'
    printf '  gpg --decrypt %s > %s && tar -xzf %s\n' "$archive_name" "$tar_name" "$tar_name"
  } > "$hint_file"

  ENCRYPTION_HINT_FILE="$hint_file"
}

confluex_validate_encryption_recipient() {
  local key="$1"

  if gpg --list-keys --with-colons "$key" >/dev/null 2>&1; then
    return 0
  fi

  return 1
}

confluex_print_doctor_capability_hint() {
  local cmd="$1"
  local label="$2"
  local version_line=""

  version_line="$("$cmd" --version 2>/dev/null | sed -n '1p')" || version_line=""
  if [[ -n "$version_line" ]]; then
    printf '  [INFO] %s version: %s\n' "$label" "$version_line"
    return 0
  fi

  case "$cmd" in
    node)
      printf '  [INFO] node capability: version output unavailable; parser helpers require a working Node.js runtime\n'
      ;;
    confluence)
      printf '  [INFO] confluence capability: version output unavailable; requires info, children, edit, export, and find subcommands\n'
      ;;
    gpg)
      printf '  [INFO] gpg capability: version output unavailable; encrypted output requires a working GnuPG installation\n'
      ;;
  esac
}

confluex_doctor_dependency_state() {
  local cmd="$1"
  local version_line=""

  if ! command -v "$cmd" >/dev/null 2>&1; then
    printf 'absent\n'
    return 0
  fi

  version_line="$("$cmd" --version 2>/dev/null | sed -n '1p')" || version_line=""
  version_line="${version_line//$'\t'/ }"
  version_line="${version_line//$'\r'/ }"
  version_line="${version_line//$'\n'/ }"
  version_line="$(trim "$version_line")"

  if [[ -z "$version_line" ]]; then
    printf 'present:unknown_version\n'
    return 0
  fi

  printf 'present:%s\n' "$version_line"
}

confluex_parse_info_identity() {
  local file="$1"
  local page_id=""

  page_id="$(sed -n 's/^[[:space:]]*ID:[[:space:]]*//p' "$file" | sed -n '1p')"
  page_id="$(trim "$page_id")"
  if [[ -n "$page_id" ]]; then
    printf '%s\n' "$page_id"
    return 0
  fi

  page_id="$(sed -n 's#^[[:space:]]*URL:[[:space:]].*/pages/\([0-9][0-9]*\)\([/?#].*\)\{0,1\}$#\1#p' "$file" | sed -n '1p')"
  page_id="$(trim "$page_id")"
  printf '%s\n' "$page_id"
}

confluex_doctor_next_action() {
  local parser_runtime_state="$1"
  local confluence_state="$2"
  local gpg_state="$3"
  local page_access="$4"
  local encryption_recipient="$5"
  local -a actions=()

  if [[ "$parser_runtime_state" == "absent" ]]; then
    actions+=("install_parser_runtime")
  fi
  if [[ "$confluence_state" == "absent" ]]; then
    actions+=("install_confluence_cli")
  fi
  if [[ "$gpg_state" == "absent" ]]; then
    actions+=("install_gpg")
  fi
  if [[ "$page_access" == "failed" ]]; then
    actions+=("check_page_access")
  fi
  if [[ "$encryption_recipient" == "missing" ]]; then
    actions+=("set_encryption_key")
  fi
  if [[ "$encryption_recipient" == "failed" ]]; then
    actions+=("fix_encryption_key")
  fi

  if (( ${#actions[@]} == 0 )); then
    printf 'none\n'
    return 0
  fi

  confluex_join_csv "${actions[@]}"
}

confluex_encryption_key_is_full_fingerprint() {
  local key="$1"

  [[ "$key" =~ ^[A-Fa-f0-9]{40}$ ]]
}

confluex_encrypt_output_dir() {
  local out_parent
  local out_name
  local archive_tar
  local archive_gpg

  out_parent="$(dirname "$OUT_DIR")"
  out_name="$(basename "$OUT_DIR")"
  archive_tar="${OUT_DIR}.tar.gz"
  archive_gpg="$(confluex_archive_path_for_out_dir)"

  log_info "encrypting output directory for GPG key identity: $CFG_ENCRYPTION_KEY"

  rm -f "$archive_tar" "$archive_gpg" "${archive_gpg}.txt"
  ENCRYPTED_ARCHIVE="$archive_gpg"
  ENCRYPTION_SUCCESSFUL=1
  confluex_write_summary 0 ""

  if ! tar -C "$out_parent" -czf "$archive_tar" "$out_name"; then
    log_error "failed to create tar archive for $OUT_DIR"
    ENCRYPTED_ARCHIVE=""
    ENCRYPTION_SUCCESSFUL=0
    confluex_write_summary 0 ""
    rm -f "$archive_tar"
    return 1
  fi

  if ! gpg --batch --yes --recipient "$CFG_ENCRYPTION_KEY" --output "$archive_gpg" --encrypt "$archive_tar"; then
    log_error "failed to encrypt archive for GPG key identity $CFG_ENCRYPTION_KEY"
    ENCRYPTED_ARCHIVE=""
    ENCRYPTION_SUCCESSFUL=0
    confluex_write_summary 0 ""
    rm -f "$archive_tar" "$archive_gpg"
    if (( CFG_CONFIDENTIAL_MODE )); then
      rm -rf "$OUT_DIR"
      confluex_write_confidential_failure_status
    fi
    return 1
  fi

  rm -f "$archive_tar"
  confluex_write_encryption_instructions "$archive_gpg"
  rm -rf "$OUT_DIR"

  log_info "encrypted archive: $archive_gpg"
  log_info "decrypt with: gpg --output ${out_name}.tar.gz --decrypt $archive_gpg"
  log_info "extract with: tar -xzf ${out_name}.tar.gz"
  log_info "instructions file: ${archive_gpg}.txt"
  return 0
}

confluex_run_config() {
  local config_file
  local current_key=""

  config_file="$(confluex_config_file)"

  if (( CFG_CLEAR_ENCRYPTION_KEY )); then
    confluex_clear_config_encryption_key
    printf 'Cleared default encryption key from %s\n' "$config_file"
    return 0
  fi

  if (( CFG_ENCRYPTION_KEY_SET )); then
    confluex_write_config_encryption_key "$CFG_ENCRYPTION_KEY"
    printf 'Saved default encryption key to %s\n' "$config_file"
    printf 'Default encryption key: %s\n' "$CFG_ENCRYPTION_KEY"
    return 0
  fi

  current_key="$(confluex_read_config_encryption_key)"
  printf 'confluex config\n'
  printf '  config file: %s\n' "$config_file"
  if [[ -n "$current_key" ]]; then
    printf '  default encryption key: %s\n' "$current_key"
  else
    printf '  default encryption key: <not set>\n'
  fi
}

confluex_run_doctor() {
  local parser_runtime_state=""
  local confluence_state=""
  local gpg_state=""
  local info_file=""
  local page_access="skipped"
  local page_identity=""
  local encryption_recipient="skipped"
  local effective_key=""
  local next_action=""

  parser_runtime_state="$(confluex_doctor_dependency_state node)"
  confluence_state="$(confluex_doctor_dependency_state confluence)"
  gpg_state="$(confluex_doctor_dependency_state gpg)"

  printf 'dependency_parser_runtime=%s\n' "$parser_runtime_state"
  printf 'dependency_confluence_cli=%s\n' "$confluence_state"
  printf 'dependency_gpg=%s\n' "$gpg_state"

  if [[ -n "$CFG_ROOT_ID" ]]; then
    info_file="$(mktemp "${TMPDIR:-/tmp}/confluex.doctor.${CFG_ROOT_ID}.XXXXXX")"
    if command -v confluence >/dev/null 2>&1 && confluence info "$CFG_ROOT_ID" >"$info_file" 2>/dev/null; then
      page_access="ok"
      page_identity="$(confluex_parse_info_identity "$info_file")"
      if [[ -z "$page_identity" ]]; then
        page_identity="$CFG_ROOT_ID"
      fi
    else
      page_access="failed"
    fi
    rm -f "$info_file"
  fi

  printf 'page_access=%s\n' "$page_access"
  if [[ "$page_access" == "ok" ]]; then
    printf 'page_identity=%s\n' "$page_identity"
  fi

  if (( CFG_VERIFY_ENCRYPTION )); then
    effective_key="$CFG_ENCRYPTION_KEY"
    if [[ -z "$effective_key" ]]; then
      effective_key="$(confluex_read_config_encryption_key)"
    fi

    if [[ -z "$effective_key" ]]; then
      encryption_recipient="missing"
    elif confluex_validate_encryption_recipient "$effective_key"; then
      encryption_recipient="ok"
    else
      encryption_recipient="failed"
    fi
  fi

  printf 'encryption_recipient=%s\n' "$encryption_recipient"
  printf 'support_profile=%s\n' "$CONFLUEX_SUPPORT_PROFILE"
  printf 'supported_link_forms=child_result,content_id,page_ref,macro_param,href_page_id,href_space_title,ri_url_page_id,ri_url_space_title\n'
  next_action="$(confluex_doctor_next_action "$parser_runtime_state" "$confluence_state" "$gpg_state" "$page_access" "$encryption_recipient")"
  printf 'next_action=%s\n' "$next_action"
  return 0
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

confluex_validate_run_configuration() {
  if (( CFG_CONFIDENTIAL_MODE )) && [[ -z "$CFG_ENCRYPTION_KEY" ]]; then
    log_error "--confidential requires an explicit or saved encryption key"
    return 1
  fi

  if (( CFG_CONFIDENTIAL_MODE )) && ! confluex_encryption_key_is_full_fingerprint "$CFG_ENCRYPTION_KEY"; then
    log_error "--confidential requires a full fingerprint encryption key"
    return 1
  fi

  return 0
}

confluex_warn_if_unbounded_non_safe_run() {
  if [[ "$CFG_COMMAND" != "export" && "$CFG_COMMAND" != "plan" ]]; then
    return 0
  fi

  if (( CFG_SAFE_MODE )); then
    return 0
  fi

  if (( CFG_MAX_PAGES > 0 || CFG_MAX_DOWNLOAD_MIB > 0 )); then
    return 0
  fi

  log_warn "running without --safe and without positive --max-pages/--max-download-mib limits; crawl state is effectively unbounded"
}

confluex_warn_about_confidential_logging() {
  if (( CFG_CONFIDENTIAL_MODE == 0 )); then
    return 0
  fi

  if [[ -z "$LOG_FILE" ]]; then
    return 0
  fi

  log_warn "--confidential does not protect persistent log files; plaintext operational logs may remain at $LOG_FILE"
}

confluex_main() {
  local script_path="$1"
  local script_lib_dir="$2"
  local -a required_cmds=()
  local preflight_status=0
  local export_status=0
  local encrypt_status=0
  shift 2

  CFG_HELP_ONLY=0
  if ! confluex_parse_args "$@"; then
    confluex_usage >&2
    return "$CONFLUEX_EXIT_GENERIC_FAILURE"
  fi

  if (( CFG_HELP_ONLY )); then
    return 0
  fi

  if [[ "$CFG_COMMAND" == "install" ]]; then
    confluex_install "$script_path" "$script_lib_dir"
    return 0
  fi

  if [[ "$CFG_COMMAND" == "uninstall" ]]; then
    confluex_uninstall
    return 0
  fi

  if [[ "$CFG_COMMAND" == "doctor" ]]; then
    confluex_run_doctor
    return $?
  fi

  if [[ "$CFG_COMMAND" == "config" ]]; then
    confluex_run_config
    return $?
  fi

  confluex_reset_state
  confluex_apply_default_config
  confluex_validate_run_configuration || return "$CONFLUEX_EXIT_GENERIC_FAILURE"

  required_cmds=(bash node confluence sed awk grep sort find tr wc)
  if [[ -n "$CFG_ENCRYPTION_KEY" ]]; then
    required_cmds+=(tar gpg)
  fi
  confluex_require_cmds "${required_cmds[@]}" || return "$CONFLUEX_EXIT_GENERIC_FAILURE"

  CFG_MAX_DOWNLOAD_BYTES=$((CFG_MAX_DOWNLOAD_MIB * 1048576))
  confluex_init_runtime_paths || return "$CONFLUEX_EXIT_GENERIC_FAILURE"
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
  log_info "encryption-key-source: $CFG_ENCRYPTION_KEY_SOURCE"
  if [[ -n "$CFG_ENCRYPTION_KEY" ]]; then
    log_info "encryption-key: $CFG_ENCRYPTION_KEY"
  else
    log_info "encryption-key: disabled"
  fi
  if [[ -n "$LOG_FILE" ]]; then
    log_info "log-file: $LOG_FILE"
  else
    log_info "log-file: disabled"
  fi
  confluex_warn_if_unbounded_non_safe_run
  confluex_warn_about_confidential_logging

  if confluex_preflight; then
    preflight_status=0
  else
    preflight_status=$?
  fi
  if (( preflight_status != 0 )); then
    return "$preflight_status"
  fi

  confluex_collect_initial_queue

  if confluex_run_export; then
    export_status=0
  else
    export_status=$?
  fi
  if (( export_status != 0 )); then
    if [[ -n "$CONFLUEX_STOP_REASON" ]]; then
      confluex_write_summary 1 "$CONFLUEX_STOP_REASON"
      log_warn "stopped early: $CONFLUEX_STOP_REASON"
      return "$CONFLUEX_EXIT_LIMIT_REACHED"
    fi
    confluex_write_summary 1 "runtime_error"
    log_error "aborted due to fail-fast mode"
    return "$CONFLUEX_EXIT_RUNTIME_ERROR"
  fi

  if [[ -n "$CFG_ENCRYPTION_KEY" ]]; then
    if confluex_encrypt_output_dir; then
      encrypt_status=0
    else
      encrypt_status=$?
    fi
    if (( encrypt_status != 0 )); then
      return "$CONFLUEX_EXIT_ENCRYPTION_FAILURE"
    fi
  else
    confluex_write_summary 0 ""
  fi

  if [[ -f "$SUMMARY" ]]; then
    confluex_compute_counts
    confluex_collect_blocking_reasons 0 ""
  fi

  log_info "done"
  log_info "processed pages: $processed_count"
  log_info "tree pages: $tree_count"
  log_info "linked pages: $linked_count"
  log_info "manifest rows: $manifest_count"
  log_info "resolved links: $resolved_count"
  log_info "unresolved links: $unresolved_count"
  log_info "failed operations: $failed_count"
  if [[ -n "$ENCRYPTED_ARCHIVE" ]]; then
    log_info "summary: inside encrypted archive"
    log_info "manifest: inside encrypted archive"
    log_info "resolved links: inside encrypted archive"
    log_info "unresolved links: inside encrypted archive"
    log_info "encrypted archive: $ENCRYPTED_ARCHIVE"
    if [[ -n "$ENCRYPTION_HINT_FILE" ]]; then
      log_info "encryption instructions: $ENCRYPTION_HINT_FILE"
    fi
  else
    log_info "summary: $SUMMARY"
    log_info "manifest: $MANIFEST"
    log_info "resolved links: $LINKS_FILE"
    log_info "unresolved links: $UNRESOLVED"
  fi
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

  if confluex_should_fail_critical_policy; then
    log_error "critical policy failed: $RUN_BLOCKING_REASONS"
    return "$CONFLUEX_EXIT_POLICY_FAILED"
  fi

  return 0
}
