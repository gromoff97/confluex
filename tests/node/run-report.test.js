'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const {
  emptyRunReportTexts,
  runReportTexts,
  writeRunReportSet
} = require('../../lib/confluex-node/reports/run-report')

test('empty run report texts use governed report filenames headers and summary order', () => {
  const report = emptyRunReportTexts({
    command: 'plan',
    pageId: '123',
    outputRoot: '/tmp/confluex-plan',
    outputPathProvenance: 'explicit',
    pagePayloadFormat: 'none',
    finalStatus: 'incomplete',
    scopeTrust: 'degraded',
    interruptReason: 'max_pages_limit_reached',
    encryptionEnabled: false,
    encryptionSuccessful: false
  })

  assert.deepEqual(Object.keys(report), [
    'manifest.tsv',
    'resolved-links.tsv',
    'unresolved-links.tsv',
    'failed-pages.tsv',
    'scope-findings.tsv',
    'summary.txt'
  ])
  assert.equal(report['manifest.tsv'], 'page_id\tspace_key\tpage_title\tfolder\tdiscovery_source\trun_mode\tattachment_count\n')
  assert.equal(report['resolved-links.tsv'], 'source_page_id\tsource_title\tlink_kind\traw_link_value\ttarget_page_id\ttarget_space_key\ttarget_title\n')
  assert.equal(report['unresolved-links.tsv'], 'source_page_id\tsource_title\tlink_kind\traw_link_value\tresolution_reason\n')
  assert.equal(report['failed-pages.tsv'], 'page_id\tpage_title\toperation\terror_summary\n')
  assert.equal(report['scope-findings.tsv'], 'page_id\tfinding_area\tfinding_type\tdetail\n')
  assert.equal(report['summary.txt'], [
    'command=plan',
    'page_id=123',
    'output_root="/tmp/confluex-plan"',
    'zip_path=none',
    'output_path_provenance=explicit',
    'support_profile=default',
    'page_payload_format=none',
    'final_status=incomplete',
    'scope_trust=degraded',
    'processed_pages=0',
    'root_pages=0',
    'tree_pages=0',
    'linked_pages=0',
    'other_pages=0',
    'resolved_links=0',
    'unresolved_links=0',
    'scope_findings=0',
    'failed_operations=0',
    'downloaded_mib_total=0.000',
    'downloaded_mib_content=0.000',
    'downloaded_mib_metadata=0.000',
    'blocking_reasons=none',
    'interrupt_reason=max_pages_limit_reached',
    'resume_mode=0',
    'resume_schema_version=2',
    'reused_pages=0',
    'fresh_pages=0',
    'encryption_enabled=0',
    'encryption_successful=0',
    ''
  ].join('\n'))
})

test('runReportTexts serializes retained zip path', () => {
  const report = runReportTexts({
    command: 'export',
    pageId: '123',
    outputRoot: '/tmp/confluex-export',
    zipPath: '/tmp/confluex-export.zip',
    outputPathProvenance: 'explicit',
    pagePayloadFormat: 'md',
    finalStatus: 'success',
    scopeTrust: 'trusted',
    interruptReason: 'none',
    encryptionEnabled: false,
    encryptionSuccessful: false
  })

  assert.match(report['summary.txt'], /^output_root="\/tmp\/confluex-export"\nzip_path="\/tmp\/confluex-export\.zip"\noutput_path_provenance=explicit$/m)
})

test('writeRunReportSet materializes exactly the closed report-file set', async () => {
  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-run-report-'))
  const report = emptyRunReportTexts({
    command: 'export',
    pageId: '456',
    outputRoot,
    outputPathProvenance: 'generated',
    pagePayloadFormat: 'md',
    finalStatus: 'success',
    scopeTrust: 'trusted',
    interruptReason: 'none',
    encryptionEnabled: false,
    encryptionSuccessful: false
  })

  await writeRunReportSet(outputRoot, report)

  assert.deepEqual(fs.readdirSync(outputRoot).sort(), Object.keys(report).sort())
  for (const [name, text] of Object.entries(report)) {
    assert.equal(fs.readFileSync(path.join(outputRoot, name), 'utf8'), text)
  }
})

test('runReportTexts serializes rows counts blocking reasons and TSV escaping', () => {
  const report = runReportTexts({
    command: 'plan',
    pageId: '123',
    outputRoot: '/tmp/confluex-plan',
    outputPathProvenance: 'generated',
    pagePayloadFormat: 'none',
    finalStatus: 'success_with_findings',
    scopeTrust: 'degraded',
    interruptReason: 'none',
    encryptionEnabled: false,
    encryptionSuccessful: false,
    manifestRows: [
      {
        page_id: '456',
        space_key: 'AUX',
        page_title: 'Linked',
        folder: 'none',
        discovery_source: 'linked',
        run_mode: 'plan',
        attachment_count: '0'
      },
      {
        page_id: '123',
        space_key: 'CX',
        page_title: 'none',
        folder: 'none',
        discovery_source: 'root',
        run_mode: 'plan',
        attachment_count: 'none'
      }
    ],
    scopeFindingRows: [
      {
        page_id: '123',
        finding_area: 'child_listing',
        finding_type: 'incomplete_tree',
        detail: 'child_listing_incomplete'
      }
    ]
  })

  assert.equal(report['manifest.tsv'], [
    'page_id\tspace_key\tpage_title\tfolder\tdiscovery_source\trun_mode\tattachment_count',
    '123\tCX\t\\none\tnone\troot\tplan\tnone',
    '456\tAUX\tLinked\tnone\tlinked\tplan\t0',
    ''
  ].join('\n'))
  assert.equal(report['scope-findings.tsv'], [
    'page_id\tfinding_area\tfinding_type\tdetail',
    '123\tchild_listing\tincomplete_tree\tchild_listing_incomplete',
    ''
  ].join('\n'))
  assert.match(report['summary.txt'], /^processed_pages=2$/m)
  assert.match(report['summary.txt'], /^root_pages=1$/m)
  assert.match(report['summary.txt'], /^linked_pages=1$/m)
  assert.match(report['summary.txt'], /^scope_findings=1$/m)
  assert.match(report['summary.txt'], /^blocking_reasons=scope_findings$/m)
  assert.match(report['summary.txt'], /^fresh_pages=2$/m)
})

test('runReportTexts serializes resumed export reuse accounting', () => {
  const report = runReportTexts({
    command: 'export',
    pageId: '123',
    outputRoot: '/tmp/confluex-export',
    outputPathProvenance: 'explicit',
    pagePayloadFormat: 'md',
    finalStatus: 'success',
    scopeTrust: 'trusted',
    interruptReason: 'none',
    resumeMode: true,
    reusedPages: 1,
    freshPages: 0,
    encryptionEnabled: false,
    encryptionSuccessful: false,
    manifestRows: [
      {
        page_id: '123',
        space_key: 'CX',
        page_title: 'Root Page',
        folder: 'pages/space__4358/page__123',
        discovery_source: 'root',
        run_mode: 'export',
        attachment_count: 'none'
      }
    ]
  })

  assert.match(report['summary.txt'], /^resume_mode=1$/m)
  assert.match(report['summary.txt'], /^reused_pages=1$/m)
  assert.match(report['summary.txt'], /^fresh_pages=0$/m)
})

test('runReportTexts serializes markdown payload remnant findings', () => {
  const report = runReportTexts({
    command: 'export',
    pageId: '123',
    outputRoot: '/tmp/confluex-export',
    outputPathProvenance: 'explicit',
    pagePayloadFormat: 'md',
    finalStatus: 'success_with_findings',
    scopeTrust: 'degraded',
    interruptReason: 'none',
    encryptionEnabled: false,
    encryptionSuccessful: false,
    manifestRows: [
      {
        page_id: '123',
        space_key: 'CX',
        page_title: 'Root Page',
        folder: 'pages/space__4358/page__123',
        discovery_source: 'root',
        run_mode: 'export',
        attachment_count: 'none'
      }
    ],
    scopeFindingRows: [
      {
        page_id: '123',
        finding_area: 'page_payload',
        finding_type: 'markdown_remnant',
        detail: 'markdown_remnant_kind=html_remnant;token=<p'
      }
    ]
  })

  assert.equal(report['scope-findings.tsv'], [
    'page_id\tfinding_area\tfinding_type\tdetail',
    '123\tpage_payload\tmarkdown_remnant\tmarkdown_remnant_kind=html_remnant;token=<p',
    ''
  ].join('\n'))
  assert.match(report['summary.txt'], /^scope_findings=1$/m)
  assert.match(report['summary.txt'], /^blocking_reasons=scope_findings$/m)
})
