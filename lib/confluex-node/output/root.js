'use strict'

const fs = require('node:fs')
const path = require('node:path')

function selectOutputRoot (command, pageId, options, dependencies = {}) {
  const cwd = dependencies.cwd || process.cwd()

  if (Object.prototype.hasOwnProperty.call(options.values, '--out')) {
    return selectExplicitOutputRoot(command, options.values['--out'], options, cwd)
  }

  return selectGeneratedOutputRoot(command, pageId, cwd, dependencies.now || new Date())
}

function selectExplicitOutputRoot (command, source, options, cwd) {
  const outputRoot = path.isAbsolute(source) ? path.resolve(source) : path.resolve(cwd, source)
  const state = lstatState(outputRoot)
  const isResume = command === 'export' && options.flags.includes('--resume')

  if (state.error) {
    return rejected('FR-0076')
  }

  if (isResume) {
    if (!state.exists) {
      return rejected('FR-0103')
    }
    if (!state.stat.isDirectory()) {
      return rejected('FR-0076')
    }
    return {
      state: 'ok',
      outputRoot
    }
  }

  if (state.exists) {
    return rejected('FR-0016')
  }

  return {
    state: 'ok',
    outputRoot
  }
}

function selectGeneratedOutputRoot (command, pageId, cwd, now) {
  const normalizedCwd = path.resolve(cwd)
  const prefix = command === 'export' ? 'confluence_dump' : 'confluence_plan'
  const baseName = `${prefix}_${pageId}_${formatUtcTimestamp(now)}`

  for (let suffix = 0; suffix < Number.MAX_SAFE_INTEGER; suffix += 1) {
    const candidateName = suffix === 0 ? baseName : `${baseName}_${suffix}`
    const candidate = path.join(normalizedCwd, candidateName)
    const state = lstatState(candidate)
    if (state.error) {
      return rejected('FR-0055')
    }
    if (!state.exists) {
      return {
        state: 'ok',
        outputRoot: candidate
      }
    }
  }

  return rejected('FR-0055')
}

function formatUtcTimestamp (date) {
  return [
    date.getUTCFullYear().toString().padStart(4, '0'),
    (date.getUTCMonth() + 1).toString().padStart(2, '0'),
    date.getUTCDate().toString().padStart(2, '0'),
    'T',
    date.getUTCHours().toString().padStart(2, '0'),
    date.getUTCMinutes().toString().padStart(2, '0'),
    date.getUTCSeconds().toString().padStart(2, '0'),
    'Z'
  ].join('')
}

function lstatState (absolutePath) {
  try {
    return {
      exists: true,
      stat: fs.lstatSync(absolutePath)
    }
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return { exists: false }
    }
    return { error }
  }
}

function rejected (requirementId) {
  return {
    state: 'rejected',
    requirementId
  }
}

module.exports = {
  selectOutputRoot
}
