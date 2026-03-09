#!/usr/bin/env node
'use strict'

const fs = require('fs')

const US = '\x1f'

function readText (filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

function decodeEntities (value = '') {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(parseInt(num, 10)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function parseInfo (filePath) {
  const text = readText(filePath)
  const lines = text.split(/\r?\n/)
  let title = ''
  let spaceKey = ''
  let url = ''

  for (const line of lines) {
    let match
    if (!title && (match = line.match(/^\s*(?:Title|Page Title|Page):\s*(.+)\s*$/i))) {
      title = match[1].trim()
    }
    if (!spaceKey && (match = line.match(/^\s*(?:Space Key|SpaceKey):\s*(.+)\s*$/i))) {
      spaceKey = match[1].trim()
    }
    if (!spaceKey && (match = line.match(/^\s*Space:\s*.*\(([^()]+)\)\s*$/i))) {
      spaceKey = match[1].trim()
    }
    if (!url && (match = line.match(/^\s*URL:\s*(.+)\s*$/i))) {
      url = match[1].trim()
    }
  }

  if (!spaceKey && url) {
    let match = url.match(/\/spaces\/([^/?#]+)\//i)
    if (match) spaceKey = match[1].trim()
    if (!spaceKey) {
      match = url.match(/[?&]spaceKey=([^&#]+)/i)
      if (match) spaceKey = decodeURIComponent(match[1]).trim()
    }
  }

  process.stdout.write(`${title}${US}${spaceKey}${US}${url}`)
}

function collectChildrenIds (data) {
  const ids = new Set()

  function collectPage (node) {
    if (!node || typeof node !== 'object') return

    if ('id' in node) {
      const id = String(node.id)
      if (/^\d+$/.test(id)) {
        ids.add(id)
      }
    }

    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        collectPage(child)
      }
    }

    if (node.children && typeof node.children === 'object') {
      collectPages(node.children)
    }
  }

  function collectPages (value) {
    if (Array.isArray(value)) {
      for (const item of value) {
        collectPage(item)
      }
      return
    }

    if (!value || typeof value !== 'object') return

    if (Array.isArray(value.results)) {
      for (const item of value.results) {
        collectPage(item)
      }
    }

    if (Array.isArray(value.children)) {
      for (const item of value.children) {
        collectPage(item)
      }
    }
  }

  collectPages(data)
  return ids
}

function extractChildren (filePath) {
  const data = JSON.parse(readText(filePath))
  const ids = collectChildrenIds(data)
  for (const id of ids) {
    process.stdout.write(`${id}\n`)
  }
}

function inspectChildren (filePath) {
  const data = JSON.parse(readText(filePath))
  const ids = collectChildrenIds(data)
  const flags = new Set()

  function walk (value) {
    if (!value || typeof value !== 'object') return

    if (value.hasMore === true) {
      flags.add(`children_pagination_hint${US}hasMore_true`)
    }

    if (typeof value.next === 'string' && value.next.trim()) {
      flags.add(`children_pagination_hint${US}next_link_present`)
    }

    if (typeof value.cursor === 'string' && value.cursor.trim()) {
      flags.add(`children_pagination_hint${US}cursor_present`)
    }

    if (value._links && typeof value._links === 'object') {
      if (typeof value._links.next === 'string' && value._links.next.trim()) {
        flags.add(`children_pagination_hint${US}next_link_present`)
      }
      if (typeof value._links.base === 'string' && typeof value._links.next === 'string' && value._links.next.trim()) {
        flags.add(`children_pagination_hint${US}linked_next_page_present`)
      }
    }

    if (Array.isArray(value)) {
      for (const item of value) walk(item)
      return
    }

    for (const child of Object.values(value)) {
      walk(child)
    }
  }

  walk(data)

  for (const id of ids) {
    process.stdout.write(`id${US}${id}\n`)
  }
  for (const flag of flags) {
    process.stdout.write(`flag${US}${flag}\n`)
  }
}

function attr (attrs, name) {
  const re = new RegExp(`${name}=("([^"]*)"|'([^']*)')`)
  const match = attrs.match(re)
  if (!match) return ''
  return decodeEntities(match[2] || match[3] || '')
}

function emitUnique (rows, row) {
  const clean = row.map((x) => String(x || '').replace(/[\r\n\t]+/g, ' ').trim())
  const key = JSON.stringify(clean)
  if (rows.has(key)) return
  rows.add(key)
  process.stdout.write(`${clean.join(US)}\n`)
}

function decodeUrlTitle (value = '') {
  return decodeURIComponent(value.replace(/\+/g, ' ')).trim()
}

function internalTitleRefFromUrl (url, currentSpace) {
  let parsed

  try {
    if (/^[a-z][a-z0-9+.-]*:/i.test(url)) {
      parsed = new URL(url)
    } else {
      parsed = new URL(url, 'https://example.invalid')
    }
  } catch {
    return null
  }

  const pathname = parsed.pathname || ''
  const queryTitle = parsed.searchParams.get('title')
  const querySpace = parsed.searchParams.get('spaceKey') || currentSpace || ''

  if (queryTitle) {
    const title = decodeUrlTitle(queryTitle)
    if (title) {
      return { space: querySpace.trim(), title }
    }
  }

  let match = pathname.match(/(?:\/wiki)?\/display\/([^/]+)\/([^/]+)$/i)
  if (match) {
    return {
      space: decodeURIComponent(match[1]).trim(),
      title: decodeUrlTitle(match[2])
    }
  }

  match = pathname.match(/(?:\/wiki)?\/spaces\/([^/]+)\/pages\/viewpage\.action$/i)
  if (match && queryTitle) {
    return {
      space: decodeURIComponent(match[1]).trim(),
      title: decodeUrlTitle(queryTitle)
    }
  }

  return null
}

function extractLinks (filePath, currentSpace) {
  const xml = readText(filePath)
  const scanXml = xml
    .replace(/<ac:plain-text-body\b[^>]*>[\s\S]*?<\/ac:plain-text-body>/g, '')
    .replace(/<code\b[^>]*>[\s\S]*?<\/code>/g, '')
    .replace(/<pre\b[^>]*>[\s\S]*?<\/pre>/g, '')
  const rows = new Set()
  let match

  function internalPageIdFromUrl (url) {
    if (!/viewpage\.action|\/pages\//i.test(url)) {
      return ''
    }

    const pageIdMatch = url.match(/[?&]pageId=(\d+)/i)
    if (pageIdMatch) return pageIdMatch[1]

    const pathMatch = url.match(/\/pages\/(\d+)(?:[/?#]|$)/i)
    if (pathMatch) return pathMatch[1]

    return ''
  }

  function looksLikeInternalConfluenceUrl (url) {
    return /(?:\/display\/|\/spaces\/|\/pages\/|viewpage\.action|pageId=)/i.test(url)
  }

  const contentEntityRe = /<ri:content-entity\b[^>]*ri:content-id="(\d+)"[^>]*\/?>/g
  while ((match = contentEntityRe.exec(scanXml))) {
    emitUnique(rows, ['id', match[1]])
  }

  const pageRe = /<ri:page\b([^>]*)\/?>/g
  while ((match = pageRe.exec(scanXml))) {
    const attrs = match[1] || ''
    const contentId = attr(attrs, 'ri:content-id')
    if (contentId) {
      emitUnique(rows, ['id', contentId])
      continue
    }

    const title = attr(attrs, 'ri:content-title').trim()
    if (!title) continue
    const space = (attr(attrs, 'ri:space-key') || currentSpace || '').trim()
    emitUnique(rows, ['title', space, title])
  }

  const pageParamRe = /<ac:parameter\b[^>]*ac:name="page"[^>]*>([\s\S]*?)<\/ac:parameter>/g
  while ((match = pageParamRe.exec(scanXml))) {
    const raw = decodeEntities(match[1].replace(/<[^>]+>/g, '').trim())
    if (!raw) continue

    let space = currentSpace || ''
    let title = raw
    const explicit = raw.match(/^([A-Z0-9_.-]+):(\S.*)$/)
    if (explicit) {
      space = explicit[1].trim()
      title = explicit[2].trim()
    }
    if (title) {
      emitUnique(rows, ['title', space, title])
    }
  }

  const riUrlRe = /<ri:url\b([^>]*)\/?>/g
  while ((match = riUrlRe.exec(scanXml))) {
    const attrs = match[1] || ''
    const rawUrl = attr(attrs, 'ri:value').trim()
    if (!rawUrl) continue

    const pageId = internalPageIdFromUrl(rawUrl)
    if (pageId) {
      emitUnique(rows, ['id', pageId])
      continue
    }

    const titleRef = internalTitleRefFromUrl(rawUrl, currentSpace)
    if (titleRef && titleRef.title) {
      emitUnique(rows, ['title', titleRef.space, titleRef.title])
      continue
    }

    if (looksLikeInternalConfluenceUrl(rawUrl)) {
      emitUnique(rows, ['unsupported', 'unsupported_internal_reference', `ri:url:${rawUrl}`])
    }
  }

  const hrefRe = /href=("([^"]*)"|'([^']*)')/g
  while ((match = hrefRe.exec(scanXml))) {
    const href = decodeEntities(match[2] || match[3] || '')
    const pageId = internalPageIdFromUrl(href)
    if (pageId) {
      emitUnique(rows, ['id', pageId])
      continue
    }

    const titleRef = internalTitleRefFromUrl(href, currentSpace)
    if (titleRef && titleRef.title) {
      emitUnique(rows, ['title', titleRef.space, titleRef.title])
      continue
    }

    if (looksLikeInternalConfluenceUrl(href)) {
      emitUnique(rows, ['unsupported', 'unsupported_internal_reference', `href:${href}`])
    }
  }
}

function die (message) {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}

function main () {
  const command = process.argv[2]

  if (command === 'parse-info') {
    const filePath = process.argv[3]
    if (!filePath) die('parse-info requires file path')
    parseInfo(filePath)
    return
  }

  if (command === 'extract-children') {
    const filePath = process.argv[3]
    if (!filePath) die('extract-children requires file path')
    extractChildren(filePath)
    return
  }

  if (command === 'inspect-children') {
    const filePath = process.argv[3]
    if (!filePath) die('inspect-children requires file path')
    inspectChildren(filePath)
    return
  }

  if (command === 'extract-links') {
    const filePath = process.argv[3]
    const currentSpace = process.argv[4] || ''
    if (!filePath) die('extract-links requires file path')
    extractLinks(filePath, currentSpace)
    return
  }

  die(`unknown command: ${command || '<empty>'}`)
}

main()
