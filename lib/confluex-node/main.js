#!/usr/bin/env node
'use strict'

const { topLevelHelp, commandHelp } = require('./cli/help')
const { parseInvocation } = require('./cli/parse')
const { formatDiagnostic } = require('./cli/diagnostics')
const { isCommand } = require('./cli/registry')
const { loadSelectedEnvFile } = require('./config/env-file')
const { buildEffectiveOptions } = require('./config/effective-options')
const { runConfigCommand } = require('./commands/config')
const { runDoctorCommand } = require('./commands/doctor')
const { runExportRelatedCommand } = require('./commands/export-related')
const { runSelftestCommand } = require('./commands/selftest')

async function run (argv, streams = process) {
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

  if (parsed.kind === 'command') {
    parsed.options = buildEffectiveOptions(parsed.command, parsed.options, process.env, envContext.values)

    if (parsed.command === 'export' || parsed.command === 'plan') {
      const result = await runExportRelatedCommand(parsed.command, parsed.options)
      streams.stdout.write(result.stdout)
      streams.stderr.write(result.stderr)
      return result.exitCode
    }

    if (parsed.command === 'doctor') {
      const result = await runDoctorCommand(parsed.options)
      streams.stdout.write(result.stdout)
      streams.stderr.write(result.stderr)
      return result.exitCode
    }

    if (parsed.command === 'config') {
      const result = runConfigCommand(parsed.options)
      streams.stdout.write(result.stdout)
      streams.stderr.write(result.stderr)
      return result.exitCode
    }

    if (parsed.command === 'selftest') {
      const result = await runSelftestCommand(parsed.options)
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

  streams.stderr.write('ERROR: internal_error unsupported_parse_result\n')
  return 4
}

const envFileCommands = new Set(['export', 'plan', 'doctor', 'selftest'])

function loadEnvContext (argv, cwd, env) {
  const empty = {
    values: new Map(),
    defaultValues: {},
    diagnostic: null
  }

  const command = argv[0]
  if (!envFileCommands.has(command) || !isCommand(command) || isCommandHelp(argv)) {
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

const missingEnvFileValue = Symbol('missing env-file value')

function explicitEnvFilePath (argv) {
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

function isCommandHelp (argv) {
  return argv.length === 2 && argv[1] === '--help'
}

async function main () {
  process.exitCode = await run(process.argv.slice(2), process)
}

if (require.main === module) {
  main().catch(error => {
    process.stderr.write(`ERROR: internal_error ${error.name}\n`)
    process.exitCode = 4
  })
}

module.exports = {
  run
}
