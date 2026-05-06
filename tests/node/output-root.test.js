'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { selectOutputRoot } = require('../../lib/confluex-node/output/root')

function options ({ out, flags = [] } = {}) {
  return {
    flags,
    values: out === undefined ? {} : { '--out': out }
  }
}

function tempDir (prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

test('explicit non-existing output root is selected as an absolute path', () => {
  const root = path.join(tempDir('confluex-output-explicit-'), 'out')

  assert.deepEqual(selectOutputRoot('plan', '123', options({ out: root }), {
    cwd: tempDir('confluex-output-cwd-')
  }), {
    state: 'ok',
    outputRoot: root
  })
})

test('explicit existing output root is rejected for non-resume runs', () => {
  const root = tempDir('confluex-output-existing-')

  assert.deepEqual(selectOutputRoot('export', '123', options({ out: root }), {
    cwd: tempDir('confluex-output-cwd-')
  }), {
    state: 'rejected',
    requirementId: 'FR-0016'
  })
})

test('explicit existing output root is selected for resume export runs', () => {
  const root = tempDir('confluex-output-resume-existing-')

  assert.deepEqual(selectOutputRoot('export', '123', options({
    out: root,
    flags: ['--resume']
  }), {
    cwd: tempDir('confluex-output-cwd-')
  }), {
    state: 'ok',
    outputRoot: root
  })
})

test('explicit missing output root is rejected for resume export runs', () => {
  const root = path.join(tempDir('confluex-output-resume-missing-'), 'out')

  assert.deepEqual(selectOutputRoot('export', '123', options({
    out: root,
    flags: ['--resume']
  }), {
    cwd: tempDir('confluex-output-cwd-')
  }), {
    state: 'rejected',
    requirementId: 'FR-0103'
  })
})

test('generated export output root uses workflow page id and UTC timestamp', () => {
  const cwd = tempDir('confluex-output-generated-export-')

  assert.deepEqual(selectOutputRoot('export', '456', options(), {
    cwd,
    now: new Date('2026-04-30T01:02:03Z')
  }), {
    state: 'ok',
    outputRoot: path.join(cwd, 'confluence_dump_456_20260430T010203Z')
  })
})

test('generated plan output root selects the first absent suffixed candidate', () => {
  const cwd = tempDir('confluex-output-generated-plan-')
  fs.mkdirSync(path.join(cwd, 'confluence_plan_456_20260430T010203Z'))
  fs.mkdirSync(path.join(cwd, 'confluence_plan_456_20260430T010203Z_1'))

  assert.deepEqual(selectOutputRoot('plan', '456', options(), {
    cwd,
    now: new Date('2026-04-30T01:02:03Z')
  }), {
    state: 'ok',
    outputRoot: path.join(cwd, 'confluence_plan_456_20260430T010203Z_2')
  })
})
