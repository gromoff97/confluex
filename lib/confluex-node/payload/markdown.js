'use strict'

const STORAGE_MARKERS = ['<ac:', '<ri:']
const HTML_MARKERS = [
  '<p',
  '</p>',
  '<table',
  '</table>',
  '<tr',
  '</tr>',
  '<td',
  '</td>',
  '<th',
  '</th>',
  '<div',
  '</div>',
  '<span',
  '</span>',
  '<img'
]

function normalizeMarkdownPayload (payload) {
  const text = String(payload)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(line => {
      const withoutTrailing = line.replace(/[ \t]+$/g, '')
      return /^[ \t]*$/.test(withoutTrailing) ? '' : withoutTrailing
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+/g, '')
    .replace(/\n*$/g, '')

  return `${text}\n`
}

function markdownRemnantDiagnostics (markdown) {
  const text = String(markdown)
  const diagnostics = []
  const seen = new Set()

  for (const token of STORAGE_MARKERS) {
    addDiagnostic(diagnostics, seen, 'storage_format_remnant', token, text)
  }
  for (const token of HTML_MARKERS) {
    addDiagnostic(diagnostics, seen, 'html_remnant', token, text)
  }

  return diagnostics
}

function addDiagnostic (diagnostics, seen, kind, token, text) {
  if (!hasUnescapedToken(text, token)) {
    return
  }
  const key = `${kind}\t${token}`
  if (seen.has(key)) {
    return
  }
  seen.add(key)
  diagnostics.push({
    kind,
    token,
    detail: `markdown_remnant_kind=${kind};token=${token}`
  })
}

function hasUnescapedToken (text, token) {
  let index = text.indexOf(token)
  while (index !== -1) {
    if (index === 0 || text[index - 1] !== '\\') {
      return true
    }
    index = text.indexOf(token, index + token.length)
  }
  return false
}

module.exports = {
  markdownRemnantDiagnostics,
  normalizeMarkdownPayload
}
