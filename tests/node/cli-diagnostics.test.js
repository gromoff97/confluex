'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { diagnosticToken, formatDiagnostic } = require('../../lib/confluex-node/cli/diagnostics')

test('diagnostic token percent-encodes unsafe bytes', () => {
  assert.equal(diagnosticToken('bad command'), 'bad%20command')
  assert.equal(diagnosticToken('100%'), '100%25')
  assert.equal(diagnosticToken('é'), '%C3%A9')
})

test('validation diagnostics use governed first-line templates', () => {
  assert.equal(formatDiagnostic({
    type: 'unknown-command',
    commandToken: 'bad command'
  }), 'ERROR: unknown_command bad%20command')

  assert.equal(formatDiagnostic({
    type: 'missing-option-value',
    optionToken: '--page-id'
  }), 'ERROR: missing_option_value --page-id')

  assert.equal(formatDiagnostic({
    type: 'unsupported-option',
    optionToken: '--bad option'
  }), 'ERROR: unsupported_option --bad%20option')

  assert.equal(formatDiagnostic({
    type: 'unsupported-positional-operand',
    operandToken: 'extra value'
  }), 'ERROR: unsupported_positional_operand extra%20value')

  assert.equal(formatDiagnostic({
    type: 'invalid-option-value',
    optionToken: '--max-pages'
  }), 'ERROR: invalid_option_value --max-pages')

  assert.equal(formatDiagnostic({
    type: 'invalid-option-combination',
    optionTokens: ['--out', '--resume']
  }), 'ERROR: invalid_option_combination --out,--resume')

  assert.equal(formatDiagnostic({
    type: 'missing-required-option',
    optionToken: '--page-id'
  }), 'ERROR: missing_required_option --page-id')

  assert.equal(formatDiagnostic({
    type: 'validation-failed-page-id',
    requirementId: 'FR-0017',
    pageId: '12 3'
  }), 'ERROR: validation_failed FR-0017 --page-id 12%203')

  assert.equal(formatDiagnostic({
    type: 'validation-failed',
    requirementId: 'FR-0108'
  }), 'ERROR: validation_failed FR-0108')
})
