import http from 'node:http'
import https from 'node:https'
import { TextDecoder } from 'node:util'

export type RemoteAccessFailureReason =
  | 'missing_base_url'
  | 'invalid_base_url'
  | 'missing_token'

export type RemoteOperationFailureReason =
  | RemoteAccessFailureReason
  | 'auth_rejected'
  | 'page_inaccessible'
  | 'transport_dns'
  | 'transport_timeout'
  | 'transport_connection_reset'
  | 'transport_tls'
  | 'transport_proxy'

export type RemoteAccessContext =
  | {
    usable: true
    baseUrl: string
    token: string
    authorization: string
    transportPolicy: TransportPolicy
  }
  | {
    usable: false
    reason: RemoteAccessFailureReason
  }

export type TransportPolicy = {
  insecure: boolean
}

export type PageMetadata = {
  page_id: string
  page_title: string
  space_key?: string
}

export type AttachmentDataItem = {
  filename: string
  downloadUrl: string
}

export type GovernedRequestTarget = {
  readonly pathAndQuery: string
  readonly authorization: 'confluence' | 'none'
}

export type HttpResponse = {
  statusCode: number | undefined
  chunks: Buffer[]
}

export type RequestLimits = {
  timeoutMs: number
  maxBufferedBytes: number
}

export type HttpRequest = (
  url: URL,
  authorization: string,
  policy: TransportPolicy,
  limits?: RequestLimits
) => Promise<HttpResponse>

type AccessCheckDependencies = {
  request?: HttpRequest
}

type PageRef = {
  page_id: string
}

type TitleDiscovery = {
  title: string
  spaceKey?: string
}

type DownloadableAttachment = {
  downloadUrl: string
}

const DEFAULT_TRANSPORT_POLICY: TransportPolicy = { insecure: false }
const DEFAULT_REMOTE_TIMEOUT_MS = 60_000
const DEFAULT_BUFFERED_RESPONSE_LIMIT_BYTES = 64 * 1024 * 1024
const DEFAULT_REQUEST_LIMITS: RequestLimits = {
  timeoutMs: DEFAULT_REMOTE_TIMEOUT_MS,
  maxBufferedBytes: DEFAULT_BUFFERED_RESPONSE_LIMIT_BYTES
}

export function resolveRemoteAccessContext (
  env: NodeJS.ProcessEnv = process.env,
  policy: TransportPolicy = DEFAULT_TRANSPORT_POLICY
): RemoteAccessContext {
  const baseUrlValue = env.CONFLUEX_CONFLUENCE_BASE_URL
  const token = env.CONFLUEX_CONFLUENCE_TOKEN

  if (!validEnvironmentValue(baseUrlValue)) {
    return { usable: false, reason: 'missing_base_url' }
  }

  const parsed = parseUsableBaseUrl(baseUrlValue, policy)
  if (parsed === null) {
    return { usable: false, reason: 'invalid_base_url' }
  }

  if (!validEnvironmentValue(token)) {
    return { usable: false, reason: 'missing_token' }
  }

  return {
    usable: true,
    baseUrl: parsed.baseUrl,
    token,
    authorization: `Bearer ${token}`,
    transportPolicy: policy
  }
}

export async function checkRootPageAccess (
  pageId: string,
  env: NodeJS.ProcessEnv = process.env,
  policy: TransportPolicy = DEFAULT_TRANSPORT_POLICY,
  dependencies: AccessCheckDependencies = {}
): Promise<
  | { state: 'ok', identity: string, metadataBytes: number, metadata?: PageMetadata }
  | { state: 'failed', reason: RemoteAccessFailureReason | RootPageFailureReason }
> {
  const context = resolveRemoteAccessContext(env, policy)
  if (!context.usable) {
    return { state: 'failed', reason: context.reason }
  }

  try {
    const request = dependencies.request ?? get
    const url = rootPageUrl(context.baseUrl, pageId)
    const response = await request(url, context.authorization, context.transportPolicy)
    if (response.statusCode !== 200) {
      return { state: 'failed', reason: classifyHttpFailure(response) }
    }

    const bodyText = decodeBodyText(response.chunks)
    const body = parseJson(bodyText)
    if (!isRecord(body) || typeof body.id !== 'string' || !isCanonicalPageId(body.id)) {
      return { state: 'failed', reason: 'page_inaccessible' }
    }

    const metadata = extractPageMetadata(body)
    return metadata === null
      ? {
          state: 'ok',
          identity: body.id,
          metadataBytes: Buffer.byteLength(bodyText, 'utf8')
        }
      : {
          state: 'ok',
          identity: body.id,
          metadata,
          metadataBytes: Buffer.byteLength(bodyText, 'utf8')
        }
  } catch (error) {
    return { state: 'failed', reason: classifyTransportFailure(error) }
  }
}

export async function checkCurrentUserAccess (
  env: NodeJS.ProcessEnv = process.env,
  policy: TransportPolicy = DEFAULT_TRANSPORT_POLICY,
  dependencies: AccessCheckDependencies = {}
): Promise<
  | { state: 'ok', baseUrl: string }
  | { state: 'failed', reason: RemoteOperationFailureReason }
> {
  const context = resolveRemoteAccessContext(env, policy)
  if (!context.usable) {
    return { state: 'failed', reason: context.reason }
  }

  const request = dependencies.request ?? get
  const identity = await checkTokenIdentity(context, request)
  if (identity.state === 'failed') {
    return { state: 'failed', reason: identity.reason }
  }

  return {
    state: 'ok',
    baseUrl: context.baseUrl
  }
}

async function checkTokenIdentity (
  context: Extract<RemoteAccessContext, { usable: true }>,
  request: HttpRequest
): Promise<
  | { state: 'ok' }
  | { state: 'failed', reason: RootPageFailureReason }
> {
  try {
    const response = await request(currentUserUrl(context.baseUrl), context.authorization, context.transportPolicy)
    if (response.statusCode !== 200) {
      return { state: 'failed', reason: classifyHttpFailure(response) }
    }

    const body = parseJson(decodeBodyText(response.chunks))
    if (!isRecord(body) || body.type !== 'known') {
      return { state: 'failed', reason: 'auth_rejected' }
    }

    return { state: 'ok' }
  } catch (error) {
    return { state: 'failed', reason: classifyTransportFailure(error) }
  }
}

export async function listChildPages (
  page: unknown,
  env: NodeJS.ProcessEnv = process.env,
  policy: TransportPolicy = DEFAULT_TRANSPORT_POLICY
): Promise<
  | { state: 'ok', complete: boolean, children: PageMetadata[], metadataBytes: number }
  | { state: 'failed' }
> {
  const context = resolveRemoteAccessContext(env, policy)
  if (!context.usable || !isPageRef(page)) {
    return { state: 'failed' }
  }

  try {
    const url = childPagesUrl(context.baseUrl, page.page_id)
    const response = await get(url, context.authorization, context.transportPolicy)
    if (response.statusCode !== 200) {
      return { state: 'failed' }
    }

    const bodyText = decodeBodyText(response.chunks)
    const body = parseJson(bodyText)
    if (!isRecord(body) || !Array.isArray(body.results)) {
      return { state: 'failed' }
    }

    const children: PageMetadata[] = []
    for (const result of body.results) {
      const metadata = extractPageMetadata(result)
      if (metadata === null) {
        return { state: 'failed' }
      }
      children.push(metadata)
    }

    return {
      state: 'ok',
      complete: !hasNextLink(body),
      children,
      metadataBytes: Buffer.byteLength(bodyText, 'utf8')
    }
  } catch {
    return { state: 'failed' }
  }
}

export async function getPageStorageContent (
  page: unknown,
  env: NodeJS.ProcessEnv = process.env,
  policy: TransportPolicy = DEFAULT_TRANSPORT_POLICY
): Promise<
  | { state: 'ok', storage: string, metadataBytes: number }
  | { state: 'failed' }
> {
  const context = resolveRemoteAccessContext(env, policy)
  if (!context.usable || !isPageRef(page)) {
    return { state: 'failed' }
  }

  try {
    const url = pageStorageUrl(context.baseUrl, page.page_id)
    const response = await get(url, context.authorization, context.transportPolicy)
    if (response.statusCode !== 200) {
      return { state: 'failed' }
    }

    const bodyText = decodeBodyText(response.chunks)
    const body = parseJson(bodyText)
    if (!isRecord(body) || body.id !== page.page_id) {
      return { state: 'failed' }
    }

    const pageBody = body.body
    if (!isRecord(pageBody) || !isRecord(pageBody.storage) || typeof pageBody.storage.value !== 'string') {
      return { state: 'failed' }
    }

    return {
      state: 'ok',
      storage: pageBody.storage.value,
      metadataBytes: Buffer.byteLength(bodyText, 'utf8')
    }
  } catch {
    return { state: 'failed' }
  }
}

export async function getAttachmentPreview (
  page: unknown,
  env: NodeJS.ProcessEnv = process.env,
  policy: TransportPolicy = DEFAULT_TRANSPORT_POLICY
): Promise<
  | { state: 'ok', count: number, preview: string, metadataBytes: number }
  | { state: 'failed' }
> {
  const context = resolveRemoteAccessContext(env, policy)
  if (!context.usable || !isPageRef(page)) {
    return { state: 'failed' }
  }

  try {
    const url = attachmentPreviewUrl(context.baseUrl, page.page_id)
    const response = await get(url, context.authorization, context.transportPolicy)
    if (response.statusCode !== 200) {
      return { state: 'failed' }
    }

    const bodyText = decodeBodyText(response.chunks)
    const body = parseJson(bodyText)
    if (!isRecord(body) || !Array.isArray(body.results) || hasNextLink(body)) {
      return { state: 'failed' }
    }

    return {
      state: 'ok',
      count: body.results.length,
      preview: attachmentPreviewText(body.results),
      metadataBytes: Buffer.byteLength(bodyText, 'utf8')
    }
  } catch {
    return { state: 'failed' }
  }
}

export async function getAttachmentData (
  page: unknown,
  env: NodeJS.ProcessEnv = process.env,
  policy: TransportPolicy = DEFAULT_TRANSPORT_POLICY
): Promise<
  | { state: 'ok', items: AttachmentDataItem[], metadataBytes: number }
  | { state: 'failed' }
> {
  const context = resolveRemoteAccessContext(env, policy)
  if (!context.usable || !isPageRef(page)) {
    return { state: 'failed' }
  }

  try {
    const url = attachmentPreviewUrl(context.baseUrl, page.page_id)
    const response = await get(url, context.authorization, context.transportPolicy)
    if (response.statusCode !== 200) {
      return { state: 'failed' }
    }

    const bodyText = decodeBodyText(response.chunks)
    const body = parseJson(bodyText)
    if (!isRecord(body) || !Array.isArray(body.results) || hasNextLink(body)) {
      return { state: 'failed' }
    }

    const items: AttachmentDataItem[] = []
    for (const result of body.results) {
      const item = attachmentDataItem(result)
      if (item === null) {
        return { state: 'failed' }
      }
      items.push(item)
    }

    return {
      state: 'ok',
      items,
      metadataBytes: Buffer.byteLength(bodyText, 'utf8')
    }
  } catch {
    return { state: 'failed' }
  }
}

export async function downloadAttachmentPayload (
  attachment: unknown,
  env: NodeJS.ProcessEnv = process.env,
  policy: TransportPolicy = DEFAULT_TRANSPORT_POLICY
): Promise<
  | { state: 'ok', bytes: Buffer }
  | { state: 'failed' }
> {
  const context = resolveRemoteAccessContext(env, policy)
  if (!context.usable || !isDownloadableAttachment(attachment)) {
    return { state: 'failed' }
  }

  try {
    const url = governedAttachmentDownloadUrl(context.baseUrl, attachment.downloadUrl)
    if (url === null) {
      return { state: 'failed' }
    }
    const response = await get(url, context.authorization, context.transportPolicy)
    if (response.statusCode !== 200) {
      return { state: 'failed' }
    }
    return {
      state: 'ok',
      bytes: Buffer.concat(response.chunks)
    }
  } catch {
    return { state: 'failed' }
  }
}

export async function findTitleCandidates (
  discovery: unknown,
  env: NodeJS.ProcessEnv = process.env,
  policy: TransportPolicy = DEFAULT_TRANSPORT_POLICY
): Promise<
  | { state: 'ok', complete: boolean, candidates: PageMetadata[], metadataBytes: number }
  | { state: 'failed' }
> {
  const context = resolveRemoteAccessContext(env, policy)
  if (!context.usable || !isUsableTitleDiscovery(discovery)) {
    return { state: 'failed' }
  }

  try {
    const url = titleCandidatesUrl(context.baseUrl, discovery)
    const response = await get(url, context.authorization, context.transportPolicy)
    if (response.statusCode !== 200) {
      return { state: 'failed' }
    }

    const bodyText = decodeBodyText(response.chunks)
    const body = parseJson(bodyText)
    if (!isRecord(body) || !Array.isArray(body.results)) {
      return { state: 'failed' }
    }

    const candidates: PageMetadata[] = []
    for (const result of body.results) {
      const metadata = extractPageMetadata(result)
      if (metadata === null) {
        return { state: 'failed' }
      }
      candidates.push(metadata)
    }

    return {
      state: 'ok',
      complete: !hasNextLink(body),
      candidates,
      metadataBytes: Buffer.byteLength(bodyText, 'utf8')
    }
  } catch {
    return { state: 'failed' }
  }
}

type RootPageFailureReason =
  | 'auth_rejected'
  | 'page_inaccessible'
  | 'transport_dns'
  | 'transport_timeout'
  | 'transport_connection_reset'
  | 'transport_tls'
  | 'transport_proxy'

function validEnvironmentValue (value: unknown): value is string {
  return typeof value === 'string' && value !== '' && !/[\t\n\r]/.test(value)
}

function classifyHttpFailure (response: HttpResponse): RootPageFailureReason {
  if (response.statusCode === 401 || response.statusCode === 403) {
    return 'auth_rejected'
  }
  return 'page_inaccessible'
}

function classifyTransportFailure (error: unknown): RootPageFailureReason {
  const code = isErrorWithCode(error) ? error.code : undefined
  const message = error instanceof Error ? error.message.toLowerCase() : ''

  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return 'transport_dns'
  }
  if (code === 'ETIMEDOUT' || code === 'ETIMEOUT' || code === 'ESOCKETTIMEDOUT') {
    return 'transport_timeout'
  }
  if (code === 'ECONNRESET') {
    return 'transport_connection_reset'
  }
  if (isTlsErrorCode(code) || message.includes('certificate') || message.includes('tls')) {
    return 'transport_tls'
  }
  if (message.includes('proxy')) {
    return 'transport_proxy'
  }
  return 'page_inaccessible'
}

function isErrorWithCode (error: unknown): error is Error & { code: unknown } {
  return error instanceof Error && 'code' in error
}

function isTlsErrorCode (code: unknown): boolean {
  return code === 'ERR_TLS_CERT_ALTNAME_INVALID' ||
    code === 'SELF_SIGNED_CERT_IN_CHAIN' ||
    code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
    code === 'DEPTH_ZERO_SELF_SIGNED_CERT'
}

function parseUsableBaseUrl (value: string, policy: TransportPolicy): { baseUrl: string } | null {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return null
  }

  if (url.protocol === 'http:' && !policy.insecure) {
    return null
  }

  if (url.username !== '' || url.password !== '' || url.search !== '' || url.hash !== '') {
    return null
  }

  if (url.pathname !== '' && url.pathname !== '/' && (!url.pathname.startsWith('/') || url.pathname.endsWith('/'))) {
    return null
  }

  const pathSuffix = url.pathname === '/' ? '' : url.pathname
  return {
    baseUrl: `${url.protocol}//${url.host}${pathSuffix}`
  }
}

function rootPageUrl (baseUrl: string, pageId: string): URL {
  return new URL(`${baseUrl}/rest/api/content/${pageId}`)
}

function currentUserUrl (baseUrl: string): URL {
  return new URL(`${baseUrl}/rest/api/user/current`)
}

function childPagesUrl (baseUrl: string, pageId: string): URL {
  return new URL(`${baseUrl}/rest/api/content/${pageId}/child/page?limit=200&expand=space`)
}

function pageStorageUrl (baseUrl: string, pageId: string): URL {
  return new URL(`${baseUrl}/rest/api/content/${pageId}?expand=body.storage`)
}

function attachmentPreviewUrl (baseUrl: string, pageId: string): URL {
  return new URL(`${baseUrl}/rest/api/content/${pageId}/child/attachment?limit=200`)
}

function titleCandidatesUrl (baseUrl: string, discovery: TitleDiscovery): URL {
  const url = new URL(`${baseUrl}/rest/api/content`)
  url.searchParams.set('type', 'page')
  url.searchParams.set('title', discovery.title)
  if (typeof discovery.spaceKey === 'string') {
    url.searchParams.set('spaceKey', discovery.spaceKey)
  }
  url.searchParams.set('limit', '200')
  url.searchParams.set('expand', 'space')
  return url
}

function get (
  url: URL,
  authorization: string,
  policy: TransportPolicy = DEFAULT_TRANSPORT_POLICY,
  limits: RequestLimits = DEFAULT_REQUEST_LIMITS
): Promise<HttpResponse> {
  const client = url.protocol === 'https:' ? https : http

  return new Promise((resolve, reject) => {
    let settled = false
    const fail = (error: Error): void => {
      if (settled) {
        return
      }
      settled = true
      request.destroy(error)
      reject(error)
    }
    const request = client.request(url, {
      method: 'GET',
      rejectUnauthorized: !policy.insecure,
      headers: {
        authorization
      }
    }, response => {
      const chunks: Buffer[] = []
      let bufferedBytes = 0
      response.on('data', (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        bufferedBytes += buffer.length
        if (bufferedBytes > limits.maxBufferedBytes) {
          fail(Object.assign(new Error('remote response exceeded byte cap'), { code: 'EREMOTE_RESPONSE_TOO_LARGE' }))
          return
        }
        chunks.push(buffer)
      })
      response.on('error', fail)
      response.on('end', () => {
        if (settled) {
          return
        }
        settled = true
        resolve({
          statusCode: response.statusCode,
          chunks
        })
      })
    })

    request.on('error', fail)
    request.setTimeout(limits.timeoutMs, () => {
      fail(Object.assign(new Error('remote request timed out'), { code: 'ETIMEDOUT' }))
    })
    request.end()
  })
}

function decodeBodyText (chunks: Buffer[]): string {
  return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))
}

function parseJson (text: string): unknown {
  return JSON.parse(text) as unknown
}

function isCanonicalPageId (value: string): boolean {
  return /^(0|[1-9][0-9]*)$/.test(value)
}

function isPageRef (value: unknown): value is PageRef {
  return isRecord(value) && typeof value.page_id === 'string' && isCanonicalPageId(value.page_id)
}

function isUsableTitleDiscovery (discovery: unknown): discovery is TitleDiscovery {
  return isRecord(discovery) &&
    typeof discovery.title === 'string' &&
    discovery.title !== '' &&
    (discovery.spaceKey === undefined || (typeof discovery.spaceKey === 'string' && discovery.spaceKey !== ''))
}

function isDownloadableAttachment (value: unknown): value is DownloadableAttachment {
  return isRecord(value) && typeof value.downloadUrl === 'string'
}

function extractPageMetadata (body: unknown): PageMetadata | null {
  if (!isRecord(body) || typeof body.id !== 'string' || typeof body.title !== 'string' || body.title === '') {
    return null
  }

  const spaceKey = isRecord(body.space) && typeof body.space.key === 'string' && body.space.key !== ''
    ? body.space.key
    : undefined

  return {
    page_id: body.id,
    page_title: body.title,
    ...(spaceKey === undefined ? {} : { space_key: spaceKey })
  }
}

function attachmentPreviewText (results: unknown[]): string {
  return [
    `attachment_count=${results.length}`,
    ...results.map(result => `source_filename=${attachmentSourceFilename(result)}`),
    ''
  ].join('\n')
}

function attachmentDataItem (result: unknown): AttachmentDataItem | null {
  if (!isRecord(result) || typeof result.title !== 'string' || result.title === '' || !isRecord(result._links)) {
    return null
  }

  const download = result._links.download
  if (typeof download !== 'string' || download === '') {
    return null
  }

  const downloadUrl = attachmentDownloadPathAndQuery(download)
  if (downloadUrl === null) {
    return null
  }

  return {
    filename: singleLine(result.title),
    downloadUrl
  }
}

function attachmentDownloadPathAndQuery (download: string): string | null {
  if (download === '' || !download.startsWith('/') || download.startsWith('//') || download.includes('#')) {
    return null
  }
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(download)) {
    return null
  }
  const pathPart = download.split('?', 1)[0]
  if (pathPart === undefined || hasTraversalSegment(pathPart)) {
    return null
  }

  return download
}

function governedAttachmentDownloadUrl (baseUrl: string, downloadUrl: string): URL | null {
  let base: URL
  let url: URL
  try {
    base = new URL(baseUrl)
    url = new URL(`${baseUrl}${downloadUrl}`)
  } catch {
    return null
  }
  if (url.origin !== base.origin || url.username !== '' || url.password !== '' || url.hash !== '') {
    return null
  }
  const prefix = base.pathname === '/' ? '' : base.pathname
  if (prefix !== '' && url.pathname !== prefix && !url.pathname.startsWith(`${prefix}/`)) {
    return null
  }
  if (hasTraversalSegment(url.pathname)) {
    return null
  }
  return url
}

function hasTraversalSegment (pathValue: string): boolean {
  for (const segment of pathValue.split('/')) {
    let decoded: string
    try {
      decoded = decodeURIComponent(segment)
    } catch {
      return true
    }
    if (decoded === '.' || decoded === '..') {
      return true
    }
  }
  return false
}

function attachmentSourceFilename (result: unknown): string {
  if (isRecord(result) && typeof result.title === 'string' && result.title !== '') {
    return singleLine(result.title)
  }
  return 'none'
}

function singleLine (value: string): string {
  return value.replace(/[\t\n\r]/g, ' ')
}

function hasNextLink (body: unknown): boolean {
  return isRecord(body) &&
    isRecord(body._links) &&
    typeof body._links.next === 'string' &&
    body._links.next !== ''
}

function isRecord (value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
