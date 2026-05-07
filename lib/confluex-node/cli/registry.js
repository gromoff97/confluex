'use strict'

const commands = [
  {
    name: 'export',
    purpose: 'materialized Markdown export workflow',
    usage: 'confluex export --page-id <id> [options]',
    examples: [
      'confluex export --page-id <id> --zip'
    ],
    options: [
      { token: '--page-id', value: '<id>', required: true, description: 'Root Confluence page id to export.' },
      { token: '--out', value: '<path>', description: 'Output directory. Default: generated automatically.' },
      { token: '--resume', description: 'Reuse a compatible existing export root selected by --out.' },
      { token: '--no-fail-fast', description: 'Continue after page-local runtime failures.' },
      { token: '--keep-metadata', description: 'Persist page metadata files such as _info.txt and _storage.xml.' },
      { token: '--zip', description: 'create a ZIP archive beside the Markdown output root' },
      { token: '--env-file', value: '<file>', description: 'Load public configuration from this env file.' },
      { token: '--log-file', value: '<file>', description: 'Write a persistent log artifact.' },
      { token: '--max-pages', value: '<n>', description: 'Stop after n processed pages.' },
      { token: '--max-download-mib', value: '<n>', description: 'Stop after downloading n MiB in total.' },
      { token: '--sleep-ms', value: '<n>', description: 'Sleep n ms between processed pages.' },
      { token: '--max-find-candidates', value: '<n>', description: 'Inspect at most n title-resolution candidates per link.' },
      { token: '--link-depth', value: '<n>', description: 'Follow supported internal links up to n hops from the root child tree; default: 1.' }
    ],
    notes: [
      '--resume requires --out'
    ]
  },
  {
    name: 'plan',
    purpose: 'dry-run planning workflow',
    usage: 'confluex plan --page-id <id> [options]',
    examples: [
      'confluex plan --page-id <id>'
    ],
    options: [
      { token: '--page-id', value: '<id>', required: true, description: 'Root Confluence page id to plan.' },
      { token: '--out', value: '<path>', description: 'Output directory. Default: generated automatically.' },
      { token: '--no-fail-fast', description: 'Continue after page-local runtime failures.' },
      { token: '--keep-metadata', description: 'Persist page metadata files such as _info.txt and _storage.xml.' },
      { token: '--env-file', value: '<file>', description: 'Load public configuration from this env file.' },
      { token: '--log-file', value: '<file>', description: 'Write a persistent log artifact.' },
      { token: '--max-pages', value: '<n>', description: 'Stop after n processed pages.' },
      { token: '--max-download-mib', value: '<n>', description: 'Stop after downloading n MiB in total.' },
      { token: '--sleep-ms', value: '<n>', description: 'Sleep n ms between processed pages.' },
      { token: '--max-find-candidates', value: '<n>', description: 'Inspect at most n title-resolution candidates per link.' },
      { token: '--link-depth', value: '<n>', description: 'Follow supported internal links up to n hops from the root child tree; default: 1.' }
    ],
    notes: []
  },
  {
    name: 'doctor',
    purpose: 'diagnostic workflow',
    helpPurpose: 'diagnostic workflow for local prerequisites, token-only Confluence configuration, optional page access, and supported link forms',
    usage: 'confluex doctor [options]',
    examples: [
      'confluex doctor --page-id <id>'
    ],
    options: [
      { token: '--page-id', value: '<id>', description: 'test access to a Confluence page' },
      { token: '--env-file', value: '<file>', description: 'load public configuration from an env file' },
      { token: '--log-file', value: '<file>', description: 'write a persistent diagnostic log' }
    ],
    notes: []
  }
]

function allCommands () {
  return commands.slice()
}

function findCommand (name) {
  return commands.find(command => command.name === name) || null
}

function isCommand (name) {
  return findCommand(name) !== null
}

module.exports = {
  allCommands,
  findCommand,
  isCommand
}
