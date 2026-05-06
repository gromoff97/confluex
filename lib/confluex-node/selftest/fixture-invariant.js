'use strict'

const fs = require('node:fs')
const path = require('node:path')

const { createSelftestConfluenceClient } = require('./confluence-client')
const { loadFixtureBundle } = require('./fixture-bundle')

async function checkFixtureInvariants (runtimeRoot, reportRoot, dependencies = {}) {
  const client = dependencies.client || createSelftestConfluenceClient(dependencies.target)
  if (typeof client.checkFixtureInvariant !== 'function') {
    return checkFixtureInvariantsWithReadClient(runtimeRoot, reportRoot, client)
  }

  return client.checkFixtureInvariant({
    runtimeRoot,
    reportRoot,
    target: dependencies.target
  })
}

async function checkFixtureInvariantsWithReadClient (runtimeRoot, reportRoot, client) {
  try {
    const bundle = loadFixtureBundle(runtimeRoot)
    const identities = readJsonObject(path.join(reportRoot, 'identities.json'))
    const pageIds = new Set()

    for (const space of bundle.spaces) {
      const identity = identities[space.logicalName]
      if (!sameObjectKeys(identity, ['space_key', 'space_name']) ||
          identity.space_key !== space.spaceKey ||
          identity.space_name !== space.spaceName) {
        return { state: 'failed' }
      }

      const remote = await client.readSpace({ spaceKey: identity.space_key })
      if (remote.spaceKey !== space.spaceKey || remote.spaceName !== space.spaceName) {
        return { state: 'failed' }
      }
    }

    const spaceKeyByLogicalName = new Map(bundle.spaces.map((space) => [space.logicalName, space.spaceKey]))

    for (const page of bundle.pages) {
      const identity = identities[page.logicalName]
      if (!sameObjectKeys(identity, ['page_id', 'title', 'space_key']) ||
          !isCanonicalPageId(identity.page_id) ||
          identity.title !== page.title ||
          identity.space_key !== spaceKeyByLogicalName.get(page.spaceLogicalName)) {
        return { state: 'failed' }
      }
      if (pageIds.has(identity.page_id)) {
        return { state: 'failed' }
      }
      pageIds.add(identity.page_id)

      const remote = await client.readPage({ pageId: identity.page_id })
      if (remote.pageId !== identity.page_id ||
          remote.title !== page.title ||
          remote.spaceKey !== identity.space_key ||
          remote.parentId !== expectedParentId(page, identities) ||
          !sameStorageXml(remote.bodyStorage, expectedBodyStorage(page, identities))) {
        return { state: 'failed' }
      }
    }

    for (const attachment of bundle.attachments) {
      const identity = identities[attachment.logicalName]
      const pageIdentity = identities[attachment.pageLogicalName]
      if (!sameObjectKeys(identity, ['page_id', 'filename']) ||
          identity.page_id !== pageIdentity.page_id ||
          identity.filename !== attachment.filename) {
        return { state: 'failed' }
      }

      const remote = await client.readAttachment({
        pageId: identity.page_id,
        filename: attachment.filename
      })
      if (remote.pageId !== identity.page_id ||
          remote.filename !== attachment.filename ||
          Buffer.compare(remote.bytes, attachment.bytes) !== 0) {
        return { state: 'failed' }
      }
    }

    return { state: 'passed' }
  } catch {
    return { state: 'failed' }
  }
}

function readJsonObject (filePath) {
  const value = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('json is not object')
  }

  return value
}

function sameObjectKeys (value, keys) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const actual = Object.keys(value)
  return actual.length === keys.length && keys.every((key, index) => actual[index] === key)
}

function isCanonicalPageId (value) {
  return typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value)
}

function expectedParentId (page, identities) {
  if (typeof page.parentLogicalName !== 'string') {
    return null
  }

  return identities[page.parentLogicalName].page_id
}

function expectedBodyStorage (page, identities) {
  if (typeof page.bodyStorageTemplate === 'string') {
    return page.bodyStorageTemplate.replace(/\{\{page_id:([A-Za-z0-9_.-]+)\}\}/g, (_match, logicalName) => {
      return identities[logicalName].page_id
    })
  }

  throw new Error('page has no body storage')
}

function sameStorageXml (left, right) {
  return normalizeStorageXml(left) === normalizeStorageXml(right)
}

function normalizeStorageXml (value) {
  return decodeStorageEntities(value
    .replace(/(<[^<>]+?)\s+\/>/g, '$1/>')
    .replace(/<ac:macro(\s[^<>]*)>/g, '<ac:structured-macro$1>')
    .replace(/<\/ac:macro>/g, '</ac:structured-macro>')
    .replace(/\s+ac:(?:schema-version|macro-id)="[^"]*"/g, '')
    .replace(/\n$/, ''))
}

function decodeStorageEntities (value) {
  return value.replace(/&(#x[0-9A-Fa-f]+|#[0-9]+|amp|lt|gt|quot|apos|mdash);/g, (_match, entity) => {
    if (entity === 'amp') return '&'
    if (entity === 'lt') return '<'
    if (entity === 'gt') return '>'
    if (entity === 'quot') return '"'
    if (entity === 'apos') return "'"
    if (entity === 'mdash') return '—'
    const codePoint = entity.startsWith('#x')
      ? Number.parseInt(entity.slice(2), 16)
      : Number.parseInt(entity.slice(1), 10)
    return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : _match
  })
}

module.exports = {
  checkFixtureInvariants
}
