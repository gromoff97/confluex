'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { parseInstallManifest, isGovernedRelativePath } = require('../../lib/confluex-node/lifecycle/manifest')

test('manifest parser accepts sorted governed relative paths with final LF', () => {
  const parsed = parseInstallManifest(Buffer.from('.confluex-install-manifest.txt\nconfluex\nlib/confluex-node\n', 'utf8'), '/tmp/target')

  assert.deepEqual(parsed, {
    valid: true,
    relativePaths: [
      '.confluex-install-manifest.txt',
      'confluex',
      'lib/confluex-node'
    ]
  })
})

test('manifest parser rejects invalid manifest text and path forms', () => {
  const invalidTexts = [
    '',
    'confluex',
    '\n',
    'confluex\n\n',
    'confluex\nconfluex\n',
    'lib/confluex-node\nconfluex\n',
    'has\ttab\n',
    'has\rcr\n',
    'has\u0000nul\n',
    '/absolute\n',
    'trailing/\n',
    'has//empty\n',
    './dot\n',
    '../dotdot\n',
    'has\\backslash\n',
    'has:colon\n'
  ]

  for (const text of invalidTexts) {
    assert.deepEqual(parseInstallManifest(Buffer.from(text, 'utf8'), '/tmp/target'), { valid: false }, text)
  }
})

test('manifest parser rejects invalid UTF-8 bytes', () => {
  assert.deepEqual(parseInstallManifest(Buffer.from([0x63, 0x6f, 0x80, 0x0a]), '/tmp/target'), { valid: false })
})

test('governed relative path helper accepts only FR-0150 segment strings', () => {
  assert.equal(isGovernedRelativePath('lib/confluex-node/main.js'), true)
  assert.equal(isGovernedRelativePath(''), false)
  assert.equal(isGovernedRelativePath('lib//main.js'), false)
  assert.equal(isGovernedRelativePath('lib/../main.js'), false)
  assert.equal(isGovernedRelativePath('C:/main.js'), false)
})
