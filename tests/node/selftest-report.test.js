'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { quotePathString } = require('../../lib/confluex-node/path/format')
const { materializeSelftestReport } = require('../../lib/confluex-node/selftest/report')

function tempDir (prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

test('selftest report materializer writes retained bootstrap-failed schema', () => {
  const reportRoot = tempDir('confluex-selftest-report-')

  materializeSelftestReport(reportRoot, {
    bootstrap_status: 'failed',
    fixture_apply_status: 'not_run',
    prepare_expected_data_status: 'not_run',
    live_regression_status: 'not_run',
    selftest_status: 'failed'
  })

  assert.deepEqual(fs.readdirSync(reportRoot).sort(), [
    'diagnostics',
    'expected',
    'export',
    'identities.json',
    'live-bats.tap',
    'plan',
    'summary.txt'
  ])

  assert.equal(fs.readFileSync(path.join(reportRoot, 'summary.txt'), 'utf8'), [
    'command=selftest',
    'confluence_version=7.13.7',
    'fixture_dataset=confluence-7137',
    'bootstrap_status=failed',
    'fixture_apply_status=not_run',
    'prepare_expected_data_status=not_run',
    'live_regression_status=not_run',
    'selftest_status=failed',
    `report_root=${quotePathString(reportRoot)}`,
    ''
  ].join('\n'))
  assert.equal(fs.readFileSync(path.join(reportRoot, 'identities.json'), 'utf8'), '{}\n')
  assert.equal(fs.readFileSync(path.join(reportRoot, 'live-bats.tap'), 'utf8'), '')
  assert.deepEqual(fs.readdirSync(path.join(reportRoot, 'expected')), [])
  assert.deepEqual(fs.readdirSync(path.join(reportRoot, 'plan')), [])
  assert.deepEqual(fs.readdirSync(path.join(reportRoot, 'export')), [])
  assert.deepEqual(fs.readdirSync(path.join(reportRoot, 'diagnostics')).sort(), [
    'bootstrap.log',
    'fixture-apply.log',
    'live-regression.log',
    'prepare-expected-data.log'
  ])
  for (const file of fs.readdirSync(path.join(reportRoot, 'diagnostics'))) {
    assert.equal(fs.readFileSync(path.join(reportRoot, 'diagnostics', file), 'utf8'), '')
  }
})
