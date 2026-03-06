#!/usr/bin/env bash

confluex_require_cmd() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || {
    printf 'ERROR: required command not found: %s\n' "$cmd" >&2
    return 1
  }
}

confluex_require_cmds() {
  local cmd
  for cmd in "$@"; do
    confluex_require_cmd "$cmd" || return 1
  done
}

confluex_log() {
  local level="$1"
  shift
  local ts
  ts="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  printf '[%s] [%s] %s\n' "$ts" "$level" "$*" | tee -a "$LOG_FILE" >&2
}

log_info() { confluex_log INFO "$@"; }
log_warn() { confluex_log WARN "$@"; }
log_error() { confluex_log ERROR "$@"; }

trim() {
  local s="$1"
  s="${s//$'\r'/}"
  s="${s#${s%%[![:space:]]*}}"
  s="${s%${s##*[![:space:]]}}"
  printf '%s' "$s"
}

sanitize_name() {
  local s="$1"
  s="${s//$'\r'/ }"
  s="${s//$'\n'/ }"
  s="${s//$'\t'/ }"
  s="$(printf '%s' "$s" | sed -E 's/[<>:"\/\\|?*]+/_/g; s/[[:cntrl:]]+/_/g; s/[[:space:]]+/_/g; s/_+/_/g; s/^_+//; s/_+$//; s/[. ]+$//')"
  [[ -z "$s" ]] && s="untitled"
  printf '%s' "$s"
}

escape_tsv() {
  printf '%s' "$1" | tr '\t\r\n' '   '
}

count_lines() {
  local file="$1"
  if [[ -f "$file" ]]; then
    wc -l < "$file" | tr -d ' '
  else
    printf '0\n'
  fi
}

count_minus_header() {
  local file="$1"
  local lines
  lines="$(count_lines "$file")"
  if [[ "$lines" =~ ^[0-9]+$ ]] && (( lines > 0 )); then
    printf '%s\n' "$((lines - 1))"
  else
    printf '0\n'
  fi
}
