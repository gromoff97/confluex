'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { TextDecoder } = require('node:util')

const { createSelftestConfluenceClient } = require('./confluence-client')
const { checkFixtureInvariants } = require('./fixture-invariant')

const liveRegressionPath = 'tests/live-bats/live-regression.bats'
const defaultInvariantRetryAttempts = 10
const defaultInvariantRetryDelayMs = 1000

async function runLiveRegression (runtimeRoot, reportRoot, dependencies = {}) {
  const suiteRoot = path.resolve(runtimeRoot)
  const tapPath = path.join(reportRoot, 'live-bats.tap')
  const runCommand = dependencies.runCommand || defaultRunCommand
  const invariantCheck = dependencies.invariantCheck || (context => defaultInvariantCheck(context, dependencies))
  const target = dependencies.target

  try {
    fs.mkdirSync(reportRoot, { recursive: true })
    if (!isRegularFile(path.join(suiteRoot, liveRegressionPath)) || !isTarget(target)) {
      fs.writeFileSync(tapPath, '')
      return { state: 'failed' }
    }

    const result = runCommand('bats', ['--tap', liveRegressionPath], {
      cwd: suiteRoot,
      env: selftestLiveEnvironment({
        ...process.env,
        CONFLUEX_SELFTEST_SUITE_ROOT: suiteRoot,
        CONFLUEX_SELFTEST_REPORT_ROOT: reportRoot,
        CONFLUEX_SELFTEST_CONFLUENCE_BASE_URL: target.baseUrl,
        CONFLUEX_SELFTEST_CONFLUENCE_TOKEN: target.token,
        CONFLUEX_CONFLUENCE_BASE_URL: target.baseUrl,
        CONFLUEX_CONFLUENCE_TOKEN: target.token
      })
    })
    const tap = [
      `# live-bats-file ${liveRegressionPath}`,
      normalizeLf(decodeStdout(result.stdout)).replace(/\n$/, '')
    ].join('\n') + '\n'
    fs.writeFileSync(tapPath, tap, 'utf8')

    if (!commandSucceeded(result)) {
      return { state: 'failed' }
    }

    const invariant = await checkInvariantWithRetries({
      runtimeRoot: suiteRoot,
      reportRoot,
      target
    }, invariantCheck, dependencies)

    return invariant.state === 'passed' ? { state: 'passed' } : { state: 'failed' }
  } catch {
    try {
      fs.writeFileSync(tapPath, '')
    } catch {
    }
    return { state: 'failed' }
  }
}

function isTarget (target) {
  return target !== null &&
    typeof target === 'object' &&
    typeof target.baseUrl === 'string' &&
    target.baseUrl !== '' &&
    typeof target.token === 'string' &&
    target.token !== ''
}

function selftestLiveEnvironment (env) {
  const childEnv = Object.assign({}, env)
  delete childEnv.CONFLUEX_SELFTEST_CONFLUENCE_USERNAME
  delete childEnv.CONFLUEX_SELFTEST_CONFLUENCE_PASSWORD
  delete childEnv.CONFLUEX_CONFLUENCE_USERNAME
  delete childEnv.CONFLUEX_CONFLUENCE_PASSWORD
  return childEnv
}

function isRegularFile (absolutePath) {
  try {
    return fs.lstatSync(absolutePath).isFile()
  } catch {
    return false
  }
}

function commandSucceeded (result) {
  return result !== null &&
    result !== undefined &&
    result.status === 0 &&
    (result.signal === null || result.signal === undefined)
}

function decodeStdout (stdout) {
  if (stdout === undefined || stdout === null) {
    return ''
  }

  if (typeof stdout === 'string') {
    return stdout
  }

  const decoder = new TextDecoder('utf-8', { fatal: true })
  return decoder.decode(stdout)
}

function normalizeLf (value) {
  return value.replace(/\r\n?/g, '\n')
}

function defaultRunCommand (command, args, options) {
  return spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: 'buffer'
  })
}

async function checkInvariantWithRetries (context, invariantCheck, dependencies) {
  const attempts = positiveIntegerOrDefault(dependencies.invariantRetryAttempts, defaultInvariantRetryAttempts)
  const delayMs = nonNegativeIntegerOrDefault(dependencies.invariantRetryDelayMs, defaultInvariantRetryDelayMs)

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const invariant = await invariantCheck(context)
    if (invariant.state === 'passed' || attempt === attempts) {
      return invariant
    }
    await delay(delayMs)
  }

  return { state: 'failed' }
}

function defaultInvariantCheck (context, dependencies) {
  const client = dependencies.invariantClient || createSelftestConfluenceClient(context.target)
  return checkFixtureInvariants(context.runtimeRoot, context.reportRoot, {
    client,
    target: context.target
  })
}

function positiveIntegerOrDefault (value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback
}

function nonNegativeIntegerOrDefault (value, fallback) {
  return Number.isInteger(value) && value >= 0 ? value : fallback
}

function delay (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

module.exports = {
  runLiveRegression
}
