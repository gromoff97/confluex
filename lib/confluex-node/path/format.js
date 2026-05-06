'use strict'

function quotePathString (value) {
  let output = '"'

  for (const char of String(value)) {
    const code = char.codePointAt(0)
    if (char === '"') {
      output += '\\"'
    } else if (char === '\\') {
      output += '\\\\'
    } else if (char === '\b') {
      output += '\\b'
    } else if (char === '\t') {
      output += '\\t'
    } else if (char === '\n') {
      output += '\\n'
    } else if (char === '\f') {
      output += '\\f'
    } else if (char === '\r') {
      output += '\\r'
    } else if (code <= 0x1f) {
      output += `\\u${code.toString(16).toUpperCase().padStart(4, '0')}`
    } else {
      output += char
    }
  }

  return `${output}"`
}

function sortedManifestText (relativePaths) {
  return `${relativePaths.slice().sort(bytewiseCompare).join('\n')}\n`
}

function bytewiseCompare (left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'))
}

module.exports = {
  quotePathString,
  sortedManifestText
}
