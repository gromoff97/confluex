import { execFile as nodeExecFile } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

import { resolveRemoteAccessContext } from '../remote/access'
import {
  markdownRemnantDiagnostics,
  normalizeMarkdownPayload,
  type MarkdownRemnantDiagnostic
} from './markdown'

const execFilePromise = promisify(nodeExecFile)
const EXPORTER_PACKAGE = 'confluence-markdown-exporter==5.0.0'

type PageRef = {
  page_id: string
}

type MarkdownPayloadResult =
  | {
    state: 'ok'
    payload: string
    diagnostics: MarkdownRemnantDiagnostic[]
  }
  | {
    state: 'failed'
    error: 'page_payload_failed'
  }

type ExecFileOptions = {
  env: NodeJS.ProcessEnv
}

type ExecFileDependency = (file: string, args: string[], options: ExecFileOptions) => Promise<unknown>

type MarkdownExporterDependencies = {
  makeTempDir?: (prefix: string) => Promise<string>
  execFile?: ExecFileDependency
  removeTempDir?: (dir: string) => Promise<unknown>
}

type MarkdownExporterConfigInput = {
  baseUrl: string
  token: string
  outputDir: string
}

type MarkdownExporterConfig = {
  export: {
    output_path: string
    page_path: string
    attachment_path: string
    skip_unchanged: false
    cleanup_stale: false
    page_breadcrumbs: false
    include_document_title: false
    enable_jira_enrichment: false
  }
  connection_config: {
    use_v2_api: false
    verify_ssl: false
    max_workers: 1
  }
  auth: {
    confluence: Record<string, {
      username: ''
      api_token: ''
      pat: string
      cloud_id: ''
    }>
    jira: Record<string, never>
  }
}

export async function acquireMarkdownPagePayload (
  page: unknown,
  env: NodeJS.ProcessEnv = process.env,
  dependencies: MarkdownExporterDependencies = {}
): Promise<MarkdownPayloadResult> {
  const context = resolveRemoteAccessContext(env)
  if (!context.usable || !isCanonicalPageRef(page)) {
    return failedPayload()
  }

  let tempDir: string | null = null

  try {
    const makeTempDir = dependencies.makeTempDir ?? defaultMakeTempDir
    tempDir = await makeTempDir('confluex-markdown-export-')
    const outputDir = path.join(tempDir, 'out')
    const configPath = path.join(tempDir, 'cme-config.json')
    const config = markdownExporterConfig({
      baseUrl: context.baseUrl,
      token: context.token,
      outputDir
    })

    await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
    const execFile = dependencies.execFile ?? defaultExecFile
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

export function markdownExporterConfig (input: MarkdownExporterConfigInput): MarkdownExporterConfig {
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
  'ALL_PROXY'
] as const

function confluenceChildProcessEnv (
  env: NodeJS.ProcessEnv,
  overrides: NodeJS.ProcessEnv
): NodeJS.ProcessEnv {
  const mergedEnv: NodeJS.ProcessEnv = {
    ...process.env,
    ...env,
    ...overrides
  }
  const sanitizedNames = new Set<string>(sanitizedChildEnvNames)
  const childEnv: NodeJS.ProcessEnv = {}

  for (const [name, value] of Object.entries(mergedEnv)) {
    if (!sanitizedNames.has(name)) {
      childEnv[name] = value
    }
  }

  return childEnv
}

export function markdownExporterArgs (baseUrl: string, pageId: string): string[] {
  return [
    '--from',
    EXPORTER_PACKAGE,
    'cme',
    'page',
    pageViewUrl(baseUrl, pageId)
  ]
}

function pageViewUrl (baseUrl: string, pageId: string): string {
  const url = new URL(`${baseUrl}/pages/viewpage.action`)
  url.searchParams.set('pageId', pageId)
  return url.toString()
}

function failedPayload (): MarkdownPayloadResult {
  return {
    state: 'failed',
    error: 'page_payload_failed'
  }
}

function isCanonicalPageRef (value: unknown): value is PageRef {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    'page_id' in value &&
    typeof value.page_id === 'string' &&
    /^(0|[1-9][0-9]*)$/.test(value.page_id)
}

async function defaultMakeTempDir (prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix))
}

async function defaultExecFile (file: string, args: string[], options: ExecFileOptions): Promise<void> {
  await execFilePromise(file, args, options)
}

async function removeTempDir (tempDir: string, dependencies: MarkdownExporterDependencies): Promise<void> {
  const remove = dependencies.removeTempDir ?? ((dir: string): Promise<void> => fs.rm(dir, { recursive: true, force: true }))
  try {
    await remove(tempDir)
  } catch {
  }
}
