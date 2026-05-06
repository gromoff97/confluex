#!/usr/bin/env bats

source "${BATS_TEST_DIRNAME}/helpers/live_confluex_helper.bash"

EXPECTATIONS_FILE="${CONFLUEX_LIVE_EXPECTATIONS_FILE:-${BATS_TEST_DIRNAME}/../../tests/fixtures/confluence-7137/expected/live-command-expectations.json}"

setup() {
  bats_require_minimum_version 1.5.0

  if [[ -z "${CONFLUEX_LIVE_IDENTITY_FILE:-}" || -z "${CONFLUEX_LIVE_CLI_HOME:-}" || -z "${CONFLUEX_LIVE_REPORT_ROOT:-}" ]]; then
    skip "live command regression requires identities, CLI home, and report root"
  fi

  export ROOT_PAGE_ID
  export LINKED_PAGE_ID
  ROOT_PAGE_ID="$(node -e 'const fs=require("fs"); const data=JSON.parse(fs.readFileSync(process.env.CONFLUEX_LIVE_IDENTITY_FILE,"utf8")); process.stdout.write(String(data.root_page.page_id));')"
  LINKED_PAGE_ID="$(node -e 'const fs=require("fs"); const data=JSON.parse(fs.readFileSync(process.env.CONFLUEX_LIVE_IDENTITY_FILE,"utf8")); process.stdout.write(String(data.linked_page.page_id));')"
}

@test "plan emits the docs-defined report set and summary semantics for the canonical graph" {
  rm -rf "$CONFLUEX_LIVE_REPORT_ROOT/plan"
  run env HOME="$CONFLUEX_LIVE_CLI_HOME" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    plan \
    --page-id "$ROOT_PAGE_ID" \
    --out "$CONFLUEX_LIVE_REPORT_ROOT/plan"
  [ "$status" -eq 0 ]

  run node -e '
const fs = require("fs");
const path = require("path");
const reportRoot = process.argv[1];
const identities = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const expected = JSON.parse(fs.readFileSync(process.argv[3], "utf8")).plan;

function readSummary(summaryPath) {
  return Object.fromEntries(
    fs.readFileSync(summaryPath, "utf8")
      .trim()
      .split("\n")
      .map((line) => {
        const idx = line.indexOf("=");
        return [line.slice(0, idx), line.slice(idx + 1)];
      })
  );
}

function readTsv(tsvPath) {
  const lines = fs.readFileSync(tsvPath, "utf8").trimEnd().split("\n");
  return {
    header: lines[0],
    rows: lines.slice(1).map((line) => line.split("\t"))
  };
}

const summary = readSummary(path.join(reportRoot, "summary.txt"));
const manifest = readTsv(path.join(reportRoot, "manifest.tsv"));
const resolved = readTsv(path.join(reportRoot, "resolved-links.tsv"));
const unresolved = readTsv(path.join(reportRoot, "unresolved-links.tsv"));
const scope = readTsv(path.join(reportRoot, "scope-findings.tsv"));
const failed = readTsv(path.join(reportRoot, "failed-pages.tsv"));
const problems = [];

for (const [key, value] of Object.entries(expected.summary)) {
  if (summary[key] !== value) problems.push(`summary:${key}:${summary[key]}!=${value}`);
}
if (manifest.header !== expected.manifest.header) problems.push("manifest:header");
if (manifest.rows.length + 1 !== Number(expected.manifest.line_count)) problems.push(`manifest:line_count:${manifest.rows.length + 1}`);
if (failed.rows.length !== 0) problems.push(`failed-pages:${failed.rows.length}`);
if (resolved.rows.length !== Number(expected.summary.resolved_links)) problems.push(`resolved-links:${resolved.rows.length}`);
if (unresolved.rows.length !== Number(expected.summary.unresolved_links)) problems.push(`unresolved-links:${unresolved.rows.length}`);
if (scope.rows.length !== Number(expected.summary.scope_findings)) problems.push(`scope-findings:${scope.rows.length}`);

const manifestIds = manifest.rows.map((row) => row[0]);
for (const logicalName of ["root_page", "child_page", "grandchild_page", "linked_page", "cross_space_page"]) {
  if (!manifestIds.includes(String(identities[logicalName].page_id))) {
    problems.push(`manifest:missing:${logicalName}`);
  }
}

for (const entry of expected.resolved_links) {
  const rawLinkValue = identities[entry.raw_link_value]
    ? (["child_result", "content_id", "href_page_id", "ri_url_page_id"].includes(entry.link_kind)
        ? `page_id:${identities[entry.raw_link_value].page_id}`
        : String(identities[entry.raw_link_value].page_id))
    : entry.raw_link_value;
  const expectedRow = [
    String(identities[entry.source].page_id),
    identities[entry.source].title,
    entry.link_kind,
    rawLinkValue,
    String(identities[entry.target].page_id),
    entry.target_space_key,
    entry.target_title,
  ].join("\t");
  const actualRows = resolved.rows.map((row) => row.join("\t"));
  if (!actualRows.includes(expectedRow)) problems.push(`resolved-links:missing:${expectedRow}`);
}

for (const entry of expected.unresolved_links) {
  const expectedRow = [
    String(identities[entry.source].page_id),
    identities[entry.source].title,
    entry.link_kind,
    entry.raw_link_value,
    entry.resolution_reason,
  ].join("\t");
  const actualRows = unresolved.rows.map((row) => row.join("\t"));
  if (!actualRows.includes(expectedRow)) problems.push(`unresolved-links:missing:${expectedRow}`);
}

for (const entry of expected.scope_findings) {
  const expectedRow = [
    String(identities[entry.source].page_id),
    entry.finding_area,
    entry.finding_type,
    entry.detail,
  ].join("\t");
  const actualRows = scope.rows.map((row) => row.join("\t"));
  if (!actualRows.includes(expectedRow)) problems.push(`scope-findings:missing:${expectedRow}`);
}

if (problems.length) {
  console.error(problems.join("\\n"));
  process.exit(1);
}
' "$CONFLUEX_LIVE_REPORT_ROOT/plan" "$CONFLUEX_LIVE_IDENTITY_FILE" "$EXPECTATIONS_FILE"
  [ "$status" -eq 0 ] || live_fail_test "$output"
}

@test "plan keeps one logical output root and the docs-defined top-level artifact layout" {
  rm -rf "$CONFLUEX_LIVE_REPORT_ROOT/plan"
  run env HOME="$CONFLUEX_LIVE_CLI_HOME" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    plan \
    --page-id "$ROOT_PAGE_ID" \
    --out "$CONFLUEX_LIVE_REPORT_ROOT/plan"
  [ "$status" -eq 0 ]

  run node -e '
const fs = require("fs");
const path = require("path");
const reportRoot = process.argv[1];
const expectedTopLevel = [
  "failed-pages.tsv",
  "manifest.tsv",
  "resolved-links.tsv",
  "scope-findings.tsv",
  "summary.txt",
  "unresolved-links.tsv"
];
const summary = Object.fromEntries(
  fs.readFileSync(path.join(reportRoot, "summary.txt"), "utf8")
    .trim()
    .split("\n")
    .map((line) => {
      const idx = line.indexOf("=");
      return [line.slice(0, idx), line.slice(idx + 1)];
    })
);
const actualTopLevel = fs.readdirSync(reportRoot).sort();
const missing = expectedTopLevel.filter((name) => !actualTopLevel.includes(name));
const unexpected = actualTopLevel.filter((name) => !expectedTopLevel.includes(name) || name === "pages");
const problems = [];
if (missing.length) problems.push(`missing_top_level:${missing.join(",")}`);
if (unexpected.length) problems.push(`unexpected_top_level:${unexpected.join(",")}`);
if (summary.output_path_provenance !== "explicit") problems.push(`output_path_provenance:${summary.output_path_provenance}`);
if (summary.page_payload_format !== "none") problems.push(`page_payload_format:${summary.page_payload_format}`);
if (problems.length) {
  console.error(problems.join("\\n"));
  process.exit(1);
}
' "$CONFLUEX_LIVE_REPORT_ROOT/plan"
  [ "$status" -eq 0 ] || live_fail_test "$output"
}

@test "plan and export resolve relative --out against cwd before reporting and creating artifacts" {
  local workdir=""
  local expected_plan_root=""
  local expected_export_root=""

  workdir="$(mktemp -d)"
  mkdir -p "$workdir/scratch"
  expected_plan_root="$workdir/relative-plan"
  expected_export_root="$workdir/relative-export"

  run --keep-empty-lines --separate-stderr env HOME="$CONFLUEX_LIVE_CLI_HOME" bash -lc \
    "cd '$workdir' && '$LIVE_CONFLUEX_REPO_ROOT/confluex' plan --page-id '$LINKED_PAGE_ID' --out './scratch/../relative-plan/' --safe"
  output="${output%$'\n'}"
  stderr="${stderr%$'\n'}"
  [ "$status" -eq 0 ] || live_fail_test "relative plan exited $status: $output $stderr"
  live_assert_equal "" "$stderr" "relative plan stderr"

  run --keep-empty-lines --separate-stderr env HOME="$CONFLUEX_LIVE_CLI_HOME" bash -lc \
    "cd '$workdir' && '$LIVE_CONFLUEX_REPO_ROOT/confluex' export --page-id '$LINKED_PAGE_ID' --out './scratch/../relative-export/' --safe"
  output="${output%$'\n'}"
  stderr="${stderr%$'\n'}"
  [ "$status" -eq 0 ] || live_fail_test "relative export exited $status: $output $stderr"
  live_assert_equal "" "$stderr" "relative export stderr"

  run node -e '
const fs = require("fs");
const path = require("path");
const [planRoot, exportRoot] = process.argv.slice(1);
function summaryValue(root, key) {
  return Object.fromEntries(
    fs.readFileSync(path.join(root, "summary.txt"), "utf8")
      .trim()
      .split("\n")
      .map((line) => {
        const idx = line.indexOf("=");
        return [line.slice(0, idx), line.slice(idx + 1)];
      })
  )[key];
}
const problems = [];
for (const [label, root] of [["plan", planRoot], ["export", exportRoot]]) {
  if (!fs.existsSync(path.join(root, "summary.txt"))) problems.push(`${label}:summary_missing`);
  if (summaryValue(root, "output_root") !== JSON.stringify(root)) problems.push(`${label}:output_root:${summaryValue(root, "output_root")}`);
  if (summaryValue(root, "output_path_provenance") !== "explicit") problems.push(`${label}:provenance:${summaryValue(root, "output_path_provenance")}`);
}
if (fs.existsSync(`${planRoot}/`)) {
  const stat = fs.statSync(planRoot);
  if (!stat.isDirectory()) problems.push("plan:not_directory");
}
if (!fs.existsSync(path.join(exportRoot, "pages"))) problems.push("export:pages_missing");
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
  ' "$expected_plan_root" "$expected_export_root"
  [ "$status" -eq 0 ] || live_fail_test "$output"

  rm -rf "$workdir"
}

@test "plan --keep-metadata persists only docs-defined metadata files and no payload files" {
  rm -rf "$CONFLUEX_LIVE_REPORT_ROOT/plan-keep-metadata"
  run env HOME="$CONFLUEX_LIVE_CLI_HOME" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    plan \
    --page-id "$ROOT_PAGE_ID" \
    --keep-metadata \
    --out "$CONFLUEX_LIVE_REPORT_ROOT/plan-keep-metadata"
  [ "$status" -eq 0 ]

  run node -e '
const fs = require("fs");
const path = require("path");
const reportRoot = process.argv[1];
const identities = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const manifestRows = fs.readFileSync(path.join(reportRoot, "manifest.tsv"), "utf8")
  .trimEnd()
  .split("\n")
  .slice(1)
  .map((line) => line.split("\t"));
const pageIds = [String(identities.root_page.page_id), String(identities.child_page.page_id)];
const problems = [];

for (const pageId of pageIds) {
  const row = manifestRows.find((candidate) => candidate[0] === pageId);
  if (!row) {
    problems.push(`manifest:missing:${pageId}`);
    continue;
  }
  const folder = path.join(reportRoot, row[3]);
  for (const required of ["_info.txt", "_storage.xml", "_attachments_preview.txt"]) {
    if (!fs.existsSync(path.join(folder, required))) problems.push(`missing:${pageId}:${required}`);
  }
  for (const forbidden of ["page.md", "page.html"]) {
    if (fs.existsSync(path.join(folder, forbidden))) problems.push(`unexpected:${pageId}:${forbidden}`);
  }
  if (fs.existsSync(path.join(folder, "attachments"))) problems.push(`unexpected:${pageId}:attachments`);
}

if (problems.length) {
  console.error(problems.join("\\n"));
  process.exit(1);
}
' "$CONFLUEX_LIVE_REPORT_ROOT/plan-keep-metadata" "$CONFLUEX_LIVE_IDENTITY_FILE"
  [ "$status" -eq 0 ] || live_fail_test "$output"
}

@test "export emits markdown payloads and attachments according to the docs-defined canonical graph expectations" {
  rm -rf "$CONFLUEX_LIVE_REPORT_ROOT/export"
  run env HOME="$CONFLUEX_LIVE_CLI_HOME" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    export \
    --page-id "$ROOT_PAGE_ID" \
    --out "$CONFLUEX_LIVE_REPORT_ROOT/export"
  [ "$status" -eq 0 ]

  run node -e '
const fs = require("fs");
const path = require("path");
const reportRoot = process.argv[1];
const identities = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const expected = JSON.parse(fs.readFileSync(process.argv[3], "utf8")).export;
const fixturesRoot = process.argv[4];
const expectedDir = process.argv[5];

function readSummary(summaryPath) {
  return Object.fromEntries(
    fs.readFileSync(summaryPath, "utf8")
      .trim()
      .split("\n")
      .map((line) => {
        const idx = line.indexOf("=");
        return [line.slice(0, idx), line.slice(idx + 1)];
      })
  );
}

function readTsv(tsvPath) {
  const lines = fs.readFileSync(tsvPath, "utf8").trimEnd().split("\n");
  return {
    header: lines[0],
    rows: lines.slice(1).map((line) => line.split("\t"))
  };
}

const summary = readSummary(path.join(reportRoot, "summary.txt"));
const manifest = readTsv(path.join(reportRoot, "manifest.tsv"));
const problems = [];

for (const [key, value] of Object.entries(expected.summary)) {
  if (summary[key] !== value) problems.push(`summary:${key}:${summary[key]}!=${value}`);
}
if (manifest.header !== expected.manifest.header) problems.push("manifest:header");
if (manifest.rows.length + 1 !== Number(expected.manifest.line_count)) problems.push(`manifest:line_count:${manifest.rows.length + 1}`);

for (const [logicalName, filename] of Object.entries(expected.payload_files)) {
  const pageId = String(identities[logicalName].page_id);
  const row = manifest.rows.find((candidate) => candidate[0] === pageId);
  if (!row) {
    problems.push(`manifest:missing:${logicalName}`);
    continue;
  }
  const folder = row[3];
  const pagePath = path.join(reportRoot, folder, filename);
  const pageHtml = path.join(reportRoot, folder, "page.html");
  if (!fs.existsSync(pagePath)) problems.push(`payload:missing:${logicalName}:${filename}`);
  if (fs.existsSync(pageHtml)) problems.push(`payload:unexpected_html:${logicalName}`);
  if (fs.existsSync(pagePath)) {
    const actualPayload = fs.readFileSync(pagePath);
    const expectedPayload = fs.readFileSync(path.join(expectedDir, "payloads", "md", `${logicalName}.page.md`));
    if (!actualPayload.equals(expectedPayload)) problems.push(`payload:bytes:${logicalName}:${filename}`);
  }
}

for (const [logicalName, filename] of Object.entries(expected.attachment_files)) {
  const pageId = String(identities[logicalName].page_id);
  const row = manifest.rows.find((candidate) => candidate[0] === pageId);
  if (!row) {
    problems.push(`manifest:missing:${logicalName}`);
    continue;
  }
  const folder = row[3];
  const attachmentPath = path.join(reportRoot, folder, "attachments", filename);
  if (!fs.existsSync(attachmentPath)) problems.push(`attachment:missing:${logicalName}:${filename}`);
  if (fs.existsSync(attachmentPath)) {
    const actualBytes = fs.readFileSync(attachmentPath);
    const expectedBytes = fs.readFileSync(path.join(fixturesRoot, "content", "attachments", logicalName, filename));
    if (!actualBytes.equals(expectedBytes)) problems.push(`attachment:bytes:${logicalName}:${filename}`);
  }
}

if (problems.length) {
  console.error(problems.join("\\n"));
  process.exit(1);
}
' "$CONFLUEX_LIVE_REPORT_ROOT/export" "$CONFLUEX_LIVE_IDENTITY_FILE" "$EXPECTATIONS_FILE" "${BATS_TEST_DIRNAME}/../../tests/fixtures/confluence-7137" "$CONFLUEX_LIVE_EXPECTED_DIR"
  [ "$status" -eq 0 ] || live_fail_test "$output"
}

@test "export --zip retains plain root and deterministic ZIP archive" {
  rm -rf "$CONFLUEX_LIVE_REPORT_ROOT/export-zip" "$CONFLUEX_LIVE_REPORT_ROOT/export-zip.zip"
  run env HOME="$CONFLUEX_LIVE_CLI_HOME" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    export \
    --page-id "$ROOT_PAGE_ID" \
    --zip \
    --out "$CONFLUEX_LIVE_REPORT_ROOT/export-zip"
  [ "$status" -eq 0 ]

  run node -e '
const fs = require("fs");
const path = require("path");
const reportRoot = process.argv[1];
const expected = JSON.parse(fs.readFileSync(process.argv[2], "utf8")).export_zip;
const zipPath = `${reportRoot}.zip`;
const problems = [];

function readSummary(summaryPath) {
  return Object.fromEntries(
    fs.readFileSync(summaryPath, "utf8")
      .trim()
      .split("\n")
      .map((line) => {
        const idx = line.indexOf("=");
        return [line.slice(0, idx), line.slice(idx + 1)];
      })
  );
}

function zipEntryNames(archivePath) {
  const data = fs.readFileSync(archivePath);
  const eocd = data.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd === -1) return null;
  const count = data.readUInt16LE(eocd + 10);
  let offset = data.readUInt32LE(eocd + 16);
  const names = [];
  for (let index = 0; index < count; index += 1) {
    if (data.readUInt32LE(offset) !== 0x02014b50) return null;
    const nameLength = data.readUInt16LE(offset + 28);
    const extraLength = data.readUInt16LE(offset + 30);
    const commentLength = data.readUInt16LE(offset + 32);
    names.push(data.subarray(offset + 46, offset + 46 + nameLength).toString("utf8"));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return names;
}

const summary = readSummary(path.join(reportRoot, "summary.txt"));
for (const [key, value] of Object.entries(expected.summary)) {
  if (summary[key] !== value) problems.push(`summary:${key}:${summary[key]}!=${value}`);
}
if (summary.zip_path !== JSON.stringify(zipPath)) problems.push(`summary:zip_path:${summary.zip_path}`);
if (!fs.existsSync(reportRoot)) problems.push("plain_root:missing");
if (!fs.existsSync(zipPath)) problems.push("zip:missing");

const archiveNames = fs.existsSync(zipPath) ? zipEntryNames(zipPath) : null;
if (archiveNames === null) {
  problems.push("zip:unreadable");
} else {
  const sortedNames = archiveNames.slice().sort((left, right) => Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8")));
  if (archiveNames.join("\n") !== sortedNames.join("\n")) problems.push("zip:order");
  for (const required of ["summary.txt", "manifest.tsv", "pages"]) {
    if (!archiveNames.some((name) => name === required || name.startsWith(`${required}/`))) problems.push(`zip:missing:${required}`);
  }
  for (const name of archiveNames) {
    if (path.isAbsolute(name) || name.split("/").includes("..") || name.endsWith("/")) problems.push(`zip:invalid_entry:${name}`);
  }
}

if (expected.zip_archive !== "present") problems.push(`zip:expectation:${expected.zip_archive}`);
if (problems.length) {
  console.error(problems.join("\\n"));
  process.exit(1);
}
' "$CONFLUEX_LIVE_REPORT_ROOT/export-zip" "$EXPECTATIONS_FILE"
  [ "$status" -eq 0 ] || live_fail_test "$output"
}

@test "export keeps one logical output root and the docs-defined top-level artifact layout" {
  rm -rf "$CONFLUEX_LIVE_REPORT_ROOT/export"
  run env HOME="$CONFLUEX_LIVE_CLI_HOME" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    export \
    --page-id "$ROOT_PAGE_ID" \
    --out "$CONFLUEX_LIVE_REPORT_ROOT/export"
  [ "$status" -eq 0 ]

  run node -e '
const fs = require("fs");
const path = require("path");
const reportRoot = process.argv[1];
const expectedTopLevel = [
  "failed-pages.tsv",
  "manifest.tsv",
  "pages",
  "resolved-links.tsv",
  "scope-findings.tsv",
  "summary.txt",
  "unresolved-links.tsv"
];
const summary = Object.fromEntries(
  fs.readFileSync(path.join(reportRoot, "summary.txt"), "utf8")
    .trim()
    .split("\n")
    .map((line) => {
      const idx = line.indexOf("=");
      return [line.slice(0, idx), line.slice(idx + 1)];
    })
);
const actualTopLevel = fs.readdirSync(reportRoot).sort();
const missing = expectedTopLevel.filter((name) => !actualTopLevel.includes(name));
const problems = [];

if (missing.length) problems.push(`missing_top_level:${missing.join(",")}`);
if (summary.output_path_provenance !== "explicit") problems.push(`output_path_provenance:${summary.output_path_provenance}`);

if (problems.length) {
  console.error(problems.join("\\n"));
  process.exit(1);
}
' "$CONFLUEX_LIVE_REPORT_ROOT/export"
  [ "$status" -eq 0 ] || live_fail_test "$output"
}

@test "export --keep-metadata adds docs-defined metadata files alongside payloads" {
  rm -rf "$CONFLUEX_LIVE_REPORT_ROOT/export-keep-metadata"
  run env HOME="$CONFLUEX_LIVE_CLI_HOME" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    export \
    --page-id "$ROOT_PAGE_ID" \
    --keep-metadata \
    --out "$CONFLUEX_LIVE_REPORT_ROOT/export-keep-metadata"
  [ "$status" -eq 0 ]

  run node -e '
const fs = require("fs");
const path = require("path");
const reportRoot = process.argv[1];
const identities = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const manifestRows = fs.readFileSync(path.join(reportRoot, "manifest.tsv"), "utf8")
  .trimEnd()
  .split("\n")
  .slice(1)
  .map((line) => line.split("\t"));
const pageIds = [String(identities.root_page.page_id), String(identities.child_page.page_id)];
const problems = [];

for (const pageId of pageIds) {
  const row = manifestRows.find((candidate) => candidate[0] === pageId);
  if (!row) {
    problems.push(`manifest:missing:${pageId}`);
    continue;
  }
  const folder = path.join(reportRoot, row[3]);
  for (const required of ["_info.txt", "_storage.xml", "page.md"]) {
    if (!fs.existsSync(path.join(folder, required))) problems.push(`missing:${pageId}:${required}`);
  }
}

if (problems.length) {
  console.error(problems.join("\\n"));
  process.exit(1);
}
' "$CONFLUEX_LIVE_REPORT_ROOT/export-keep-metadata" "$CONFLUEX_LIVE_IDENTITY_FILE"
  [ "$status" -eq 0 ] || live_fail_test "$output"
}

@test "export manifest folder paths use the docs-defined canonical per-page payload path" {
  rm -rf "$CONFLUEX_LIVE_REPORT_ROOT/export"
  run env HOME="$CONFLUEX_LIVE_CLI_HOME" \
    "$LIVE_CONFLUEX_REPO_ROOT/confluex" \
    export \
    --page-id "$ROOT_PAGE_ID" \
    --out "$CONFLUEX_LIVE_REPORT_ROOT/export"
  [ "$status" -eq 0 ]

  run node -e '
const fs = require("fs");
const path = require("path");
const reportRoot = process.argv[1];
const identities = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const manifestLines = fs.readFileSync(path.join(reportRoot, "manifest.tsv"), "utf8").trim().split("\n");
const rows = manifestLines.slice(1).map((line) => line.split("\t"));
const logicalPages = {
  root_page: "CX",
  child_page: "CX",
  grandchild_page: "CX",
  linked_page: "CX",
  cross_space_page: "AUX"
};
const hex = (value) => Buffer.from(value, "utf8").toString("hex").toUpperCase();
const problems = [];
for (const [logicalName, spaceKey] of Object.entries(logicalPages)) {
  const pageId = String(identities[logicalName].page_id);
  const row = rows.find((candidate) => candidate[0] === pageId);
  if (!row) {
    problems.push(`missing_manifest_row:${logicalName}`);
    continue;
  }
  const expectedFolder = `pages/space__${hex(spaceKey)}/page__${pageId}`;
  if (row[3] !== expectedFolder) {
    problems.push(`${logicalName}:${row[3]}!=${expectedFolder}`);
  }
}
if (problems.length) {
  console.error(problems.join("\\n"));
  process.exit(1);
}
' "$CONFLUEX_LIVE_REPORT_ROOT/export" "$CONFLUEX_LIVE_IDENTITY_FILE"
  [ "$status" -eq 0 ] || live_fail_test "$output"
}
