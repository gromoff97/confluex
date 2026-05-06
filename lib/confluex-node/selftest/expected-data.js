'use strict'

const fs = require('node:fs')
const path = require('node:path')

const { REQUIRED_PAYLOAD_SOURCE_PATHS } = require('./support-preflight')

const controlFiles = [
  'fixtures/confluence-7137/expected/live-commands.json',
  'fixtures/confluence-7137/expected/live-command-expectations.json',
  'fixtures/confluence-7137/comparison-rules.json'
]

const goldenDirectory = 'fixtures/confluence-7137/expected/golden'

function prepareExpectedData (runtimeRoot, reportRoot) {
  const suiteRoot = path.resolve(runtimeRoot)
  const expectedDir = path.join(reportRoot, 'expected')

  try {
    fs.mkdirSync(expectedDir, { recursive: true })
    cleanDirectory(expectedDir)

    for (const sourcePath of controlFiles) {
      copySuiteFile(suiteRoot, expectedDir, sourcePath)
    }

    for (const sourcePath of REQUIRED_PAYLOAD_SOURCE_PATHS) {
      copySuiteFile(suiteRoot, expectedDir, sourcePath)
    }

    copySuiteDirectory(suiteRoot, expectedDir, goldenDirectory)

    return { state: 'passed' }
  } catch {
    try {
      fs.mkdirSync(expectedDir, { recursive: true })
      cleanDirectory(expectedDir)
    } catch {
    }
    return { state: 'failed' }
  }
}

function copySuiteFile (suiteRoot, expectedDir, sourcePath) {
  const retainedPath = retainedExpectedPath(sourcePath)
  const destination = path.join(expectedDir, retainedPath)
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  fs.copyFileSync(path.join(suiteRoot, sourcePath), destination)
}

function copySuiteDirectory (suiteRoot, expectedDir, sourcePath) {
  const source = path.join(suiteRoot, sourcePath)
  const target = path.join(expectedDir, retainedExpectedPath(sourcePath))
  copyDirectory(source, target)
}

function copyDirectory (source, target) {
  fs.mkdirSync(target, { recursive: true })
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourceChild = path.join(source, entry.name)
    const targetChild = path.join(target, entry.name)
    if (entry.isDirectory()) {
      copyDirectory(sourceChild, targetChild)
    } else if (entry.isFile()) {
      fs.copyFileSync(sourceChild, targetChild)
    } else {
      throw new Error(`unsupported expected-data source path: ${sourceChild}`)
    }
  }
}

function retainedExpectedPath (sourcePath) {
  if (sourcePath === 'fixtures/confluence-7137/comparison-rules.json') {
    return 'comparison-rules.json'
  }

  return sourcePath.replace('fixtures/confluence-7137/expected/', '')
}

function cleanDirectory (directory) {
  for (const entry of fs.readdirSync(directory)) {
    fs.rmSync(path.join(directory, entry), {
      recursive: true,
      force: true
    })
  }
}

module.exports = {
  prepareExpectedData
}
