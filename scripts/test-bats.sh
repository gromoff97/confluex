#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STDOUT_FILE="$(mktemp "${TMPDIR:-/tmp}/confluex.selftest.stdout.XXXXXX")"
STDERR_FILE="$(mktemp "${TMPDIR:-/tmp}/confluex.selftest.stderr.XXXXXX")"
SELFTEST_STATUS=0

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    printf 'ERROR: %s is required\n' "$name" >&2
    exit 2
  fi
}

cleanup() {
  rm -f "$STDOUT_FILE" "$STDERR_FILE"
}
trap cleanup EXIT

require_env CONFLUEX_SELFTEST_URL
require_env CONFLUEX_SELFTEST_LOGIN
require_env CONFLUEX_SELFTEST_PASSWORD

set +e
"$ROOT_DIR/confluex" selftest \
  --url "$CONFLUEX_SELFTEST_URL" \
  --login "$CONFLUEX_SELFTEST_LOGIN" \
  --password "$CONFLUEX_SELFTEST_PASSWORD" \
  >"$STDOUT_FILE" 2>"$STDERR_FILE"
SELFTEST_STATUS=$?
set -e

cat "$STDOUT_FILE"
cat "$STDERR_FILE" >&2

if (( SELFTEST_STATUS != 0 )); then
  exit "$SELFTEST_STATUS"
fi

node - "$STDOUT_FILE" "$ROOT_DIR" <<'NODE'
const fs = require('fs');
const path = require('path');

const stdoutPath = process.argv[2];
const stdout = fs.readFileSync(stdoutPath, 'utf8');
const lines = stdout === '' ? [] : stdout.replace(/\n$/, '').split('\n');
const problems = [];
if (lines.length !== 1) {
  problems.push(`stdout_line_count:${lines.length}`);
}
if (lines.some((entry) => entry === '')) problems.push('stdout_blank_line');
const line = lines[0] || '';
const match = /^selftest_result=passed report_root=("(?:[^"\\]|\\.)*")$/.exec(line);
if (!match) {
  problems.push(`stdout_line:${line}`);
} else {
  const reportRoot = JSON.parse(match[1]);
  const summaryPath = path.join(reportRoot, 'summary.txt');
  const expectedKeys = [
    'command',
    'confluence_version',
    'fixture_dataset',
    'bootstrap_status',
    'fixture_apply_status',
    'prepare_expected_data_status',
    'live_regression_status',
    'selftest_status',
    'report_root'
  ];
  if (!fs.existsSync(summaryPath)) {
    problems.push('summary_missing');
  } else {
    const summaryLines = fs.readFileSync(summaryPath, 'utf8').trimEnd().split('\n');
    const summary = Object.fromEntries(summaryLines.map((entry) => {
      const idx = entry.indexOf('=');
      return [entry.slice(0, idx), entry.slice(idx + 1)];
    }));
    const actualKeys = summaryLines.map((entry) => entry.slice(0, entry.indexOf('=')));
    if (actualKeys.join('\n') !== expectedKeys.join('\n')) problems.push(`summary_key_order:${actualKeys.join(',')}`);
    if (summary.command !== 'selftest') problems.push(`command:${summary.command}`);
    if (summary.confluence_version !== '7.13.7') problems.push(`confluence_version:${summary.confluence_version}`);
    if (summary.fixture_dataset !== 'confluence-7137') problems.push(`fixture_dataset:${summary.fixture_dataset}`);
    for (const key of ['bootstrap_status', 'fixture_apply_status', 'prepare_expected_data_status', 'live_regression_status']) {
      if (summary[key] !== 'passed') problems.push(`${key}:${summary[key]}`);
    }
    if (summary.selftest_status !== 'passed') problems.push(`selftest_status:${summary.selftest_status}`);
    if (summary.report_root !== JSON.stringify(reportRoot)) problems.push(`report_root:${summary.report_root}`);
    const expectedEntries = ['summary.txt', 'identities.json', 'live-bats.tap', 'plan', 'export', 'expected', 'diagnostics'];
    for (const entry of expectedEntries) {
      const entryPath = path.join(reportRoot, entry);
      if (!fs.existsSync(entryPath)) {
        problems.push(`missing_report_entry:${entry}`);
        continue;
      }
      if (['plan', 'export', 'expected', 'diagnostics'].includes(entry) && !fs.statSync(entryPath).isDirectory()) {
        problems.push(`report_entry_not_directory:${entry}`);
      }
      if (!['plan', 'export', 'expected', 'diagnostics'].includes(entry) && !fs.statSync(entryPath).isFile()) {
        problems.push(`report_entry_not_file:${entry}`);
      }
    }
    const expectedJsonArtifacts = ['live-commands.json', 'live-command-expectations.json', 'comparison-rules.json'];
    for (const artifact of expectedJsonArtifacts) {
      const artifactPath = path.join(reportRoot, 'expected', artifact);
      if (!fs.existsSync(artifactPath)) {
        problems.push(`missing_expected_json:${artifact}`);
        continue;
      }
      const parsed = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) problems.push(`expected_json_not_object:${artifact}`);
    }
    const expectedPayloads = [
      'payloads/md/root_page.page.md',
      'payloads/md/child_page.page.md',
      'payloads/md/grandchild_page.page.md',
      'payloads/md/linked_page.page.md',
      'payloads/md/cross_space_page.page.md',
      'payloads/md/duplicate_title_secondary.page.md',
      'payloads/md/markdown_page.page.md',
      'payloads/html/root_page.page.html',
      'payloads/html/child_page.page.html',
      'payloads/html/grandchild_page.page.html',
      'payloads/html/linked_page.page.html',
      'payloads/html/cross_space_page.page.html',
      'payloads/html/duplicate_title_secondary.page.html',
      'payloads/html/markdown_page.page.html'
    ];
    for (const payload of expectedPayloads) {
      const payloadPath = path.join(reportRoot, 'expected', payload);
      if (!fs.existsSync(payloadPath)) {
        problems.push(`missing_expected_payload:${payload}`);
      } else if (fs.statSync(payloadPath).size === 0) {
        problems.push(`empty_expected_payload:${payload}`);
      }
    }
    const identitiesPath = path.join(reportRoot, 'identities.json');
    if (fs.existsSync(identitiesPath)) {
      const identities = JSON.parse(fs.readFileSync(identitiesPath, 'utf8'));
      const requiredPages = [
        'root_page',
        'child_page',
        'grandchild_page',
        'linked_page',
        'linked_scope_root',
        'linked_scope_linked_page',
        'linked_scope_linked_descendant',
        'linked_scope_link_of_link',
        'ambiguous_root_page',
        'scope_noise_root',
        'cross_space_page',
        'markdown_page',
        'duplicate_title_primary',
        'duplicate_title_secondary',
        'download_limit_root_page',
        'download_limit_child_a_page',
        'download_limit_child_b_page',
        'download_limit_child_c_page',
        'download_limit_child_d_page'
      ];
      const requiredSpaces = ['fixture_space', 'aux_space'];
      const requiredAttachments = ['root_attachment', 'markdown_attachment'];
      const expectedIdentityKeys = [...requiredPages, ...requiredSpaces, ...requiredAttachments].sort();
      if (!identities || typeof identities !== 'object' || Array.isArray(identities)) {
        problems.push('identities_not_object');
      } else if (Object.keys(identities).sort().join('\n') !== expectedIdentityKeys.join('\n')) {
        problems.push(`identities_keys:${Object.keys(identities).sort().join(',')}`);
      }
      for (const key of requiredPages) {
        const entry = identities[key];
        if (!entry || Object.keys(entry).sort().join(',') !== 'page_id,space_key,title') problems.push(`identity_page_keys:${key}`);
        if (!/^[0-9]+$/.test(entry?.page_id || '')) problems.push(`identity_page_id:${key}`);
        if (typeof entry?.title !== 'string' || entry.title.length === 0) problems.push(`identity_page_title:${key}`);
        if (typeof entry?.space_key !== 'string' || entry.space_key.length === 0) problems.push(`identity_page_space_key:${key}`);
      }
      for (const key of requiredSpaces) {
        const entry = identities[key];
        if (!entry || Object.keys(entry).sort().join(',') !== 'space_key,space_name') problems.push(`identity_space_keys:${key}`);
        if (typeof entry?.space_key !== 'string' || entry.space_key.length === 0) problems.push(`identity_space_key:${key}`);
        if (typeof entry?.space_name !== 'string' || entry.space_name.length === 0) problems.push(`identity_space_name:${key}`);
      }
      for (const key of requiredAttachments) {
        const entry = identities[key];
        if (!entry || Object.keys(entry).sort().join(',') !== 'filename,page_id') problems.push(`identity_attachment_keys:${key}`);
        if (!/^[0-9]+$/.test(entry?.page_id || '')) problems.push(`identity_attachment_page_id:${key}`);
        if (typeof entry?.filename !== 'string' || entry.filename.length === 0) problems.push(`identity_attachment_filename:${key}`);
      }
    }
    const tapPath = path.join(reportRoot, 'live-bats.tap');
    if (fs.existsSync(tapPath) && fs.statSync(tapPath).size === 0) {
      problems.push('empty_live_bats_tap');
    } else if (fs.existsSync(tapPath)) {
      const tapLines = fs.readFileSync(tapPath, 'utf8').trimEnd().split('\n');
      const actualLiveFiles = tapLines
        .filter((entry) => entry.startsWith('# live-bats-file '))
        .map((entry) => entry.slice('# live-bats-file '.length));
      const expectedLiveFiles = ['tests/live-bats/live-regression.bats'];
      const expectedPrefix = expectedLiveFiles.map((file) => `# live-bats-file ${file}`);
      const actualPrefix = tapLines.slice(0, expectedPrefix.length);
      if (actualPrefix.join('\n') !== expectedPrefix.join('\n')) {
        problems.push(`live_bats_file_prefix:${actualPrefix.join(',')}`);
      }
      if (actualLiveFiles.join('\n') !== expectedLiveFiles.join('\n')) {
        problems.push(`live_bats_file_list:${actualLiveFiles.join(',')}`);
      }
      if (new Set(actualLiveFiles).size !== actualLiveFiles.length) problems.push('live_bats_file_list_duplicates');
    }
  }
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
NODE
