'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const repoRoot = path.resolve(__dirname, '../..')
const goldenRoot = path.join(repoRoot, 'fixtures/confluence-7137/expected/golden/export-root-tree-md')

function readTsv (relativePath) {
  const text = fs.readFileSync(path.join(goldenRoot, relativePath), 'utf8').trimEnd()
  const [headerLine, ...lines] = text.split('\n')
  const headers = headerLine.split('\t')

  return lines
    .filter(line => line.length > 0)
    .map(line => {
      const fields = line.split('\t')
      return Object.fromEntries(headers.map((header, index) => [header, fields[index]]))
    })
}

function pageId (logicalName) {
  return `<page-id:${logicalName}>`
}

function assertManifestSource (manifestRows, logicalName, discoverySource) {
  assert.equal(
    manifestRows.find(row => row.page_id === pageId(logicalName))?.discovery_source,
    discoverySource,
    `${logicalName} discovery_source`
  )
}

function assertResolvedLink (resolvedRows, sourceLogicalName, targetLogicalName, linkKind) {
  assert.equal(
    resolvedRows.some(row =>
      row.source_page_id === pageId(sourceLogicalName) &&
      row.target_page_id === pageId(targetLogicalName) &&
      row.link_kind === linkKind
    ),
    true,
    `${sourceLogicalName} -> ${targetLogicalName} ${linkKind}`
  )
}

test('root-tree golden snapshot preserves duplicate discovery and cycle edge cases', () => {
  const manifestRows = readTsv('manifest.tsv.template')
  const resolvedRows = readTsv('resolved-links.tsv.template')

  const manifestPageIds = manifestRows.map(row => row.page_id)
  assert.equal(new Set(manifestPageIds).size, manifestPageIds.length, 'manifest must not contain duplicate page ids')

  assertManifestSource(manifestRows, 'root_page', 'root')
  assertManifestSource(manifestRows, 'child_page', 'tree')
  assertManifestSource(manifestRows, 'grandchild_page', 'tree')
  assertManifestSource(manifestRows, 'messy_table_page', 'tree')
  assertManifestSource(manifestRows, 'messy_links_page', 'tree')
  assertManifestSource(manifestRows, 'linked_scope_root', 'linked')
  assertManifestSource(manifestRows, 'linked_scope_linked_page', 'linked')
  assertManifestSource(manifestRows, 'linked_scope_link_of_link', 'linked')

  assert.equal(
    manifestRows.some(row => row.page_id === pageId('linked_scope_linked_descendant')),
    false,
    'linked-only descendants must not enter the root-tree golden export'
  )

  assertResolvedLink(resolvedRows, 'root_page', 'child_page', 'child_result')
  assertResolvedLink(resolvedRows, 'root_page', 'child_page', 'page_ref')
  assertResolvedLink(resolvedRows, 'root_page', 'messy_table_page', 'child_result')
  assertResolvedLink(resolvedRows, 'root_page', 'messy_table_page', 'page_ref')
  assertResolvedLink(resolvedRows, 'child_page', 'grandchild_page', 'child_result')
  assertResolvedLink(resolvedRows, 'child_page', 'grandchild_page', 'page_ref')

  assertResolvedLink(resolvedRows, 'child_page', 'root_page', 'page_ref')
  assertResolvedLink(resolvedRows, 'grandchild_page', 'child_page', 'page_ref')
  assertResolvedLink(resolvedRows, 'messy_deep_level_1', 'messy_deep_level_1', 'page_ref')
  assertResolvedLink(resolvedRows, 'messy_deep_level_2', 'messy_deep_level_1', 'page_ref')
  assertResolvedLink(resolvedRows, 'messy_deep_level_3', 'messy_deep_level_2', 'page_ref')
  assertResolvedLink(resolvedRows, 'messy_wide_child_a', 'messy_wide_child_b', 'page_ref')
  assertResolvedLink(resolvedRows, 'messy_wide_child_b', 'messy_wide_child_a', 'page_ref')

  assertResolvedLink(resolvedRows, 'root_page', 'linked_scope_root', 'content_id')
  assertResolvedLink(resolvedRows, 'messy_deep_level_3', 'linked_scope_link_of_link', 'page_ref')
  assertResolvedLink(resolvedRows, 'messy_links_page', 'linked_scope_linked_page', 'content_id')

  const linkedOnlySources = new Set([
    pageId('linked_scope_root'),
    pageId('linked_scope_linked_page'),
    pageId('linked_scope_link_of_link')
  ])
  assert.equal(
    resolvedRows.some(row => linkedOnlySources.has(row.source_page_id)),
    false,
    'linked-only pages must not add second-hop resolved-link rows to golden scope'
  )
})
