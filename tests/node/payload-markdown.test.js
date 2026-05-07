'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const {
  markdownRemnantDiagnostics,
  normalizeMarkdownPayload
} = require('../../dist/confluex-node/payload/markdown')

test('normalizeMarkdownPayload applies the governed Markdown byte normalization', () => {
  assert.equal(
    normalizeMarkdownPayload('Line one  \r\n\t\r\nLine two\t\n\n\n\nLine three'),
    'Line one\n\nLine two\n\nLine three\n'
  )
})

test('normalizeMarkdownPayload emits one final LF for empty payloads', () => {
  assert.equal(normalizeMarkdownPayload('   \r\n\t'), '\n')
})

test('normalizeMarkdownPayload removes leading blank lines emitted by converters', () => {
  assert.equal(normalizeMarkdownPayload('\n\n\t\n# Title\n'), '# Title\n')
})

test('markdownRemnantDiagnostics reports unique governed storage and HTML markers', () => {
  assert.deepEqual(
    markdownRemnantDiagnostics('Body <ac:structured-macro />\n<p>HTML</p>\n<ri:page />\n<p>again</p>\n'),
    [
      {
        kind: 'storage_format_remnant',
        token: '<ac:',
        detail: 'markdown_remnant_kind=storage_format_remnant;token=<ac:'
      },
      {
        kind: 'storage_format_remnant',
        token: '<ri:',
        detail: 'markdown_remnant_kind=storage_format_remnant;token=<ri:'
      },
      {
        kind: 'html_remnant',
        token: '<p',
        detail: 'markdown_remnant_kind=html_remnant;token=<p'
      },
      {
        kind: 'html_remnant',
        token: '</p>',
        detail: 'markdown_remnant_kind=html_remnant;token=</p>'
      }
    ]
  )
})

test('markdownRemnantDiagnostics ignores escaped Markdown angle-bracket literals', () => {
  assert.deepEqual(
    markdownRemnantDiagnostics('Escaped literals: \\<punctuation\\>, \\<ri:page\\>, and \\<p\\>.\n'),
    []
  )
})
