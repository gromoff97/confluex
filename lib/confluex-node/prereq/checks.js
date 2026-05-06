'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { TextDecoder } = require('node:util')

const MIN_NODE_VERSION = [20, 11, 0]
const MIN_NODE_VERSION_TEXT = '>=20.11.0'

function checkNodeVersion (version = process.versions.node) {
  const parsed = parseNodeVersion(version)
  if (parsed === null || compareVersionParts(parsed, MIN_NODE_VERSION) < 0) {
    return {
      state: 'failed',
      required: MIN_NODE_VERSION_TEXT,
      actual: version
    }
  }

  return {
    state: 'passed',
    required: MIN_NODE_VERSION_TEXT,
    actual: version
  }
}

function nodeRuntimeDependency (version = process.version) {
  const normalized = version.startsWith('v') ? version.slice(1) : version
  const check = checkNodeVersion(normalized)
  return {
    label: 'node_runtime',
    state: check.state === 'passed' ? `present:${version}` : `unsupported:${version}`
  }
}

function executableDependencyProbe (label, executable, env = process.env) {
  const resolved = resolveExecutable(executable, env)
  if (resolved === null) {
    return {
      label,
      state: 'absent'
    }
  }

  const result = spawnSync(resolved, ['--version'], {
    encoding: 'buffer',
    env
  })

  const version = parseVersionProbe(result)
  return {
    label,
    state: version === null ? 'present:unknown_version' : `present:${version}`
  }
}

function runtimePrerequisiteFailure (name, details) {
  const suffix = details === undefined || details === '' ? '' : ` ${details}`
  return `ERROR: runtime_prerequisite_failed ${name}${suffix}\n`
}

function parseNodeVersion (version) {
  const match = String(version).match(/^v?([0-9]+)\.([0-9]+)\.([0-9]+)/)
  if (match === null) {
    return null
  }
  return match.slice(1).map(value => Number(value))
}

function compareVersionParts (left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] < right[index]) return -1
    if (left[index] > right[index]) return 1
  }
  return 0
}

function resolveExecutable (executable, env = process.env) {
  const pathValue = env.PATH || ''
  for (const directory of pathValue.split(path.delimiter)) {
    if (directory === '') {
      continue
    }

    const candidate = path.join(directory, executable)
    try {
      fs.accessSync(candidate, fs.constants.X_OK)
      return candidate
    } catch {
    }
  }

  return null
}

function parseVersionProbe (result) {
  if (result.status !== 0 || !Buffer.isBuffer(result.stdout)) {
    return null
  }

  const decoder = new TextDecoder('utf8', { fatal: false })
  for (const line of decoder.decode(result.stdout).split('\n')) {
    const trimmed = trimAsciiWhitespace(line)
    if (trimmed === '') {
      continue
    }

    if (trimmed === 'unknown_version' || hasAsciiControl(trimmed)) {
      return null
    }

    return trimmed
  }

  return null
}

function trimAsciiWhitespace (value) {
  return value.replace(/^[ \t\n\r]+|[ \t\n\r]+$/g, '')
}

function hasAsciiControl (value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code <= 0x1f || code === 0x7f) {
      return true
    }
  }

  return false
}

module.exports = {
  checkNodeVersion,
  executableDependencyProbe,
  nodeRuntimeDependency,
  runtimePrerequisiteFailure
}
