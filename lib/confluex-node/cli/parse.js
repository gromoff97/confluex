'use strict'

const { isCommand } = require('./registry')
const { validateCommandInvocation } = require('./validate')

function parseInvocation (argv, defaultValues = {}) {
  if (argv.length === 0) {
    return { kind: 'top-help' }
  }

  if (argv.length === 1 && argv[0] === '--help') {
    return { kind: 'top-help' }
  }

  const commandToken = argv[0]

  if (!isCommand(commandToken)) {
    return {
      kind: 'rejected',
      diagnostic: {
        type: 'unknown-command',
        commandToken
      }
    }
  }

  if (argv.length === 2 && argv[1] === '--help') {
    return {
      kind: 'command-help',
      command: commandToken
    }
  }

  const validation = validateCommandInvocation(commandToken, argv.slice(1), defaultValues)
  if (validation.kind === 'rejected') {
    return validation
  }

  return {
    kind: 'command',
    command: commandToken,
    argv: argv.slice(1),
    options: validation.options
  }
}

module.exports = {
  parseInvocation
}
