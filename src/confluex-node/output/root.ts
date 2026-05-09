import fs from 'node:fs'
import path from 'node:path'

import type { EffectiveOptions } from '../cli/validate'
import { classifyPathSource } from '../path/source'

export type OutputRootSelection =
  | { state: 'ok', outputRoot: string }
  | { state: 'rejected', requirementId: string }

export type ExecutionMode = 'materialized' | 'plan_only'

type OutputRootDependencies = {
  cwd?: string
  now?: Date
}

type LstatState =
  | { exists: true, stat: fs.Stats }
  | { exists: false }
  | { error: unknown }

export function selectOutputRoot (
  executionMode: ExecutionMode,
  pageId: string,
  options: EffectiveOptions,
  dependencies: OutputRootDependencies = {}
): OutputRootSelection {
  const cwd = dependencies.cwd ?? process.cwd()

  if (Object.prototype.hasOwnProperty.call(options.values, '--out')) {
    const source = options.values['--out']
    if (source === undefined) {
      return rejected('FR-0076')
    }
    return selectExplicitOutputRoot(executionMode, source, options, cwd)
  }

  return selectGeneratedOutputRoot(executionMode, pageId, cwd, dependencies.now ?? new Date())
}

function selectExplicitOutputRoot (
  executionMode: ExecutionMode,
  source: string,
  options: EffectiveOptions,
  cwd: string
): OutputRootSelection {
  const pathSource = classifyPathSource(source, cwd)
  if (pathSource.state !== 'ok') {
    return rejected('FR-0076')
  }

  const outputRoot = pathSource.absolutePath
  const state = checkedLstatState(outputRoot)
  const isResume = executionMode === 'materialized' && options.flags.includes('--resume')

  if ('error' in state) {
    return rejected('FR-0076')
  }

  if (isResume) {
    if (!state.exists) {
      return rejected('FR-0103')
    }
    if (!state.stat.isDirectory()) {
      return rejected('FR-0076')
    }
    return {
      state: 'ok',
      outputRoot
    }
  }

  if (state.exists) {
    return rejected('FR-0016')
  }

  return {
    state: 'ok',
    outputRoot
  }
}

function selectGeneratedOutputRoot (
  executionMode: ExecutionMode,
  pageId: string,
  cwd: string,
  now: Date
): OutputRootSelection {
  const normalizedCwd = path.resolve(cwd)
  const prefix = executionMode === 'materialized' ? 'confluence_dump' : 'confluence_plan'
  const baseName = `${prefix}_${pageId}_${formatUtcTimestamp(now)}`

  for (let suffix = 0; suffix < Number.MAX_SAFE_INTEGER; suffix += 1) {
    const candidateName = suffix === 0 ? baseName : `${baseName}_${suffix}`
    const candidate = path.join(normalizedCwd, candidateName)
    const state = checkedLstatState(candidate)
    if ('error' in state) {
      return rejected('FR-0055')
    }
    if (!state.exists) {
      return {
        state: 'ok',
        outputRoot: candidate
      }
    }
  }

  return rejected('FR-0055')
}

function formatUtcTimestamp (date: Date): string {
  return [
    date.getUTCFullYear().toString().padStart(4, '0'),
    (date.getUTCMonth() + 1).toString().padStart(2, '0'),
    date.getUTCDate().toString().padStart(2, '0'),
    'T',
    date.getUTCHours().toString().padStart(2, '0'),
    date.getUTCMinutes().toString().padStart(2, '0'),
    date.getUTCSeconds().toString().padStart(2, '0'),
    'Z'
  ].join('')
}

function lstatState (absolutePath: string): LstatState {
  try {
    return {
      exists: true,
      stat: fs.lstatSync(absolutePath)
    }
  } catch (error) {
    if (isNodeErrorCode(error, 'ENOENT')) {
      return { exists: false }
    }
    return { error }
  }
}

function checkedLstatState (absolutePath: string): LstatState {
  const ancestorCheck = checkExistingSegments(absolutePath)
  if ('error' in ancestorCheck) {
    return ancestorCheck
  }
  return lstatState(absolutePath)
}

function checkExistingSegments (absolutePath: string): { ok: true } | { error: unknown } {
  const resolved = path.resolve(absolutePath)
  const root = path.parse(resolved).root
  const segments = path.relative(root, resolved).split(path.sep).filter(segment => segment !== '')
  let current = root

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]
    if (segment === undefined) {
      return { error: new Error('invalid path segment') }
    }
    current = path.join(current, segment)
    try {
      const stat = fs.lstatSync(current)
      if (stat.isSymbolicLink()) {
        return { error: new Error('symlink path segment') }
      }
      if (index < segments.length - 1 && !stat.isDirectory()) {
        return { error: new Error('non-directory ancestor') }
      }
    } catch (error) {
      if (isNodeErrorCode(error, 'ENOENT')) {
        return { ok: true }
      }
      return { error }
    }
  }

  return { ok: true }
}

function rejected (requirementId: string): OutputRootSelection {
  return {
    state: 'rejected',
    requirementId
  }
}

function isNodeErrorCode (error: unknown, code: string): boolean {
  return error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === code
}
