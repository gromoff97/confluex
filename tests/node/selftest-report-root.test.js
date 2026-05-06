'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { createSelftestReportRoot } = require('../../lib/confluex-node/selftest/report-root')

function tempDir (prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

test('selftest report root uses default timestamp name under cwd', () => {
  const cwd = tempDir('confluex-selftest-root-')

  const result = createSelftestReportRoot({
    cwd,
    now: new Date('2026-04-30T01:02:03Z')
  })

  assert.deepEqual(result, {
    state: 'ok',
    reportRoot: path.join(cwd, 'confluex_selftest_20260430T010203Z')
  })
  assert.equal(fs.statSync(result.reportRoot).isDirectory(), true)
})

test('selftest report root retries with numeric suffix when candidate exists', () => {
  const cwd = tempDir('confluex-selftest-root-suffix-')
  fs.mkdirSync(path.join(cwd, 'confluex_selftest_20260430T010203Z'))
  fs.mkdirSync(path.join(cwd, 'confluex_selftest_20260430T010203Z_1'))

  const result = createSelftestReportRoot({
    cwd,
    now: new Date('2026-04-30T01:02:03Z')
  })

  assert.deepEqual(result, {
    state: 'ok',
    reportRoot: path.join(cwd, 'confluex_selftest_20260430T010203Z_2')
  })
  assert.equal(fs.statSync(result.reportRoot).isDirectory(), true)
})

test('selftest report root reports failure when candidate creation cannot succeed', () => {
  const cwd = path.join(tempDir('confluex-selftest-root-failure-'), 'not-a-directory')
  fs.writeFileSync(cwd, 'file\n', 'utf8')

  const result = createSelftestReportRoot({
    cwd,
    now: new Date('2026-04-30T01:02:03Z')
  })

  assert.deepEqual(result, { state: 'failed' })
})
