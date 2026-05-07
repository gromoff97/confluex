'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const repoRoot = path.resolve(__dirname, '..', '..')

test('repository runtime footprint excludes removed Bash roots', () => {
  assert.equal(fs.existsSync(path.join(repoRoot, 'lib', 'confluex')), false)
  assert.equal(fs.existsSync(path.join(repoRoot, 'lib', 'confluex-node')), false)
  assert.equal(fs.existsSync(path.join(repoRoot, 'scripts', 'lint-js.sh')), false)
  assert.equal(fs.existsSync(path.join(repoRoot, 'scripts', 'lint-shell.sh')), false)
  assert.match(fs.readFileSync(path.join(repoRoot, 'confluex'), 'utf8'), /^#!\/usr\/bin\/env node\n/)
})

test('repository runtime footprint excludes removed encryption config workflow files', () => {
  assert.equal(fs.existsSync(path.join(repoRoot, 'src', 'confluex-node', 'commands', 'config.ts')), false)
  assert.equal(fs.existsSync(path.join(repoRoot, 'src', 'confluex-node', 'config', 'store.ts')), false)
  assert.equal(fs.existsSync(path.join(repoRoot, 'src', 'confluex-node', 'encryption')), false)
})
