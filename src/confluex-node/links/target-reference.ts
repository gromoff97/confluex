import { structuredRawLinkValue } from '../reports/rows'

export type RelativeUrlParts = {
  state: 'ok'
  pathPart: string
  queryPart: string
  fragment: string
}

export type TargetReference =
  | { kind: 'page_id', pageId: string }
  | { kind: 'title', title: string, spaceKey?: string }

export function parseCanonicalPageId (value: string): { state: 'ok', pageId: string } | { state: 'failed' } {
  return /^(0|[1-9][0-9]*)$/.test(value)
    ? { state: 'ok', pageId: value }
    : { state: 'failed' }
}

export function parseConfluenceRelativeUrl (value: string): RelativeUrlParts | { state: 'failed' } {
  if (isAbsoluteOrSchemeRelativeUrl(value)) {
    return { state: 'failed' }
  }
  const fragmentStart = value.indexOf('#')
  const withoutFragment = fragmentStart === -1 ? value : value.slice(0, fragmentStart)
  const queryStart = withoutFragment.indexOf('?')
  return {
    state: 'ok',
    pathPart: queryStart === -1 ? withoutFragment : withoutFragment.slice(0, queryStart),
    queryPart: queryStart === -1 ? '' : withoutFragment.slice(queryStart + 1),
    fragment: fragmentStart === -1 ? '' : value.slice(fragmentStart + 1)
  }
}

export function targetReferenceFromRelativeUrl (
  value: string
): { state: 'ok', target: TargetReference } | { state: 'failed' } {
  const parts = parseConfluenceRelativeUrl(value)
  if (parts.state !== 'ok') {
    return { state: 'failed' }
  }

  const pageId = pageIdFromQuery(parts.queryPart) ?? pageIdFromPath(parts.pathPart)
  if (pageId !== null) {
    return { state: 'ok', target: { kind: 'page_id', pageId } }
  }

  const title = titleFromDisplayPath(parts.pathPart) ?? titleFromQuery(parts.queryPart)
  return title === null ? { state: 'failed' } : { state: 'ok', target: title }
}

export function reportRawLinkValue (target: TargetReference): string {
  if (target.kind === 'page_id') {
    return structuredRawLinkValue('page_id', [target.pageId])
  }
  const spaceKey = target.spaceKey
  return structuredRawLinkValue('title', [
    spaceKey === undefined ? '0' : '1',
    spaceKey ?? '',
    target.title
  ])
}

export function isAbsoluteOrSchemeRelativeUrl (value: string): boolean {
  return value.startsWith('//') || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)
}

function pageIdFromQuery (query: string): string | null {
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

function pageIdFromPath (pathPart: string): string | null {
  const segments = pathPart.split('/').filter(segment => segment !== '')
  for (let index = 0; index < segments.length - 1; index += 1) {
    const marker = segments[index]
    const candidate = segments[index + 1]
    if (marker === 'pages' && candidate !== undefined && /^(0|[1-9][0-9]*)$/.test(candidate)) {
      return candidate
    }
  }
  return null
}

function titleFromDisplayPath (pathPart: string): TargetReference | null {
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
      kind: 'title',
      title,
      spaceKey
    }
  }
  return null
}

function titleFromQuery (query: string): TargetReference | null {
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
    kind: 'title',
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
