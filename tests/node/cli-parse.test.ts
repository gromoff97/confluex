'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { parseInvocation } = require('../../dist/confluex-node/cli/parse')

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

test('parser rejects commands outside the public inventory before command work', () => {
  for (const command of ['config', 'install', 'uninstall']) {
    assert.deepEqual(parseInvocation([command]), {
      kind: 'rejected',
      diagnostic: {
        type: 'unknown-command',
        commandToken: command
      }
    })
  }
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
  assert.deepEqual(parseInvocation(['export', '--page-id', '123', '--zip']), {
    kind: 'command',
    command: 'export',
    argv: ['--page-id', '123', '--zip'],
    options: {
      flags: ['--zip'],
      values: {
        '--page-id': '123'
      }
    }
  })
})
