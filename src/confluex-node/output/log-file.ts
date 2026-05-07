import fs from 'node:fs'
import path from 'node:path'

import type { EffectiveOptions } from '../cli/validate'

export type PreparedLog =
  | { state: 'absent' }
  | { state: 'ready', path: string }
  | { state: 'rejected', requirementId: 'FR-0134' }

export type LogWriteResult =
  | { state: 'ok' }
  | { state: 'failed' }

type LogDependencies = {
  cwd?: string
  outputRoot?: string
}

type PathState =
  | { stat: fs.Stats }
  | 'missing'
  | 'unusable'

export function preparePersistentLog (
  options: EffectiveOptions,
  dependencies: LogDependencies = {}
): PreparedLog {
  if (!Object.prototype.hasOwnProperty.call(options.values, '--log-file')) {
    return { state: 'absent' }
  }

  const cwd = dependencies.cwd ?? process.cwd()
  const logSource = options.values['--log-file']
  if (logSource === undefined) {
    return rejected()
  }
  const logPath = path.resolve(cwd, logSource)
  const outputRoot = dependencies.outputRoot === undefined
    ? null
    : path.resolve(cwd, dependencies.outputRoot)

  if (outputRoot !== null && conflictsWithOutputRoot(logPath, outputRoot)) {
    return rejected()
  }

  if (!existingPathIsUsable(logPath)) {
    return rejected()
  }

  return {
    state: 'ready',
    path: logPath
  }
}

export function writePersistentLog (prepared: PreparedLog, text: string): LogWriteResult {
  if (prepared.state === 'absent') {
    return { state: 'ok' }
  }

  if (prepared.state !== 'ready') {
    return { state: 'failed' }
  }

  try {
    fs.mkdirSync(path.dirname(prepared.path), { recursive: true })
    fs.writeFileSync(prepared.path, normalizeLogText(text), 'utf8')
    return { state: 'ok' }
  } catch {
    return { state: 'failed' }
  }
}

function existingPathIsUsable (logPath: string): boolean {
  const parent = path.dirname(logPath)
  const parsed = path.parse(parent)
  const relativeParent = path.relative(parsed.root, parent)
  const segments = relativeParent === '' ? [] : relativeParent.split(path.sep)
  let current = parsed.root

  for (const segment of segments) {
    current = path.join(current, segment)
    const state = lstatPath(current)
    if (state === 'missing') {
      return true
    }
    if (state === 'unusable' || !state.stat.isDirectory() || state.stat.isSymbolicLink()) {
      return false
    }
  }

  const finalState = lstatPath(logPath)
  if (finalState === 'missing') {
    return true
  }
  return finalState !== 'unusable' && finalState.stat.isFile() && !finalState.stat.isSymbolicLink()
}

function lstatPath (target: string): PathState {
  try {
    return { stat: fs.lstatSync(target) }
  } catch (error) {
    return isNodeErrorCode(error, 'ENOENT') ? 'missing' : 'unusable'
  }
}

function conflictsWithOutputRoot (logPath: string, outputRoot: string): boolean {
  const reservedSiblings = [
    `${outputRoot}.zip`
  ]
  return samePath(logPath, outputRoot) ||
    isDescendant(outputRoot, logPath) ||
    reservedSiblings.some(reservedPath => samePath(logPath, reservedPath))
}

function samePath (left: string, right: string): boolean {
  return path.relative(left, right) === ''
}

function isDescendant (parent: string, child: string): boolean {
  const relative = path.relative(parent, child)
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
}

function normalizeLogText (text: string): string {
  return text.replace(/\0/g, '').replace(/\r\n?/g, '\n')
}

function rejected (): PreparedLog {
  return {
    state: 'rejected',
    requirementId: 'FR-0134'
  }
}

function isNodeErrorCode (error: unknown, code: string): boolean {
  return error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === code
}
