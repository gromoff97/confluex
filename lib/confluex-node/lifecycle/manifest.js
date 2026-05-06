'use strict'

const path = require('node:path')
const { TextDecoder } = require('node:util')

const utf8Decoder = new TextDecoder('utf-8', { fatal: true })

function parseInstallManifest (buffer, target) {
  let text
  try {
    text = utf8Decoder.decode(buffer)
  } catch {
    return { valid: false }
  }

  if (text === '' || !text.endsWith('\n')) {
    return { valid: false }
  }

  const body = text.slice(0, -1)
  if (body === '' || body.includes('\n\n') || body.includes('\t') || body.includes('\r') || body.includes('\u0000')) {
    return { valid: false }
  }

  const relativePaths = body.split('\n')
  const seen = new Set()
  const targetRoot = path.resolve(target)

  for (let index = 0; index < relativePaths.length; index += 1) {
    const relativePath = relativePaths[index]
    if (!isGovernedRelativePath(relativePath) || seen.has(relativePath) || !isInsideTarget(targetRoot, relativePath)) {
      return { valid: false }
    }

    if (index > 0 && bytewiseCompare(relativePaths[index - 1], relativePath) >= 0) {
      return { valid: false }
    }

    seen.add(relativePath)
  }

  return {
    valid: true,
    relativePaths
  }
}

function isGovernedRelativePath (value) {
  if (typeof value !== 'string' || value === '') {
    return false
  }

  if (
    value.startsWith('/') ||
    value.endsWith('/') ||
    value.includes('\\') ||
    value.includes(':') ||
    value.includes('\u0000') ||
    value.includes('\t') ||
    value.includes('\n') ||
    value.includes('\r')
  ) {
    return false
  }

  const segments = value.split('/')
  return segments.every(segment => segment !== '' && segment !== '.' && segment !== '..')
}

function isInsideTarget (targetRoot, relativePath) {
  const candidate = path.resolve(targetRoot, ...relativePath.split('/'))
  const relative = path.relative(targetRoot, candidate)
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
}

function bytewiseCompare (left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'))
}

module.exports = {
  parseInstallManifest,
  isGovernedRelativePath,
  bytewiseCompare
}
