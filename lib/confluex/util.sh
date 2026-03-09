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
  local line
  ts="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  line="$(printf '[%s] [%s] %s\n' "$ts" "$level" "$*")"
  printf '%s\n' "$line" >&2
  if [[ -n "${LOG_FILE:-}" ]]; then
    printf '%s\n' "$line" >> "$LOG_FILE"
  fi
}

log_info() { confluex_log INFO "$@"; }
log_warn() { confluex_log WARN "$@"; }
log_error() { confluex_log ERROR "$@"; }

trim() {
  local s="$1"
  s="${s//$'\r'/}"
  s="${s#"${s%%[![:space:]]*}"}"
  s="${s%"${s##*[![:space:]]}"}"
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

truncate_name() {
  local s="$1"
  local max_len="$2"

  if [[ ! "$max_len" =~ ^[0-9]+$ ]] || (( max_len <= 0 )); then
    printf '%s' "$s"
    return 0
  fi

  if (( ${#s} > max_len )); then
    s="${s:0:max_len}"
    s="$(printf '%s' "$s" | sed -E 's/[_ .]+$//')"
  fi

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

confluex_config_dir() {
  printf '%s/confluex\n' "${XDG_CONFIG_HOME:-$HOME/.config}"
}

confluex_config_file() {
  printf '%s/config\n' "$(confluex_config_dir)"
}

confluex_read_config_encryption_key() {
  local config_file
  config_file="$(confluex_config_file)"

  if [[ -f "$config_file" ]]; then
    sed -n 's/^encryption_key=//p' "$config_file" | head -n 1
  fi
}

confluex_write_config_encryption_key() {
  local key="$1"
  local config_dir
  local config_file
  config_dir="$(confluex_config_dir)"
  config_file="$(confluex_config_file)"

  mkdir -p "$config_dir"
  printf 'encryption_key=%s\n' "$key" > "$config_file"
}

confluex_clear_config_encryption_key() {
  local config_file
  config_file="$(confluex_config_file)"
  rm -f "$config_file"
}
