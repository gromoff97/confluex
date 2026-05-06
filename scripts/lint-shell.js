#!/usr/bin/env node
'use strict'

const fs = require('node:fs')
const childProcess = require('node:child_process')

const shellcheck = 'tools/shellcheck/shellcheck'
const listed = childProcess.execFileSync('git', ['ls-files', '*.sh', '*.bash'], {
  encoding: 'utf8'
})

const files = listed
  .split('\n')
  .filter(Boolean)
  .filter(file => fs.existsSync(file))

if (files.length === 0) {
  process.exit(0)
}

const result = childProcess.spawnSync(shellcheck, files, {
  stdio: 'inherit'
})

process.exit(result.status === null ? 1 : result.status)
