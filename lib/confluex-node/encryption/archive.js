'use strict'

const { spawn } = require('node:child_process')
const fs = require('node:fs/promises')
const path = require('node:path')

const { quotePathString } = require('../path/format')

function instructionSidecarText (outputRoot) {
  const paths = encryptedRunPaths(outputRoot)
  return [
    `archive_path=${quotePathString(paths.archivePath)}`,
    `decrypt_output_path=${quotePathString(paths.decryptOutputPath)}`,
    `extract_directory_path=${quotePathString(paths.extractDirectoryPath)}`,
    `decrypt_argv_json=${jsonStringArray(['gpg', '--output', paths.decryptOutputPath, '--decrypt', paths.archivePath])}`,
    `extract_argv_json=${jsonStringArray(['tar', '-xzf', paths.decryptOutputPath, '-C', paths.extractDirectoryPath])}`,
    ''
  ].join('\n')
}

async function encryptOutputRoot (outputRoot, recipient, dependencies = {}) {
  const paths = encryptedRunPaths(outputRoot)
  const createEncryptedArchive = dependencies.createEncryptedArchive || defaultCreateEncryptedArchive
  let archiveCreated = false
  let sidecarCreated = false

  if (!await pathAbsent(paths.archivePath) || !await pathAbsent(paths.sidecarPath)) {
    return { state: 'failed' }
  }

  try {
    await createEncryptedArchive(paths.outputRoot, paths.archivePath, recipient)
    archiveCreated = true
    await fs.writeFile(paths.sidecarPath, instructionSidecarText(paths.outputRoot), {
      encoding: 'utf8',
      flag: 'wx'
    })
    sidecarCreated = true
    await fs.rm(paths.outputRoot, { recursive: true })
    return {
      state: 'ok',
      archivePath: paths.archivePath
    }
  } catch {
    if (sidecarCreated) {
      await removeBestEffort(paths.sidecarPath)
    }
    if (archiveCreated) {
      await removeBestEffort(paths.archivePath)
    }
    return { state: 'failed' }
  }
}

function encryptedRunPaths (outputRoot) {
  const absoluteOutputRoot = path.resolve(outputRoot)
  return {
    outputRoot: absoluteOutputRoot,
    archivePath: `${absoluteOutputRoot}.tar.gz.gpg`,
    sidecarPath: `${absoluteOutputRoot}.tar.gz.gpg.txt`,
    decryptOutputPath: `${absoluteOutputRoot}.tar.gz`,
    extractDirectoryPath: path.dirname(absoluteOutputRoot)
  }
}

function jsonStringArray (values) {
  return `[${values.map(quotePathString).join(',')}]`
}

async function pathAbsent (targetPath) {
  try {
    await fs.lstat(targetPath)
    return false
  } catch (error) {
    return error && error.code === 'ENOENT'
  }
}

async function removeBestEffort (targetPath) {
  try {
    await fs.rm(targetPath, { force: true })
  } catch {
  }
}

function defaultCreateEncryptedArchive (outputRoot, archivePath, recipient) {
  return new Promise((resolve, reject) => {
    const parent = path.dirname(outputRoot)
    const basename = path.basename(outputRoot)
    const tar = spawn('tar', ['-czf', '-', '-C', parent, basename], {
      stdio: ['ignore', 'pipe', 'ignore']
    })
    const gpg = spawn('gpg', ['--batch', '--yes', '--recipient', recipient, '--output', archivePath, '--encrypt'], {
      stdio: ['pipe', 'ignore', 'ignore']
    })
    let settled = false
    let tarClosed = false
    let gpgClosed = false
    let tarFailed = false
    let gpgFailed = false

    function fail (error) {
      if (settled) {
        return
      }
      settled = true
      tar.kill()
      gpg.kill()
      reject(error)
    }

    function maybeResolve () {
      if (settled || !tarClosed || !gpgClosed) {
        return
      }
      settled = true
      if (tarFailed || gpgFailed) {
        reject(new Error('encrypted archive creation failed'))
        return
      }
      resolve()
    }

    tar.on('error', fail)
    gpg.on('error', fail)
    tar.on('close', code => {
      tarClosed = true
      tarFailed = code !== 0
      maybeResolve()
    })
    gpg.on('close', code => {
      gpgClosed = true
      gpgFailed = code !== 0
      maybeResolve()
    })
    tar.stdout.on('error', () => {})
    gpg.stdin.on('error', () => {})
    tar.stdout.pipe(gpg.stdin)
  })
}

module.exports = {
  encryptOutputRoot,
  instructionSidecarText
}
