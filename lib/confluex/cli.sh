#!/usr/bin/env bash

confluex_usage() {
  cat <<'USAGE'
Usage:
  confluex --page-id <id> [--dry-run] [--out DIR] [--no-fail-fast]
  confluex --install [--install-dir DIR]

What it does:
  - walks the full child tree of <page_id>
  - exports every page with attachments
  - parses storage XML on every page
  - follows links to other Confluence pages and exports them too
  - writes verbose logs, manifests, and link resolution reports

Options:
  --page-id ID       Root Confluence page id to export.
  --dry-run          Do not export page HTML or download attachments.
                     Still reads page metadata and storage XML to build the full plan.
  --out DIR          Output directory. Default is generated automatically.
  --no-fail-fast     Continue on runtime errors (best-effort export).
  --install          Install this script for global use.
  --install-dir DIR  Custom install directory (default: ~/.local/bin).
  -h, --help         Show this help.

Requirements:
  - bash (Git Bash is fine)
  - node
  - confluence-cli configured and working
USAGE
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
  CFG_DRY_RUN=0
  CFG_OUT_DIR=""
  CFG_ROOT_ID=""
  CFG_FAIL_FAST=1
  CFG_INSTALL=0
  CFG_INSTALL_DIR="${HOME}/.local/bin"

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
        CFG_DRY_RUN=1
        shift
        ;;
      --out)
        [[ $# -ge 2 ]] || { printf 'ERROR: --out requires a directory\n' >&2; return 1; }
        CFG_OUT_DIR="$2"
        shift 2
        ;;
      --no-fail-fast)
        CFG_FAIL_FAST=0
        shift
        ;;
      --install)
        CFG_INSTALL=1
        shift
        ;;
      --install-dir)
        [[ $# -ge 2 ]] || { printf 'ERROR: --install-dir requires a directory\n' >&2; return 1; }
        CFG_INSTALL_DIR="$2"
        shift 2
        ;;
      -h|--help)
        confluex_usage
        CFG_HELP_ONLY=1
        return 0
        ;;
      --*)
        printf 'ERROR: unknown option: %s\n' "$1" >&2
        return 1
        ;;
      *)
        printf 'ERROR: unexpected argument: %s\n' "$1" >&2
        return 1
        ;;
    esac
  done

  if (( CFG_INSTALL )); then
    return 0
  fi

  if [[ -z "$CFG_ROOT_ID" ]]; then
    printf 'ERROR: --page-id is required\n' >&2
    return 1
  fi

  if [[ ! "$CFG_ROOT_ID" =~ ^[0-9]+$ ]]; then
    printf 'ERROR: --page-id must be numeric, got: %s\n' "$CFG_ROOT_ID" >&2
    return 1
  fi

  return 0
}
