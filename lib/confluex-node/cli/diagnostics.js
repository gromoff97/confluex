'use strict'

function diagnosticToken (value) {
  const bytes = Buffer.from(String(value), 'utf8')
  let output = ''

  for (const byte of bytes) {
    if (byte >= 0x21 && byte <= 0x7e && byte !== 0x25) {
      output += String.fromCharCode(byte)
    } else {
      output += `%${byte.toString(16).toUpperCase().padStart(2, '0')}`
    }
  }

  return output
}

function tokenList (tokens) {
  return tokens.join(',')
}

function formatDiagnostic (diagnostic) {
  if (diagnostic.type === 'unknown-command') {
    return `ERROR: unknown_command ${diagnosticToken(diagnostic.commandToken)}`
  }

  if (diagnostic.type === 'missing-option-value') {
    return `ERROR: missing_option_value ${diagnostic.optionToken}`
  }

  if (diagnostic.type === 'unsupported-option') {
    return `ERROR: unsupported_option ${diagnosticToken(diagnostic.optionToken)}`
  }

  if (diagnostic.type === 'unsupported-positional-operand') {
    return `ERROR: unsupported_positional_operand ${diagnosticToken(diagnostic.operandToken)}`
  }

  if (diagnostic.type === 'invalid-option-value') {
    return `ERROR: invalid_option_value ${diagnostic.optionToken}`
  }

  if (diagnostic.type === 'invalid-option-combination') {
    return `ERROR: invalid_option_combination ${tokenList(diagnostic.optionTokens)}`
  }

  if (diagnostic.type === 'missing-required-option') {
    return `ERROR: missing_required_option ${diagnostic.optionToken}`
  }

  if (diagnostic.type === 'validation-failed') {
    return `ERROR: validation_failed ${diagnostic.requirementId}`
  }

  if (diagnostic.type === 'validation-failed-page-id') {
    return `ERROR: validation_failed ${diagnostic.requirementId} --page-id ${diagnosticToken(diagnostic.pageId)}`
  }

  if (diagnostic.type === 'development-pending') {
    return `ERROR: development_pending ${diagnosticToken(diagnostic.command)}`
  }

  throw new Error(`unsupported diagnostic type: ${diagnostic.type}`)
}

module.exports = {
  diagnosticToken,
  formatDiagnostic
}
