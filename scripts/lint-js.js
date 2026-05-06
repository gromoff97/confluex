#!/usr/bin/env node
'use strict'

const fs = require('node:fs')
const childProcess = require('node:child_process')

const listed = childProcess.execFileSync('git', ['ls-files', '*.js', '*.mjs'], {
  encoding: 'utf8'
})

const files = [
  'confluex',
  ...listed.split('\n').filter(Boolean)
].filter(file => fs.existsSync(file))

const result = childProcess.spawnSync('standard', files, {
  stdio: 'inherit'
})

process.exit(result.status === null ? 1 : result.status)
