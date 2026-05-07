'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const {
  preparePersistentLog,
  writePersistentLog
} = require('../../dist/confluex-node/output/log-file')

function options (values = {}) {
  return {
    flags: [],
    values
  }
}

test('preparePersistentLog returns absent when log-file is not selected', () => {
  assert.deepEqual(preparePersistentLog(options()), {
    state: 'absent'
  })
})

test('writePersistentLog normalizes selected path and replaces existing file contents', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-log-file-'))
  const logDir = path.join(cwd, 'logs')
  fs.mkdirSync(logDir)
  const logFile = path.join(logDir, 'old.log')
  fs.writeFileSync(logFile, 'stale\n', 'utf8')

  const prepared = preparePersistentLog(options({ '--log-file': 'logs/../logs/old.log' }), { cwd })
  assert.equal(prepared.state, 'ready')

  assert.deepEqual(writePersistentLog(prepared, 'current\n'), {
    state: 'ok'
  })
  assert.equal(fs.readFileSync(logFile, 'utf8'), 'current\n')
})

test('preparePersistentLog rejects directory and symlink final paths', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-log-reject-'))
  const directory = path.join(cwd, 'directory-log')
  const symlink = path.join(cwd, 'symlink-log')
  fs.mkdirSync(directory)
  fs.symlinkSync(directory, symlink)

  assert.deepEqual(preparePersistentLog(options({ '--log-file': directory }), { cwd }), {
    state: 'rejected',
    requirementId: 'FR-0134'
  })
  assert.deepEqual(preparePersistentLog(options({ '--log-file': symlink }), { cwd }), {
    state: 'rejected',
    requirementId: 'FR-0134'
  })
})

test('preparePersistentLog rejects output-root equality and descendant conflicts', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-log-conflict-'))
  const outputRoot = path.join(cwd, 'out')

  assert.deepEqual(preparePersistentLog(options({ '--log-file': outputRoot }), { cwd, outputRoot }), {
    state: 'rejected',
    requirementId: 'FR-0134'
  })
  assert.deepEqual(preparePersistentLog(options({ '--log-file': path.join(outputRoot, 'run.log') }), { cwd, outputRoot }), {
    state: 'rejected',
    requirementId: 'FR-0134'
  })
})
