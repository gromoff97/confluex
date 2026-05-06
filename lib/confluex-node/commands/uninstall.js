'use strict'

const fs = require('node:fs')
const path = require('node:path')

const { quotePathString } = require('../path/format')
const { bytewiseCompare, parseInstallManifest } = require('../lifecycle/manifest')

const manifestName = '.confluex-install-manifest.txt'

async function runUninstallCommand (options, dependencies = {}) {
  const runtimeRoot = dependencies.runtimeRoot || path.resolve(__dirname, '..', '..', '..')
  const env = dependencies.env || process.env
  const target = resolveTarget(options, env)

  if (target === null || overlaps(runtimeRoot, target)) {
    return validationFailure('FR-0170')
  }

  const targetState = lstatState(target)
  if (targetState.error || (targetState.exists && !targetState.stat.isDirectory())) {
    return validationFailure('FR-0170')
  }

  if (!targetState.exists) {
    return success('absent', target)
  }

  const manifestPath = path.join(target, manifestName)
  const manifestState = lstatState(manifestPath)
  if (manifestState.error || (manifestState.exists && !manifestState.stat.isFile())) {
    return validationFailure('FR-0170')
  }

  if (!manifestState.exists) {
    return success('absent', target)
  }

  let parsed
  try {
    parsed = parseInstallManifest(fs.readFileSync(manifestPath), target)
  } catch {
    return validationFailure('FR-0170')
  }

  if (!parsed.valid) {
    return validationFailure('FR-0170')
  }

  try {
    removeManifestListedPaths(target, parsed.relativePaths)
    fs.unlinkSync(manifestPath)
    return success('removed', target)
  } catch {
    return runtimeFailure()
  }
}

function removeManifestListedPaths (target, relativePaths) {
  const entries = relativePaths
    .filter(relativePath => relativePath !== manifestName)
    .map(relativePath => {
      const state = lstatState(path.join(target, ...relativePath.split('/')))
      if (state.error) {
        throw new Error(`cannot inspect manifest path: ${relativePath}`)
      }
      if (state.exists && !state.stat.isFile() && !state.stat.isSymbolicLink() && !state.stat.isDirectory()) {
        throw new Error(`unsupported manifest path kind: ${relativePath}`)
      }
      return {
        relativePath,
        absolutePath: path.join(target, ...relativePath.split('/')),
        state
      }
    })

  for (const entry of entries) {
    if (entry.state.exists && (entry.state.stat.isFile() || entry.state.stat.isSymbolicLink())) {
      fs.unlinkSync(entry.absolutePath)
    }
  }

  const directories = entries
    .filter(entry => entry.state.exists && entry.state.stat.isDirectory())
    .sort(compareDirectoryRemovalOrder)

  for (const entry of directories) {
    if (fs.readdirSync(entry.absolutePath).length !== 0) {
      throw new Error(`listed directory is not empty: ${entry.relativePath}`)
    }
    fs.rmdirSync(entry.absolutePath)
  }
}

function compareDirectoryRemovalOrder (left, right) {
  const leftDepth = pathDepth(left.relativePath)
  const rightDepth = pathDepth(right.relativePath)
  if (leftDepth !== rightDepth) {
    return rightDepth - leftDepth
  }
  return bytewiseCompare(left.relativePath, right.relativePath)
}

function pathDepth (relativePath) {
  return relativePath.split('/').length
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

function resolveTarget (options, env) {
  const explicit = options.values['--install-dir']
  if (explicit !== undefined) {
    return path.resolve(explicit)
  }

  if (process.platform === 'win32') {
    const userProfile = env.USERPROFILE
    return typeof userProfile === 'string' && userProfile !== '' ? path.resolve(userProfile, '.local', 'bin') : null
  }

  const home = env.HOME
  return typeof home === 'string' && home !== '' && path.isAbsolute(home) ? path.resolve(home, '.local', 'bin') : null
}

function overlaps (runtimeRoot, target) {
  const normalizedRuntimeRoot = path.resolve(runtimeRoot)
  const normalizedTarget = path.resolve(target)
  return normalizedRuntimeRoot === normalizedTarget ||
    isDescendant(normalizedRuntimeRoot, normalizedTarget) ||
    isDescendant(normalizedTarget, normalizedRuntimeRoot)
}

function isDescendant (ancestor, candidate) {
  const relative = path.relative(ancestor, candidate)
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
}

function success (status, target) {
  return {
    exitCode: 0,
    stdout: `uninstall_result=${status} target=${quotePathString(target)}\n`,
    stderr: ''
  }
}

function validationFailure (requirementId) {
  return {
    exitCode: 1,
    stdout: '',
    stderr: `ERROR: validation_failed ${requirementId}\n`
  }
}

function runtimeFailure () {
  return {
    exitCode: 4,
    stdout: '',
    stderr: 'ERROR: runtime_failure uninstall\n'
  }
}

module.exports = {
  runUninstallCommand
}
