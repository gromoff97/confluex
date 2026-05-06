'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { quotePathString, sortedManifestText } = require('../../lib/confluex-node/path/format')

test('quoted path string uses governed JSON-style escapes', () => {
  assert.equal(quotePathString('/tmp/confluex target'), '"/tmp/confluex target"')
  assert.equal(quotePathString('/tmp/"quoted"'), '"/tmp/\\"quoted\\""')
  assert.equal(quotePathString('/tmp/back\\slash'), '"/tmp/back\\\\slash"')
  assert.equal(quotePathString('/tmp/control\u0001'), '"/tmp/control\\u0001"')
})

test('manifest text sorts relative paths bytewise and ends with one LF', () => {
  assert.equal(sortedManifestText([
    'lib/confluex-node/main.js',
    'confluex',
    '.confluex-install-manifest.txt'
  ]), [
    '.confluex-install-manifest.txt',
    'confluex',
    'lib/confluex-node/main.js',
    ''
  ].join('\n'))
})
