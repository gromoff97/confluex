'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const {
  localizeMarkdownPayload
} = require('../../lib/confluex-node/payload/markdown-localizer')

function localizationInput (overrides = {}) {
  return {
    payload: [
      '# Root',
      '',
      '[CX Child](/pages/viewpage.action?pageId=456)',
      '[AUX Cross Space](/display/AUX/AUX+Cross+Space#deep-link)',
      '[root-note.txt](attachments/root-note.txt)',
      '![](attachments/overview-chart.png)',
      '[Missing Root Page](/pages/viewpage.action?pageId=999999999)',
      '[Missing Linked Target 404](/display/CX/Missing+Linked+Target+404)',
      '[external](https://example.invalid/docs)',
      '',
      '`/pages/viewpage.action?pageId=456`',
      '',
      '```md',
      '[Code Link](/display/CX/CX+Child)',
      '```',
      ''
    ].join('\n'),
    sourcePageId: '123',
    sourceSpaceKey: 'CX',
    sourceFolder: 'pages/space__4358/page__123',
    baseUrl: 'http://localhost:8090',
    resolvedLinkRows: [
      {
        source_page_id: '123',
        source_title: 'Root',
        link_kind: 'href_page_id',
        raw_link_value: 'page_id:456',
        target_page_id: '456',
        target_space_key: 'CX',
        target_title: 'CX Child'
      },
      {
        source_page_id: '123',
        source_title: 'Root',
        link_kind: 'href_space_title',
        raw_link_value: 'space_key_present=1;space_key_bytes=3;space_key=AUX;title_bytes=15;title=AUX Cross Space',
        target_page_id: '789',
        target_space_key: 'AUX',
        target_title: 'AUX Cross Space'
      }
    ],
    unresolvedLinkRows: [
      {
        source_page_id: '123',
        source_title: 'Root',
        link_kind: 'href_page_id',
        raw_link_value: 'page_id:999999999',
        resolution_reason: 'not_found'
      },
      {
        source_page_id: '123',
        source_title: 'Root',
        link_kind: 'href_space_title',
        raw_link_value: 'space_key_present=1;space_key_bytes=2;space_key=CX;title_bytes=25;title=Missing Linked Target 404',
        resolution_reason: 'candidate_limit'
      }
    ],
    pageFoldersByPageId: new Map([
      ['123', 'pages/space__4358/page__123'],
      ['456', 'pages/space__4358/page__456'],
      ['789', 'pages/space__415558/page__789']
    ]),
    exportedPageFoldersByTargetKey: new Map([
      ['page_id:123', 'pages/space__4358/page__123'],
      ['page_id:456', 'pages/space__4358/page__456'],
      ['page_id:789', 'pages/space__415558/page__789'],
      ['space_key_present=1;space_key_bytes=2;space_key=CX;title_bytes=8;title=CX Child', 'pages/space__4358/page__456'],
      ['space_key_present=1;space_key_bytes=3;space_key=AUX;title_bytes=15;title=AUX Cross Space', 'pages/space__415558/page__789']
    ]),
    ...overrides
  }
}

test('localizeMarkdownPayload rewrites supported internal page links to local markdown files', async () => {
  const result = await localizeMarkdownPayload(localizationInput())

  assert.equal(result.payload.includes('[CX Child](../page__456/page.md)'), true)
  assert.equal(result.payload.includes('[AUX Cross Space](../../space__415558/page__789/page.md#deep-link)'), true)
})

test('localizeMarkdownPayload treats same-space display links as equivalent to title rows without explicit space key', async () => {
  const result = await localizeMarkdownPayload(localizationInput({
    payload: '[CX Child](/display/CX/CX+Child)\n',
    resolvedLinkRows: [
      {
        source_page_id: '123',
        source_title: 'Root',
        link_kind: 'page_ref',
        raw_link_value: 'space_key_present=0;space_key_bytes=0;space_key=;title_bytes=8;title=CX Child',
        target_page_id: '456',
        target_space_key: 'CX',
        target_title: 'CX Child'
      }
    ],
    unresolvedLinkRows: []
  }))

  assert.equal(result.payload, '[CX Child](../page__456/page.md)\n')
})

test('localizeMarkdownPayload rewrites display links when discovery resolved the target through content id', async () => {
  const result = await localizeMarkdownPayload(localizationInput({
    payload: '[CX Linked](/display/CX/CX+Linked)\n',
    resolvedLinkRows: [
      {
        source_page_id: '123',
        source_title: 'Root',
        link_kind: 'content_id',
        raw_link_value: 'page_id:789',
        target_page_id: '789',
        target_space_key: 'CX',
        target_title: 'CX Linked'
      }
    ],
    unresolvedLinkRows: [],
    pageFoldersByPageId: new Map([
      ['123', 'pages/space__4358/page__123'],
      ['789', 'pages/space__4358/page__789']
    ])
  }))

  assert.equal(result.payload, '[CX Linked](../page__789/page.md)\n')
})

test('localizeMarkdownPayload rewrites page-id destinations when discovery resolved the target through title matching', async () => {
  const result = await localizeMarkdownPayload(localizationInput({
    payload: '[Русская страница — черновик](/pages/viewpage.action?pageId=789)\n',
    resolvedLinkRows: [
      {
        source_page_id: '123',
        source_title: 'Root',
        link_kind: 'page_ref',
        raw_link_value: 'space_key_present=0;space_key_bytes=0;space_key=;title_bytes=52;title=Русская страница — черновик',
        target_page_id: '789',
        target_space_key: 'CX',
        target_title: 'Русская страница — черновик'
      }
    ],
    unresolvedLinkRows: [],
    pageFoldersByPageId: new Map([
      ['123', 'pages/space__4358/page__123'],
      ['789', 'pages/space__4358/page__789']
    ])
  }))

  assert.equal(result.payload, '[Русская страница — черновик](../page__789/page.md)\n')
})

test('localizeMarkdownPayload rewrites exported page links even when the source page has no resolved row for that target', async () => {
  const result = await localizeMarkdownPayload(localizationInput({
    payload: '[CX Linked Scope Linked](/display/CX/CX+Linked+Scope+Linked)\n',
    resolvedLinkRows: [],
    unresolvedLinkRows: [],
    exportedPageFoldersByTargetKey: new Map([
      ['page_id:610', 'pages/space__4358/page__610'],
      ['space_key_present=1;space_key_bytes=2;space_key=CX;title_bytes=22;title=CX Linked Scope Linked', 'pages/space__4358/page__610']
    ])
  }))

  assert.equal(result.payload, '[CX Linked Scope Linked](../page__610/page.md)\n')
})

test('localizeMarkdownPayload keeps source-specific unresolved markers ahead of global exported-page fallback', async () => {
  const result = await localizeMarkdownPayload(localizationInput({
    payload: '[Shared Fixture Title](/display/CX/Shared+Fixture+Title)\n',
    resolvedLinkRows: [],
    unresolvedLinkRows: [
      {
        source_page_id: '123',
        source_title: 'Root',
        link_kind: 'page_ref',
        raw_link_value: 'space_key_present=0;space_key_bytes=0;space_key=;title_bytes=20;title=Shared Fixture Title',
        resolution_reason: 'not_unique'
      }
    ],
    exportedPageFoldersByTargetKey: new Map([
      ['space_key_present=1;space_key_bytes=2;space_key=CX;title_bytes=20;title=Shared Fixture Title', 'pages/space__4358/page__901']
    ])
  }))

  assert.equal(
    result.payload,
    'Shared Fixture Title [unresolved: page; reason=not_unique; target_hint=title; value="CX:Shared Fixture Title"]\n'
  )
})

test('localizeMarkdownPayload preserves local attachment links and embeds', async () => {
  const result = await localizeMarkdownPayload(localizationInput())

  assert.equal(result.payload.includes('[root-note.txt](attachments/root-note.txt)'), true)
  assert.equal(result.payload.includes('![](attachments/overview-chart.png)'), true)
})

test('localizeMarkdownPayload emits inline unresolved markers for page-id and title targets', async () => {
  const result = await localizeMarkdownPayload(localizationInput())

  assert.equal(
    result.payload.includes('Missing Root Page [unresolved: page; reason=not_found; target_hint=page_id; value="999999999"]'),
    true
  )
  assert.equal(
    result.payload.includes('Missing Linked Target 404 [unresolved: page; reason=candidate_limit; target_hint=title; value="CX:Missing Linked Target 404"]'),
    true
  )
})

test('localizeMarkdownPayload leaves external links and code literals untouched', async () => {
  const result = await localizeMarkdownPayload(localizationInput())

  assert.equal(result.payload.includes('[external](https://example.invalid/docs)'), true)
  assert.equal(result.payload.includes('`/pages/viewpage.action?pageId=456`'), true)
  assert.equal(result.payload.includes('[Code Link](/display/CX/CX+Child)'), true)
})
