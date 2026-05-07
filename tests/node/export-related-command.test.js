'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { runExportRelatedCommand } = require('../../lib/confluex-node/commands/export-related')
const { normalizeMarkdownPayload } = require('../../lib/confluex-node/payload/markdown')
const { quotePathString } = require('../../lib/confluex-node/path/format')

function options ({ pageId = '123', out, flags = [], values = {} } = {}) {
  return {
    flags,
    values: {
      '--page-id': pageId,
      ...(out === undefined ? {} : { '--out': out }),
      ...values
    }
  }
}

function escapeRegExp (value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function successfulPagePayload (payload, diagnostics = []) {
  return async () => ({
    state: 'ok',
    payload,
    diagnostics
  })
}

function readStoredZipEntries (zipPath) {
  const data = fs.readFileSync(zipPath)
  const endOfCentralDirectoryOffset = data.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  assert.notEqual(endOfCentralDirectoryOffset, -1)
  const centralDirectoryEntryCount = data.readUInt16LE(endOfCentralDirectoryOffset + 10)
  let centralDirectoryOffset = data.readUInt32LE(endOfCentralDirectoryOffset + 16)
  const entries = []

  for (let index = 0; index < centralDirectoryEntryCount; index += 1) {
    assert.equal(data.readUInt32LE(centralDirectoryOffset), 0x02014b50)
    const compressionMethod = data.readUInt16LE(centralDirectoryOffset + 10)
    const compressedSize = data.readUInt32LE(centralDirectoryOffset + 20)
    const nameLength = data.readUInt16LE(centralDirectoryOffset + 28)
    const extraLength = data.readUInt16LE(centralDirectoryOffset + 30)
    const commentLength = data.readUInt16LE(centralDirectoryOffset + 32)
    const localHeaderOffset = data.readUInt32LE(centralDirectoryOffset + 42)
    const name = data.subarray(centralDirectoryOffset + 46, centralDirectoryOffset + 46 + nameLength).toString('utf8')

    assert.equal(compressionMethod, 0)
    assert.equal(data.readUInt32LE(localHeaderOffset), 0x04034b50)
    const localNameLength = data.readUInt16LE(localHeaderOffset + 26)
    const localExtraLength = data.readUInt16LE(localHeaderOffset + 28)
    const contentStart = localHeaderOffset + 30 + localNameLength + localExtraLength
    entries.push({
      name,
      content: data.subarray(contentStart, contentStart + compressedSize)
    })
    centralDirectoryOffset += 46 + nameLength + extraLength + commentLength
  }

  return entries
}

test('export rejects inaccessible root page before output-root creation', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-export-preflight-')), 'out')

  const result = await runExportRelatedCommand('export', options({ out }), {
    checkRootPageAccess: async pageId => {
      assert.equal(pageId, '123')
      return { state: 'failed' }
    }
  })

  assert.equal(result.exitCode, 1)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, 'ERROR: validation_failed FR-0017 --page-id 123\n')
  assert.equal(fs.existsSync(out), false)
})

test('plan rejects inaccessible root page with plan command surface already validated', async () => {
  const result = await runExportRelatedCommand('plan', options({ pageId: '456' }), {
    checkRootPageAccess: async pageId => {
      assert.equal(pageId, '456')
      return { state: 'failed' }
    }
  })

  assert.equal(result.exitCode, 1)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, 'ERROR: validation_failed FR-0017 --page-id 456\n')
})

test('plan root metadata failure writes retained report set instead of development pending', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-plan-metadata-failure-')), 'out')

  const result = await runExportRelatedCommand('plan', options({
    pageId: '123',
    out,
    flags: ['--safe']
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123'
    }),
    listChildPages: async () => {
      throw new Error('traversal must not start without root metadata')
    },
    getStorageContent: async () => {
      throw new Error('storage must not start without root metadata')
    }
  })

  assert.equal(result.exitCode, 0)
  assert.equal(result.stderr, '')
  assert.match(result.stdout, /^RUN_COMPLETE final_status=success_with_findings artifact=/m)
  assert.deepEqual(fs.readdirSync(out).sort(), [
    'failed-pages.tsv',
    'manifest.tsv',
    'resolved-links.tsv',
    'scope-findings.tsv',
    'summary.txt',
    'unresolved-links.tsv'
  ])
  assert.equal(fs.readFileSync(path.join(out, 'manifest.tsv'), 'utf8'), 'page_id\tspace_key\tpage_title\tfolder\tdiscovery_source\trun_mode\tattachment_count\n')
  assert.equal(fs.readFileSync(path.join(out, 'failed-pages.tsv'), 'utf8'), [
    'page_id\tpage_title\toperation\terror_summary',
    '123\tnone\tpage_metadata\tpage_metadata_failed',
    ''
  ].join('\n'))
  const summary = fs.readFileSync(path.join(out, 'summary.txt'), 'utf8')
  assert.match(summary, /^final_status=success_with_findings$/m)
  assert.match(summary, /^scope_trust=degraded$/m)
  assert.match(summary, /^processed_pages=0$/m)
  assert.match(summary, /^failed_operations=1$/m)
  assert.match(summary, /^blocking_reasons=failed_operations$/m)
})

test('export root metadata failure writes retained report set and empty pages directory', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-export-metadata-failure-')), 'out')

  const result = await runExportRelatedCommand('export', options({
    pageId: '123',
    out,
    flags: ['--safe']
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123'
    }),
    listChildPages: async () => {
      throw new Error('traversal must not start without root metadata')
    },
    getStorageContent: async () => {
      throw new Error('storage must not start without root metadata')
    }
  })

  assert.equal(result.exitCode, 0)
  assert.equal(result.stderr, '')
  assert.match(result.stdout, /^RUN_COMPLETE final_status=success_with_findings artifact=/m)
  assert.deepEqual(fs.readdirSync(out).sort(), [
    'failed-pages.tsv',
    'manifest.tsv',
    'pages',
    'resolved-links.tsv',
    'scope-findings.tsv',
    'summary.txt',
    'unresolved-links.tsv'
  ])
  assert.deepEqual(fs.readdirSync(path.join(out, 'pages')), [])
  assert.equal(fs.readFileSync(path.join(out, 'failed-pages.tsv'), 'utf8'), [
    'page_id\tpage_title\toperation\terror_summary',
    '123\tnone\tpage_metadata\tpage_metadata_failed',
    ''
  ].join('\n'))
  const summary = fs.readFileSync(path.join(out, 'summary.txt'), 'utf8')
  assert.match(summary, /^page_payload_format=md$/m)
  assert.match(summary, /^scope_trust=degraded$/m)
  assert.match(summary, /^processed_pages=0$/m)
  assert.match(summary, /^failed_operations=1$/m)
})

test('no-fail-fast export with root metadata writes failed-payload report set', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-export-no-fail-fast-')), 'out')

  const result = await runExportRelatedCommand('export', options({
    pageId: '123',
    out,
    flags: ['--no-fail-fast']
  }), {
    checkRootPageAccess: async pageId => {
      assert.equal(pageId, '123')
      return {
        state: 'ok',
        identity: '123',
        metadata: {
          page_id: '123',
          page_title: 'Root Page',
          space_key: 'CX'
        }
      }
    }
  })

  assert.equal(result.exitCode, 0)
  assert.equal(result.stderr, 'WARNING: unbounded_run use --safe or --max-pages or --max-download-mib\n')
  assert.match(result.stdout, /^RUN_COMPLETE final_status=success_with_findings artifact=/m)
  assert.deepEqual(fs.readdirSync(out).sort(), [
    'failed-pages.tsv',
    'manifest.tsv',
    'pages',
    'resolved-links.tsv',
    'scope-findings.tsv',
    'summary.txt',
    'unresolved-links.tsv'
  ])
  assert.equal(fs.readFileSync(path.join(out, 'failed-pages.tsv'), 'utf8'), [
    'page_id\tpage_title\toperation\terror_summary',
    '123\tRoot Page\tpage_payload\tpage_payload_failed',
    ''
  ].join('\n'))
  const summary = fs.readFileSync(path.join(out, 'summary.txt'), 'utf8')
  assert.match(summary, /^failed_operations=1$/m)
  assert.match(summary, /^blocking_reasons=scope_findings,failed_operations$/m)
})

test('basic export with root metadata writes failed-payload report set and lifecycle stdout', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-export-')), 'out')

  const result = await runExportRelatedCommand('export', options({ pageId: '123', out }), {
    checkRootPageAccess: async pageId => {
      assert.equal(pageId, '123')
      return {
        state: 'ok',
        identity: '123',
        metadata: {
          page_id: '123',
          page_title: 'Root Page',
          space_key: 'CX'
        }
      }
    }
  })

  assert.equal(result.exitCode, 0)
  assert.equal(result.stderr, 'WARNING: unbounded_run use --safe or --max-pages or --max-download-mib\n')
  assert.equal(result.stdout, [
    `RUN_START command=export page_id=123 output_root="${out}"`,
    'RUN_PHASE phase=scope_discovery',
    'RUN_PHASE phase=page_processing',
    'RUN_PHASE phase=report_generation',
    `RUN_COMPLETE final_status=success_with_findings artifact="${out}"`,
    ''
  ].join('\n'))
  assert.deepEqual(fs.readdirSync(out).sort(), [
    'failed-pages.tsv',
    'manifest.tsv',
    'pages',
    'resolved-links.tsv',
    'scope-findings.tsv',
    'summary.txt',
    'unresolved-links.tsv'
  ])
  assert.deepEqual(fs.readdirSync(path.join(out, 'pages')), [])
  assert.equal(fs.readFileSync(path.join(out, 'manifest.tsv'), 'utf8'), [
    'page_id\tspace_key\tpage_title\tfolder\tdiscovery_source\trun_mode\tattachment_count',
    '123\tCX\tRoot Page\tnone\troot\texport\tnone',
    ''
  ].join('\n'))
  assert.equal(fs.readFileSync(path.join(out, 'failed-pages.tsv'), 'utf8'), [
    'page_id\tpage_title\toperation\terror_summary',
    '123\tRoot Page\tpage_payload\tpage_payload_failed',
    ''
  ].join('\n'))
  const summary = fs.readFileSync(path.join(out, 'summary.txt'), 'utf8')
  assert.match(summary, /^page_payload_format=md$/m)
  assert.match(summary, /^final_status=success_with_findings$/m)
  assert.match(summary, /^failed_operations=1$/m)
  assert.match(summary, /^scope_findings=2$/m)
  assert.match(summary, /^blocking_reasons=scope_findings,failed_operations$/m)
})

test('basic md export with complete scope materializes page payload', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-md-export-')), 'out')
  const markdown = '# Root Page\n\nNo links here.\n'
  const storage = '<p>No links here.</p>'

  const result = await runExportRelatedCommand('export', options({
    pageId: '123',
    out,
    flags: ['--safe']
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    }),
    listChildPages: async () => ({
      state: 'ok',
      complete: true,
      children: []
    }),
    getStorageContent: async () => ({
      state: 'ok',
      storage
    }),
    getPagePayload: async page => ({
      state: 'ok',
      payload: page.page_id === '123' ? markdown : assert.fail('unexpected page payload request'),
      diagnostics: []
    })
  })

  assert.equal(result.exitCode, 0)
  assert.equal(result.stderr, '')
  assert.match(result.stdout, /^RUN_COMPLETE final_status=success artifact=/m)
  assert.equal(fs.readFileSync(path.join(out, 'manifest.tsv'), 'utf8'), [
    'page_id\tspace_key\tpage_title\tfolder\tdiscovery_source\trun_mode\tattachment_count',
    '123\tCX\tRoot Page\tpages/space__4358/page__123\troot\texport\tnone',
    ''
  ].join('\n'))
  const pageFolder = path.join(out, 'pages', 'space__4358', 'page__123')
  assert.deepEqual(fs.readdirSync(pageFolder), ['page.md'])
  assert.equal(fs.readFileSync(path.join(pageFolder, 'page.md'), 'utf8'), normalizeMarkdownPayload(markdown))
  const summary = fs.readFileSync(path.join(out, 'summary.txt'), 'utf8')
  assert.match(summary, /^page_payload_format=md$/m)
  assert.match(summary, /^final_status=success$/m)
  assert.match(summary, /^blocking_reasons=none$/m)
})

test('basic zip export retains plain root and writes deterministic archive', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-zip-export-')), 'out')
  const zipPath = `${out}.zip`
  const markdown = '# Root Page\n\nNo links here.\n'

  const result = await runExportRelatedCommand('export', options({
    pageId: '123',
    out,
    flags: ['--safe', '--zip']
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    }),
    listChildPages: async () => ({
      state: 'ok',
      complete: true,
      children: []
    }),
    getStorageContent: async () => ({
      state: 'ok',
      storage: '<p>No links here.</p>'
    }),
    getPagePayload: successfulPagePayload(markdown)
  })

  assert.equal(result.exitCode, 0)
  assert.equal(result.stderr, '')
  assert.match(result.stdout, new RegExp(`^RUN_COMPLETE final_status=success artifact=${escapeRegExp(quotePathString(out))}$`, 'm'))
  assert.equal(fs.existsSync(out), true)
  assert.equal(fs.existsSync(zipPath), true)

  const summary = fs.readFileSync(path.join(out, 'summary.txt'), 'utf8')
  assert.match(summary, new RegExp(`^zip_path=${escapeRegExp(quotePathString(zipPath))}$`, 'm'))
  const entries = readStoredZipEntries(zipPath)
  assert.deepEqual(entries.map(entry => entry.name), [
    'failed-pages.tsv',
    'manifest.tsv',
    'pages/space__4358/page__123/page.md',
    'resolved-links.tsv',
    'scope-findings.tsv',
    'summary.txt',
    'unresolved-links.tsv'
  ])
  assert.equal(entries.find(entry => entry.name === 'summary.txt').content.toString('utf8'), summary)
  assert.equal(
    entries.find(entry => entry.name === 'pages/space__4358/page__123/page.md').content.toString('utf8'),
    normalizeMarkdownPayload(markdown)
  )
})

test('basic zip export fails without overwriting pre-existing zip archive', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-zip-existing-')), 'out')
  const zipPath = `${out}.zip`
  fs.writeFileSync(zipPath, 'pre-existing zip')

  const result = await runExportRelatedCommand('export', options({
    pageId: '123',
    out,
    flags: ['--safe', '--zip']
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    }),
    listChildPages: async () => ({
      state: 'ok',
      complete: true,
      children: []
    }),
    getStorageContent: async () => ({
      state: 'ok',
      storage: '<p>No links here.</p>'
    }),
    getPagePayload: successfulPagePayload('# Root Page\n')
  })

  assert.equal(result.exitCode, 4)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, 'ERROR: runtime_failure zip_archive\n')
  assert.equal(fs.readFileSync(zipPath, 'utf8'), 'pre-existing zip')
})

test('basic md export records markdown payload diagnostics without dropping payload', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-md-export-remnant-')), 'out')
  const markdown = '# Root Page\n\nBody <p>left</p>\n'

  const result = await runExportRelatedCommand('export', options({
    pageId: '123',
    out,
    flags: ['--safe']
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    }),
    listChildPages: async () => ({
      state: 'ok',
      complete: true,
      children: []
    }),
    getStorageContent: async () => ({
      state: 'ok',
      storage: '<p>No links here.</p>'
    }),
    getPagePayload: successfulPagePayload(markdown, [
      {
        kind: 'html_remnant',
        token: '<p',
        detail: 'markdown_remnant_kind=html_remnant;token=<p'
      }
    ])
  })

  assert.equal(result.exitCode, 0)
  assert.equal(result.stderr, '')
  assert.match(result.stdout, /^RUN_COMPLETE final_status=success_with_findings artifact=/m)
  const pageFolder = path.join(out, 'pages', 'space__4358', 'page__123')
  assert.equal(fs.readFileSync(path.join(pageFolder, 'page.md'), 'utf8'), normalizeMarkdownPayload(markdown))
  assert.equal(fs.readFileSync(path.join(out, 'scope-findings.tsv'), 'utf8'), [
    'page_id\tfinding_area\tfinding_type\tdetail',
    '123\tpage_payload\tmarkdown_remnant\tmarkdown_remnant_kind=html_remnant;token=<p',
    ''
  ].join('\n'))
  assert.equal(fs.readFileSync(path.join(out, 'failed-pages.tsv'), 'utf8'), [
    'page_id\tpage_title\toperation\terror_summary',
    ''
  ].join('\n'))
  const summary = fs.readFileSync(path.join(out, 'summary.txt'), 'utf8')
  assert.match(summary, /^scope_trust=degraded$/m)
  assert.match(summary, /^scope_findings=1$/m)
  assert.match(summary, /^failed_operations=0$/m)
  assert.match(summary, /^blocking_reasons=scope_findings$/m)
})

test('basic md export records page payload acquisition failure without writing page payload', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-md-export-payload-failure-')), 'out')

  const result = await runExportRelatedCommand('export', options({
    pageId: '123',
    out,
    flags: ['--safe']
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    }),
    listChildPages: async () => ({
      state: 'ok',
      complete: true,
      children: []
    }),
    getStorageContent: async () => ({
      state: 'ok',
      storage: '<p>No links here.</p>'
    }),
    getPagePayload: async () => ({
      state: 'failed',
      error: 'page_payload_failed'
    }),
    getAttachmentData: async () => {
      assert.fail('attachments must not be acquired after page payload failure')
    }
  })

  assert.equal(result.exitCode, 0)
  assert.equal(result.stderr, '')
  assert.match(result.stdout, /^RUN_COMPLETE final_status=success_with_findings artifact=/m)
  assert.equal(fs.existsSync(path.join(out, 'pages', 'space__4358', 'page__123', 'page.md')), false)
  assert.equal(fs.readFileSync(path.join(out, 'failed-pages.tsv'), 'utf8'), [
    'page_id\tpage_title\toperation\terror_summary',
    '123\tRoot Page\tpage_payload\tpage_payload_failed',
    ''
  ].join('\n'))
  const summary = fs.readFileSync(path.join(out, 'summary.txt'), 'utf8')
  assert.match(summary, /^failed_operations=1$/m)
  assert.match(summary, /^blocking_reasons=failed_operations$/m)
})

test('basic md export with unresolved links still materializes available page payloads', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-md-export-unresolved-')), 'out')
  const markdown = '<p>Root links to <a href="/display/CX/Missing+Page">missing page</a>.</p>'

  const result = await runExportRelatedCommand('export', options({
    pageId: '123',
    out,
    flags: ['--safe']
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    }),
    listChildPages: async () => ({
      state: 'ok',
      complete: true,
      children: []
    }),
    getStorageContent: async () => ({
      state: 'ok',
      storage: markdown
    }),
    getPagePayload: successfulPagePayload(markdown),
    findTitleCandidates: async discovery => {
      assert.deepEqual(discovery, {
        linkKind: 'href_space_title',
        title: 'Missing Page',
        spaceKey: 'CX'
      })
      return {
        state: 'ok',
        complete: true,
        candidates: []
      }
    }
  })

  assert.equal(result.exitCode, 0)
  assert.equal(result.stderr, '')
  assert.match(result.stdout, /^RUN_COMPLETE final_status=success_with_findings artifact=/m)
  assert.equal(fs.readFileSync(path.join(out, 'manifest.tsv'), 'utf8'), [
    'page_id\tspace_key\tpage_title\tfolder\tdiscovery_source\trun_mode\tattachment_count',
    '123\tCX\tRoot Page\tpages/space__4358/page__123\troot\texport\tnone',
    ''
  ].join('\n'))
  assert.equal(fs.readFileSync(path.join(out, 'unresolved-links.tsv'), 'utf8'), [
    'source_page_id\tsource_title\tlink_kind\traw_link_value\tresolution_reason',
    '123\tRoot Page\thref_space_title\tspace_key_present=1;space_key_bytes=2;space_key=CX;title_bytes=12;title=Missing Page\tnot_found',
    ''
  ].join('\n'))
  const pageFolder = path.join(out, 'pages', 'space__4358', 'page__123')
  assert.deepEqual(fs.readdirSync(pageFolder), ['page.md'])
  assert.equal(fs.readFileSync(path.join(pageFolder, 'page.md'), 'utf8'), normalizeMarkdownPayload(markdown))
  const summary = fs.readFileSync(path.join(out, 'summary.txt'), 'utf8')
  assert.match(summary, /^final_status=success_with_findings$/m)
  assert.match(summary, /^scope_trust=degraded$/m)
  assert.match(summary, /^unresolved_links=1$/m)
  assert.match(summary, /^failed_operations=0$/m)
  assert.match(summary, /^blocking_reasons=unresolved_links$/m)
})

test('basic md export rewrites localized links before writing page payloads', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-md-export-localized-')), 'out')

  const result = await runExportRelatedCommand('export', options({
    pageId: '123',
    out,
    flags: ['--safe']
  }), {
    checkRootPageAccess: async pageId => ({
      state: 'ok',
      identity: pageId,
      metadata: pageId === '123'
        ? {
            page_id: '123',
            page_title: 'Root Page',
            space_key: 'CX'
          }
        : {
            page_id: '456',
            page_title: 'Linked Page',
            space_key: 'CX'
          }
    }),
    listChildPages: async () => ({
      state: 'ok',
      complete: true,
      children: []
    }),
    getStorageContent: async page => ({
      state: 'ok',
      storage: page.page_id === '123'
        ? '<p><a href="/pages/viewpage.action?pageId=456">Linked Page</a> <a href="/display/CX/Missing+Page">Missing Page</a></p>'
        : '<p>Linked leaf.</p>'
    }),
    lookupPageById: async pageId => {
      assert.equal(pageId, '456')
      return {
        state: 'ok',
        identity: '456',
        metadata: {
          page_id: '456',
          page_title: 'Linked Page',
          space_key: 'CX'
        }
      }
    },
    findTitleCandidates: async discovery => {
      assert.deepEqual(discovery, {
        linkKind: 'href_space_title',
        title: 'Missing Page',
        spaceKey: 'CX'
      })
      return {
        state: 'ok',
        complete: true,
        candidates: []
      }
    },
    getPagePayload: async page => ({
      state: 'ok',
      payload: page.page_id === '123'
        ? [
            '# Root Page',
            '',
            '[Linked Page](/pages/viewpage.action?pageId=456)',
            '[Missing Page](/display/CX/Missing+Page)',
            '[root-note.txt](attachments/root-note.txt)',
            ''
          ].join('\n')
        : '# Linked Page\n\nLinked leaf.\n',
      diagnostics: []
    })
  })

  assert.equal(result.exitCode, 0)
  assert.equal(result.stderr, '')
  assert.match(result.stdout, /^RUN_COMPLETE final_status=success_with_findings artifact=/m)
  const rootPagePath = path.join(out, 'pages', 'space__4358', 'page__123', 'page.md')
  assert.equal(fs.readFileSync(rootPagePath, 'utf8'), [
    '# Root Page',
    '',
    '[Linked Page](../page__456/page.md)',
    'Missing Page [unresolved: page; reason=not_found; target_hint=title; value="CX:Missing Page"]',
    '[root-note.txt](attachments/root-note.txt)',
    ''
  ].join('\n'))
})

test('basic md export downloads attachment payloads into page folder', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-md-export-attachment-')), 'out')
  const markdown = '# Root Page\n\nNo links here.\n'
  const attachmentPayload = Buffer.alloc(1024 * 1024, 'a')

  const result = await runExportRelatedCommand('export', options({
    pageId: '123',
    out,
    flags: ['--safe']
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    }),
    listChildPages: async () => ({
      state: 'ok',
      complete: true,
      children: []
    }),
    getStorageContent: async () => ({
      state: 'ok',
      storage: markdown
    }),
    getPagePayload: successfulPagePayload(markdown),
    getAttachmentData: async page => {
      assert.equal(page.page_id, '123')
      return {
        state: 'ok',
        items: [
          {
            filename: 'root-note.txt',
            downloadId: 'root-note'
          }
        ],
        metadataBytes: 1024 * 1024
      }
    },
    downloadAttachmentPayload: async item => {
      assert.equal(item.downloadId, 'root-note')
      return {
        state: 'ok',
        bytes: attachmentPayload
      }
    }
  })

  assert.equal(result.exitCode, 0)
  assert.equal(result.stderr, '')
  assert.match(result.stdout, /^RUN_COMPLETE final_status=success artifact=/m)
  assert.equal(fs.readFileSync(path.join(out, 'manifest.tsv'), 'utf8'), [
    'page_id\tspace_key\tpage_title\tfolder\tdiscovery_source\trun_mode\tattachment_count',
    '123\tCX\tRoot Page\tpages/space__4358/page__123\troot\texport\t1',
    ''
  ].join('\n'))
  const pageFolder = path.join(out, 'pages', 'space__4358', 'page__123')
  assert.deepEqual(fs.readdirSync(pageFolder).sort(), ['attachments', 'page.md'])
  assert.equal(fs.readFileSync(path.join(pageFolder, 'page.md'), 'utf8'), normalizeMarkdownPayload(markdown))
  assert.deepEqual(fs.readdirSync(path.join(pageFolder, 'attachments')), ['root-note.txt'])
  assert.deepEqual(fs.readFileSync(path.join(pageFolder, 'attachments', 'root-note.txt')), attachmentPayload)
  assert.equal(fs.readFileSync(path.join(out, 'failed-pages.tsv'), 'utf8'), [
    'page_id\tpage_title\toperation\terror_summary',
    ''
  ].join('\n'))
  const summary = fs.readFileSync(path.join(out, 'summary.txt'), 'utf8')
  assert.match(summary, /^downloaded_mib_content=1\.000$/m)
  assert.match(summary, /^downloaded_mib_metadata=1\.000$/m)
  assert.match(summary, /^blocking_reasons=none$/m)
})

test('basic export records attachment download failure without retaining attachments folder', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-export-attachment-failure-')), 'out')
  const markdown = '# Root Page\n\nNo links here.\n'

  const result = await runExportRelatedCommand('export', options({
    pageId: '123',
    out
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    }),
    listChildPages: async () => ({
      state: 'ok',
      complete: true,
      children: []
    }),
    getStorageContent: async () => ({
      state: 'ok',
      storage: markdown
    }),
    getPagePayload: successfulPagePayload(markdown),
    getAttachmentData: async () => ({
      state: 'ok',
      items: [
        {
          filename: 'root-note.txt',
          downloadId: 'root-note'
        }
      ]
    }),
    downloadAttachmentPayload: async () => ({ state: 'failed' })
  })

  assert.equal(result.exitCode, 0)
  assert.equal(result.stderr, 'WARNING: unbounded_run use --safe or --max-pages or --max-download-mib\n')
  assert.match(result.stdout, /^RUN_COMPLETE final_status=success_with_findings artifact=/m)
  assert.equal(fs.readFileSync(path.join(out, 'manifest.tsv'), 'utf8'), [
    'page_id\tspace_key\tpage_title\tfolder\tdiscovery_source\trun_mode\tattachment_count',
    '123\tCX\tRoot Page\tpages/space__4358/page__123\troot\texport\t1',
    ''
  ].join('\n'))
  const pageFolder = path.join(out, 'pages', 'space__4358', 'page__123')
  assert.deepEqual(fs.readdirSync(pageFolder), ['page.md'])
  assert.equal(fs.readFileSync(path.join(pageFolder, 'page.md'), 'utf8'), normalizeMarkdownPayload(markdown))
  assert.equal(fs.readFileSync(path.join(out, 'failed-pages.tsv'), 'utf8'), [
    'page_id\tpage_title\toperation\terror_summary',
    '123\tRoot Page\tattachment_download\tattachment_download_failed',
    ''
  ].join('\n'))
  const summary = fs.readFileSync(path.join(out, 'summary.txt'), 'utf8')
  assert.match(summary, /^final_status=success_with_findings$/m)
  assert.match(summary, /^failed_operations=1$/m)
  assert.match(summary, /^blocking_reasons=failed_operations$/m)
})

test('basic export max-download stops after page payload bytes', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-export-payload-max-download-stop-')), 'out')
  const payload = 'x'.repeat(1024 * 1024)

  const result = await runExportRelatedCommand('export', options({
    pageId: '123',
    out,
    flags: ['--safe'],
    values: {
      '--max-download-mib': '2'
    }
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    }),
    listChildPages: async () => ({
      state: 'ok',
      complete: true,
      children: []
    }),
    getStorageContent: async () => ({
      state: 'ok',
      storage: payload
    }),
    getPagePayload: successfulPagePayload(payload)
  })

  assert.equal(result.exitCode, 3)
  assert.equal(result.stderr, '')
  assert.match(result.stdout, /^RUN_COMPLETE final_status=incomplete artifact=/m)
  assert.equal(fs.readFileSync(path.join(out, 'INCOMPLETE'), 'utf8'), 'incomplete=1\n')
  const pageFolder = path.join(out, 'pages', 'space__4358', 'page__123')
  assert.equal(fs.readFileSync(path.join(pageFolder, 'page.md'), 'utf8'), normalizeMarkdownPayload(payload))
  const summary = fs.readFileSync(path.join(out, 'summary.txt'), 'utf8')
  assert.match(summary, /^final_status=incomplete$/m)
  assert.match(summary, /^scope_trust=degraded$/m)
  assert.match(summary, /^downloaded_mib_total=2\.000$/m)
  assert.match(summary, /^downloaded_mib_content=1\.000$/m)
  assert.match(summary, /^downloaded_mib_metadata=1\.000$/m)
  assert.match(summary, /^interrupt_reason=max_download_limit_reached$/m)
})

test('basic resume export reuses matching prior page payload and regenerates reports', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-export-resume-')), 'out')
  const payload = 'x'.repeat(1024 * 1024)
  const storagePages = []
  const dependencies = () => ({
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    }),
    listChildPages: async () => ({
      state: 'ok',
      complete: true,
      children: []
    }),
    getStorageContent: async page => {
      storagePages.push(page.page_id)
      return {
        state: 'ok',
        storage: payload
      }
    },
    getPagePayload: successfulPagePayload(payload)
  })

  const first = await runExportRelatedCommand('export', options({
    pageId: '123',
    out,
    flags: ['--safe'],
    values: {
      '--max-download-mib': '2'
    }
  }), dependencies())

  assert.equal(first.exitCode, 3)
  assert.match(first.stdout, /^RUN_COMPLETE final_status=incomplete artifact=/m)
  assert.equal(fs.readFileSync(path.join(out, 'INCOMPLETE'), 'utf8'), 'incomplete=1\n')
  let summary = fs.readFileSync(path.join(out, 'summary.txt'), 'utf8')
  assert.match(summary, /^resume_mode=0$/m)
  assert.match(summary, /^fresh_pages=1$/m)

  const second = await runExportRelatedCommand('export', options({
    pageId: '123',
    out,
    flags: ['--safe', '--resume']
  }), dependencies())

  assert.equal(second.exitCode, 0)
  assert.equal(second.stderr, '')
  assert.match(second.stdout, /^RUN_COMPLETE final_status=success artifact=/m)
  assert.deepEqual(storagePages, ['123', '123'])
  assert.equal(fs.existsSync(path.join(out, 'INCOMPLETE')), false)
  const pageFolder = path.join(out, 'pages', 'space__4358', 'page__123')
  assert.equal(fs.readFileSync(path.join(pageFolder, 'page.md'), 'utf8'), normalizeMarkdownPayload(payload))
  summary = fs.readFileSync(path.join(out, 'summary.txt'), 'utf8')
  assert.match(summary, /^final_status=success$/m)
  assert.match(summary, /^resume_mode=1$/m)
  assert.match(summary, /^reused_pages=1$/m)
  assert.match(summary, /^fresh_pages=0$/m)
  assert.match(summary, /^downloaded_mib_content=0\.000$/m)
})

test('basic resume export refreshes changed prior page payload', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-export-resume-changed-')), 'out')
  const firstPayload = 'x'.repeat(1024 * 1024)
  const secondPayload = 'y'.repeat(1024 * 1024)
  const storagePages = []
  let currentPayload = firstPayload
  const dependencies = () => ({
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    }),
    listChildPages: async () => ({
      state: 'ok',
      complete: true,
      children: []
    }),
    getStorageContent: async page => {
      storagePages.push(page.page_id)
      return {
        state: 'ok',
        storage: currentPayload
      }
    },
    getPagePayload: async () => ({
      state: 'ok',
      payload: currentPayload,
      diagnostics: []
    })
  })

  const first = await runExportRelatedCommand('export', options({
    pageId: '123',
    out,
    flags: ['--safe'],
    values: {
      '--max-download-mib': '2'
    }
  }), dependencies())

  assert.equal(first.exitCode, 3)
  assert.match(first.stdout, /^RUN_COMPLETE final_status=incomplete artifact=/m)
  const pageFolder = path.join(out, 'pages', 'space__4358', 'page__123')
  assert.equal(fs.readFileSync(path.join(pageFolder, 'page.md'), 'utf8'), normalizeMarkdownPayload(firstPayload))

  currentPayload = secondPayload
  const second = await runExportRelatedCommand('export', options({
    pageId: '123',
    out,
    flags: ['--safe', '--resume']
  }), dependencies())

  assert.equal(second.exitCode, 0)
  assert.equal(second.stderr, '')
  assert.match(second.stdout, /^RUN_COMPLETE final_status=success artifact=/m)
  assert.deepEqual(storagePages, ['123', '123'])
  assert.equal(fs.existsSync(path.join(out, 'INCOMPLETE')), false)
  assert.equal(fs.readFileSync(path.join(pageFolder, 'page.md'), 'utf8'), normalizeMarkdownPayload(secondPayload))
  const summary = fs.readFileSync(path.join(out, 'summary.txt'), 'utf8')
  assert.match(summary, /^final_status=success$/m)
  assert.match(summary, /^resume_mode=1$/m)
  assert.match(summary, /^reused_pages=0$/m)
  assert.match(summary, /^fresh_pages=1$/m)
  assert.match(summary, /^downloaded_mib_content=1\.000$/m)
})

test('basic md export materializes linked page payloads after scope expansion', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-md-export-linked-')), 'out')

  const result = await runExportRelatedCommand('export', options({
    pageId: '123',
    out,
    flags: ['--safe']
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    }),
    listChildPages: async () => ({
      state: 'ok',
      complete: true,
      children: []
    }),
    getStorageContent: async page => ({
      state: 'ok',
      storage: page.page_id === '123'
        ? '<p><ac:link><ri:content-entity ri:content-id="456"/></ac:link></p>'
        : '<p>Linked page payload.</p>'
    }),
    getPagePayload: async page => ({
      state: 'ok',
      payload: page.page_id === '123'
        ? '[Linked Page](/pages/viewpage.action?pageId=456)\n'
        : '# Linked Page\n\nLinked page payload.\n',
      diagnostics: []
    }),
    lookupPageById: async pageId => {
      assert.equal(pageId, '456')
      return {
        state: 'ok',
        identity: '456',
        metadata: {
          page_id: '456',
          page_title: 'Linked Page',
          space_key: 'CX'
        }
      }
    }
  })

  assert.equal(result.exitCode, 0)
  assert.equal(result.stderr, '')
  assert.match(result.stdout, /^RUN_COMPLETE final_status=success artifact=/m)
  assert.equal(fs.readFileSync(path.join(out, 'manifest.tsv'), 'utf8'), [
    'page_id\tspace_key\tpage_title\tfolder\tdiscovery_source\trun_mode\tattachment_count',
    '123\tCX\tRoot Page\tpages/space__4358/page__123\troot\texport\tnone',
    '456\tCX\tLinked Page\tpages/space__4358/page__456\tlinked\texport\tnone',
    ''
  ].join('\n'))
  assert.equal(fs.readFileSync(path.join(out, 'failed-pages.tsv'), 'utf8'), [
    'page_id\tpage_title\toperation\terror_summary',
    ''
  ].join('\n'))
  assert.equal(
    fs.readFileSync(path.join(out, 'pages', 'space__4358', 'page__123', 'page.md'), 'utf8'),
    '[Linked Page](../page__456/page.md)\n'
  )
  assert.equal(
    fs.readFileSync(path.join(out, 'pages', 'space__4358', 'page__456', 'page.md'), 'utf8'),
    '# Linked Page\n\nLinked page payload.\n'
  )
})

test('basic export log-file replaces selected file with lifecycle stdout', async () => {
  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-export-log-'))
  const out = path.join(workdir, 'out')
  const logFile = path.join(workdir, 'run.log')
  fs.writeFileSync(logFile, 'stale\n', 'utf8')

  const result = await runExportRelatedCommand('export', options({
    pageId: '123',
    out,
    values: {
      '--log-file': logFile
    }
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    })
  })

  assert.equal(result.exitCode, 0)
  assert.equal(fs.readFileSync(logFile, 'utf8'), result.stdout)
})

test('basic export keep-metadata retains root page info artifact and failed payload row', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-export-metadata-')), 'out')

  const result = await runExportRelatedCommand('export', options({
    pageId: '123',
    out,
    flags: ['--keep-metadata']
  }), {
    checkRootPageAccess: async pageId => {
      assert.equal(pageId, '123')
      return {
        state: 'ok',
        identity: '123',
        metadata: {
          page_id: '123',
          page_title: 'Root Page',
          space_key: 'CX'
        }
      }
    }
  })

  assert.equal(result.exitCode, 0)
  assert.equal(result.stderr, 'WARNING: unbounded_run use --safe or --max-pages or --max-download-mib\n')
  assert.deepEqual(fs.readdirSync(out).sort(), [
    'failed-pages.tsv',
    'manifest.tsv',
    'pages',
    'resolved-links.tsv',
    'scope-findings.tsv',
    'summary.txt',
    'unresolved-links.tsv'
  ])
  assert.equal(fs.readFileSync(path.join(out, 'manifest.tsv'), 'utf8'), [
    'page_id\tspace_key\tpage_title\tfolder\tdiscovery_source\trun_mode\tattachment_count',
    '123\tCX\tRoot Page\tpages/space__4358/page__123\troot\texport\tnone',
    ''
  ].join('\n'))
  assert.equal(fs.readFileSync(path.join(out, 'failed-pages.tsv'), 'utf8'), [
    'page_id\tpage_title\toperation\terror_summary',
    '123\tRoot Page\tpage_payload\tpage_payload_failed',
    ''
  ].join('\n'))
  const pageFolder = path.join(out, 'pages', 'space__4358', 'page__123')
  assert.deepEqual(fs.readdirSync(pageFolder), ['_info.txt'])
  const infoText = fs.readFileSync(path.join(pageFolder, '_info.txt'), 'utf8')
  assert.match(infoText, /^page_id=123$/m)
  assert.match(infoText, /^page_title=Root Page$/m)
  assert.match(infoText, /^space_key=CX$/m)
})

test('basic safe export with root metadata suppresses unbounded warning', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-safe-export-')), 'out')

  const result = await runExportRelatedCommand('export', options({
    pageId: '123',
    out,
    flags: ['--safe']
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    })
  })

  assert.equal(result.exitCode, 0)
  assert.equal(result.stderr, '')
  assert.match(result.stdout, /^RUN_START command=export page_id=123 /)
  assert.equal(fs.existsSync(path.join(out, 'summary.txt')), true)
})

test('basic max-pages export with root metadata suppresses unbounded warning', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-max-pages-export-')), 'out')

  const result = await runExportRelatedCommand('export', options({
    pageId: '123',
    out,
    values: {
      '--max-pages': '1'
    }
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    })
  })

  assert.equal(result.exitCode, 0)
  assert.equal(result.stderr, '')
  assert.match(result.stdout, /^RUN_START command=export page_id=123 /)
  assert.equal(fs.existsSync(path.join(out, 'summary.txt')), true)
})

test('basic plan with root metadata writes retained report set and lifecycle stdout', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-plan-')), 'out')

  const result = await runExportRelatedCommand('plan', options({ pageId: '123', out }), {
    checkRootPageAccess: async pageId => {
      assert.equal(pageId, '123')
      return {
        state: 'ok',
        identity: '123',
        metadata: {
          page_id: '123',
          page_title: 'Root Page',
          space_key: 'CX'
        }
      }
    }
  })

  assert.equal(result.exitCode, 0)
  assert.equal(result.stderr, 'WARNING: unbounded_run use --safe or --max-pages or --max-download-mib\n')
  assert.equal(result.stdout, [
    `RUN_START command=plan page_id=123 output_root="${out}"`,
    'RUN_PHASE phase=scope_discovery',
    'RUN_PHASE phase=page_processing',
    'RUN_PHASE phase=report_generation',
    `RUN_COMPLETE final_status=success_with_findings artifact="${out}"`,
    ''
  ].join('\n'))
  assert.deepEqual(fs.readdirSync(out).sort(), [
    'failed-pages.tsv',
    'manifest.tsv',
    'resolved-links.tsv',
    'scope-findings.tsv',
    'summary.txt',
    'unresolved-links.tsv'
  ])
  assert.equal(fs.readFileSync(path.join(out, 'manifest.tsv'), 'utf8'), [
    'page_id\tspace_key\tpage_title\tfolder\tdiscovery_source\trun_mode\tattachment_count',
    '123\tCX\tRoot Page\tnone\troot\tplan\tnone',
    ''
  ].join('\n'))
  assert.equal(fs.readFileSync(path.join(out, 'scope-findings.tsv'), 'utf8'), [
    'page_id\tfinding_area\tfinding_type\tdetail',
    '123\tchild_listing\tincomplete_tree\tchild_listing_incomplete',
    '123\tstorage_content\tstorage_unavailable\tstorage_content_unavailable',
    ''
  ].join('\n'))
  const summary = fs.readFileSync(path.join(out, 'summary.txt'), 'utf8')
  assert.match(summary, /^final_status=success_with_findings$/m)
  assert.match(summary, /^processed_pages=1$/m)
  assert.match(summary, /^scope_findings=2$/m)
  assert.match(summary, /^blocking_reasons=scope_findings$/m)
})

test('basic plan with complete listing and no-link storage produces clean success', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-plan-clean-')), 'out')

  const result = await runExportRelatedCommand('plan', options({
    pageId: '123',
    out,
    flags: ['--safe']
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    }),
    listChildPages: async () => ({
      state: 'ok',
      complete: true,
      children: []
    }),
    getStorageContent: async page => {
      assert.equal(page.page_id, '123')
      return {
        state: 'ok',
        storage: '<p>No links here.</p>'
      }
    }
  })

  assert.equal(result.exitCode, 0)
  assert.equal(result.stderr, '')
  assert.match(result.stdout, /^RUN_COMPLETE final_status=success artifact=/m)
  assert.equal(fs.readFileSync(path.join(out, 'scope-findings.tsv'), 'utf8'), [
    'page_id\tfinding_area\tfinding_type\tdetail',
    ''
  ].join('\n'))
  const summary = fs.readFileSync(path.join(out, 'summary.txt'), 'utf8')
  assert.match(summary, /^final_status=success$/m)
  assert.match(summary, /^scope_trust=trusted$/m)
  assert.match(summary, /^scope_findings=0$/m)
  assert.match(summary, /^blocking_reasons=none$/m)
})

test('basic plan records attachment preview count and metadata artifact', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-plan-attachment-preview-')), 'out')
  const preview = 'attachments=2\nfile=one.txt\nfile=two.txt\n'

  const result = await runExportRelatedCommand('plan', options({
    pageId: '123',
    out,
    flags: ['--safe', '--keep-metadata']
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    }),
    listChildPages: async () => ({
      state: 'ok',
      complete: true,
      children: []
    }),
    getStorageContent: async page => {
      assert.equal(page.page_id, '123')
      return {
        state: 'ok',
        storage: '<p>No links here.</p>'
      }
    },
    getAttachmentPreview: async page => {
      assert.equal(page.page_id, '123')
      return {
        state: 'ok',
        count: 2,
        preview
      }
    }
  })

  assert.equal(result.exitCode, 0)
  assert.equal(result.stderr, '')
  assert.match(result.stdout, /^RUN_COMPLETE final_status=success artifact=/m)
  assert.equal(fs.readFileSync(path.join(out, 'manifest.tsv'), 'utf8'), [
    'page_id\tspace_key\tpage_title\tfolder\tdiscovery_source\trun_mode\tattachment_count',
    '123\tCX\tRoot Page\tpages/space__4358/page__123\troot\tplan\t2',
    ''
  ].join('\n'))
  const pageFolder = path.join(out, 'pages', 'space__4358', 'page__123')
  assert.deepEqual(fs.readdirSync(pageFolder).sort(), [
    '_attachments_preview.txt',
    '_info.txt',
    '_storage.xml'
  ])
  assert.equal(fs.readFileSync(path.join(pageFolder, '_attachments_preview.txt'), 'utf8'), preview)
  const summary = fs.readFileSync(path.join(out, 'summary.txt'), 'utf8')
  assert.match(summary, /^final_status=success$/m)
  assert.match(summary, /^blocking_reasons=none$/m)
})

test('basic plan no-fail-fast continues attachment preview after page failure', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-plan-attachment-preview-no-fail-fast-')), 'out')
  const attachmentPreviewCalls = []

  const result = await runExportRelatedCommand('plan', options({
    pageId: '123',
    out,
    flags: ['--safe', '--no-fail-fast']
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    }),
    listChildPages: async page => ({
      state: 'ok',
      complete: true,
      children: page.page_id === '123'
        ? [
            {
              page_id: '456',
              page_title: 'Child Page',
              space_key: 'CX'
            }
          ]
        : []
    }),
    getStorageContent: async page => ({
      state: 'ok',
      storage: `<p>${page.page_title} has no links.</p>`
    }),
    getAttachmentPreview: async page => {
      attachmentPreviewCalls.push(page.page_id)
      if (page.page_id === '123') {
        return { state: 'failed' }
      }
      return {
        state: 'ok',
        count: 1,
        preview: 'attachment_count=1\nsource_filename=child.bin\n'
      }
    }
  })

  assert.equal(result.exitCode, 0)
  assert.equal(result.stderr, '')
  assert.match(result.stdout, /^RUN_COMPLETE final_status=success_with_findings artifact=/m)
  assert.deepEqual(attachmentPreviewCalls, ['123', '456'])
  assert.equal(fs.readFileSync(path.join(out, 'manifest.tsv'), 'utf8'), [
    'page_id\tspace_key\tpage_title\tfolder\tdiscovery_source\trun_mode\tattachment_count',
    '123\tCX\tRoot Page\tnone\troot\tplan\tnone',
    '456\tCX\tChild Page\tnone\ttree\tplan\t1',
    ''
  ].join('\n'))
  assert.equal(fs.readFileSync(path.join(out, 'failed-pages.tsv'), 'utf8'), [
    'page_id\tpage_title\toperation\terror_summary',
    '123\tRoot Page\tattachment_preview\tattachment_preview_failed',
    ''
  ].join('\n'))
  const summary = fs.readFileSync(path.join(out, 'summary.txt'), 'utf8')
  assert.match(summary, /^failed_operations=1$/m)
  assert.match(summary, /^blocking_reasons=failed_operations$/m)
})

test('basic plan reports unsupported internal-looking storage patterns without expanding scope', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-plan-unsupported-pattern-')), 'out')

  const result = await runExportRelatedCommand('plan', options({
    pageId: '123',
    out,
    flags: ['--safe']
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    }),
    listChildPages: async () => ({
      state: 'ok',
      complete: true,
      children: []
    }),
    getStorageContent: async () => ({
      state: 'ok',
      storage: '<p><span data-target="/pages/456">Unsupported</span></p>'
    })
  })

  assert.equal(result.exitCode, 0)
  assert.match(result.stdout, /^RUN_COMPLETE final_status=success_with_findings artifact=/m)
  assert.equal(fs.readFileSync(path.join(out, 'manifest.tsv'), 'utf8'), [
    'page_id\tspace_key\tpage_title\tfolder\tdiscovery_source\trun_mode\tattachment_count',
    '123\tCX\tRoot Page\tnone\troot\tplan\tnone',
    ''
  ].join('\n'))
  assert.equal(fs.readFileSync(path.join(out, 'scope-findings.tsv'), 'utf8'), [
    'page_id\tfinding_area\tfinding_type\tdetail',
    '123\tunsupported_pattern\tunsupported_internal_pattern\t/pages/456',
    ''
  ].join('\n'))
})

test('basic plan ignores external href noise and code-body literals while reporting unsupported attribute patterns', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-plan-unsupported-noise-')), 'out')

  const result = await runExportRelatedCommand('plan', options({
    pageId: '123',
    out,
    flags: ['--safe']
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    }),
    listChildPages: async () => ({
      state: 'ok',
      complete: true,
      children: []
    }),
    getStorageContent: async () => ({
      state: 'ok',
      storage: '<p><a href="https://example.invalid/confluence/display/CX/External">external</a></p><ac:structured-macro ac:name="code"><ac:plain-text-body><![CDATA[/pages/424242]]></ac:plain-text-body></ac:structured-macro><p><span title="/display/CX/Unsupported%20Pattern">unsupported</span></p>'
    })
  })

  assert.equal(result.exitCode, 0)
  assert.match(result.stdout, /^RUN_COMPLETE final_status=success_with_findings artifact=/m)
  assert.equal(fs.readFileSync(path.join(out, 'resolved-links.tsv'), 'utf8'), [
    'source_page_id\tsource_title\tlink_kind\traw_link_value\ttarget_page_id\ttarget_space_key\ttarget_title',
    ''
  ].join('\n'))
  assert.equal(fs.readFileSync(path.join(out, 'scope-findings.tsv'), 'utf8'), [
    'page_id\tfinding_area\tfinding_type\tdetail',
    '123\tunsupported_pattern\tunsupported_internal_pattern\t/display/CX/Unsupported%20Pattern',
    ''
  ].join('\n'))
})

test('basic plan resolves content-id storage links into linked pages', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-plan-content-id-')), 'out')

  const result = await runExportRelatedCommand('plan', options({
    pageId: '123',
    out,
    flags: ['--safe']
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    }),
    listChildPages: async () => ({
      state: 'ok',
      complete: true,
      children: []
    }),
    getStorageContent: async () => ({
      state: 'ok',
      storage: '<p><ac:link><ri:content-entity ri:content-id="456"/></ac:link></p>'
    }),
    lookupPageById: async pageId => {
      assert.equal(pageId, '456')
      return {
        state: 'ok',
        identity: '456',
        metadata: {
          page_id: '456',
          page_title: 'Linked Page',
          space_key: 'CX'
        }
      }
    }
  })

  assert.equal(result.exitCode, 0)
  assert.match(result.stdout, /^RUN_COMPLETE final_status=success artifact=/m)
  assert.equal(fs.readFileSync(path.join(out, 'manifest.tsv'), 'utf8'), [
    'page_id\tspace_key\tpage_title\tfolder\tdiscovery_source\trun_mode\tattachment_count',
    '123\tCX\tRoot Page\tnone\troot\tplan\tnone',
    '456\tCX\tLinked Page\tnone\tlinked\tplan\tnone',
    ''
  ].join('\n'))
  assert.equal(fs.readFileSync(path.join(out, 'resolved-links.tsv'), 'utf8'), [
    'source_page_id\tsource_title\tlink_kind\traw_link_value\ttarget_page_id\ttarget_space_key\ttarget_title',
    '123\tRoot Page\tcontent_id\tpage_id:456\t456\tCX\tLinked Page',
    ''
  ].join('\n'))
  assert.equal(fs.readFileSync(path.join(out, 'scope-findings.tsv'), 'utf8'), [
    'page_id\tfinding_area\tfinding_type\tdetail',
    ''
  ].join('\n'))
})

test('basic plan link-depth zero does not expand storage links but keeps unsupported findings', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-plan-link-depth-zero-')), 'out')

  const result = await runExportRelatedCommand('plan', options({
    pageId: '123',
    out,
    flags: ['--safe'],
    values: {
      '--link-depth': '0'
    }
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    }),
    listChildPages: async () => ({
      state: 'ok',
      complete: true,
      children: []
    }),
    getStorageContent: async () => ({
      state: 'ok',
      storage: '<p><ac:link><ri:content-entity ri:content-id="456"/></ac:link><span title="/display/CX/Unsupported%20While%20Depth%20Zero">unsupported</span></p>'
    }),
    lookupPageById: async () => {
      throw new Error('link-depth zero must not resolve storage links')
    }
  })

  assert.equal(result.exitCode, 0)
  assert.match(result.stdout, /^RUN_COMPLETE final_status=success_with_findings artifact=/m)
  assert.equal(fs.readFileSync(path.join(out, 'manifest.tsv'), 'utf8'), [
    'page_id\tspace_key\tpage_title\tfolder\tdiscovery_source\trun_mode\tattachment_count',
    '123\tCX\tRoot Page\tnone\troot\tplan\tnone',
    ''
  ].join('\n'))
  assert.equal(fs.readFileSync(path.join(out, 'resolved-links.tsv'), 'utf8'), [
    'source_page_id\tsource_title\tlink_kind\traw_link_value\ttarget_page_id\ttarget_space_key\ttarget_title',
    ''
  ].join('\n'))
  assert.equal(fs.readFileSync(path.join(out, 'scope-findings.tsv'), 'utf8'), [
    'page_id\tfinding_area\tfinding_type\tdetail',
    '123\tunsupported_pattern\tunsupported_internal_pattern\t/display/CX/Unsupported%20While%20Depth%20Zero',
    ''
  ].join('\n'))
})

test('basic plan link-depth two expands first-hop linked page links without duplicating cycles', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-plan-link-depth-two-')), 'out')
  const storagePages = []

  const result = await runExportRelatedCommand('plan', options({
    pageId: '123',
    out,
    flags: ['--safe'],
    values: {
      '--link-depth': '2'
    }
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    }),
    listChildPages: async () => ({
      state: 'ok',
      complete: true,
      children: []
    }),
    getStorageContent: async page => {
      storagePages.push(page.page_id)
      return {
        state: 'ok',
        storage: {
          123: '<p><ac:link><ri:content-entity ri:content-id="456"/></ac:link></p>',
          456: '<p><ac:link><ri:content-entity ri:content-id="123"/></ac:link><ac:link><ri:content-entity ri:content-id="789"/></ac:link></p>',
          789: '<p><ac:link><ri:content-entity ri:content-id="999"/></ac:link></p>'
        }[page.page_id]
      }
    },
    lookupPageById: async pageId => {
      const metadataByPageId = {
        123: {
          page_id: '123',
          page_title: 'Root Page',
          space_key: 'CX'
        },
        456: {
          page_id: '456',
          page_title: 'Linked Page',
          space_key: 'CX'
        },
        789: {
          page_id: '789',
          page_title: 'Second Hop',
          space_key: 'CX'
        }
      }
      const metadata = metadataByPageId[pageId]
      assert.notEqual(metadata, undefined, `unexpected lookup ${pageId}`)
      return {
        state: 'ok',
        identity: pageId,
        metadata
      }
    }
  })

  assert.equal(result.exitCode, 0)
  assert.match(result.stdout, /^RUN_COMPLETE final_status=success artifact=/m)
  assert.deepEqual(storagePages, ['123', '456', '789'])
  assert.equal(fs.readFileSync(path.join(out, 'manifest.tsv'), 'utf8'), [
    'page_id\tspace_key\tpage_title\tfolder\tdiscovery_source\trun_mode\tattachment_count',
    '123\tCX\tRoot Page\tnone\troot\tplan\tnone',
    '456\tCX\tLinked Page\tnone\tlinked\tplan\tnone',
    '789\tCX\tSecond Hop\tnone\tlinked\tplan\tnone',
    ''
  ].join('\n'))
  assert.equal(fs.readFileSync(path.join(out, 'resolved-links.tsv'), 'utf8'), [
    'source_page_id\tsource_title\tlink_kind\traw_link_value\ttarget_page_id\ttarget_space_key\ttarget_title',
    '123\tRoot Page\tcontent_id\tpage_id:456\t456\tCX\tLinked Page',
    '456\tLinked Page\tcontent_id\tpage_id:123\t123\tCX\tRoot Page',
    '456\tLinked Page\tcontent_id\tpage_id:789\t789\tCX\tSecond Hop',
    ''
  ].join('\n'))
})

test('basic plan resolves href page-id storage links into linked pages', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-plan-href-page-id-')), 'out')

  const result = await runExportRelatedCommand('plan', options({
    pageId: '123',
    out,
    flags: ['--safe']
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    }),
    listChildPages: async () => ({
      state: 'ok',
      complete: true,
      children: []
    }),
    getStorageContent: async () => ({
      state: 'ok',
      storage: '<p><a href="/pages/456?title=Ignored">Linked</a></p>'
    }),
    lookupPageById: async pageId => {
      assert.equal(pageId, '456')
      return {
        state: 'ok',
        identity: '456',
        metadata: {
          page_id: '456',
          page_title: 'Linked Page',
          space_key: 'CX'
        }
      }
    }
  })

  assert.equal(result.exitCode, 0)
  assert.match(result.stdout, /^RUN_COMPLETE final_status=success artifact=/m)
  assert.equal(fs.readFileSync(path.join(out, 'manifest.tsv'), 'utf8'), [
    'page_id\tspace_key\tpage_title\tfolder\tdiscovery_source\trun_mode\tattachment_count',
    '123\tCX\tRoot Page\tnone\troot\tplan\tnone',
    '456\tCX\tLinked Page\tnone\tlinked\tplan\tnone',
    ''
  ].join('\n'))
  assert.equal(fs.readFileSync(path.join(out, 'resolved-links.tsv'), 'utf8'), [
    'source_page_id\tsource_title\tlink_kind\traw_link_value\ttarget_page_id\ttarget_space_key\ttarget_title',
    '123\tRoot Page\thref_page_id\tpage_id:456\t456\tCX\tLinked Page',
    ''
  ].join('\n'))
  assert.equal(fs.readFileSync(path.join(out, 'scope-findings.tsv'), 'utf8'), [
    'page_id\tfinding_area\tfinding_type\tdetail',
    ''
  ].join('\n'))
})

test('basic plan resolves href space-title storage links into linked pages', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-plan-href-space-title-')), 'out')

  const result = await runExportRelatedCommand('plan', options({
    pageId: '123',
    out,
    flags: ['--safe']
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    }),
    listChildPages: async () => ({
      state: 'ok',
      complete: true,
      children: []
    }),
    getStorageContent: async () => ({
      state: 'ok',
      storage: '<p><a href="/display/CX/Linked+Page">Linked</a></p>'
    }),
    findTitleCandidates: async discovery => {
      assert.deepEqual(discovery, {
        linkKind: 'href_space_title',
        title: 'Linked Page',
        spaceKey: 'CX'
      })
      return {
        state: 'ok',
        complete: true,
        candidates: [
          {
            page_id: '456',
            page_title: 'Linked Page',
            space_key: 'CX'
          }
        ]
      }
    }
  })

  assert.equal(result.exitCode, 0)
  assert.match(result.stdout, /^RUN_COMPLETE final_status=success artifact=/m)
  assert.equal(fs.readFileSync(path.join(out, 'resolved-links.tsv'), 'utf8'), [
    'source_page_id\tsource_title\tlink_kind\traw_link_value\ttarget_page_id\ttarget_space_key\ttarget_title',
    '123\tRoot Page\thref_space_title\tspace_key_present=1;space_key_bytes=2;space_key=CX;title_bytes=11;title=Linked Page\t456\tCX\tLinked Page',
    ''
  ].join('\n'))
  assert.equal(fs.readFileSync(path.join(out, 'scope-findings.tsv'), 'utf8'), [
    'page_id\tfinding_area\tfinding_type\tdetail',
    ''
  ].join('\n'))
})

test('basic plan resolves ri-url page-id storage links into linked pages', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-plan-ri-url-page-id-')), 'out')

  const result = await runExportRelatedCommand('plan', options({
    pageId: '123',
    out,
    flags: ['--safe']
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    }),
    listChildPages: async () => ({
      state: 'ok',
      complete: true,
      children: []
    }),
    getStorageContent: async () => ({
      state: 'ok',
      storage: '<p><ri:url ri:value="/pages/viewpage.action?pageId=456"/></p>'
    }),
    lookupPageById: async pageId => {
      assert.equal(pageId, '456')
      return {
        state: 'ok',
        identity: '456',
        metadata: {
          page_id: '456',
          page_title: 'Linked Page',
          space_key: 'CX'
        }
      }
    }
  })

  assert.equal(result.exitCode, 0)
  assert.match(result.stdout, /^RUN_COMPLETE final_status=success artifact=/m)
  assert.equal(fs.readFileSync(path.join(out, 'manifest.tsv'), 'utf8'), [
    'page_id\tspace_key\tpage_title\tfolder\tdiscovery_source\trun_mode\tattachment_count',
    '123\tCX\tRoot Page\tnone\troot\tplan\tnone',
    '456\tCX\tLinked Page\tnone\tlinked\tplan\tnone',
    ''
  ].join('\n'))
  assert.equal(fs.readFileSync(path.join(out, 'resolved-links.tsv'), 'utf8'), [
    'source_page_id\tsource_title\tlink_kind\traw_link_value\ttarget_page_id\ttarget_space_key\ttarget_title',
    '123\tRoot Page\tri_url_page_id\tpage_id:456\t456\tCX\tLinked Page',
    ''
  ].join('\n'))
  assert.equal(fs.readFileSync(path.join(out, 'scope-findings.tsv'), 'utf8'), [
    'page_id\tfinding_area\tfinding_type\tdetail',
    ''
  ].join('\n'))
})

test('basic plan resolves ri-url space-title storage links into linked pages', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-plan-ri-url-space-title-')), 'out')

  const result = await runExportRelatedCommand('plan', options({
    pageId: '123',
    out,
    flags: ['--safe']
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    }),
    listChildPages: async () => ({
      state: 'ok',
      complete: true,
      children: []
    }),
    getStorageContent: async () => ({
      state: 'ok',
      storage: '<p><ri:url ri:value="/display/CX/Linked+Page"/></p>'
    }),
    findTitleCandidates: async discovery => {
      assert.deepEqual(discovery, {
        linkKind: 'ri_url_space_title',
        title: 'Linked Page',
        spaceKey: 'CX'
      })
      return {
        state: 'ok',
        complete: true,
        candidates: [
          {
            page_id: '456',
            page_title: 'Linked Page',
            space_key: 'CX'
          }
        ]
      }
    }
  })

  assert.equal(result.exitCode, 0)
  assert.match(result.stdout, /^RUN_COMPLETE final_status=success artifact=/m)
  assert.equal(fs.readFileSync(path.join(out, 'resolved-links.tsv'), 'utf8'), [
    'source_page_id\tsource_title\tlink_kind\traw_link_value\ttarget_page_id\ttarget_space_key\ttarget_title',
    '123\tRoot Page\tri_url_space_title\tspace_key_present=1;space_key_bytes=2;space_key=CX;title_bytes=11;title=Linked Page\t456\tCX\tLinked Page',
    ''
  ].join('\n'))
  assert.equal(fs.readFileSync(path.join(out, 'scope-findings.tsv'), 'utf8'), [
    'page_id\tfinding_area\tfinding_type\tdetail',
    ''
  ].join('\n'))
})

test('basic plan resolves page-ref storage links into linked pages', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-plan-page-ref-')), 'out')

  const result = await runExportRelatedCommand('plan', options({
    pageId: '123',
    out,
    flags: ['--safe']
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    }),
    listChildPages: async () => ({
      state: 'ok',
      complete: true,
      children: []
    }),
    getStorageContent: async () => ({
      state: 'ok',
      storage: '<p><ri:page ri:space-key="CX" ri:content-title="Linked Page"/></p>'
    }),
    findTitleCandidates: async discovery => {
      assert.deepEqual(discovery, {
        linkKind: 'page_ref',
        title: 'Linked Page',
        spaceKey: 'CX'
      })
      return {
        state: 'ok',
        complete: true,
        candidates: [
          {
            page_id: '456',
            page_title: 'Linked Page',
            space_key: 'CX'
          }
        ]
      }
    }
  })

  assert.equal(result.exitCode, 0)
  assert.match(result.stdout, /^RUN_COMPLETE final_status=success artifact=/m)
  assert.equal(fs.readFileSync(path.join(out, 'manifest.tsv'), 'utf8'), [
    'page_id\tspace_key\tpage_title\tfolder\tdiscovery_source\trun_mode\tattachment_count',
    '123\tCX\tRoot Page\tnone\troot\tplan\tnone',
    '456\tCX\tLinked Page\tnone\tlinked\tplan\tnone',
    ''
  ].join('\n'))
  assert.equal(fs.readFileSync(path.join(out, 'resolved-links.tsv'), 'utf8'), [
    'source_page_id\tsource_title\tlink_kind\traw_link_value\ttarget_page_id\ttarget_space_key\ttarget_title',
    '123\tRoot Page\tpage_ref\tspace_key_present=1;space_key_bytes=2;space_key=CX;title_bytes=11;title=Linked Page\t456\tCX\tLinked Page',
    ''
  ].join('\n'))
  assert.equal(fs.readFileSync(path.join(out, 'scope-findings.tsv'), 'utf8'), [
    'page_id\tfinding_area\tfinding_type\tdetail',
    ''
  ].join('\n'))
})

test('basic plan resolves page-ref titles with Confluence named entities', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-plan-page-ref-entity-')), 'out')

  const result = await runExportRelatedCommand('plan', options({
    pageId: '123',
    out,
    flags: ['--safe']
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    }),
    listChildPages: async () => ({
      state: 'ok',
      complete: true,
      children: []
    }),
    getStorageContent: async () => ({
      state: 'ok',
      storage: '<p><ri:page ri:space-key="CX" ri:content-title="Русская страница &mdash; черновик"/></p>'
    }),
    findTitleCandidates: async discovery => {
      assert.deepEqual(discovery, {
        linkKind: 'page_ref',
        title: 'Русская страница — черновик',
        spaceKey: 'CX'
      })
      return {
        state: 'ok',
        complete: true,
        candidates: [
          {
            page_id: '456',
            page_title: 'Русская страница — черновик',
            space_key: 'CX'
          }
        ]
      }
    }
  })

  assert.equal(result.exitCode, 0)
  assert.match(result.stdout, /^RUN_COMPLETE final_status=success artifact=/m)
  assert.equal(fs.readFileSync(path.join(out, 'resolved-links.tsv'), 'utf8'), [
    'source_page_id\tsource_title\tlink_kind\traw_link_value\ttarget_page_id\ttarget_space_key\ttarget_title',
    '123\tRoot Page\tpage_ref\tspace_key_present=1;space_key_bytes=2;space_key=CX;title_bytes=52;title=Русская страница — черновик\t456\tCX\tРусская страница — черновик',
    ''
  ].join('\n'))
  assert.equal(fs.readFileSync(path.join(out, 'scope-findings.tsv'), 'utf8'), [
    'page_id\tfinding_area\tfinding_type\tdetail',
    ''
  ].join('\n'))
})

test('basic plan ignores attachment storage references during page-link inspection', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-plan-attachment-reference-')), 'out')

  const result = await runExportRelatedCommand('plan', options({
    pageId: '123',
    out,
    flags: ['--safe']
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    }),
    listChildPages: async () => ({
      state: 'ok',
      complete: true,
      children: []
    }),
    getStorageContent: async () => ({
      state: 'ok',
      storage: '<p><ac:link><ri:attachment ri:filename="root-note.txt" /></ac:link></p>'
    })
  })

  assert.equal(result.exitCode, 0)
  assert.match(result.stdout, /^RUN_COMPLETE final_status=success artifact=/m)
  assert.equal(fs.readFileSync(path.join(out, 'resolved-links.tsv'), 'utf8'), [
    'source_page_id\tsource_title\tlink_kind\traw_link_value\ttarget_page_id\ttarget_space_key\ttarget_title',
    ''
  ].join('\n'))
  assert.equal(fs.readFileSync(path.join(out, 'scope-findings.tsv'), 'utf8'), [
    'page_id\tfinding_area\tfinding_type\tdetail',
    ''
  ].join('\n'))
})

test('basic plan max-find-candidates leaves title link unresolved with candidate limit', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-plan-candidate-limit-')), 'out')

  const result = await runExportRelatedCommand('plan', options({
    pageId: '123',
    out,
    flags: ['--safe'],
    values: {
      '--max-find-candidates': '1'
    }
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    }),
    listChildPages: async () => ({
      state: 'ok',
      complete: true,
      children: []
    }),
    getStorageContent: async () => ({
      state: 'ok',
      storage: '<p><ri:page ri:space-key="CX" ri:content-title="Linked Page"/></p>'
    }),
    findTitleCandidates: async () => ({
      state: 'ok',
      complete: true,
      candidates: [
        {
          page_id: '456',
          page_title: 'Linked Page',
          space_key: 'CX'
        },
        {
          page_id: '789',
          page_title: 'Linked Page',
          space_key: 'CX'
        }
      ]
    })
  })

  assert.equal(result.exitCode, 0)
  assert.match(result.stdout, /^RUN_COMPLETE final_status=success_with_findings artifact=/m)
  assert.equal(fs.readFileSync(path.join(out, 'manifest.tsv'), 'utf8'), [
    'page_id\tspace_key\tpage_title\tfolder\tdiscovery_source\trun_mode\tattachment_count',
    '123\tCX\tRoot Page\tnone\troot\tplan\tnone',
    ''
  ].join('\n'))
  assert.equal(fs.readFileSync(path.join(out, 'unresolved-links.tsv'), 'utf8'), [
    'source_page_id\tsource_title\tlink_kind\traw_link_value\tresolution_reason',
    '123\tRoot Page\tpage_ref\tspace_key_present=1;space_key_bytes=2;space_key=CX;title_bytes=11;title=Linked Page\tcandidate_limit',
    ''
  ].join('\n'))
  assert.equal(fs.readFileSync(path.join(out, 'scope-findings.tsv'), 'utf8'), [
    'page_id\tfinding_area\tfinding_type\tdetail',
    ''
  ].join('\n'))
})

test('basic plan resolves macro page parameter links into linked pages', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-plan-macro-param-')), 'out')

  const result = await runExportRelatedCommand('plan', options({
    pageId: '123',
    out,
    flags: ['--safe']
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    }),
    listChildPages: async () => ({
      state: 'ok',
      complete: true,
      children: []
    }),
    getStorageContent: async () => ({
      state: 'ok',
      storage: '<ac:parameter ac:name="page">CX:Linked Page</ac:parameter>'
    }),
    findTitleCandidates: async discovery => {
      assert.deepEqual(discovery, {
        linkKind: 'macro_param',
        title: 'Linked Page',
        spaceKey: 'CX'
      })
      return {
        state: 'ok',
        complete: true,
        candidates: [
          {
            page_id: '456',
            page_title: 'Linked Page',
            space_key: 'CX'
          }
        ]
      }
    }
  })

  assert.equal(result.exitCode, 0)
  assert.match(result.stdout, /^RUN_COMPLETE final_status=success artifact=/m)
  assert.equal(fs.readFileSync(path.join(out, 'manifest.tsv'), 'utf8'), [
    'page_id\tspace_key\tpage_title\tfolder\tdiscovery_source\trun_mode\tattachment_count',
    '123\tCX\tRoot Page\tnone\troot\tplan\tnone',
    '456\tCX\tLinked Page\tnone\tlinked\tplan\tnone',
    ''
  ].join('\n'))
  assert.equal(fs.readFileSync(path.join(out, 'resolved-links.tsv'), 'utf8'), [
    'source_page_id\tsource_title\tlink_kind\traw_link_value\ttarget_page_id\ttarget_space_key\ttarget_title',
    '123\tRoot Page\tmacro_param\tspace_key_present=1;space_key_bytes=2;space_key=CX;title_bytes=11;title=Linked Page\t456\tCX\tLinked Page',
    ''
  ].join('\n'))
  assert.equal(fs.readFileSync(path.join(out, 'scope-findings.tsv'), 'utf8'), [
    'page_id\tfinding_area\tfinding_type\tdetail',
    ''
  ].join('\n'))
})

test('basic plan with complete child listing includes tree pages and child_result links', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-plan-tree-')), 'out')

  const result = await runExportRelatedCommand('plan', options({ pageId: '123', out }), {
    checkRootPageAccess: async pageId => {
      assert.equal(pageId, '123')
      return {
        state: 'ok',
        identity: '123',
        metadata: {
          page_id: '123',
          page_title: 'Root Page',
          space_key: 'CX'
        }
      }
    },
    listChildPages: async page => {
      if (page.page_id === '123') {
        return {
          state: 'ok',
          complete: true,
          children: [
            {
              page_id: '456',
              page_title: 'Child Page',
              space_key: 'CX'
            }
          ]
        }
      }
      assert.equal(page.page_id, '456')
      return {
        state: 'ok',
        complete: true,
        children: []
      }
    }
  })

  assert.equal(result.exitCode, 0)
  assert.equal(fs.readFileSync(path.join(out, 'manifest.tsv'), 'utf8'), [
    'page_id\tspace_key\tpage_title\tfolder\tdiscovery_source\trun_mode\tattachment_count',
    '123\tCX\tRoot Page\tnone\troot\tplan\tnone',
    '456\tCX\tChild Page\tnone\ttree\tplan\tnone',
    ''
  ].join('\n'))
  assert.equal(fs.readFileSync(path.join(out, 'resolved-links.tsv'), 'utf8'), [
    'source_page_id\tsource_title\tlink_kind\traw_link_value\ttarget_page_id\ttarget_space_key\ttarget_title',
    '123\tRoot Page\tchild_result\tpage_id:456\t456\tCX\tChild Page',
    ''
  ].join('\n'))
  assert.equal(fs.readFileSync(path.join(out, 'scope-findings.tsv'), 'utf8'), [
    'page_id\tfinding_area\tfinding_type\tdetail',
    '123\tstorage_content\tstorage_unavailable\tstorage_content_unavailable',
    '456\tstorage_content\tstorage_unavailable\tstorage_content_unavailable',
    ''
  ].join('\n'))
  const summary = fs.readFileSync(path.join(out, 'summary.txt'), 'utf8')
  assert.match(summary, /^processed_pages=2$/m)
  assert.match(summary, /^tree_pages=1$/m)
  assert.match(summary, /^resolved_links=1$/m)
  assert.match(summary, /^scope_findings=2$/m)
})

test('basic plan sleep-ms waits between processed pages only', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-plan-sleep-ms-')), 'out')
  const events = []

  const result = await runExportRelatedCommand('plan', options({
    pageId: '123',
    out,
    values: {
      '--sleep-ms': '25'
    }
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    }),
    listChildPages: async page => ({
      state: 'ok',
      complete: true,
      children: page.page_id === '123'
        ? [
            {
              page_id: '456',
              page_title: 'Child Page',
              space_key: 'CX'
            }
          ]
        : []
    }),
    getStorageContent: async page => {
      events.push(`storage:${page.page_id}`)
      return {
        state: 'ok',
        storage: '<p>No links here.</p>'
      }
    },
    sleepMs: async ms => {
      events.push(`sleep:${ms}`)
    }
  })

  assert.equal(result.exitCode, 0)
  assert.deepEqual(events, ['storage:123', 'sleep:25', 'storage:456'])
})

test('basic safe plan uses default sleep between processed pages', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-plan-safe-sleep-')), 'out')
  const events = []

  const result = await runExportRelatedCommand('plan', options({
    pageId: '123',
    out,
    flags: ['--safe']
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    }),
    listChildPages: async page => ({
      state: 'ok',
      complete: true,
      children: page.page_id === '123'
        ? [
            {
              page_id: '456',
              page_title: 'Child Page',
              space_key: 'CX'
            }
          ]
        : []
    }),
    getStorageContent: async page => {
      events.push(`storage:${page.page_id}`)
      return {
        state: 'ok',
        storage: '<p>No links here.</p>'
      }
    },
    sleepMs: async ms => {
      events.push(`sleep:${ms}`)
    }
  })

  assert.equal(result.exitCode, 0)
  assert.deepEqual(events, ['storage:123', 'sleep:200', 'storage:456'])
})

test('basic safe plan applies default title candidate limit', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-safe-max-find-default-')), 'out')

  const result = await runExportRelatedCommand('plan', options({
    pageId: '123',
    out,
    flags: ['--safe']
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    }),
    listChildPages: async () => ({
      state: 'ok',
      complete: true,
      children: []
    }),
    getStorageContent: async () => ({
      state: 'ok',
      storage: '<p><ri:page ri:space-key="CX" ri:content-title="Linked Page"/></p>'
    }),
    findTitleCandidates: async () => ({
      state: 'ok',
      complete: true,
      candidates: Array.from({ length: 6 }, (_, index) => ({
        page_id: String(456 + index),
        page_title: 'Linked Page',
        space_key: 'CX'
      }))
    })
  })

  assert.equal(result.exitCode, 0)
  assert.match(result.stdout, /^RUN_COMPLETE final_status=success_with_findings artifact=/m)
  assert.equal(fs.readFileSync(path.join(out, 'unresolved-links.tsv'), 'utf8'), [
    'source_page_id\tsource_title\tlink_kind\traw_link_value\tresolution_reason',
    '123\tRoot Page\tpage_ref\tspace_key_present=1;space_key_bytes=2;space_key=CX;title_bytes=11;title=Linked Page\tcandidate_limit',
    ''
  ].join('\n'))
})

test('basic safe plan applies default max-pages limit', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-safe-max-pages-default-')), 'out')
  const childPages = Array.from({ length: 200 }, (_, index) => ({
    page_id: String(1000 + index),
    page_title: `Child Page ${index}`,
    space_key: 'CX'
  }))
  const storagePages = []

  const result = await runExportRelatedCommand('plan', options({
    pageId: '123',
    out,
    flags: ['--safe']
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    }),
    listChildPages: async page => ({
      state: 'ok',
      complete: true,
      children: page.page_id === '123' ? childPages : []
    }),
    getStorageContent: async page => {
      storagePages.push(page.page_id)
      return {
        state: 'ok',
        storage: '<p>No links here.</p>'
      }
    },
    sleepMs: async () => {}
  })

  assert.equal(result.exitCode, 3)
  assert.equal(storagePages.length, 200)
  assert.equal(storagePages.includes('1199'), false)
  const summary = fs.readFileSync(path.join(out, 'summary.txt'), 'utf8')
  assert.match(summary, /^processed_pages=200$/m)
  assert.match(summary, /^tree_pages=199$/m)
  assert.match(summary, /^interrupt_reason=max_pages_limit_reached$/m)
})

test('basic safe plan applies default max-download limit', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-safe-max-download-default-')), 'out')

  const result = await runExportRelatedCommand('plan', options({
    pageId: '123',
    out,
    flags: ['--safe']
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadataBytes: 256 * 1024 * 1024,
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    }),
    listChildPages: async () => {
      throw new Error('child listing must not start after safe max-download default is reached')
    }
  })

  assert.equal(result.exitCode, 3)
  const summary = fs.readFileSync(path.join(out, 'summary.txt'), 'utf8')
  assert.match(summary, /^downloaded_mib_metadata=256\.000$/m)
  assert.match(summary, /^interrupt_reason=max_download_limit_reached$/m)
})

test('basic plan max-pages does not sleep when child page will not begin', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-plan-max-pages-no-sleep-')), 'out')
  const storagePages = []

  const result = await runExportRelatedCommand('plan', options({
    pageId: '123',
    out,
    values: {
      '--max-pages': '1',
      '--sleep-ms': '25'
    }
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    }),
    listChildPages: async page => ({
      state: 'ok',
      complete: true,
      children: page.page_id === '123'
        ? [
            {
              page_id: '456',
              page_title: 'Child Page',
              space_key: 'CX'
            }
          ]
        : []
    }),
    getStorageContent: async page => {
      storagePages.push(page.page_id)
      return {
        state: 'ok',
        storage: '<p>No links here.</p>'
      }
    },
    sleepMs: async () => {
      throw new Error('sleep must not run when max-pages prevents next page')
    }
  })

  assert.equal(result.exitCode, 3)
  assert.deepEqual(storagePages, ['123'])
})

test('basic plan max-pages stops before processing child page', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-plan-max-pages-stop-')), 'out')
  const listedPages = []
  const storagePages = []

  const result = await runExportRelatedCommand('plan', options({
    pageId: '123',
    out,
    flags: ['--safe'],
    values: {
      '--max-pages': '1'
    }
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    }),
    listChildPages: async page => {
      listedPages.push(page.page_id)
      return {
        state: 'ok',
        complete: true,
        children: page.page_id === '123'
          ? [
              {
                page_id: '456',
                page_title: 'Child Page',
                space_key: 'CX'
              }
            ]
          : []
      }
    },
    getStorageContent: async page => {
      storagePages.push(page.page_id)
      return {
        state: 'ok',
        storage: '<p>Root has no links.</p>'
      }
    }
  })

  assert.equal(result.exitCode, 3)
  assert.equal(result.stderr, '')
  assert.match(result.stdout, /^RUN_COMPLETE final_status=incomplete artifact=/m)
  assert.deepEqual(listedPages, ['123'])
  assert.deepEqual(storagePages, ['123'])
  assert.equal(fs.readFileSync(path.join(out, 'INCOMPLETE'), 'utf8'), 'incomplete=1\n')
  assert.equal(fs.readFileSync(path.join(out, 'manifest.tsv'), 'utf8'), [
    'page_id\tspace_key\tpage_title\tfolder\tdiscovery_source\trun_mode\tattachment_count',
    '123\tCX\tRoot Page\tnone\troot\tplan\tnone',
    ''
  ].join('\n'))
  assert.equal(fs.readFileSync(path.join(out, 'resolved-links.tsv'), 'utf8'), [
    'source_page_id\tsource_title\tlink_kind\traw_link_value\ttarget_page_id\ttarget_space_key\ttarget_title',
    '123\tRoot Page\tchild_result\tpage_id:456\t456\tCX\tChild Page',
    ''
  ].join('\n'))
  const summary = fs.readFileSync(path.join(out, 'summary.txt'), 'utf8')
  assert.match(summary, /^final_status=incomplete$/m)
  assert.match(summary, /^scope_trust=degraded$/m)
  assert.match(summary, /^processed_pages=1$/m)
  assert.match(summary, /^tree_pages=0$/m)
  assert.match(summary, /^interrupt_reason=max_pages_limit_reached$/m)
})

test('basic plan max-download stops after storage metadata bytes', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-plan-max-download-stop-')), 'out')
  const attachmentPreviewPages = []

  const result = await runExportRelatedCommand('plan', options({
    pageId: '123',
    out,
    flags: ['--safe'],
    values: {
      '--max-download-mib': '1'
    }
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    }),
    listChildPages: async page => {
      assert.equal(page.page_id, '123')
      return {
        state: 'ok',
        complete: true,
        children: []
      }
    },
    getStorageContent: async page => {
      assert.equal(page.page_id, '123')
      return {
        state: 'ok',
        storage: 'x'.repeat(1024 * 1024)
      }
    },
    getAttachmentPreview: async page => {
      attachmentPreviewPages.push(page.page_id)
      return {
        state: 'ok',
        count: 0,
        preview: ''
      }
    }
  })

  assert.equal(result.exitCode, 3)
  assert.equal(result.stderr, '')
  assert.match(result.stdout, /^RUN_COMPLETE final_status=incomplete artifact=/m)
  assert.deepEqual(attachmentPreviewPages, [])
  assert.equal(fs.readFileSync(path.join(out, 'INCOMPLETE'), 'utf8'), 'incomplete=1\n')
  const summary = fs.readFileSync(path.join(out, 'summary.txt'), 'utf8')
  assert.match(summary, /^final_status=incomplete$/m)
  assert.match(summary, /^scope_trust=degraded$/m)
  assert.match(summary, /^downloaded_mib_total=1\.000$/m)
  assert.match(summary, /^downloaded_mib_content=0\.000$/m)
  assert.match(summary, /^downloaded_mib_metadata=1\.000$/m)
  assert.match(summary, /^interrupt_reason=max_download_limit_reached$/m)
})

test('basic plan max-download stops after root metadata bytes', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-plan-root-max-download-stop-')), 'out')

  const result = await runExportRelatedCommand('plan', options({
    pageId: '123',
    out,
    flags: ['--safe'],
    values: {
      '--max-download-mib': '1'
    }
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadataBytes: 1024 * 1024,
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    }),
    listChildPages: async () => {
      assert.fail('child listing must not run after root metadata reaches the download limit')
    },
    getStorageContent: async () => {
      assert.fail('storage must not run after root metadata reaches the download limit')
    },
    getAttachmentPreview: async () => {
      assert.fail('attachment preview must not run after root metadata reaches the download limit')
    }
  })

  assert.equal(result.exitCode, 3)
  assert.equal(result.stderr, '')
  assert.match(result.stdout, /^RUN_COMPLETE final_status=incomplete artifact=/m)
  assert.equal(fs.readFileSync(path.join(out, 'manifest.tsv'), 'utf8'), [
    'page_id\tspace_key\tpage_title\tfolder\tdiscovery_source\trun_mode\tattachment_count',
    '123\tCX\tRoot Page\tnone\troot\tplan\tnone',
    ''
  ].join('\n'))
  const summary = fs.readFileSync(path.join(out, 'summary.txt'), 'utf8')
  assert.match(summary, /^final_status=incomplete$/m)
  assert.match(summary, /^scope_trust=degraded$/m)
  assert.match(summary, /^downloaded_mib_total=1\.000$/m)
  assert.match(summary, /^downloaded_mib_metadata=1\.000$/m)
  assert.match(summary, /^interrupt_reason=max_download_limit_reached$/m)
})

test('basic plan max-download uses storage metadataBytes before storage text bytes', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-plan-max-download-metadata-bytes-')), 'out')
  const attachmentPreviewPages = []

  const result = await runExportRelatedCommand('plan', options({
    pageId: '123',
    out,
    flags: ['--safe'],
    values: {
      '--max-download-mib': '1'
    }
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    }),
    listChildPages: async () => ({
      state: 'ok',
      complete: true,
      children: []
    }),
    getStorageContent: async () => ({
      state: 'ok',
      storage: '<p>short</p>',
      metadataBytes: 1024 * 1024
    }),
    getAttachmentPreview: async page => {
      attachmentPreviewPages.push(page.page_id)
      return {
        state: 'ok',
        count: 0,
        preview: ''
      }
    }
  })

  assert.equal(result.exitCode, 3)
  assert.equal(result.stderr, '')
  assert.deepEqual(attachmentPreviewPages, [])
  const summary = fs.readFileSync(path.join(out, 'summary.txt'), 'utf8')
  assert.match(summary, /^downloaded_mib_total=1\.000$/m)
  assert.match(summary, /^downloaded_mib_metadata=1\.000$/m)
  assert.match(summary, /^interrupt_reason=max_download_limit_reached$/m)
})

test('basic plan max-download stops after child listing metadata bytes', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-plan-listing-max-download-stop-')), 'out')

  const result = await runExportRelatedCommand('plan', options({
    pageId: '123',
    out,
    flags: ['--safe'],
    values: {
      '--max-download-mib': '1'
    }
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    }),
    listChildPages: async page => {
      assert.equal(page.page_id, '123')
      return {
        state: 'ok',
        complete: true,
        metadataBytes: 1024 * 1024,
        children: [
          {
            page_id: '456',
            page_title: 'Child Page',
            space_key: 'CX'
          }
        ]
      }
    },
    getStorageContent: async () => {
      assert.fail('storage must not be acquired after the download limit is reached by child listing')
    },
    getAttachmentPreview: async () => {
      assert.fail('attachment preview must not be acquired after the download limit is reached by child listing')
    }
  })

  assert.equal(result.exitCode, 3)
  assert.equal(result.stderr, '')
  assert.match(result.stdout, /^RUN_COMPLETE final_status=incomplete artifact=/m)
  assert.equal(fs.readFileSync(path.join(out, 'manifest.tsv'), 'utf8'), [
    'page_id\tspace_key\tpage_title\tfolder\tdiscovery_source\trun_mode\tattachment_count',
    '123\tCX\tRoot Page\tnone\troot\tplan\tnone',
    ''
  ].join('\n'))
  assert.equal(fs.readFileSync(path.join(out, 'resolved-links.tsv'), 'utf8'), [
    'source_page_id\tsource_title\tlink_kind\traw_link_value\ttarget_page_id\ttarget_space_key\ttarget_title',
    '123\tRoot Page\tchild_result\tpage_id:456\t456\tCX\tChild Page',
    ''
  ].join('\n'))
  const summary = fs.readFileSync(path.join(out, 'summary.txt'), 'utf8')
  assert.match(summary, /^final_status=incomplete$/m)
  assert.match(summary, /^scope_trust=degraded$/m)
  assert.match(summary, /^processed_pages=1$/m)
  assert.match(summary, /^downloaded_mib_metadata=1\.000$/m)
  assert.match(summary, /^interrupt_reason=max_download_limit_reached$/m)
})

test('basic plan max-download stops after page-id lookup metadata bytes', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-plan-page-id-max-download-stop-')), 'out')
  const attachmentPreviewPages = []

  const result = await runExportRelatedCommand('plan', options({
    pageId: '123',
    out,
    flags: ['--safe'],
    values: {
      '--max-download-mib': '1'
    }
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    }),
    listChildPages: async () => ({
      state: 'ok',
      complete: true,
      children: []
    }),
    getStorageContent: async page => ({
      state: 'ok',
      storage: page.page_id === '123'
        ? '<p><ac:link><ri:content-entity ri:content-id="456"/></ac:link></p>'
        : '<p>Linked page should not be processed.</p>'
    }),
    lookupPageById: async pageId => {
      assert.equal(pageId, '456')
      return {
        state: 'ok',
        identity: '456',
        metadataBytes: 1024 * 1024,
        metadata: {
          page_id: '456',
          page_title: 'Linked Page',
          space_key: 'CX'
        }
      }
    },
    getAttachmentPreview: async page => {
      attachmentPreviewPages.push(page.page_id)
      return {
        state: 'ok',
        count: 0,
        preview: ''
      }
    }
  })

  assert.equal(result.exitCode, 3)
  assert.equal(result.stderr, '')
  assert.deepEqual(attachmentPreviewPages, [])
  assert.equal(fs.readFileSync(path.join(out, 'manifest.tsv'), 'utf8'), [
    'page_id\tspace_key\tpage_title\tfolder\tdiscovery_source\trun_mode\tattachment_count',
    '123\tCX\tRoot Page\tnone\troot\tplan\tnone',
    ''
  ].join('\n'))
  assert.equal(fs.readFileSync(path.join(out, 'resolved-links.tsv'), 'utf8'), [
    'source_page_id\tsource_title\tlink_kind\traw_link_value\ttarget_page_id\ttarget_space_key\ttarget_title',
    '123\tRoot Page\tcontent_id\tpage_id:456\t456\tCX\tLinked Page',
    ''
  ].join('\n'))
  const summary = fs.readFileSync(path.join(out, 'summary.txt'), 'utf8')
  assert.match(summary, /^final_status=incomplete$/m)
  assert.match(summary, /^scope_trust=degraded$/m)
  assert.match(summary, /^processed_pages=1$/m)
  assert.match(summary, /^downloaded_mib_metadata=1\.000$/m)
  assert.match(summary, /^interrupt_reason=max_download_limit_reached$/m)
})

test('basic plan max-download stops after title candidate metadata bytes', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-plan-title-max-download-stop-')), 'out')
  const attachmentPreviewPages = []

  const result = await runExportRelatedCommand('plan', options({
    pageId: '123',
    out,
    flags: ['--safe'],
    values: {
      '--max-download-mib': '1'
    }
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    }),
    listChildPages: async () => ({
      state: 'ok',
      complete: true,
      children: []
    }),
    getStorageContent: async page => ({
      state: 'ok',
      storage: page.page_id === '123'
        ? '<p><ri:page ri:space-key="CX" ri:content-title="Linked Page"/></p>'
        : '<p>Linked page should not be processed.</p>'
    }),
    findTitleCandidates: async discovery => {
      assert.deepEqual(discovery, {
        linkKind: 'page_ref',
        title: 'Linked Page',
        spaceKey: 'CX'
      })
      return {
        state: 'ok',
        complete: true,
        metadataBytes: 1024 * 1024,
        candidates: [
          {
            page_id: '456',
            page_title: 'Linked Page',
            space_key: 'CX'
          }
        ]
      }
    },
    getAttachmentPreview: async page => {
      attachmentPreviewPages.push(page.page_id)
      return {
        state: 'ok',
        count: 0,
        preview: ''
      }
    }
  })

  assert.equal(result.exitCode, 3)
  assert.equal(result.stderr, '')
  assert.deepEqual(attachmentPreviewPages, [])
  assert.equal(fs.readFileSync(path.join(out, 'manifest.tsv'), 'utf8'), [
    'page_id\tspace_key\tpage_title\tfolder\tdiscovery_source\trun_mode\tattachment_count',
    '123\tCX\tRoot Page\tnone\troot\tplan\tnone',
    ''
  ].join('\n'))
  assert.equal(fs.readFileSync(path.join(out, 'resolved-links.tsv'), 'utf8'), [
    'source_page_id\tsource_title\tlink_kind\traw_link_value\ttarget_page_id\ttarget_space_key\ttarget_title',
    '123\tRoot Page\tpage_ref\tspace_key_present=1;space_key_bytes=2;space_key=CX;title_bytes=11;title=Linked Page\t456\tCX\tLinked Page',
    ''
  ].join('\n'))
  const summary = fs.readFileSync(path.join(out, 'summary.txt'), 'utf8')
  assert.match(summary, /^final_status=incomplete$/m)
  assert.match(summary, /^scope_trust=degraded$/m)
  assert.match(summary, /^processed_pages=1$/m)
  assert.match(summary, /^downloaded_mib_metadata=1\.000$/m)
  assert.match(summary, /^interrupt_reason=max_download_limit_reached$/m)
})

test('basic plan max-download stops after attachment preview metadata bytes', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-plan-preview-max-download-stop-')), 'out')
  const attachmentPreviewPages = []
  const rootPreview = 'a'.repeat(1024 * 1024)

  const result = await runExportRelatedCommand('plan', options({
    pageId: '123',
    out,
    flags: ['--safe', '--keep-metadata'],
    values: {
      '--max-download-mib': '1'
    }
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    }),
    listChildPages: async page => ({
      state: 'ok',
      complete: true,
      children: page.page_id === '123'
        ? [
            {
              page_id: '456',
              page_title: 'Child Page',
              space_key: 'CX'
            }
          ]
        : []
    }),
    getStorageContent: async page => ({
      state: 'ok',
      storage: `<p>${page.page_title} has no links.</p>`
    }),
    getAttachmentPreview: async page => {
      attachmentPreviewPages.push(page.page_id)
      return {
        state: 'ok',
        count: page.page_id === '123' ? 1 : 0,
        preview: page.page_id === '123' ? rootPreview : ''
      }
    }
  })

  assert.equal(result.exitCode, 3)
  assert.equal(result.stderr, '')
  assert.match(result.stdout, /^RUN_COMPLETE final_status=incomplete artifact=/m)
  assert.deepEqual(attachmentPreviewPages, ['123'])
  assert.equal(fs.readFileSync(path.join(out, 'manifest.tsv'), 'utf8'), [
    'page_id\tspace_key\tpage_title\tfolder\tdiscovery_source\trun_mode\tattachment_count',
    '123\tCX\tRoot Page\tpages/space__4358/page__123\troot\tplan\t1',
    '456\tCX\tChild Page\tpages/space__4358/page__456\ttree\tplan\tnone',
    ''
  ].join('\n'))
  assert.equal(fs.readFileSync(path.join(out, 'pages', 'space__4358', 'page__123', '_attachments_preview.txt'), 'utf8'), rootPreview)
  const summary = fs.readFileSync(path.join(out, 'summary.txt'), 'utf8')
  assert.match(summary, /^final_status=incomplete$/m)
  assert.match(summary, /^scope_trust=degraded$/m)
  assert.match(summary, /^downloaded_mib_total=1\.000$/m)
  assert.match(summary, /^downloaded_mib_content=0\.000$/m)
  assert.match(summary, /^downloaded_mib_metadata=1\.000$/m)
  assert.match(summary, /^interrupt_reason=max_download_limit_reached$/m)
})

test('basic safe plan with root metadata suppresses unbounded warning', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-safe-plan-')), 'out')

  const result = await runExportRelatedCommand('plan', options({
    pageId: '123',
    out,
    flags: ['--safe']
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    })
  })

  assert.equal(result.exitCode, 0)
  assert.equal(result.stderr, '')
  assert.match(result.stdout, /^RUN_START command=plan page_id=123 /)
  assert.equal(fs.existsSync(path.join(out, 'summary.txt')), true)
})

test('basic plan rejects log-file inside output root before creating output root', async () => {
  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-plan-log-conflict-'))
  const out = path.join(workdir, 'out')

  const result = await runExportRelatedCommand('plan', options({
    pageId: '123',
    out,
    values: {
      '--log-file': path.join(out, 'run.log')
    }
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    })
  })

  assert.equal(result.exitCode, 1)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, 'ERROR: validation_failed FR-0134\n')
  assert.equal(fs.existsSync(out), false)
})

test('basic max-download plan with root metadata suppresses unbounded warning', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-max-download-plan-')), 'out')

  const result = await runExportRelatedCommand('plan', options({
    pageId: '123',
    out,
    values: {
      '--max-download-mib': '1'
    }
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    })
  })

  assert.equal(result.exitCode, 0)
  assert.equal(result.stderr, '')
  assert.match(result.stdout, /^RUN_START command=plan page_id=123 /)
  assert.equal(fs.existsSync(path.join(out, 'summary.txt')), true)
})

test('basic plan keep-metadata retains root page info artifact', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-plan-metadata-')), 'out')

  const result = await runExportRelatedCommand('plan', options({
    pageId: '123',
    out,
    flags: ['--keep-metadata']
  }), {
    checkRootPageAccess: async pageId => {
      assert.equal(pageId, '123')
      return {
        state: 'ok',
        identity: '123',
        metadata: {
          page_id: '123',
          page_title: 'Root Page',
          space_key: 'CX'
        }
      }
    }
  })

  assert.equal(result.exitCode, 0)
  assert.equal(result.stderr, 'WARNING: unbounded_run use --safe or --max-pages or --max-download-mib\n')
  assert.deepEqual(fs.readdirSync(out).sort(), [
    'failed-pages.tsv',
    'manifest.tsv',
    'pages',
    'resolved-links.tsv',
    'scope-findings.tsv',
    'summary.txt',
    'unresolved-links.tsv'
  ])
  assert.equal(fs.readFileSync(path.join(out, 'manifest.tsv'), 'utf8'), [
    'page_id\tspace_key\tpage_title\tfolder\tdiscovery_source\trun_mode\tattachment_count',
    '123\tCX\tRoot Page\tpages/space__4358/page__123\troot\tplan\tnone',
    ''
  ].join('\n'))
  const pageFolder = path.join(out, 'pages', 'space__4358', 'page__123')
  assert.deepEqual(fs.readdirSync(pageFolder), ['_info.txt'])
  const infoText = fs.readFileSync(path.join(pageFolder, '_info.txt'), 'utf8')
  assert.match(infoText, /^page_id=123$/m)
  assert.match(infoText, /^page_title=Root Page$/m)
  assert.match(infoText, /^space_key=CX$/m)
  const summary = fs.readFileSync(path.join(out, 'summary.txt'), 'utf8')
  assert.match(summary, /^processed_pages=1$/m)
  assert.match(summary, /^scope_findings=2$/m)
})

test('basic plan keep-metadata retains acquired storage artifact', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-basic-plan-storage-metadata-')), 'out')

  const result = await runExportRelatedCommand('plan', options({
    pageId: '123',
    out,
    flags: ['--keep-metadata', '--safe']
  }), {
    checkRootPageAccess: async () => ({
      state: 'ok',
      identity: '123',
      metadata: {
        page_id: '123',
        page_title: 'Root Page',
        space_key: 'CX'
      }
    }),
    listChildPages: async () => ({
      state: 'ok',
      complete: true,
      children: []
    }),
    getStorageContent: async () => ({
      state: 'ok',
      storage: '<p>No links here.</p>'
    })
  })

  assert.equal(result.exitCode, 0)
  const pageFolder = path.join(out, 'pages', 'space__4358', 'page__123')
  assert.deepEqual(fs.readdirSync(pageFolder).sort(), ['_info.txt', '_storage.xml'])
  assert.equal(fs.readFileSync(path.join(pageFolder, '_storage.xml'), 'utf8'), '<p>No links here.</p>')
})

test('existing explicit output root rejects after successful root page preflight', async () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-export-existing-out-'))

  const result = await runExportRelatedCommand('plan', options({ out }), {
    checkRootPageAccess: async pageId => {
      assert.equal(pageId, '123')
      return { state: 'ok', identity: '123' }
    }
  })

  assert.equal(result.exitCode, 1)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, 'ERROR: validation_failed FR-0016\n')
})

test('empty existing resume output root rejects after successful root page preflight', async () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-export-empty-resume-out-'))
  const order = []

  const result = await runExportRelatedCommand('export', options({
    out,
    flags: ['--resume']
  }), {
    checkRootPageAccess: async pageId => {
      order.push(`preflight:${pageId}`)
      return {
        state: 'ok',
        identity: '123',
        metadata: {
          page_id: '123',
          page_title: 'Root Page',
          space_key: 'CX'
        }
      }
    },
    listChildPages: async () => {
      throw new Error('scope discovery must not start for an incompatible resume root')
    }
  })

  assert.deepEqual(order, ['preflight:123'])
  assert.equal(result.exitCode, 1)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, 'ERROR: validation_failed FR-0103\n')
  assert.deepEqual(fs.readdirSync(out), [])
})
