#!/usr/bin/env node
'use strict'

const path = require('node:path')

const repoRoot = path.resolve(__dirname, '..', '..', '..')
const { compareGoldenSnapshot } = require(path.join(repoRoot, 'lib/confluex-node/selftest/golden-snapshot'))

const [reportRoot, expectedRoot, actualRoot] = process.argv.slice(2)

if (!reportRoot || !expectedRoot || !actualRoot) {
  console.error('usage: compare-golden-snapshot.js <report-root> <expected-root> <actual-root>')
  process.exit(2)
}

const result = compareGoldenSnapshot({
  reportRoot,
  expectedRoot,
  actualRoot
})

if (result.state !== 'passed') {
  for (const failure of result.failures) {
    console.error(failure)
  }
  process.exit(1)
}
