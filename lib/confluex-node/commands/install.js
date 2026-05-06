'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const { quotePathString, sortedManifestText } = require('../path/format')

const supportRoots = [
  'lib/confluex-node',
  'tests/fixtures/confluence-7137',
  'tests/live-bats'
]

async function runInstallCommand (options, dependencies = {}) {
  const runtimeRoot = dependencies.runtimeRoot || path.resolve(__dirname, '..', '..', '..')
  const env = dependencies.env || process.env
  const target = resolveTarget(options, env)

  if (target === null || overlaps(runtimeRoot, target)) {
    return validationFailure('FR-0166')
  }

  try {
    fs.mkdirSync(target, { recursive: true })
    copyFile(path.join(runtimeRoot, 'confluex'), path.join(target, 'confluex'), true)

    for (const root of supportRoots) {
      copyTree(path.join(runtimeRoot, root), path.join(target, root))
    }

    const manifestPaths = installedRelativePaths(target)
    fs.writeFileSync(path.join(target, '.confluex-install-manifest.txt'), sortedManifestText(manifestPaths), 'utf8')

    const verification = spawnSync(path.join(target, 'confluex'), ['--help'], {
      encoding: 'utf8'
    })
    if (verification.status !== 0 || verification.stderr !== '' || !verification.stdout.startsWith('Usage\n')) {
      return runtimeFailure()
    }

    return {
      exitCode: 0,
      stdout: `install_result=installed target=${quotePathString(target)}\n`,
      stderr: ''
    }
  } catch {
    return runtimeFailure()
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

function copyFile (source, target, executable = false) {
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.copyFileSync(source, target)
  if (executable) {
    fs.chmodSync(target, 0o755)
  }
}

function copyTree (source, target) {
  const stat = fs.lstatSync(source)
  if (!stat.isDirectory()) {
    throw new Error(`support root is not directory: ${source}`)
  }

  fs.mkdirSync(target, { recursive: true })
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourceChild = path.join(source, entry.name)
    const targetChild = path.join(target, entry.name)
    if (entry.isDirectory()) {
      copyTree(sourceChild, targetChild)
    } else if (entry.isFile()) {
      copyFile(sourceChild, targetChild)
    } else {
      throw new Error(`unsupported install source path: ${sourceChild}`)
    }
  }
}

function installedRelativePaths (target) {
  const relativePaths = ['confluex', '.confluex-install-manifest.txt']

  for (const root of supportRoots) {
    collectRelativePaths(target, root, relativePaths)
  }

  return relativePaths
}

function collectRelativePaths (target, relativePath, relativePaths) {
  relativePaths.push(relativePath)
  const absolutePath = path.join(target, relativePath)
  const entries = fs.readdirSync(absolutePath, { withFileTypes: true })
  for (const entry of entries) {
    const childRelativePath = `${relativePath}/${entry.name}`
    if (entry.isDirectory()) {
      collectRelativePaths(target, childRelativePath, relativePaths)
    } else if (entry.isFile()) {
      relativePaths.push(childRelativePath)
    }
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
    stderr: 'ERROR: runtime_failure install\n'
  }
}

module.exports = {
  runInstallCommand
}
