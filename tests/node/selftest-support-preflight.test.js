'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { validateSelftestSupportPaths } = require('../../lib/confluex-node/selftest/support-preflight')

const REQUIRED_PAYLOADS = [
  'fixtures/confluence-7137/expected/payloads/md/root_page.page.md',
  'fixtures/confluence-7137/expected/payloads/md/child_page.page.md',
  'fixtures/confluence-7137/expected/payloads/md/grandchild_page.page.md',
  'fixtures/confluence-7137/expected/payloads/md/linked_page.page.md',
  'fixtures/confluence-7137/expected/payloads/md/linked_scope_linked_page.page.md',
  'fixtures/confluence-7137/expected/payloads/md/linked_scope_root.page.md',
  'fixtures/confluence-7137/expected/payloads/md/cross_space_page.page.md',
  'fixtures/confluence-7137/expected/payloads/md/markdown_page.page.md',
  'fixtures/confluence-7137/expected/payloads/md/download_limit_root_page.page.md'
]

const REQUIRED_STORAGE_FILES = [
  'fixtures/confluence-7137/content/pages/root_page.storage.xml',
  'fixtures/confluence-7137/content/pages/child_page.storage.xml',
  'fixtures/confluence-7137/content/pages/grandchild_page.storage.xml'
]

const REQUIRED_ATTACHMENTS = [
  'fixtures/confluence-7137/content/attachments/root_page/root-note.txt',
  'fixtures/confluence-7137/content/attachments/markdown_page/markdown-note.txt',
  'fixtures/confluence-7137/content/attachments/messy_attachment_page/notes-with-spaces.txt',
  'fixtures/confluence-7137/content/attachments/messy_attachment_page/data.csv',
  'fixtures/confluence-7137/content/attachments/messy_attachment_page/table-export-cyrillic.csv',
  'fixtures/confluence-7137/content/attachments/messy_links_page/link-targets.txt',
  'fixtures/confluence-7137/content/attachments/linked_page/out-of-tree-reference.txt'
]

const REQUIRED_OPAQUE_ATTACHMENTS = [
  'fixtures/confluence-7137/content/attachments/messy_attachment_page/blob.bin',
  'fixtures/confluence-7137/content/attachments/root_page/overview-chart.png',
  'fixtures/confluence-7137/content/attachments/root_page/summary-photo.jpg',
  'fixtures/confluence-7137/content/attachments/messy_attachment_page/diagram-final.png',
  'fixtures/confluence-7137/content/attachments/messy_attachment_page/diagram-final-copy.png',
  'fixtures/confluence-7137/content/attachments/messy_attachment_page/report-synthetic.pdf',
  'fixtures/confluence-7137/content/attachments/messy_attachment_page/empty-note.txt',
  'fixtures/confluence-7137/content/attachments/cross_space_page/aux-image.png'
]

const REQUIRED_GOLDEN_TEMPLATES = [
  'fixtures/confluence-7137/expected/golden/export-root-tree-md/summary.txt.template',
  'fixtures/confluence-7137/expected/golden/export-root-tree-md/manifest.tsv.template',
  'fixtures/confluence-7137/expected/golden/export-root-tree-md/resolved-links.tsv.template',
  'fixtures/confluence-7137/expected/golden/export-root-tree-md/unresolved-links.tsv.template',
  'fixtures/confluence-7137/expected/golden/export-root-tree-md/scope-findings.tsv.template',
  'fixtures/confluence-7137/expected/golden/export-root-tree-md/failed-pages.tsv.template'
]

function tempDir (prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

function writeFile (root, relativePath, content, encoding = 'utf8') {
  const absolutePath = path.join(root, relativePath)
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
  fs.writeFileSync(absolutePath, content, encoding)
}

function createValidSuiteRoot () {
  const root = tempDir('confluex-selftest-support-')

  fs.mkdirSync(path.join(root, 'tests/live-bats'), { recursive: true })
  writeFile(root, 'tests/live-bats/live-regression.bats', '#!/usr/bin/env bats\n')
  writeFile(root, 'fixtures/confluence-7137/content/manifest.json', '{"spaces":[],"pages":[],"attachments":[]}\n')
  writeFile(root, 'fixtures/confluence-7137/expected/live-commands.json', '{"commands":[]}\n')
  writeFile(root, 'fixtures/confluence-7137/expected/live-command-expectations.json', '{"expectations":[]}\n')
  writeFile(root, 'fixtures/confluence-7137/comparison-rules.json', '{"rules":[]}\n')

  for (const relativePath of REQUIRED_PAYLOADS) {
    writeFile(root, relativePath, `${relativePath}\n`)
  }

  for (const relativePath of REQUIRED_STORAGE_FILES) {
    writeFile(root, relativePath, '<p>fixture</p>\n')
  }

  for (const relativePath of REQUIRED_ATTACHMENTS) {
    writeFile(root, relativePath, `${relativePath}\n`)
  }

  for (const relativePath of REQUIRED_OPAQUE_ATTACHMENTS) {
    writeFile(root, relativePath, Buffer.from([0x00, 0xff, 0x42]), undefined)
  }
  writeFile(root, 'fixtures/confluence-7137/content/attachments/messy_attachment_page/empty-note.txt', '', undefined)

  for (const relativePath of REQUIRED_GOLDEN_TEMPLATES) {
    writeFile(root, relativePath, `${relativePath}\n`)
  }

  return root
}

test('selftest support preflight passes when every governed support path is present', () => {
  const root = createValidSuiteRoot()

  const result = validateSelftestSupportPaths(root)

  assert.deepEqual(result, { state: 'passed' })
})

test('checked out repository satisfies selftest support preflight', () => {
  const repoRoot = path.resolve(__dirname, '../..')

  const result = validateSelftestSupportPaths(repoRoot)

  assert.deepEqual(result, { state: 'passed' })
})

test('selftest support preflight fails when suite root is missing', () => {
  const root = path.join(tempDir('confluex-selftest-support-missing-root-'), 'missing')

  const result = validateSelftestSupportPaths(root)

  assert.deepEqual(result, { state: 'failed' })
})

test('selftest support preflight fails when live regression entrypoint is missing', () => {
  const root = createValidSuiteRoot()
  fs.rmSync(path.join(root, 'tests/live-bats/live-regression.bats'))

  const result = validateSelftestSupportPaths(root)

  assert.deepEqual(result, { state: 'failed' })
})

test('selftest support preflight fails when a JSON support file is not a JSON object', () => {
  const root = createValidSuiteRoot()
  writeFile(root, 'fixtures/confluence-7137/comparison-rules.json', '[]\n')

  const result = validateSelftestSupportPaths(root)

  assert.deepEqual(result, { state: 'failed' })
})

test('selftest support preflight fails when a payload file is empty', () => {
  const root = createValidSuiteRoot()
  writeFile(root, REQUIRED_PAYLOADS[0], '')

  const result = validateSelftestSupportPaths(root)

  assert.deepEqual(result, { state: 'failed' })
})

test('selftest support preflight fails when a payload file is not UTF-8 text', () => {
  const root = createValidSuiteRoot()
  writeFile(root, REQUIRED_PAYLOADS[1], Buffer.from([0xff, 0xfe]), undefined)

  const result = validateSelftestSupportPaths(root)

  assert.deepEqual(result, { state: 'failed' })
})

test('selftest support preflight fails when a golden template is empty', () => {
  const root = createValidSuiteRoot()
  writeFile(root, REQUIRED_GOLDEN_TEMPLATES[0], '')

  const result = validateSelftestSupportPaths(root)

  assert.deepEqual(result, { state: 'failed' })
})

test('selftest support preflight fails when a storage XML file is missing', () => {
  const root = createValidSuiteRoot()
  fs.rmSync(path.join(root, REQUIRED_STORAGE_FILES[0]))

  const result = validateSelftestSupportPaths(root)

  assert.deepEqual(result, { state: 'failed' })
})

test('selftest support preflight fails when a storage XML file is not UTF-8 text', () => {
  const root = createValidSuiteRoot()
  writeFile(root, REQUIRED_STORAGE_FILES[1], Buffer.from([0xff, 0xfe]), undefined)

  const result = validateSelftestSupportPaths(root)

  assert.deepEqual(result, { state: 'failed' })
})

test('selftest support preflight fails when an opaque attachment payload is missing', () => {
  const root = createValidSuiteRoot()
  fs.rmSync(path.join(root, REQUIRED_OPAQUE_ATTACHMENTS[0]))

  const result = validateSelftestSupportPaths(root)

  assert.deepEqual(result, { state: 'failed' })
})

test('selftest support preflight accepts required opaque attachments as raw files', () => {
  const root = createValidSuiteRoot()
  writeFile(root, REQUIRED_OPAQUE_ATTACHMENTS[1], Buffer.from([0xff, 0xfe]), undefined)

  const result = validateSelftestSupportPaths(root)

  assert.deepEqual(result, { state: 'passed' })
})
