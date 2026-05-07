'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const {
  acquireMarkdownPagePayload
} = require('../../dist/confluex-node/payload/markdown-exporter')

function envForConfluence () {
  return {
    CONFLUEX_CONFLUENCE_BASE_URL: 'http://localhost:8090/',
    CONFLUEX_CONFLUENCE_TOKEN: 'token-secret',
    HTTP_PROXY: 'http://proxy.invalid',
    HTTPS_PROXY: 'http://proxy.invalid',
    ALL_PROXY: 'http://proxy.invalid',
    http_proxy: 'http://proxy.invalid',
    https_proxy: 'http://proxy.invalid',
    all_proxy: 'http://proxy.invalid'
  }
}

test('acquireMarkdownPagePayload invokes the audited exporter and normalizes its page output', async () => {
  const tempParent = fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-markdown-exporter-test-'))
  const tempDir = path.join(tempParent, 'work')
  let configAtExec = null
  let execCall = null
  let removedDir = null

  const result = await acquireMarkdownPagePayload({ page_id: '123' }, envForConfluence(), {
    makeTempDir: async prefix => {
      assert.equal(prefix, 'confluex-markdown-export-')
      fs.mkdirSync(tempDir, { recursive: true })
      return tempDir
    },
    execFile: async (file, args, options) => {
      execCall = { file, args, options }
      configAtExec = JSON.parse(fs.readFileSync(options.env.CME_CONFIG_PATH, 'utf8'))
      fs.mkdirSync(configAtExec.export.output_path, { recursive: true })
      fs.writeFileSync(path.join(configAtExec.export.output_path, '123.md'), '# Title  \r\n\r\n\r\nBody <p>left</p>\n', 'utf8')
      return { stdout: '', stderr: '' }
    },
    removeTempDir: async dir => {
      removedDir = dir
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  assert.equal(result.state, 'ok')
  assert.equal(result.payload, '# Title\n\nBody <p>left</p>\n')
  assert.deepEqual(result.diagnostics, [
    {
      kind: 'html_remnant',
      token: '<p',
      detail: 'markdown_remnant_kind=html_remnant;token=<p'
    },
    {
      kind: 'html_remnant',
      token: '</p>',
      detail: 'markdown_remnant_kind=html_remnant;token=</p>'
    }
  ])
  assert.equal(execCall.file, 'uvx')
  assert.deepEqual(execCall.args, [
    '--from',
    'confluence-markdown-exporter==4.1.1',
    'cme',
    'page',
    'http://localhost:8090/pages/viewpage.action?pageId=123'
  ])
  assert.equal(execCall.options.env.CI, 'true')
  assert.equal(execCall.options.env.NO_COLOR, '1')
  assert.equal(execCall.options.env.HTTP_PROXY, undefined)
  assert.equal(execCall.options.env.HTTPS_PROXY, undefined)
  assert.equal(execCall.options.env.ALL_PROXY, undefined)
  assert.equal(execCall.options.env.http_proxy, undefined)
  assert.equal(execCall.options.env.https_proxy, undefined)
  assert.equal(execCall.options.env.all_proxy, undefined)
  assert.equal(configAtExec.export.page_path, '{page_id}.md')
  assert.equal(configAtExec.export.attachment_path, 'attachments/{attachment_title}{attachment_extension}')
  assert.equal(configAtExec.export.skip_unchanged, false)
  assert.equal(configAtExec.export.cleanup_stale, false)
  assert.equal(configAtExec.export.page_breadcrumbs, false)
  assert.equal(configAtExec.export.include_document_title, false)
  assert.equal(configAtExec.export.enable_jira_enrichment, false)
  assert.equal(configAtExec.connection_config.use_v2_api, false)
  assert.equal(configAtExec.connection_config.verify_ssl, false)
  assert.equal(configAtExec.connection_config.max_workers, 1)
  assert.deepEqual(configAtExec.auth.confluence['http://localhost:8090'], {
    username: '',
    api_token: '',
    pat: 'token-secret',
    cloud_id: ''
  })
  assert.deepEqual(configAtExec.auth.jira, {})
  assert.equal(removedDir, tempDir)
})

test('acquireMarkdownPagePayload fails fast when Confluence access env is incomplete', async () => {
  const result = await acquireMarkdownPagePayload({ page_id: '123' }, {}, {
    execFile: async () => {
      assert.fail('exporter process must not run without required environment')
    }
  })

  assert.deepEqual(result, {
    state: 'failed',
    error: 'page_payload_failed'
  })
})

test('acquireMarkdownPagePayload fails when the exporter does not materialize the expected page file', async () => {
  const tempParent = fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-markdown-exporter-missing-'))
  const tempDir = path.join(tempParent, 'work')
  let removedDir = null

  const result = await acquireMarkdownPagePayload({ page_id: '123' }, envForConfluence(), {
    makeTempDir: async () => {
      fs.mkdirSync(tempDir, { recursive: true })
      return tempDir
    },
    execFile: async (_file, _args, options) => {
      const config = JSON.parse(fs.readFileSync(options.env.CME_CONFIG_PATH, 'utf8'))
      fs.mkdirSync(config.export.output_path, { recursive: true })
      return { stdout: '', stderr: '' }
    },
    removeTempDir: async dir => {
      removedDir = dir
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  assert.deepEqual(result, {
    state: 'failed',
    error: 'page_payload_failed'
  })
  assert.equal(removedDir, tempDir)
})
