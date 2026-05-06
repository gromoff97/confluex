'use strict'

const fs = require('node:fs')
const path = require('node:path')

const { quotePathString } = require('../path/format')
const { createSelftestConfluenceClient } = require('../selftest/confluence-client')
const { prepareExpectedData } = require('../selftest/expected-data')
const { applyFixtureDataset } = require('../selftest/fixture-apply')
const { runLiveRegression } = require('../selftest/live-regression')
const { createSelftestReportRoot } = require('../selftest/report-root')
const { materializeSelftestReport } = require('../selftest/report')
const { bootstrapSelftestTarget } = require('../selftest/target-bootstrap')
const { validateSelftestSupportPaths } = require('../selftest/support-preflight')

async function runSelftestCommand (options, dependencies = {}) {
  const target = targetFromOptions(options)
  const reportRootSelection = createSelftestReportRoot({
    cwd: dependencies.cwd || process.cwd(),
    now: dependencies.now
  })

  if (reportRootSelection.state !== 'ok') {
    return reportRootFailure('selftest_report_root_failed')
  }

  const reportRoot = reportRootSelection.reportRoot
  try {
    const runtimeRoot = dependencies.runtimeRoot || defaultRuntimeRoot()
    const supportPreflight = validateSelftestSupportPaths(runtimeRoot)
    const statuses = failedBootstrapStatuses()

    if (supportPreflight.state !== 'passed') {
      materializeSelftestReport(reportRoot, statuses)
      return retainedFailedReport(reportRoot)
    }

    const targetBootstrap = dependencies.targetBootstrap || bootstrapSelftestTarget
    const targetBootstrapResult = await targetBootstrap(target, {
      client: dependencies.targetClient
    })
    if (targetBootstrapResult.state !== 'passed') {
      materializeSelftestReport(reportRoot, statuses)
      return retainedFailedReport(reportRoot)
    }

    const fixtureApply = dependencies.fixtureApply || (context => defaultFixtureApply(context, dependencies))
    const fixtureResult = await fixtureApply({
      reportRoot,
      runtimeRoot,
      target
    })
    if (fixtureResult.state !== 'passed') {
      materializeSelftestReport(reportRoot, fixtureFailedStatuses())
      return retainedFailedReport(reportRoot)
    }

    const expectedData = dependencies.expectedData || defaultExpectedData
    const expectedDataResult = await expectedData({
      runtimeRoot,
      reportRoot
    })
    if (expectedDataResult.state !== 'passed') {
      materializeSelftestReport(reportRoot, expectedDataFailedStatuses())
      return retainedFailedReport(reportRoot)
    }

    const liveRegression = dependencies.liveRegression || (context => defaultLiveRegression(context, dependencies))
    const liveResult = await liveRegression({
      runtimeRoot,
      reportRoot,
      target
    })
    if (liveResult.state !== 'passed') {
      materializeSelftestReport(reportRoot, liveFailedStatuses())
      return retainedFailedReport(reportRoot)
    }

    materializeSelftestReport(reportRoot, passedStatuses())
    return retainedPassedReport(reportRoot)
  } catch {
    removeReportRoot(reportRoot)
    return reportRootFailure('selftest_report_retention_failed')
  }
}

function targetFromOptions (options) {
  return {
    baseUrl: options.values['--url'],
    token: options.values['--token']
  }
}

function failedBootstrapStatuses () {
  return {
    bootstrap_status: 'failed',
    fixture_apply_status: 'not_run',
    prepare_expected_data_status: 'not_run',
    live_regression_status: 'not_run',
    selftest_status: 'failed'
  }
}

function fixtureFailedStatuses () {
  return {
    bootstrap_status: 'passed',
    fixture_apply_status: 'failed',
    prepare_expected_data_status: 'not_run',
    live_regression_status: 'not_run',
    selftest_status: 'failed'
  }
}

function expectedDataFailedStatuses () {
  return {
    bootstrap_status: 'passed',
    fixture_apply_status: 'passed',
    prepare_expected_data_status: 'failed',
    live_regression_status: 'not_run',
    selftest_status: 'failed'
  }
}

function liveFailedStatuses () {
  return {
    bootstrap_status: 'passed',
    fixture_apply_status: 'passed',
    prepare_expected_data_status: 'passed',
    live_regression_status: 'failed',
    selftest_status: 'failed'
  }
}

function passedStatuses () {
  return {
    bootstrap_status: 'passed',
    fixture_apply_status: 'passed',
    prepare_expected_data_status: 'passed',
    live_regression_status: 'passed',
    selftest_status: 'passed'
  }
}

async function defaultFixtureApply (context, dependencies) {
  const client = dependencies.fixtureClient || createSelftestConfluenceClient(context.target)
  const result = await applyFixtureDataset(context.runtimeRoot, {
    client
  })

  if (result.state !== 'passed') {
    return { state: 'failed' }
  }

  fs.writeFileSync(
    path.join(context.reportRoot, 'identities.json'),
    `${JSON.stringify(result.identities)}\n`,
    'utf8'
  )
  return { state: 'passed' }
}

function defaultExpectedData (context) {
  return prepareExpectedData(context.runtimeRoot, context.reportRoot)
}

function defaultLiveRegression (context, dependencies) {
  return runLiveRegression(context.runtimeRoot, context.reportRoot, {
    target: context.target,
    invariantClient: dependencies.invariantClient
  })
}

function retainedFailedReport (reportRoot) {
  return {
    exitCode: 4,
    stdout: `selftest_result=failed report_root=${quotePathString(reportRoot)}\n`,
    stderr: ''
  }
}

function retainedPassedReport (reportRoot) {
  return {
    exitCode: 0,
    stdout: `selftest_result=passed report_root=${quotePathString(reportRoot)}\n`,
    stderr: ''
  }
}

function reportRootFailure (message) {
  return {
    exitCode: 4,
    stdout: '',
    stderr: `ERROR: ${message}\n`
  }
}

function removeReportRoot (reportRoot) {
  try {
    fs.rmSync(reportRoot, { recursive: true, force: true })
  } catch {
  }
}

function defaultRuntimeRoot () {
  return path.resolve(__dirname, '..', '..', '..')
}

module.exports = {
  runSelftestCommand
}
