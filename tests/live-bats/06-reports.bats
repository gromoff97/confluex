#!/usr/bin/env bats

source "${BATS_TEST_DIRNAME}/helpers/live_confluex_helper.bash"

EXPECTATIONS_FILE="${CONFLUEX_LIVE_EXPECTATIONS_FILE:-${BATS_TEST_DIRNAME}/../../fixtures/confluence-7137/expected/live-command-expectations.json}"

setup() {
  if [[ -z "${CONFLUEX_LIVE_IDENTITY_FILE:-}" || -z "${CONFLUEX_LIVE_CLI_HOME:-}" || -z "${CONFLUEX_LIVE_REPORT_ROOT:-}" ]]; then
    skip "report regression requires identities, CLI home, and report root"
  fi

  export ROOT_PAGE_ID
  ROOT_PAGE_ID="$(node -e 'const fs=require("fs"); const data=JSON.parse(fs.readFileSync(process.env.CONFLUEX_LIVE_IDENTITY_FILE,"utf8")); process.stdout.write(String(data.root_page.page_id));')"
}

run_live_plan_report() {
  rm -rf "$CONFLUEX_LIVE_REPORT_ROOT/plan"
  run env HOME="$CONFLUEX_LIVE_CLI_HOME" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    plan \
    --page-id "$ROOT_PAGE_ID" \
    --out "$CONFLUEX_LIVE_REPORT_ROOT/plan"
  [ "$status" -eq 0 ]
}

run_live_export_report() {
  rm -rf "$CONFLUEX_LIVE_REPORT_ROOT/export"
  run env HOME="$CONFLUEX_LIVE_CLI_HOME" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    export \
    --page-id "$ROOT_PAGE_ID" \
    --out "$CONFLUEX_LIVE_REPORT_ROOT/export"
  [ "$status" -eq 0 ]
}

@test "plan summary.txt uses the docs-defined schema, vocabularies, and arithmetic invariants" {
  run_live_plan_report

  run node -e '
const fs = require("fs");
const path = require("path");
const reportRoot = process.argv[1];
const rootPageId = process.argv[2];
const expected = JSON.parse(fs.readFileSync(process.argv[3], "utf8")).plan;
const expectedKeys = [
  "command",
  "page_id",
  "output_root",
  "output_path_provenance",
  "support_profile",
  "page_payload_format",
  "final_status",
  "scope_trust",
  "processed_pages",
  "root_pages",
  "tree_pages",
  "linked_pages",
  "other_pages",
  "resolved_links",
  "unresolved_links",
  "scope_findings",
  "failed_operations",
  "downloaded_mib_total",
  "downloaded_mib_content",
  "downloaded_mib_metadata",
  "blocking_reasons",
  "interrupt_reason",
  "resume_mode",
  "resume_schema_version",
  "reused_pages",
  "fresh_pages",
  "encryption_enabled",
  "encryption_successful"
];
const integerKeys = [
  "processed_pages",
  "root_pages",
  "tree_pages",
  "linked_pages",
  "other_pages",
  "resolved_links",
  "unresolved_links",
  "scope_findings",
  "failed_operations",
  "resume_mode",
  "resume_schema_version",
  "reused_pages",
  "fresh_pages",
  "encryption_enabled",
  "encryption_successful"
];
const summaryText = fs.readFileSync(path.join(reportRoot, "summary.txt"), "utf8");
const manifestRows = fs.readFileSync(path.join(reportRoot, "manifest.tsv"), "utf8").trimEnd().split("\n").slice(1);
const resolvedRows = fs.readFileSync(path.join(reportRoot, "resolved-links.tsv"), "utf8").trimEnd().split("\n").slice(1);
const unresolvedRows = fs.readFileSync(path.join(reportRoot, "unresolved-links.tsv"), "utf8").trimEnd().split("\n").slice(1);
const scopeRows = fs.readFileSync(path.join(reportRoot, "scope-findings.tsv"), "utf8").trimEnd().split("\n").slice(1);
const failedRows = fs.readFileSync(path.join(reportRoot, "failed-pages.tsv"), "utf8").trimEnd().split("\n").slice(1);
const problems = [];

if (/\r/.test(summaryText)) problems.push("summary:contains_cr");
if (!summaryText.endsWith("\n")) problems.push("summary:missing_trailing_lf");

const lines = summaryText.trimEnd().split("\n");
const keys = [];
const values = {};
for (const line of lines) {
  const idx = line.indexOf("=");
  if (idx < 1) {
    problems.push(`summary:invalid_line:${line}`);
    continue;
  }
  const key = line.slice(0, idx);
  const value = line.slice(idx + 1);
  keys.push(key);
  if (Object.prototype.hasOwnProperty.call(values, key)) problems.push(`summary:duplicate_key:${key}`);
  values[key] = value;
}

if (keys.join("\n") !== expectedKeys.join("\n")) {
  problems.push(`summary:key_order:${keys.join(",")}`);
}
for (const key of integerKeys) {
  if (!/^\d+$/.test(values[key] || "")) problems.push(`summary:not_integer:${key}:${values[key]}`);
}
for (const key of ["downloaded_mib_total", "downloaded_mib_content", "downloaded_mib_metadata"]) {
  if (!/^\d+\.\d{3}$/.test(values[key] || "")) problems.push(`summary:not_mib_decimal:${key}:${values[key]}`);
}
if (values.command !== "plan") problems.push(`summary:command:${values.command}`);
if (values.page_id !== rootPageId) problems.push(`summary:page_id:${values.page_id}`);
if (values.output_root !== `"${reportRoot}"`) problems.push(`summary:output_root:${values.output_root}`);
if (values.output_path_provenance !== "explicit") problems.push(`summary:output_path_provenance:${values.output_path_provenance}`);
if (values.support_profile !== "default") problems.push(`summary:support_profile:${values.support_profile}`);
if (values.page_payload_format !== "none") problems.push(`summary:page_payload_format:${values.page_payload_format}`);
if (values.interrupt_reason !== "none") problems.push(`summary:interrupt_reason:${values.interrupt_reason}`);
if (values.resume_mode !== "0") problems.push(`summary:resume_mode:${values.resume_mode}`);
if (values.resume_schema_version !== "2") problems.push(`summary:resume_schema_version:${values.resume_schema_version}`);
if (values.reused_pages !== "0") problems.push(`summary:reused_pages:${values.reused_pages}`);
if (values.fresh_pages !== values.processed_pages) problems.push(`summary:fresh_pages:${values.fresh_pages}!=${values.processed_pages}`);
if (values.encryption_enabled !== "0") problems.push(`summary:encryption_enabled:${values.encryption_enabled}`);
if (values.encryption_successful !== "0") problems.push(`summary:encryption_successful:${values.encryption_successful}`);
for (const [key, expectedValue] of Object.entries(expected.summary)) {
  if (values[key] !== expectedValue) problems.push(`summary:${key}:${values[key]}!=${expectedValue}`);
}

if (values.processed_pages !== String(manifestRows.length)) problems.push(`summary:processed_pages:${values.processed_pages}!=${manifestRows.length}`);
const manifestCategories = { root: 0, tree: 0, linked: 0, other: 0 };
for (const row of manifestRows) {
  const fields = row.split("\t");
  manifestCategories[fields[4]] = (manifestCategories[fields[4]] || 0) + 1;
}
if (values.root_pages !== String(manifestCategories.root || 0)) problems.push(`summary:root_pages:${values.root_pages}`);
if (values.tree_pages !== String(manifestCategories.tree || 0)) problems.push(`summary:tree_pages:${values.tree_pages}`);
if (values.linked_pages !== String(manifestCategories.linked || 0)) problems.push(`summary:linked_pages:${values.linked_pages}`);
if (values.other_pages !== String(manifestCategories.other || 0)) problems.push(`summary:other_pages:${values.other_pages}`);
if (values.resolved_links !== String(resolvedRows.length)) problems.push(`summary:resolved_links:${values.resolved_links}`);
if (values.unresolved_links !== String(unresolvedRows.length)) problems.push(`summary:unresolved_links:${values.unresolved_links}`);
if (values.scope_findings !== String(scopeRows.length)) problems.push(`summary:scope_findings:${values.scope_findings}`);
if (values.failed_operations !== String(failedRows.length)) problems.push(`summary:failed_operations:${values.failed_operations}`);

const parseMilli = (value) => {
  const [whole, frac] = value.split(".");
  return BigInt(whole) * 1000n + BigInt(frac);
};
if ((parseMilli(values.downloaded_mib_content) + parseMilli(values.downloaded_mib_metadata)).toString() !== parseMilli(values.downloaded_mib_total).toString()) {
  problems.push("summary:downloaded_mib_total_mismatch");
}

const blockingTokens = values.blocking_reasons === "none" ? [] : values.blocking_reasons.split(",");
const expectedBlockingTokens = [];
if (Number(values.unresolved_links) > 0) expectedBlockingTokens.push("unresolved_links");
if (Number(values.scope_findings) > 0) expectedBlockingTokens.push("scope_findings");
if (Number(values.failed_operations) > 0) expectedBlockingTokens.push("failed_operations");
if (blockingTokens.join(",") !== expectedBlockingTokens.join(",")) {
  problems.push(`summary:blocking_reasons:${values.blocking_reasons}`);
}

if (problems.length) {
  console.error(problems.join("\\n"));
  process.exit(1);
}
' "$CONFLUEX_LIVE_REPORT_ROOT/plan" "$ROOT_PAGE_ID" "$EXPECTATIONS_FILE"
  [ "$status" -eq 0 ] || live_fail_test "$output"
}

@test "export summary.txt uses the docs-defined schema, vocabularies, and arithmetic invariants" {
  run_live_export_report

  run node -e '
const fs = require("fs");
const path = require("path");
const reportRoot = process.argv[1];
const rootPageId = process.argv[2];
const expected = JSON.parse(fs.readFileSync(process.argv[3], "utf8")).export;
const expectedKeys = [
  "command",
  "page_id",
  "output_root",
  "output_path_provenance",
  "support_profile",
  "page_payload_format",
  "final_status",
  "scope_trust",
  "processed_pages",
  "root_pages",
  "tree_pages",
  "linked_pages",
  "other_pages",
  "resolved_links",
  "unresolved_links",
  "scope_findings",
  "failed_operations",
  "downloaded_mib_total",
  "downloaded_mib_content",
  "downloaded_mib_metadata",
  "blocking_reasons",
  "interrupt_reason",
  "resume_mode",
  "resume_schema_version",
  "reused_pages",
  "fresh_pages",
  "encryption_enabled",
  "encryption_successful"
];
const integerKeys = [
  "processed_pages",
  "root_pages",
  "tree_pages",
  "linked_pages",
  "other_pages",
  "resolved_links",
  "unresolved_links",
  "scope_findings",
  "failed_operations",
  "resume_mode",
  "resume_schema_version",
  "reused_pages",
  "fresh_pages",
  "encryption_enabled",
  "encryption_successful"
];
const summaryText = fs.readFileSync(path.join(reportRoot, "summary.txt"), "utf8");
const manifestRows = fs.readFileSync(path.join(reportRoot, "manifest.tsv"), "utf8").trimEnd().split("\n").slice(1);
const resolvedRows = fs.readFileSync(path.join(reportRoot, "resolved-links.tsv"), "utf8").trimEnd().split("\n").slice(1);
const unresolvedRows = fs.readFileSync(path.join(reportRoot, "unresolved-links.tsv"), "utf8").trimEnd().split("\n").slice(1);
const scopeRows = fs.readFileSync(path.join(reportRoot, "scope-findings.tsv"), "utf8").trimEnd().split("\n").slice(1);
const failedRows = fs.readFileSync(path.join(reportRoot, "failed-pages.tsv"), "utf8").trimEnd().split("\n").slice(1);
const problems = [];

if (/\r/.test(summaryText)) problems.push("summary:contains_cr");
if (!summaryText.endsWith("\n")) problems.push("summary:missing_trailing_lf");

const lines = summaryText.trimEnd().split("\n");
const keys = [];
const values = {};
for (const line of lines) {
  const idx = line.indexOf("=");
  if (idx < 1) {
    problems.push(`summary:invalid_line:${line}`);
    continue;
  }
  const key = line.slice(0, idx);
  const value = line.slice(idx + 1);
  keys.push(key);
  if (Object.prototype.hasOwnProperty.call(values, key)) problems.push(`summary:duplicate_key:${key}`);
  values[key] = value;
}

if (keys.join("\n") !== expectedKeys.join("\n")) {
  problems.push(`summary:key_order:${keys.join(",")}`);
}
for (const key of integerKeys) {
  if (!/^\d+$/.test(values[key] || "")) problems.push(`summary:not_integer:${key}:${values[key]}`);
}
for (const key of ["downloaded_mib_total", "downloaded_mib_content", "downloaded_mib_metadata"]) {
  if (!/^\d+\.\d{3}$/.test(values[key] || "")) problems.push(`summary:not_mib_decimal:${key}:${values[key]}`);
}
if (values.command !== "export") problems.push(`summary:command:${values.command}`);
if (values.page_id !== rootPageId) problems.push(`summary:page_id:${values.page_id}`);
if (values.output_root !== `"${reportRoot}"`) problems.push(`summary:output_root:${values.output_root}`);
if (values.output_path_provenance !== "explicit") problems.push(`summary:output_path_provenance:${values.output_path_provenance}`);
if (values.support_profile !== "default") problems.push(`summary:support_profile:${values.support_profile}`);
if (values.page_payload_format !== "md") problems.push(`summary:page_payload_format:${values.page_payload_format}`);
if (values.interrupt_reason !== "none") problems.push(`summary:interrupt_reason:${values.interrupt_reason}`);
if (values.resume_mode !== "0") problems.push(`summary:resume_mode:${values.resume_mode}`);
if (values.resume_schema_version !== "2") problems.push(`summary:resume_schema_version:${values.resume_schema_version}`);
if (values.reused_pages !== "0") problems.push(`summary:reused_pages:${values.reused_pages}`);
if (values.fresh_pages !== values.processed_pages) problems.push(`summary:fresh_pages:${values.fresh_pages}!=${values.processed_pages}`);
if (values.encryption_enabled !== "0") problems.push(`summary:encryption_enabled:${values.encryption_enabled}`);
if (values.encryption_successful !== "0") problems.push(`summary:encryption_successful:${values.encryption_successful}`);
for (const [key, expectedValue] of Object.entries(expected.summary)) {
  if (values[key] !== expectedValue) problems.push(`summary:${key}:${values[key]}!=${expectedValue}`);
}

if (values.processed_pages !== String(manifestRows.length)) problems.push(`summary:processed_pages:${values.processed_pages}!=${manifestRows.length}`);
const manifestCategories = { root: 0, tree: 0, linked: 0, other: 0 };
for (const row of manifestRows) {
  const fields = row.split("\t");
  manifestCategories[fields[4]] = (manifestCategories[fields[4]] || 0) + 1;
}
if (values.root_pages !== String(manifestCategories.root || 0)) problems.push(`summary:root_pages:${values.root_pages}`);
if (values.tree_pages !== String(manifestCategories.tree || 0)) problems.push(`summary:tree_pages:${values.tree_pages}`);
if (values.linked_pages !== String(manifestCategories.linked || 0)) problems.push(`summary:linked_pages:${values.linked_pages}`);
if (values.other_pages !== String(manifestCategories.other || 0)) problems.push(`summary:other_pages:${values.other_pages}`);
if (values.resolved_links !== String(resolvedRows.length)) problems.push(`summary:resolved_links:${values.resolved_links}`);
if (values.unresolved_links !== String(unresolvedRows.length)) problems.push(`summary:unresolved_links:${values.unresolved_links}`);
if (values.scope_findings !== String(scopeRows.length)) problems.push(`summary:scope_findings:${values.scope_findings}`);
if (values.failed_operations !== String(failedRows.length)) problems.push(`summary:failed_operations:${values.failed_operations}`);

const parseMilli = (value) => {
  const [whole, frac] = value.split(".");
  return BigInt(whole) * 1000n + BigInt(frac);
};
if ((parseMilli(values.downloaded_mib_content) + parseMilli(values.downloaded_mib_metadata)).toString() !== parseMilli(values.downloaded_mib_total).toString()) {
  problems.push("summary:downloaded_mib_total_mismatch");
}

const blockingTokens = values.blocking_reasons === "none" ? [] : values.blocking_reasons.split(",");
const expectedBlockingTokens = [];
if (Number(values.unresolved_links) > 0) expectedBlockingTokens.push("unresolved_links");
if (Number(values.scope_findings) > 0) expectedBlockingTokens.push("scope_findings");
if (Number(values.failed_operations) > 0) expectedBlockingTokens.push("failed_operations");
if (blockingTokens.join(",") !== expectedBlockingTokens.join(",")) {
  problems.push(`summary:blocking_reasons:${values.blocking_reasons}`);
}

if (problems.length) {
  console.error(problems.join("\\n"));
  process.exit(1);
}
' "$CONFLUEX_LIVE_REPORT_ROOT/export" "$ROOT_PAGE_ID" "$EXPECTATIONS_FILE"
  [ "$status" -eq 0 ] || live_fail_test "$output"
}

@test "plan report TSV files use the docs-defined schemas, machine-readable serialization, and deterministic ordering" {
  run_live_plan_report

  run node -e '
const fs = require("fs");
const path = require("path");
const reportRoot = process.argv[1];
const expectedHeaders = {
  "manifest.tsv": "page_id\tspace_key\tpage_title\tfolder\tdiscovery_source\trun_mode\tattachment_count",
  "resolved-links.tsv": "source_page_id\tsource_title\tlink_kind\traw_link_value\ttarget_page_id\ttarget_space_key\ttarget_title",
  "unresolved-links.tsv": "source_page_id\tsource_title\tlink_kind\traw_link_value\tresolution_reason",
  "failed-pages.tsv": "page_id\tpage_title\toperation\terror_summary",
  "scope-findings.tsv": "page_id\tfinding_area\tfinding_type\tdetail"
};
const discoveryOrder = new Map([["root", 0], ["tree", 1], ["linked", 2]]);
const bytewiseCompare = (left, right) => Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
const problems = [];

function inspectTsv(filename) {
  const raw = fs.readFileSync(path.join(reportRoot, filename), "utf8");
  if (/\r/.test(raw)) problems.push(`${filename}:contains_cr`);
  if (!raw.endsWith("\n")) problems.push(`${filename}:missing_trailing_lf`);
  const lines = raw.trimEnd().split("\n");
  if (lines[0] !== expectedHeaders[filename]) problems.push(`${filename}:header`);
  const headerFieldCount = lines[0].split("\t").length;
  const rows = lines.slice(1);
  for (const row of rows) {
    const fields = row.split("\t");
    if (fields.length !== headerFieldCount) problems.push(`${filename}:field_count:${row}`);
    for (const field of fields) {
      if (/[\t\r\n]/.test(field)) problems.push(`${filename}:control_character:${row}`);
    }
  }
  return rows;
}

const manifestRows = inspectTsv("manifest.tsv");
const resolvedRows = inspectTsv("resolved-links.tsv");
const unresolvedRows = inspectTsv("unresolved-links.tsv");
const failedRows = inspectTsv("failed-pages.tsv");
const scopeRows = inspectTsv("scope-findings.tsv");

if (failedRows.length !== 0) problems.push(`failed-pages.tsv:not_header_only:${failedRows.length}`);

  const sortedManifest = [...manifestRows].sort((left, right) => {
  const a = left.split("\t");
  const b = right.split("\t");
  const discoveryCompare = (discoveryOrder.get(a[4]) ?? 99) - (discoveryOrder.get(b[4]) ?? 99);
  if (discoveryCompare !== 0) return discoveryCompare;
  if (a[3] !== b[3]) {
    if (a[3] === "none") return -1;
    if (b[3] === "none") return 1;
    return bytewiseCompare(a[3], b[3]);
  }
  return bytewiseCompare(a[0], b[0]);
});
if (manifestRows.join("\n") !== sortedManifest.join("\n")) problems.push("manifest.tsv:ordering");
if (resolvedRows.join("\n") !== [...resolvedRows].sort(bytewiseCompare).join("\n")) problems.push("resolved-links.tsv:ordering");
if (unresolvedRows.join("\n") !== [...unresolvedRows].sort(bytewiseCompare).join("\n")) problems.push("unresolved-links.tsv:ordering");
if (failedRows.join("\n") !== [...failedRows].sort(bytewiseCompare).join("\n")) problems.push("failed-pages.tsv:ordering");
if (scopeRows.join("\n") !== [...scopeRows].sort(bytewiseCompare).join("\n")) problems.push("scope-findings.tsv:ordering");

for (const row of manifestRows) {
  const fields = row.split("\t");
  if (!["root", "tree", "linked"].includes(fields[4])) problems.push(`manifest.tsv:discovery_source:${fields[4]}`);
  if (fields[5] !== "plan") problems.push(`manifest.tsv:run_mode:${fields[5]}`);
  if (!/^(none|\d+)$/.test(fields[6])) problems.push(`manifest.tsv:attachment_count:${fields[6]}`);
}
for (const row of resolvedRows) {
  const linkKind = row.split("\t")[2];
  if (!["child_result", "content_id", "page_ref", "macro_param", "href_page_id", "href_space_title", "ri_url_page_id", "ri_url_space_title"].includes(linkKind)) {
    problems.push(`resolved-links.tsv:link_kind:${linkKind}`);
  }
}
for (const row of unresolvedRows) {
  const reason = row.split("\t")[4];
  if (!["not_found", "not_unique", "candidate_limit", "insufficient_data"].includes(reason)) {
    problems.push(`unresolved-links.tsv:resolution_reason:${reason}`);
  }
}
for (const row of scopeRows) {
  const fields = row.split("\t");
  if (!["child_listing", "storage_content", "title_resolution", "unsupported_pattern"].includes(fields[1])) {
    problems.push(`scope-findings.tsv:finding_area:${fields[1]}`);
  }
  if (!["incomplete_tree", "partial_listing", "storage_unavailable", "storage_uninterpretable", "candidate_visibility_incomplete", "unsupported_internal_pattern"].includes(fields[2])) {
    problems.push(`scope-findings.tsv:finding_type:${fields[2]}`);
  }
}

if (problems.length) {
  console.error(problems.join("\\n"));
  process.exit(1);
}
' "$CONFLUEX_LIVE_REPORT_ROOT/plan"
  [ "$status" -eq 0 ] || live_fail_test "$output"
}

@test "export report TSV files use the docs-defined schemas, machine-readable serialization, and deterministic ordering" {
  run_live_export_report

  run node -e '
const fs = require("fs");
const path = require("path");
const reportRoot = process.argv[1];
const expectedHeaders = {
  "manifest.tsv": "page_id\tspace_key\tpage_title\tfolder\tdiscovery_source\trun_mode\tattachment_count",
  "resolved-links.tsv": "source_page_id\tsource_title\tlink_kind\traw_link_value\ttarget_page_id\ttarget_space_key\ttarget_title",
  "unresolved-links.tsv": "source_page_id\tsource_title\tlink_kind\traw_link_value\tresolution_reason",
  "failed-pages.tsv": "page_id\tpage_title\toperation\terror_summary",
  "scope-findings.tsv": "page_id\tfinding_area\tfinding_type\tdetail"
};
const discoveryOrder = new Map([["root", 0], ["tree", 1], ["linked", 2]]);
const bytewiseCompare = (left, right) => Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
const problems = [];

function inspectTsv(filename) {
  const raw = fs.readFileSync(path.join(reportRoot, filename), "utf8");
  if (/\r/.test(raw)) problems.push(`${filename}:contains_cr`);
  if (!raw.endsWith("\n")) problems.push(`${filename}:missing_trailing_lf`);
  const lines = raw.trimEnd().split("\n");
  if (lines[0] !== expectedHeaders[filename]) problems.push(`${filename}:header`);
  const headerFieldCount = lines[0].split("\t").length;
  const rows = lines.slice(1);
  for (const row of rows) {
    const fields = row.split("\t");
    if (fields.length !== headerFieldCount) problems.push(`${filename}:field_count:${row}`);
    for (const field of fields) {
      if (/[\t\r\n]/.test(field)) problems.push(`${filename}:control_character:${row}`);
    }
  }
  return rows;
}

const manifestRows = inspectTsv("manifest.tsv");
const resolvedRows = inspectTsv("resolved-links.tsv");
const unresolvedRows = inspectTsv("unresolved-links.tsv");
const failedRows = inspectTsv("failed-pages.tsv");
const scopeRows = inspectTsv("scope-findings.tsv");

if (failedRows.length !== 0) problems.push(`failed-pages.tsv:not_header_only:${failedRows.length}`);

  const sortedManifest = [...manifestRows].sort((left, right) => {
  const a = left.split("\t");
  const b = right.split("\t");
  const discoveryCompare = (discoveryOrder.get(a[4]) ?? 99) - (discoveryOrder.get(b[4]) ?? 99);
  if (discoveryCompare !== 0) return discoveryCompare;
  if (a[3] !== b[3]) {
    if (a[3] === "none") return -1;
    if (b[3] === "none") return 1;
    return bytewiseCompare(a[3], b[3]);
  }
  return bytewiseCompare(a[0], b[0]);
});
if (manifestRows.join("\n") !== sortedManifest.join("\n")) problems.push("manifest.tsv:ordering");
if (resolvedRows.join("\n") !== [...resolvedRows].sort(bytewiseCompare).join("\n")) problems.push("resolved-links.tsv:ordering");
if (unresolvedRows.join("\n") !== [...unresolvedRows].sort(bytewiseCompare).join("\n")) problems.push("unresolved-links.tsv:ordering");
if (failedRows.join("\n") !== [...failedRows].sort(bytewiseCompare).join("\n")) problems.push("failed-pages.tsv:ordering");
if (scopeRows.join("\n") !== [...scopeRows].sort(bytewiseCompare).join("\n")) problems.push("scope-findings.tsv:ordering");

for (const row of manifestRows) {
  const fields = row.split("\t");
  if (!["root", "tree", "linked"].includes(fields[4])) problems.push(`manifest.tsv:discovery_source:${fields[4]}`);
  if (fields[5] !== "export") problems.push(`manifest.tsv:run_mode:${fields[5]}`);
  if (!/^(none|\d+)$/.test(fields[6])) problems.push(`manifest.tsv:attachment_count:${fields[6]}`);
}
for (const row of resolvedRows) {
  const linkKind = row.split("\t")[2];
  if (!["child_result", "content_id", "page_ref", "macro_param", "href_page_id", "href_space_title", "ri_url_page_id", "ri_url_space_title"].includes(linkKind)) {
    problems.push(`resolved-links.tsv:link_kind:${linkKind}`);
  }
}
for (const row of unresolvedRows) {
  const reason = row.split("\t")[4];
  if (!["not_found", "not_unique", "candidate_limit", "insufficient_data"].includes(reason)) {
    problems.push(`unresolved-links.tsv:resolution_reason:${reason}`);
  }
}
for (const row of scopeRows) {
  const fields = row.split("\t");
  if (!["child_listing", "storage_content", "title_resolution", "unsupported_pattern"].includes(fields[1])) {
    problems.push(`scope-findings.tsv:finding_area:${fields[1]}`);
  }
  if (!["incomplete_tree", "partial_listing", "storage_unavailable", "storage_uninterpretable", "candidate_visibility_incomplete", "unsupported_internal_pattern"].includes(fields[2])) {
    problems.push(`scope-findings.tsv:finding_type:${fields[2]}`);
  }
}

if (problems.length) {
  console.error(problems.join("\\n"));
  process.exit(1);
}
' "$CONFLUEX_LIVE_REPORT_ROOT/export"
  [ "$status" -eq 0 ] || live_fail_test "$output"
}
