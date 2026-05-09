import fs from 'node:fs'
import path from 'node:path'
import { TextDecoder } from 'node:util'

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
    const parsed = JSON.parse(decoder.decode(bytes)) as unknown
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
  const configPath = path.resolve(cwd, sourcePath)
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

function isRecord (value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isNodeError (error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}
