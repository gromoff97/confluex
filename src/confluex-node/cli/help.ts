import { allCommands, findCommand, type OptionDefinition } from './registry'

function linesToText (lines: string[]): string {
  return `${lines.join('\n')}\n`
}

export function commandNames (): string[] {
  return allCommands().map(command => command.name)
}

export function topLevelHelp (): string {
  const lines = [
    'Usage',
    '  confluex <command> [options]',
    'Commands'
  ]

  for (const command of allCommands()) {
    lines.push(`  ${command.name}  ${command.purpose}`)
  }

  return linesToText(lines)
}

function optionLine (option: OptionDefinition): string {
  const valuePart = option.value !== undefined ? ` ${option.value}` : ''
  return `  ${option.token}${valuePart}  ${option.description}`
}

export function commandHelp (name: string): string {
  const command = findCommand(name)
  if (command === null) {
    throw new Error(`unsupported command help: ${name}`)
  }

  const requiredOptions = command.options.filter(option => option.required)
  const optionalOptions = command.options.filter(option => !option.required)
  const lines = [
    'Usage',
    `  ${command.usage}`,
    'Purpose',
    `  ${command.helpPurpose ?? command.purpose}`,
    'Required options'
  ]

  if (requiredOptions.length === 0) {
    lines.push('  none')
  } else {
    for (const option of requiredOptions) {
      lines.push(optionLine(option))
    }
  }

  lines.push('Optional options')

  if (optionalOptions.length === 0) {
    lines.push('  none')
  } else {
    for (const option of optionalOptions) {
      lines.push(optionLine(option))
    }
  }

  lines.push('Examples')
  for (const example of command.examples) {
    lines.push(`  ${example}`)
  }

  if (command.notes.length > 0) {
    lines.push('Notes')
    for (const note of command.notes) {
      lines.push(`  ${note}`)
    }
  }

  return linesToText(lines)
}
