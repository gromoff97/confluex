import fs from 'node:fs/promises'
import path from 'node:path'

import { ensureDirectoryNoFollow, makePrivateDirectoryNoFollow, writeFileNoFollowAtomic } from './filesystem-safety'

export type ReportCommitHooks = {
  afterBackup?: (name: string) => Promise<void>
}

export async function commitReportSet (
  outputRoot: string,
  reportTexts: Record<string, string>,
  reportFileOrder: readonly string[],
  hooks: ReportCommitHooks = {}
): Promise<void> {
  const absoluteRoot = path.resolve(outputRoot)
  await ensureDirectoryNoFollow(absoluteRoot)
  await assertReportTargetsAreReplaceable(absoluteRoot, reportFileOrder)

  const stagingDir = path.join(
    path.dirname(absoluteRoot),
    `.confluex-report-${path.basename(absoluteRoot)}-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  )
  const backupDir = path.join(
    path.dirname(absoluteRoot),
    `.confluex-report-backup-${path.basename(absoluteRoot)}-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  )

  try {
    await makePrivateDirectoryNoFollow(stagingDir)
    await makePrivateDirectoryNoFollow(backupDir)
    for (const name of reportFileOrder) {
      const text = reportTexts[name]
      if (text === undefined) {
        throw new Error('report text missing')
      }
      await writeFileNoFollowAtomic(path.join(stagingDir, name), text, 0o600)
    }
    for (const name of reportFileOrder) {
      const target = path.join(absoluteRoot, name)
      const backup = path.join(backupDir, name)
      if (await pathExists(target)) {
        await fs.rename(target, backup)
      }
      await hooks.afterBackup?.(name)
      await fs.rename(path.join(stagingDir, name), target)
    }
  } catch (error) {
    await restoreReportBackups(absoluteRoot, backupDir, reportFileOrder)
    throw error
  } finally {
    await fs.rm(stagingDir, { recursive: true, force: true }).catch(() => undefined)
    await fs.rm(backupDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

async function assertReportTargetsAreReplaceable (outputRoot: string, reportFileOrder: readonly string[]): Promise<void> {
  for (const name of reportFileOrder) {
    const target = path.join(outputRoot, name)
    try {
      const stat = await fs.lstat(target)
      if (stat.isSymbolicLink() || !stat.isFile()) {
        throw new Error('report target is not a regular file')
      }
    } catch (error) {
      if (isNodeErrorCode(error, 'ENOENT')) {
        continue
      }
      throw error
    }
  }
}

async function restoreReportBackups (outputRoot: string, backupDir: string, reportFileOrder: readonly string[]): Promise<void> {
  for (const name of reportFileOrder) {
    const target = path.join(outputRoot, name)
    const backup = path.join(backupDir, name)
    if (await pathExists(backup)) {
      await fs.rm(target, { recursive: true, force: true }).catch(() => undefined)
      await fs.rename(backup, target).catch(() => undefined)
    }
  }
}

async function pathExists (targetPath: string): Promise<boolean> {
  try {
    await fs.lstat(targetPath)
    return true
  } catch (error) {
    if (isNodeErrorCode(error, 'ENOENT')) {
      return false
    }
    throw error
  }
}

function isNodeErrorCode (error: unknown, code: string): boolean {
  return error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === code
}
