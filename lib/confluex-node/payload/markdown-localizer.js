'use strict'

const {
  localPathFromFolderPair,
  normalizedTargetKeyFromMarkdownDestination,
  normalizedTargetKeyFromResolvedRow,
  normalizedTargetKeyFromUnresolvedRow
} = require('../links/internal-target')
const {
  normalizeMarkdownPayload
} = require('./markdown')

let markdownModulesPromise = null

async function localizeMarkdownPayload (input) {
  const payload = typeof input.payload === 'string' ? input.payload : ''
  const { fromMarkdown, gfm, gfmFromMarkdown, gfmToMarkdown, toMarkdown, visit } = await markdownModules()
  const tree = fromMarkdown(payload, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()]
  })
  const resolvedTargets = resolvedTargetsByKey(input)
  const unresolvedTargets = unresolvedTargetsByKey(input)
  const exportedTargets = exportedTargetsByKey(input)

  visit(tree, ['link', 'image'], (node, index, parent) => {
    if (parent === undefined || typeof index !== 'number') {
      return
    }
    const destination = typeof node.url === 'string' ? node.url : ''
    if (destination.startsWith('attachments/')) {
      return
    }

    const normalized = normalizedTargetKeyFromMarkdownDestination(destination, {
      baseUrl: input.baseUrl
    })
    if (normalized === null) {
      return
    }

    const resolvedFolder = firstMatchingTargetValue(
      resolvedTargets,
      candidateTargetKeys(normalized.targetKey, input.sourceSpaceKey)
    )
    if (typeof resolvedFolder === 'string') {
      node.url = appendFragment(
        localPathFromFolderPair(input.sourceFolder, resolvedFolder),
        normalized.fragment
      )
      return
    }

    const unresolved = firstMatchingTargetValue(
      unresolvedTargets,
      candidateTargetKeys(normalized.targetKey, input.sourceSpaceKey)
    )
    if (unresolved !== undefined) {
      if (node.type === 'image') {
        parent.children.splice(index, 1, {
          type: 'text',
          value: `${node.alt || destination} ${unresolvedInlineMarker(normalized.targetKey, unresolved)}`
        })
        return index
      }

      parent.children.splice(index, 1, {
        type: 'text',
        value: `${linkText(node)} ${unresolvedInlineMarker(normalized.targetKey, unresolved)}`
      })
      return index
    }

    const exportedFolder = firstMatchingTargetValue(
      exportedTargets,
      candidateTargetKeys(normalized.targetKey, input.sourceSpaceKey)
    )
    if (typeof exportedFolder === 'string') {
      node.url = appendFragment(
        localPathFromFolderPair(input.sourceFolder, exportedFolder),
        normalized.fragment
      )
    }
  })

  return {
    payload: normalizeMarkdownPayload(
      unescapeGeneratedUnresolvedMarkers(
        toMarkdown(tree, { extensions: [gfmToMarkdown()] })
      )
    )
  }
}

function resolvedTargetsByKey (input) {
  const pageFoldersByPageId = input.pageFoldersByPageId instanceof Map
    ? input.pageFoldersByPageId
    : new Map()
  const targets = new Map()
  for (const row of arrayValue(input.resolvedLinkRows)) {
    if (row === null || typeof row !== 'object' || row.source_page_id !== input.sourcePageId) {
      continue
    }
    const targetKey = normalizedTargetKeyFromResolvedRow(row)
    const targetFolder = pageFoldersByPageId.get(row.target_page_id)
    if (typeof targetKey !== 'string' || targetKey === '' || typeof targetFolder !== 'string' || targetFolder === '') {
      continue
    }
    for (const alias of resolvedTargetAliases(row, input.sourceSpaceKey)) {
      targets.set(alias, targetFolder)
    }
  }
  return targets
}

function unresolvedTargetsByKey (input) {
  const reasonsByKey = new Map()
  for (const row of arrayValue(input.unresolvedLinkRows)) {
    if (row === null || typeof row !== 'object' || row.source_page_id !== input.sourcePageId) {
      continue
    }
    const targetKey = normalizedTargetKeyFromUnresolvedRow(row)
    if (typeof targetKey !== 'string' || targetKey === '' || typeof row.resolution_reason !== 'string' || row.resolution_reason === '') {
      continue
    }
    const current = reasonsByKey.get(targetKey)
    if (current === undefined || Buffer.compare(Buffer.from(row.resolution_reason, 'utf8'), Buffer.from(current, 'utf8')) < 0) {
      // Deterministic tie-breaker when multiple link kinds collapse to one Markdown target key.
      reasonsByKey.set(targetKey, row.resolution_reason)
    }
  }
  return reasonsByKey
}

function exportedTargetsByKey (input) {
  if (input.exportedPageFoldersByTargetKey instanceof Map) {
    return input.exportedPageFoldersByTargetKey
  }

  const targets = new Map()
  for (const [pageId, folder] of input.pageFoldersByPageId instanceof Map ? input.pageFoldersByPageId.entries() : []) {
    if (typeof pageId === 'string' && pageId !== '' && typeof folder === 'string' && folder !== '') {
      targets.set(`page_id:${pageId}`, folder)
    }
  }
  return targets
}

function unresolvedInlineMarker (targetKey, reason) {
  const description = describeTargetKey(targetKey)
  return `[unresolved: ${description.kind}; reason=${reason}; target_hint=${description.hint}; value="${escapeDoubleQuotes(description.value)}"]`
}

function firstMatchingTargetValue (map, candidateKeys) {
  for (const key of candidateKeys) {
    const value = map.get(key)
    if (value !== undefined) {
      return value
    }
  }
  return undefined
}

function resolvedTargetAliases (row, sourceSpaceKey) {
  const aliases = new Set()
  if (typeof row.raw_link_value === 'string' && row.raw_link_value !== '') {
    aliases.add(row.raw_link_value)
  }
  if (typeof row.target_page_id === 'string' && row.target_page_id !== '') {
    aliases.add(`page_id:${row.target_page_id}`)
  }
  if (typeof row.target_title === 'string' && row.target_title !== '' && typeof row.target_space_key === 'string' && row.target_space_key !== '') {
    aliases.add(titleTargetKeyWithSpaceKey(row.target_space_key, row.target_title))
    if (row.target_space_key === sourceSpaceKey) {
      aliases.add(titleTargetKeyWithoutSpaceKey(row.target_title))
    }
  }
  return aliases
}

function candidateTargetKeys (targetKey, sourceSpaceKey) {
  const keys = [targetKey]
  const titleTarget = parseTitleTargetKey(targetKey)
  if (titleTarget === null || typeof sourceSpaceKey !== 'string' || sourceSpaceKey === '') {
    return keys
  }

  if (typeof titleTarget.spaceKey === 'string') {
    if (titleTarget.spaceKey === sourceSpaceKey) {
      keys.push(titleTargetKeyWithoutSpaceKey(titleTarget.title))
    }
    return keys
  }

  keys.push(titleTargetKeyWithSpaceKey(sourceSpaceKey, titleTarget.title))
  return keys
}

function describeTargetKey (targetKey) {
  if (targetKey.startsWith('page_id:')) {
    return {
      kind: 'page',
      hint: 'page_id',
      value: targetKey.slice('page_id:'.length)
    }
  }

  const titleTarget = parseTitleTargetKey(targetKey)
  if (titleTarget !== null) {
    return {
      kind: 'page',
      hint: 'title',
      value: typeof titleTarget.spaceKey === 'string'
        ? `${titleTarget.spaceKey}:${titleTarget.title}`
        : titleTarget.title
    }
  }

  return {
    kind: 'page',
    hint: 'raw',
    value: targetKey
  }
}

function parseTitleTargetKey (targetKey) {
  const match = /^space_key_present=(0|1);space_key_bytes=([0-9]+);space_key=(.*);title_bytes=([0-9]+);title=(.*)$/s.exec(targetKey)
  if (match === null) {
    return null
  }

  const spaceKeyPresent = match[1] === '1'
  const spaceKey = match[3]
  const title = match[5]
  if (Buffer.byteLength(spaceKey, 'utf8') !== Number(match[2]) || Buffer.byteLength(title, 'utf8') !== Number(match[4])) {
    return null
  }

  return {
    title,
    ...(spaceKeyPresent ? { spaceKey } : {})
  }
}

function titleTargetKeyWithoutSpaceKey (title) {
  return [
    'space_key_present=0',
    'space_key_bytes=0',
    'space_key=',
    `title_bytes=${Buffer.byteLength(title, 'utf8')}`,
    `title=${title}`
  ].join(';')
}

function titleTargetKeyWithSpaceKey (spaceKey, title) {
  return [
    'space_key_present=1',
    `space_key_bytes=${Buffer.byteLength(spaceKey, 'utf8')}`,
    `space_key=${spaceKey}`,
    `title_bytes=${Buffer.byteLength(title, 'utf8')}`,
    `title=${title}`
  ].join(';')
}

function linkText (node) {
  return flattenTextChildren(node.children).trim() || node.url
}

function flattenTextChildren (children) {
  let output = ''
  for (const child of arrayValue(children)) {
    if (child === null || typeof child !== 'object') {
      continue
    }
    if (typeof child.value === 'string') {
      output += child.value
    }
    if (Array.isArray(child.children)) {
      output += flattenTextChildren(child.children)
    }
  }
  return output
}

function appendFragment (pathValue, fragment) {
  return fragment === '' ? pathValue : `${pathValue}#${fragment}`
}

function unescapeGeneratedUnresolvedMarkers (value) {
  return String(value).replace(/\\\[unresolved: ([^\n]*?)\]/g, (_match, body) => {
    return `[unresolved: ${body.replace(/\\_/g, '_')}]`
  })
}

function escapeDoubleQuotes (value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function arrayValue (value) {
  return Array.isArray(value) ? value : []
}

async function markdownModules () {
  if (markdownModulesPromise === null) {
    markdownModulesPromise = loadMarkdownModules()
  }
  return markdownModulesPromise
}

async function loadMarkdownModules () {
  const [
    fromMarkdownModule,
    mdastGfmModule,
    toMarkdownModule,
    micromarkGfmModule,
    visitModule
  ] = await Promise.all([
    import('mdast-util-from-markdown'),
    import('mdast-util-gfm'),
    import('mdast-util-to-markdown'),
    import('micromark-extension-gfm'),
    import('unist-util-visit')
  ])

  return {
    fromMarkdown: fromMarkdownModule.fromMarkdown,
    gfm: micromarkGfmModule.gfm,
    gfmFromMarkdown: mdastGfmModule.gfmFromMarkdown,
    gfmToMarkdown: mdastGfmModule.gfmToMarkdown,
    toMarkdown: toMarkdownModule.toMarkdown,
    visit: visitModule.visit
  }
}

module.exports = {
  localizeMarkdownPayload
}
