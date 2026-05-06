'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { evaluateEncryptionPreflight } = require('../../lib/confluex-node/encryption/recipient')

function options ({ flags = [], values = {} } = {}) {
  return { flags, values }
}

function storeWithDefault (value) {
  return {
    readDefaultEncryptionKey: () => value
  }
}

test('encryption preflight skips commands without encryption requested', () => {
  const result = evaluateEncryptionPreflight(options(), {
    store: storeWithDefault(null),
    recipientValidator: () => {
      throw new Error('validator must not run')
    }
  })

  assert.deepEqual(result, { state: 'skipped' })
})

test('explicit encryption key wins over saved default and validates recipient', () => {
  const validated = []

  const result = evaluateEncryptionPreflight(options({
    flags: ['--encrypt'],
    values: { '--encryption-key': 'explicit' }
  }), {
    store: storeWithDefault('saved'),
    recipientValidator: recipient => {
      validated.push(recipient)
      return true
    }
  })

  assert.deepEqual(result, { state: 'ok', recipient: 'explicit' })
  assert.deepEqual(validated, ['explicit'])
})

test('saved default recipient is used when explicit key is absent', () => {
  const result = evaluateEncryptionPreflight(options({ flags: ['--encrypt'] }), {
    store: storeWithDefault('saved'),
    recipientValidator: recipient => recipient === 'saved'
  })

  assert.deepEqual(result, { state: 'ok', recipient: 'saved' })
})

test('missing effective recipient rejects encrypted export-related invocations', () => {
  const result = evaluateEncryptionPreflight(options({ flags: ['--encrypt'] }), {
    store: storeWithDefault(null),
    recipientValidator: () => {
      throw new Error('validator must not run')
    }
  })

  assert.deepEqual(result, { state: 'rejected', requirementId: 'FR-0024' })
})

test('confidential mode rejects non-fingerprint recipient before gpg validation', () => {
  const result = evaluateEncryptionPreflight(options({
    flags: ['--confidential'],
    values: { '--encryption-key': 'not-a-fingerprint' }
  }), {
    store: storeWithDefault(null),
    recipientValidator: () => {
      throw new Error('validator must not run')
    }
  })

  assert.deepEqual(result, { state: 'rejected', requirementId: 'FR-0025' })
})

test('confidential mode normalizes a full fingerprint before validation', () => {
  const fingerprint = '0123456789abcdef0123456789abcdef01234567'
  const normalized = '0123456789ABCDEF0123456789ABCDEF01234567'
  const validated = []

  const result = evaluateEncryptionPreflight(options({
    flags: ['--confidential'],
    values: { '--encryption-key': fingerprint }
  }), {
    store: storeWithDefault(null),
    recipientValidator: recipient => {
      validated.push(recipient)
      return true
    }
  })

  assert.deepEqual(result, { state: 'ok', recipient: normalized })
  assert.deepEqual(validated, [normalized])
})

test('failed recipient validation rejects with FR-0108', () => {
  const result = evaluateEncryptionPreflight(options({
    flags: ['--encrypt'],
    values: { '--encryption-key': 'recipient' }
  }), {
    store: storeWithDefault(null),
    recipientValidator: () => false
  })

  assert.deepEqual(result, { state: 'rejected', requirementId: 'FR-0108' })
})
