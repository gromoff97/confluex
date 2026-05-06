'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { TextDecoder } = require('node:util')

const REQUIRED_JSON_OBJECTS = [
  'fixtures/confluence-7137/content/manifest.json',
  'fixtures/confluence-7137/expected/live-commands.json',
  'fixtures/confluence-7137/expected/live-command-expectations.json',
  'fixtures/confluence-7137/comparison-rules.json'
]

const REQUIRED_STORAGE_SOURCE_PATHS = [
  'fixtures/confluence-7137/content/pages/root_page.storage.xml',
  'fixtures/confluence-7137/content/pages/child_page.storage.xml',
  'fixtures/confluence-7137/content/pages/grandchild_page.storage.xml'
]

const REQUIRED_ATTACHMENT_SOURCE_PATHS = [
  'fixtures/confluence-7137/content/attachments/root_page/root-note.txt',
  'fixtures/confluence-7137/content/attachments/markdown_page/markdown-note.txt',
  'fixtures/confluence-7137/content/attachments/messy_attachment_page/notes-with-spaces.txt',
  'fixtures/confluence-7137/content/attachments/messy_attachment_page/data.csv',
  'fixtures/confluence-7137/content/attachments/messy_attachment_page/table-export-cyrillic.csv',
  'fixtures/confluence-7137/content/attachments/messy_links_page/link-targets.txt',
  'fixtures/confluence-7137/content/attachments/linked_page/out-of-tree-reference.txt'
]

const REQUIRED_OPAQUE_ATTACHMENT_SOURCE_PATHS = [
  'fixtures/confluence-7137/content/attachments/messy_attachment_page/blob.bin',
  'fixtures/confluence-7137/content/attachments/root_page/overview-chart.png',
  'fixtures/confluence-7137/content/attachments/root_page/summary-photo.jpg',
  'fixtures/confluence-7137/content/attachments/messy_attachment_page/diagram-final.png',
  'fixtures/confluence-7137/content/attachments/messy_attachment_page/diagram-final-copy.png',
  'fixtures/confluence-7137/content/attachments/messy_attachment_page/report-synthetic.pdf',
  'fixtures/confluence-7137/content/attachments/messy_attachment_page/empty-note.txt',
  'fixtures/confluence-7137/content/attachments/cross_space_page/aux-image.png'
]

const REQUIRED_PAYLOAD_SOURCE_PATHS = [
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

const REQUIRED_GOLDEN_SOURCE_PATHS = [
  'fixtures/confluence-7137/expected/golden/export-root-tree-md/summary.txt.template',
  'fixtures/confluence-7137/expected/golden/export-root-tree-md/manifest.tsv.template',
  'fixtures/confluence-7137/expected/golden/export-root-tree-md/resolved-links.tsv.template',
  'fixtures/confluence-7137/expected/golden/export-root-tree-md/unresolved-links.tsv.template',
  'fixtures/confluence-7137/expected/golden/export-root-tree-md/scope-findings.tsv.template',
  'fixtures/confluence-7137/expected/golden/export-root-tree-md/failed-pages.tsv.template'
]

function validateSelftestSupportPaths (runtimeRoot) {
  if (typeof runtimeRoot !== 'string' || runtimeRoot.length === 0) {
    return { state: 'failed' }
  }

  const suiteRoot = path.resolve(runtimeRoot)

  if (!isDirectory(suiteRoot)) {
    return { state: 'failed' }
  }

  if (!isDirectory(path.join(suiteRoot, 'tests/live-bats'))) {
    return { state: 'failed' }
  }

  if (!isRegularFile(path.join(suiteRoot, 'tests/live-bats/live-regression.bats'))) {
    return { state: 'failed' }
  }

  for (const relativePath of REQUIRED_JSON_OBJECTS) {
    if (!isUtf8JsonObject(path.join(suiteRoot, relativePath))) {
      return { state: 'failed' }
    }
  }

  for (const relativePath of REQUIRED_PAYLOAD_SOURCE_PATHS) {
    if (!isNonEmptyUtf8TextFile(path.join(suiteRoot, relativePath))) {
      return { state: 'failed' }
    }
  }

  for (const relativePath of REQUIRED_GOLDEN_SOURCE_PATHS) {
    if (!isNonEmptyUtf8TextFile(path.join(suiteRoot, relativePath))) {
      return { state: 'failed' }
    }
  }

  for (const relativePath of REQUIRED_STORAGE_SOURCE_PATHS) {
    if (!isNonEmptyUtf8TextFile(path.join(suiteRoot, relativePath))) {
      return { state: 'failed' }
    }
  }

  for (const relativePath of REQUIRED_ATTACHMENT_SOURCE_PATHS) {
    if (!isNonEmptyUtf8TextFile(path.join(suiteRoot, relativePath))) {
      return { state: 'failed' }
    }
  }

  for (const relativePath of REQUIRED_OPAQUE_ATTACHMENT_SOURCE_PATHS) {
    if (!isRegularFile(path.join(suiteRoot, relativePath))) {
      return { state: 'failed' }
    }
  }

  return { state: 'passed' }
}

function isDirectory (absolutePath) {
  try {
    return fs.lstatSync(absolutePath).isDirectory()
  } catch {
    return false
  }
}

function isRegularFile (absolutePath) {
  try {
    return fs.lstatSync(absolutePath).isFile()
  } catch {
    return false
  }
}

function isUtf8JsonObject (absolutePath) {
  if (!isRegularFile(absolutePath)) {
    return false
  }

  try {
    const value = JSON.parse(decodeUtf8File(absolutePath))
    return value !== null && typeof value === 'object' && !Array.isArray(value)
  } catch {
    return false
  }
}

function isNonEmptyUtf8TextFile (absolutePath) {
  if (!isRegularFile(absolutePath)) {
    return false
  }

  try {
    return decodeUtf8File(absolutePath).length > 0
  } catch {
    return false
  }
}

function decodeUtf8File (absolutePath) {
  const decoder = new TextDecoder('utf-8', { fatal: true })
  return decoder.decode(fs.readFileSync(absolutePath))
}

module.exports = {
  REQUIRED_ATTACHMENT_SOURCE_PATHS,
  REQUIRED_GOLDEN_SOURCE_PATHS,
  REQUIRED_OPAQUE_ATTACHMENT_SOURCE_PATHS,
  REQUIRED_PAYLOAD_SOURCE_PATHS,
  REQUIRED_STORAGE_SOURCE_PATHS,
  validateSelftestSupportPaths
}
