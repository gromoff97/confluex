'use strict'

const { spawnSync } = require('node:child_process')

const { createConfigStore } = require('../config/store')

function evaluateEncryptionPreflight (options, dependencies = {}) {
  if (!encryptionRequested(options)) {
    return { state: 'skipped' }
  }

  const store = dependencies.store || createConfigStore()
  const recipientValidator = dependencies.recipientValidator || defaultRecipientValidator
  let recipient = effectiveRecipient(options, store)

  if (recipient === null) {
    return rejected('FR-0024')
  }

  if (options.flags.includes('--confidential')) {
    if (!/^[0-9A-Fa-f]{40}$/.test(recipient)) {
      return rejected('FR-0025')
    }
    recipient = recipient.toUpperCase()
  }

  if (!recipientValidator(recipient)) {
    return rejected('FR-0108')
  }

  return {
    state: 'ok',
    recipient
  }
}

function encryptionRequested (options) {
  return options.flags.includes('--encrypt') || options.flags.includes('--confidential')
}

function effectiveRecipient (options, store) {
  if (Object.prototype.hasOwnProperty.call(options.values, '--encryption-key')) {
    return options.values['--encryption-key']
  }

  return store.readDefaultEncryptionKey()
}

function defaultRecipientValidator (recipient) {
  const result = spawnSync('gpg', ['--list-keys', '--with-colons', recipient], {
    encoding: 'buffer'
  })

  return result.status === 0
}

function rejected (requirementId) {
  return {
    state: 'rejected',
    requirementId
  }
}

module.exports = {
  evaluateEncryptionPreflight,
  defaultRecipientValidator
}
