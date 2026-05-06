'use strict'

const http = require('node:http')
const https = require('node:https')
const { TextDecoder } = require('node:util')

function createSelftestConfluenceClient (options = {}) {
  const baseUrl = normalizeBaseUrl(requiredString(options, 'baseUrl'))
  const username = requiredString(options, 'username')
  const password = requiredString(options, 'password')
  const authorization = `Basic ${Buffer.from(`${username}:${password}`, 'utf8').toString('base64')}`

  return {
    async readSpaces (request) {
      const query = new URLSearchParams()
      query.set('limit', String(request.limit))
      const response = await requestRaw(baseUrl, authorization, 'GET', `/rest/api/space?${query.toString()}`, {})
      const body = parseSuccessfulJsonObject(response)
      if (!Array.isArray(body.results)) {
        throw new Error('invalid spaces response')
      }

      return body.results.map(result => ({
        spaceKey: stringProperty(result, 'key'),
        spaceName: stringProperty(result, 'name')
      }))
    },

    async applySpace (space) {
      const response = await requestJson(baseUrl, authorization, 'POST', '/rest/api/space', {
        key: space.key,
        name: space.name
      })
      const body = parseSuccessfulJsonObject(response)
      return {
        spaceKey: stringProperty(body, 'key'),
        spaceName: stringProperty(body, 'name')
      }
    },

    async applyPage (page) {
      const payload = {
        type: 'page',
        title: page.title,
        space: { key: page.spaceKey },
        body: {
          storage: {
            value: page.bodyStorage,
            representation: 'storage'
          }
        }
      }

      if (page.parentId !== null && page.parentId !== undefined) {
        payload.ancestors = [{ id: String(page.parentId) }]
      }

      const response = await requestJson(baseUrl, authorization, 'POST', '/rest/api/content', payload)
      const body = parseSuccessfulJsonObject(response)
      return {
        pageId: stringProperty(body, 'id')
      }
    },

    async applyAttachment (attachment) {
      const response = await requestMultipart(baseUrl, authorization, `/rest/api/content/${encodeURIComponent(attachment.pageId)}/child/attachment`, {
        filename: attachment.filename,
        mediaType: attachment.mediaType || 'application/octet-stream',
        bytes: attachment.bytes
      })
      parseSuccessfulJsonObject(response)
      return {
        filename: attachment.filename
      }
    },

    async readSpace (space) {
      const response = await requestRaw(baseUrl, authorization, 'GET', `/rest/api/space/${encodeURIComponent(space.spaceKey)}`, {})
      const body = parseSuccessfulJsonObject(response)
      return {
        spaceKey: stringProperty(body, 'key'),
        spaceName: stringProperty(body, 'name')
      }
    },

    async readPage (page) {
      const query = new URLSearchParams()
      query.set('expand', 'space,ancestors,body.storage')
      const response = await requestRaw(baseUrl, authorization, 'GET', `/rest/api/content/${encodeURIComponent(page.pageId)}?${query.toString()}`, {})
      const body = parseSuccessfulJsonObject(response)
      return {
        pageId: stringProperty(body, 'id'),
        title: stringProperty(body, 'title'),
        spaceKey: stringProperty(objectProperty(body, 'space'), 'key'),
        parentId: parentIdFromAncestors(body.ancestors),
        bodyStorage: stringProperty(objectProperty(objectProperty(body, 'body'), 'storage'), 'value')
      }
    },

    async readAttachment (attachment) {
      const query = new URLSearchParams()
      query.set('limit', '200')
      query.set('filename', attachment.filename)
      const response = await requestRaw(baseUrl, authorization, 'GET', `/rest/api/content/${encodeURIComponent(attachment.pageId)}/child/attachment?${query.toString()}`, {})
      const body = parseSuccessfulJsonObject(response)
      if (!Array.isArray(body.results)) {
        throw new Error('invalid attachment response')
      }

      const result = body.results.find(item => item !== null && typeof item === 'object' && item.title === attachment.filename)
      if (result === undefined || result._links === null || typeof result._links !== 'object' || typeof result._links.download !== 'string') {
        throw new Error('attachment missing download link')
      }

      const payload = await requestAbsoluteDownload(baseUrl, authorization, result._links.download)
      if (!isSuccessful(payload.statusCode)) {
        throw new Error('attachment download failed')
      }

      return {
        pageId: attachment.pageId,
        filename: attachment.filename,
        bytes: payload.body
      }
    }
  }
}

function requiredString (options, key) {
  if (typeof options[key] !== 'string' || options[key] === '') {
    throw new Error(`missing Confluence client option: ${key}`)
  }

  return options[key]
}

function normalizeBaseUrl (value) {
  return String(value).replace(/\/+$/, '')
}

function requestJson (baseUrl, authorization, method, suffix, payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8')
  return requestRaw(baseUrl, authorization, method, suffix, {
    accept: 'application/json',
    'content-type': 'application/json',
    'content-length': String(body.length)
  }, body)
}

function requestMultipart (baseUrl, authorization, suffix, attachment) {
  const boundary = 'confluex-selftest-boundary'
  const head = Buffer.from([
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${multipartToken(attachment.filename)}"`,
    `Content-Type: ${attachment.mediaType}`,
    '',
    ''
  ].join('\r\n'), 'utf8')
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8')
  const body = Buffer.concat([head, Buffer.from(attachment.bytes), tail])

  return requestRaw(baseUrl, authorization, 'POST', suffix, {
    accept: 'application/json',
    'x-atlassian-token': 'no-check',
    'content-type': `multipart/form-data; boundary=${boundary}`,
    'content-length': String(body.length)
  }, body)
}

function requestAbsoluteDownload (baseUrl, authorization, downloadPath) {
  const base = new URL(baseUrl)
  const url = new URL(downloadPath, base.origin)
  return requestUrl(url, authorization, 'GET', {}, null)
}

function requestRaw (baseUrl, authorization, method, suffix, headers, body = null) {
  const url = new URL(`${baseUrl}${suffix}`)
  return requestUrl(url, authorization, method, headers, body)
}

function requestUrl (url, authorization, method, headers, body) {
  const client = url.protocol === 'https:' ? https : http

  return new Promise((resolve, reject) => {
    const request = client.request(url, {
      method,
      headers: {
        authorization,
        ...headers
      }
    }, response => {
      const chunks = []
      response.on('data', chunk => chunks.push(chunk))
      response.on('end', () => resolve({
        statusCode: response.statusCode,
        body: Buffer.concat(chunks)
      }))
    })

    request.on('error', reject)
    if (body !== null) {
      request.write(body)
    }
    request.end()
  })
}

function parseSuccessfulJsonObject (response) {
  if (!isSuccessful(response.statusCode)) {
    throw new Error('request failed')
  }

  const body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(response.body))
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('response is not object')
  }

  return body
}

function isSuccessful (statusCode) {
  return typeof statusCode === 'number' && statusCode >= 200 && statusCode <= 299
}

function stringProperty (object, key) {
  if (typeof object[key] !== 'string' || object[key] === '') {
    throw new Error(`missing string property: ${key}`)
  }

  return object[key]
}

function objectProperty (object, key) {
  if (object[key] === null || typeof object[key] !== 'object' || Array.isArray(object[key])) {
    throw new Error(`missing object property: ${key}`)
  }

  return object[key]
}

function parentIdFromAncestors (ancestors) {
  if (!Array.isArray(ancestors) || ancestors.length === 0) {
    return null
  }

  const parent = ancestors[ancestors.length - 1]
  return stringProperty(parent, 'id')
}

function multipartToken (value) {
  if (/["\r\n]/.test(value)) {
    throw new Error('unsupported multipart token')
  }

  return value
}

module.exports = {
  createSelftestConfluenceClient
}
