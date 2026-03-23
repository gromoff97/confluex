#!/usr/bin/env bash

confluex_usage() {
  cat <<'USAGE'
Usage
  confluex <command> [options]

Commands
  export     materialized export workflow
  plan       dry-run planning workflow
  doctor     diagnostic workflow
  config     configuration workflow
  install    installation workflow
  uninstall  uninstallation workflow
USAGE
}

confluex_print_command_help() {
  local command="$1"

  case "$command" in
    export)
      cat <<'EOF'
Usage
  confluex export --page-id <id> [options]

Purpose
  materialized export workflow

Required options
  --page-id <id>              Root Confluence page id to export.

Optional options
  --out <dir>                 Output directory. Default: generated automatically.
  --safe                      Apply conservative defaults for routine runs.
  --critical                  Fail closed when findings or failures remain.
  --encrypt                   Request encrypted output delivery.
  --confidential              Request encrypted fail-closed delivery with plaintext cleanup on encryption failure.
  --resume                    Reuse a compatible existing export root selected by --out.
  --no-fail-fast              Continue after page-local runtime failures.
  --keep-metadata             Persist page metadata files such as _info.txt and _storage.xml.
  --page-format <format>      Persist page payload as md or html. Default: md.
  --log-file <file>           Write a persistent log artifact.
  --encryption-key <value>    Use this encryption recipient for the current command.
  --max-pages <n>             Stop after n processed pages.
  --max-download-mib <n>      Stop after downloading n MiB in total.
  --sleep-ms <n>              Sleep n ms between processed pages.
  --max-find-candidates <n>   Inspect at most n title-resolution candidates per link.

Examples
  confluex export --page-id 12345 --out ./dump
  confluex export --page-id 12345 --out ./dump --page-format html
  confluex export --page-id 12345 --out ./dump --encrypt --encryption-key 0123456789ABCDEF0123456789ABCDEF01234567

Notes
  --critical cannot be combined with --no-fail-fast.
  --confidential implies --encrypt and --critical.
  --resume requires an explicit --out directory and a compatible prior export result.
EOF
      ;;
    plan)
      cat <<'EOF'
Usage
  confluex plan --page-id <id> [options]

Purpose
  dry-run planning workflow

Required options
  --page-id <id>              Root Confluence page id to plan.

Optional options
  --out <dir>                 Output directory. Default: generated automatically.
  --safe                      Apply conservative defaults for routine runs.
  --critical                  Fail closed when findings or failures remain.
  --encrypt                   Request encrypted output delivery.
  --confidential              Request encrypted fail-closed delivery with plaintext cleanup on encryption failure.
  --no-fail-fast              Continue after page-local runtime failures.
  --keep-metadata             Persist page metadata files such as _info.txt and _storage.xml.
  --log-file <file>           Write a persistent log artifact.
  --encryption-key <value>    Use this encryption recipient for the current command.
  --max-pages <n>             Stop after n processed pages.
  --max-download-mib <n>      Stop after downloading n MiB in total.
  --sleep-ms <n>              Sleep n ms between processed pages.
  --max-find-candidates <n>   Inspect at most n title-resolution candidates per link.

Examples
  confluex plan --page-id 12345 --out ./plan
  confluex plan --page-id 12345 --out ./plan --safe
  confluex plan --page-id 12345 --out ./plan --encrypt --encryption-key 0123456789ABCDEF0123456789ABCDEF01234567

Notes
  --critical cannot be combined with --no-fail-fast.
  --confidential implies --encrypt and --critical.
EOF
      ;;
    doctor)
      cat <<'EOF'
Usage
  confluex doctor [options]

Purpose
  diagnostic workflow

Required options
  none

Optional options
  --page-id <id>              Verify that a candidate root page is accessible.
  --verify-encryption         Verify the effective encryption recipient.
  --encryption-key <value>    Override the recipient used by --verify-encryption.
  --log-file <file>           Write a persistent log artifact.

Examples
  confluex doctor
  confluex doctor --page-id 12345
  confluex doctor --verify-encryption --encryption-key 0123456789ABCDEF0123456789ABCDEF01234567

Notes
  --encryption-key is accepted only together with --verify-encryption.
EOF
      ;;
    config)
      cat <<'EOF'
Usage
  confluex config [options]

Purpose
  configuration workflow

Required options
  none

Optional options
  --encryption-key <value>    Save this default encryption recipient.
  --clear-encryption-key      Clear the saved default encryption recipient.

Examples
  confluex config
  confluex config --encryption-key 0123456789ABCDEF0123456789ABCDEF01234567
  confluex config --clear-encryption-key

Notes
  --encryption-key and --clear-encryption-key are mutually exclusive.
EOF
      ;;
    install)
      cat <<'EOF'
Usage
  confluex install [options]

Purpose
  installation workflow

Required options
  none

Optional options
  --install-dir <dir>         Install into this target directory. Default: ~/.local/bin on POSIX.

Examples
  confluex install
  confluex install --install-dir ./bin
EOF
      ;;
    uninstall)
      cat <<'EOF'
Usage
  confluex uninstall [options]

Purpose
  uninstallation workflow

Required options
  none

Optional options
  --install-dir <dir>         Uninstall from this target directory. Default: ~/.local/bin on POSIX.

Examples
  confluex uninstall
  confluex uninstall --install-dir ./bin
EOF
      ;;
    *)
      return 1
      ;;
  esac
}

confluex_suggest_option() {
  local bad_option="$1"

  case "$bad_option" in
    --page|--pageid|--page-id=*|--page_id|--page-idd|--page-idx)
      printf '%s\n' "--page-id"
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
    --encrypt|--encrypt-recipient|--encrypt_to|--recipient|--encrypt-for|--encrypt-for=*|--encryption)
      printf '%s\n' "--encrypt"
      ;;
    --page-format=*|--page_format|--format)
      printf '%s\n' "--page-format"
      ;;
    --max-find|--max-find-candidate|--max-find-results|--max-candidates)
      printf '%s\n' "--max-find-candidates"
      ;;
    --safe-mode|--safe_export|--cautious|--guarded)
      printf '%s\n' "--safe"
      ;;
    --strict|--strict-mode|--critical-mode|--critical_run)
      printf '%s\n' "--critical"
      ;;
    --private|--confidential-mode|--encrypted-only)
      printf '%s\n' "--confidential"
      ;;
    --resume-run|--continue|--continue-run|--reuse-existing|--resume-export)
      printf '%s\n' "--resume"
      ;;
    --max-page|--page-limit|--max-items)
      printf '%s\n' "--max-pages"
      ;;
    --max-download|--max-download-mb|--max-mib)
      printf '%s\n' "--max-download-mib"
      ;;
    --sleep|--pause-ms|--delay-ms)
      printf '%s\n' "--sleep-ms"
      ;;
    --install-dir=*|--instal|--instal-dir|--installdir)
      printf '%s\n' "--install-dir"
      ;;
    --clear-key|--clear-encryption|--remove-encryption-key)
      printf '%s\n' "--clear-encryption-key"
      ;;
    --verify-gpg|--verify-encryption-key|--check-encryption|--check-gpg)
      printf '%s\n' "--verify-encryption"
      ;;
    --unistall|--uninstal|--remove-self)
      printf '%s\n' "--uninstall"
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
  printf '%s/lib/confluex\n' "$install_dir"
}

confluex_install_manifest_path() {
  local install_dir="$1"
  printf '%s/.confluex-install-manifest.txt\n' "$install_dir"
}

confluex_manifest_entry_is_valid() {
  local entry="$1"

  [[ -n "$entry" ]] || return 1
  [[ "$entry" != /* ]] || return 1
  [[ "$entry" != "." && "$entry" != ".." ]] || return 1
  case "$entry" in
    */../*|../*|*/..|*/./*|./*|*/.|*//*) return 1 ;;
  esac

  return 0
}

confluex_install_manifest_entries() {
  local install_dir="$1"
  local manifest_path="$2"
  local install_lib_dir="$3"
  local rel_path=""

  printf 'confluex\n'
  printf 'lib\n'
  printf 'lib/confluex\n'
  while IFS= read -r rel_path; do
    [[ -n "$rel_path" ]] || continue
    printf '%s\n' "$rel_path"
  done < <(
    cd "$install_dir" &&
      find "${install_lib_dir#"$install_dir"/}" -mindepth 1 | LC_ALL=C sort
  )
  printf '%s\n' "${manifest_path#"$install_dir"/}"
}

confluex_read_install_manifest() {
  local manifest_path="$1"
  declare -Ag CONFLUEX_INSTALL_MANIFEST_SEEN=()
  declare -ag CONFLUEX_INSTALL_MANIFEST_ENTRIES=()
  local entry=""

  while IFS= read -r entry || [[ -n "$entry" ]]; do
    confluex_manifest_entry_is_valid "$entry" || return 1
    [[ -z "${CONFLUEX_INSTALL_MANIFEST_SEEN[$entry]:-}" ]] || return 1
    CONFLUEX_INSTALL_MANIFEST_SEEN["$entry"]=1
    CONFLUEX_INSTALL_MANIFEST_ENTRIES+=("$entry")
  done < "$manifest_path"

  (( ${#CONFLUEX_INSTALL_MANIFEST_ENTRIES[@]} > 0 )) || return 1
  [[ -n "${CONFLUEX_INSTALL_MANIFEST_SEEN[.confluex-install-manifest.txt]:-}" ]] || return 1

  return 0
}

confluex_install() {
  local script_path="$1"
  local source_lib_dir="$2"
  local install_dir="$CFG_INSTALL_DIR"
  local install_script="$install_dir/confluex"
  local install_lib_dir
  local manifest_path
  local manifest_tmp
  install_lib_dir="$(confluex_default_install_lib_dir "$install_dir")"
  manifest_path="$(confluex_install_manifest_path "$install_dir")"

  if [[ -e "$install_dir" && ! -d "$install_dir" ]]; then
    printf 'ERROR: --install-dir must resolve to a directory path, got: %s\n' "$install_dir" >&2
    return 1
  fi

  mkdir -p "$install_dir"
  mkdir -p "$install_dir/lib"

  cp "$script_path" "$install_script"
  rm -rf "$install_lib_dir"
  cp -R "$source_lib_dir" "$install_lib_dir"
  chmod 755 "$install_script"
  manifest_tmp="$(mktemp "${TMPDIR:-/tmp}/confluex.install-manifest.XXXXXX")"
  confluex_install_manifest_entries "$install_dir" "$manifest_path" "$install_lib_dir" > "$manifest_tmp"
  mv "$manifest_tmp" "$manifest_path"

  printf 'install_result=installed target=%s\n' "$(confluex_quote_path_string "$install_dir")"
}

confluex_uninstall() {
  local install_dir="$CFG_INSTALL_DIR"
  local manifest_path
  local entry=""
  local abs_path=""
  local removed_any=0
  manifest_path="$(confluex_install_manifest_path "$install_dir")"

  if [[ -e "$install_dir" && ! -d "$install_dir" ]]; then
    printf 'ERROR: --install-dir must resolve to a directory path, got: %s\n' "$install_dir" >&2
    return 1
  fi

  if [[ ! -d "$install_dir" || ! -f "$manifest_path" ]]; then
    printf 'uninstall_result=absent target=%s\n' "$(confluex_quote_path_string "$install_dir")"
    return 0
  fi

  if ! confluex_read_install_manifest "$manifest_path"; then
    printf 'ERROR: invalid install manifest: %s\n' "$manifest_path" >&2
    return 1
  fi

  while IFS= read -r entry; do
    [[ -n "$entry" ]] || continue
    abs_path="$install_dir/$entry"
    if [[ -L "$abs_path" || -f "$abs_path" ]]; then
      rm -f "$abs_path"
      removed_any=1
      continue
    fi
    if [[ -d "$abs_path" ]]; then
      rm -rf "$abs_path"
      removed_any=1
    fi
  done < <(printf '%s\n' "${CONFLUEX_INSTALL_MANIFEST_ENTRIES[@]}" | awk -F/ '{ print NF "\t" $0 }' | sort -rn | cut -f2-)

  if (( removed_any )); then
    printf 'uninstall_result=removed target=%s\n' "$(confluex_quote_path_string "$install_dir")"
  else
    printf 'uninstall_result=absent target=%s\n' "$(confluex_quote_path_string "$install_dir")"
  fi
}

confluex_parse_args() {
  # shellcheck disable=SC2034
  CFG_DRY_RUN=0
  CFG_DRY_RUN_OPTION_SET=0
  CFG_COMMAND=""
  CFG_OUT_DIR=""
  CFG_OUT_DIR_SET=0
  CFG_ROOT_ID=""
  CFG_FAIL_FAST=1
  CFG_INSTALL_DIR="${HOME}/.local/bin"
  CFG_INSTALL_DIR_SET=0
  CFG_HELP_ONLY=0
  CFG_KEEP_METADATA=0
  CFG_LOG_FILE=""
  CFG_LOG_FILE_SET=0
  CFG_ENCRYPTION_KEY=""
  CFG_ENCRYPTION_KEY_SET=0
  CFG_CLEAR_ENCRYPTION_KEY=0
  CFG_ENCRYPT_REQUESTED=0
  CFG_MAX_FIND_CANDIDATES=10
  CFG_MAX_FIND_CANDIDATES_SET=0
  CFG_SAFE_MODE=0
  CFG_MAX_PAGES=0
  CFG_MAX_PAGES_SET=0
  CFG_MAX_DOWNLOAD_MIB=0
  CFG_MAX_DOWNLOAD_MIB_SET=0
  CFG_SLEEP_MS=0
  CFG_SLEEP_MS_SET=0
  CFG_CRITICAL_MODE=0
  CFG_CONFIDENTIAL_MODE=0
  CFG_VERIFY_ENCRYPTION=0
  CFG_RESUME_MODE=0
  CFG_PAGE_FORMAT="md"
  CFG_PAGE_FORMAT_SET=0

  case "${1:-}" in
    export|plan|doctor|config|install|uninstall)
      CFG_COMMAND="$1"
      shift
      ;;
    -h|--help)
      confluex_usage
      CFG_HELP_ONLY=1
      return 0
      ;;
    "")
      confluex_usage
      CFG_HELP_ONLY=1
      return 0
      ;;
    --*)
      confluex_print_unknown_option "$1"
      return 1
      ;;
    *)
      printf 'ERROR: unknown command: %s\n' "$1" >&2
      return 1
      ;;
  esac

  case "$CFG_COMMAND" in
    plan)
      CFG_DRY_RUN=1
      ;;
    doctor)
      ;;
    config)
      ;;
    uninstall)
      ;;
  esac

  while (($# > 0)); do
    case "$1" in
      --page-id)
        [[ $# -ge 2 ]] || { printf 'ERROR: --page-id requires an id\n' >&2; return 1; }
        CFG_ROOT_ID="$2"
        shift 2
        ;;
      --page-id=*)
        CFG_ROOT_ID="${1#*=}"
        shift
        ;;
      --dry-run)
        CFG_DRY_RUN_OPTION_SET=1
        CFG_DRY_RUN=1
        shift
        ;;
      --safe)
        CFG_SAFE_MODE=1
        shift
        ;;
      --critical)
        CFG_CRITICAL_MODE=1
        shift
        ;;
      --confidential)
        CFG_CONFIDENTIAL_MODE=1
        shift
        ;;
      --encrypt)
        CFG_ENCRYPT_REQUESTED=1
        shift
        ;;
      --resume)
        CFG_RESUME_MODE=1
        shift
        ;;
      --out)
        [[ $# -ge 2 ]] || { printf 'ERROR: --out requires a directory\n' >&2; return 1; }
        CFG_OUT_DIR="$2"
        CFG_OUT_DIR_SET=1
        shift 2
        ;;
      --out=*)
        CFG_OUT_DIR="${1#*=}"
        CFG_OUT_DIR_SET=1
        shift
        ;;
      --no-fail-fast)
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
      --encryption-key)
        [[ $# -ge 2 ]] || { printf 'ERROR: --encryption-key requires a GPG key identity\n' >&2; return 1; }
        CFG_ENCRYPTION_KEY="$2"
        CFG_ENCRYPTION_KEY_SET=1
        shift 2
        ;;
      --encryption-key=*)
        CFG_ENCRYPTION_KEY="${1#*=}"
        CFG_ENCRYPTION_KEY_SET=1
        shift
        ;;
      --clear-encryption-key)
        CFG_CLEAR_ENCRYPTION_KEY=1
        shift
        ;;
      --verify-encryption)
        CFG_VERIFY_ENCRYPTION=1
        shift
        ;;
      --page-format)
        [[ $# -ge 2 ]] || { printf 'ERROR: --page-format requires a format\n' >&2; return 1; }
        CFG_PAGE_FORMAT="$2"
        CFG_PAGE_FORMAT_SET=1
        shift 2
        ;;
      --page-format=*)
        CFG_PAGE_FORMAT="${1#*=}"
        CFG_PAGE_FORMAT_SET=1
        shift
        ;;
      --max-find-candidates)
        [[ $# -ge 2 ]] || { printf 'ERROR: --max-find-candidates requires a number\n' >&2; return 1; }
        # shellcheck disable=SC2034
        CFG_MAX_FIND_CANDIDATES="$2"
        CFG_MAX_FIND_CANDIDATES_SET=1
        shift 2
        ;;
      --max-find-candidates=*)
        # shellcheck disable=SC2034
        CFG_MAX_FIND_CANDIDATES="${1#*=}"
        CFG_MAX_FIND_CANDIDATES_SET=1
        shift
        ;;
      --max-pages)
        [[ $# -ge 2 ]] || { printf 'ERROR: --max-pages requires a number\n' >&2; return 1; }
        CFG_MAX_PAGES="$2"
        CFG_MAX_PAGES_SET=1
        shift 2
        ;;
      --max-pages=*)
        CFG_MAX_PAGES="${1#*=}"
        CFG_MAX_PAGES_SET=1
        shift
        ;;
      --max-download-mib)
        [[ $# -ge 2 ]] || { printf 'ERROR: --max-download-mib requires a number\n' >&2; return 1; }
        CFG_MAX_DOWNLOAD_MIB="$2"
        CFG_MAX_DOWNLOAD_MIB_SET=1
        shift 2
        ;;
      --max-download-mib=*)
        CFG_MAX_DOWNLOAD_MIB="${1#*=}"
        CFG_MAX_DOWNLOAD_MIB_SET=1
        shift
        ;;
      --sleep-ms)
        [[ $# -ge 2 ]] || { printf 'ERROR: --sleep-ms requires a number\n' >&2; return 1; }
        CFG_SLEEP_MS="$2"
        CFG_SLEEP_MS_SET=1
        shift 2
        ;;
      --sleep-ms=*)
        CFG_SLEEP_MS="${1#*=}"
        CFG_SLEEP_MS_SET=1
        shift
        ;;
      --install-dir)
        [[ $# -ge 2 ]] || { printf 'ERROR: --install-dir requires a directory\n' >&2; return 1; }
        CFG_INSTALL_DIR="$2"
        CFG_INSTALL_DIR_SET=1
        shift 2
        ;;
      --install-dir=*)
        CFG_INSTALL_DIR="${1#*=}"
        CFG_INSTALL_DIR_SET=1
        shift
        ;;
      -h|--help)
        confluex_print_command_help "$CFG_COMMAND"
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

  if [[ "$CFG_COMMAND" == "install" ]]; then
    if [[ -n "$CFG_ROOT_ID" ]]; then
      printf 'ERROR: install does not use --page-id\n' >&2
      return 1
    fi
    if [[ -n "$CFG_OUT_DIR" ]]; then
      printf 'ERROR: install does not use --out\n' >&2
      return 1
    fi
    if (( CFG_DRY_RUN )); then
      printf 'ERROR: install does not use --dry-run\n' >&2
      return 1
    fi
    if (( CFG_FAIL_FAST == 0 )); then
      printf 'ERROR: install does not use --no-fail-fast\n' >&2
      return 1
    fi
    if (( CFG_KEEP_METADATA )); then
      printf 'ERROR: install does not use --keep-metadata\n' >&2
      return 1
    fi
    if [[ -n "$CFG_LOG_FILE" ]]; then
      printf 'ERROR: install does not use --log-file\n' >&2
      return 1
    fi
    if [[ -n "$CFG_ENCRYPTION_KEY" ]]; then
      printf 'ERROR: install does not use --encryption-key\n' >&2
      return 1
    fi
    if (( CFG_CLEAR_ENCRYPTION_KEY )); then
      printf 'ERROR: install does not use --clear-encryption-key\n' >&2
      return 1
    fi
    if (( CFG_SAFE_MODE )); then
      printf 'ERROR: install does not use --safe\n' >&2
      return 1
    fi
    if (( CFG_CRITICAL_MODE )); then
      printf 'ERROR: install does not use --critical\n' >&2
      return 1
    fi
    if (( CFG_CONFIDENTIAL_MODE )); then
      printf 'ERROR: install does not use --confidential\n' >&2
      return 1
    fi
    if (( CFG_ENCRYPT_REQUESTED )); then
      printf 'ERROR: install does not use --encrypt\n' >&2
      return 1
    fi
    if (( CFG_VERIFY_ENCRYPTION )); then
      printf 'ERROR: install does not use --verify-encryption\n' >&2
      return 1
    fi
    if (( CFG_RESUME_MODE )); then
      printf 'ERROR: install does not use --resume\n' >&2
      return 1
    fi
    if (( CFG_MAX_PAGES_SET )); then
      printf 'ERROR: install does not use --max-pages\n' >&2
      return 1
    fi
    if (( CFG_MAX_DOWNLOAD_MIB_SET )); then
      printf 'ERROR: install does not use --max-download-mib\n' >&2
      return 1
    fi
    if (( CFG_SLEEP_MS_SET )); then
      printf 'ERROR: install does not use --sleep-ms\n' >&2
      return 1
    fi
    if (( CFG_MAX_FIND_CANDIDATES_SET )); then
      printf 'ERROR: install does not use --max-find-candidates\n' >&2
      return 1
    fi
    if (( CFG_PAGE_FORMAT_SET )); then
      printf 'ERROR: install does not use --page-format\n' >&2
      return 1
    fi
    if (( CFG_INSTALL_DIR_SET )) && [[ -z "$CFG_INSTALL_DIR" ]]; then
      printf 'ERROR: --install-dir requires a non-empty directory\n' >&2
      return 1
    fi
    CFG_INSTALL_DIR="$(confluex_normalize_logical_path "$CFG_INSTALL_DIR")" || {
      printf 'ERROR: --install-dir requires a valid directory path\n' >&2
      return 1
    }
    return 0
  fi

  if [[ "$CFG_COMMAND" == "uninstall" ]]; then
    if [[ -n "$CFG_ROOT_ID" ]]; then
      printf 'ERROR: uninstall does not use --page-id\n' >&2
      return 1
    fi
    if [[ -n "$CFG_OUT_DIR" ]]; then
      printf 'ERROR: uninstall does not use --out\n' >&2
      return 1
    fi
    if (( CFG_DRY_RUN )); then
      printf 'ERROR: uninstall does not use --dry-run\n' >&2
      return 1
    fi
    if (( CFG_FAIL_FAST == 0 )); then
      printf 'ERROR: uninstall does not use --no-fail-fast\n' >&2
      return 1
    fi
    if (( CFG_KEEP_METADATA )); then
      printf 'ERROR: uninstall does not use --keep-metadata\n' >&2
      return 1
    fi
    if [[ -n "$CFG_LOG_FILE" ]]; then
      printf 'ERROR: uninstall does not use --log-file\n' >&2
      return 1
    fi
    if [[ -n "$CFG_ENCRYPTION_KEY" ]]; then
      printf 'ERROR: uninstall does not use --encryption-key\n' >&2
      return 1
    fi
    if (( CFG_CLEAR_ENCRYPTION_KEY )); then
      printf 'ERROR: uninstall does not use --clear-encryption-key\n' >&2
      return 1
    fi
    if (( CFG_SAFE_MODE )); then
      printf 'ERROR: uninstall does not use --safe\n' >&2
      return 1
    fi
    if (( CFG_CRITICAL_MODE )); then
      printf 'ERROR: uninstall does not use --critical\n' >&2
      return 1
    fi
    if (( CFG_CONFIDENTIAL_MODE )); then
      printf 'ERROR: uninstall does not use --confidential\n' >&2
      return 1
    fi
    if (( CFG_ENCRYPT_REQUESTED )); then
      printf 'ERROR: uninstall does not use --encrypt\n' >&2
      return 1
    fi
    if (( CFG_VERIFY_ENCRYPTION )); then
      printf 'ERROR: uninstall does not use --verify-encryption\n' >&2
      return 1
    fi
    if (( CFG_RESUME_MODE )); then
      printf 'ERROR: uninstall does not use --resume\n' >&2
      return 1
    fi
    if (( CFG_MAX_PAGES_SET )); then
      printf 'ERROR: uninstall does not use --max-pages\n' >&2
      return 1
    fi
    if (( CFG_MAX_DOWNLOAD_MIB_SET )); then
      printf 'ERROR: uninstall does not use --max-download-mib\n' >&2
      return 1
    fi
    if (( CFG_SLEEP_MS_SET )); then
      printf 'ERROR: uninstall does not use --sleep-ms\n' >&2
      return 1
    fi
    if (( CFG_MAX_FIND_CANDIDATES_SET )); then
      printf 'ERROR: uninstall does not use --max-find-candidates\n' >&2
      return 1
    fi
    if (( CFG_PAGE_FORMAT_SET )); then
      printf 'ERROR: uninstall does not use --page-format\n' >&2
      return 1
    fi
    if (( CFG_INSTALL_DIR_SET )) && [[ -z "$CFG_INSTALL_DIR" ]]; then
      printf 'ERROR: --install-dir requires a non-empty directory\n' >&2
      return 1
    fi
    CFG_INSTALL_DIR="$(confluex_normalize_logical_path "$CFG_INSTALL_DIR")" || {
      printf 'ERROR: --install-dir requires a valid directory path\n' >&2
      return 1
    }
    return 0
  fi

  if [[ "$CFG_COMMAND" == "doctor" ]]; then
    if [[ -n "$CFG_OUT_DIR" ]]; then
      printf 'ERROR: doctor does not use --out\n' >&2
      return 1
    fi
    if (( CFG_DRY_RUN )); then
      printf 'ERROR: doctor does not use --dry-run\n' >&2
      return 1
    fi
    if (( CFG_FAIL_FAST == 0 )); then
      printf 'ERROR: doctor does not use --no-fail-fast\n' >&2
      return 1
    fi
    if (( CFG_KEEP_METADATA )); then
      printf 'ERROR: doctor does not use --keep-metadata\n' >&2
      return 1
    fi
    if (( CFG_CLEAR_ENCRYPTION_KEY )); then
      printf 'ERROR: doctor does not use --clear-encryption-key\n' >&2
      return 1
    fi
    if (( CFG_SAFE_MODE )); then
      printf 'ERROR: doctor does not use --safe\n' >&2
      return 1
    fi
    if (( CFG_MAX_PAGES_SET )); then
      printf 'ERROR: doctor does not use --max-pages\n' >&2
      return 1
    fi
    if (( CFG_MAX_DOWNLOAD_MIB_SET )); then
      printf 'ERROR: doctor does not use --max-download-mib\n' >&2
      return 1
    fi
    if (( CFG_SLEEP_MS_SET )); then
      printf 'ERROR: doctor does not use --sleep-ms\n' >&2
      return 1
    fi
    if [[ ! "$CFG_MAX_FIND_CANDIDATES" =~ ^[0-9]+$ ]] || (( CFG_MAX_FIND_CANDIDATES == 0 )); then
      printf 'ERROR: --max-find-candidates must be a positive integer, got: %s\n' "$CFG_MAX_FIND_CANDIDATES" >&2
      return 1
    fi
    if (( CFG_INSTALL_DIR_SET )); then
      printf 'ERROR: doctor does not use --install-dir\n' >&2
      return 1
    fi
    if (( CFG_CRITICAL_MODE )); then
      printf 'ERROR: doctor does not use --critical\n' >&2
      return 1
    fi
    if (( CFG_CONFIDENTIAL_MODE )); then
      printf 'ERROR: doctor does not use --confidential\n' >&2
      return 1
    fi
    if (( CFG_ENCRYPT_REQUESTED )); then
      printf 'ERROR: doctor does not use --encrypt\n' >&2
      return 1
    fi
    if (( CFG_RESUME_MODE )); then
      printf 'ERROR: doctor does not use --resume\n' >&2
      return 1
    fi
    if (( CFG_PAGE_FORMAT_SET )); then
      printf 'ERROR: doctor does not use --page-format\n' >&2
      return 1
    fi
    if [[ -n "$CFG_ROOT_ID" && ! "$CFG_ROOT_ID" =~ ^[0-9]+$ ]]; then
      printf 'ERROR: --page-id must be numeric, got: %s\n' "$CFG_ROOT_ID" >&2
      return 1
    fi
    if (( CFG_LOG_FILE_SET )) && [[ -z "$CFG_LOG_FILE" ]]; then
      printf 'ERROR: --log-file requires a non-empty file path\n' >&2
      return 1
    fi
    if (( CFG_VERIFY_ENCRYPTION == 0 )) && (( CFG_ENCRYPTION_KEY_SET )); then
      printf 'ERROR: doctor only uses --encryption-key together with --verify-encryption\n' >&2
      return 1
    fi
    if (( CFG_VERIFY_ENCRYPTION )) && (( CFG_ENCRYPTION_KEY_SET )) && [[ -z "$CFG_ENCRYPTION_KEY" ]]; then
      printf 'ERROR: --encryption-key requires a non-empty GPG key identity\n' >&2
      return 1
    fi
    if (( CFG_LOG_FILE_SET )); then
      CFG_LOG_FILE="$(confluex_normalize_logical_path "$CFG_LOG_FILE")" || {
        printf 'ERROR: --log-file requires a valid file path\n' >&2
        return 1
      }
    fi
    return 0
  fi

  if [[ "$CFG_COMMAND" == "config" ]]; then
    if [[ -n "$CFG_ROOT_ID" ]]; then
      printf 'ERROR: config does not use --page-id\n' >&2
      return 1
    fi
    if [[ -n "$CFG_OUT_DIR" ]]; then
      printf 'ERROR: config does not use --out\n' >&2
      return 1
    fi
    if (( CFG_DRY_RUN )); then
      printf 'ERROR: config does not use --dry-run\n' >&2
      return 1
    fi
    if (( CFG_FAIL_FAST == 0 )); then
      printf 'ERROR: config does not use --no-fail-fast\n' >&2
      return 1
    fi
    if (( CFG_KEEP_METADATA )); then
      printf 'ERROR: config does not use --keep-metadata\n' >&2
      return 1
    fi
    if [[ -n "$CFG_LOG_FILE" ]]; then
      printf 'ERROR: config does not use --log-file\n' >&2
      return 1
    fi
    if (( CFG_SAFE_MODE )); then
      printf 'ERROR: config does not use --safe\n' >&2
      return 1
    fi
    if (( CFG_CRITICAL_MODE )); then
      printf 'ERROR: config does not use --critical\n' >&2
      return 1
    fi
    if (( CFG_CONFIDENTIAL_MODE )); then
      printf 'ERROR: config does not use --confidential\n' >&2
      return 1
    fi
    if (( CFG_ENCRYPT_REQUESTED )); then
      printf 'ERROR: config does not use --encrypt\n' >&2
      return 1
    fi
    if (( CFG_VERIFY_ENCRYPTION )); then
      printf 'ERROR: config does not use --verify-encryption\n' >&2
      return 1
    fi
    if (( CFG_RESUME_MODE )); then
      printf 'ERROR: config does not use --resume\n' >&2
      return 1
    fi
    if (( CFG_MAX_PAGES_SET )); then
      printf 'ERROR: config does not use --max-pages\n' >&2
      return 1
    fi
    if (( CFG_MAX_DOWNLOAD_MIB_SET )); then
      printf 'ERROR: config does not use --max-download-mib\n' >&2
      return 1
    fi
    if (( CFG_SLEEP_MS_SET )); then
      printf 'ERROR: config does not use --sleep-ms\n' >&2
      return 1
    fi
    if (( CFG_MAX_FIND_CANDIDATES_SET )); then
      printf 'ERROR: config does not use --max-find-candidates\n' >&2
      return 1
    fi
    if (( CFG_INSTALL_DIR_SET )); then
      printf 'ERROR: config does not use --install-dir\n' >&2
      return 1
    fi
    if (( CFG_PAGE_FORMAT_SET )); then
      printf 'ERROR: config does not use --page-format\n' >&2
      return 1
    fi
    if (( CFG_ENCRYPTION_KEY_SET )) && [[ -z "$CFG_ENCRYPTION_KEY" ]]; then
      printf 'ERROR: --encryption-key requires a non-empty GPG key identity\n' >&2
      return 1
    fi
    if [[ "$CFG_ENCRYPTION_KEY" == *$'\t'* || "$CFG_ENCRYPTION_KEY" == *$'\n'* || "$CFG_ENCRYPTION_KEY" == *$'\r'* ]]; then
      printf 'ERROR: --encryption-key cannot contain TAB, LF, or CR\n' >&2
      return 1
    fi
    if (( CFG_ENCRYPTION_KEY_SET )) && [[ "$CFG_ENCRYPTION_KEY" == "none" ]]; then
      printf 'ERROR: --encryption-key cannot be the reserved value none\n' >&2
      return 1
    fi
    if (( CFG_ENCRYPTION_KEY_SET )) && (( CFG_CLEAR_ENCRYPTION_KEY )); then
      printf 'ERROR: config cannot combine --encryption-key with --clear-encryption-key\n' >&2
      return 1
    fi
    return 0
  fi

  if [[ -z "$CFG_ROOT_ID" ]]; then
    printf 'ERROR: --page-id is required\n' >&2
    return 1
  fi

  if (( CFG_INSTALL_DIR_SET )); then
    printf 'ERROR: export and plan do not use --install-dir\n' >&2
    return 1
  fi

  if (( CFG_OUT_DIR_SET )) && [[ -z "$CFG_OUT_DIR" ]]; then
    printf 'ERROR: --out requires a non-empty directory\n' >&2
    return 1
  fi

  if (( CFG_DRY_RUN )) && (( CFG_RESUME_MODE )); then
    printf 'ERROR: plan does not use --resume\n' >&2
    return 1
  fi

  if (( CFG_DRY_RUN_OPTION_SET )); then
    printf 'ERROR: --dry-run is not supported; use confluex plan\n' >&2
    return 1
  fi

  if [[ ! "$CFG_ROOT_ID" =~ ^[0-9]+$ ]]; then
    printf 'ERROR: --page-id must be numeric, got: %s\n' "$CFG_ROOT_ID" >&2
    return 1
  fi

  if [[ ! "$CFG_MAX_FIND_CANDIDATES" =~ ^[0-9]+$ ]] || (( CFG_MAX_FIND_CANDIDATES == 0 )); then
    printf 'ERROR: --max-find-candidates must be a positive integer, got: %s\n' "$CFG_MAX_FIND_CANDIDATES" >&2
    return 1
  fi

  if (( CFG_MAX_PAGES_SET )) && { [[ ! "$CFG_MAX_PAGES" =~ ^[0-9]+$ ]] || (( CFG_MAX_PAGES == 0 )); }; then
    printf 'ERROR: --max-pages must be a positive integer, got: %s\n' "$CFG_MAX_PAGES" >&2
    return 1
  fi

  if (( CFG_MAX_DOWNLOAD_MIB_SET )) && { [[ ! "$CFG_MAX_DOWNLOAD_MIB" =~ ^[0-9]+$ ]] || (( CFG_MAX_DOWNLOAD_MIB == 0 )); }; then
    printf 'ERROR: --max-download-mib must be a positive integer, got: %s\n' "$CFG_MAX_DOWNLOAD_MIB" >&2
    return 1
  fi

  if [[ ! "$CFG_SLEEP_MS" =~ ^[0-9]+$ ]]; then
    printf 'ERROR: --sleep-ms must be a non-negative integer, got: %s\n' "$CFG_SLEEP_MS" >&2
    return 1
  fi

  if (( CFG_LOG_FILE_SET )) && [[ -z "$CFG_LOG_FILE" ]]; then
    printf 'ERROR: --log-file requires a non-empty file path\n' >&2
    return 1
  fi

  if (( CFG_ENCRYPTION_KEY_SET )) && [[ -z "$CFG_ENCRYPTION_KEY" ]]; then
    printf 'ERROR: --encryption-key requires a non-empty GPG key identity\n' >&2
    return 1
  fi

  if [[ "$CFG_ENCRYPTION_KEY" == *$'\t'* || "$CFG_ENCRYPTION_KEY" == *$'\n'* || "$CFG_ENCRYPTION_KEY" == *$'\r'* ]]; then
    printf 'ERROR: --encryption-key cannot contain TAB, LF, or CR\n' >&2
    return 1
  fi

  if (( CFG_ENCRYPTION_KEY_SET )) && [[ "$CFG_ENCRYPTION_KEY" == "none" ]]; then
    printf 'ERROR: --encryption-key cannot be the reserved value none\n' >&2
    return 1
  fi

  if (( CFG_CLEAR_ENCRYPTION_KEY )); then
    printf 'ERROR: --clear-encryption-key is only valid with confluex config\n' >&2
    return 1
  fi

  if (( CFG_VERIFY_ENCRYPTION )); then
    printf 'ERROR: --verify-encryption is only valid with confluex doctor\n' >&2
    return 1
  fi

  if (( CFG_PAGE_FORMAT_SET )) && [[ "$CFG_COMMAND" != "export" ]]; then
    printf 'ERROR: --page-format is only valid with confluex export\n' >&2
    return 1
  fi

  if (( CFG_PAGE_FORMAT_SET )) && [[ "$CFG_PAGE_FORMAT" != "md" && "$CFG_PAGE_FORMAT" != "html" ]]; then
    printf 'ERROR: --page-format must be one of: md, html\n' >&2
    return 1
  fi

  if (( CFG_CONFIDENTIAL_MODE )); then
    CFG_ENCRYPT_REQUESTED=1
    CFG_CRITICAL_MODE=1
  fi

  if (( CFG_RESUME_MODE )) && [[ -z "$CFG_OUT_DIR" ]]; then
    printf 'ERROR: --resume requires an explicit --out directory\n' >&2
    return 1
  fi

  if (( CFG_CONFIDENTIAL_MODE )) && (( CFG_FAIL_FAST == 0 )); then
    printf 'ERROR: --confidential cannot be combined with --no-fail-fast\n' >&2
    return 1
  fi

  if (( CFG_CRITICAL_MODE )) && (( CFG_FAIL_FAST == 0 )); then
    printf 'ERROR: --critical cannot be combined with --no-fail-fast\n' >&2
    return 1
  fi

  if (( CFG_CRITICAL_MODE )); then
    CFG_SAFE_MODE=1
  fi

  if (( CFG_SAFE_MODE )); then
    if (( CFG_MAX_FIND_CANDIDATES_SET == 0 )); then
      CFG_MAX_FIND_CANDIDATES=5
    fi
    if (( CFG_MAX_PAGES_SET == 0 )); then
      CFG_MAX_PAGES=200
    fi
    if (( CFG_MAX_DOWNLOAD_MIB_SET == 0 )); then
      CFG_MAX_DOWNLOAD_MIB=256
    fi
    if (( CFG_SLEEP_MS_SET == 0 )); then
      CFG_SLEEP_MS=200
    fi
  fi

  if (( CFG_OUT_DIR_SET )); then
    CFG_OUT_DIR="$(confluex_normalize_logical_path "$CFG_OUT_DIR")" || {
      printf 'ERROR: --out requires a valid directory path\n' >&2
      return 1
    }
  fi

  if (( CFG_LOG_FILE_SET )); then
    CFG_LOG_FILE="$(confluex_normalize_logical_path "$CFG_LOG_FILE")" || {
      printf 'ERROR: --log-file requires a valid file path\n' >&2
      return 1
    }
  fi

  if (( CFG_INSTALL_DIR_SET )); then
    CFG_INSTALL_DIR="$(confluex_normalize_logical_path "$CFG_INSTALL_DIR")" || {
      printf 'ERROR: --install-dir requires a valid directory path\n' >&2
      return 1
    }
  fi

  return 0
}
