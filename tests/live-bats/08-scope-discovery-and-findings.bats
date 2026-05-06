#!/usr/bin/env bats

source "${BATS_TEST_DIRNAME}/helpers/live_confluex_helper.bash"

setup() {
  bats_require_minimum_version 1.5.0

  if [[ -z "${CONFLUEX_LIVE_IDENTITY_FILE:-}" || -z "${CONFLUEX_LIVE_CLI_HOME:-}" || -z "${CONFLUEX_LIVE_REPORT_ROOT:-}" ]]; then
    skip "scope-discovery regression requires identities, CLI home, and report root"
  fi

  export LINKED_SCOPE_ROOT_PAGE_ID
  export AMBIGUOUS_ROOT_PAGE_ID
  export SCOPE_NOISE_ROOT_PAGE_ID
  LINKED_SCOPE_ROOT_PAGE_ID="$(node -e 'const fs=require("fs"); const data=JSON.parse(fs.readFileSync(process.env.CONFLUEX_LIVE_IDENTITY_FILE,"utf8")); process.stdout.write(String(data.linked_scope_root.page_id));')"
  AMBIGUOUS_ROOT_PAGE_ID="$(node -e 'const fs=require("fs"); const data=JSON.parse(fs.readFileSync(process.env.CONFLUEX_LIVE_IDENTITY_FILE,"utf8")); process.stdout.write(String(data.ambiguous_root_page.page_id));')"
  SCOPE_NOISE_ROOT_PAGE_ID="$(node -e 'const fs=require("fs"); const data=JSON.parse(fs.readFileSync(process.env.CONFLUEX_LIVE_IDENTITY_FILE,"utf8")); process.stdout.write(String(data.scope_noise_root.page_id));')"
  export LIVE_SCOPE_TMP_ROOT
  LIVE_SCOPE_TMP_ROOT="$(mktemp -d)"
}

teardown() {
  rm -rf "$LIVE_SCOPE_TMP_ROOT"
}

@test "linked-only pages do not add descendants or recurse through their own links" {
  local export_out="$LIVE_SCOPE_TMP_ROOT/single-hop-export"
  local plan_out="$LIVE_SCOPE_TMP_ROOT/single-hop-plan"

  run env HOME="$CONFLUEX_LIVE_CLI_HOME" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    export \
    --page-id "$LINKED_SCOPE_ROOT_PAGE_ID" \
    --out "$export_out"
  [ "$status" -eq 0 ] || live_fail_test "single-hop export exited $status"

  run env HOME="$CONFLUEX_LIVE_CLI_HOME" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    plan \
    --page-id "$LINKED_SCOPE_ROOT_PAGE_ID" \
    --out "$plan_out"
  [ "$status" -eq 0 ] || live_fail_test "single-hop plan exited $status"

  run node -e '
const fs = require("fs");
const path = require("path");
const exportRoot = process.argv[1];
const planRoot = process.argv[2];
const identities = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const includeIds = [
  String(identities.linked_scope_root.page_id),
  String(identities.linked_scope_linked_page.page_id)
];
const excludeIds = [
  String(identities.linked_scope_linked_descendant.page_id),
  String(identities.linked_scope_link_of_link.page_id)
];
const problems = [];

function manifestIds(reportRoot) {
  return fs.readFileSync(path.join(reportRoot, "manifest.tsv"), "utf8")
    .trimEnd()
    .split("\n")
    .slice(1)
    .map((line) => line.split("\t")[0]);
}

for (const [label, reportRoot] of [["export", exportRoot], ["plan", planRoot]]) {
  const ids = manifestIds(reportRoot);
  if (ids.length !== includeIds.length) {
    problems.push(`${label}:manifest_count:${ids.length}`);
  }
  for (const id of includeIds) {
    if (!ids.includes(id)) problems.push(`${label}:missing:${id}`);
  }
  for (const id of excludeIds) {
    if (ids.includes(id)) problems.push(`${label}:unexpected:${id}`);
  }
}

if (problems.length) {
  console.error(problems.join("\\n"));
  process.exit(1);
}
' "$export_out" "$plan_out" "$CONFLUEX_LIVE_IDENTITY_FILE"
  [ "$status" -eq 0 ] || live_fail_test "$output"
}

@test "ambiguous title links stay unresolved with not_unique and do not guess a target" {
  local export_out="$LIVE_SCOPE_TMP_ROOT/ambiguous-export"
  local plan_out="$LIVE_SCOPE_TMP_ROOT/ambiguous-plan"

  run env HOME="$CONFLUEX_LIVE_CLI_HOME" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    export \
    --page-id "$AMBIGUOUS_ROOT_PAGE_ID" \
    --out "$export_out"
  [ "$status" -eq 0 ] || live_fail_test "ambiguous export exited $status"

  run env HOME="$CONFLUEX_LIVE_CLI_HOME" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    plan \
    --page-id "$AMBIGUOUS_ROOT_PAGE_ID" \
    --out "$plan_out"
  [ "$status" -eq 0 ] || live_fail_test "ambiguous plan exited $status"

  run node -e '
const fs = require("fs");
const path = require("path");
const exportRoot = process.argv[1];
const planRoot = process.argv[2];
const identities = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const ambiguousId = String(identities.ambiguous_root_page.page_id);
const duplicateIds = [
  String(identities.duplicate_title_primary.page_id),
  String(identities.duplicate_title_secondary.page_id)
];
const problems = [];

function readSummary(reportRoot) {
  return Object.fromEntries(
    fs.readFileSync(path.join(reportRoot, "summary.txt"), "utf8")
      .trim()
      .split("\n")
      .map((line) => {
        const idx = line.indexOf("=");
        return [line.slice(0, idx), line.slice(idx + 1)];
      })
  );
}

function readRows(reportRoot, name) {
  return fs.readFileSync(path.join(reportRoot, name), "utf8")
    .trimEnd()
    .split("\n")
    .slice(1)
    .map((line) => line.split("\t"));
}

for (const [label, reportRoot] of [["export", exportRoot], ["plan", planRoot]]) {
  const summary = readSummary(reportRoot);
  const manifestRows = readRows(reportRoot, "manifest.tsv");
  const unresolvedRows = readRows(reportRoot, "unresolved-links.tsv");
  const resolvedRows = readRows(reportRoot, "resolved-links.tsv");
  const scopeRows = readRows(reportRoot, "scope-findings.tsv");
  const failedRows = readRows(reportRoot, "failed-pages.tsv");

  if (summary.final_status !== "success_with_findings") problems.push(`${label}:final_status:${summary.final_status}`);
  if (manifestRows.length !== 1) problems.push(`${label}:manifest_count:${manifestRows.length}`);
  if (!manifestRows.some((row) => row[0] === ambiguousId)) problems.push(`${label}:manifest_missing_root`);
  for (const duplicateId of duplicateIds) {
    if (manifestRows.some((row) => row[0] === duplicateId)) problems.push(`${label}:guessed_duplicate:${duplicateId}`);
    if (resolvedRows.some((row) => row[4] === duplicateId)) problems.push(`${label}:resolved_duplicate:${duplicateId}`);
  }
  if (label === "plan") {
    if (summary.blocking_reasons !== "unresolved_links") problems.push(`${label}:blocking_reasons:${summary.blocking_reasons}`);
    const unresolvedMatches = unresolvedRows.filter((row) =>
      row[0] === ambiguousId &&
      row[2] === "page_ref" &&
      row[3] === "space_key_present=0;space_key_bytes=0;space_key=;title_bytes=20;title=Shared Fixture Title" &&
      row[4] === "not_unique"
    );
    if (unresolvedMatches.length !== 1) problems.push(`${label}:not_unique_row_count:${unresolvedMatches.length}`);
    if (scopeRows.length !== 0) problems.push(`${label}:scope_rows:${scopeRows.length}`);
    if (failedRows.length !== 0) problems.push(`${label}:failed_rows:${failedRows.length}`);
  } else {
    if (summary.blocking_reasons !== "scope_findings,failed_operations") problems.push(`${label}:blocking_reasons:${summary.blocking_reasons}`);
    if (unresolvedRows.length !== 0) problems.push(`${label}:unresolved_rows:${unresolvedRows.length}`);
    const scopeKeys = scopeRows.map((row) => `${row[1]}:${row[2]}:${row[3]}`).sort();
    const expectedScopeKeys = [
      "child_listing:incomplete_tree:child_listing_incomplete",
      "storage_content:storage_unavailable:storage_content_unavailable"
    ].sort();
    if (scopeKeys.join("|") !== expectedScopeKeys.join("|")) problems.push(`${label}:scope_rows:${scopeKeys.join("|")}`);
    const failedKeys = failedRows.map((row) => `${row[2]}:${row[3]}`).sort();
    if (failedKeys.join("|") !== "page_payload:page_payload_failed") problems.push(`${label}:failed_rows:${failedKeys.join("|")}`);
  }
}

if (problems.length) {
  console.error(problems.join("\\n"));
  process.exit(1);
}
' "$export_out" "$plan_out" "$CONFLUEX_LIVE_IDENTITY_FILE"
  [ "$status" -eq 0 ] || live_fail_test "$output"
}

@test "supported href links expand scope while false positives and unsupported internal-looking links do not" {
  local plan_out="$LIVE_SCOPE_TMP_ROOT/scope-noise-plan"

  run env HOME="$CONFLUEX_LIVE_CLI_HOME" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    plan \
    --page-id "$SCOPE_NOISE_ROOT_PAGE_ID" \
    --out "$plan_out"
  [ "$status" -eq 0 ] || live_fail_test "scope-noise plan exited $status"

  run node -e '
const fs = require("fs");
const path = require("path");
const reportRoot = process.argv[1];
const identities = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const rootId = String(identities.scope_noise_root.page_id);
const manifestRows = fs.readFileSync(path.join(reportRoot, "manifest.tsv"), "utf8")
  .trimEnd()
  .split("\n")
  .slice(1)
  .map((line) => line.split("\t"));
const resolvedRows = fs.readFileSync(path.join(reportRoot, "resolved-links.tsv"), "utf8")
  .trimEnd()
  .split("\n")
  .slice(1)
  .map((line) => line.split("\t"));
const scopeRows = fs.readFileSync(path.join(reportRoot, "scope-findings.tsv"), "utf8")
  .trimEnd()
  .split("\n")
  .slice(1)
  .map((line) => line.split("\t"));
const problems = [];
if (!manifestRows.some((row) => row[0] === rootId && row[4] === "root")) problems.push("missing_root_manifest");
if (manifestRows.length !== 1) problems.push(`manifest_count:${manifestRows.length}`);
for (const fakeId of ["123456789", "987654321", "111111111", "222222222"]) {
  if (manifestRows.some((row) => row[0] === fakeId)) problems.push(`false_positive_expanded:${fakeId}`);
  if (resolvedRows.some((row) => row[4] === fakeId)) problems.push(`false_positive_resolved:${fakeId}`);
}
for (const externalRaw of [
  "https://example.invalid/confluence/display/CX/External"
]) {
  if (resolvedRows.some((row) => row[3] === externalRaw)) problems.push(`external_url_resolved:${externalRaw}`);
  if (scopeRows.some((row) => row[3].includes(externalRaw))) problems.push(`external_url_reported_as_internal:${externalRaw}`);
}
if (resolvedRows.length !== 0) problems.push(`resolved_count:${resolvedRows.length}`);
const unsupportedMatches = scopeRows.filter((row) =>
  row[0] === rootId &&
  row[1] === "unsupported_pattern" &&
  row[2] === "unsupported_internal_pattern" &&
  row[3] === "/display/CX/Unsupported%20Pattern"
);
if (unsupportedMatches.length !== 1) problems.push(`unsupported_scope_finding_count:${unsupportedMatches.length}`);
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
' "$plan_out" "$CONFLUEX_LIVE_IDENTITY_FILE"
  [ "$status" -eq 0 ] || live_fail_test "$output"
}

@test "title-resolution candidate limits keep ambiguous links unresolved with candidate_limit" {
  local plan_out="$LIVE_SCOPE_TMP_ROOT/candidate-limit-plan"

  run env HOME="$CONFLUEX_LIVE_CLI_HOME" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    plan \
    --page-id "$AMBIGUOUS_ROOT_PAGE_ID" \
    --out "$plan_out" \
    --max-find-candidates 1
  [ "$status" -eq 0 ] || live_fail_test "candidate-limit plan exited $status"

  run node -e '
const fs = require("fs");
const path = require("path");
const reportRoot = process.argv[1];
const identities = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const ambiguousId = String(identities.ambiguous_root_page.page_id);
const duplicateIds = [
  String(identities.duplicate_title_primary.page_id),
  String(identities.duplicate_title_secondary.page_id)
];
const manifestRows = fs.readFileSync(path.join(reportRoot, "manifest.tsv"), "utf8")
  .trimEnd()
  .split("\n")
  .slice(1)
  .map((line) => line.split("\t"));
const unresolvedRows = fs.readFileSync(path.join(reportRoot, "unresolved-links.tsv"), "utf8")
  .trimEnd()
  .split("\n")
  .slice(1)
  .map((line) => line.split("\t"));
const problems = [];
if (manifestRows.length !== 1) problems.push(`manifest_count:${manifestRows.length}`);
if (!manifestRows.some((row) => row[0] === ambiguousId)) problems.push("manifest_missing_root");
for (const duplicateId of duplicateIds) {
  if (manifestRows.some((row) => row[0] === duplicateId)) problems.push(`guessed_duplicate:${duplicateId}`);
}
const unresolvedMatches = unresolvedRows.filter((row) =>
  row[0] === ambiguousId &&
  row[2] === "page_ref" &&
  row[3] === "space_key_present=0;space_key_bytes=0;space_key=;title_bytes=20;title=Shared Fixture Title" &&
  row[4] === "candidate_limit"
);
if (unresolvedMatches.length !== 1) problems.push(`candidate_limit_row_count:${unresolvedMatches.length}`);
if (problems.length) {
  console.error(problems.join("\\n"));
  process.exit(1);
}
' "$plan_out" "$CONFLUEX_LIVE_IDENTITY_FILE"
  [ "$status" -eq 0 ] || live_fail_test "$output"
}
