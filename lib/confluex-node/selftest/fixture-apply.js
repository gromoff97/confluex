'use strict'

const { createSelftestConfluenceClient } = require('./confluence-client')
const { loadFixtureBundle } = require('./fixture-bundle')

const logicalPageOrder = [
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
  'duplicate_title_secondary',
  'download_limit_root_page',
  'download_limit_child_a_page',
  'download_limit_child_b_page',
  'download_limit_child_c_page',
  'download_limit_child_d_page'
]

async function applyFixtureDataset (runtimeRoot, dependencies = {}) {
  const client = dependencies.client || createSelftestConfluenceClient()

  try {
    const bundle = dependencies.bundle || loadFixtureBundle(runtimeRoot)
    const spaces = await applySpaces(bundle, client)
    const pages = await applyPages(bundle, spaces, client)
    const attachments = await applyAttachments(bundle, pages, client)

    return {
      state: 'passed',
      identities: buildIdentities(spaces, pages, attachments)
    }
  } catch {
    return { state: 'failed' }
  }
}

async function applySpaces (bundle, client) {
  const spaces = new Map()

  for (const space of bundle.spaces) {
    const result = await client.applySpace({
      logicalName: space.logicalName,
      key: space.spaceKey,
      name: space.spaceName
    })
    spaces.set(space.logicalName, {
      logicalName: space.logicalName,
      spaceKey: result.spaceKey,
      spaceName: result.spaceName
    })
  }

  return spaces
}

async function applyPages (bundle, spaces, client) {
  const pending = new Map(bundle.pages.map(page => [page.logicalName, page]))
  const pages = new Map()

  while (pending.size > 0) {
    let progressed = false

    for (const [logicalName, page] of Array.from(pending.entries())) {
      if (!pageDependencies(page).every(dependency => pages.has(dependency))) {
        continue
      }

      const space = spaces.get(page.spaceLogicalName)
      if (space === undefined) {
        throw new Error(`unknown fixture space: ${page.spaceLogicalName}`)
      }

      const parentId = page.parentLogicalName ? pages.get(page.parentLogicalName).pageId : null
      const bodyStorage = bodyStorageForPage(page, pages)
      const result = await client.applyPage({
        logicalName: page.logicalName,
        spaceKey: space.spaceKey,
        title: page.title,
        parentId,
        bodyStorage
      })

      pages.set(logicalName, {
        logicalName: page.logicalName,
        pageId: String(result.pageId),
        title: page.title,
        spaceKey: space.spaceKey
      })
      pending.delete(logicalName)
      progressed = true
    }

    if (!progressed) {
      throw new Error('fixture page dependencies cannot be resolved')
    }
  }

  return pages
}

async function applyAttachments (bundle, pages, client) {
  const attachments = new Map()

  for (const attachment of bundle.attachments) {
    const page = pages.get(attachment.pageLogicalName)
    if (page === undefined) {
      throw new Error(`attachment references unknown page: ${attachment.pageLogicalName}`)
    }

    await client.applyAttachment({
      logicalName: attachment.logicalName,
      pageId: page.pageId,
      filename: attachment.filename,
      mediaType: attachment.mediaType,
      bytes: attachment.bytes
    })
    attachments.set(attachment.logicalName, {
      logicalName: attachment.logicalName,
      pageId: page.pageId,
      filename: attachment.filename
    })
  }

  return attachments
}

function pageDependencies (page) {
  const dependencies = new Set()

  if (page.parentLogicalName) {
    dependencies.add(page.parentLogicalName)
  }

  if (typeof page.bodyStorageTemplate === 'string') {
    for (const match of page.bodyStorageTemplate.matchAll(/\{\{page_id:([A-Za-z0-9_.-]+)\}\}/g)) {
      dependencies.add(match[1])
    }
  }

  return Array.from(dependencies)
}

function bodyStorageForPage (page, pages) {
  if (typeof page.bodyStorageTemplate === 'string') {
    return page.bodyStorageTemplate.replace(/\{\{page_id:([A-Za-z0-9_.-]+)\}\}/g, (_match, logicalName) => {
      const dependency = pages.get(logicalName)
      if (dependency === undefined) {
        throw new Error(`body references unknown page: ${logicalName}`)
      }
      return dependency.pageId
    })
  }

  throw new Error(`page has no body storage: ${page.logicalName}`)
}

function buildIdentities (spaces, pages, attachments) {
  const identities = {}

  for (const logicalName of ['fixture_space', 'aux_space']) {
    const space = spaces.get(logicalName)
    identities[logicalName] = {
      space_key: space.spaceKey,
      space_name: space.spaceName
    }
  }

  for (const logicalName of logicalPageOrder) {
    const page = pages.get(logicalName)
    identities[logicalName] = {
      page_id: page.pageId,
      title: page.title,
      space_key: page.spaceKey
    }
  }

  for (const logicalName of [
    'root_attachment',
    'markdown_attachment',
    'messy_text_attachment',
    'messy_csv_attachment',
    'messy_binary_attachment',
    'root_overview_chart_png',
    'root_summary_photo_jpg',
    'messy_diagram_png',
    'messy_diagram_copy_png',
    'messy_report_pdf',
    'messy_cyrillic_csv',
    'messy_empty_note',
    'messy_links_targets_txt',
    'linked_out_of_tree_reference_txt',
    'aux_cross_space_image_png'
  ]) {
    const attachment = attachments.get(logicalName)
    identities[logicalName] = {
      page_id: attachment.pageId,
      filename: attachment.filename
    }
  }

  return identities
}

module.exports = {
  applyFixtureDataset
}
