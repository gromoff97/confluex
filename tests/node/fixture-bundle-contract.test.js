'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const repoRoot = path.resolve(__dirname, '../..')
const contentRoot = path.join(repoRoot, 'tests/fixtures/confluence-7137/content')
const richPageLogicalNames = [
  'root_page',
  'child_page',
  'grandchild_page',
  'messy_table_page',
  'messy_russian_page',
  'messy_punctuation_page',
  'messy_code_macro_page',
  'messy_deep_level_1',
  'messy_deep_level_2',
  'messy_deep_level_3',
  'messy_wide_child_a',
  'messy_wide_child_b',
  'messy_wide_child_c',
  'messy_attachment_page',
  'messy_links_page',
  'linked_page',
  'linked_scope_root',
  'linked_scope_linked_page',
  'linked_scope_linked_descendant',
  'linked_scope_link_of_link',
  'ambiguous_root_page',
  'scope_noise_root',
  'cross_space_page',
  'markdown_page',
  'duplicate_title_primary',
  'duplicate_title_secondary'
]

function bodyText (page) {
  return fs.readFileSync(path.join(contentRoot, page.body_path), 'utf8')
}

function countMatches (text, pattern) {
  return Array.from(text.matchAll(pattern)).length
}

function pageChildrenByParent (pages) {
  const counts = new Map()
  for (const page of pages) {
    if (typeof page.parent === 'string') {
      counts.set(page.parent, (counts.get(page.parent) || 0) + 1)
    }
  }
  return counts
}

function countPageAttachments (page) {
  return Array.isArray(page.attachments) ? page.attachments.length : 0
}

test('canonical fixture bundle uses manifest plus storage XML pages and real attachments', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(contentRoot, 'manifest.json'), 'utf8'))
  assert.deepEqual(Object.keys(manifest).sort(), ['attachments', 'pages', 'spaces'])

  const inventoryPath = path.join(contentRoot, 'macro-inventory.json')
  assert.equal(fs.existsSync(inventoryPath), true, 'macro inventory file must exist')

  const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'))
  assert.deepEqual(Object.keys(inventory).sort(), ['macro_classes', 'page_targets'])
  assert.equal(Array.isArray(inventory.macro_classes), true)
  assert.equal(typeof inventory.page_targets === 'object' && inventory.page_targets !== null, true)

  const readabilityPath = path.join(repoRoot, 'tests/fixtures/confluence-7137/expected/readability-risk.json')
  assert.equal(fs.existsSync(readabilityPath), true, 'readability risk audit file must exist')

  const readability = JSON.parse(fs.readFileSync(readabilityPath, 'utf8'))
  assert.deepEqual(Object.keys(readability).sort(), ['pages'])
  assert.equal(Array.isArray(readability.pages), true)

  const allowedVerdicts = new Set(['bad_but_stable', 'degraded', 'good'])
  const auditedNames = readability.pages.map((entry) => entry.logical_name)
  const expectedAuditedNames = Object.keys(inventory.page_targets).sort()

  assert.deepEqual(auditedNames.slice().sort(), expectedAuditedNames)
  for (const entry of readability.pages) {
    assert.equal(Array.isArray(entry.macro_classes), true)
    assert.deepEqual(entry.macro_classes, inventory.page_targets[entry.logical_name])
    assert.equal(allowedVerdicts.has(entry.verdict), true, `unexpected verdict for ${entry.logical_name}`)
    assert.equal(typeof entry.reason === 'string' && entry.reason.length > 0, true)
  }

  const requiredMacroNames = [
    'attachments',
    'children',
    'code',
    'details',
    'detailssummary',
    'excerpt-include',
    'excerpt',
    'expand',
    'gallery',
    'info',
    'noformat',
    'note',
    'panel',
    'pagetree',
    'status',
    'tip',
    'toc',
    'warning'
  ]

  assert.deepEqual(
    inventory.macro_classes.map((entry) => entry.macro_name).sort(),
    requiredMacroNames.slice().sort()
  )

  assert.deepEqual(manifest.spaces, [
    { logical_name: 'fixture_space', key: 'CX', name: 'Confluex Fixture Space' },
    { logical_name: 'aux_space', key: 'AUX', name: 'Confluex Auxiliary Space' }
  ])

  const duplicatePages = manifest.pages.filter((page) =>
    page.logical_name === 'duplicate_title_primary' ||
    page.logical_name === 'duplicate_title_secondary'
  )
  assert.deepEqual(duplicatePages.map((page) => ({
    logical_name: page.logical_name,
    space: page.space,
    title: page.title,
    body_path: page.body_path
  })), [
    {
      logical_name: 'duplicate_title_primary',
      space: 'fixture_space',
      title: 'Shared Fixture Title',
      body_path: 'pages/duplicate_title_primary.storage.xml'
    },
    {
      logical_name: 'duplicate_title_secondary',
      space: 'aux_space',
      title: 'Shared Fixture Title',
      body_path: 'pages/duplicate_title_secondary.storage.xml'
    }
  ])

  const pagesByLogicalName = new Map(manifest.pages.map(page => [page.logical_name, page]))
  const requiredMessyPages = [
    'messy_table_page',
    'messy_russian_page',
    'messy_punctuation_page',
    'messy_code_macro_page',
    'messy_deep_level_1',
    'messy_deep_level_2',
    'messy_deep_level_3',
    'messy_wide_child_a',
    'messy_wide_child_b',
    'messy_wide_child_c',
    'messy_attachment_page',
    'messy_links_page'
  ]

  for (const logicalName of requiredMessyPages) {
    assert.equal(pagesByLogicalName.has(logicalName), true, logicalName)
  }

  assert.equal(pagesByLogicalName.get('messy_deep_level_1').parent, 'root_page')
  assert.equal(pagesByLogicalName.get('messy_deep_level_2').parent, 'messy_deep_level_1')
  assert.equal(pagesByLogicalName.get('messy_deep_level_3').parent, 'messy_deep_level_2')
  assert.equal(pagesByLogicalName.get('messy_wide_child_a').parent, 'root_page')
  assert.equal(pagesByLogicalName.get('messy_wide_child_b').parent, 'root_page')
  assert.equal(pagesByLogicalName.get('messy_wide_child_c').parent, 'root_page')
  assert.deepEqual(pagesByLogicalName.get('messy_attachment_page').attachments, [
    'messy_text_attachment',
    'messy_csv_attachment',
    'messy_binary_attachment',
    'messy_diagram_png',
    'messy_diagram_copy_png',
    'messy_report_pdf',
    'messy_cyrillic_csv',
    'messy_empty_note'
  ])

  for (const page of manifest.pages) {
    const bodyPath = path.join(contentRoot, page.body_path)
    assert.equal(fs.existsSync(bodyPath), true, page.logical_name)
    assert.match(fs.readFileSync(bodyPath, 'utf8'), /</)
  }

  for (const attachment of manifest.attachments) {
    const attachmentPath = path.join(contentRoot, attachment.path)
    assert.equal(fs.existsSync(attachmentPath), true, attachment.logical_name)
  }
})

test('canonical fixture bundle stays rich enough for markdown golden regression', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(contentRoot, 'manifest.json'), 'utf8'))
  const inventory = JSON.parse(fs.readFileSync(path.join(contentRoot, 'macro-inventory.json'), 'utf8'))
  const pagesByLogicalName = new Map(manifest.pages.map(page => [page.logical_name, page]))
  const richPages = richPageLogicalNames.map((logicalName) => {
    const page = pagesByLogicalName.get(logicalName)
    assert.notEqual(page, undefined, logicalName)
    return page
  })
  const richBodies = richPages.map(bodyText)
  const allBodies = manifest.pages.map(bodyText)
  const allRichStorage = richBodies.join('\n')
  const tableCounts = richBodies.map(text => countMatches(text, /<table\b/g))
  const allTableCounts = allBodies.map(text => countMatches(text, /<table\b/g))
  const linkCounts = richBodies.map(text => countMatches(text, /<ac:link\b|<a\s+href=|<ri:page\b|<ri:url\b/g))
  const allLinkCounts = allBodies.map(text => countMatches(text, /<ac:link\b|<a\s+href=|<ri:page\b|<ri:url\b/g))
  const macroCounts = richBodies.map(text => countMatches(text, /<ac:structured-macro\b/g))
  const attachmentReferenceCounts = richBodies.map(text => countMatches(text, /<ri:attachment\b/g))
  const childCounts = pageChildrenByParent(manifest.pages)
  const attachmentCounts = manifest.pages.map(countPageAttachments)
  const attachmentExtensions = new Set(manifest.attachments.map((attachment) =>
    path.extname(attachment.path).toLowerCase()
  ))
  const structuredMacroNames = Array.from(
    allRichStorage.matchAll(/ac:structured-macro[^>]*ac:name="([^"]+)"/g),
    (match) => match[1]
  )
  const uniqueStructuredMacroNames = new Set(structuredMacroNames)
  const taskListPageCount = allBodies.filter((text) => text.includes('<ac:task-list>')).length
  const tocPageCount = allBodies.filter((text) => text.includes('ac:name="toc"')).length
  const childrenMacroPageCount = allBodies.filter((text) => text.includes('ac:name="children"')).length
  const requiredMacroNames = inventory.macro_classes.map((entry) => entry.macro_name)

  assert.equal(manifest.pages.length >= 25 && manifest.pages.length <= 35, true, 'page count must stay heavy but manageable')
  assert.equal(richBodies.filter(text => Buffer.byteLength(text, 'utf8') >= 2500).length >= 18, true, 'most rich pages must be dense')
  assert.equal(tableCounts.reduce((sum, value) => sum + value, 0) >= 18, true, 'table count')
  assert.equal(allTableCounts.filter(value => value === 0).length >= 3, true, 'zero-table pages')
  assert.equal(allTableCounts.filter(value => value === 1).length >= 3, true, 'single-table pages')
  assert.equal(allTableCounts.filter(value => value >= 2).length >= 5, true, 'many-table pages')
  assert.equal(linkCounts.reduce((sum, value) => sum + value, 0) >= 55, true, 'link count')
  assert.equal(allLinkCounts.filter(value => value === 0).length >= 2, true, 'zero-link pages')
  assert.equal(allLinkCounts.filter(value => value === 1).length >= 1, true, 'single-link pages')
  assert.equal(allLinkCounts.filter(value => value >= 5).length >= 5, true, 'many-link pages')
  assert.equal(macroCounts.reduce((sum, value) => sum + value, 0) >= 12, true, 'macro count')
  assert.equal(attachmentReferenceCounts.reduce((sum, value) => sum + value, 0) >= 8, true, 'body attachment reference count')
  assert.equal(manifest.attachments.length >= 12, true, 'attachment count')
  assert.equal(attachmentExtensions.size >= 6, true, 'attachment extension diversity')
  assert.equal(attachmentCounts.some(value => value === 0), true, 'zero attachment page')
  assert.equal(attachmentCounts.some(value => value === 1), true, 'single attachment page')
  assert.equal(attachmentCounts.some(value => value >= 4), true, 'many attachment page')
  assert.equal(Array.from(childCounts.values()).some(value => value === 1), true, 'single child parent')
  assert.equal(Array.from(childCounts.values()).some(value => value >= 8), true, 'wide parent')
  assert.equal(childCounts.get('messy_deep_level_1'), 1, 'deep level 1 child count')
  assert.equal(childCounts.get('messy_deep_level_2'), 1, 'deep level 2 child count')
  for (const macroName of requiredMacroNames) {
    assert.equal(uniqueStructuredMacroNames.has(macroName), true, `missing macro ${macroName}`)
  }
  assert.equal(uniqueStructuredMacroNames.size >= requiredMacroNames.length, true, 'unique macro class count')
  assert.equal(taskListPageCount >= 1, true, 'task-list coverage')
  assert.equal(tocPageCount >= 1, true, 'toc coverage')
  assert.equal(childrenMacroPageCount >= 1, true, 'children macro coverage')
  assert.match(allRichStorage, /ri:space-key="AUX"|spaceKey=AUX|\/display\/AUX\//)
  assert.match(allRichStorage, /broken-|missing-|not-found|unresolved|invalid/i)
  assert.match(allRichStorage, /&lt;|&gt;|&amp;|&quot;|&#39;/)
  assert.match(allRichStorage, /Рус|кирил|пример|данн/i)
})
