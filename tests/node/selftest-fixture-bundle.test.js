'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { loadFixtureBundle } = require('../../lib/confluex-node/selftest/fixture-bundle')

function tempDir (prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

function writeFile (root, relativePath, content) {
  const absolutePath = path.join(root, relativePath)
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
  fs.writeFileSync(absolutePath, content, 'utf8')
}

test('loadFixtureBundle loads the checked-in confluence-7137 bundle', () => {
  const repoRoot = path.resolve(__dirname, '../..')
  const bundle = loadFixtureBundle(repoRoot)

  assert.equal(bundle.spaces.length, 2)
  assert.equal(bundle.pages.find((page) => page.logicalName === 'root_page').bodyStoragePath, 'pages/root_page.storage.xml')
  assert.equal(bundle.attachments.find((attachment) => attachment.logicalName === 'root_attachment').attachmentPath, 'attachments/root_page/root-note.txt')
})

test('loadFixtureBundle rejects missing page files', () => {
  const root = tempDir('confluex-fixture-bundle-missing-page-')
  writeFile(root, 'tests/fixtures/confluence-7137/content/manifest.json', JSON.stringify({
    spaces: [{ logical_name: 'fixture_space', key: 'CX', name: 'Confluex Fixture Space' }],
    pages: [{ logical_name: 'missing', space: 'fixture_space', title: 'Missing', body_path: 'pages/missing.storage.xml' }],
    attachments: []
  }))

  assert.throws(() => loadFixtureBundle(root), /missing fixture page body/)
})

test('loadFixtureBundle rejects dangling structural references', () => {
  const root = tempDir('confluex-fixture-bundle-dangling-')
  writeFile(root, 'tests/fixtures/confluence-7137/content/manifest.json', JSON.stringify({
    spaces: [{ logical_name: 'fixture_space', key: 'CX', name: 'Confluex Fixture Space' }],
    pages: [{
      logical_name: 'broken',
      space: 'unknown_space',
      title: 'Broken',
      body_path: 'pages/broken.storage.xml',
      parent: 'missing_parent'
    }],
    attachments: [{
      logical_name: 'broken_attachment',
      page: 'missing_page',
      path: 'attachments/missing_page/broken.txt',
      media_type: 'text/plain'
    }]
  }))
  writeFile(root, 'tests/fixtures/confluence-7137/content/pages/broken.storage.xml', '<p>Broken</p>\n')
  writeFile(root, 'tests/fixtures/confluence-7137/content/attachments/missing_page/broken.txt', 'broken\n')

  assert.throws(() => loadFixtureBundle(root), /unknown fixture space|unknown fixture parent|attachment references unknown page/)
})
