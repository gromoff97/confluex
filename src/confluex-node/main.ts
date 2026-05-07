import process from 'node:process'

import { formatDiagnostic, type Diagnostic } from './cli/diagnostics'
import { topLevelHelp, commandHelp } from './cli/help'
import { parseInvocation } from './cli/parse'
import { isCommand } from './cli/registry'
import { loadSelectedEnvFile } from './config/env-file'
import { buildEffectiveOptions } from './config/effective-options'
import type { EffectiveOptions } from './cli/validate'

type Streams = {
  stdout: Pick<NodeJS.WritableStream, 'write'>
  stderr: Pick<NodeJS.WritableStream, 'write'>
}

type CommandResult = {
  exitCode: number
  stdout: string
  stderr: string
}

type CommandOptions = EffectiveOptions & {
  config?: {
    confluenceBaseUrl?: string
    confluenceToken?: string
  }
}

type CommandRunners = {
  runDoctorCommand: (options: CommandOptions) => Promise<CommandResult>
  runExportRelatedCommand: (command: 'export' | 'plan', options: CommandOptions) => Promise<CommandResult>
}

type NodeVersionCheck =
  | { state: 'passed' }
  | { state: 'failed', required: string, actual: string }

type PrereqRuntime = {
  checkNodeVersion: () => NodeVersionCheck
  runtimePrerequisiteFailure: (name: string, detail: string) => string
}

type EnvContext = {
  values: Map<string, string>
  defaultValues: Record<string, string>
  diagnostic: Diagnostic | null
}

const exportRuntime = require('../../lib/confluex-node/commands/export-related') as Pick<CommandRunners, 'runExportRelatedCommand'>
const doctorRuntime = require('../../lib/confluex-node/commands/doctor') as Pick<CommandRunners, 'runDoctorCommand'>
const prereqRuntime = require('../../lib/confluex-node/prereq/checks') as PrereqRuntime

const checkedRunDoctorCommand = doctorRuntime.runDoctorCommand
const checkedRunExportRelatedCommand = exportRuntime.runExportRelatedCommand

export async function run (argv: string[], streams: Streams = process): Promise<number> {
  const nodeVersion = prereqRuntime.checkNodeVersion()
  if (nodeVersion.state !== 'passed') {
    streams.stderr.write(prereqRuntime.runtimePrerequisiteFailure('node_version', `required=${nodeVersion.required} actual=${nodeVersion.actual}`))
    return 4
  }

  const envContext = loadEnvContext(argv, process.cwd(), process.env)
  if (envContext.diagnostic !== null) {
    streams.stderr.write(`${formatDiagnostic(envContext.diagnostic)}\n`)
    return 1
  }

  const parsed = parseInvocation(argv, envContext.defaultValues)

  if (parsed.kind === 'top-help') {
    streams.stdout.write(topLevelHelp())
    return 0
  }

  if (parsed.kind === 'command-help') {
    streams.stdout.write(commandHelp(parsed.command))
    return 0
  }

  if (parsed.kind === 'rejected') {
    streams.stderr.write(`${formatDiagnostic(parsed.diagnostic)}\n`)
    return 1
  }

  const options = buildEffectiveOptions(parsed.command, parsed.options, process.env, envContext.values)

  if (parsed.command === 'export' || parsed.command === 'plan') {
    const result = await checkedRunExportRelatedCommand(parsed.command, options)
    streams.stdout.write(result.stdout)
    streams.stderr.write(result.stderr)
    return result.exitCode
  }

  if (parsed.command === 'doctor') {
    const result = await checkedRunDoctorCommand(options)
    streams.stdout.write(result.stdout)
    streams.stderr.write(result.stderr)
    return result.exitCode
  }

  streams.stderr.write(`${formatDiagnostic({
    type: 'development-pending',
    command: parsed.command
  })}\n`)
  return 4
}

const envFileCommands = new Set(['export', 'plan', 'doctor'])
const missingEnvFileValue = Symbol('missing env-file value')

function loadEnvContext (argv: string[], cwd: string, env: NodeJS.ProcessEnv): EnvContext {
  const empty: EnvContext = {
    values: new Map(),
    defaultValues: {},
    diagnostic: null
  }

  const command = argv[0]
  if (command === undefined || !envFileCommands.has(command) || !isCommand(command) || isCommandHelp(argv)) {
    return empty
  }

  const explicitPath = explicitEnvFilePath(argv.slice(1))
  if (explicitPath === missingEnvFileValue) {
    return empty
  }

  try {
    const selected = loadSelectedEnvFile(cwd, explicitPath)
    const defaults = buildEffectiveOptions(command, {
      flags: [],
      values: {}
    }, env, selected.values)
    return {
      values: selected.values,
      defaultValues: defaults.values,
      diagnostic: null
    }
  } catch {
    return {
      values: new Map(),
      defaultValues: {},
      diagnostic: {
        type: 'invalid-option-value',
        optionToken: '--env-file'
      }
    }
  }
}

function explicitEnvFilePath (argv: string[]): string | typeof missingEnvFileValue | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== '--env-file') {
      continue
    }
    if (index + 1 >= argv.length) {
      return missingEnvFileValue
    }
    return argv[index + 1]
  }
  return undefined
}

function isCommandHelp (argv: string[]): boolean {
  return argv.length === 2 && argv[1] === '--help'
}
