import fs from 'node:fs/promises'
import path from 'node:path'

export async function assertNoSymlinkAncestors (absolutePath: string): Promise<void> {
  const resolved = path.resolve(absolutePath)
  const root = path.parse(resolved).root
  const segments = path.relative(root, resolved).split(path.sep).filter(segment => segment !== '')
  let current = root

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]
    if (segment === undefined) {
      throw new Error('invalid path segment')
    }
    current = path.join(current, segment)
    try {
      const stat = await fs.lstat(current)
      if (stat.isSymbolicLink()) {
        throw new Error('symlink path segment')
      }
      if (index < segments.length - 1 && !stat.isDirectory()) {
        throw new Error('non-directory ancestor')
      }
    } catch (error) {
      if (isNodeErrorCode(error, 'ENOENT')) {
        return
      }
      throw error
    }
  }
}

export async function ensureDirectoryNoFollow (absolutePath: string): Promise<void> {
  await assertNoSymlinkAncestors(absolutePath)
  try {
    const stat = await fs.lstat(absolutePath)
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new Error('output path is not a directory')
    }
    return
  } catch (error) {
    if (!isNodeErrorCode(error, 'ENOENT')) {
      throw error
    }
  }

  await fs.mkdir(absolutePath, { recursive: true })
  await assertNoSymlinkAncestors(absolutePath)
  const stat = await fs.lstat(absolutePath)
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error('created path is not a directory')
  }
}

export async function writeFileAtomic (targetPath: string, bytes: Buffer | string): Promise<void> {
  const absolutePath = path.resolve(targetPath)
  await ensureDirectoryNoFollow(path.dirname(absolutePath))
  const tempPath = path.join(path.dirname(absolutePath), `.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`)
  await fs.writeFile(tempPath, bytes)
  try {
    await fs.rename(tempPath, absolutePath)
  } catch (error) {
    await fs.rm(tempPath, { force: true }).catch(() => undefined)
    throw error
  }
}

export async function removeTreeNoFollow (absolutePath: string): Promise<void> {
  let stat
  try {
    stat = await fs.lstat(absolutePath)
  } catch (error) {
    if (isNodeErrorCode(error, 'ENOENT')) {
      return
    }
    throw error
  }

  if (stat.isDirectory() && !stat.isSymbolicLink()) {
    for (const entry of await fs.readdir(absolutePath)) {
      await removeTreeNoFollow(path.join(absolutePath, entry))
    }
    await fs.rmdir(absolutePath)
    return
  }

  if (stat.isFile() || stat.isSymbolicLink()) {
    await fs.unlink(absolutePath)
    return
  }

  throw new Error('unsupported filesystem object')
}

export function joinGovernedRelativePath (root: string, relativePath: string): string {
  const segments = relativePath.split('/')
  if (segments.length === 0 || segments.some(segment => segment === '' || segment === '.' || segment === '..' || segment.includes('\\') || segment.includes(path.sep))) {
    throw new Error('invalid governed relative path')
  }
  return path.join(root, ...segments)
}

function isNodeErrorCode (error: unknown, code: string): boolean {
  return error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === code
}
