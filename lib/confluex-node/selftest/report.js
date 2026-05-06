'use strict'

const fs = require('node:fs')
const path = require('node:path')

const { quotePathString } = require('../path/format')

const diagnosticFiles = [
  'bootstrap.log',
  'fixture-apply.log',
  'prepare-expected-data.log',
  'live-regression.log'
]

function materializeSelftestReport (reportRoot, statuses) {
  fs.writeFileSync(path.join(reportRoot, 'summary.txt'), summaryText(reportRoot, statuses), 'utf8')
  writeDefaultFile(path.join(reportRoot, 'identities.json'), '{}\n', statuses.fixture_apply_status === 'passed')
  writeDefaultFile(path.join(reportRoot, 'live-bats.tap'), '', statuses.live_regression_status !== 'not_run')

  for (const directory of ['expected', 'plan', 'export', 'diagnostics']) {
    fs.mkdirSync(path.join(reportRoot, directory), { recursive: true })
  }

  for (const file of diagnosticFiles) {
    writeDefaultFile(path.join(reportRoot, 'diagnostics', file), '', true)
  }
}

function writeDefaultFile (filePath, content, preserveExisting) {
  if (preserveExisting && isRegularFile(filePath)) {
    return
  }

  fs.writeFileSync(filePath, content, 'utf8')
}

function isRegularFile (filePath) {
  try {
    return fs.lstatSync(filePath).isFile()
  } catch {
    return false
  }
}

function summaryText (reportRoot, statuses) {
  return [
    'command=selftest',
    'confluence_version=7.13.7',
    'fixture_dataset=confluence-7137',
    `bootstrap_status=${statuses.bootstrap_status}`,
    `fixture_apply_status=${statuses.fixture_apply_status}`,
    `prepare_expected_data_status=${statuses.prepare_expected_data_status}`,
    `live_regression_status=${statuses.live_regression_status}`,
    `selftest_status=${statuses.selftest_status}`,
    `report_root=${quotePathString(reportRoot)}`,
    ''
  ].join('\n')
}

module.exports = {
  materializeSelftestReport
}
