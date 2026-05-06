'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { commandNames, topLevelHelp, commandHelp } = require('../../lib/confluex-node/cli/help')

const expectedTopLevelHelp = [
  'Usage',
  '  confluex <command> [options]',
  'Commands',
  '  export  materialized export workflow',
  '  plan  dry-run planning workflow',
  '  doctor  diagnostic workflow',
  '  config  configuration workflow',
  '  install  installation workflow',
  '  uninstall  uninstallation workflow',
  '  selftest  live regression self-test workflow',
  ''
].join('\n')

test('top-level help matches FR-0007 byte shape', () => {
  assert.equal(topLevelHelp(), expectedTopLevelHelp)
  assert.equal(topLevelHelp().includes('\n\n'), false)
})

test('command order is the supported top-level order', () => {
  assert.deepEqual(commandNames(), [
    'export',
    'plan',
    'doctor',
    'config',
    'install',
    'uninstall',
    'selftest'
  ])
})

test('export command help has governed sections and notes', () => {
  assert.equal(commandHelp('export'), [
    'Usage',
    '  confluex export --page-id <id> [options]',
    'Purpose',
    '  materialized export workflow',
    'Required options',
    '  --page-id <id>  Root Confluence page id to export.',
    'Optional options',
    '  --out <path>  Output directory. Default: generated automatically.',
    '  --safe  Apply conservative defaults for routine runs.',
    '  --critical  Fail closed when findings or failures remain.',
    '  --encrypt  Request encrypted output delivery.',
    '  --confidential  Request encrypted fail-closed delivery with plaintext cleanup on encryption failure.',
    '  --resume  Reuse a compatible existing export root selected by --out.',
    '  --no-fail-fast  Continue after page-local runtime failures.',
    '  --keep-metadata  Persist page metadata files such as _info.txt and _storage.xml.',
    '  --page-format <format>  Persist page payload format; formats: md, html; default: md.',
    '  --env-file <file>  Read configuration from this env file.',
    '  --log-file <file>  Write a persistent log artifact.',
    '  --encryption-key <value>  Use this encryption recipient for the current command.',
    '  --max-pages <n>  Stop after n processed pages.',
    '  --max-download-mib <n>  Stop after downloading n MiB in total.',
    '  --sleep-ms <n>  Sleep n ms between processed pages.',
    '  --max-find-candidates <n>  Inspect at most n title-resolution candidates per link.',
    '  --link-depth <n>  Follow supported internal links up to n hops from the root child tree; default: 1.',
    'Examples',
    '  confluex export --page-id <id>',
    'Notes',
    '  --resume requires --out',
    '  --critical mutually exclusive with --no-fail-fast',
    '  --confidential mutually exclusive with --no-fail-fast',
    ''
  ].join('\n'))
})

test('selftest command help uses explicit target options and refined purpose', () => {
  assert.equal(commandHelp('selftest'), [
    'Usage',
    '  confluex selftest --url <base-url> --login <username> --password <password>',
    'Purpose',
    '  explicit-target live regression self-test workflow for an already running Confluence 7.13.7 stand with fixture preparation, live regression, and self-test report root',
    'Required options',
    '  --url <base-url>  Base URL of the already running Confluence stand.',
    '  --login <username>  Login used for selftest bootstrap, fixture apply, and live regression.',
    '  --password <password>  Password used for selftest bootstrap, fixture apply, and live regression.',
    'Optional options',
    '  --env-file <file>  Read configuration from this env file.',
    'Examples',
    '  confluex selftest --url http://127.0.0.1:8090 --login admin --password admin',
    ''
  ].join('\n'))
})

test('every command help has LF ending and no empty interior lines', () => {
  for (const command of commandNames()) {
    const text = commandHelp(command)
    assert.equal(text.endsWith('\n'), true, command)
    assert.equal(text.slice(0, -1).includes('\n\n'), false, command)
  }
})
