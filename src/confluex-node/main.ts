import process from 'node:process'

import { formatDiagnostic, type Diagnostic } from './cli/diagnostics'
import { topLevelHelp, commandHelp } from './cli/help'
import { parseInvocation } from './cli/parse'
import { isCommand } from './cli/registry'
import { loadSelectedEnvFile } from './config/env-file'
import { buildEffectiveOptions } from './config/effective-options'
import { loadUserConfig, userConfigEnvironmentValues } from './config/user-config'
import { runExportRelatedCommand } from './commands/export-related'
import { runSetupCommand } from './commands/setup'
import { checkNodeVersion, runtimePrerequisiteFailure } from './prereq/checks'

type Streams = {
  stdout: Pick<NodeJS.WritableStream, 'write'>
  stderr: Pick<NodeJS.WritableStream, 'write'>
}

type EnvContext = {
  values: Map<string, string>
  userConfigValues: Map<string, string>
  defaultValues: Record<string, string>
  diagnostic: Diagnostic | null
}

export async function run (argv: string[], streams: Streams = process): Promise<number> {
  if (!isSetupInvocation(argv)) {
    const nodeVersion = checkNodeVersion()
    if (nodeVersion.state !== 'passed') {
      streams.stderr.write(runtimePrerequisiteFailure('node_version', `required=${nodeVersion.required} actual=${nodeVersion.actual}`))
      return 4
    }
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

  const options = buildEffectiveOptions(parsed.command, parsed.options, process.env, envContext.values, envContext.userConfigValues)

  if (parsed.command === 'setup') {
    const result = await runSetupCommand({
      stdout: streams.stdout as NodeJS.WritableStream
    })
    streams.stdout.write(result.stdout)
    streams.stderr.write(result.stderr)
    return result.exitCode
  }

  if (parsed.command === 'export') {
    const result = await runExportRelatedCommand(options)
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

const envFileCommands = new Set(['export'])
const missingEnvFileValue = Symbol('missing env-file value')

function loadEnvContext (argv: string[], cwd: string, env: NodeJS.ProcessEnv): EnvContext {
  const empty: EnvContext = {
    values: new Map(),
    userConfigValues: new Map(),
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
    const loadedUserConfig = loadUserConfig(env)
    if (loadedUserConfig.state === 'invalid') {
      return {
        values: selected.values,
        userConfigValues: new Map(),
        defaultValues: {},
        diagnostic: {
          type: 'validation-failed',
          requirementId: 'FR-0246'
        }
      }
    }
    const userConfigValues = userConfigEnvironmentValues(loadedUserConfig.config)
    const defaults = buildEffectiveOptions(command, {
      flags: [],
      values: {}
    }, env, selected.values, userConfigValues)
    return {
      values: selected.values,
      userConfigValues,
      defaultValues: defaults.values,
      diagnostic: null
    }
  } catch {
    return {
      values: new Map(),
      userConfigValues: new Map(),
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

function isSetupInvocation (argv: string[]): boolean {
  return argv[0] === 'setup' && !isCommandHelp(argv)
}
