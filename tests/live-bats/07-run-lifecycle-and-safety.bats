#!/usr/bin/env bats

source "${BATS_TEST_DIRNAME}/helpers/live_confluex_helper.bash"

setup() {
  bats_require_minimum_version 1.5.0

  if [[ -z "${CONFLUEX_LIVE_IDENTITY_FILE:-}" || -z "${CONFLUEX_LIVE_CLI_HOME:-}" || -z "${CONFLUEX_LIVE_REPORT_ROOT:-}" ]]; then
    skip "run lifecycle regression requires identities, CLI home, and report root"
  fi

  export ROOT_PAGE_ID
  export LINKED_PAGE_ID
  export DOWNLOAD_LIMIT_PAGE_ID
  ROOT_PAGE_ID="$(node -e 'const fs=require("fs"); const data=JSON.parse(fs.readFileSync(process.env.CONFLUEX_LIVE_IDENTITY_FILE,"utf8")); process.stdout.write(String(data.root_page.page_id));')"
  LINKED_PAGE_ID="$(node -e 'const fs=require("fs"); const data=JSON.parse(fs.readFileSync(process.env.CONFLUEX_LIVE_IDENTITY_FILE,"utf8")); process.stdout.write(String(data.linked_page.page_id));')"
  DOWNLOAD_LIMIT_PAGE_ID="$(node -e 'const fs=require("fs"); const data=JSON.parse(fs.readFileSync(process.env.CONFLUEX_LIVE_IDENTITY_FILE,"utf8")); process.stdout.write(String(data.download_limit_root_page.page_id));')"
  export LIVE_MODE_TMP_ROOT
  LIVE_MODE_TMP_ROOT="$(mktemp -d)"
}

teardown() {
  rm -rf "$LIVE_MODE_TMP_ROOT"
}

run_live_workflow() {
  run --keep-empty-lines --separate-stderr env HOME="$CONFLUEX_LIVE_CLI_HOME" "$LIVE_CONFLUEX_REPO_ROOT/confluex" "$@"
  output="${output%$'\n'}"
  stderr="${stderr%$'\n'}"
}

summary_value() {
  local summary_path="$1"
  local key="$2"
  node -e '
const fs = require("fs");
const summary = Object.fromEntries(
  fs.readFileSync(process.argv[1], "utf8")
    .trim()
    .split("\n")
    .map((line) => {
      const idx = line.indexOf("=");
      return [line.slice(0, idx), line.slice(idx + 1)];
    })
);
process.stdout.write(summary[process.argv[2]] ?? "");
	' "$summary_path" "$key"
}

assert_summary_decimal_at_least() {
  local summary_path="$1"
  local key="$2"
  local minimum="$3"

  node -e '
const fs = require("fs");
const summary = Object.fromEntries(
  fs.readFileSync(process.argv[1], "utf8")
    .trim()
    .split("\n")
    .map((line) => {
      const idx = line.indexOf("=");
      return [line.slice(0, idx), line.slice(idx + 1)];
    })
);
const key = process.argv[2];
const minimum = Number(process.argv[3]);
const actual = Number(summary[key]);
if (!Number.isFinite(actual) || actual < minimum) {
  console.error(`${key}:${summary[key]}<${minimum.toFixed(3)}`);
  process.exit(1);
}
  ' "$summary_path" "$key" "$minimum"
}

tsv_data_row_count() {
  local tsv_path="$1"
  if [[ ! -f "$tsv_path" ]]; then
    printf '0\n'
    return 0
  fi
  awk 'END { print (NR > 0 ? NR - 1 : 0) }' "$tsv_path"
}

assert_partial_report_layout() {
  local report_root="$1"
  local command="$2"
  local required=""

  for required in manifest.tsv resolved-links.tsv unresolved-links.tsv failed-pages.tsv scope-findings.tsv summary.txt INCOMPLETE; do
    [[ -e "$report_root/$required" ]] || live_fail_test "$command partial missing $required"
  done
  if [[ "$command" == "export" ]]; then
    [[ -d "$report_root/pages" ]] || live_fail_test "export partial missing pages/"
  fi
}

wait_for_manifest_rows() {
  local manifest_path="$1"
  local pid="$2"
  local label="$3"
  local attempts=240
  local rows=0

  while (( attempts > 0 )); do
    rows="$(tsv_data_row_count "$manifest_path")"
    if (( rows > 0 )); then
      return 0
    fi
    if ! kill -0 "$pid" 2>/dev/null; then
      live_fail_test "$label exited before writing any manifest row"
      return 1
    fi
    attempts=$((attempts - 1))
    sleep 0.25
  done

  live_fail_test "$label did not write a manifest row before timeout"
}

wait_for_report_file() {
  local report_path="$1"
  local pid="$2"
  local label="$3"
  local attempts=240

  while (( attempts > 0 )); do
    if [[ -f "$report_path" ]]; then
      return 0
    fi
    if ! kill -0 "$pid" 2>/dev/null; then
      live_fail_test "$label exited before creating $report_path"
      return 1
    fi
    attempts=$((attempts - 1))
    sleep 0.25
  done

  live_fail_test "$label did not create $report_path before timeout"
}

interrupt_process_tree() {
  local pid="$1"
  local child=""

  while IFS= read -r child; do
    [[ -n "$child" ]] || continue
    kill -TERM "$child" 2>/dev/null || true
  done < <(pgrep -P "$pid" 2>/dev/null || true)
  kill -TERM "$pid"
}

@test "accepted export and plan runs emit the docs-defined RUN_START, RUN_PHASE, and RUN_COMPLETE lifecycle lines" {
  local export_out="$LIVE_MODE_TMP_ROOT/lifecycle-export"
  local plan_out="$LIVE_MODE_TMP_ROOT/lifecycle-plan"
  local expected=""

  run_live_workflow export --page-id "$LINKED_PAGE_ID" --out "$export_out" --safe
  [ "$status" -eq 0 ] || live_fail_test "export lifecycle run exited $status"
  live_assert_equal "" "$stderr" "export lifecycle stderr"
  expected="$(cat <<EOF
RUN_START command=export page_id=${LINKED_PAGE_ID} output_root="${export_out}"
RUN_PHASE phase=scope_discovery
RUN_PHASE phase=page_processing
RUN_PHASE phase=report_generation
RUN_COMPLETE final_status=success artifact="${export_out}"
EOF
)"
  live_assert_equal "$expected" "$output" "export lifecycle stdout"

  run_live_workflow plan --page-id "$LINKED_PAGE_ID" --out "$plan_out" --safe
  [ "$status" -eq 0 ] || live_fail_test "plan lifecycle run exited $status"
  live_assert_equal "" "$stderr" "plan lifecycle stderr"
  expected="$(cat <<EOF
RUN_START command=plan page_id=${LINKED_PAGE_ID} output_root="${plan_out}"
RUN_PHASE phase=scope_discovery
RUN_PHASE phase=page_processing
RUN_PHASE phase=report_generation
RUN_COMPLETE final_status=success artifact="${plan_out}"
EOF
)"
  live_assert_equal "$expected" "$output" "plan lifecycle stdout"
}

@test "unbounded non-safe runs warn on stderr while safe or bounded runs suppress the warning" {
  local unbounded_plan="$LIVE_MODE_TMP_ROOT/unbounded-plan"
  local unbounded_export="$LIVE_MODE_TMP_ROOT/unbounded-export"
  local bounded_export="$LIVE_MODE_TMP_ROOT/bounded-export"
  local safe_plan="$LIVE_MODE_TMP_ROOT/safe-plan"

  run_live_workflow plan --page-id "$LINKED_PAGE_ID" --out "$unbounded_plan"
  [ "$status" -eq 0 ] || live_fail_test "unbounded plan exited $status"
  [[ "$output" == *'RUN_START command=plan'* ]] || live_fail_test "unbounded plan stdout missing RUN_START"
  [[ "$output" == *'RUN_COMPLETE final_status=success artifact='* ]] || live_fail_test "unbounded plan stdout missing RUN_COMPLETE"
  [[ "$output" != *'WARNING: '* ]] || live_fail_test "unbounded plan wrote warning to stdout"
  [[ "$stderr" == WARNING:\ * ]] || live_fail_test "unbounded plan stderr missing WARNING prefix"
  [[ "$stderr" == *'--safe'* || "$stderr" == *'--max-pages'* || "$stderr" == *'--max-download-mib'* ]] || \
    live_fail_test "unbounded plan stderr missing documented bounded-run guidance"

  run_live_workflow export --page-id "$LINKED_PAGE_ID" --out "$unbounded_export"
  [ "$status" -eq 0 ] || live_fail_test "unbounded export exited $status"
  [[ "$output" == *'RUN_START command=export'* ]] || live_fail_test "unbounded export stdout missing RUN_START"
  [[ "$output" == *'RUN_COMPLETE final_status=success artifact='* ]] || live_fail_test "unbounded export stdout missing RUN_COMPLETE"
  [[ "$output" != *'WARNING: '* ]] || live_fail_test "unbounded export wrote warning to stdout"
  [[ "$stderr" == WARNING:\ * ]] || live_fail_test "unbounded export stderr missing WARNING prefix"
  [[ "$stderr" == *'--safe'* || "$stderr" == *'--max-pages'* || "$stderr" == *'--max-download-mib'* ]] || \
    live_fail_test "unbounded export stderr missing documented bounded-run guidance"

  run_live_workflow export --page-id "$LINKED_PAGE_ID" --out "$bounded_export" --max-pages 10
  [ "$status" -eq 0 ] || live_fail_test "bounded export exited $status"
  [[ "$stderr" != WARNING:\ * ]] || live_fail_test "bounded export still warned"

  run_live_workflow plan --page-id "$LINKED_PAGE_ID" --out "$safe_plan" --safe
  [ "$status" -eq 0 ] || live_fail_test "safe plan exited $status"
  [[ "$stderr" != WARNING:\ * ]] || live_fail_test "safe plan still warned"
}

@test "critical mode yields policy_failed on completed runs with findings and preserves success on clean runs" {
  local critical_dirty="$LIVE_MODE_TMP_ROOT/critical-root"
  local critical_clean="$LIVE_MODE_TMP_ROOT/critical-linked"

  run_live_workflow export --page-id "$ROOT_PAGE_ID" --out "$critical_dirty" --critical
  [ "$status" -eq 2 ] || live_fail_test "critical run with findings exited $status"
  live_assert_equal "policy_failed" "$(summary_value "$critical_dirty/summary.txt" final_status)" "critical dirty final_status"
  live_assert_equal "degraded" "$(summary_value "$critical_dirty/summary.txt" scope_trust)" "critical dirty scope_trust"
  live_assert_equal "unresolved_links,scope_findings" "$(summary_value "$critical_dirty/summary.txt" blocking_reasons)" "critical dirty blocking_reasons"
  [[ "$stderr" != *'effectively unbounded'* ]] || live_fail_test "critical dirty run unexpectedly warned as unbounded"

  run_live_workflow export --page-id "$LINKED_PAGE_ID" --out "$critical_clean" --critical
  [ "$status" -eq 0 ] || live_fail_test "critical clean run exited $status"
  live_assert_equal "success" "$(summary_value "$critical_clean/summary.txt" final_status)" "critical clean final_status"
  live_assert_equal "none" "$(summary_value "$critical_clean/summary.txt" blocking_reasons)" "critical clean blocking_reasons"
  live_assert_equal "trusted" "$(summary_value "$critical_clean/summary.txt" scope_trust)" "critical clean scope_trust"
  [[ "$stderr" != *'effectively unbounded'* ]] || live_fail_test "critical clean run unexpectedly warned as unbounded"
}

@test "configured stop conditions retain inspectable incomplete results and exit 3" {
  local export_out="$LIVE_MODE_TMP_ROOT/limited-export"
  local plan_out="$LIVE_MODE_TMP_ROOT/limited-plan"
  local download_export_out="$LIVE_MODE_TMP_ROOT/download-limited-export"
  local download_plan_out="$LIVE_MODE_TMP_ROOT/download-limited-plan"
  local precedence_out="$LIVE_MODE_TMP_ROOT/download-and-page-limited-plan"
  local download_export_processed=""
  local download_plan_processed=""

  run_live_workflow export --page-id "$ROOT_PAGE_ID" --out "$export_out" --max-pages 1
  [ "$status" -eq 3 ] || live_fail_test "max-pages export exited $status"
  live_assert_equal "incomplete" "$(summary_value "$export_out/summary.txt" final_status)" "limited export final_status"
  live_assert_equal "degraded" "$(summary_value "$export_out/summary.txt" scope_trust)" "limited export scope_trust"
  live_assert_equal "max_pages_limit_reached" "$(summary_value "$export_out/summary.txt" interrupt_reason)" "limited export interrupt_reason"
  assert_partial_report_layout "$export_out" export

  run_live_workflow plan --page-id "$ROOT_PAGE_ID" --out "$plan_out" --max-pages 1
  [ "$status" -eq 3 ] || live_fail_test "max-pages plan exited $status"
  live_assert_equal "incomplete" "$(summary_value "$plan_out/summary.txt" final_status)" "limited plan final_status"
  live_assert_equal "degraded" "$(summary_value "$plan_out/summary.txt" scope_trust)" "limited plan scope_trust"
  live_assert_equal "max_pages_limit_reached" "$(summary_value "$plan_out/summary.txt" interrupt_reason)" "limited plan interrupt_reason"
  assert_partial_report_layout "$plan_out" plan

  run_live_workflow export --page-id "$DOWNLOAD_LIMIT_PAGE_ID" --out "$download_export_out" --max-download-mib 1
  [ "$status" -eq 3 ] || live_fail_test "max-download export exited $status: $output $stderr"
  live_assert_equal "incomplete" "$(summary_value "$download_export_out/summary.txt" final_status)" "download-limited export final_status"
  live_assert_equal "max_download_limit_reached" "$(summary_value "$download_export_out/summary.txt" interrupt_reason)" "download-limited export interrupt_reason"
  assert_partial_report_layout "$download_export_out" export
  download_export_processed="$(summary_value "$download_export_out/summary.txt" processed_pages)"
  [[ "$download_export_processed" =~ ^[0-9]+$ ]] || live_fail_test "download-limited export processed_pages is not numeric: $download_export_processed"
  (( download_export_processed >= 2 )) || live_fail_test "download-limited export stopped before cumulative data was proven: $download_export_processed"
  assert_summary_decimal_at_least "$download_export_out/summary.txt" downloaded_mib_total 1

  run_live_workflow plan --page-id "$DOWNLOAD_LIMIT_PAGE_ID" --out "$download_plan_out" --max-download-mib 1
  [ "$status" -eq 3 ] || live_fail_test "max-download plan exited $status: $output $stderr"
  live_assert_equal "incomplete" "$(summary_value "$download_plan_out/summary.txt" final_status)" "download-limited plan final_status"
  live_assert_equal "max_download_limit_reached" "$(summary_value "$download_plan_out/summary.txt" interrupt_reason)" "download-limited plan interrupt_reason"
  assert_partial_report_layout "$download_plan_out" plan
  download_plan_processed="$(summary_value "$download_plan_out/summary.txt" processed_pages)"
  [[ "$download_plan_processed" =~ ^[0-9]+$ ]] || live_fail_test "download-limited plan processed_pages is not numeric: $download_plan_processed"
  (( download_plan_processed >= 2 )) || live_fail_test "download-limited plan stopped before cumulative data was proven: $download_plan_processed"
  assert_summary_decimal_at_least "$download_plan_out/summary.txt" downloaded_mib_total 1

  run_live_workflow plan --page-id "$DOWNLOAD_LIMIT_PAGE_ID" --out "$precedence_out" --max-pages "$download_plan_processed" --max-download-mib 1
  [ "$status" -eq 3 ] || live_fail_test "combined limit plan exited $status: $output $stderr"
  live_assert_equal "max_pages_limit_reached" "$(summary_value "$precedence_out/summary.txt" interrupt_reason)" "combined limit precedence interrupt_reason"
}

@test "signal interruption retains export partials and removes plan partials" {
  local export_out="$LIVE_MODE_TMP_ROOT/interrupted-export"
  local plan_out="$LIVE_MODE_TMP_ROOT/interrupted-plan"
  local export_stdout="$LIVE_MODE_TMP_ROOT/interrupted-export.stdout"
  local export_stderr="$LIVE_MODE_TMP_ROOT/interrupted-export.stderr"
  local plan_stdout="$LIVE_MODE_TMP_ROOT/interrupted-plan.stdout"
  local plan_stderr="$LIVE_MODE_TMP_ROOT/interrupted-plan.stderr"
  local export_pid=""
  local plan_pid=""
  local export_status=0
  local plan_status=0

  env HOME="$CONFLUEX_LIVE_CLI_HOME" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    export \
    --page-id "$ROOT_PAGE_ID" \
    --out "$export_out" \
    --safe \
    --sleep-ms 60000 \
    >"$export_stdout" 2>"$export_stderr" &
  export_pid="$!"
  wait_for_report_file "$export_out/manifest.tsv" "$export_pid" "interrupted export"
  interrupt_process_tree "$export_pid"
  set +e
  wait "$export_pid"
  export_status="$?"
  set -e

  [ "$export_status" -eq 130 ] || live_fail_test "interrupted export exited $export_status: $(cat "$export_stdout") $(cat "$export_stderr")"
  [[ -d "$export_out" ]] || live_fail_test "interrupted export did not retain output root"
  [[ -f "$export_out/INCOMPLETE" ]] || live_fail_test "interrupted export marker missing"
  live_assert_equal "interrupted" "$(summary_value "$export_out/summary.txt" final_status)" "interrupted export final_status"
  live_assert_equal "signal_interrupt" "$(summary_value "$export_out/summary.txt" interrupt_reason)" "interrupted export interrupt_reason"
  [[ "$(cat "$export_stdout")" == *"RUN_COMPLETE final_status=interrupted artifact=\"${export_out}\""* ]] ||
    live_fail_test "interrupted export stdout missing RUN_COMPLETE: $(cat "$export_stdout")"

  env HOME="$CONFLUEX_LIVE_CLI_HOME" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    plan \
    --page-id "$ROOT_PAGE_ID" \
    --out "$plan_out" \
    --safe \
    --sleep-ms 60000 \
    >"$plan_stdout" 2>"$plan_stderr" &
  plan_pid="$!"
  wait_for_report_file "$plan_out/manifest.tsv" "$plan_pid" "interrupted plan"
  interrupt_process_tree "$plan_pid"
  set +e
  wait "$plan_pid"
  plan_status="$?"
  set -e

  [ "$plan_status" -eq 130 ] || live_fail_test "interrupted plan exited $plan_status: $(cat "$plan_stdout") $(cat "$plan_stderr")"
  [[ ! -e "$plan_out" ]] || live_fail_test "interrupted plan retained misleading output root"
  [[ "$(cat "$plan_stdout")" == *'RUN_COMPLETE final_status=interrupted artifact=none'* ]] ||
    live_fail_test "interrupted plan stdout missing RUN_COMPLETE: $(cat "$plan_stdout")"
}

@test "generated output roots identify the workflow and resolved root page" {
  local plan_generated_root=""
  local plan_generated_basename=""
  local export_generated_root=""
  local export_generated_basename=""
  local workdir="$LIVE_MODE_TMP_ROOT/generated-root"
  mkdir -p "$workdir"

  run env HOME="$CONFLUEX_LIVE_CLI_HOME" bash -lc "cd '$workdir' && '$LIVE_CONFLUEX_REPO_ROOT/confluex' plan --page-id '$LINKED_PAGE_ID' --safe"
  output="${output%$'\n'}"
  stderr="${stderr%$'\n'}"
  [ "$status" -eq 0 ] || live_fail_test "generated-root plan exited $status"
  plan_generated_root="$(printf '%s\n' "$output" | awk -F'output_root=' '/^RUN_START / { print $2 }' | sed 's/^"//; s/"$//')"
  [[ -n "$plan_generated_root" ]] || live_fail_test "generated-root plan RUN_START missing output_root"
  plan_generated_basename="$(basename "$plan_generated_root")"
  [[ "$plan_generated_root" == "$workdir"/confluence_plan_* ]] || live_fail_test "generated-root plan path not under cwd: $plan_generated_root"
  [[ "$plan_generated_basename" =~ ^confluence_plan_${LINKED_PAGE_ID}_[0-9]{8}T[0-9]{6}Z(_[1-9][0-9]*)?$ ]] || live_fail_test "generated-root plan basename mismatch: $plan_generated_basename"
  [[ -d "$plan_generated_root" ]] || live_fail_test "generated-root plan directory missing: $plan_generated_root"
  live_assert_equal "generated" "$(summary_value "$plan_generated_root/summary.txt" output_path_provenance)" "generated-root plan provenance"

  run env HOME="$CONFLUEX_LIVE_CLI_HOME" bash -lc "cd '$workdir' && '$LIVE_CONFLUEX_REPO_ROOT/confluex' export --page-id '$LINKED_PAGE_ID' --safe"
  output="${output%$'\n'}"
  stderr="${stderr%$'\n'}"
  [ "$status" -eq 0 ] || live_fail_test "generated-root export exited $status"
  export_generated_root="$(printf '%s\n' "$output" | awk -F'output_root=' '/^RUN_START / { print $2 }' | sed 's/^"//; s/"$//')"
  [[ -n "$export_generated_root" ]] || live_fail_test "generated-root export RUN_START missing output_root"
  export_generated_basename="$(basename "$export_generated_root")"
  [[ "$export_generated_root" == "$workdir"/confluence_dump_* ]] || live_fail_test "generated-root export path not under cwd: $export_generated_root"
  [[ "$export_generated_basename" =~ ^confluence_dump_${LINKED_PAGE_ID}_[0-9]{8}T[0-9]{6}Z(_[1-9][0-9]*)?$ ]] || live_fail_test "generated-root export basename mismatch: $export_generated_basename"
  [[ -d "$export_generated_root" ]] || live_fail_test "generated-root export directory missing: $export_generated_root"
  live_assert_equal "generated" "$(summary_value "$export_generated_root/summary.txt" output_path_provenance)" "generated-root export provenance"
}
