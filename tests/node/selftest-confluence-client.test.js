'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')

const { createSelftestConfluenceClient } = require('../../lib/confluex-node/selftest/confluence-client')

async function withServer (handler, run) {
  const server = http.createServer(handler)
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    const { port } = server.address()
    return await run(`http://127.0.0.1:${port}`)
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
}

function readRequestBody (request) {
  return new Promise(resolve => {
    const chunks = []
    request.on('data', chunk => chunks.push(chunk))
    request.on('end', () => resolve(Buffer.concat(chunks)))
  })
}

function jsonResponse (response, statusCode, body) {
  response.statusCode = statusCode
  response.setHeader('content-type', 'application/json')
  response.end(JSON.stringify(body))
}

test('selftest Confluence client applies fixture spaces pages and attachments through REST', async () => {
  const requests = []

  await withServer(async (request, response) => {
    const body = await readRequestBody(request)
    requests.push({
      method: request.method,
      url: request.url,
      authorization: request.headers.authorization,
      token: request.headers['x-atlassian-token'],
      contentType: request.headers['content-type'],
      body
    })

    if (request.url === '/confluence/rest/api/space') {
      jsonResponse(response, 200, { key: 'CX', name: 'Confluex Fixture Space' })
      return
    }

    if (request.url === '/confluence/rest/api/content') {
      jsonResponse(response, 200, { id: '123' })
      return
    }

    if (request.url === '/confluence/rest/api/content/123/child/attachment') {
      jsonResponse(response, 200, { results: [{ title: 'root-note.txt' }] })
      return
    }

    response.statusCode = 404
    response.end('missing')
  }, async baseUrl => {
    const client = createSelftestConfluenceClient({
      baseUrl: `${baseUrl}/confluence`,
      username: 'admin',
      password: 'admin'
    })

    assert.deepEqual(await client.applySpace({
      key: 'CX',
      name: 'Confluex Fixture Space'
    }), {
      spaceKey: 'CX',
      spaceName: 'Confluex Fixture Space'
    })

    assert.deepEqual(await client.applyPage({
      spaceKey: 'CX',
      title: 'CX Root',
      parentId: '42',
      bodyStorage: '<p>Root</p>'
    }), {
      pageId: '123'
    })

    await client.applyAttachment({
      pageId: '123',
      filename: 'root-note.txt',
      mediaType: 'text/plain',
      bytes: Buffer.from('root attachment fixture\n', 'utf8')
    })
  })

  assert.equal(requests.length, 3)
  assert.equal(requests[0].method, 'POST')
  assert.equal(requests[0].url, '/confluence/rest/api/space')
  assert.equal(requests[0].authorization, `Basic ${Buffer.from('admin:admin', 'utf8').toString('base64')}`)
  assert.deepEqual(JSON.parse(requests[0].body.toString('utf8')), {
    key: 'CX',
    name: 'Confluex Fixture Space'
  })
  assert.deepEqual(JSON.parse(requests[1].body.toString('utf8')), {
    type: 'page',
    title: 'CX Root',
    space: { key: 'CX' },
    ancestors: [{ id: '42' }],
    body: {
      storage: {
        value: '<p>Root</p>',
        representation: 'storage'
      }
    }
  })
  assert.equal(requests[2].method, 'POST')
  assert.equal(requests[2].url, '/confluence/rest/api/content/123/child/attachment')
  assert.equal(requests[2].token, 'no-check')
  assert.match(requests[2].contentType, /^multipart\/form-data; boundary=/)
  assert.match(requests[2].body.toString('utf8'), /name="file"; filename="root-note.txt"/)
  assert.match(requests[2].body.toString('utf8'), /root attachment fixture/)
})

test('selftest Confluence client reads spaces pages and attachment payloads through REST', async () => {
  const requests = []

  await withServer(async (request, response) => {
    await readRequestBody(request)
    requests.push({
      method: request.method,
      url: request.url,
      authorization: request.headers.authorization
    })

    if (request.url === '/confluence/rest/api/space/CX') {
      jsonResponse(response, 200, { key: 'CX', name: 'Confluex Fixture Space' })
      return
    }

    if (request.url === '/confluence/rest/api/content/123?expand=space%2Cancestors%2Cbody.storage') {
      jsonResponse(response, 200, {
        id: '123',
        title: 'CX Root',
        space: { key: 'CX' },
        ancestors: [{ id: '42' }],
        body: {
          storage: {
            value: '<p>Root</p>'
          }
        }
      })
      return
    }

    if (request.url === '/confluence/rest/api/content/123/child/attachment?limit=200&filename=root-note.txt') {
      jsonResponse(response, 200, {
        results: [{
          title: 'root-note.txt',
          _links: {
            download: '/confluence/download/attachments/123/root-note.txt'
          }
        }]
      })
      return
    }

    if (request.url === '/confluence/download/attachments/123/root-note.txt') {
      response.end('root attachment fixture\n')
      return
    }

    response.statusCode = 404
    response.end('missing')
  }, async baseUrl => {
    const client = createSelftestConfluenceClient({
      baseUrl: `${baseUrl}/confluence`,
      username: 'admin',
      password: 'admin'
    })

    assert.deepEqual(await client.readSpace({ spaceKey: 'CX' }), {
      spaceKey: 'CX',
      spaceName: 'Confluex Fixture Space'
    })
    assert.deepEqual(await client.readPage({ pageId: '123' }), {
      pageId: '123',
      title: 'CX Root',
      spaceKey: 'CX',
      parentId: '42',
      bodyStorage: '<p>Root</p>'
    })
    assert.deepEqual(await client.readAttachment({
      pageId: '123',
      filename: 'root-note.txt'
    }), {
      pageId: '123',
      filename: 'root-note.txt',
      bytes: Buffer.from('root attachment fixture\n', 'utf8')
    })
  })

  assert.deepEqual(requests.map(request => [request.method, request.url]), [
    ['GET', '/confluence/rest/api/space/CX'],
    ['GET', '/confluence/rest/api/content/123?expand=space%2Cancestors%2Cbody.storage'],
    ['GET', '/confluence/rest/api/content/123/child/attachment?limit=200&filename=root-note.txt'],
    ['GET', '/confluence/download/attachments/123/root-note.txt']
  ])
})

test('selftest Confluence client reads space listing through REST', async () => {
  const requests = []

  await withServer(async (request, response) => {
    await readRequestBody(request)
    requests.push({
      method: request.method,
      url: request.url,
      authorization: request.headers.authorization
    })

    if (request.url === '/confluence/rest/api/space?limit=1') {
      jsonResponse(response, 200, {
        results: [{ key: 'SANDBOX', name: 'Sandbox' }]
      })
      return
    }

    response.statusCode = 404
    response.end('missing')
  }, async baseUrl => {
    const client = createSelftestConfluenceClient({
      baseUrl: `${baseUrl}/confluence`,
      username: 'admin',
      password: 'admin'
    })

    assert.deepEqual(await client.readSpaces({ limit: 1 }), [{
      spaceKey: 'SANDBOX',
      spaceName: 'Sandbox'
    }])
  })

  assert.deepEqual(requests, [{
    method: 'GET',
    url: '/confluence/rest/api/space?limit=1',
    authorization: `Basic ${Buffer.from('admin:admin', 'utf8').toString('base64')}`
  }])
})
