import { findCommand, type CommandDefinition, type OptionDefinition } from './registry'
import type { Diagnostic } from './diagnostics'

export type EffectiveOptions = {
  flags: string[]
  values: Record<string, string>
}

export type ValidationResult =
  | { kind: 'valid', options: EffectiveOptions }
  | { kind: 'rejected', diagnostic: Diagnostic }

type IndexedFailure<T extends object> = T & {
  index: number
}

type ValidationFailures = {
  missingOptionValues: IndexedFailure<{ optionToken: string }>[]
  unsupportedOptions: IndexedFailure<{ optionToken: string }>[]
  unsupportedPositionals: IndexedFailure<{ operandToken: string }>[]
  invalidOptionValues: Set<string>
  invalidOptionCombinations: string[][]
  missingRequiredOptions: Set<string>
}

const emptyRejectedOptions = new Set(['--out', '--log-file', '--env-file'])
const positiveIntegerOptions = new Set(['--max-pages', '--max-download-mib', '--max-find-candidates'])

export function validateCommandInvocation (
  commandName: string,
  argv: string[],
  defaultValues: Record<string, string> = {}
): ValidationResult {
  const command = findCommand(commandName)
  if (command === null) {
    throw new Error(`unknown command for validation: ${commandName}`)
  }

  const optionDefinitions = new Map(command.options.map(option => [option.token, option]))
  const flags = new Set<string>()
  const values = new Map<string, string>()
  const failures: ValidationFailures = {
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

function applyDefaultValues (
  optionDefinitions: Map<string, OptionDefinition>,
  values: Map<string, string>,
  defaultValues: Record<string, string>
): void {
  for (const [optionToken, value] of Object.entries(defaultValues)) {
    const option = optionDefinitions.get(optionToken)
    if (option?.value === undefined || values.has(optionToken)) {
      continue
    }
    values.set(optionToken, value)
  }
}

function scanArgv (
  argv: string[],
  optionDefinitions: Map<string, OptionDefinition>,
  flags: Set<string>,
  values: Map<string, string>,
  failures: ValidationFailures
): void {
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === undefined) {
      continue
    }
    const option = optionDefinitions.get(token)

    if (option?.value !== undefined) {
      const nextToken = argv[index + 1]
      if (nextToken === undefined) {
        failures.missingOptionValues.push({ index, optionToken: option.token })
      } else {
        values.set(option.token, nextToken)
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

function validateEffectiveValues (
  command: CommandDefinition,
  values: Map<string, string>,
  failures: ValidationFailures
): void {
  for (const option of command.options) {
    if (!values.has(option.token)) {
      continue
    }

    const value = values.get(option.token)
    if (value === undefined || !isValidEffectiveValue(option.token, value)) {
      failures.invalidOptionValues.add(option.token)
    }
  }
}

function isValidEffectiveValue (optionToken: string, value: string): boolean {
  if (optionToken === '--page-id') {
    return isCanonicalNonNegativeInteger(value)
  }

  if (positiveIntegerOptions.has(optionToken)) {
    return isCanonicalPositiveInteger(value)
  }

  if (optionToken === '--sleep-ms' || optionToken === '--link-depth') {
    return isCanonicalNonNegativeInteger(value)
  }

  if (emptyRejectedOptions.has(optionToken) && value === '') {
    return false
  }

  return true
}

function isCanonicalNonNegativeInteger (value: string): boolean {
  return /^(0|[1-9][0-9]*)$/.test(value)
}

function isCanonicalPositiveInteger (value: string): boolean {
  return isCanonicalNonNegativeInteger(value) && value !== '0'
}

function validateCombinations (
  commandName: string,
  flags: Set<string>,
  values: Map<string, string>,
  failures: ValidationFailures
): void {
  if (commandName === 'export' && flags.has('--resume') && !values.has('--out')) {
    failures.invalidOptionCombinations.push(['--out', '--resume'])
  }
}

function validateRequiredOptions (
  command: CommandDefinition,
  values: Map<string, string>,
  failures: ValidationFailures
): void {
  for (const option of command.options) {
    if (option.required === true && !values.has(option.token)) {
      failures.missingRequiredOptions.add(option.token)
    }
  }
}

function selectDiagnostic (command: CommandDefinition, failures: ValidationFailures): Diagnostic | null {
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
    const optionTokens = failures.invalidOptionCombinations
      .map(sortedOptionTokens)
      .sort(compareSerializedTokenLists)[0]
    if (optionTokens === undefined) {
      throw new Error('missing invalid option combination')
    }
    return {
      type: 'invalid-option-combination',
      optionTokens
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

function earliestByIndex<T extends { index: number }> (failures: T[]): T {
  const failure = failures.slice().sort((left, right) => left.index - right.index)[0]
  if (failure === undefined) {
    throw new Error('missing indexed failure')
  }
  return failure
}

function firstSupportedOption (command: CommandDefinition, tokens: Set<string>): string | null {
  for (const option of command.options) {
    if (tokens.has(option.token)) {
      return option.token
    }
  }

  return null
}

function sortedOptionTokens (tokens: string[]): string[] {
  return tokens.slice().sort(bytewiseCompare)
}

function compareSerializedTokenLists (left: string[], right: string[]): number {
  return bytewiseCompare(left.join(','), right.join(','))
}

function bytewiseCompare (left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'))
}

function effectiveOptions (
  command: CommandDefinition,
  flags: Set<string>,
  values: Map<string, string>
): EffectiveOptions {
  const effectiveValues: Record<string, string> = {}
  const effectiveFlags: string[] = []

  for (const option of command.options) {
    if (option.value !== undefined && values.has(option.token)) {
      const value = values.get(option.token)
      if (value !== undefined) {
        effectiveValues[option.token] = value
      }
    } else if (option.value === undefined && flags.has(option.token)) {
      effectiveFlags.push(option.token)
    }
  }

  return {
    flags: effectiveFlags,
    values: effectiveValues
  }
}
