'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { quotePathString } = require('../../lib/confluex-node/path/format')
const { runSelftestCommand } = require('../../lib/confluex-node/commands/selftest')

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

function tempDir (prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

function selftestOptions () {
  return {
    flags: [],
    values: {
      '--url': 'http://127.0.0.1:8090',
      '--token': 'test-token'
    }
  }
}

test('selftest report-root failure branch emits stderr without retained root', async () => {
  const cwd = path.join(tempDir('confluex-selftest-root-failed-'), 'not-a-directory')
  fs.writeFileSync(cwd, 'file\n', 'utf8')

  const result = await runSelftestCommand(selftestOptions(), {
    cwd,
    now: new Date('2026-04-30T01:02:03Z')
  })

  assert.deepEqual(result, {
    exitCode: 4,
    stdout: '',
    stderr: 'ERROR: selftest_report_root_failed\n'
  })
})

test('selftest support preflight failure retains failed report root', async () => {
  const cwd = tempDir('confluex-selftest-support-failed-')
  const reportRoot = path.join(cwd, 'confluex_selftest_20260430T010203Z')

  const result = await runSelftestCommand(selftestOptions(), {
    cwd,
    now: new Date('2026-04-30T01:02:03Z'),
    runtimeRoot: path.join(cwd, 'missing-runtime-root')
  })

  assert.deepEqual(result, {
    exitCode: 4,
    stdout: `selftest_result=failed report_root=${quotePathString(reportRoot)}\n`,
    stderr: ''
  })
  assert.equal(fs.readFileSync(path.join(reportRoot, 'summary.txt'), 'utf8'), [
    'command=selftest',
    'confluence_version=7.13.7',
    'fixture_dataset=confluence-7137',
    'bootstrap_status=failed',
    'fixture_apply_status=not_run',
    'prepare_expected_data_status=not_run',
    'live_regression_status=not_run',
    'selftest_status=failed',
    `report_root=${quotePathString(reportRoot)}`,
    ''
  ].join('\n'))
  assert.equal(fs.readFileSync(path.join(reportRoot, 'live-bats.tap'), 'utf8'), '')
})

test('selftest runs target bootstrap after support preflight passes', async () => {
  const cwd = tempDir('confluex-selftest-bootstrap-attempted-')
  let targetBootstrapTarget = null

  const result = await runSelftestCommand(selftestOptions(), {
    cwd,
    now: new Date('2026-04-30T01:02:03Z'),
    runtimeRoot: repoRoot,
    targetBootstrap: target => {
      targetBootstrapTarget = target
      return { state: 'failed' }
    }
  })

  assert.equal(result.exitCode, 4)
  assert.deepEqual(targetBootstrapTarget, {
    baseUrl: 'http://127.0.0.1:8090',
    token: 'test-token'
  })
})

test('selftest records fixture failure after passed target bootstrap', async () => {
  const cwd = tempDir('confluex-selftest-fixture-failed-')
  const reportRoot = path.join(cwd, 'confluex_selftest_20260430T010203Z')
  let fixtureContext = null

  const result = await runSelftestCommand(selftestOptions(), {
    cwd,
    now: new Date('2026-04-30T01:02:03Z'),
    runtimeRoot: repoRoot,
    targetBootstrap: async () => ({ state: 'passed' }),
    fixtureApply: async context => {
      fixtureContext = context
      return { state: 'failed' }
    }
  })

  assert.deepEqual(result, {
    exitCode: 4,
    stdout: `selftest_result=failed report_root=${quotePathString(reportRoot)}\n`,
    stderr: ''
  })
  assert.deepEqual(fixtureContext.target, {
    baseUrl: 'http://127.0.0.1:8090',
    token: 'test-token'
  })
  assert.equal(fixtureContext.reportRoot, reportRoot)
  assert.equal(fs.readFileSync(path.join(reportRoot, 'summary.txt'), 'utf8'), [
    'command=selftest',
    'confluence_version=7.13.7',
    'fixture_dataset=confluence-7137',
    'bootstrap_status=passed',
    'fixture_apply_status=failed',
    'prepare_expected_data_status=not_run',
    'live_regression_status=not_run',
    'selftest_status=failed',
    `report_root=${quotePathString(reportRoot)}`,
    ''
  ].join('\n'))
})

test('selftest records expected-data failure after fixture application passes', async () => {
  const cwd = tempDir('confluex-selftest-expected-data-failed-')
  const reportRoot = path.join(cwd, 'confluex_selftest_20260430T010203Z')
  let expectedDataContext = null

  const result = await runSelftestCommand(selftestOptions(), {
    cwd,
    now: new Date('2026-04-30T01:02:03Z'),
    runtimeRoot: repoRoot,
    targetBootstrap: async () => ({ state: 'passed' }),
    fixtureApply: async () => ({ state: 'passed' }),
    expectedData: context => {
      expectedDataContext = context
      return { state: 'failed' }
    }
  })

  assert.deepEqual(result, {
    exitCode: 4,
    stdout: `selftest_result=failed report_root=${quotePathString(reportRoot)}\n`,
    stderr: ''
  })
  assert.deepEqual(expectedDataContext, {
    runtimeRoot: repoRoot,
    reportRoot
  })
  assert.equal(fs.readFileSync(path.join(reportRoot, 'summary.txt'), 'utf8'), [
    'command=selftest',
    'confluence_version=7.13.7',
    'fixture_dataset=confluence-7137',
    'bootstrap_status=passed',
    'fixture_apply_status=passed',
    'prepare_expected_data_status=failed',
    'live_regression_status=not_run',
    'selftest_status=failed',
    `report_root=${quotePathString(reportRoot)}`,
    ''
  ].join('\n'))
})

test('selftest records live regression failure after expected data passes', async () => {
  const cwd = tempDir('confluex-selftest-live-failed-')
  const reportRoot = path.join(cwd, 'confluex_selftest_20260430T010203Z')
  let liveContext = null

  const result = await runSelftestCommand(selftestOptions(), {
    cwd,
    now: new Date('2026-04-30T01:02:03Z'),
    runtimeRoot: repoRoot,
    targetBootstrap: async () => ({ state: 'passed' }),
    fixtureApply: async () => ({ state: 'passed' }),
    expectedData: () => ({ state: 'passed' }),
    liveRegression: async context => {
      liveContext = context
      return { state: 'failed' }
    }
  })

  assert.equal(result.exitCode, 4)
  assert.deepEqual(liveContext, {
    runtimeRoot: repoRoot,
    reportRoot,
    target: {
      baseUrl: 'http://127.0.0.1:8090',
      token: 'test-token'
    }
  })
  assert.equal(fs.readFileSync(path.join(reportRoot, 'summary.txt'), 'utf8'), [
    'command=selftest',
    'confluence_version=7.13.7',
    'fixture_dataset=confluence-7137',
    'bootstrap_status=passed',
    'fixture_apply_status=passed',
    'prepare_expected_data_status=passed',
    'live_regression_status=failed',
    'selftest_status=failed',
    `report_root=${quotePathString(reportRoot)}`,
    ''
  ].join('\n'))
})

test('selftest returns passed when every phase passes', async () => {
  const cwd = tempDir('confluex-selftest-passed-')
  const reportRoot = path.join(cwd, 'confluex_selftest_20260430T010203Z')

  const result = await runSelftestCommand(selftestOptions(), {
    cwd,
    now: new Date('2026-04-30T01:02:03Z'),
    runtimeRoot: repoRoot,
    targetBootstrap: async () => ({ state: 'passed' }),
    fixtureApply: async () => ({ state: 'passed' }),
    expectedData: () => ({ state: 'passed' }),
    liveRegression: async () => ({ state: 'passed' })
  })

  assert.deepEqual(result, {
    exitCode: 0,
    stdout: `selftest_result=passed report_root=${quotePathString(reportRoot)}\n`,
    stderr: ''
  })
  assert.equal(fs.readFileSync(path.join(reportRoot, 'summary.txt'), 'utf8'), [
    'command=selftest',
    'confluence_version=7.13.7',
    'fixture_dataset=confluence-7137',
    'bootstrap_status=passed',
    'fixture_apply_status=passed',
    'prepare_expected_data_status=passed',
    'live_regression_status=passed',
    'selftest_status=passed',
    `report_root=${quotePathString(reportRoot)}`,
    ''
  ].join('\n'))
})

test('selftest default fixture application retains canonical identities', async () => {
  const cwd = tempDir('confluex-selftest-default-fixture-')
  const reportRoot = path.join(cwd, 'confluex_selftest_20260430T010203Z')
  let nextPageId = 1000

  const result = await runSelftestCommand(selftestOptions(), {
    cwd,
    now: new Date('2026-04-30T01:02:03Z'),
    runtimeRoot: repoRoot,
    targetBootstrap: async () => ({ state: 'passed' }),
    fixtureClient: {
      async applySpace (space) {
        return {
          spaceKey: space.key,
          spaceName: space.name
        }
      },
      async applyPage () {
        const pageId = String(nextPageId)
        nextPageId += 1
        return { pageId }
      },
      async applyAttachment (attachment) {
        return { filename: attachment.filename }
      }
    },
    liveRegression: async () => ({ state: 'passed' })
  })

  assert.deepEqual(result, {
    exitCode: 0,
    stdout: `selftest_result=passed report_root=${quotePathString(reportRoot)}\n`,
    stderr: ''
  })

  const identitiesText = fs.readFileSync(path.join(reportRoot, 'identities.json'), 'utf8')
  const identities = JSON.parse(identitiesText)
  assert.equal(identitiesText.endsWith('\n'), true)
  assert.deepEqual(Object.keys(identities), identityOrder)
  assert.deepEqual(identities.fixture_space, {
    space_key: 'CX',
    space_name: 'Confluex Fixture Space'
  })
  assert.deepEqual(identities.root_page, {
    page_id: identities.root_page.page_id,
    title: 'CX Root',
    space_key: 'CX'
  })
  assert.deepEqual(identities.root_attachment, {
    page_id: identities.root_page.page_id,
    filename: 'root-note.txt'
  })
})
