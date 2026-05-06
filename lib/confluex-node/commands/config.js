'use strict'

const { createConfigStore } = require('../config/store')

function runConfigCommand (options, dependencies = {}) {
  const store = dependencies.store || createConfigStore()

  try {
    if (Object.prototype.hasOwnProperty.call(options.values, '--encryption-key')) {
      const value = options.values['--encryption-key']
      store.saveDefaultEncryptionKey(value)
      return successResult(value)
    }

    if (options.flags.includes('--clear-encryption-key')) {
      store.clearDefaultEncryptionKey()
      return successResult(null)
    }

    return successResult(store.readDefaultEncryptionKey())
  } catch {
    return {
      exitCode: 4,
      stdout: '',
      stderr: 'ERROR: runtime_failure config_state\n'
    }
  }
}

function successResult (value) {
  return {
    exitCode: 0,
    stdout: `default_encryption_key=${value === null ? 'none' : value}\n`,
    stderr: ''
  }
}

module.exports = {
  runConfigCommand
}
