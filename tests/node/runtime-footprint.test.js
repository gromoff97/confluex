'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const repoRoot = path.resolve(__dirname, '..', '..')

test('repository runtime footprint excludes removed legacy Bash roots', () => {
  assert.equal(fs.existsSync(path.join(repoRoot, 'lib', 'confluex')), false)
  assert.equal(fs.existsSync(path.join(repoRoot, 'scripts', 'selftest')), false)
  assert.equal(fs.existsSync(path.join(repoRoot, 'scripts', 'lint-js.sh')), false)
  assert.equal(fs.existsSync(path.join(repoRoot, 'scripts', 'lint-shell.sh')), false)
  assert.match(fs.readFileSync(path.join(repoRoot, 'confluex'), 'utf8'), /^#!\/usr\/bin\/env node\n/)
})

test('repository runtime footprint excludes removed encryption config workflow files', () => {
  assert.equal(fs.existsSync(path.join(repoRoot, 'lib', 'confluex-node', 'commands', 'config.js')), false)
  assert.equal(fs.existsSync(path.join(repoRoot, 'lib', 'confluex-node', 'config', 'store.js')), false)
  assert.equal(fs.existsSync(path.join(repoRoot, 'lib', 'confluex-node', 'encryption')), false)
})
