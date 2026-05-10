import { decodeJsonRecord, isRecord } from './json-record'

export type HttpTransport = (request: {
  method: 'GET'
  url: URL
  authorization: string
  rejectUnauthorized: boolean
}) => Promise<{ statusCode: number, body: Buffer }>

export type AcquisitionFailureReason =
  | 'http_status'
  | 'invalid_utf8'
  | 'invalid_json'
  | 'non_object_json'
  | 'invalid_next'

export type AcquisitionResult =
  | { state: 'ok', body: Record<string, unknown>, bytes: number, complete: boolean }
  | { state: 'failed', reason: AcquisitionFailureReason }

export type ConfluenceClient = {
  getPageMetadata: (pageId: string) => Promise<AcquisitionResult>
  getPageStorage: (pageId: string) => Promise<AcquisitionResult>
  listChildPages: (pageId: string) => Promise<AcquisitionResult>
  findTitleCandidates: (input: { title: string, spaceKey?: string }) => Promise<AcquisitionResult>
  getAttachmentMetadata: (pageId: string) => Promise<AcquisitionResult>
}

export function createConfluenceClient (input: {
  baseUrl: string
  token: string
  transport: HttpTransport
  insecure?: boolean
}): ConfluenceClient {
  const baseUrl = normalizeBaseUrl(input.baseUrl)
  const request = async (targetPathAndQuery: string): Promise<AcquisitionResult> =>
    acquireJson(input.transport, {
      baseUrl,
      pathAndQuery: targetPathAndQuery,
      authorization: `Bearer ${input.token}`,
      rejectUnauthorized: input.insecure !== true
    })

  return {
    getPageMetadata: pageId => request(`/rest/api/content/${pageId}?expand=space`),
    getPageStorage: pageId => request(`/rest/api/content/${pageId}?expand=body.storage`),
    listChildPages: pageId => acquirePaginated(input.transport, {
      baseUrl,
      pathAndQuery: `/rest/api/content/${pageId}/child/page?limit=200&expand=space`,
      authorization: `Bearer ${input.token}`,
      rejectUnauthorized: input.insecure !== true
    }),
    findTitleCandidates: async ({ title, spaceKey }) => {
      const query = new URLSearchParams()
      query.set('type', 'page')
      query.set('title', title)
      if (spaceKey !== undefined) {
        query.set('spaceKey', spaceKey)
      }
      query.set('limit', '200')
      query.set('expand', 'space')
      return acquirePaginated(input.transport, {
        baseUrl,
        pathAndQuery: `/rest/api/content?${query.toString()}`,
        authorization: `Bearer ${input.token}`,
        rejectUnauthorized: input.insecure !== true
      })
    },
    getAttachmentMetadata: pageId => acquirePaginated(input.transport, {
      baseUrl,
      pathAndQuery: `/rest/api/content/${pageId}/child/attachment?limit=200`,
      authorization: `Bearer ${input.token}`,
      rejectUnauthorized: input.insecure !== true
    })
  }
}

async function acquirePaginated (
  transport: HttpTransport,
  input: {
    baseUrl: string
    pathAndQuery: string
    authorization: string
    rejectUnauthorized: boolean
  }
): Promise<AcquisitionResult> {
  let currentPathAndQuery: string | null = input.pathAndQuery
  let bytes = 0
  const results: unknown[] = []
  let lastBody: Record<string, unknown> | null = null

  while (currentPathAndQuery !== null) {
    const page = await acquireJson(transport, { ...input, pathAndQuery: currentPathAndQuery })
    if (page.state !== 'ok') {
      return page
    }
    bytes += page.bytes
    lastBody = page.body
    const pageResults = page.body.results
    if (Array.isArray(pageResults)) {
      results.push(...pageResults)
    }
    const next = nextPathAndQuery(page.body)
    if (next.state === 'failed') {
      return { state: 'failed', reason: 'invalid_next' }
    }
    currentPathAndQuery = next.state === 'absent' ? null : next.pathAndQuery
  }

  return {
    state: 'ok',
    body: {
      ...(lastBody ?? {}),
      results
    },
    bytes,
    complete: true
  }
}

async function acquireJson (
  transport: HttpTransport,
  input: {
    baseUrl: string
    pathAndQuery: string
    authorization: string
    rejectUnauthorized: boolean
  }
): Promise<AcquisitionResult> {
  const response = await transport({
    method: 'GET',
    url: governedUrl(input.baseUrl, input.pathAndQuery),
    authorization: input.authorization,
    rejectUnauthorized: input.rejectUnauthorized
  })

  if (response.statusCode !== 200) {
    return { state: 'failed', reason: 'http_status' }
  }

  const decoded = decodeJsonRecord(response.body)
  if (decoded.state !== 'ok') {
    return decoded
  }

  return {
    state: 'ok',
    body: decoded.value,
    bytes: decoded.bytes,
    complete: nextPathAndQuery(decoded.value).state === 'absent'
  }
}

function nextPathAndQuery (
  body: Record<string, unknown>
): { state: 'ok', pathAndQuery: string } | { state: 'failed' } | { state: 'absent' } {
  const links = body._links
  if (!isRecord(links) || typeof links.next !== 'string') {
    return { state: 'absent' }
  }
  const next = links.next
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('#') || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(next)) {
    return { state: 'failed' }
  }
  return { state: 'ok', pathAndQuery: next }
}

function governedUrl (baseUrl: string, pathAndQuery: string): URL {
  const base = new URL(baseUrl)
  const prefix = base.pathname === '/' ? '' : base.pathname
  return new URL(`${base.origin}${prefix}${pathAndQuery}`)
}

function normalizeBaseUrl (value: string): string {
  const url = new URL(value)
  const path = url.pathname === '/' ? '' : url.pathname
  return `${url.protocol}//${url.host}${path}`
}
