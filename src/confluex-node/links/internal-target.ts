import path from 'node:path'

import { structuredRawLinkValue } from '../reports/rows'

type UrlParts = {
  pathPart: string
  queryPart: string
  fragment: string
}

type MarkdownDestinationOptions = {
  baseUrl?: string
}

type NormalizedTargetKey = {
  targetKey: string
  fragment: string
}

type LinkDiscovery = {
  linkKind: string
  title: string
  spaceKey?: string
}

type LinkRow = {
  raw_link_value?: unknown
}

export function normalizedTargetKeyFromMarkdownDestination (
  value: unknown,
  options: MarkdownDestinationOptions = {}
): NormalizedTargetKey | null {
  const parts = markdownDestinationParts(value, options)
  if (parts === null) {
    return null
  }

  const pageId = pageIdFromQuery(parts.queryPart) ?? pageIdFromPath(parts.pathPart)
  if (pageId !== null) {
    return {
      targetKey: `page_id:${pageId}`,
      fragment: parts.fragment
    }
  }

  const titleLink = titleLinkFromDisplayPath(parts.pathPart, 'markdown_destination') ??
    titleLinkFromQuery(parts.queryPart, 'markdown_destination')
  if (titleLink !== null) {
    return {
      targetKey: titleRawLinkValue(titleLink),
      fragment: parts.fragment
    }
  }

  return null
}

export function normalizedTargetKeyFromResolvedRow (row: unknown): string | null {
  return normalizedTargetKeyFromRow(row)
}

export function normalizedTargetKeyFromUnresolvedRow (row: unknown): string | null {
  return normalizedTargetKeyFromRow(row)
}

function normalizedTargetKeyFromRow (row: unknown): string | null {
  if (row === null || typeof row !== 'object') {
    return null
  }

  const candidate = row as LinkRow
  if (typeof candidate.raw_link_value !== 'string' || candidate.raw_link_value === '') {
    return null
  }

  return candidate.raw_link_value
}

export function localPathFromFolderPair (sourceFolder: string, targetFolder: string): string {
  return path.posix.relative(sourceFolder, `${targetFolder}/page.md`)
}

export function pageIdFromRelativeUrl (value: string): string | null {
  const parts = relativeUrlParts(value)
  if (parts === null) {
    return null
  }
  return pageIdFromQuery(parts.queryPart) ?? pageIdFromPath(parts.pathPart)
}

export function titleLinkFromRelativeUrl (value: string, linkKind: string): LinkDiscovery | null {
  const parts = relativeUrlParts(value)
  if (parts === null || pageIdFromQuery(parts.queryPart) !== null || pageIdFromPath(parts.pathPart) !== null) {
    return null
  }
  return titleLinkFromDisplayPath(parts.pathPart, linkKind) ?? titleLinkFromQuery(parts.queryPart, linkKind)
}

function markdownDestinationParts (
  value: unknown,
  options: MarkdownDestinationOptions
): UrlParts | null {
  void options
  if (typeof value !== 'string' || value === '') {
    return null
  }

  if (!isAbsoluteOrSchemeRelativeUrl(value)) {
    return relativeUrlParts(value)
  }

  return null
}

export function relativeUrlParts (value: string): UrlParts | null {
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

export function isAbsoluteOrSchemeRelativeUrl (value: string): boolean {
  return value.startsWith('//') || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)
}

function pageIdFromQuery (query: string): string | null {
  for (const part of query.split('&')) {
    const separatorIndex = part.indexOf('=')
    const name = separatorIndex === -1 ? part : part.slice(0, separatorIndex)
    const rawValue = separatorIndex === -1 ? '' : part.slice(separatorIndex + 1)
    if (name === 'pageId' && /^[0-9]+$/.test(rawValue)) {
      return rawValue
    }
  }
  return null
}

function pageIdFromPath (pathPart: string): string | null {
  const segments = pathPart.split('/').filter(segment => segment !== '')
  for (let index = 0; index < segments.length - 1; index += 1) {
    const marker = segments[index]
    const candidate = segments[index + 1]
    if (marker === 'pages' && candidate !== undefined && /^[0-9]+$/.test(candidate)) {
      return candidate
    }
  }
  return null
}

export function titleLinkFromDisplayPath (pathPart: string, linkKind: string): LinkDiscovery | null {
  const segments = pathPart.split('/').filter(segment => segment !== '')
  for (let index = 0; index < segments.length - 2; index += 1) {
    if (segments[index] !== 'display' || index + 2 !== segments.length - 1) {
      continue
    }

    const spaceKeySegment = segments[index + 1]
    const titleSegment = segments[index + 2]
    if (spaceKeySegment === undefined || titleSegment === undefined) {
      return null
    }

    const spaceKey = decodeUrlComponent(spaceKeySegment, false)
    const title = decodeUrlComponent(titleSegment, true)
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

export function titleLinkFromQuery (query: string, linkKind: string): LinkDiscovery | null {
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

function firstQueryValue (query: string, name: string): string | null {
  for (const part of query.split('&')) {
    const separatorIndex = part.indexOf('=')
    const partName = separatorIndex === -1 ? part : part.slice(0, separatorIndex)
    if (partName === name) {
      return separatorIndex === -1 ? '' : part.slice(separatorIndex + 1)
    }
  }
  return null
}

function decodeUrlComponent (value: string, plusAsSpace: boolean): string | null {
  try {
    return decodeURIComponent(plusAsSpace ? value.replace(/\+/g, ' ') : value).trim()
  } catch {
    return null
  }
}

function titleRawLinkValue (discovery: LinkDiscovery): string {
  const discoveredSpaceKey = discovery.spaceKey
  const spaceKeyPresent = typeof discoveredSpaceKey === 'string'
  const spaceKey = spaceKeyPresent ? discoveredSpaceKey : ''
  return structuredRawLinkValue('title', [spaceKeyPresent ? '1' : '0', spaceKey, discovery.title])
}
