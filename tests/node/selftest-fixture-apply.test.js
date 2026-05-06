'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const { applyFixtureDataset } = require('../../lib/confluex-node/selftest/fixture-apply')

const repoRoot = path.resolve(__dirname, '../..')
const identityOrder = [
  'fixture_space',
  'aux_space',
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
  'download_limit_child_d_page',
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
]

test('fixture apply helper creates canonical dataset and returns ordered identities', async () => {
  const operations = []
  let nextPageId = 1000
  const client = {
    async applySpace (space) {
      operations.push(['space', space.logicalName, space.key, space.name])
      return {
        spaceKey: space.key,
        spaceName: space.name
      }
    },
    async applyPage (page) {
      const pageId = String(nextPageId)
      nextPageId += 1
      operations.push(['page', page.logicalName, page.spaceKey, page.title, page.parentId || 'none', page.bodyStorage])
      return { pageId }
    },
    async applyAttachment (attachment) {
      operations.push(['attachment', attachment.logicalName, attachment.pageId, attachment.filename, attachment.mediaType, attachment.bytes.length])
      return { filename: attachment.filename }
    }
  }

  const result = await applyFixtureDataset(repoRoot, { client })

  assert.equal(result.state, 'passed')
  assert.deepEqual(Object.keys(result.identities), identityOrder)
  assert.deepEqual(result.identities.fixture_space, {
    space_key: 'CX',
    space_name: 'Confluex Fixture Space'
  })
  assert.deepEqual(result.identities.root_page, {
    page_id: result.identities.root_page.page_id,
    title: 'CX Root',
    space_key: 'CX'
  })
  assert.deepEqual(result.identities.root_attachment, {
    page_id: result.identities.root_page.page_id,
    filename: 'root-note.txt'
  })

  const pageOperations = operations.filter(operation => operation[0] === 'page')
  const pageOperationByName = new Map(pageOperations.map(operation => [operation[1], operation]))
  assert.equal(pageOperationByName.get('root_page')[5].includes('{{page_id:'), false)
  assert.equal(pageOperationByName.get('root_page')[5].includes(result.identities.linked_page.page_id), true)
  assert.equal(pageOperationByName.get('root_page')[5].includes('{{page_id:messy_'), false)
  assert.equal(pageOperationByName.get('linked_scope_root')[5].includes(result.identities.linked_scope_linked_page.page_id), true)
  assert.equal(pageOperationByName.get('linked_scope_linked_page')[5].includes(result.identities.linked_scope_link_of_link.page_id), true)
  assert.match(pageOperationByName.get('ambiguous_root_page')[5], /ri:content-title="Shared Fixture Title"/)
  assert.equal(pageOperationByName.get('child_page')[4], result.identities.root_page.page_id)
  assert.equal(pageOperationByName.get('grandchild_page')[4], result.identities.child_page.page_id)
  assert.deepEqual(operations.filter(operation => operation[0] === 'attachment').map(operation => operation.slice(1)), [
    ['root_attachment', result.identities.root_page.page_id, 'root-note.txt', 'text/plain', 24],
    ['markdown_attachment', result.identities.markdown_page.page_id, 'markdown-note.txt', 'text/plain', 28],
    ['messy_text_attachment', result.identities.messy_attachment_page.page_id, 'notes-with-spaces.txt', 'text/plain', 60],
    ['messy_csv_attachment', result.identities.messy_attachment_page.page_id, 'data.csv', 'text/csv', 36],
    ['messy_binary_attachment', result.identities.messy_attachment_page.page_id, 'blob.bin', 'application/octet-stream', 22],
    ['root_overview_chart_png', result.identities.root_page.page_id, 'overview-chart.png', 'image/png', 68],
    ['root_summary_photo_jpg', result.identities.root_page.page_id, 'summary-photo.jpg', 'image/jpeg', 516],
    ['messy_diagram_png', result.identities.messy_attachment_page.page_id, 'diagram-final.png', 'image/png', 68],
    ['messy_diagram_copy_png', result.identities.messy_attachment_page.page_id, 'diagram-final-copy.png', 'image/png', 68],
    ['messy_report_pdf', result.identities.messy_attachment_page.page_id, 'report-synthetic.pdf', 'application/pdf', 218],
    ['messy_cyrillic_csv', result.identities.messy_attachment_page.page_id, 'table-export-cyrillic.csv', 'text/csv', 88],
    ['messy_empty_note', result.identities.messy_attachment_page.page_id, 'empty-note.txt', 'text/plain', 0],
    ['messy_links_targets_txt', result.identities.messy_links_page.page_id, 'link-targets.txt', 'text/plain', 148],
    ['linked_out_of_tree_reference_txt', result.identities.linked_page.page_id, 'out-of-tree-reference.txt', 'text/plain', 91],
    ['aux_cross_space_image_png', result.identities.cross_space_page.page_id, 'aux-image.png', 'image/png', 68]
  ])
})

test('fixture apply helper fails when a page dependency cannot be resolved', async () => {
  const result = await applyFixtureDataset(repoRoot, {
    bundle: {
      contentRoot: path.join(repoRoot, 'tests/fixtures/confluence-7137/content'),
      spaces: [{
        logicalName: 'fixture_space',
        spaceKey: 'CX',
        spaceName: 'Confluex Fixture Space'
      }],
      pages: [{
        logicalName: 'broken_page',
        spaceLogicalName: 'fixture_space',
        title: 'Broken',
        parentLogicalName: null,
        bodyStoragePath: 'pages/broken_page.storage.xml',
        bodyStorageAbsolutePath: path.join(repoRoot, 'tests/fixtures/confluence-7137/content/pages/broken_page.storage.xml'),
        bodyStorageTemplate: '<p>{{page_id:missing_page}}</p>',
        attachmentLogicalNames: []
      }],
      attachments: []
    },
    client: {
      async applySpace () {
        return {
          spaceKey: 'CX',
          spaceName: 'Confluex Fixture Space'
        }
      },
      async applyPage () {
        return { pageId: '1' }
      },
      async applyAttachment () {
        return {}
      }
    }
  })

  assert.deepEqual(result, { state: 'failed' })
})
