import { execFile as nodeExecFile } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { TextDecoder, promisify } from 'node:util'

import { allowedChildProcessEnv } from '../prereq/checks'
import { resolveRemoteAccessContext, type TransportPolicy } from '../remote/access'
import {
  markdownRemnantDiagnostics,
  normalizeMarkdownPayload,
  type MarkdownRemnantDiagnostic
} from './markdown'

const execFilePromise = promisify(nodeExecFile)
const EXPORTER_PACKAGE = 'confluence-markdown-exporter==5.0.0'
const EXPORTER_TIMEOUT_MS = 120_000
const EXPORTER_MAX_BUFFER_BYTES = 8 * 1024 * 1024
const MARKDOWN_PAYLOAD_MAX_BYTES = 64 * 1024 * 1024
const DEBUG_TEXT_MAX_BYTES = 1024 * 1024

type MarkdownExporterTrustPolicy = {
  mode: 'trusted_live_package'
  executable: 'uvx'
  package: typeof EXPORTER_PACKAGE
  tokenTransport: 'temp_config_only'
}

type PageRef = {
  page_id: string
}

type MarkdownPayloadResult =
  | {
    state: 'ok'
    payload: string
    diagnostics: MarkdownRemnantDiagnostic[]
    debug: MarkdownExporterDebugArtifacts
  }
  | {
    state: 'failed'
    error: 'page_payload_failed'
    cleanupError?: 'temp_cleanup_failed'
    debug?: MarkdownExporterDebugArtifacts
  }

export type MarkdownExporterDebugArtifacts = {
  args: string[]
  stdout: string
  stderr: string
  exitCode: number | null
  rawPayload?: string
  normalizedPayload?: string
}

type ExecFileOptions = {
  env: NodeJS.ProcessEnv
  timeout: number
  maxBuffer: number
}

type ExecFileDependency = (file: string, args: string[], options: ExecFileOptions) => Promise<unknown>

type MarkdownExporterDependencies = {
  makeTempDir?: (prefix: string) => Promise<string>
  execFile?: ExecFileDependency
  removeTempDir?: (dir: string) => Promise<unknown>
}

export type MarkdownPayloadReadDependencies = {
  stat?: (payloadPath: string) => Promise<{ size: number }>
  readFile?: (payloadPath: string) => Promise<Uint8Array>
}

type MarkdownExporterConfigInput = {
  baseUrl: string
  token: string
  outputDir: string
  verifySsl: boolean
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
    verify_ssl: boolean
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
  dependencies: MarkdownExporterDependencies = {},
  policy: TransportPolicy = { insecure: false }
): Promise<MarkdownPayloadResult> {
  const context = resolveRemoteAccessContext(env, policy)
  if (!context.usable || !isCanonicalPageRef(page)) {
    return failedPayload()
  }

  let tempDir: string | null = null
  let result: MarkdownPayloadResult = failedPayload()

  try {
    const makeTempDir = dependencies.makeTempDir ?? defaultMakeTempDir
    tempDir = await makeTempDir('confluex-markdown-export-')
    const outputDir = path.join(tempDir, 'out')
    const configPath = path.join(tempDir, 'cme-config.json')
    const config = markdownExporterConfig({
      baseUrl: context.baseUrl,
      token: context.token,
      outputDir,
      verifySsl: !policy.insecure
    })

    await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
    const execFile = dependencies.execFile ?? defaultExecFile
    const args = markdownExporterArgs(context.baseUrl, page.page_id)
    const execResult = await runExporter(execFile, args, env, configPath)
    if (execResult.state === 'failed') {
      result = failedPayload(execResult.debug)
    } else {
      const debugBase = execResult.debug
      let rawPayload: string | null = null
      try {
        rawPayload = await readMarkdownPayload(path.join(outputDir, `${page.page_id}.md`))
      } catch {
        result = failedPayload(debugBase)
      }
      if (rawPayload !== null) {
        const payload = normalizeMarkdownPayload(rawPayload)
        result = {
          state: 'ok',
          payload,
          diagnostics: markdownRemnantDiagnostics(payload),
          debug: {
            ...debugBase,
            rawPayload,
            normalizedPayload: payload
          }
        }
      }
    }
  } catch {
    result = failedPayload()
  }

  if (tempDir !== null) {
    const cleanup = await removeTempDir(tempDir, dependencies)
    if (cleanup.state === 'failed') {
      return payloadWithCleanupFailure(result, cleanup.error)
    }
  }

  return result
}

async function runExporter (
  execFile: ExecFileDependency,
  args: string[],
  env: NodeJS.ProcessEnv,
  configPath: string
): Promise<
  | { state: 'ok', debug: MarkdownExporterDebugArtifacts }
  | { state: 'failed', debug: MarkdownExporterDebugArtifacts }
> {
  try {
    const result = await execFile('uvx', args, {
      env: confluenceChildProcessEnv(env, {
        CME_CONFIG_PATH: configPath,
        CI: 'true',
        NO_COLOR: '1'
      }),
      timeout: EXPORTER_TIMEOUT_MS,
      maxBuffer: EXPORTER_MAX_BUFFER_BYTES
    })
    return {
      state: 'ok',
      debug: {
        args,
        stdout: execTextField(result, 'stdout'),
        stderr: execTextField(result, 'stderr'),
        exitCode: 0
      }
    }
  } catch (error) {
    return {
      state: 'failed',
      debug: {
        args,
        stdout: execTextField(error, 'stdout'),
        stderr: execTextField(error, 'stderr'),
        exitCode: execExitCode(error)
      }
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
      verify_ssl: input.verifySsl,
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

export function confluenceChildProcessEnv (
  env: NodeJS.ProcessEnv,
  overrides: NodeJS.ProcessEnv
): NodeJS.ProcessEnv {
  return {
    ...allowedChildProcessEnv(env),
    ...overrides
  }
}

export function markdownExporterTrustPolicy (): MarkdownExporterTrustPolicy {
  return {
    mode: 'trusted_live_package',
    executable: 'uvx',
    package: EXPORTER_PACKAGE,
    tokenTransport: 'temp_config_only'
  }
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

function failedPayload (debug?: MarkdownExporterDebugArtifacts): MarkdownPayloadResult {
  return debug === undefined
    ? {
    state: 'failed',
    error: 'page_payload_failed'
  }
    : {
        state: 'failed',
        error: 'page_payload_failed',
        debug
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

async function defaultExecFile (file: string, args: string[], options: ExecFileOptions): Promise<unknown> {
  return await execFilePromise(file, args, options)
}

export async function readMarkdownPayloadWithinCap (
  payloadPath: string,
  maxBytes = MARKDOWN_PAYLOAD_MAX_BYTES,
  dependencies: MarkdownPayloadReadDependencies = {}
): Promise<string> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new Error('markdown payload byte cap must be a non-negative safe integer')
  }
  const stat = dependencies.stat ?? defaultPayloadStat
  const metadata = await stat(payloadPath)
  if (!Number.isSafeInteger(metadata.size) || metadata.size > maxBytes) {
    throw new Error('markdown payload exceeded byte cap')
  }
  const readFile = dependencies.readFile ?? defaultPayloadReadFile
  const bytes = await readFile(payloadPath)
  if (bytes.byteLength > maxBytes) {
    throw new Error('markdown payload exceeded byte cap')
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}

async function readMarkdownPayload (payloadPath: string): Promise<string> {
  return await readMarkdownPayloadWithinCap(payloadPath)
}

async function defaultPayloadStat (payloadPath: string): Promise<{ size: number }> {
  return await fs.stat(payloadPath)
}

async function defaultPayloadReadFile (payloadPath: string): Promise<Uint8Array> {
  return await fs.readFile(payloadPath)
}

async function removeTempDir (
  tempDir: string,
  dependencies: MarkdownExporterDependencies
): Promise<{ state: 'ok' } | { state: 'failed', error: 'temp_cleanup_failed' }> {
  const remove = dependencies.removeTempDir ?? ((dir: string): Promise<void> => fs.rm(dir, { recursive: true, force: true }))
  try {
    await remove(tempDir)
    return { state: 'ok' }
  } catch {
    return { state: 'failed', error: 'temp_cleanup_failed' }
  }
}

function payloadWithCleanupFailure (
  result: MarkdownPayloadResult,
  cleanupError: 'temp_cleanup_failed'
): MarkdownPayloadResult {
  if (result.state === 'ok') {
    return {
      state: 'failed',
      error: 'page_payload_failed',
      cleanupError,
      debug: result.debug
    }
  }
  return {
    ...result,
    cleanupError
  }
}

function execTextField (value: unknown, field: 'stdout' | 'stderr'): string {
  if (isRecord(value)) {
    const output = value[field]
    if (typeof output === 'string') {
      return capDebugText(output)
    }
    if (Buffer.isBuffer(output)) {
      return capDebugText(output.toString('utf8'))
    }
  }
  return ''
}

function capDebugText (value: string): string {
  const bytes = Buffer.from(value, 'utf8')
  if (bytes.length <= DEBUG_TEXT_MAX_BYTES) {
    return value
  }
  return `${bytes.subarray(0, DEBUG_TEXT_MAX_BYTES).toString('utf8')}\n[truncated]\n`
}

function execExitCode (value: unknown): number | null {
  if (!isRecord(value)) {
    return null
  }
  const code = value.code
  return typeof code === 'number' && Number.isSafeInteger(code) ? code : null
}

function isRecord (value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
