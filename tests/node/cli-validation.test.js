'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { validateCommandInvocation } = require('../../lib/confluex-node/cli/validate')

test('valid invocation returns effective flags and last valued option value', () => {
  assert.deepEqual(validateCommandInvocation('export', [
    '--safe',
    '--safe',
    '--zip',
    '--zip',
    '--page-id',
    '0',
    '--page-id',
    '123',
    '--link-depth',
    '0',
    '--link-depth',
    '2'
  ]), {
    kind: 'valid',
    options: {
      flags: ['--safe', '--zip'],
      values: {
        '--page-id': '123',
        '--link-depth': '2'
      }
    }
  })
})

test('zip is supported only as an export flag', () => {
  assert.deepEqual(validateCommandInvocation('export', [
    '--page-id',
    '123',
    '--zip'
  ]), {
    kind: 'valid',
    options: {
      flags: ['--zip'],
      values: {
        '--page-id': '123'
      }
    }
  })

  assert.deepEqual(validateCommandInvocation('plan', [
    '--page-id',
    '123',
    '--zip'
  ]), {
    kind: 'rejected',
    diagnostic: {
      type: 'unsupported-option',
      optionToken: '--zip'
    }
  })
})

test('missing option value takes precedence over earlier unsupported option', () => {
  assert.deepEqual(validateCommandInvocation('export', ['--bad', '--page-id']), {
    kind: 'rejected',
    diagnostic: {
      type: 'missing-option-value',
      optionToken: '--page-id'
    }
  })
})

test('valued options consume the next argv token even when it looks like an option', () => {
  assert.deepEqual(validateCommandInvocation('export', ['--page-id', '--bad']), {
    kind: 'rejected',
    diagnostic: {
      type: 'invalid-option-value',
      optionToken: '--page-id'
    }
  })
})

test('unsupported option selects earliest raw option token', () => {
  assert.deepEqual(validateCommandInvocation('selftest', [
    '--url',
    'http://127.0.0.1:8090',
    '--token',
    'test-token',
    '--safe',
    '--critical'
  ]), {
    kind: 'rejected',
    diagnostic: {
      type: 'unsupported-option',
      optionToken: '--safe'
    }
  })
})

test('selftest requires explicit target options before command work', () => {
  assert.deepEqual(validateCommandInvocation('selftest', []), {
    kind: 'rejected',
    diagnostic: {
      type: 'missing-required-option',
      optionToken: '--url'
    }
  })

  assert.deepEqual(validateCommandInvocation('selftest', [
    '--url',
    'http://127.0.0.1:8090'
  ]), {
    kind: 'rejected',
    diagnostic: {
      type: 'missing-required-option',
      optionToken: '--token'
    }
  })
})

test('selftest target options reject empty and control-containing values', () => {
  assert.deepEqual(validateCommandInvocation('selftest', [
    '--url',
    '',
    '--token',
    'test-token'
  ]), {
    kind: 'rejected',
    diagnostic: {
      type: 'invalid-option-value',
      optionToken: '--url'
    }
  })

  assert.deepEqual(validateCommandInvocation('selftest', [
    '--url',
    'http://127.0.0.1:8090',
    '--token',
    'bad\ttoken'
  ]), {
    kind: 'rejected',
    diagnostic: {
      type: 'invalid-option-value',
      optionToken: '--token'
    }
  })
})

test('selftest valid invocation returns explicit target values', () => {
  assert.deepEqual(validateCommandInvocation('selftest', [
    '--url',
    'http://127.0.0.1:8090',
    '--token',
    'test-token'
  ]), {
    kind: 'valid',
    options: {
      flags: [],
      values: {
        '--url': 'http://127.0.0.1:8090',
        '--token': 'test-token'
      }
    }
  })
})

test('unsupported positional operand selects earliest unconsumed non-option token', () => {
  assert.deepEqual(validateCommandInvocation('export', ['--page-id', '123', 'extra']), {
    kind: 'rejected',
    diagnostic: {
      type: 'unsupported-positional-operand',
      operandToken: 'extra'
    }
  })
})

test('invalid effective option value selects earliest supported option list token', () => {
  assert.deepEqual(validateCommandInvocation('export', [
    '--page-id',
    '123',
    '--max-download-mib',
    'bad',
    '--max-pages',
    '0'
  ]), {
    kind: 'rejected',
    diagnostic: {
      type: 'invalid-option-value',
      optionToken: '--max-pages'
    }
  })
})

test('removed page format option is rejected before command work', () => {
  assert.deepEqual(validateCommandInvocation('export', [
    '--page-id',
    '123',
    '--page-format',
    'html'
  ]), {
    kind: 'rejected',
    diagnostic: {
      type: 'unsupported-option',
      optionToken: '--page-format'
    }
  })

  assert.deepEqual(validateCommandInvocation('export', [
    '--page-id',
    '123',
    '--page-format'
  ]), {
    kind: 'rejected',
    diagnostic: {
      type: 'unsupported-option',
      optionToken: '--page-format'
    }
  })
})

test('invalid link depth is rejected before command work', () => {
  assert.deepEqual(validateCommandInvocation('plan', [
    '--page-id',
    '123',
    '--link-depth',
    '-1'
  ]), {
    kind: 'rejected',
    diagnostic: {
      type: 'invalid-option-value',
      optionToken: '--link-depth'
    }
  })

  assert.deepEqual(validateCommandInvocation('plan', [
    '--page-id',
    '123',
    '--link-depth',
    '01'
  ]), {
    kind: 'rejected',
    diagnostic: {
      type: 'invalid-option-value',
      optionToken: '--link-depth'
    }
  })
})

test('empty path-like and encryption values are invalid values', () => {
  assert.deepEqual(validateCommandInvocation('config', ['--encryption-key', 'none']), {
    kind: 'rejected',
    diagnostic: {
      type: 'invalid-option-value',
      optionToken: '--encryption-key'
    }
  })
})

test('invalid combinations select bytewise-smallest serialized option token list', () => {
  assert.deepEqual(validateCommandInvocation('export', [
    '--page-id',
    '123',
    '--critical',
    '--confidential',
    '--no-fail-fast'
  ]), {
    kind: 'rejected',
    diagnostic: {
      type: 'invalid-option-combination',
      optionTokens: ['--confidential', '--no-fail-fast']
    }
  })
})

test('command-specific invalid combinations are rejected', () => {
  assert.deepEqual(validateCommandInvocation('config', [
    '--clear-encryption-key',
    '--encryption-key',
    'recipient'
  ]), {
    kind: 'rejected',
    diagnostic: {
      type: 'invalid-option-combination',
      optionTokens: ['--clear-encryption-key', '--encryption-key']
    }
  })

  assert.deepEqual(validateCommandInvocation('doctor', [
    '--encryption-key',
    'recipient'
  ]), {
    kind: 'rejected',
    diagnostic: {
      type: 'invalid-option-combination',
      optionTokens: ['--encryption-key', '--verify-encryption']
    }
  })

  assert.deepEqual(validateCommandInvocation('export', [
    '--page-id',
    '123',
    '--resume'
  ]), {
    kind: 'rejected',
    diagnostic: {
      type: 'invalid-option-combination',
      optionTokens: ['--out', '--resume']
    }
  })
})

test('missing required option is selected after other command-surface classes', () => {
  assert.deepEqual(validateCommandInvocation('export', []), {
    kind: 'rejected',
    diagnostic: {
      type: 'missing-required-option',
      optionToken: '--page-id'
    }
  })
})
