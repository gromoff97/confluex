'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { quotePathString } = require('../../dist/confluex-node/path/format')

test('quoted path string uses governed JSON-style escapes', () => {
  assert.equal(quotePathString('/tmp/confluex target'), '"/tmp/confluex target"')
  assert.equal(quotePathString('/tmp/"quoted"'), '"/tmp/\\"quoted\\""')
  assert.equal(quotePathString('/tmp/back\\slash'), '"/tmp/back\\\\slash"')
  assert.equal(quotePathString('/tmp/control\u0001'), '"/tmp/control\\u0001"')
})
