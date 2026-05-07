export type Diagnostic =
  | { type: 'unknown-command', commandToken: string }
  | { type: 'missing-option-value', optionToken: string }
  | { type: 'unsupported-option', optionToken: string }
  | { type: 'unsupported-positional-operand', operandToken: string }
  | { type: 'invalid-option-value', optionToken: string }
  | { type: 'invalid-option-combination', optionTokens: string[] }
  | { type: 'missing-required-option', optionToken: string }
  | { type: 'validation-failed', requirementId: string }
  | { type: 'validation-failed-page-id', requirementId: string, pageId: string }
  | { type: 'development-pending', command: string }

export function diagnosticToken (value: string): string {
  const bytes = Buffer.from(value, 'utf8')
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

function tokenList (tokens: string[]): string {
  return tokens.join(',')
}

export function formatDiagnostic (diagnostic: Diagnostic): string {
  switch (diagnostic.type) {
    case 'unknown-command':
      return `ERROR: unknown_command ${diagnosticToken(diagnostic.commandToken)}`
    case 'missing-option-value':
      return `ERROR: missing_option_value ${diagnostic.optionToken}`
    case 'unsupported-option':
      return `ERROR: unsupported_option ${diagnosticToken(diagnostic.optionToken)}`
    case 'unsupported-positional-operand':
      return `ERROR: unsupported_positional_operand ${diagnosticToken(diagnostic.operandToken)}`
    case 'invalid-option-value':
      return `ERROR: invalid_option_value ${diagnostic.optionToken}`
    case 'invalid-option-combination':
      return `ERROR: invalid_option_combination ${tokenList(diagnostic.optionTokens)}`
    case 'missing-required-option':
      return `ERROR: missing_required_option ${diagnostic.optionToken}`
    case 'validation-failed':
      return `ERROR: validation_failed ${diagnostic.requirementId}`
    case 'validation-failed-page-id':
      return `ERROR: validation_failed ${diagnostic.requirementId} --page-id ${diagnosticToken(diagnostic.pageId)}`
    case 'development-pending':
      return `ERROR: development_pending ${diagnosticToken(diagnostic.command)}`
  }
}
