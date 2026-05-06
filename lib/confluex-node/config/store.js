'use strict'

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

function defaultConfigStateFile () {
  return path.join(os.homedir(), '.confluex', 'default-encryption-key.txt')
}

function createConfigStore (options = {}) {
  const stateFile = options.stateFile || defaultConfigStateFile()
  const fsApi = options.fsApi || fs

  function readDefaultEncryptionKey () {
    if (!fsApi.existsSync(stateFile)) {
      return null
    }

    const content = fsApi.readFileSync(stateFile, 'utf8')
    return content.endsWith('\n') ? content.slice(0, -1) : content
  }

  function saveDefaultEncryptionKey (value) {
    const stateDir = path.dirname(stateFile)
    const tempFile = path.join(stateDir, `.default-encryption-key.${process.pid}.${Date.now()}.tmp`)

    fsApi.mkdirSync(stateDir, { recursive: true })
    fsApi.writeFileSync(tempFile, `${value}\n`, 'utf8')
    fsApi.renameSync(tempFile, stateFile)
  }

  function clearDefaultEncryptionKey () {
    if (!fsApi.existsSync(stateFile)) {
      return
    }

    fsApi.unlinkSync(stateFile)
  }

  return {
    readDefaultEncryptionKey,
    saveDefaultEncryptionKey,
    clearDefaultEncryptionKey
  }
}

module.exports = {
  createConfigStore,
  defaultConfigStateFile
}
