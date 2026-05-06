'use strict'

const commands = [
  {
    name: 'export',
    purpose: 'materialized export workflow',
    usage: 'confluex export --page-id <id> [options]',
    examples: [
      'confluex export --page-id <id>'
    ],
    options: [
      { token: '--page-id', value: '<id>', required: true, description: 'Root Confluence page id to export.' },
      { token: '--out', value: '<path>', description: 'Output directory. Default: generated automatically.' },
      { token: '--safe', description: 'Apply conservative defaults for routine runs.' },
      { token: '--critical', description: 'Fail closed when findings or failures remain.' },
      { token: '--encrypt', description: 'Request encrypted output delivery.' },
      { token: '--confidential', description: 'Request encrypted fail-closed delivery with plaintext cleanup on encryption failure.' },
      { token: '--resume', description: 'Reuse a compatible existing export root selected by --out.' },
      { token: '--no-fail-fast', description: 'Continue after page-local runtime failures.' },
      { token: '--keep-metadata', description: 'Persist page metadata files such as _info.txt and _storage.xml.' },
      { token: '--zip', description: 'Retain a ZIP archive beside the plain Markdown output root.' },
      { token: '--env-file', value: '<file>', description: 'Read configuration from this env file.' },
      { token: '--log-file', value: '<file>', description: 'Write a persistent log artifact.' },
      { token: '--encryption-key', value: '<value>', description: 'Use this encryption recipient for the current command.' },
      { token: '--max-pages', value: '<n>', description: 'Stop after n processed pages.' },
      { token: '--max-download-mib', value: '<n>', description: 'Stop after downloading n MiB in total.' },
      { token: '--sleep-ms', value: '<n>', description: 'Sleep n ms between processed pages.' },
      { token: '--max-find-candidates', value: '<n>', description: 'Inspect at most n title-resolution candidates per link.' },
      { token: '--link-depth', value: '<n>', description: 'Follow supported internal links up to n hops from the root child tree; default: 1.' }
    ],
    notes: [
      '--resume requires --out',
      '--critical mutually exclusive with --no-fail-fast',
      '--confidential mutually exclusive with --no-fail-fast'
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
      { token: '--safe', description: 'Apply conservative defaults for routine runs.' },
      { token: '--critical', description: 'Fail closed when findings or failures remain.' },
      { token: '--encrypt', description: 'Request encrypted output delivery.' },
      { token: '--confidential', description: 'Request encrypted fail-closed delivery with plaintext cleanup on encryption failure.' },
      { token: '--no-fail-fast', description: 'Continue after page-local runtime failures.' },
      { token: '--keep-metadata', description: 'Persist page metadata files such as _info.txt and _storage.xml.' },
      { token: '--env-file', value: '<file>', description: 'Read configuration from this env file.' },
      { token: '--log-file', value: '<file>', description: 'Write a persistent log artifact.' },
      { token: '--encryption-key', value: '<value>', description: 'Use this encryption recipient for the current command.' },
      { token: '--max-pages', value: '<n>', description: 'Stop after n processed pages.' },
      { token: '--max-download-mib', value: '<n>', description: 'Stop after downloading n MiB in total.' },
      { token: '--sleep-ms', value: '<n>', description: 'Sleep n ms between processed pages.' },
      { token: '--max-find-candidates', value: '<n>', description: 'Inspect at most n title-resolution candidates per link.' },
      { token: '--link-depth', value: '<n>', description: 'Follow supported internal links up to n hops from the root child tree; default: 1.' }
    ],
    notes: [
      '--critical mutually exclusive with --no-fail-fast',
      '--confidential mutually exclusive with --no-fail-fast'
    ]
  },
  {
    name: 'doctor',
    purpose: 'diagnostic workflow',
    usage: 'confluex doctor [options]',
    examples: [
      'confluex doctor'
    ],
    options: [
      { token: '--page-id', value: '<id>', description: 'Verify that a candidate root page is accessible.' },
      { token: '--verify-encryption', description: 'Verify the effective encryption recipient.' },
      { token: '--env-file', value: '<file>', description: 'Read configuration from this env file.' },
      { token: '--encryption-key', value: '<value>', description: 'Override the recipient used by --verify-encryption.' },
      { token: '--log-file', value: '<file>', description: 'Write a persistent log artifact.' }
    ],
    notes: [
      '--encryption-key requires --verify-encryption'
    ]
  },
  {
    name: 'config',
    purpose: 'configuration workflow',
    usage: 'confluex config [options]',
    examples: [
      'confluex config'
    ],
    options: [
      { token: '--encryption-key', value: '<value>', description: 'Save this default encryption recipient.' },
      { token: '--clear-encryption-key', description: 'Clear the saved default encryption recipient.' }
    ],
    notes: [
      '--encryption-key mutually exclusive with --clear-encryption-key'
    ]
  },
  {
    name: 'install',
    purpose: 'installation workflow',
    usage: 'confluex install [options]',
    examples: [
      'confluex install'
    ],
    options: [
      { token: '--install-dir', value: '<dir>', description: 'Install into this target directory.' }
    ],
    notes: []
  },
  {
    name: 'uninstall',
    purpose: 'uninstallation workflow',
    usage: 'confluex uninstall [options]',
    examples: [
      'confluex uninstall'
    ],
    options: [
      { token: '--install-dir', value: '<dir>', description: 'Uninstall from this target directory.' }
    ],
    notes: []
  },
  {
    name: 'selftest',
    purpose: 'live regression self-test workflow',
    helpPurpose: 'explicit-target live regression self-test workflow for an already running Confluence 7.13.7 stand with fixture preparation, live regression, and self-test report root',
    usage: 'confluex selftest --url <base-url> --login <username> --password <password>',
    examples: [
      'confluex selftest --url http://127.0.0.1:8090 --login admin --password admin'
    ],
    options: [
      { token: '--url', value: '<base-url>', required: true, description: 'Base URL of the already running Confluence stand.' },
      { token: '--login', value: '<username>', required: true, description: 'Login used for selftest bootstrap, fixture apply, and live regression.' },
      { token: '--password', value: '<password>', required: true, description: 'Password used for selftest bootstrap, fixture apply, and live regression.' },
      { token: '--env-file', value: '<file>', description: 'Read configuration from this env file.' }
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
