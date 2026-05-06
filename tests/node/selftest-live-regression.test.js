'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { runLiveRegression } = require('../../lib/confluex-node/selftest/live-regression')

function tempDir (prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

function createSuiteRoot () {
  const suiteRoot = tempDir('confluex-live-suite-')
  fs.mkdirSync(path.join(suiteRoot, 'tests/live-bats'), { recursive: true })
  fs.writeFileSync(path.join(suiteRoot, 'tests/live-bats/live-regression.bats'), '#!/usr/bin/env bats\n', 'utf8')
  fs.mkdirSync(path.join(suiteRoot, 'tests/live-bats/helpers'), { recursive: true })
  fs.writeFileSync(path.join(suiteRoot, 'tests/live-bats/helpers/compare-golden-snapshot.js'), '#!/usr/bin/env node\n', 'utf8')
  return suiteRoot
}

test('live regression runs governed Bats entrypoint and retains prefixed TAP', async () => {
  const suiteRoot = createSuiteRoot()
  const reportRoot = tempDir('confluex-live-report-')
  const calls = []

  const result = await runLiveRegression(suiteRoot, reportRoot, {
    target: {
      baseUrl: 'http://127.0.0.1:18090',
      username: 'admin',
      password: 'secret'
    },
    runCommand: (command, args, options) => {
      calls.push({ command, args, cwd: options.cwd, env: options.env })
      return {
        status: 0,
        signal: null,
        stdout: '1..1\nok 1 successful markdown root tree export matches golden snapshot\n',
        stderr: ''
      }
    },
    invariantCheck: async () => ({ state: 'passed' })
  })

  assert.deepEqual(result, { state: 'passed' })
  assert.equal(fs.readFileSync(path.join(reportRoot, 'live-bats.tap'), 'utf8'), [
    '# live-bats-file tests/live-bats/live-regression.bats',
    '1..1',
    'ok 1 successful markdown root tree export matches golden snapshot',
    ''
  ].join('\n'))
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0].args, ['--tap', 'tests/live-bats/live-regression.bats'])
  assert.equal(calls[0].command, 'bats')
  assert.equal(calls[0].cwd, suiteRoot)
  assert.equal(calls[0].env.CONFLUEX_SELFTEST_SUITE_ROOT, suiteRoot)
  assert.equal(calls[0].env.CONFLUEX_SELFTEST_REPORT_ROOT, reportRoot)
  assert.equal(calls[0].env.CONFLUEX_SELFTEST_CONFLUENCE_BASE_URL, 'http://127.0.0.1:18090')
  assert.equal(calls[0].env.CONFLUEX_SELFTEST_CONFLUENCE_USERNAME, 'admin')
  assert.equal(calls[0].env.CONFLUEX_SELFTEST_CONFLUENCE_PASSWORD, 'secret')
  assert.equal(calls[0].env.CONFLUEX_CONFLUENCE_BASE_URL, 'http://127.0.0.1:18090')
  assert.equal(calls[0].env.CONFLUEX_CONFLUENCE_USERNAME, 'admin')
  assert.equal(calls[0].env.CONFLUEX_CONFLUENCE_PASSWORD, 'secret')
})

test('live regression fails before Bats and leaves empty TAP when entrypoint is missing', async () => {
  const suiteRoot = tempDir('confluex-live-missing-suite-')
  const reportRoot = tempDir('confluex-live-missing-report-')

  const result = await runLiveRegression(suiteRoot, reportRoot, {
    runCommand: () => {
      throw new Error('must not run')
    }
  })

  assert.deepEqual(result, { state: 'failed' })
  assert.equal(fs.readFileSync(path.join(reportRoot, 'live-bats.tap'), 'utf8'), '')
})

test('live regression retains TAP and fails when Bats exits non-zero', async () => {
  const suiteRoot = createSuiteRoot()
  const reportRoot = tempDir('confluex-live-nonzero-report-')

  const result = await runLiveRegression(suiteRoot, reportRoot, {
    target: {
      baseUrl: 'http://127.0.0.1:18090',
      username: 'admin',
      password: 'secret'
    },
    runCommand: () => ({
      status: 1,
      signal: null,
      stdout: '1..1\nnot ok 1 successful markdown root tree export matches golden snapshot\n',
      stderr: ''
    }),
    invariantCheck: async () => ({ state: 'passed' })
  })

  assert.deepEqual(result, { state: 'failed' })
  assert.equal(fs.readFileSync(path.join(reportRoot, 'live-bats.tap'), 'utf8'), [
    '# live-bats-file tests/live-bats/live-regression.bats',
    '1..1',
    'not ok 1 successful markdown root tree export matches golden snapshot',
    ''
  ].join('\n'))
})

test('live regression retries transient post-live invariant failures', async () => {
  const suiteRoot = createSuiteRoot()
  const reportRoot = tempDir('confluex-live-transient-invariant-report-')
  const invariantStates = ['failed', 'passed']
  const attempts = []

  const result = await runLiveRegression(suiteRoot, reportRoot, {
    target: {
      baseUrl: 'http://127.0.0.1:18090',
      username: 'admin',
      password: 'secret'
    },
    runCommand: () => ({
      status: 0,
      signal: null,
      stdout: '1..1\nok 1 successful markdown root tree export matches golden snapshot\n',
      stderr: ''
    }),
    invariantRetryDelayMs: 0,
    invariantCheck: async context => {
      attempts.push(context)
      return { state: invariantStates.shift() || 'failed' }
    }
  })

  assert.deepEqual(result, { state: 'passed' })
  assert.equal(attempts.length, 2)
})

test('live regression fails after bounded post-live invariant retries', async () => {
  const suiteRoot = createSuiteRoot()
  const reportRoot = tempDir('confluex-live-bounded-invariant-report-')
  const attempts = []

  const result = await runLiveRegression(suiteRoot, reportRoot, {
    target: {
      baseUrl: 'http://127.0.0.1:18090',
      username: 'admin',
      password: 'secret'
    },
    runCommand: () => ({
      status: 0,
      signal: null,
      stdout: '1..1\nok 1 successful markdown root tree export matches golden snapshot\n',
      stderr: ''
    }),
    invariantRetryAttempts: 3,
    invariantRetryDelayMs: 0,
    invariantCheck: async context => {
      attempts.push(context)
      return { state: 'failed' }
    }
  })

  assert.deepEqual(result, { state: 'failed' })
  assert.equal(attempts.length, 3)
})

test('live regression default invariant check can pass through invariant client', async () => {
  const suiteRoot = createSuiteRoot()
  const reportRoot = tempDir('confluex-live-default-invariant-report-')
  const invariantContexts = []
  const target = {
    baseUrl: 'http://127.0.0.1:18090',
    username: 'admin',
    password: 'secret'
  }

  const result = await runLiveRegression(suiteRoot, reportRoot, {
    target,
    runCommand: () => ({
      status: 0,
      signal: null,
      stdout: '1..1\nok 1 successful markdown root tree export matches golden snapshot\n',
      stderr: ''
    }),
    invariantClient: {
      async checkFixtureInvariant (context) {
        invariantContexts.push(context)
        return { state: 'passed' }
      }
    }
  })

  assert.deepEqual(result, { state: 'passed' })
  assert.deepEqual(invariantContexts, [{
    runtimeRoot: suiteRoot,
    reportRoot,
    target
  }])
})
