'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { runConfigCommand } = require('../../lib/confluex-node/commands/config')
const { createConfigStore } = require('../../lib/confluex-node/config/store')

function tempStore () {
  return createConfigStore({
    stateFile: path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-config-command-')), 'default-key.txt')
  })
}

function configOptions ({ key, clear = false } = {}) {
  return {
    flags: clear ? ['--clear-encryption-key'] : [],
    values: key === undefined ? {} : { '--encryption-key': key }
  }
}

test('read returns absence line when no default encryption key is saved', () => {
  const result = runConfigCommand(configOptions(), { store: tempStore() })

  assert.deepEqual(result, {
    exitCode: 0,
    stdout: 'default_encryption_key=none\n',
    stderr: ''
  })
})

test('save returns saved value line and later read returns same value', () => {
  const store = tempStore()

  assert.deepEqual(runConfigCommand(configOptions({ key: 'recipient' }), { store }), {
    exitCode: 0,
    stdout: 'default_encryption_key=recipient\n',
    stderr: ''
  })

  assert.deepEqual(runConfigCommand(configOptions(), { store }), {
    exitCode: 0,
    stdout: 'default_encryption_key=recipient\n',
    stderr: ''
  })
})

test('clear returns absence line and later read remains absent', () => {
  const store = tempStore()

  runConfigCommand(configOptions({ key: 'recipient' }), { store })

  assert.deepEqual(runConfigCommand(configOptions({ clear: true }), { store }), {
    exitCode: 0,
    stdout: 'default_encryption_key=none\n',
    stderr: ''
  })

  assert.deepEqual(runConfigCommand(configOptions(), { store }), {
    exitCode: 0,
    stdout: 'default_encryption_key=none\n',
    stderr: ''
  })
})

test('store failures return utility runtime failure result', () => {
  const store = {
    readDefaultEncryptionKey () {
      throw new Error('read failed')
    }
  }

  const result = runConfigCommand(configOptions(), { store })

  assert.equal(result.exitCode, 4)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, 'ERROR: runtime_failure config_state\n')
})
