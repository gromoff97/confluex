#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFLUEX_BIN="$ROOT_DIR/confluex"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/confluex-smoke.XXXXXX")"
MOCK_BIN_DIR="$TEST_ROOT/mock-bin"
WORK_DIR="$TEST_ROOT/work"

cleanup() {
  rm -rf "$TEST_ROOT"
}

trap cleanup EXIT

mkdir -p "$MOCK_BIN_DIR" "$WORK_DIR"

cat > "$MOCK_BIN_DIR/confluence" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

cmd="${1:-}"
shift || true

case "$cmd" in
  info)
    page_id="${1:-}"
    case "$page_id" in
      100)
        cat <<'INFO'
ID: 100
Title: Root Page
Space Key: ENG
URL: https://example.invalid/spaces/ENG/pages/100
INFO
        ;;
      200)
        cat <<'INFO'
ID: 200
Title: Child Page
Space Key: ENG
URL: https://example.invalid/spaces/ENG/pages/200
INFO
        ;;
      300)
        cat <<'INFO'
ID: 300
Title: Linked Page
Space Key: ENG
URL: https://example.invalid/spaces/ENG/pages/300
INFO
        ;;
      *)
        exit 1
        ;;
    esac
    ;;
  children)
    cat <<'JSON'
{"results":[{"id":"200","title":"Child Page","children":[]}]}
JSON
    ;;
  edit)
    page_id="${1:-}"
    shift
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
    case "$page_id" in
      100)
        cat > "$output" <<'XML'
<ac:link><ri:page ri:space-key="ENG" ri:content-title="Linked Page" /></ac:link>
XML
        ;;
      200)
        cat > "$output" <<'XML'
<p>child</p>
XML
        ;;
      300)
        cat > "$output" <<'XML'
<p>linked</p>
XML
        ;;
      *)
        exit 1
        ;;
    esac
    ;;
  attachments)
    printf 'readme.txt\n'
    ;;
  find)
    title="${1:-}"
    if [[ "$title" == "Linked Page" ]]; then
      printf 'ID: 300\n'
      exit 0
    fi
    exit 1
    ;;
  export)
    page_id="${1:-}"
    shift
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
    mkdir -p "$dest/$attachments_dir"
    printf '<html><body>page %s</body></html>\n' "$page_id" > "$dest/$file_name"
    printf 'attachment for %s\n' "$page_id" > "$dest/$attachments_dir/readme.txt"
    ;;
  *)
    exit 1
    ;;
esac
EOF

chmod 755 "$MOCK_BIN_DIR/confluence"

export PATH="$MOCK_BIN_DIR:$PATH"

assert_file_exists() {
  local path="$1"
  [[ -f "$path" ]] || {
    printf 'ASSERT FAILED: expected file to exist: %s\n' "$path" >&2
    exit 1
  }
}

assert_file_missing() {
  local path="$1"
  [[ ! -e "$path" ]] || {
    printf 'ASSERT FAILED: expected path to be absent: %s\n' "$path" >&2
    exit 1
  }
}

assert_contains() {
  local needle="$1"
  local file="$2"
  grep -F -- "$needle" "$file" >/dev/null 2>&1 || {
    printf 'ASSERT FAILED: expected "%s" in %s\n' "$needle" "$file" >&2
    exit 1
  }
}

run_cmd() {
  local log_file="$1"
  shift
  (
    cd "$WORK_DIR"
    "$@"
  ) >"$log_file" 2>&1
}

test_unknown_option_suggestion() {
  local log_file="$TEST_ROOT/unknown.log"
  if run_cmd "$log_file" "$CONFLUEX_BIN" --pageid 100; then
    printf 'ASSERT FAILED: unknown option test should fail\n' >&2
    exit 1
  fi
  assert_contains 'Did you mean: --page-id ?' "$log_file"
}

test_install_conflict_rejected() {
  local log_file="$TEST_ROOT/install-conflict.log"
  if run_cmd "$log_file" "$CONFLUEX_BIN" --install --page-id 100; then
    printf 'ASSERT FAILED: install conflict test should fail\n' >&2
    exit 1
  fi
  assert_contains '--install cannot be combined with --page-id' "$log_file"
}

test_install_dir_requires_install() {
  local log_file="$TEST_ROOT/install-dir.log"
  if run_cmd "$log_file" "$CONFLUEX_BIN" --page-id 100 --install-dir /tmp/confluex-bin; then
    printf 'ASSERT FAILED: install-dir without install should fail\n' >&2
    exit 1
  fi
  assert_contains '--install-dir requires --install' "$log_file"
}

test_empty_log_file_rejected() {
  local log_file="$TEST_ROOT/empty-log-file.log"
  if run_cmd "$log_file" "$CONFLUEX_BIN" --page-id 100 --log-file=; then
    printf 'ASSERT FAILED: empty log-file should fail\n' >&2
    exit 1
  fi
  assert_contains '--log-file requires a non-empty file path' "$log_file"
}

test_dry_run_minimal_artifacts() {
  local out_dir="$WORK_DIR/dry-run-minimal"
  local log_file="$TEST_ROOT/dry-run-minimal.log"
  run_cmd "$log_file" "$CONFLUEX_BIN" --page-id 100 --dry-run --out "$out_dir"

  assert_file_exists "$out_dir/manifest.tsv"
  assert_file_exists "$out_dir/summary.txt"
  assert_file_missing "$out_dir/run.log"
  assert_file_missing "$out_dir/pages/ENG/Root_Page__100"
  assert_file_missing "$out_dir/pages/ENG/Root_Page__100/_info.txt"
  assert_file_missing "$out_dir/pages/ENG/Root_Page__100/_storage.xml"
  assert_file_missing "$out_dir/pages/ENG/Root_Page__100/_attachments_preview.txt"
}

test_dry_run_keep_metadata() {
  local out_dir="$WORK_DIR/dry-run-keep"
  local log_file="$TEST_ROOT/dry-run-keep.log"
  run_cmd "$log_file" "$CONFLUEX_BIN" --page-id 100 --dry-run --keep-metadata --out "$out_dir"

  assert_file_exists "$out_dir/pages/ENG/Root_Page__100/_info.txt"
  assert_file_exists "$out_dir/pages/ENG/Root_Page__100/_storage.xml"
  assert_file_exists "$out_dir/pages/ENG/Root_Page__100/_attachments_preview.txt"
}

test_log_file_opt_in() {
  local out_dir="$WORK_DIR/export-with-log"
  local explicit_log="$WORK_DIR/custom.log"
  local log_file="$TEST_ROOT/export-with-log.log"
  run_cmd "$log_file" "$CONFLUEX_BIN" --page-id 100 --out "$out_dir" --log-file "$explicit_log"

  assert_file_exists "$explicit_log"
  assert_contains 'starting' "$explicit_log"
}

test_export_downloads_html_and_attachment() {
  local out_dir="$WORK_DIR/export-basic"
  local log_file="$TEST_ROOT/export-basic.log"
  run_cmd "$log_file" "$CONFLUEX_BIN" --page-id 100 --out "$out_dir"

  assert_file_exists "$out_dir/pages/ENG/Root_Page__100/page.html"
  assert_file_exists "$out_dir/pages/ENG/Root_Page__100/attachments/readme.txt"
  assert_file_exists "$out_dir/pages/ENG/Linked_Page__300/page.html"
  assert_contains 'resolved_links=1' "$out_dir/summary.txt"
}

test_unknown_option_suggestion
test_install_conflict_rejected
test_install_dir_requires_install
test_empty_log_file_rejected
test_dry_run_minimal_artifacts
test_dry_run_keep_metadata
test_log_file_opt_in
test_export_downloads_html_and_attachment

printf 'Smoke tests passed.\n'
