'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { compareGoldenSnapshot } = require('../../lib/confluex-node/selftest/golden-snapshot')

function tempDir (prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

function writeFile (root, relativePath, content, encoding = 'utf8') {
  const absolutePath = path.join(root, relativePath)
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
  fs.writeFileSync(absolutePath, content, encoding)
}

function baseFixture () {
  const root = tempDir('confluex-golden-')
  const reportRoot = path.join(root, 'report')
  const expectedRoot = path.join(reportRoot, 'expected/golden/export-root-tree-md')
  const actualRoot = path.join(reportRoot, 'export/export-root-tree-md')

  fs.mkdirSync(expectedRoot, { recursive: true })
  fs.mkdirSync(actualRoot, { recursive: true })
  writeFile(reportRoot, 'identities.json', JSON.stringify({
    root_page: { page_id: '1001', title: 'Root', space_key: 'CX' },
    child_page: { page_id: '1002', title: 'Child', space_key: 'CX' },
    root_attachment: { page_id: '1001', filename: 'root-note.txt' }
  }) + '\n')

  writeFile(actualRoot, 'summary.txt', [
    'command=export',
    'output_root=' + actualRoot,
    'page_id=1001',
    ''
  ].join('\n'))
  writeFile(expectedRoot, 'summary.txt.template', [
    'command=export',
    'output_root=<output-root>',
    'page_id=<page-id:root_page>',
    ''
  ].join('\n'))

  writeFile(actualRoot, 'manifest.tsv', [
    'page_id\tspace_key\tpage_title\tfolder\tdiscovery_source\trun_mode\tattachment_count',
    '1001\tCX\tRoot\tpages/space__4358/page__1001\troot\texport\t1',
    '1002\tCX\tChild\tpages/space__4358/page__1002\ttree\texport\t0',
    ''
  ].join('\n'))
  writeFile(expectedRoot, 'manifest.tsv.template', [
    'page_id\tspace_key\tpage_title\tfolder\tdiscovery_source\trun_mode\tattachment_count',
    '<page-id:root_page>\tCX\tRoot\t<actual-folder:root_page>\troot\texport\t1',
    '<page-id:child_page>\tCX\tChild\t<actual-folder:child_page>\ttree\texport\t0',
    ''
  ].join('\n'))

  for (const name of ['resolved-links.tsv', 'unresolved-links.tsv', 'scope-findings.tsv', 'failed-pages.tsv']) {
    writeFile(actualRoot, name, 'header\n')
    writeFile(expectedRoot, `${name}.template`, 'header\n')
  }

  writeFile(actualRoot, 'pages/space__4358/page__1001/page.md', 'Root links to 1002\n')
  writeFile(expectedRoot, 'pages/root_page/page.md.template', 'Root links to <page-id:child_page>\n')
  writeFile(actualRoot, 'pages/space__4358/page__1001/attachments/root-note.txt', 'root attachment\n')
  writeFile(expectedRoot, 'pages/root_page/attachments/root-note.txt', 'root attachment\n')
  writeFile(actualRoot, 'pages/space__4358/page__1002/page.md', 'Child\n')
  writeFile(expectedRoot, 'pages/child_page/page.md.template', 'Child\n')

  return { reportRoot, expectedRoot, actualRoot }
}

test('golden snapshot comparison passes after approved placeholder substitution', () => {
  const { reportRoot, expectedRoot, actualRoot } = baseFixture()

  const result = compareGoldenSnapshot({
    reportRoot,
    expectedRoot,
    actualRoot
  })

  assert.deepEqual(result, { state: 'passed', failures: [] })
})

test('golden snapshot comparison substitutes approved summary value placeholders', () => {
  const { reportRoot, expectedRoot, actualRoot } = baseFixture()
  writeFile(actualRoot, 'summary.txt', [
    'command=export',
    'downloaded_mib_total=0.262',
    'downloaded_mib_content=0.042',
    'downloaded_mib_metadata=0.221',
    ''
  ].join('\n'))
  writeFile(expectedRoot, 'summary.txt.template', [
    'command=export',
    'downloaded_mib_total=<actual-summary:downloaded_mib_total>',
    'downloaded_mib_content=<actual-summary:downloaded_mib_content>',
    'downloaded_mib_metadata=<actual-summary:downloaded_mib_metadata>',
    ''
  ].join('\n'))

  const result = compareGoldenSnapshot({
    reportRoot,
    expectedRoot,
    actualRoot
  })

  assert.deepEqual(result, { state: 'passed', failures: [] })
})

test('golden snapshot comparison fails on text content mismatch', () => {
  const { reportRoot, expectedRoot, actualRoot } = baseFixture()
  writeFile(actualRoot, 'pages/space__4358/page__1002/page.md', 'Changed\n')

  const result = compareGoldenSnapshot({ reportRoot, expectedRoot, actualRoot })

  assert.equal(result.state, 'failed')
  assert.match(result.failures.join('\n'), /content mismatch: pages\/child_page\/page.md.template/)
})

test('golden snapshot comparison fails on attachment byte mismatch', () => {
  const { reportRoot, expectedRoot, actualRoot } = baseFixture()
  writeFile(actualRoot, 'pages/space__4358/page__1001/attachments/root-note.txt', 'changed\n')

  const result = compareGoldenSnapshot({ reportRoot, expectedRoot, actualRoot })

  assert.equal(result.state, 'failed')
  assert.match(result.failures.join('\n'), /attachment mismatch: pages\/root_page\/attachments\/root-note.txt/)
})

test('golden snapshot comparison fails on extra governed actual files', () => {
  const { reportRoot, expectedRoot, actualRoot } = baseFixture()
  writeFile(actualRoot, 'pages/space__4358/page__1002/extra.txt', 'extra\n')

  const result = compareGoldenSnapshot({ reportRoot, expectedRoot, actualRoot })

  assert.equal(result.state, 'failed')
  assert.match(result.failures.join('\n'), /extra file: pages\/space__4358\/page__1002\/extra.txt/)
})

test('golden snapshot comparison fails on markdown trailing whitespace', () => {
  const { reportRoot, expectedRoot, actualRoot } = baseFixture()
  writeFile(actualRoot, 'pages/space__4358/page__1002/page.md', 'Child  \n')
  writeFile(expectedRoot, 'pages/child_page/page.md.template', 'Child  \n')

  const result = compareGoldenSnapshot({ reportRoot, expectedRoot, actualRoot })

  assert.equal(result.state, 'failed')
  assert.match(result.failures.join('\n'), /markdown hygiene trailing whitespace/)
})

test('golden snapshot comparison fails on markdown whitespace-only lines', () => {
  const { reportRoot, expectedRoot, actualRoot } = baseFixture()
  writeFile(actualRoot, 'pages/space__4358/page__1002/page.md', 'Child\n   \nNext\n')
  writeFile(expectedRoot, 'pages/child_page/page.md.template', 'Child\n   \nNext\n')

  const result = compareGoldenSnapshot({ reportRoot, expectedRoot, actualRoot })

  assert.equal(result.state, 'failed')
  assert.match(result.failures.join('\n'), /markdown hygiene whitespace-only line/)
})

test('golden snapshot comparison fails on accidental large blank runs', () => {
  const { reportRoot, expectedRoot, actualRoot } = baseFixture()
  writeFile(actualRoot, 'pages/space__4358/page__1002/page.md', 'Child\n\n\n\nNext\n')
  writeFile(expectedRoot, 'pages/child_page/page.md.template', 'Child\n\n\n\nNext\n')

  const result = compareGoldenSnapshot({ reportRoot, expectedRoot, actualRoot })

  assert.equal(result.state, 'failed')
  assert.match(result.failures.join('\n'), /markdown hygiene excessive blank lines/)
})
