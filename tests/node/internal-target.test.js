'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const {
  localPathFromFolderPair,
  normalizedTargetKeyFromMarkdownDestination,
  normalizedTargetKeyFromResolvedRow,
  normalizedTargetKeyFromUnresolvedRow
} = require('../../lib/confluex-node/links/internal-target')

test('normalizedTargetKeyFromMarkdownDestination resolves page-id destinations', () => {
  assert.deepEqual(
    normalizedTargetKeyFromMarkdownDestination('/pages/viewpage.action?pageId=456'),
    {
      targetKey: 'page_id:456',
      fragment: ''
    }
  )
})

test('normalizedTargetKeyFromMarkdownDestination resolves space-title destinations', () => {
  assert.deepEqual(
    normalizedTargetKeyFromMarkdownDestination('/display/CX/Linked+Page'),
    {
      targetKey: 'space_key_present=1;space_key_bytes=2;space_key=CX;title_bytes=11;title=Linked Page',
      fragment: ''
    }
  )
})

test('normalizedTargetKeyFromMarkdownDestination resolves same-base absolute destinations and preserves fragments', () => {
  assert.deepEqual(
    normalizedTargetKeyFromMarkdownDestination('http://localhost:8090/display/CX/Linked+Page#section-anchor', {
      baseUrl: 'http://localhost:8090'
    }),
    {
      targetKey: 'space_key_present=1;space_key_bytes=2;space_key=CX;title_bytes=11;title=Linked Page',
      fragment: 'section-anchor'
    }
  )
})

test('resolved and unresolved rows collapse to the same normalized target key', () => {
  const resolved = {
    source_page_id: '123',
    source_title: 'Root Page',
    link_kind: 'href_space_title',
    raw_link_value: 'space_key_present=1;space_key_bytes=2;space_key=CX;title_bytes=11;title=Linked Page',
    target_page_id: '456',
    target_space_key: 'CX',
    target_title: 'Linked Page'
  }
  const unresolved = {
    source_page_id: '123',
    source_title: 'Root Page',
    link_kind: 'page_ref',
    raw_link_value: 'space_key_present=1;space_key_bytes=2;space_key=CX;title_bytes=11;title=Linked Page',
    resolution_reason: 'not_found'
  }

  assert.equal(
    normalizedTargetKeyFromResolvedRow(resolved),
    'space_key_present=1;space_key_bytes=2;space_key=CX;title_bytes=11;title=Linked Page'
  )
  assert.equal(
    normalizedTargetKeyFromUnresolvedRow(unresolved),
    'space_key_present=1;space_key_bytes=2;space_key=CX;title_bytes=11;title=Linked Page'
  )
})

test('normalizedTargetKeyFromMarkdownDestination rejects malformed and external destinations', () => {
  assert.equal(normalizedTargetKeyFromMarkdownDestination('https://example.invalid/display/CX/Linked+Page', {
    baseUrl: 'http://localhost:8090'
  }), null)
  assert.equal(normalizedTargetKeyFromMarkdownDestination('mailto:test@example.com'), null)
  assert.equal(normalizedTargetKeyFromMarkdownDestination('/display/CX/%E0%A4%A'), null)
})

test('localPathFromFolderPair computes stable relative page payload paths', () => {
  assert.equal(
    localPathFromFolderPair('pages/space__4358/page__1001', 'pages/space__4358/page__1002'),
    '../page__1002/page.md'
  )
  assert.equal(
    localPathFromFolderPair('pages/space__4358/page__1001', 'pages/space__415558/page__2001'),
    '../../space__415558/page__2001/page.md'
  )
})
