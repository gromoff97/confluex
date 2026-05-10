import type { Dirent } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'

import { joinGovernedRelativePath, removeTreeNoFollow } from './filesystem-safety'

export type RetainedLayoutPolicy = {
  expectedPageFolders: readonly string[]
  expectedAttachmentFilesByFolder: ReadonlyMap<string, readonly string[]>
  allowDebug: boolean
}

const REPORT_AND_MARKER_FILES = new Set([
  'manifest.tsv',
  'resolved-links.tsv',
  'unresolved-links.tsv',
  'failed-pages.tsv',
  'scope-findings.tsv',
  'summary.txt',
  'INCOMPLETE',
  'NON_AUTHORITATIVE'
])

const REUSABLE_PAYLOAD_FILES = new Set(['page.md', '_info.txt', '_storage.xml'])

export async function sanitizeRetainedLayout (outputRoot: string, policy: RetainedLayoutPolicy): Promise<void> {
  const absoluteRoot = path.resolve(outputRoot)
  const expectedFolders = new Set(policy.expectedPageFolders)
  const allowedTopLevel = new Set([...REPORT_AND_MARKER_FILES, 'pages'])
  if (policy.allowDebug) {
    allowedTopLevel.add('_debug')
  }

  for (const entry of await safeReadDir(absoluteRoot)) {
    if (!allowedTopLevel.has(entry.name)) {
      await removeTreeNoFollow(path.join(absoluteRoot, entry.name))
    }
  }

  await sanitizePagesTree(absoluteRoot, expectedFolders, policy.expectedAttachmentFilesByFolder)
  await sanitizeDebugTree(absoluteRoot, policy.allowDebug)
}

export async function assertReusablePayloadFolder (outputRoot: string, folder: string): Promise<void> {
  const folderPath = joinGovernedRelativePath(path.resolve(outputRoot), folder)
  const stat = await fs.lstat(folderPath)
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error('reusable payload folder must be a directory')
  }

  for (const entry of await fs.readdir(folderPath, { withFileTypes: true })) {
    if (entry.name === 'attachments') {
      if (!entry.isDirectory() || entry.isSymbolicLink()) {
        throw new Error('reusable payload folder has invalid attachments entry')
      }
      continue
    }
    if (!entry.isFile() || entry.isSymbolicLink() || !REUSABLE_PAYLOAD_FILES.has(entry.name)) {
      throw new Error('reusable payload folder contains unsupported entry')
    }
  }
}

async function sanitizePagesTree (
  outputRoot: string,
  expectedFolders: Set<string>,
  expectedAttachmentFilesByFolder: ReadonlyMap<string, readonly string[]>
): Promise<void> {
  const pagesPath = path.join(outputRoot, 'pages')
  if (!await pathExists(pagesPath)) {
    return
  }
  const pagesStat = await fs.lstat(pagesPath)
  if (!pagesStat.isDirectory() || pagesStat.isSymbolicLink()) {
    await removeTreeNoFollow(pagesPath)
    return
  }

  await sanitizeDirectoryChildren(pagesPath, childPath => shouldKeepPageTreePath(outputRoot, childPath, expectedFolders))
  for (const folder of expectedFolders) {
    const folderPath = joinGovernedRelativePath(outputRoot, folder)
    if (!await pathExists(folderPath)) {
      continue
    }
    await sanitizePageFolder(folderPath, expectedAttachmentFilesByFolder.get(folder) ?? [])
  }
}

async function sanitizePageFolder (folderPath: string, expectedAttachmentFiles: readonly string[]): Promise<void> {
  const allowed = new Set([...REUSABLE_PAYLOAD_FILES])
  if (expectedAttachmentFiles.length > 0) {
    allowed.add('attachments')
  }
  for (const entry of await safeReadDir(folderPath)) {
    const entryPath = path.join(folderPath, entry.name)
    if (!allowed.has(entry.name)) {
      await removeTreeNoFollow(entryPath)
      continue
    }
    if (entry.name !== 'attachments') {
      if (!entry.isFile() || entry.isSymbolicLink()) {
        await removeTreeNoFollow(entryPath)
      }
      continue
    }
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      await removeTreeNoFollow(entryPath)
      continue
    }
    await sanitizeAttachmentFolder(entryPath, expectedAttachmentFiles)
  }
}

async function sanitizeAttachmentFolder (folderPath: string, expectedAttachmentFiles: readonly string[]): Promise<void> {
  const expected = new Set(expectedAttachmentFiles)
  for (const entry of await safeReadDir(folderPath)) {
    const entryPath = path.join(folderPath, entry.name)
    if (!expected.has(entry.name) || !entry.isFile() || entry.isSymbolicLink()) {
      await removeTreeNoFollow(entryPath)
    }
  }
}

async function sanitizeDebugTree (outputRoot: string, allowDebug: boolean): Promise<void> {
  const debugPath = path.join(outputRoot, '_debug')
  if (!await pathExists(debugPath)) {
    return
  }
  if (!allowDebug) {
    await removeTreeNoFollow(debugPath)
    return
  }
  for (const entry of await safeReadDir(debugPath)) {
    if (entry.name.startsWith('.tmp-')) {
      await removeTreeNoFollow(path.join(debugPath, entry.name))
    }
  }
}

async function sanitizeDirectoryChildren (
  directory: string,
  keep: (absolutePath: string) => boolean
): Promise<void> {
  for (const entry of await safeReadDir(directory)) {
    const entryPath = path.join(directory, entry.name)
    if (!keep(entryPath)) {
      await removeTreeNoFollow(entryPath)
      continue
    }
    if (entry.isDirectory() && !entry.isSymbolicLink()) {
      await sanitizeDirectoryChildren(entryPath, keep)
    }
  }
}

function shouldKeepPageTreePath (outputRoot: string, absolutePath: string, expectedFolders: Set<string>): boolean {
  const relativePath = path.relative(outputRoot, absolutePath).split(path.sep).join('/')
  if (relativePath === 'pages') {
    return true
  }
  for (const folder of expectedFolders) {
    if (folder === relativePath || folder.startsWith(`${relativePath}/`) || relativePath.startsWith(`${folder}/`)) {
      return true
    }
  }
  return false
}

async function safeReadDir (directory: string): Promise<Dirent[]> {
  try {
    return await fs.readdir(directory, { withFileTypes: true })
  } catch (error) {
    if (isNodeErrorCode(error, 'ENOENT')) {
      return []
    }
    throw error
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
