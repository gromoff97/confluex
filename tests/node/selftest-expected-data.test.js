'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { REQUIRED_PAYLOAD_SOURCE_PATHS } = require('../../lib/confluex-node/selftest/support-preflight')
const { prepareExpectedData } = require('../../lib/confluex-node/selftest/expected-data')

const repoRoot = path.resolve(__dirname, '../..')

function tempDir (prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

test('expected data preparation copies governed control files and payload bytes', () => {
  const reportRoot = tempDir('confluex-expected-data-')

  const result = prepareExpectedData(repoRoot, reportRoot)

  assert.deepEqual(result, { state: 'passed' })
  assert.deepEqual(fs.readdirSync(path.join(reportRoot, 'expected')).sort(), [
    'comparison-rules.json',
    'golden',
    'live-command-expectations.json',
    'live-commands.json',
    'payloads'
  ])
  assert.equal(fs.readFileSync(path.join(reportRoot, 'expected/comparison-rules.json'), 'utf8'), '{}\n')
  assert.equal(
    fs.readFileSync(path.join(reportRoot, 'expected/live-commands.json'), 'utf8'),
    fs.readFileSync(path.join(repoRoot, 'fixtures/confluence-7137/expected/live-commands.json'), 'utf8')
  )
  assert.equal(
    fs.readFileSync(path.join(reportRoot, 'expected/live-command-expectations.json'), 'utf8'),
    fs.readFileSync(path.join(repoRoot, 'fixtures/confluence-7137/expected/live-command-expectations.json'), 'utf8')
  )

  for (const sourcePath of REQUIRED_PAYLOAD_SOURCE_PATHS) {
    const retainedPath = sourcePath.replace('fixtures/confluence-7137/expected/', '')
    assert.equal(
      fs.readFileSync(path.join(reportRoot, 'expected', retainedPath), 'utf8'),
      fs.readFileSync(path.join(repoRoot, sourcePath), 'utf8')
    )
  }

  assert.equal(
    fs.readFileSync(path.join(reportRoot, 'expected/golden/export-root-tree-md/summary.txt.template'), 'utf8'),
    fs.readFileSync(path.join(repoRoot, 'fixtures/confluence-7137/expected/golden/export-root-tree-md/summary.txt.template'), 'utf8')
  )
})

test('expected data preparation cleans expected directory after source failure', () => {
  const reportRoot = tempDir('confluex-expected-data-failed-')
  fs.mkdirSync(path.join(reportRoot, 'expected'), { recursive: true })
  fs.writeFileSync(path.join(reportRoot, 'expected/stale.txt'), 'stale\n', 'utf8')

  const result = prepareExpectedData(path.join(reportRoot, 'missing-suite-root'), reportRoot)

  assert.deepEqual(result, { state: 'failed' })
  assert.deepEqual(fs.readdirSync(path.join(reportRoot, 'expected')), [])
})
