'use strict'

const childProcess = require('node:child_process')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { promisify } = require('node:util')

const { resolveRemoteAccessContext } = require('../remote/access')
const {
  markdownRemnantDiagnostics,
  normalizeMarkdownPayload
} = require('./markdown')

const execFilePromise = promisify(childProcess.execFile)
const EXPORTER_PACKAGE = 'confluence-markdown-exporter==4.1.1'

async function acquireMarkdownPagePayload (page, env = process.env, dependencies = {}) {
  const context = resolveRemoteAccessContext(env)
  if (!context.usable || page === null || typeof page !== 'object' || !isCanonicalPageId(page.page_id)) {
    return failedPayload()
  }

  let tempDir = null

  try {
    const makeTempDir = dependencies.makeTempDir || defaultMakeTempDir
    tempDir = await makeTempDir('confluex-markdown-export-')
    const outputDir = path.join(tempDir, 'out')
    const configPath = path.join(tempDir, 'cme-config.json')
    const config = markdownExporterConfig({
      baseUrl: context.baseUrl,
      token: context.token,
      outputDir
    })

    await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
    const execFile = dependencies.execFile || execFilePromise
    await execFile('uvx', markdownExporterArgs(context.baseUrl, page.page_id), {
      env: confluenceChildProcessEnv(env, {
        CME_CONFIG_PATH: configPath,
        CI: 'true',
        NO_COLOR: '1'
      })
    })

    const rawPayload = await fs.readFile(path.join(outputDir, `${page.page_id}.md`), 'utf8')
    const payload = normalizeMarkdownPayload(rawPayload)
    return {
      state: 'ok',
      payload,
      diagnostics: markdownRemnantDiagnostics(payload)
    }
  } catch {
    return failedPayload()
  } finally {
    if (tempDir !== null) {
      await removeTempDir(tempDir, dependencies)
    }
  }
}

function markdownExporterConfig (input) {
  return {
    export: {
      output_path: input.outputDir,
      page_path: '{page_id}.md',
      attachment_path: 'attachments/{attachment_title}{attachment_extension}',
      skip_unchanged: false,
      cleanup_stale: false,
      page_breadcrumbs: false,
      include_document_title: false,
      enable_jira_enrichment: false
    },
    connection_config: {
      use_v2_api: false,
      verify_ssl: false,
      max_workers: 1
    },
    auth: {
      confluence: {
        [input.baseUrl]: {
          username: '',
          api_token: '',
          pat: input.token,
          cloud_id: ''
        }
      },
      jira: {}
    }
  }
}

const sanitizedChildEnvNames = [
  'http_proxy',
  'https_proxy',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'all_proxy',
  'ALL_PROXY',
  'CONFLUEX_CONFLUENCE_USERNAME',
  'CONFLUEX_CONFLUENCE_PASSWORD',
  'CONFLUEX_SELFTEST_CONFLUENCE_USERNAME',
  'CONFLUEX_SELFTEST_CONFLUENCE_PASSWORD'
]

function confluenceChildProcessEnv (env, overrides) {
  const childEnv = {
    ...process.env,
    ...env,
    ...overrides
  }
  for (const name of sanitizedChildEnvNames) {
    delete childEnv[name]
  }
  return childEnv
}

function markdownExporterArgs (baseUrl, pageId) {
  return [
    '--from',
    EXPORTER_PACKAGE,
    'cme',
    'page',
    pageViewUrl(baseUrl, pageId)
  ]
}

function pageViewUrl (baseUrl, pageId) {
  const url = new URL(`${baseUrl}/pages/viewpage.action`)
  url.searchParams.set('pageId', pageId)
  return url.toString()
}

function failedPayload () {
  return {
    state: 'failed',
    error: 'page_payload_failed'
  }
}

function isCanonicalPageId (value) {
  return typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value)
}

async function defaultMakeTempDir (prefix) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix))
}

async function removeTempDir (tempDir, dependencies) {
  const remove = dependencies.removeTempDir || (dir => fs.rm(dir, { recursive: true, force: true }))
  try {
    await remove(tempDir)
  } catch {
  }
}

module.exports = {
  acquireMarkdownPagePayload,
  markdownExporterArgs,
  markdownExporterConfig
}
