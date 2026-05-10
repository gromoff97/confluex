import process from 'node:process'

import { formatDiagnostic } from './cli/diagnostics'
import { topLevelHelp, commandHelp } from './cli/help'
import { parseInvocation, type ParseResult } from './cli/parse'
import { buildEffectiveOptions } from './config/effective-options'
import { loadConfigurationSelection } from './config/selection'
import { runExportRelatedCommand } from './commands/export-related'
import { runSetupCommand } from './commands/setup'
import { checkNodeVersion, runtimePrerequisiteFailure } from './prereq/checks'

type Streams = {
  stdout: Pick<NodeJS.WritableStream, 'write'>
  stderr: Pick<NodeJS.WritableStream, 'write'>
}

type CommandParseResult = Extract<ParseResult, { kind: 'command' }>

export async function run (argv: string[], streams: Streams = process): Promise<number> {
  const preliminary = parseInvocation(argv, {}, { deferResumeOutputRootRequirement: true })
  const staticResult = renderStaticResult(preliminary, streams)
  if (staticResult !== null) {
    return staticResult
  }
  const preliminaryCommand = requireCommand(preliminary)

  if (!isSetupCommand(preliminaryCommand.command)) {
    const nodeVersion = checkNodeVersion()
    if (nodeVersion.state !== 'passed') {
      streams.stderr.write(runtimePrerequisiteFailure('node_version', `required=${nodeVersion.required} actual=${nodeVersion.actual}`))
      return 4
    }
  }

  const envContext = loadConfigurationSelection(preliminaryCommand, process.cwd(), process.env)
  if (envContext.diagnostic !== null) {
    streams.stderr.write(`${formatDiagnostic(envContext.diagnostic)}\n`)
    return 1
  }

  const parsed = parseInvocation(argv, envContext.defaultValues)
  const configuredStaticResult = renderStaticResult(parsed, streams)
  if (configuredStaticResult !== null) {
    return configuredStaticResult
  }
  const parsedCommand = requireCommand(parsed)

  const options = buildEffectiveOptions(parsedCommand.command, parsedCommand.options, process.env, envContext.explicitConfig, envContext.userConfig)

  if (parsedCommand.command === 'setup') {
    const result = await runSetupCommand({
      stdout: streams.stdout as NodeJS.WritableStream
    })
    streams.stdout.write(result.stdout)
    streams.stderr.write(result.stderr)
    return result.exitCode
  }

  if (parsedCommand.command === 'export') {
    const result = await runExportRelatedCommand(options, {
      lifecycleSink: streams.stdout as NodeJS.WritableStream
    })
    streams.stdout.write(result.stdout)
    streams.stderr.write(result.stderr)
    return result.exitCode
  }

  streams.stderr.write(`${formatDiagnostic({
    type: 'development-pending',
    command: parsedCommand.command
  })}\n`)
  return 4
}

function renderStaticResult (parsed: ParseResult, streams: Streams): number | null {
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

  return null
}

function requireCommand (parsed: ParseResult): CommandParseResult {
  if (parsed.kind !== 'command') {
    throw new Error('expected parsed command after static result handling')
  }
  return parsed
}

function isSetupCommand (command: string): boolean {
  return command === 'setup'
}
