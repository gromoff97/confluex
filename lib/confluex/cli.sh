#!/usr/bin/env bash

confluex_usage() {
  cat <<'USAGE'
Usage:
  confluex export --page-id <id> [OPTIONS]
  confluex plan --page-id <id> [OPTIONS]
  confluex doctor [--page-id <id>]
  confluex config [--encryption-key KEY | --clear-encryption-key]
  confluex install [--install-dir DIR]
  confluex uninstall [--install-dir DIR]

What it does:
  - walks the full child tree of <page_id>
  - exports every page with attachments
  - parses storage XML on every page
  - follows links to other Confluence pages and exports them too
  - writes reports, and persistent logs only if requested

Options:
  --page-id ID       Root Confluence page id to export.
  --safe             Conservative profile for production usage.
                     Defaults: --max-find-candidates 5 --max-pages 200
                     --max-download-mib 256 --sleep-ms 200
                     This reduces risk; it is not a correctness guarantee.
  --critical         Fail-closed mode for critical usage.
                     Implies --safe, forbids --no-fail-fast, and fails the run if
                     unresolved links, scope findings, recorded page-local failures,
                     or incomplete stop conditions remain in the final result.
  --confidential     Confidentiality-first mode for encrypted runs.
                     Implies --critical and requires an effective encryption key.
                     If encryption fails, plain run artifacts are removed instead
                     of being left on disk for recovery.
  --resume           Only for `confluex export`: continue from an existing explicit
                     output directory and reuse previously completed page payloads
                     when possible instead of redownloading them.
  --dry-run          Do not export page HTML or download attachments.
                     Still reads page metadata and storage XML to build the full plan.
  --out DIR          Output directory. Default is generated automatically.
  --no-fail-fast     Continue on runtime errors (best-effort export).
  --keep-metadata    Persist page metadata files such as _info.txt and _storage.xml.
  --log-file FILE    Write a persistent log file. By default logs go only to stderr.
  --encryption-key KEY
                     Encrypt the final output as <out>.tar.gz.gpg for GPG key identity KEY.
                     KEY may be a fingerprint, long key id, or other GPG recipient specifier.
                     Recommended: use a full fingerprint. If a default key is saved via
                     `confluex config`, this option overrides it for the current run.
  --verify-encryption
                     Only for `confluex doctor`: validate that the effective or explicit
                     encryption recipient is available in the local GPG keyring.
  --clear-encryption-key
                     Only for `confluex config`: remove the saved default encryption key.
  --max-pages N      Stop after N processed pages.
  --max-download-mib N
                     Stop after downloading N MiB in total.
  --sleep-ms N       Sleep N ms between processed pages.
  --max-find-candidates N
                     Maximum number of `confluence find` candidates to inspect per title link.
                     Default: 10.
  --install-dir DIR  Custom install directory (default: ~/.local/bin).
  -h, --help         Show this help.

Examples:
  confluex plan --page-id 12345
  confluex export --page-id 12345 --out ./dump --safe
  confluex export --page-id 12345 --out ./dump --critical
  confluex export --page-id 12345 --out ./dump --resume
  confluex config --encryption-key 0123456789ABCDEF0123456789ABCDEF01234567
  confluex export --page-id 12345 --out ./dump
  confluex export --page-id 12345 --out ./dump --encryption-key 89ABCDEF0123456789ABCDEF0123456789ABCDEF
  confluex export --page-id 12345 --out ./dump --confidential --encryption-key 89ABCDEF0123456789ABCDEF0123456789ABCDEF
  confluex doctor --page-id 12345 --verify-encryption --encryption-key 89ABCDEF0123456789ABCDEF0123456789ABCDEF
  confluex install
  confluex uninstall

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
    --encrypt|--encrypt-recipient|--encrypt_to|--recipient|--encrypt-for|--encrypt-for=*|--encryption)
      printf '%s\n' "--encryption-key"
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

confluex_uninstall() {
  local install_dir="$CFG_INSTALL_DIR"
  local install_script="$install_dir/confluex"
  local install_lib_dir
  local removed_any=0
  install_lib_dir="$(confluex_default_install_lib_dir "$install_dir")"

  if [[ -f "$install_script" ]]; then
    rm -f "$install_script"
    printf 'Removed %s\n' "$install_script"
    removed_any=1
  fi

  if [[ -d "$install_lib_dir" ]]; then
    rm -rf "$install_lib_dir"
    printf 'Removed %s\n' "$install_lib_dir"
    removed_any=1
  fi

  if (( removed_any == 0 )); then
    printf 'Nothing to uninstall from %s\n' "$install_dir"
  fi
}

confluex_parse_args() {
  # shellcheck disable=SC2034
  CFG_DRY_RUN=0
  CFG_COMMAND=""
  CFG_OUT_DIR=""
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
      printf 'ERROR: missing command\n' >&2
      return 1
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
      --resume)
        CFG_RESUME_MODE=1
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
    if (( CFG_RESUME_MODE )); then
      printf 'ERROR: doctor does not use --resume\n' >&2
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
    if (( CFG_ENCRYPTION_KEY_SET )) && [[ -z "$CFG_ENCRYPTION_KEY" ]]; then
      printf 'ERROR: --encryption-key requires a non-empty GPG key identity\n' >&2
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

  if (( CFG_DRY_RUN )) && (( CFG_RESUME_MODE )); then
    printf 'ERROR: plan does not use --resume\n' >&2
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

  if [[ ! "$CFG_MAX_PAGES" =~ ^[0-9]+$ ]]; then
    printf 'ERROR: --max-pages must be a non-negative integer, got: %s\n' "$CFG_MAX_PAGES" >&2
    return 1
  fi

  if [[ ! "$CFG_MAX_DOWNLOAD_MIB" =~ ^[0-9]+$ ]]; then
    printf 'ERROR: --max-download-mib must be a non-negative integer, got: %s\n' "$CFG_MAX_DOWNLOAD_MIB" >&2
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

  if (( CFG_CLEAR_ENCRYPTION_KEY )); then
    printf 'ERROR: --clear-encryption-key is only valid with confluex config\n' >&2
    return 1
  fi

  if (( CFG_VERIFY_ENCRYPTION )); then
    printf 'ERROR: --verify-encryption is only valid with confluex doctor\n' >&2
    return 1
  fi

  if (( CFG_CONFIDENTIAL_MODE )); then
    CFG_CRITICAL_MODE=1
  fi

  if (( CFG_RESUME_MODE )) && [[ -z "$CFG_OUT_DIR" ]]; then
    printf 'ERROR: --resume requires an explicit --out directory\n' >&2
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

  return 0
}
