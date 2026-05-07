'use strict'

const http = require('node:http')
const https = require('node:https')
const { TextDecoder } = require('node:util')

function resolveRemoteAccessContext (env = process.env) {
  const baseUrlValue = env.CONFLUEX_CONFLUENCE_BASE_URL
  const token = env.CONFLUEX_CONFLUENCE_TOKEN

  if (!validEnvironmentValue(baseUrlValue)) {
    return { usable: false, reason: 'missing_base_url' }
  }

  const parsed = parseUsableBaseUrl(baseUrlValue)
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
    authorization: `Bearer ${token}`
  }
}

async function checkRootPageAccess (pageId, env = process.env, dependencies = {}) {
  const context = resolveRemoteAccessContext(env)
  if (!context.usable) {
    return { state: 'failed', reason: context.reason }
  }

  try {
    const url = rootPageUrl(context.baseUrl, pageId)
    const request = dependencies.request || get
    const response = await request(url, context.authorization)
    if (response.statusCode !== 200) {
      return { state: 'failed', reason: classifyHttpFailure(response) }
    }

    const bodyBuffer = Buffer.concat(response.chunks)
    const bodyText = new TextDecoder('utf-8', { fatal: true }).decode(bodyBuffer)
    const body = JSON.parse(bodyText)
    if (body === null || typeof body !== 'object' || typeof body.id !== 'string' || !isCanonicalPageId(body.id)) {
      return { state: 'failed', reason: 'page_inaccessible' }
    }

    const result = {
      state: 'ok',
      identity: body.id,
      metadataBytes: Buffer.byteLength(bodyText, 'utf8')
    }
    const metadata = extractPageMetadata(body)
    if (metadata !== null) {
      result.metadata = metadata
    }
    return result
  } catch (error) {
    return { state: 'failed', reason: classifyTransportFailure(error) }
  }
}

async function listChildPages (page, env = process.env) {
  const context = resolveRemoteAccessContext(env)
  if (!context.usable || page === null || typeof page !== 'object' || !isCanonicalPageId(page.page_id)) {
    return { state: 'failed' }
  }

  try {
    const url = childPagesUrl(context.baseUrl, page.page_id)
    const response = await get(url, context.authorization)
    if (response.statusCode !== 200) {
      return { state: 'failed' }
    }

    const bodyBuffer = Buffer.concat(response.chunks)
    const bodyText = new TextDecoder('utf-8', { fatal: true }).decode(bodyBuffer)
    const body = JSON.parse(bodyText)
    if (body === null || typeof body !== 'object' || !Array.isArray(body.results)) {
      return { state: 'failed' }
    }

    const children = []
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

async function getPageStorageContent (page, env = process.env) {
  const context = resolveRemoteAccessContext(env)
  if (!context.usable || page === null || typeof page !== 'object' || !isCanonicalPageId(page.page_id)) {
    return { state: 'failed' }
  }

  try {
    const url = pageStorageUrl(context.baseUrl, page.page_id)
    const response = await get(url, context.authorization)
    if (response.statusCode !== 200) {
      return { state: 'failed' }
    }

    const bodyBuffer = Buffer.concat(response.chunks)
    const bodyText = new TextDecoder('utf-8', { fatal: true }).decode(bodyBuffer)
    const body = JSON.parse(bodyText)
    if (
      body === null ||
      typeof body !== 'object' ||
      body.id !== page.page_id ||
      body.body === null ||
      typeof body.body !== 'object' ||
      body.body.storage === null ||
      typeof body.body.storage !== 'object' ||
      typeof body.body.storage.value !== 'string'
    ) {
      return { state: 'failed' }
    }

    return {
      state: 'ok',
      storage: body.body.storage.value,
      metadataBytes: Buffer.byteLength(bodyText, 'utf8')
    }
  } catch {
    return { state: 'failed' }
  }
}

async function getAttachmentPreview (page, env = process.env) {
  const context = resolveRemoteAccessContext(env)
  if (!context.usable || page === null || typeof page !== 'object' || !isCanonicalPageId(page.page_id)) {
    return { state: 'failed' }
  }

  try {
    const url = attachmentPreviewUrl(context.baseUrl, page.page_id)
    const response = await get(url, context.authorization)
    if (response.statusCode !== 200) {
      return { state: 'failed' }
    }

    const bodyBuffer = Buffer.concat(response.chunks)
    const bodyText = new TextDecoder('utf-8', { fatal: true }).decode(bodyBuffer)
    const body = JSON.parse(bodyText)
    if (body === null || typeof body !== 'object' || !Array.isArray(body.results) || hasNextLink(body)) {
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

async function getAttachmentData (page, env = process.env) {
  const context = resolveRemoteAccessContext(env)
  if (!context.usable || page === null || typeof page !== 'object' || !isCanonicalPageId(page.page_id)) {
    return { state: 'failed' }
  }

  try {
    const url = attachmentPreviewUrl(context.baseUrl, page.page_id)
    const response = await get(url, context.authorization)
    if (response.statusCode !== 200) {
      return { state: 'failed' }
    }

    const bodyBuffer = Buffer.concat(response.chunks)
    const bodyText = new TextDecoder('utf-8', { fatal: true }).decode(bodyBuffer)
    const body = JSON.parse(bodyText)
    if (body === null || typeof body !== 'object' || !Array.isArray(body.results) || hasNextLink(body)) {
      return { state: 'failed' }
    }

    const items = []
    for (const result of body.results) {
      const item = attachmentDataItem(context.baseUrl, result)
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

async function downloadAttachmentPayload (attachment, env = process.env) {
  const context = resolveRemoteAccessContext(env)
  if (!context.usable || attachment === null || typeof attachment !== 'object' || typeof attachment.downloadUrl !== 'string') {
    return { state: 'failed' }
  }

  try {
    const url = new URL(attachment.downloadUrl)
    const response = await get(url, context.authorization)
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

async function findTitleCandidates (discovery, env = process.env) {
  const context = resolveRemoteAccessContext(env)
  if (!context.usable || !isUsableTitleDiscovery(discovery)) {
    return { state: 'failed' }
  }

  try {
    const url = titleCandidatesUrl(context.baseUrl, discovery)
    const response = await get(url, context.authorization)
    if (response.statusCode !== 200) {
      return { state: 'failed' }
    }

    const bodyText = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(response.chunks))
    const body = JSON.parse(bodyText)
    if (body === null || typeof body !== 'object' || !Array.isArray(body.results)) {
      return { state: 'failed' }
    }

    const candidates = []
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

function validEnvironmentValue (value) {
  return typeof value === 'string' && value !== '' && !/[\t\n\r]/.test(value)
}

function classifyHttpFailure (response) {
  if (response.statusCode === 401 || response.statusCode === 403) {
    return 'auth_rejected'
  }
  return 'page_inaccessible'
}

function classifyTransportFailure (error) {
  const code = error !== null && typeof error === 'object' ? error.code : undefined
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

function isTlsErrorCode (code) {
  return code === 'ERR_TLS_CERT_ALTNAME_INVALID' ||
    code === 'SELF_SIGNED_CERT_IN_CHAIN' ||
    code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
    code === 'DEPTH_ZERO_SELF_SIGNED_CERT'
}

function parseUsableBaseUrl (value) {
  let url
  try {
    url = new URL(value)
  } catch {
    return null
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
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

function rootPageUrl (baseUrl, pageId) {
  return new URL(`${baseUrl}/rest/api/content/${pageId}`)
}

function childPagesUrl (baseUrl, pageId) {
  return new URL(`${baseUrl}/rest/api/content/${pageId}/child/page?limit=200&expand=space`)
}

function pageStorageUrl (baseUrl, pageId) {
  return new URL(`${baseUrl}/rest/api/content/${pageId}?expand=body.storage`)
}

function attachmentPreviewUrl (baseUrl, pageId) {
  return new URL(`${baseUrl}/rest/api/content/${pageId}/child/attachment?limit=200`)
}

function titleCandidatesUrl (baseUrl, discovery) {
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

function get (url, authorization) {
  const client = url.protocol === 'https:' ? https : http

  return new Promise((resolve, reject) => {
    const request = client.request(url, {
      method: 'GET',
      headers: {
        authorization
      }
    }, response => {
      const chunks = []
      response.on('data', chunk => chunks.push(chunk))
      response.on('end', () => {
        resolve({
          statusCode: response.statusCode,
          chunks
        })
      })
    })

    request.on('error', reject)
    request.end()
  })
}

function isCanonicalPageId (value) {
  return /^(0|[1-9][0-9]*)$/.test(value)
}

function isUsableTitleDiscovery (discovery) {
  return discovery !== null &&
    typeof discovery === 'object' &&
    typeof discovery.title === 'string' &&
    discovery.title !== '' &&
    (discovery.spaceKey === undefined || (typeof discovery.spaceKey === 'string' && discovery.spaceKey !== ''))
}

function extractPageMetadata (body) {
  if (typeof body.title !== 'string' || body.title === '') {
    return null
  }

  const metadata = {
    page_id: body.id,
    page_title: body.title
  }

  if (body.space !== null && typeof body.space === 'object' && typeof body.space.key === 'string' && body.space.key !== '') {
    metadata.space_key = body.space.key
  }

  return metadata
}

function attachmentPreviewText (results) {
  return [
    `attachment_count=${results.length}`,
    ...results.map(result => `source_filename=${attachmentSourceFilename(result)}`),
    ''
  ].join('\n')
}

function attachmentDataItem (baseUrl, result) {
  if (
    result === null ||
    typeof result !== 'object' ||
    typeof result.title !== 'string' ||
    result.title === '' ||
    result._links === null ||
    typeof result._links !== 'object' ||
    typeof result._links.download !== 'string' ||
    result._links.download === ''
  ) {
    return null
  }
  return {
    filename: singleLine(result.title),
    downloadUrl: new URL(result._links.download, baseUrl).toString()
  }
}

function attachmentSourceFilename (result) {
  if (result !== null && typeof result === 'object' && typeof result.title === 'string' && result.title !== '') {
    return singleLine(result.title)
  }
  return 'none'
}

function singleLine (value) {
  return String(value).replace(/[\t\n\r]/g, ' ')
}

function hasNextLink (body) {
  return body._links !== null &&
    typeof body._links === 'object' &&
    typeof body._links.next === 'string' &&
    body._links.next !== ''
}

module.exports = {
  checkRootPageAccess,
  downloadAttachmentPayload,
  findTitleCandidates,
  getAttachmentData,
  getAttachmentPreview,
  getPageStorageContent,
  listChildPages,
  resolveRemoteAccessContext
}
