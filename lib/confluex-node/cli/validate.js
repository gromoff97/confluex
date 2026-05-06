'use strict'

const { findCommand } = require('./registry')

const emptyRejectedOptions = new Set(['--out', '--log-file', '--install-dir', '--env-file', '--encryption-key'])
const positiveIntegerOptions = new Set(['--max-pages', '--max-download-mib', '--max-find-candidates'])

function validateCommandInvocation (commandName, argv, defaultValues = {}) {
  const command = findCommand(commandName)
  if (command === null) {
    throw new Error(`unknown command for validation: ${commandName}`)
  }

  const optionDefinitions = new Map(command.options.map(option => [option.token, option]))
  const flags = new Set()
  const values = new Map()
  const failures = {
    missingOptionValues: [],
    unsupportedOptions: [],
    unsupportedPositionals: [],
    invalidOptionValues: new Set(),
    invalidOptionCombinations: [],
    missingRequiredOptions: new Set()
  }

  scanArgv(argv, optionDefinitions, flags, values, failures)
  applyDefaultValues(optionDefinitions, values, defaultValues)
  validateEffectiveValues(command, values, failures)
  validateCombinations(commandName, flags, values, failures)
  validateRequiredOptions(command, values, failures)

  const diagnostic = selectDiagnostic(command, failures)
  if (diagnostic !== null) {
    return {
      kind: 'rejected',
      diagnostic
    }
  }

  return {
    kind: 'valid',
    options: effectiveOptions(command, flags, values)
  }
}

function applyDefaultValues (optionDefinitions, values, defaultValues) {
  for (const [optionToken, value] of Object.entries(defaultValues)) {
    const option = optionDefinitions.get(optionToken)
    if (option === undefined || option.value === undefined || values.has(optionToken)) {
      continue
    }
    values.set(optionToken, value)
  }
}

function scanArgv (argv, optionDefinitions, flags, values, failures) {
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    const option = optionDefinitions.get(token)

    if (option !== undefined && option.value !== undefined) {
      if (index + 1 >= argv.length) {
        failures.missingOptionValues.push({ index, optionToken: option.token })
      } else {
        values.set(option.token, argv[index + 1])
        index += 1
      }
      continue
    }

    if (option !== undefined) {
      flags.add(option.token)
      continue
    }

    if (token.startsWith('-')) {
      failures.unsupportedOptions.push({ index, optionToken: token })
      continue
    }

    failures.unsupportedPositionals.push({ index, operandToken: token })
  }
}

function validateEffectiveValues (command, values, failures) {
  for (const option of command.options) {
    if (!values.has(option.token)) {
      continue
    }

    const value = values.get(option.token)
    if (!isValidEffectiveValue(option.token, value)) {
      failures.invalidOptionValues.add(option.token)
    }
  }
}

function isValidEffectiveValue (optionToken, value) {
  if (optionToken === '--page-id') {
    return isCanonicalNonNegativeInteger(value)
  }

  if (positiveIntegerOptions.has(optionToken)) {
    return isCanonicalPositiveInteger(value)
  }

  if (optionToken === '--sleep-ms' || optionToken === '--link-depth') {
    return isCanonicalNonNegativeInteger(value)
  }

  if (optionToken === '--url') {
    return value !== '' && !/[\t\n\r]/.test(value)
  }

  if (optionToken === '--token') {
    return value !== '' && !/[\t\n\r]/.test(value)
  }

  if (emptyRejectedOptions.has(optionToken) && value === '') {
    return false
  }

  if (optionToken === '--encryption-key') {
    return value !== 'none' && !/[\t\n\r]/.test(value)
  }

  return true
}

function isCanonicalNonNegativeInteger (value) {
  return /^(0|[1-9][0-9]*)$/.test(value)
}

function isCanonicalPositiveInteger (value) {
  return isCanonicalNonNegativeInteger(value) && value !== '0'
}

function validateCombinations (commandName, flags, values, failures) {
  if (commandName === 'config' && flags.has('--clear-encryption-key') && values.has('--encryption-key')) {
    failures.invalidOptionCombinations.push(['--clear-encryption-key', '--encryption-key'])
  }

  if ((commandName === 'export' || commandName === 'plan') && flags.has('--critical') && flags.has('--no-fail-fast')) {
    failures.invalidOptionCombinations.push(['--critical', '--no-fail-fast'])
  }

  if ((commandName === 'export' || commandName === 'plan') && flags.has('--confidential') && flags.has('--no-fail-fast')) {
    failures.invalidOptionCombinations.push(['--confidential', '--no-fail-fast'])
  }

  if (commandName === 'doctor' && values.has('--encryption-key') && !flags.has('--verify-encryption')) {
    failures.invalidOptionCombinations.push(['--encryption-key', '--verify-encryption'])
  }

  if (commandName === 'export' && flags.has('--resume') && !values.has('--out')) {
    failures.invalidOptionCombinations.push(['--out', '--resume'])
  }
}

function validateRequiredOptions (command, values, failures) {
  for (const option of command.options) {
    if (option.required === true && !values.has(option.token)) {
      failures.missingRequiredOptions.add(option.token)
    }
  }
}

function selectDiagnostic (command, failures) {
  if (failures.missingOptionValues.length > 0) {
    const failure = earliestByIndex(failures.missingOptionValues)
    return {
      type: 'missing-option-value',
      optionToken: failure.optionToken
    }
  }

  if (failures.unsupportedOptions.length > 0) {
    const failure = earliestByIndex(failures.unsupportedOptions)
    return {
      type: 'unsupported-option',
      optionToken: failure.optionToken
    }
  }

  if (failures.unsupportedPositionals.length > 0) {
    const failure = earliestByIndex(failures.unsupportedPositionals)
    return {
      type: 'unsupported-positional-operand',
      operandToken: failure.operandToken
    }
  }

  const invalidOptionValue = firstSupportedOption(command, failures.invalidOptionValues)
  if (invalidOptionValue !== null) {
    return {
      type: 'invalid-option-value',
      optionToken: invalidOptionValue
    }
  }

  if (failures.invalidOptionCombinations.length > 0) {
    return {
      type: 'invalid-option-combination',
      optionTokens: failures.invalidOptionCombinations
        .map(sortedOptionTokens)
        .sort(compareSerializedTokenLists)[0]
    }
  }

  const missingRequiredOption = firstSupportedOption(command, failures.missingRequiredOptions)
  if (missingRequiredOption !== null) {
    return {
      type: 'missing-required-option',
      optionToken: missingRequiredOption
    }
  }

  return null
}

function earliestByIndex (failures) {
  return failures.slice().sort((left, right) => left.index - right.index)[0]
}

function firstSupportedOption (command, tokens) {
  for (const option of command.options) {
    if (tokens.has(option.token)) {
      return option.token
    }
  }

  return null
}

function sortedOptionTokens (tokens) {
  return tokens.slice().sort(bytewiseCompare)
}

function compareSerializedTokenLists (left, right) {
  return bytewiseCompare(left.join(','), right.join(','))
}

function bytewiseCompare (left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'))
}

function effectiveOptions (command, flags, values) {
  const effectiveValues = {}
  const effectiveFlags = []

  for (const option of command.options) {
    if (option.value !== undefined && values.has(option.token)) {
      effectiveValues[option.token] = values.get(option.token)
    } else if (option.value === undefined && flags.has(option.token)) {
      effectiveFlags.push(option.token)
    }
  }

  return {
    flags: effectiveFlags,
    values: effectiveValues
  }
}

module.exports = {
  validateCommandInvocation
}
