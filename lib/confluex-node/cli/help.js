'use strict'

const { allCommands, findCommand } = require('./registry')

function linesToText (lines) {
  return `${lines.join('\n')}\n`
}

function commandNames () {
  return allCommands().map(command => command.name)
}

function topLevelHelp () {
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

function optionLine (option) {
  const valuePart = option.value ? ` ${option.value}` : ''
  return `  ${option.token}${valuePart}  ${option.description}`
}

function commandHelp (name) {
  const command = findCommand(name)
  if (!command) {
    throw new Error(`unsupported command help: ${name}`)
  }

  const requiredOptions = command.options.filter(option => option.required)
  const optionalOptions = command.options.filter(option => !option.required)
  const lines = [
    'Usage',
    `  ${command.usage}`,
    'Purpose',
    `  ${command.helpPurpose || command.purpose}`,
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

module.exports = {
  commandNames,
  topLevelHelp,
  commandHelp
}
