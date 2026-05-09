import { spawnSync, type SpawnSyncReturns } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { TextDecoder } from 'node:util'

export type NodeVersionCheck =
  | { state: 'passed', required: string, actual: string }
  | { state: 'failed', required: string, actual: string }

export type DependencyState = {
  label: string
  state: string
}

const MIN_NODE_VERSION: [number, number, number] = [20, 11, 0]
const MIN_NODE_VERSION_TEXT = '>=20.11.0'
const CHILD_ENV_ALLOWLIST = ['PATH', 'Path', 'PATHEXT', 'HOME', 'USERPROFILE', 'TMPDIR', 'TEMP', 'TMP', 'SystemRoot', 'WINDIR'] as const

export function checkNodeVersion (version: string = process.versions.node): NodeVersionCheck {
  const parsed = parseNodeVersion(version)
  if (parsed === null || compareVersionParts(parsed, MIN_NODE_VERSION) < 0) {
    return {
      state: 'failed',
      required: MIN_NODE_VERSION_TEXT,
      actual: version
    }
  }

  return {
    state: 'passed',
    required: MIN_NODE_VERSION_TEXT,
    actual: version
  }
}

export function nodeRuntimeDependency (version: string = process.version): DependencyState {
  const normalized = version.startsWith('v') ? version.slice(1) : version
  const check = checkNodeVersion(normalized)
  return {
    label: 'node_runtime',
    state: check.state === 'passed' ? `present:${version}` : `unsupported:${version}`
  }
}

export function executableDependencyProbe (
  label: string,
  executable: string,
  env: NodeJS.ProcessEnv = process.env
): DependencyState {
  const childEnv = allowedChildProcessEnv(env)
  const resolved = resolveExecutable(executable, childEnv)
  if (resolved === null) {
    return {
      label,
      state: 'absent'
    }
  }

  const result = spawnSync(resolved, ['--version'], {
    encoding: 'buffer',
    env: childEnv
  })

  const version = parseVersionProbe(result)
  return {
    label,
    state: version === null ? 'present:unknown_version' : `present:${version}`
  }
}

export function allowedChildProcessEnv (parent: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {}
  for (const key of CHILD_ENV_ALLOWLIST) {
    const value = parent[key]
    if (value !== undefined) {
      env[key] = value
    }
  }
  return env
}

export function runtimePrerequisiteFailure (name: string, details?: string): string {
  const suffix = details === undefined || details === '' ? '' : ` ${details}`
  return `ERROR: runtime_prerequisite_failed ${name}${suffix}\n`
}

function parseNodeVersion (version: string): [number, number, number] | null {
  const match = /^v?([0-9]+)\.([0-9]+)\.([0-9]+)/.exec(version)
  if (match === null) {
    return null
  }
  const major = Number(match[1])
  const minor = Number(match[2])
  const patch = Number(match[3])
  return [major, minor, patch]
}

function compareVersionParts (
  left: [number, number, number],
  right: [number, number, number]
): number {
  for (let index = 0; index < 3; index += 1) {
    const leftPart = left[index]
    const rightPart = right[index]
    if (leftPart === undefined || rightPart === undefined) {
      throw new Error('invalid version tuple')
    }
    if (leftPart < rightPart) return -1
    if (leftPart > rightPart) return 1
  }
  return 0
}

function resolveExecutable (executable: string, env: NodeJS.ProcessEnv = process.env): string | null {
  const pathValue = env.PATH ?? env.Path ?? ''
  const executableNames = executableCandidates(executable, env)
  for (const directory of pathValue.split(path.delimiter)) {
    if (directory === '') {
      continue
    }

    for (const executableName of executableNames) {
      const candidate = path.join(directory, executableName)
      try {
        fs.accessSync(candidate, fs.constants.X_OK)
        return candidate
      } catch {
        // Continue searching PATH entries.
      }
    }
  }

  return null
}

function executableCandidates (executable: string, env: NodeJS.ProcessEnv, platform: NodeJS.Platform = process.platform): string[] {
  if (platform !== 'win32' || path.extname(executable) !== '') {
    return [executable]
  }

  const pathExt = env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD'
  const extensions = pathExt
    .split(';')
    .map(extension => extension.trim())
    .filter(extension => extension !== '')
  return [
    executable,
    ...extensions.map(extension => `${executable}${extension.toLowerCase()}`),
    ...extensions.map(extension => `${executable}${extension.toUpperCase()}`)
  ]
}

function parseVersionProbe (result: SpawnSyncReturns<Buffer>): string | null {
  if (result.status !== 0 || !Buffer.isBuffer(result.stdout)) {
    return null
  }

  const decoder = new TextDecoder('utf8', { fatal: false })
  for (const line of decoder.decode(result.stdout).split('\n')) {
    const trimmed = trimAsciiWhitespace(line)
    if (trimmed === '') {
      continue
    }

    if (trimmed === 'unknown_version' || hasAsciiControl(trimmed)) {
      return null
    }

    return trimmed
  }

  return null
}

function trimAsciiWhitespace (value: string): string {
  return value.replace(/^[ \t\n\r]+|[ \t\n\r]+$/g, '')
}

function hasAsciiControl (value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code <= 0x1f || code === 0x7f) {
      return true
    }
  }

  return false
}
