'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')

const {
  resolveRemoteAccessContext,
  checkRootPageAccess,
  downloadAttachmentPayload,
  listChildPages,
  getPageStorageContent,
  findTitleCandidates,
  getAttachmentData,
  getAttachmentPreview
} = require('../../lib/confluex-node/remote/access')

function envForBaseUrl (baseUrl) {
  return {
    CONFLUEX_CONFLUENCE_BASE_URL: baseUrl,
    CONFLUEX_CONFLUENCE_USERNAME: 'user',
    CONFLUEX_CONFLUENCE_PASSWORD: 'pass:word'
  }
}

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

test('remote access context validates base URL and basic auth', () => {
  assert.deepEqual(resolveRemoteAccessContext(envForBaseUrl('http://example.test/confluence')), {
    usable: true,
    baseUrl: 'http://example.test/confluence',
    authorization: `Basic ${Buffer.from('user:pass:word', 'utf8').toString('base64')}`
  })

  assert.deepEqual(resolveRemoteAccessContext(envForBaseUrl('http://user@example.test')), {
    usable: false
  })

  assert.deepEqual(resolveRemoteAccessContext({
    CONFLUEX_CONFLUENCE_BASE_URL: 'http://example.test',
    CONFLUEX_CONFLUENCE_USERNAME: 'bad:user',
    CONFLUEX_CONFLUENCE_PASSWORD: 'pass'
  }), {
    usable: false
  })
})

test('root page access composes base path and returns response id identity', async () => {
  const bodyText = JSON.stringify({
    id: '456',
    title: 'Root Page',
    space: { key: 'CX' }
  })

  await withServer((request, response) => {
    assert.equal(request.method, 'GET')
    assert.equal(request.url, '/confluence/rest/api/content/123')
    assert.equal(request.headers.authorization, `Basic ${Buffer.from('user:pass:word', 'utf8').toString('base64')}`)
    response.setHeader('content-type', 'application/json')
    response.end(bodyText)
  }, async baseUrl => {
    assert.deepEqual(await checkRootPageAccess('123', envForBaseUrl(`${baseUrl}/confluence`)), {
      state: 'ok',
      identity: '456',
      metadata: {
        page_id: '456',
        page_title: 'Root Page',
        space_key: 'CX'
      },
      metadataBytes: Buffer.byteLength(bodyText, 'utf8')
    })
  })
})

test('root page access fails for unusable context and invalid responses', async () => {
  assert.deepEqual(await checkRootPageAccess('123', {}), {
    state: 'failed'
  })

  await withServer((request, response) => {
    response.statusCode = 404
    response.end('missing')
  }, async baseUrl => {
    assert.deepEqual(await checkRootPageAccess('123', envForBaseUrl(baseUrl)), {
      state: 'failed'
    })
  })

  await withServer((request, response) => {
    response.end(JSON.stringify({ id: '001' }))
  }, async baseUrl => {
    assert.deepEqual(await checkRootPageAccess('123', envForBaseUrl(baseUrl)), {
      state: 'failed'
    })
  })
})

test('child page listing composes child endpoint and returns metadata with completeness', async () => {
  const bodyText = JSON.stringify({
    results: [
      {
        id: '456',
        title: 'Child Page',
        space: { key: 'CX' }
      }
    ],
    _links: {}
  })

  await withServer((request, response) => {
    assert.equal(request.method, 'GET')
    assert.equal(request.url, '/confluence/rest/api/content/123/child/page?limit=200&expand=space')
    assert.equal(request.headers.authorization, `Basic ${Buffer.from('user:pass:word', 'utf8').toString('base64')}`)
    response.setHeader('content-type', 'application/json')
    response.end(bodyText)
  }, async baseUrl => {
    assert.deepEqual(await listChildPages({ page_id: '123' }, envForBaseUrl(`${baseUrl}/confluence`)), {
      state: 'ok',
      complete: true,
      children: [
        {
          page_id: '456',
          page_title: 'Child Page',
          space_key: 'CX'
        }
      ],
      metadataBytes: Buffer.byteLength(bodyText, 'utf8')
    })
  })
})

test('page storage acquisition composes storage endpoint and returns storage value', async () => {
  const bodyText = JSON.stringify({
    id: '123',
    body: {
      storage: {
        value: '<p>No links here.</p>'
      }
    }
  })

  await withServer((request, response) => {
    assert.equal(request.method, 'GET')
    assert.equal(request.url, '/confluence/rest/api/content/123?expand=body.storage')
    assert.equal(request.headers.authorization, `Basic ${Buffer.from('user:pass:word', 'utf8').toString('base64')}`)
    response.setHeader('content-type', 'application/json')
    response.end(bodyText)
  }, async baseUrl => {
    assert.deepEqual(await getPageStorageContent({ page_id: '123' }, envForBaseUrl(`${baseUrl}/confluence`)), {
      state: 'ok',
      storage: '<p>No links here.</p>',
      metadataBytes: Buffer.byteLength(bodyText, 'utf8')
    })
  })
})

test('title candidate acquisition composes content search and returns candidates', async () => {
  const bodyText = JSON.stringify({
    results: [
      {
        id: '456',
        title: 'Linked Page',
        space: { key: 'CX' }
      }
    ],
    _links: {}
  })

  await withServer((request, response) => {
    assert.equal(request.method, 'GET')
    assert.equal(request.url, '/confluence/rest/api/content?type=page&title=Linked+Page&spaceKey=CX&limit=200&expand=space')
    assert.equal(request.headers.authorization, `Basic ${Buffer.from('user:pass:word', 'utf8').toString('base64')}`)
    response.setHeader('content-type', 'application/json')
    response.end(bodyText)
  }, async baseUrl => {
    assert.deepEqual(await findTitleCandidates({
      title: 'Linked Page',
      spaceKey: 'CX'
    }, envForBaseUrl(`${baseUrl}/confluence`)), {
      state: 'ok',
      complete: true,
      candidates: [
        {
          page_id: '456',
          page_title: 'Linked Page',
          space_key: 'CX'
        }
      ],
      metadataBytes: Buffer.byteLength(bodyText, 'utf8')
    })
  })
})

test('attachment preview acquisition composes attachment endpoint and returns count snapshot', async () => {
  const bodyText = JSON.stringify({
    results: [
      { title: 'one.txt' },
      { title: 'two.txt' }
    ],
    _links: {}
  })

  await withServer((request, response) => {
    assert.equal(request.method, 'GET')
    assert.equal(request.url, '/confluence/rest/api/content/123/child/attachment?limit=200')
    assert.equal(request.headers.authorization, `Basic ${Buffer.from('user:pass:word', 'utf8').toString('base64')}`)
    response.setHeader('content-type', 'application/json')
    response.end(bodyText)
  }, async baseUrl => {
    assert.deepEqual(await getAttachmentPreview({ page_id: '123' }, envForBaseUrl(`${baseUrl}/confluence`)), {
      state: 'ok',
      count: 2,
      preview: 'attachment_count=2\nsource_filename=one.txt\nsource_filename=two.txt\n',
      metadataBytes: Buffer.byteLength(bodyText, 'utf8')
    })
  })
})

test('attachment data and payload acquisition compose attachment and download endpoints', async () => {
  const bodyText = JSON.stringify({
    results: [
      {
        title: 'root-note.txt',
        _links: {
          download: '/confluence/download/attachments/123/root-note.txt'
        }
      }
    ],
    _links: {}
  })
  const payload = Buffer.from('attachment bytes')

  await withServer((request, response) => {
    assert.equal(request.method, 'GET')
    assert.equal(request.headers.authorization, `Basic ${Buffer.from('user:pass:word', 'utf8').toString('base64')}`)
    if (request.url === '/confluence/rest/api/content/123/child/attachment?limit=200') {
      response.setHeader('content-type', 'application/json')
      response.end(bodyText)
      return
    }
    if (request.url === '/confluence/download/attachments/123/root-note.txt') {
      response.end(payload)
      return
    }
    response.statusCode = 404
    response.end('missing')
  }, async baseUrl => {
    const data = await getAttachmentData({ page_id: '123' }, envForBaseUrl(`${baseUrl}/confluence`))
    assert.deepEqual(data, {
      state: 'ok',
      items: [
        {
          filename: 'root-note.txt',
          downloadUrl: `${baseUrl}/confluence/download/attachments/123/root-note.txt`
        }
      ],
      metadataBytes: Buffer.byteLength(bodyText, 'utf8')
    })

    assert.deepEqual(await downloadAttachmentPayload(data.items[0], envForBaseUrl(`${baseUrl}/confluence`)), {
      state: 'ok',
      bytes: payload
    })
  })
})
