'use strict'

const fs = require('node:fs')
const path = require('node:path')

function parseEnvFile (bytes) {
  const text = Buffer.isBuffer(bytes) ? bytes.toString('utf8') : String(bytes)
  if (text.includes('\u0000')) {
    throw new Error('invalid env file NUL')
  }

  const values = new Map()
  for (const rawLine of text.split(/\n/)) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine
    const trimmedStart = line.replace(/^[ \t]+/, '')
    if (trimmedStart === '' || trimmedStart.startsWith('#')) {
      continue
    }

    const separator = line.indexOf('=')
    if (separator === -1) {
      throw new Error('invalid env file assignment')
    }

    const key = line.slice(0, separator).trim()
    if (key === '' || invalidKeyCharacter(key)) {
      throw new Error('invalid env file key')
    }

    let value = line.slice(separator + 1)
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1)
    }
    values.set(key, value)
  }

  return values
}

function invalidKeyCharacter (key) {
  return key.includes('=') ||
    key.includes('\u0000') ||
    key.includes('\n') ||
    key.includes('\r')
}

function loadSelectedEnvFile (cwd, explicitPath) {
  const selectedPath = explicitPath === undefined
    ? defaultEnvFilePath(cwd)
    : path.resolve(cwd, explicitPath)

  if (selectedPath === null) {
    return {
      path: null,
      values: new Map()
    }
  }

  let bytes
  try {
    const stat = fs.statSync(selectedPath)
    if (!stat.isFile()) {
      throw new Error('not file')
    }
    bytes = fs.readFileSync(selectedPath)
  } catch {
    if (explicitPath !== undefined) {
      throw new Error('env file not readable')
    }
    return {
      path: null,
      values: new Map()
    }
  }

  return {
    path: selectedPath,
    values: parseEnvFile(bytes)
  }
}

function defaultEnvFilePath (cwd) {
  const candidate = path.resolve(cwd, '.confluex.env')
  return fs.existsSync(candidate) ? candidate : null
}

module.exports = {
  parseEnvFile,
  loadSelectedEnvFile
}
