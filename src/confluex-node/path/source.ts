import path from 'node:path'

export type PathPlatform = 'posix' | 'win32'

export type PathSourceRejectionReason =
  | 'empty'
  | 'invalid_code_point'
  | 'unsupported_platform'
  | 'cwd_not_absolute'
  | 'windows_root_relative'
  | 'windows_drive_relative'
  | 'windows_device_path'
  | 'windows_invalid_unc'
  | 'windows_invalid_segment'

export type PathSourceResult =
  | {
      state: 'ok'
      platform: PathPlatform
      absolutePath: string
      inputWasAbsolute: boolean
    }
  | {
      state: 'invalid'
      reason: PathSourceRejectionReason
    }

type WindowsParsedPath =
  | {
      kind: 'drive_absolute'
      root: string
      segments: string[]
    }
  | {
      kind: 'unc'
      root: string
      segments: string[]
    }
  | {
      kind: 'relative'
      segments: string[]
    }
  | {
      kind: 'invalid'
      reason: PathSourceRejectionReason
    }

const POSIX_PLATFORMS = new Set<NodeJS.Platform>([
  'darwin',
  'freebsd',
  'linux',
  'netbsd',
  'openbsd'
])

const WINDOWS_RESERVED_BASENAMES = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9'
])

export function classifyPathSource (
  source: string,
  cwd: string,
  platform: NodeJS.Platform = process.platform
): PathSourceResult {
  const sourceCheck = checkPathSource(source)
  if (sourceCheck !== null) {
    return invalid(sourceCheck)
  }

  const pathPlatform = platformKind(platform)
  if (pathPlatform === null) {
    return invalid('unsupported_platform')
  }

  if (pathPlatform === 'posix') {
    return normalizePosixPathSource(source, cwd)
  }

  return normalizeWindowsPathSource(source, cwd)
}

function normalizePosixPathSource (source: string, cwd: string): PathSourceResult {
  const cwdCheck = checkPathSource(cwd)
  if (cwdCheck !== null || !path.posix.isAbsolute(cwd)) {
    return invalid('cwd_not_absolute')
  }

  const inputWasAbsolute = path.posix.isAbsolute(source)
  const absolutePath = path.posix.normalize(inputWasAbsolute ? source : path.posix.join(cwd, source))
  return {
    state: 'ok',
    platform: 'posix',
    absolutePath,
    inputWasAbsolute
  }
}

function normalizeWindowsPathSource (source: string, cwd: string): PathSourceResult {
  const parsed = parseWindowsPath(source)
  if (parsed.kind === 'invalid') {
    return invalid(parsed.reason)
  }

  if (parsed.kind !== 'relative') {
    return {
      state: 'ok',
      platform: 'win32',
      absolutePath: serializeWindowsPath(parsed.root, parsed.segments),
      inputWasAbsolute: true
    }
  }

  const cwdCheck = checkPathSource(cwd)
  if (cwdCheck !== null) {
    return invalid('cwd_not_absolute')
  }
  const parsedCwd = parseWindowsPath(cwd)
  if (parsedCwd.kind === 'invalid' || parsedCwd.kind === 'relative') {
    return invalid('cwd_not_absolute')
  }

  return {
    state: 'ok',
    platform: 'win32',
    absolutePath: serializeWindowsPath(parsedCwd.root, [...parsedCwd.segments, ...parsed.segments]),
    inputWasAbsolute: false
  }
}

function parseWindowsPath (source: string): WindowsParsedPath {
  if (hasWindowsDevicePrefix(source)) {
    return windowsInvalid('windows_device_path')
  }

  if (/^[A-Za-z]:(?:$|[^\\/])/.test(source)) {
    return windowsInvalid('windows_drive_relative')
  }

  const driveMatch = /^([A-Za-z]):[\\/]+(.*)$/.exec(source)
  if (driveMatch !== null) {
    const driveLetter = driveMatch[1]
    const rest = driveMatch[2]
    if (driveLetter === undefined || rest === undefined) {
      return windowsInvalid('windows_invalid_segment')
    }
    const segments = parseWindowsSegments(rest)
    if (segments === null) {
      return windowsInvalid('windows_invalid_segment')
    }
    return {
      kind: 'drive_absolute',
      root: `${driveLetter.toUpperCase()}:\\`,
      segments: normalizeWindowsSegments(segments)
    }
  }

  if (startsWithWindowsSeparator(source)) {
    const leadingSeparators = countLeadingWindowsSeparators(source)
    if (leadingSeparators === 1) {
      return windowsInvalid('windows_root_relative')
    }
    if (leadingSeparators !== 2) {
      return windowsInvalid('windows_invalid_unc')
    }
    return parseWindowsUncPath(source)
  }

  const segments = parseWindowsSegments(source)
  if (segments === null) {
    return windowsInvalid('windows_invalid_segment')
  }
  return {
    kind: 'relative',
    segments: normalizeWindowsSegments(segments)
  }
}

function parseWindowsUncPath (source: string): WindowsParsedPath {
  const withoutPrefix = source.slice(2)
  const serverEnd = findNextWindowsSeparator(withoutPrefix, 0)
  if (serverEnd <= 0) {
    return windowsInvalid('windows_invalid_unc')
  }

  const server = withoutPrefix.slice(0, serverEnd)
  const afterServer = withoutPrefix.slice(serverEnd + 1)
  const shareEnd = findNextWindowsSeparator(afterServer, 0)
  const share = shareEnd === -1 ? afterServer : afterServer.slice(0, shareEnd)
  const rest = shareEnd === -1 ? '' : afterServer.slice(shareEnd + 1)

  if (
    server === '?' ||
    server === '.' ||
    !isValidWindowsSegmentText(server, false) ||
    !isValidWindowsSegmentText(share, false)
  ) {
    return windowsInvalid('windows_invalid_unc')
  }

  const segments = parseWindowsSegments(rest)
  if (segments === null) {
    return windowsInvalid('windows_invalid_segment')
  }

  return {
    kind: 'unc',
    root: `\\\\${server}\\${share}\\`,
    segments: normalizeWindowsSegments(segments)
  }
}

function parseWindowsSegments (source: string): string[] | null {
  if (source === '') {
    return []
  }

  const segments: string[] = []
  for (const segment of source.split(/[\\/]+/u)) {
    if (segment === '') {
      continue
    }
    if (segment !== '.' && segment !== '..' && !isValidWindowsSegmentText(segment, true)) {
      return null
    }
    segments.push(segment)
  }
  return segments
}

function normalizeWindowsSegments (segments: string[]): string[] {
  const normalized: string[] = []
  for (const segment of segments) {
    if (segment === '.') {
      continue
    }
    if (segment === '..') {
      normalized.pop()
      continue
    }
    normalized.push(segment)
  }
  return normalized
}

function serializeWindowsPath (root: string, segments: readonly string[]): string {
  if (segments.length === 0) {
    return root
  }
  return `${root}${segments.join('\\')}`
}

function isValidWindowsSegmentText (segment: string, rejectReservedBasename: boolean): boolean {
  if (segment.length === 0 || /[\\/:*?"<>|]/u.test(segment) || /[ .]$/u.test(segment)) {
    return false
  }

  for (let index = 0; index < segment.length; index += 1) {
    if (segment.charCodeAt(index) <= 0x1f) {
      return false
    }
  }

  if (!rejectReservedBasename) {
    return true
  }

  const basename = (segment.split('.', 1)[0] ?? '').replace(/[a-z]/g, char => char.toUpperCase())
  return !WINDOWS_RESERVED_BASENAMES.has(basename)
}

function checkPathSource (source: string): PathSourceRejectionReason | null {
  if (source.length === 0) {
    return 'empty'
  }

  for (let index = 0; index < source.length; index += 1) {
    const code = source.charCodeAt(index)
    if (code === 0 || code === 0x0a || code === 0x0d || (code >= 0xd800 && code <= 0xdfff)) {
      return 'invalid_code_point'
    }
  }

  return null
}

function platformKind (platform: NodeJS.Platform): PathPlatform | null {
  if (platform === 'win32') {
    return 'win32'
  }
  if (POSIX_PLATFORMS.has(platform)) {
    return 'posix'
  }
  return null
}

function hasWindowsDevicePrefix (source: string): boolean {
  return source.startsWith('\\\\?\\') ||
    source.startsWith('\\\\.\\') ||
    source.startsWith('//?/') ||
    source.startsWith('//./')
}

function startsWithWindowsSeparator (source: string): boolean {
  return source.startsWith('\\') || source.startsWith('/')
}

function countLeadingWindowsSeparators (source: string): number {
  let count = 0
  while (count < source.length && (source[count] === '\\' || source[count] === '/')) {
    count += 1
  }
  return count
}

function findNextWindowsSeparator (source: string, start: number): number {
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === '\\' || source[index] === '/') {
      return index
    }
  }
  return -1
}

function windowsInvalid (reason: PathSourceRejectionReason): WindowsParsedPath {
  return {
    kind: 'invalid',
    reason
  }
}

function invalid (reason: PathSourceRejectionReason): PathSourceResult {
  return {
    state: 'invalid',
    reason
  }
}
