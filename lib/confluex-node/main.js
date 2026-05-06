#!/usr/bin/env node
'use strict'

const { topLevelHelp, commandHelp } = require('./cli/help')
const { parseInvocation } = require('./cli/parse')
const { formatDiagnostic } = require('./cli/diagnostics')
const { runConfigCommand } = require('./commands/config')
const { runDoctorCommand } = require('./commands/doctor')
const { runExportRelatedCommand } = require('./commands/export-related')
const { runInstallCommand } = require('./commands/install')
const { runSelftestCommand } = require('./commands/selftest')
const { runUninstallCommand } = require('./commands/uninstall')

async function run (argv, streams = process) {
  const parsed = parseInvocation(argv)

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

    if (parsed.command === 'install') {
      const result = await runInstallCommand(parsed.options)
      streams.stdout.write(result.stdout)
      streams.stderr.write(result.stderr)
      return result.exitCode
    }

    if (parsed.command === 'uninstall') {
      const result = await runUninstallCommand(parsed.options)
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
