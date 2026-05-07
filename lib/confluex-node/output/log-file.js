'use strict'

const fs = require('node:fs')
const path = require('node:path')

function preparePersistentLog (options, dependencies = {}) {
  if (!Object.prototype.hasOwnProperty.call(options.values, '--log-file')) {
    return { state: 'absent' }
  }

  const cwd = dependencies.cwd || process.cwd()
  const logPath = path.resolve(cwd, options.values['--log-file'])
  const outputRoot = dependencies.outputRoot === undefined
    ? null
    : path.resolve(cwd, dependencies.outputRoot)

  if (outputRoot !== null && conflictsWithOutputRoot(logPath, outputRoot)) {
    return rejected()
  }

  if (!existingPathIsUsable(logPath)) {
    return rejected()
  }

  return {
    state: 'ready',
    path: logPath
  }
}

function writePersistentLog (prepared, text) {
  if (prepared.state === 'absent') {
    return { state: 'ok' }
  }

  if (prepared.state !== 'ready') {
    return { state: 'failed' }
  }

  try {
    fs.mkdirSync(path.dirname(prepared.path), { recursive: true })
    fs.writeFileSync(prepared.path, normalizeLogText(text), 'utf8')
    return { state: 'ok' }
  } catch {
    return { state: 'failed' }
  }
}

function existingPathIsUsable (logPath) {
  const parent = path.dirname(logPath)
  const parsed = path.parse(parent)
  const relativeParent = path.relative(parsed.root, parent)
  const segments = relativeParent === '' ? [] : relativeParent.split(path.sep)
  let current = parsed.root

  for (const segment of segments) {
    current = path.join(current, segment)
    const state = lstatPath(current)
    if (state === 'missing') {
      return true
    }
    if (state === 'unusable' || !state.stat.isDirectory() || state.stat.isSymbolicLink()) {
      return false
    }
  }

  const finalState = lstatPath(logPath)
  if (finalState === 'missing') {
    return true
  }
  return finalState !== 'unusable' && finalState.stat.isFile() && !finalState.stat.isSymbolicLink()
}

function lstatPath (target) {
  try {
    return { stat: fs.lstatSync(target) }
  } catch (error) {
    return error && error.code === 'ENOENT' ? 'missing' : 'unusable'
  }
}

function conflictsWithOutputRoot (logPath, outputRoot) {
  const reservedSiblings = [
    `${outputRoot}.zip`
  ]
  return samePath(logPath, outputRoot) ||
    isDescendant(outputRoot, logPath) ||
    reservedSiblings.some(reservedPath => samePath(logPath, reservedPath))
}

function samePath (left, right) {
  return path.relative(left, right) === ''
}

function isDescendant (parent, child) {
  const relative = path.relative(parent, child)
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
}

function normalizeLogText (text) {
  return String(text).replace(/\0/g, '').replace(/\r\n?/g, '\n')
}

function rejected () {
  return {
    state: 'rejected',
    requirementId: 'FR-0134'
  }
}

module.exports = {
  preparePersistentLog,
  writePersistentLog
}
