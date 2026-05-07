'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { commandNames, topLevelHelp, commandHelp } = require('../../dist/confluex-node/cli/help')

const expectedTopLevelHelp = [
  'Usage',
  '  confluex <command> [options]',
  'Commands',
  '  export  materialized Markdown export workflow',
  '  plan  dry-run planning workflow',
  '  doctor  diagnostic workflow',
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
    'doctor'
  ])
})

test('export command help has governed sections and notes', () => {
  assert.equal(commandHelp('export'), [
    'Usage',
    '  confluex export --page-id <id> [options]',
    'Purpose',
    '  materialized Markdown export workflow',
    'Required options',
    '  --page-id <id>  Root Confluence page id to export.',
    'Optional options',
    '  --out <path>  Output directory. Default: generated automatically.',
    '  --resume  Reuse a compatible existing export root selected by --out.',
    '  --no-fail-fast  Continue after page-local runtime failures.',
    '  --keep-metadata  Persist page metadata files such as _info.txt and _storage.xml.',
    '  --zip  create a ZIP archive beside the Markdown output root',
    '  --env-file <file>  Load public configuration from this env file.',
    '  --log-file <file>  Write a persistent log artifact.',
    '  --max-pages <n>  Stop after n processed pages.',
    '  --max-download-mib <n>  Stop after downloading n MiB in total.',
    '  --sleep-ms <n>  Sleep n ms between processed pages.',
    '  --max-find-candidates <n>  Inspect at most n title-resolution candidates per link.',
    '  --link-depth <n>  Follow supported internal links up to n hops from the root child tree; default: 1.',
    'Examples',
    '  confluex export --page-id <id> --zip',
    'Notes',
    '  --resume requires --out',
    ''
  ].join('\n'))
})

test('plan command help has governed sections and no notes', () => {
  assert.equal(commandHelp('plan'), [
    'Usage',
    '  confluex plan --page-id <id> [options]',
    'Purpose',
    '  dry-run planning workflow',
    'Required options',
    '  --page-id <id>  Root Confluence page id to plan.',
    'Optional options',
    '  --out <path>  Output directory. Default: generated automatically.',
    '  --no-fail-fast  Continue after page-local runtime failures.',
    '  --keep-metadata  Persist page metadata files such as _info.txt and _storage.xml.',
    '  --env-file <file>  Load public configuration from this env file.',
    '  --log-file <file>  Write a persistent log artifact.',
    '  --max-pages <n>  Stop after n processed pages.',
    '  --max-download-mib <n>  Stop after downloading n MiB in total.',
    '  --sleep-ms <n>  Sleep n ms between processed pages.',
    '  --max-find-candidates <n>  Inspect at most n title-resolution candidates per link.',
    '  --link-depth <n>  Follow supported internal links up to n hops from the root child tree; default: 1.',
    'Examples',
    '  confluex plan --page-id <id>',
    ''
  ].join('\n'))
})

test('doctor command help documents public diagnostics only', () => {
  assert.equal(commandHelp('doctor'), [
    'Usage',
    '  confluex doctor [options]',
    'Purpose',
    '  diagnostic workflow for local prerequisites, token-only Confluence configuration, optional page access, and supported link forms',
    'Required options',
    '  none',
    'Optional options',
    '  --page-id <id>  test access to a Confluence page',
    '  --env-file <file>  load public configuration from an env file',
    '  --log-file <file>  write a persistent diagnostic log',
    'Examples',
    '  confluex doctor --page-id <id>',
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
