'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { encryptOutputRoot, instructionSidecarText } = require('../../lib/confluex-node/encryption/archive')
const { quotePathString } = require('../../lib/confluex-node/path/format')

test('encrypted instruction sidecar text uses governed paths and argv JSON', () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-sidecar-text-'))
  const out = path.join(parent, 'out')
  const archivePath = `${out}.tar.gz.gpg`
  const decryptOutputPath = `${out}.tar.gz`

  assert.equal(instructionSidecarText(out), [
    `archive_path=${quotePathString(archivePath)}`,
    `decrypt_output_path=${quotePathString(decryptOutputPath)}`,
    `extract_directory_path=${quotePathString(parent)}`,
    `decrypt_argv_json=["gpg","--output",${quotePathString(decryptOutputPath)},"--decrypt",${quotePathString(archivePath)}]`,
    `extract_argv_json=["tar","-xzf",${quotePathString(decryptOutputPath)},"-C",${quotePathString(parent)}]`,
    ''
  ].join('\n'))
})

test('encryptOutputRoot rejects pre-existing archive path without modifying plaintext root', async () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-archive-existing-'))
  const out = path.join(parent, 'out')
  const archivePath = `${out}.tar.gz.gpg`
  fs.mkdirSync(out)
  fs.writeFileSync(path.join(out, 'summary.txt'), 'plain root')
  fs.writeFileSync(archivePath, 'pre-existing archive')
  let createArchiveCalled = false

  const result = await encryptOutputRoot(out, 'recipient', {
    createEncryptedArchive: async () => {
      createArchiveCalled = true
      throw new Error('archive creation must not run')
    }
  })

  assert.deepEqual(result, { state: 'failed' })
  assert.equal(createArchiveCalled, false)
  assert.equal(fs.existsSync(out), true)
  assert.equal(fs.readFileSync(path.join(out, 'summary.txt'), 'utf8'), 'plain root')
  assert.equal(fs.readFileSync(archivePath, 'utf8'), 'pre-existing archive')
})
