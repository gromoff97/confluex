'use strict'

function pagePayloadFolder ({ pageId, spaceKey } = {}) {
  if (typeof pageId !== 'string' || !/^(0|[1-9][0-9]*)$/.test(pageId)) {
    throw new TypeError('pageId must be a canonical non-negative integer string')
  }

  const spaceSegment = spaceKey === undefined || spaceKey === ''
    ? '_no_space'
    : `space__${Buffer.from(requireString(spaceKey, 'spaceKey'), 'utf8').toString('hex').toUpperCase()}`
  const pageSegment = `page__${pageId}`

  if (Buffer.byteLength(spaceSegment, 'utf8') > 240) {
    throw new TypeError('space segment exceeds 240 UTF-8 bytes')
  }
  if (Buffer.byteLength(pageSegment, 'utf8') > 240) {
    throw new TypeError('page segment exceeds 240 UTF-8 bytes')
  }

  return `pages/${spaceSegment}/${pageSegment}`
}

function requireString (value, name) {
  if (typeof value !== 'string') {
    throw new TypeError(`${name} must be a string`)
  }
  return value
}

module.exports = {
  pagePayloadFolder
}
