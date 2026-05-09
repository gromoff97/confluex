import { constants as fsConstants } from 'node:fs'
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

export async function makePrivateDirectoryNoFollow (targetPath: string): Promise<void> {
  await ensureDirectoryNoFollow(path.resolve(targetPath))
  await fs.chmod(targetPath, 0o700).catch(() => undefined)
}

export async function assertRegularFileNoFollow (targetPath: string): Promise<void> {
  const stat = await fs.lstat(path.resolve(targetPath))
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error('path is not a regular file')
  }
}

export async function readFileNoFollow (targetPath: string): Promise<Buffer> {
  const absolutePath = path.resolve(targetPath)
  await assertRegularFileNoFollow(absolutePath)

  if (typeof fsConstants.O_NOFOLLOW !== 'number') {
    throw new Error('no-follow file reads are unavailable')
  }

  const handle = await fs.open(absolutePath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW)
  try {
    const stat = await handle.stat()
    if (!stat.isFile()) {
      throw new Error('path is not a regular file')
    }
    return await handle.readFile()
  } finally {
    await handle.close()
  }
}

export async function writeFileNoFollowAtomic (
  targetPath: string,
  bytes: Buffer | string,
  mode?: number
): Promise<void> {
  const absolutePath = path.resolve(targetPath)
  await makePrivateDirectoryNoFollow(path.dirname(absolutePath))
  await assertWritableFileTarget(absolutePath)
  const tempPath = path.join(path.dirname(absolutePath), `.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`)

  let handle: fs.FileHandle | null = null
  try {
    handle = await fs.open(tempPath, fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY, mode ?? 0o600)
    await handle.writeFile(bytes)
    await handle.sync()
    await handle.close()
    handle = null
    if (mode !== undefined) {
      await fs.chmod(tempPath, mode).catch(() => undefined)
    }
    await fs.rename(tempPath, absolutePath)
    if (mode !== undefined) {
      await fs.chmod(absolutePath, mode).catch(() => undefined)
    }
  } catch (error) {
    if (handle !== null) {
      await handle.close().catch(() => undefined)
    }
    await fs.rm(tempPath, { force: true }).catch(() => undefined)
    throw error
  }
}

export async function appendLineNoFollowAtomic (targetPath: string, line: string): Promise<void> {
  const absolutePath = path.resolve(targetPath)
  const previous = await readExistingRegularFileNoFollow(absolutePath)
  const next = Buffer.concat([
    previous,
    Buffer.from(line.endsWith('\n') ? line : `${line}\n`, 'utf8')
  ])
  await writeFileNoFollowAtomic(absolutePath, next, 0o600)
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

async function assertWritableFileTarget (absolutePath: string): Promise<void> {
  try {
    await assertRegularFileNoFollow(absolutePath)
  } catch (error) {
    if (isNodeErrorCode(error, 'ENOENT')) {
      return
    }
    throw error
  }
}

async function readExistingRegularFileNoFollow (absolutePath: string): Promise<Buffer> {
  try {
    await assertRegularFileNoFollow(absolutePath)
  } catch (error) {
    if (isNodeErrorCode(error, 'ENOENT')) {
      return Buffer.alloc(0)
    }
    throw error
  }

  return await readFileNoFollow(absolutePath)
}

function isNodeErrorCode (error: unknown, code: string): boolean {
  return error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === code
}
