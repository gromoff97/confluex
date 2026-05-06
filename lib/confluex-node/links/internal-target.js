'use strict'

const path = require('node:path')

function normalizedTargetKeyFromMarkdownDestination (value, options = {}) {
  const parts = markdownDestinationParts(value, options)
  if (parts === null) {
    return null
  }

  const pageId = pageIdFromQuery(parts.queryPart) || pageIdFromPath(parts.pathPart)
  if (pageId !== null) {
    return {
      targetKey: `page_id:${pageId}`,
      fragment: parts.fragment
    }
  }

  const titleLink = titleLinkFromDisplayPath(parts.pathPart, 'markdown_destination') ||
    titleLinkFromQuery(parts.queryPart, 'markdown_destination')
  if (titleLink !== null) {
    return {
      targetKey: titleRawLinkValue(titleLink),
      fragment: parts.fragment
    }
  }

  return null
}

function normalizedTargetKeyFromResolvedRow (row) {
  return normalizedTargetKeyFromRow(row)
}

function normalizedTargetKeyFromUnresolvedRow (row) {
  return normalizedTargetKeyFromRow(row)
}

function normalizedTargetKeyFromRow (row) {
  if (row === null || typeof row !== 'object' || typeof row.raw_link_value !== 'string' || row.raw_link_value === '') {
    return null
  }
  return row.raw_link_value
}

function localPathFromFolderPair (sourceFolder, targetFolder) {
  return path.posix.relative(sourceFolder, `${targetFolder}/page.md`)
}

function pageIdFromRelativeUrl (value) {
  const parts = relativeUrlParts(value)
  if (parts === null) {
    return null
  }
  return pageIdFromQuery(parts.queryPart) || pageIdFromPath(parts.pathPart)
}

function titleLinkFromRelativeUrl (value, linkKind) {
  const parts = relativeUrlParts(value)
  if (parts === null || pageIdFromQuery(parts.queryPart) !== null || pageIdFromPath(parts.pathPart) !== null) {
    return null
  }
  return titleLinkFromDisplayPath(parts.pathPart, linkKind) || titleLinkFromQuery(parts.queryPart, linkKind)
}

function markdownDestinationParts (value, options) {
  if (typeof value !== 'string' || value === '') {
    return null
  }

  if (!isAbsoluteOrSchemeRelativeUrl(value)) {
    return relativeUrlParts(value)
  }

  if (value.startsWith('//') || typeof options.baseUrl !== 'string' || options.baseUrl === '') {
    return null
  }

  try {
    const url = new URL(value)
    const baseUrl = new URL(options.baseUrl)
    if (url.origin !== baseUrl.origin) {
      return null
    }
    const strippedPath = stripBasePath(url.pathname, baseUrl.pathname)
    if (strippedPath === null) {
      return null
    }
    return {
      pathPart: strippedPath,
      queryPart: url.search.length > 0 ? url.search.slice(1) : '',
      fragment: url.hash.length > 0 ? url.hash.slice(1) : ''
    }
  } catch {
    return null
  }
}

function stripBasePath (pathname, basePathname) {
  const normalizedBase = basePathname === '/' ? '' : basePathname.replace(/\/+$/g, '')
  if (normalizedBase === '') {
    return pathname
  }
  if (pathname === normalizedBase) {
    return '/'
  }
  return pathname.startsWith(`${normalizedBase}/`)
    ? pathname.slice(normalizedBase.length)
    : null
}

function relativeUrlParts (value) {
  if (isAbsoluteOrSchemeRelativeUrl(value)) {
    return null
  }
  const fragmentStart = value.indexOf('#')
  const withoutFragment = fragmentStart === -1 ? value : value.slice(0, fragmentStart)
  const queryStart = withoutFragment.indexOf('?')
  return {
    pathPart: queryStart === -1 ? withoutFragment : withoutFragment.slice(0, queryStart),
    queryPart: queryStart === -1 ? '' : withoutFragment.slice(queryStart + 1),
    fragment: fragmentStart === -1 ? '' : value.slice(fragmentStart + 1)
  }
}

function isAbsoluteOrSchemeRelativeUrl (value) {
  return value.startsWith('//') || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)
}

function pageIdFromQuery (query) {
  for (const part of query.split('&')) {
    const separatorIndex = part.indexOf('=')
    const name = separatorIndex === -1 ? part : part.slice(0, separatorIndex)
    const rawValue = separatorIndex === -1 ? '' : part.slice(separatorIndex + 1)
    if (name === 'pageId' && /^(0|[1-9][0-9]*)$/.test(rawValue)) {
      return rawValue
    }
  }
  return null
}

function pageIdFromPath (pathPart) {
  const segments = pathPart.split('/').filter(segment => segment !== '')
  for (let index = 0; index < segments.length - 1; index += 1) {
    if (segments[index] === 'pages' && /^(0|[1-9][0-9]*)$/.test(segments[index + 1])) {
      return segments[index + 1]
    }
  }
  return null
}

function titleLinkFromDisplayPath (pathPart, linkKind) {
  const segments = pathPart.split('/').filter(segment => segment !== '')
  for (let index = 0; index < segments.length - 2; index += 1) {
    if (segments[index] !== 'display' || index + 2 !== segments.length - 1) {
      continue
    }
    const spaceKey = decodeUrlComponent(segments[index + 1], false)
    const title = decodeUrlComponent(segments[index + 2], true)
    if (spaceKey === null || spaceKey === '' || title === null || title === '') {
      return null
    }
    return {
      linkKind,
      title,
      spaceKey
    }
  }
  return null
}

function titleLinkFromQuery (query, linkKind) {
  const titleValue = firstQueryValue(query, 'title')
  if (titleValue === null) {
    return null
  }
  const title = decodeUrlComponent(titleValue, true)
  const spaceKeyValue = firstQueryValue(query, 'spaceKey')
  const spaceKey = spaceKeyValue === null ? null : decodeUrlComponent(spaceKeyValue, false)
  if (title === null || title === '' || spaceKey === '') {
    return null
  }
  return {
    linkKind,
    title,
    ...(spaceKey === null ? {} : { spaceKey })
  }
}

function firstQueryValue (query, name) {
  for (const part of query.split('&')) {
    const separatorIndex = part.indexOf('=')
    const partName = separatorIndex === -1 ? part : part.slice(0, separatorIndex)
    if (partName === name) {
      return separatorIndex === -1 ? '' : part.slice(separatorIndex + 1)
    }
  }
  return null
}

function decodeUrlComponent (value, plusAsSpace) {
  try {
    return decodeURIComponent(plusAsSpace ? value.replace(/\+/g, ' ') : value).trim()
  } catch {
    return null
  }
}

function titleRawLinkValue (discovery) {
  const spaceKeyPresent = typeof discovery.spaceKey === 'string'
  const spaceKey = spaceKeyPresent ? discovery.spaceKey : ''
  return [
    `space_key_present=${spaceKeyPresent ? '1' : '0'}`,
    `space_key_bytes=${Buffer.byteLength(spaceKey, 'utf8')}`,
    `space_key=${spaceKey}`,
    `title_bytes=${Buffer.byteLength(discovery.title, 'utf8')}`,
    `title=${discovery.title}`
  ].join(';')
}

module.exports = {
  isAbsoluteOrSchemeRelativeUrl,
  localPathFromFolderPair,
  normalizedTargetKeyFromMarkdownDestination,
  normalizedTargetKeyFromResolvedRow,
  normalizedTargetKeyFromUnresolvedRow,
  pageIdFromRelativeUrl,
  relativeUrlParts,
  titleLinkFromDisplayPath,
  titleLinkFromQuery,
  titleLinkFromRelativeUrl
}
