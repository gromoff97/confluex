import { isCommand } from './registry'
import { validateCommandInvocation, type EffectiveOptions, type ValidationOptions } from './validate'
import type { Diagnostic } from './diagnostics'

export type ParseResult =
  | { kind: 'top-help' }
  | { kind: 'command-help', command: string }
  | { kind: 'command', command: string, argv: string[], options: EffectiveOptions }
  | { kind: 'rejected', diagnostic: Diagnostic }

export function parseInvocation (
  argv: string[],
  defaultValues: Record<string, string> = {},
  options: ValidationOptions = {}
): ParseResult {
  if (argv.length === 0) {
    return { kind: 'top-help' }
  }

  if (argv.length === 1 && argv[0] === '--help') {
    return { kind: 'top-help' }
  }

  const commandToken = argv[0]
  if (commandToken === undefined) {
    return { kind: 'top-help' }
  }

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

  const commandArgv = argv.slice(1)
  const validation = validateCommandInvocation(commandToken, commandArgv, defaultValues, options)
  if (validation.kind === 'rejected') {
    return validation
  }

  return {
    kind: 'command',
    command: commandToken,
    argv: commandArgv,
    options: validation.options
  }
}
