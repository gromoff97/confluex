'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { parseInvocation } = require('../../lib/confluex-node/cli/parse')

test('parser recognizes exact top-level help shapes', () => {
  assert.deepEqual(parseInvocation([]), { kind: 'top-help' })
  assert.deepEqual(parseInvocation(['--help']), { kind: 'top-help' })
})

test('parser recognizes exact command help shape only', () => {
  assert.deepEqual(parseInvocation(['export', '--help']), {
    kind: 'command-help',
    command: 'export'
  })

  assert.deepEqual(parseInvocation(['export', '--help', 'extra']), {
    kind: 'rejected',
    diagnostic: {
      type: 'unsupported-option',
      optionToken: '--help'
    }
  })
})

test('parser rejects unsupported command before command work', () => {
  assert.deepEqual(parseInvocation(['bogus']), {
    kind: 'rejected',
    diagnostic: {
      type: 'unknown-command',
      commandToken: 'bogus'
    }
  })
})

test('parser rejects invalid known command argv before command dispatch', () => {
  assert.deepEqual(parseInvocation(['export']), {
    kind: 'rejected',
    diagnostic: {
      type: 'missing-required-option',
      optionToken: '--page-id'
    }
  })
})

test('parser returns effective options for valid known command argv', () => {
  assert.deepEqual(parseInvocation(['export', '--page-id', '123', '--safe']), {
    kind: 'command',
    command: 'export',
    argv: ['--page-id', '123', '--safe'],
    options: {
      flags: ['--safe'],
      values: {
        '--page-id': '123'
      }
    }
  })
})

test('parser returns explicit selftest target options for valid selftest argv', () => {
  assert.deepEqual(parseInvocation([
    'selftest',
    '--url',
    'http://127.0.0.1:8090',
    '--token',
    'test-token'
  ]), {
    kind: 'command',
    command: 'selftest',
    argv: ['--url', 'http://127.0.0.1:8090', '--token', 'test-token'],
    options: {
      flags: [],
      values: {
        '--url': 'http://127.0.0.1:8090',
        '--token': 'test-token'
      }
    }
  })
})
