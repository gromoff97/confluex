#!/usr/bin/env bash

confluex_usage() {
  cat <<'USAGE'
Usage:
  confluex --page-id <id> [--dry-run] [--out DIR] [--no-fail-fast]
           [--keep-metadata] [--log-file FILE]
  confluex --install [--install-dir DIR]

What it does:
  - walks the full child tree of <page_id>
  - exports every page with attachments
  - parses storage XML on every page
  - follows links to other Confluence pages and exports them too
  - writes reports, and persistent logs only if requested

Options:
  --page-id ID       Root Confluence page id to export.
  --dry-run          Do not export page HTML or download attachments.
                     Still reads page metadata and storage XML to build the full plan.
  --out DIR          Output directory. Default is generated automatically.
  --no-fail-fast     Continue on runtime errors (best-effort export).
  --keep-metadata    Persist page metadata files such as _info.txt and _storage.xml.
  --log-file FILE    Write a persistent log file. By default logs go only to stderr.
  --install          Install this script for global use.
  --install-dir DIR  Custom install directory (default: ~/.local/bin).
  -h, --help         Show this help.

Requirements:
  - bash (Git Bash is fine)
  - node
  - confluence-cli configured and working
USAGE
}

confluex_suggest_option() {
  local bad_option="$1"

  case "$bad_option" in
    --page|--pageid|--page-id=*|--page_id|--page-idd|--page-idx)
      printf '%s\n' "--page-id"
      ;;
    --dry|--dryrun|--dry-run=*|--dry_run)
      printf '%s\n' "--dry-run"
      ;;
    --output|--out-dir|--outdir|--out=*)
      printf '%s\n' "--out"
      ;;
    --metadata|--keep-meta|--keep_metadata)
      printf '%s\n' "--keep-metadata"
      ;;
    --log|--logfile|--log-file=*|--logs)
      printf '%s\n' "--log-file"
      ;;
    --install-dir=*|--instal|--instal-dir|--installdir)
      printf '%s\n' "--install-dir"
      ;;
    --nofailfast|--no-failfast|--no_fail_fast|--fail-slow)
      printf '%s\n' "--no-fail-fast"
      ;;
    --halp|--hlep)
      printf '%s\n' "--help"
      ;;
    *)
      return 1
      ;;
  esac
}

confluex_print_unknown_option() {
  local bad_option="$1"
  local suggestion=""

  suggestion="$(confluex_suggest_option "$bad_option" || true)"
  if [[ -n "$suggestion" ]]; then
    printf 'ERROR: unknown option: %s\n' "$bad_option" >&2
    printf 'Did you mean: %s ?\n' "$suggestion" >&2
    return 0
  fi

  printf 'ERROR: unknown option: %s\n' "$bad_option" >&2
}

confluex_default_install_lib_dir() {
  local install_dir="$1"
  if [[ "$(basename "$install_dir")" == "bin" ]]; then
    printf '%s/lib/confluex\n' "$(dirname "$install_dir")"
  else
    printf '%s/lib/confluex\n' "$install_dir"
  fi
}

confluex_install() {
  local script_path="$1"
  local source_lib_dir="$2"
  local install_dir="$CFG_INSTALL_DIR"
  local install_script="$install_dir/confluex"
  local install_lib_dir
  install_lib_dir="$(confluex_default_install_lib_dir "$install_dir")"

  mkdir -p "$install_dir"
  mkdir -p "$(dirname "$install_lib_dir")"

  cp "$script_path" "$install_script"
  rm -rf "$install_lib_dir"
  cp -R "$source_lib_dir" "$install_lib_dir"
  chmod 755 "$install_script"

  printf 'Installed confluex to %s\n' "$install_script"
  printf 'Installed libraries to %s\n' "$install_lib_dir"

  if ! printf '%s\n' "$PATH" | tr ':' '\n' | grep -Fx "$install_dir" >/dev/null 2>&1; then
    printf 'WARNING: %s is not in PATH.\n' "$install_dir"
  fi
}

confluex_parse_args() {
  # shellcheck disable=SC2034
  CFG_DRY_RUN=0
  CFG_OUT_DIR=""
  CFG_ROOT_ID=""
  CFG_FAIL_FAST=1
  CFG_INSTALL=0
  CFG_INSTALL_DIR="${HOME}/.local/bin"
  CFG_INSTALL_DIR_SET=0
  CFG_HELP_ONLY=0
  CFG_KEEP_METADATA=0
  CFG_LOG_FILE=""
  CFG_LOG_FILE_SET=0

  while (($# > 0)); do
    case "$1" in
      --page-id)
        [[ $# -ge 2 ]] || { printf 'ERROR: --page-id requires an id\n' >&2; return 1; }
        [[ -z "$CFG_ROOT_ID" ]] || { printf 'ERROR: --page-id can be specified only once\n' >&2; return 1; }
        CFG_ROOT_ID="$2"
        shift 2
        ;;
      --page-id=*)
        [[ -z "$CFG_ROOT_ID" ]] || { printf 'ERROR: --page-id can be specified only once\n' >&2; return 1; }
        CFG_ROOT_ID="${1#*=}"
        shift
        ;;
      --dry-run)
        # shellcheck disable=SC2034
        CFG_DRY_RUN=1
        shift
        ;;
      --out)
        [[ $# -ge 2 ]] || { printf 'ERROR: --out requires a directory\n' >&2; return 1; }
        # shellcheck disable=SC2034
        CFG_OUT_DIR="$2"
        shift 2
        ;;
      --no-fail-fast)
        # shellcheck disable=SC2034
        CFG_FAIL_FAST=0
        shift
        ;;
      --keep-metadata)
        # shellcheck disable=SC2034
        CFG_KEEP_METADATA=1
        shift
        ;;
      --log-file)
        [[ $# -ge 2 ]] || { printf 'ERROR: --log-file requires a file path\n' >&2; return 1; }
        # shellcheck disable=SC2034
        CFG_LOG_FILE="$2"
        CFG_LOG_FILE_SET=1
        shift 2
        ;;
      --log-file=*)
        # shellcheck disable=SC2034
        CFG_LOG_FILE="${1#*=}"
        CFG_LOG_FILE_SET=1
        shift
        ;;
      --install)
        CFG_INSTALL=1
        shift
        ;;
      --install-dir)
        [[ $# -ge 2 ]] || { printf 'ERROR: --install-dir requires a directory\n' >&2; return 1; }
        CFG_INSTALL_DIR="$2"
        CFG_INSTALL_DIR_SET=1
        shift 2
        ;;
      -h|--help)
        confluex_usage
        # shellcheck disable=SC2034
        CFG_HELP_ONLY=1
        return 0
        ;;
      --*)
        confluex_print_unknown_option "$1"
        return 1
        ;;
      *)
        printf 'ERROR: unexpected argument: %s\n' "$1" >&2
        return 1
        ;;
    esac
  done

  if (( CFG_INSTALL )); then
    if [[ -n "$CFG_ROOT_ID" ]]; then
      printf 'ERROR: --install cannot be combined with --page-id\n' >&2
      return 1
    fi
    if [[ -n "$CFG_OUT_DIR" ]]; then
      printf 'ERROR: --install cannot be combined with --out\n' >&2
      return 1
    fi
    if (( CFG_DRY_RUN )); then
      printf 'ERROR: --install cannot be combined with --dry-run\n' >&2
      return 1
    fi
    if (( CFG_FAIL_FAST == 0 )); then
      printf 'ERROR: --install cannot be combined with --no-fail-fast\n' >&2
      return 1
    fi
    if (( CFG_KEEP_METADATA )); then
      printf 'ERROR: --install cannot be combined with --keep-metadata\n' >&2
      return 1
    fi
    if [[ -n "$CFG_LOG_FILE" ]]; then
      printf 'ERROR: --install cannot be combined with --log-file\n' >&2
      return 1
    fi
    return 0
  fi

  if [[ -z "$CFG_ROOT_ID" ]]; then
    printf 'ERROR: --page-id is required\n' >&2
    return 1
  fi

  if (( CFG_INSTALL_DIR_SET )); then
    printf 'ERROR: --install-dir requires --install\n' >&2
    return 1
  fi

  if [[ ! "$CFG_ROOT_ID" =~ ^[0-9]+$ ]]; then
    printf 'ERROR: --page-id must be numeric, got: %s\n' "$CFG_ROOT_ID" >&2
    return 1
  fi

  if (( CFG_LOG_FILE_SET )) && [[ -z "$CFG_LOG_FILE" ]]; then
    printf 'ERROR: --log-file requires a non-empty file path\n' >&2
    return 1
  fi

  return 0
}
