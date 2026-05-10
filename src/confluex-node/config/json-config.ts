import fs from 'node:fs'
import { TextDecoder } from 'node:util'

import { classifyPathSource } from '../path/source'

export type ConfluexConfig = {
  confluenceBaseUrl?: string
  confluenceToken?: string
  insecure?: boolean
  outputRoot?: string
  maxPages?: number
  maxDownloadMib?: number
  sleepMs?: number
  maxFindCandidates?: number
  linkDepth?: number
}

export type LoadedJsonConfig =
  | { state: 'ok', path: string, config: ConfluexConfig }
  | { state: 'absent', path: string }
  | { state: 'invalid', path: string }

const decoder = new TextDecoder('utf-8', { fatal: true })
const configKeys = new Set([
  'confluenceBaseUrl',
  'confluenceToken',
  'insecure',
  'outputRoot',
  'maxPages',
  'maxDownloadMib',
  'sleepMs',
  'maxFindCandidates',
  'linkDepth'
])

export function decodeStrictUtf8JsonObject (bytes: Buffer): Record<string, unknown> | null {
  try {
    const text = decoder.decode(bytes)
    if (hasDuplicateTopLevelMember(text)) {
      return null
    }
    const parsed = JSON.parse(text) as unknown
    if (!isRecord(parsed)) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function parseConfluexConfigObject (value: Record<string, unknown>): ConfluexConfig | null {
  const config: ConfluexConfig = {}
  for (const [key, rawValue] of Object.entries(value)) {
    if (!configKeys.has(key)) {
      return null
    }

    if (key === 'confluenceBaseUrl') {
      if (typeof rawValue !== 'string') return null
      config.confluenceBaseUrl = rawValue
    } else if (key === 'confluenceToken') {
      if (typeof rawValue !== 'string') return null
      config.confluenceToken = rawValue
    } else if (key === 'insecure') {
      if (typeof rawValue !== 'boolean') return null
      config.insecure = rawValue
    } else if (key === 'outputRoot') {
      if (typeof rawValue !== 'string') return null
      config.outputRoot = rawValue
    } else if (key === 'maxPages') {
      if (!isPositiveSafeInteger(rawValue)) return null
      config.maxPages = rawValue
    } else if (key === 'maxDownloadMib') {
      if (!isPositiveSafeInteger(rawValue)) return null
      config.maxDownloadMib = rawValue
    } else if (key === 'sleepMs') {
      if (!isNonNegativeSafeInteger(rawValue)) return null
      config.sleepMs = rawValue
    } else if (key === 'maxFindCandidates') {
      if (!isPositiveSafeInteger(rawValue)) return null
      config.maxFindCandidates = rawValue
    } else if (key === 'linkDepth') {
      if (!isNonNegativeSafeInteger(rawValue)) return null
      config.linkDepth = rawValue
    }
  }
  return config
}

export function loadExplicitJsonConfig (cwd: string, sourcePath: string): LoadedJsonConfig {
  const pathSource = classifyPathSource(sourcePath, cwd)
  if (pathSource.state !== 'ok') {
    return { state: 'invalid', path: sourcePath }
  }
  const configPath = pathSource.absolutePath
  try {
    const metadata = fs.lstatSync(configPath)
    if (!metadata.isFile()) {
      return { state: 'invalid', path: configPath }
    }
    const decoded = decodeStrictUtf8JsonObject(fs.readFileSync(configPath))
    if (decoded === null) {
      return { state: 'invalid', path: configPath }
    }
    const config = parseConfluexConfigObject(decoded)
    if (config === null) {
      return { state: 'invalid', path: configPath }
    }
    return { state: 'ok', path: configPath, config }
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return { state: 'absent', path: configPath }
    }
    return { state: 'invalid', path: configPath }
  }
}

function isPositiveSafeInteger (value: unknown): value is number {
  return isNonNegativeSafeInteger(value) && value > 0
}

function isNonNegativeSafeInteger (value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0)
}

function hasDuplicateTopLevelMember (text: string): boolean {
  let index = skipWhitespace(text, 0)
  if (text[index] !== '{') {
    return false
  }
  index += 1
  const keys = new Set<string>()

  while (index < text.length) {
    index = skipWhitespace(text, index)
    if (text[index] === '}') {
      return false
    }
    const key = parseJsonStringToken(text, index)
    if (key === null) {
      return false
    }
    if (keys.has(key.value)) {
      return true
    }
    keys.add(key.value)
    index = skipWhitespace(text, key.next)
    if (text[index] !== ':') {
      return false
    }
    index = skipJsonValue(text, index + 1)
    index = skipWhitespace(text, index)
    if (text[index] === ',') {
      index += 1
      continue
    }
    return false
  }

  return false
}

function parseJsonStringToken (text: string, start: number): { value: string, next: number } | null {
  if (text[start] !== '"') {
    return null
  }
  let index = start + 1
  let escaped = false
  while (index < text.length) {
    const character = text[index]
    if (escaped) {
      escaped = false
      index += 1
      continue
    }
    if (character === '\\') {
      escaped = true
      index += 1
      continue
    }
    if (character === '"') {
      try {
        return {
          value: JSON.parse(text.slice(start, index + 1)) as string,
          next: index + 1
        }
      } catch {
        return null
      }
    }
    index += 1
  }
  return null
}

function skipJsonValue (text: string, start: number): number {
  let index = skipWhitespace(text, start)
  let depth = 0
  let inString = false
  let escaped = false
  while (index < text.length) {
    const character = text[index]
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (character === '\\') {
        escaped = true
      } else if (character === '"') {
        inString = false
      }
      index += 1
      continue
    }
    if (character === '"') {
      inString = true
      index += 1
      continue
    }
    if (character === '{' || character === '[') {
      depth += 1
      index += 1
      continue
    }
    if (character === '}' || character === ']') {
      if (depth === 0) {
        return index
      }
      depth -= 1
      index += 1
      continue
    }
    if (character === ',' && depth === 0) {
      return index
    }
    index += 1
  }
  return index
}

function skipWhitespace (text: string, start: number): number {
  let index = start
  while (text[index] === ' ' || text[index] === '\t' || text[index] === '\n' || text[index] === '\r') {
    index += 1
  }
  return index
}

function isRecord (value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isNodeError (error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}
