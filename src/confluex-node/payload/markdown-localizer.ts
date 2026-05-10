import type { Image, Link, Root } from 'mdast'

import {
  localPathFromFolderPair,
  normalizedTargetKeyFromMarkdownDestination,
  normalizedTargetKeyFromResolvedRow,
  normalizedTargetKeyFromUnresolvedRow
} from '../links/internal-target'
import {
  normalizeMarkdownPayload
} from './markdown'
import { classifyMarkdownDestination } from './markdown-destination'
import { structuredRawLinkValue } from '../reports/rows'

type LocalizeMarkdownInput = {
  payload: string
  sourcePageId: string
  sourceSpaceKey?: string
  sourceFolder: string
  baseUrl?: string
  resolvedLinkRows?: unknown
  unresolvedLinkRows?: unknown
  pageFoldersByPageId?: unknown
  exportedPageFoldersByTargetKey?: unknown
}

type LocalizedMarkdownPayload = {
  payload: string
}

type FromMarkdown = (payload: string, options: { extensions: unknown[], mdastExtensions: unknown[] }) => Root
type Gfm = () => unknown
type GfmFromMarkdown = () => unknown
type GfmToMarkdown = () => unknown
type ToMarkdown = (tree: Root, options: { extensions: unknown[] }) => string
type Visit = (
  tree: Root,
  test: readonly string[],
  visitor: (node: unknown, index: number | undefined, parent: unknown) => number | undefined
) => void

type MarkdownModules = {
  fromMarkdown: FromMarkdown
  gfm: Gfm
  gfmFromMarkdown: GfmFromMarkdown
  gfmToMarkdown: GfmToMarkdown
  toMarkdown: ToMarkdown
  visit: Visit
}

type MutableParent = {
  children: unknown[]
}

type LinkOrImage = Link | Image

type TitleTargetKey = {
  title: string
  spaceKey?: string
}

type TargetDescription = {
  kind: 'page'
  hint: 'page_id' | 'title' | 'raw'
  value: string
}

let markdownModulesPromise: Promise<MarkdownModules> | null = null

export async function localizeMarkdownPayload (input: LocalizeMarkdownInput): Promise<LocalizedMarkdownPayload> {
  const payload = typeof input.payload === 'string' ? input.payload : ''
  const { fromMarkdown, gfm, gfmFromMarkdown, gfmToMarkdown, toMarkdown, visit } = await markdownModules()
  const tree = fromMarkdown(payload, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()]
  })
  const resolvedTargets = resolvedTargetsByKey(input)
  const unresolvedTargets = unresolvedTargetsByKey(input)

  visit(tree, ['link', 'image'], (node, index, parent) => {
    if (!isLinkOrImage(node) || !isMutableParent(parent) || typeof index !== 'number') {
      return
    }
    const destination = node.url
    if (destination.startsWith('attachments/')) {
      if (isSafeLocalAttachmentDestination(destination)) {
        return
      }
    }

    const disposition = classifyMarkdownDestination({ destination })
    if (disposition.kind === 'neutralized_dangerous') {
      parent.children.splice(index, 1, {
        type: 'text',
        value: `[neutralized: markdown_destination; reason=${disposition.reason}]`
      })
      return index
    }
    if (disposition.kind === 'unsupported') {
      parent.children.splice(index, 1, {
        type: 'text',
        value: disposition.marker
      })
      return index
    }
    if (disposition.kind === 'preserved_external') {
      return
    }

    const normalized = normalizedTargetKeyFromMarkdownDestination(
      destination,
      typeof input.baseUrl === 'string' ? { baseUrl: input.baseUrl } : {}
    )
    if (normalized === null) {
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
          value: unresolvedInlineMarker(normalized.targetKey, unresolved)
        })
        return index
      }

      parent.children.splice(index, 1, {
        type: 'text',
        value: unresolvedInlineMarker(normalized.targetKey, unresolved)
      })
      return index
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
    }
  })

  return {
    payload: normalizeMarkdownPayload(
      unescapeGeneratedMarkers(
        toMarkdown(tree, { extensions: [gfmToMarkdown()] })
      )
    )
  }
}

function resolvedTargetsByKey (input: LocalizeMarkdownInput): Map<string, string> {
  const pageFoldersByPageId = isStringMap(input.pageFoldersByPageId)
    ? input.pageFoldersByPageId
    : new Map<string, string>()
  const targets = new Map<string, string>()
  for (const row of arrayValue(input.resolvedLinkRows)) {
    if (!isRecord(row) || row.source_page_id !== input.sourcePageId) {
      continue
    }
    const targetKey = normalizedTargetKeyFromResolvedRow(row)
    const targetFolder = typeof row.target_page_id === 'string'
      ? pageFoldersByPageId.get(row.target_page_id)
      : undefined
    if (typeof targetKey !== 'string' || targetKey === '' || typeof targetFolder !== 'string' || targetFolder === '') {
      continue
    }
    for (const alias of resolvedTargetAliases(row, input.sourceSpaceKey)) {
      targets.set(alias, targetFolder)
    }
  }
  return targets
}

function unresolvedTargetsByKey (input: LocalizeMarkdownInput): Map<string, string> {
  const reasonsByKey = new Map<string, string>()
  for (const row of arrayValue(input.unresolvedLinkRows)) {
    if (!isRecord(row) || row.source_page_id !== input.sourcePageId) {
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

function unresolvedInlineMarker (targetKey: string, reason: string): string {
  const description = describeTargetKey(targetKey)
  return `[unresolved: ${description.kind}; reason=${reason}; target_hint=${description.hint}; value="${escapeDoubleQuotes(description.value)}"]`
}

function isSafeLocalAttachmentDestination (destination: string): boolean {
  return /^attachments\/[A-Za-z0-9._-]+(?:#[^\s]*)?$/.test(destination) &&
    !destination.includes('..') &&
    !/\/(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:[.#]|$)/i.test(destination) &&
    !/\/[^/#]*\.(?:#|$)/.test(destination)
}

function firstMatchingTargetValue (map: Map<string, string>, candidateKeys: string[]): string | undefined {
  for (const key of candidateKeys) {
    const value = map.get(key)
    if (value !== undefined) {
      return value
    }
  }
  return undefined
}

function resolvedTargetAliases (row: Record<string, unknown>, sourceSpaceKey: string | undefined): Set<string> {
  const aliases = new Set<string>()
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

function candidateTargetKeys (targetKey: string, sourceSpaceKey: string | undefined): string[] {
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

function describeTargetKey (targetKey: string): TargetDescription {
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

function parseTitleTargetKey (targetKey: string): TitleTargetKey | null {
  const match = /^space_key_present=(0|1);space_key_bytes=([0-9]+);space_key=(.*);title_bytes=([0-9]+);title=(.*)$/s.exec(targetKey)
  if (match === null) {
    return null
  }

  const spaceKeyPresentToken = match[1]
  const spaceKeyBytesText = match[2]
  const spaceKey = match[3]
  const titleBytesText = match[4]
  const title = match[5]
  if (
    spaceKeyPresentToken === undefined ||
    spaceKeyBytesText === undefined ||
    spaceKey === undefined ||
    titleBytesText === undefined ||
    title === undefined
  ) {
    return null
  }

  const spaceKeyPresent = spaceKeyPresentToken === '1'
  if (Buffer.byteLength(spaceKey, 'utf8') !== Number(spaceKeyBytesText) || Buffer.byteLength(title, 'utf8') !== Number(titleBytesText)) {
    return null
  }

  return {
    title,
    ...(spaceKeyPresent ? { spaceKey } : {})
  }
}

function titleTargetKeyWithoutSpaceKey (title: string): string {
  return structuredRawLinkValue('title', ['0', '', title])
}

function titleTargetKeyWithSpaceKey (spaceKey: string, title: string): string {
  return structuredRawLinkValue('title', ['1', spaceKey, title])
}

function appendFragment (pathValue: string, fragment: string): string {
  return fragment === '' ? pathValue : `${pathValue}#${fragment}`
}

function unescapeGeneratedMarkers (value: string): string {
  return value.replace(/\\\[(unresolved|neutralized|unsupported): ([^\n]*?)\]/g, (_match: string, markerKind: string, body: string) => {
    return `[${markerKind}: ${body.replace(/\\_/g, '_')}]`
  })
}

function escapeDoubleQuotes (value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function arrayValue (value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function isStringMap (value: unknown): value is Map<string, string> {
  if (!(value instanceof Map)) {
    return false
  }

  for (const [key, mapValue] of value.entries()) {
    if (typeof key !== 'string' || typeof mapValue !== 'string') {
      return false
    }
  }

  return true
}

function isRecord (value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isLinkOrImage (value: unknown): value is LinkOrImage {
  return isRecord(value) &&
    (value.type === 'link' || value.type === 'image') &&
    typeof value.url === 'string'
}

function isMutableParent (value: unknown): value is MutableParent {
  return isRecord(value) && Array.isArray(value.children)
}

async function markdownModules (): Promise<MarkdownModules> {
  markdownModulesPromise ??= loadMarkdownModules()
  return markdownModulesPromise
}

async function loadMarkdownModules (): Promise<MarkdownModules> {
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

  const fromMarkdown: FromMarkdown = (payload, options) => {
    return fromMarkdownModule.fromMarkdown(payload, options as Parameters<typeof fromMarkdownModule.fromMarkdown>[1])
  }
  const toMarkdown: ToMarkdown = (tree, options) => {
    return toMarkdownModule.toMarkdown(tree, options as Parameters<typeof toMarkdownModule.toMarkdown>[1])
  }
  const visit: Visit = (tree, test, visitor) => {
    visitModule.visit(tree, [...test], (node, index, parent) => {
      return visitor(node, typeof index === 'number' ? index : undefined, parent)
    })
  }

  return {
    fromMarkdown,
    gfm: micromarkGfmModule.gfm,
    gfmFromMarkdown: mdastGfmModule.gfmFromMarkdown,
    gfmToMarkdown: mdastGfmModule.gfmToMarkdown,
    toMarkdown,
    visit
  }
}
