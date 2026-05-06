'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { createConfigStore } = require('../../lib/confluex-node/config/store')

function tempStateFile () {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-config-store-')), 'default-key.txt')
}

test('missing default encryption key state reads as absent', () => {
  const store = createConfigStore({ stateFile: tempStateFile() })

  assert.equal(store.readDefaultEncryptionKey(), null)
})

test('saved default encryption key is persisted as UTF-8 text', () => {
  const stateFile = tempStateFile()
  const store = createConfigStore({ stateFile })

  store.saveDefaultEncryptionKey('recipient')

  assert.equal(store.readDefaultEncryptionKey(), 'recipient')
  assert.equal(fs.readFileSync(stateFile, 'utf8'), 'recipient\n')
})

test('cleared default encryption key is absent and clear is idempotent', () => {
  const store = createConfigStore({ stateFile: tempStateFile() })

  store.saveDefaultEncryptionKey('recipient')
  store.clearDefaultEncryptionKey()
  store.clearDefaultEncryptionKey()

  assert.equal(store.readDefaultEncryptionKey(), null)
})

test('temp write failure preserves existing saved default encryption key', () => {
  const stateFile = tempStateFile()
  const store = createConfigStore({
    stateFile,
    fsApi: {
      ...fs,
      writeFileSync (target, data, options) {
        if (path.basename(target).startsWith('.default-encryption-key.')) {
          throw new Error('simulated temp write failure')
        }

        return fs.writeFileSync(target, data, options)
      }
    }
  })

  fs.mkdirSync(path.dirname(stateFile), { recursive: true })
  fs.writeFileSync(stateFile, 'existing\n', 'utf8')

  assert.throws(() => store.saveDefaultEncryptionKey('replacement'), /simulated temp write failure/)
  assert.equal(fs.readFileSync(stateFile, 'utf8'), 'existing\n')
  assert.equal(store.readDefaultEncryptionKey(), 'existing')
})
