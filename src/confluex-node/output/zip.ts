import fs from 'node:fs/promises'
import path from 'node:path'

export type ZipResult = {
  state: 'ok'
  zipPath: string
}

type ZipEntry = {
  name: string
  content: Buffer
}

const DOS_TIME_ZERO = 0
const DOS_DATE_1980_01_01 = 33
const CRC32_TABLE = makeCrc32Table()

export function zipPathForOutputRoot (outputRoot: string): string {
  return `${outputRoot}.zip`
}

export async function assertZipPathAvailable (zipPath: string): Promise<void> {
  try {
    await fs.lstat(zipPath)
  } catch (error) {
    if (isNodeErrorCode(error, 'ENOENT')) {
      return
    }
    throw error
  }
  throw new Error('zip path already exists')
}

export async function createZipFromRoot (
  outputRoot: string,
  zipPath: string = zipPathForOutputRoot(outputRoot)
): Promise<ZipResult> {
  const rootStat = await fs.lstat(outputRoot)
  if (!rootStat.isDirectory()) {
    throw new Error('zip output root must be a directory')
  }

  const entries = await collectFileEntries(outputRoot, '')
  const archiveBytes = archiveBuffer(entries)
  let handle: fs.FileHandle | undefined
  try {
    handle = await fs.open(zipPath, 'wx')
    await handle.writeFile(archiveBytes)
  } catch (error) {
    if (handle !== undefined) {
      await handle.close().catch(() => undefined)
      await fs.rm(zipPath, { force: true }).catch(() => undefined)
    }
    throw error
  }
  await handle.close()

  return {
    state: 'ok',
    zipPath
  }
}

async function collectFileEntries (root: string, relativeDirectory: string): Promise<ZipEntry[]> {
  const absoluteDirectory = path.join(root, relativeDirectory)
  const dirents = await fs.readdir(absoluteDirectory, { withFileTypes: true })
  const entries: ZipEntry[] = []

  for (const dirent of dirents) {
    const relativePath = relativeDirectory === '' ? dirent.name : `${relativeDirectory}/${dirent.name}`
    validateZipRelativePath(relativePath)
    const absolutePath = path.join(root, relativePath)
    const stat = await fs.lstat(absolutePath)
    if (stat.isDirectory()) {
      entries.push(...await collectFileEntries(root, relativePath))
    } else if (stat.isFile()) {
      entries.push({
        name: relativePath,
        content: await fs.readFile(absolutePath)
      })
    } else {
      throw new Error('zip output root contains unsupported entry')
    }
  }

  return entries.sort((left, right) => Buffer.compare(Buffer.from(left.name, 'utf8'), Buffer.from(right.name, 'utf8')))
}

function validateZipRelativePath (relativePath: string): void {
  if (
    relativePath.startsWith('/') ||
    relativePath.includes('\\') ||
    relativePath.split('/').some(segment => segment === '' || segment === '.' || segment === '..')
  ) {
    throw new Error('zip entry path must be relative')
  }
}

function archiveBuffer (entries: ZipEntry[]): Buffer {
  const localParts: Buffer[] = []
  const centralParts: Buffer[] = []
  let offset = 0

  for (const entry of entries) {
    const nameBytes = Buffer.from(entry.name, 'utf8')
    const content = Buffer.from(entry.content)
    const crc = crc32(content)
    const localHeader = localFileHeader(nameBytes, content.length, crc)
    localParts.push(localHeader, content)
    centralParts.push(centralDirectoryHeader(nameBytes, content.length, crc, offset))
    offset += localHeader.length + content.length
  }

  const centralDirectory = Buffer.concat(centralParts)
  const end = endOfCentralDirectory(entries.length, centralDirectory.length, offset)
  return Buffer.concat([...localParts, centralDirectory, end])
}

function localFileHeader (nameBytes: Buffer, size: number, crc: number): Buffer {
  const header = Buffer.alloc(30 + nameBytes.length)
  header.writeUInt32LE(0x04034b50, 0)
  header.writeUInt16LE(20, 4)
  header.writeUInt16LE(0, 6)
  header.writeUInt16LE(0, 8)
  header.writeUInt16LE(DOS_TIME_ZERO, 10)
  header.writeUInt16LE(DOS_DATE_1980_01_01, 12)
  header.writeUInt32LE(crc, 14)
  header.writeUInt32LE(size, 18)
  header.writeUInt32LE(size, 22)
  header.writeUInt16LE(nameBytes.length, 26)
  header.writeUInt16LE(0, 28)
  nameBytes.copy(header, 30)
  return header
}

function centralDirectoryHeader (nameBytes: Buffer, size: number, crc: number, localHeaderOffset: number): Buffer {
  const header = Buffer.alloc(46 + nameBytes.length)
  header.writeUInt32LE(0x02014b50, 0)
  header.writeUInt16LE(20, 4)
  header.writeUInt16LE(20, 6)
  header.writeUInt16LE(0, 8)
  header.writeUInt16LE(0, 10)
  header.writeUInt16LE(DOS_TIME_ZERO, 12)
  header.writeUInt16LE(DOS_DATE_1980_01_01, 14)
  header.writeUInt32LE(crc, 16)
  header.writeUInt32LE(size, 20)
  header.writeUInt32LE(size, 24)
  header.writeUInt16LE(nameBytes.length, 28)
  header.writeUInt16LE(0, 30)
  header.writeUInt16LE(0, 32)
  header.writeUInt16LE(0, 34)
  header.writeUInt16LE(0, 36)
  header.writeUInt32LE(0, 38)
  header.writeUInt32LE(localHeaderOffset, 42)
  nameBytes.copy(header, 46)
  return header
}

function endOfCentralDirectory (entryCount: number, centralDirectorySize: number, centralDirectoryOffset: number): Buffer {
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(entryCount, 8)
  end.writeUInt16LE(entryCount, 10)
  end.writeUInt32LE(centralDirectorySize, 12)
  end.writeUInt32LE(centralDirectoryOffset, 16)
  end.writeUInt16LE(0, 20)
  return end
}

function makeCrc32Table (): number[] {
  const table: number[] = []
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table.push(value >>> 0)
  }
  return table
}

function crc32 (bytes: Buffer): number {
  let value = 0xffffffff
  for (const byte of bytes) {
    const tableValue = CRC32_TABLE[(value ^ byte) & 0xff]
    if (tableValue === undefined) {
      throw new Error('invalid crc32 table state')
    }
    value = tableValue ^ (value >>> 8)
  }
  return (value ^ 0xffffffff) >>> 0
}

function isNodeErrorCode (error: unknown, code: string): boolean {
  return error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === code
}
