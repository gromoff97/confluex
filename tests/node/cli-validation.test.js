'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { validateCommandInvocation } = require('../../dist/confluex-node/cli/validate')

test('valid invocation returns effective flags and last valued option value', () => {
  assert.deepEqual(validateCommandInvocation('export', [
    '--no-fail-fast',
    '--no-fail-fast',
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
      flags: ['--no-fail-fast', '--zip'],
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
  assert.deepEqual(validateCommandInvocation('export', [
    '--page-id',
    '123',
    '--not-a-real-option',
    '--another-unknown-option'
  ]), {
    kind: 'rejected',
    diagnostic: {
      type: 'unsupported-option',
      optionToken: '--not-a-real-option'
    }
  })
})

test('unsupported public command options are rejected', () => {
  for (const optionToken of [
    '--not-a-real-option',
    '--another-unknown-option',
    '--custom-token'
  ]) {
    assert.deepEqual(validateCommandInvocation('export', [
      '--page-id',
      '123',
      optionToken
    ]), {
      kind: 'rejected',
      diagnostic: {
        type: 'unsupported-option',
        optionToken
      }
    }, optionToken)
  }
})

test('resume is supported only by export and requires out', () => {
  assert.deepEqual(validateCommandInvocation('plan', [
    '--page-id',
    '123',
    '--resume'
  ]), {
    kind: 'rejected',
    diagnostic: {
      type: 'unsupported-option',
      optionToken: '--resume'
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

test('empty path-like values are invalid values', () => {
  assert.deepEqual(validateCommandInvocation('export', [
    '--page-id',
    '123',
    '--out',
    ''
  ]), {
    kind: 'rejected',
    diagnostic: {
      type: 'invalid-option-value',
      optionToken: '--out'
    }
  })

  assert.deepEqual(validateCommandInvocation('doctor', [
    '--env-file',
    ''
  ]), {
    kind: 'rejected',
    diagnostic: {
      type: 'invalid-option-value',
      optionToken: '--env-file'
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

test('missing required option is selected after other command-surface classes', () => {
  assert.deepEqual(validateCommandInvocation('export', []), {
    kind: 'rejected',
    diagnostic: {
      type: 'missing-required-option',
      optionToken: '--page-id'
    }
  })
})
