'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const repoRoot = path.resolve(__dirname, '..', '..')

test('repository runtime footprint excludes removed legacy Bash roots', () => {
  assert.equal(fs.existsSync(path.join(repoRoot, 'lib', 'confluex')), false)
  assert.equal(fs.existsSync(path.join(repoRoot, 'scripts', 'selftest')), false)
})
