export type AttachmentQuarantine = 'none' | 'dangerous_name' | 'dangerous_target' | 'active_content'

type AttachmentArtifactInput = {
  filename: string
  downloadUrl: string
  contentType?: string
}

export type AttachmentArtifactPlan = {
  filename: string
  quarantine: AttachmentQuarantine
  retainedPath: string | null
}

const WINDOWS_RESERVED_BASENAMES = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i
const ACTIVE_CONTENT_EXTENSIONS = new Set(['.html', '.htm', '.svg', '.js', '.mjs', '.xhtml'])
const ACTIVE_CONTENT_TYPES = new Set([
  'application/javascript',
  'application/ecmascript',
  'application/xhtml+xml',
  'image/svg+xml',
  'text/ecmascript',
  'text/html',
  'text/javascript'
])

export function planAttachmentArtifact (input: AttachmentArtifactInput): AttachmentArtifactPlan {
  if (!isSafeAttachmentFilename(input.filename)) {
    return quarantined(input.filename, 'dangerous_name')
  }
  if (!isSafeAttachmentDownloadUrl(input.downloadUrl)) {
    return quarantined(input.filename, 'dangerous_target')
  }
  if (isActiveContent(input.filename, input.contentType)) {
    return quarantined(input.filename, 'active_content')
  }
  return {
    filename: input.filename,
    quarantine: 'none',
    retainedPath: input.filename
  }
}

function quarantined (filename: string, quarantine: Exclude<AttachmentQuarantine, 'none'>): AttachmentArtifactPlan {
  return {
    filename,
    quarantine,
    retainedPath: null
  }
}

function isSafeAttachmentFilename (filename: string): boolean {
  if (filename.length === 0 || Buffer.byteLength(filename, 'utf8') > 255) {
    return false
  }
  if (!/^[A-Za-z0-9._-]+$/.test(filename) || filename.includes('..') || filename.endsWith('.')) {
    return false
  }
  const basename = filename.replace(/\.[^.]*$/, '')
  return !WINDOWS_RESERVED_BASENAMES.test(basename)
}

function isSafeAttachmentDownloadUrl (downloadUrl: string): boolean {
  if (!downloadUrl.startsWith('/') || downloadUrl.startsWith('//') || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(downloadUrl)) {
    return false
  }
  if (downloadUrl.includes('#')) {
    return false
  }
  const pathPart = downloadUrl.split('?')[0] ?? ''
  for (const segment of pathPart.split('/')) {
    if (segment === '') {
      continue
    }
    const decoded = decodeUrlSegment(segment)
    if (decoded === null || decoded === '.' || decoded === '..' || decoded.includes('/')) {
      return false
    }
  }
  return true
}

function isActiveContent (filename: string, contentType: string | undefined): boolean {
  const mediaType = mediaTypeOnly(contentType)
  if (mediaType !== null && ACTIVE_CONTENT_TYPES.has(mediaType)) {
    return true
  }
  return ACTIVE_CONTENT_EXTENSIONS.has(filenameExtension(filename))
}

function mediaTypeOnly (contentType: string | undefined): string | null {
  if (contentType === undefined) {
    return null
  }
  const [mediaType] = contentType.split(';', 1)
  const normalized = mediaType?.trim().toLowerCase() ?? ''
  return normalized === '' ? null : normalized
}

function filenameExtension (filename: string): string {
  const dotIndex = filename.lastIndexOf('.')
  return dotIndex === -1 ? '' : filename.slice(dotIndex).toLowerCase()
}

function decodeUrlSegment (segment: string): string | null {
  try {
    return decodeURIComponent(segment)
  } catch {
    return null
  }
}
