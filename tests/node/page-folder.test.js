'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { pagePayloadFolder } = require('../../dist/confluex-node/output/page-folder')

test('pagePayloadFolder serializes space key bytes and page id', () => {
  assert.equal(pagePayloadFolder({ pageId: '123', spaceKey: 'CX' }), 'pages/space__4358/page__123')
  assert.equal(pagePayloadFolder({ pageId: '123', spaceKey: 'AUX' }), 'pages/space__415558/page__123')
})

test('pagePayloadFolder uses _no_space when space key is absent or empty', () => {
  assert.equal(pagePayloadFolder({ pageId: '123' }), 'pages/_no_space/page__123')
  assert.equal(pagePayloadFolder({ pageId: '123', spaceKey: '' }), 'pages/_no_space/page__123')
})

test('pagePayloadFolder rejects non-canonical page ids and overlong segments', () => {
  assert.throws(() => pagePayloadFolder({ pageId: '001', spaceKey: 'CX' }), /pageId/)
  assert.throws(() => pagePayloadFolder({ pageId: '123', spaceKey: 'x'.repeat(121) }), /space segment/)
})
