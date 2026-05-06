'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const {
  parseEnvFile,
  loadSelectedEnvFile
} = require('../../lib/confluex-node/config/env-file')
const {
  buildEffectiveOptions
} = require('../../lib/confluex-node/config/effective-options')
const { parseInvocation } = require('../../lib/confluex-node/cli/parse')
const { validateCommandInvocation } = require('../../lib/confluex-node/cli/validate')
const { run } = require('../../lib/confluex-node/main')

function tempDir () {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-env-file-test-'))
}

test('parseEnvFile parses comments assignments quotes and first equals only', () => {
  assert.deepEqual(parseEnvFile(Buffer.from([
    '# ignored',
    '  # also ignored',
    '',
    ' CONFLUEX_PAGE_ID =123',
    'CONFLUEX_OUT=./out=kept',
    'CONFLUEX_CONFLUENCE_TOKEN="token value"',
    'CONFLUEX_EMPTY='
  ].join('\n'))), new Map([
    ['CONFLUEX_PAGE_ID', '123'],
    ['CONFLUEX_OUT', './out=kept'],
    ['CONFLUEX_CONFLUENCE_TOKEN', 'token value'],
    ['CONFLUEX_EMPTY', '']
  ]))
})

test('parseEnvFile rejects empty keys and NUL bytes', () => {
  assert.throws(() => parseEnvFile(Buffer.from('=value\n')), /invalid env file key/)
  assert.throws(() => parseEnvFile(Buffer.from('CONFLUEX_PAGE_ID=1\u0000\n')), /invalid env file NUL/)
})

test('loadSelectedEnvFile reads default unless explicit env file is selected', () => {
  const cwd = tempDir()
  const defaultPath = path.join(cwd, '.confluex.env')
  const explicitPath = path.join(cwd, 'explicit.env')
  fs.writeFileSync(defaultPath, 'CONFLUEX_PAGE_ID=default\n')
  fs.writeFileSync(explicitPath, 'CONFLUEX_PAGE_ID=explicit\n')

  assert.deepEqual(loadSelectedEnvFile(cwd, undefined), {
    path: defaultPath,
    values: new Map([['CONFLUEX_PAGE_ID', 'default']])
  })

  assert.deepEqual(loadSelectedEnvFile(cwd, explicitPath), {
    path: explicitPath,
    values: new Map([['CONFLUEX_PAGE_ID', 'explicit']])
  })
})

test('loadSelectedEnvFile fails when explicit file is absent', () => {
  assert.throws(
    () => loadSelectedEnvFile(tempDir(), 'missing.env'),
    /env file not readable/
  )
})

test('buildEffectiveOptions applies CLI env-file process precedence', () => {
  const parsedOptions = {
    flags: [],
    values: {
      '--page-id': 'cli-page'
    }
  }
  const envFile = new Map([
    ['CONFLUEX_PAGE_ID', 'file-page'],
    ['CONFLUEX_OUT', './file-out'],
    ['CONFLUEX_CONFLUENCE_TOKEN', 'file-token']
  ])
  const processEnv = {
    CONFLUEX_PAGE_ID: 'process-page',
    CONFLUEX_OUT: './process-out',
    CONFLUEX_CONFLUENCE_BASE_URL: 'https://confluence.example',
    CONFLUEX_CONFLUENCE_TOKEN: 'process-token'
  }

  assert.deepEqual(buildEffectiveOptions('export', parsedOptions, processEnv, envFile), {
    flags: [],
    values: {
      '--page-id': 'cli-page',
      '--out': './file-out'
    },
    config: {
      confluenceBaseUrl: 'https://confluence.example',
      confluenceToken: 'file-token'
    }
  })
})

test('--env-file is accepted for network and selftest commands', () => {
  assert.equal(validateCommandInvocation('export', [
    '--page-id',
    '123',
    '--env-file',
    '.confluex.env'
  ]).kind, 'valid')
  assert.equal(validateCommandInvocation('plan', [
    '--page-id',
    '123',
    '--env-file',
    '.confluex.env'
  ]).kind, 'valid')
  assert.equal(validateCommandInvocation('doctor', [
    '--env-file',
    '.confluex.env'
  ]).kind, 'valid')
  assert.equal(validateCommandInvocation('selftest', [
    '--url',
    'http://127.0.0.1:8090',
    '--login',
    'admin',
    '--password',
    'admin',
    '--env-file',
    '.confluex.env'
  ]).kind, 'valid')
})

test('validation accepts default values before required-option checks', () => {
  assert.deepEqual(validateCommandInvocation('export', [
    '--out',
    './cli-out'
  ], {
    '--page-id': '123'
  }), {
    kind: 'valid',
    options: {
      flags: [],
      values: {
        '--out': './cli-out',
        '--page-id': '123'
      }
    }
  })
})

test('parseInvocation applies default values during command validation', () => {
  assert.deepEqual(parseInvocation(['export', '--out', './cli-out'], {
    '--page-id': '123'
  }), {
    kind: 'command',
    command: 'export',
    argv: ['--out', './cli-out'],
    options: {
      flags: [],
      values: {
        '--page-id': '123',
        '--out': './cli-out'
      }
    }
  })
})

test('run loads default env file before required option validation', async () => {
  const cwd = tempDir()
  const previousCwd = process.cwd()
  const streams = {
    stdout: { data: '', write (chunk) { this.data += chunk } },
    stderr: { data: '', write (chunk) { this.data += chunk } }
  }
  fs.writeFileSync(path.join(cwd, '.confluex.env'), 'CONFLUEX_PAGE_ID=123\n')

  try {
    process.chdir(cwd)
    const exitCode = await run(['export', '--out', path.join(cwd, 'out')], streams)
    assert.equal(exitCode, 1)
    assert.equal(streams.stdout.data, '')
    assert.equal(streams.stderr.data, 'ERROR: validation_failed FR-0017 --page-id 123\n')
  } finally {
    process.chdir(previousCwd)
  }
})
