import fs from 'node:fs/promises'
import path from 'node:path'

import { formatDiagnostic } from '../cli/diagnostics'
import { effectiveConfluenceEnv } from '../config/effective-options'
import { createDebugCollector, disabledDebugCollector, type DebugCollector, type MarkdownDebugArtifacts } from '../debug/collector'
import {
  isAbsoluteOrSchemeRelativeUrl,
  pageIdFromRelativeUrl,
  relativeUrlParts,
  titleLinkFromDisplayPath,
  titleLinkFromQuery,
  titleLinkFromRelativeUrl
} from '../links/internal-target'
import { pagePayloadFolder } from '../output/page-folder'
import { ensureDirectoryNoFollow, joinGovernedRelativePath, writeFileAtomic } from '../output/filesystem-safety'
import { selectOutputRoot, type ExecutionMode } from '../output/root'
import { assertZipPathAvailable, createZipFromRoot, zipPathForOutputRoot } from '../output/zip'
import { localizeMarkdownPayload } from '../payload/markdown-localizer'
import { acquireMarkdownPagePayload, type MarkdownExporterDebugArtifacts } from '../payload/markdown-exporter'
import { quotePathString } from '../path/format'
import {
  checkRootPageAccess,
  downloadAttachmentPayload,
  findTitleCandidates,
  getAttachmentData,
  getAttachmentPreview,
  getPageStorageContent,
  listChildPages,
  resolveRemoteAccessContext,
  type AttachmentDataItem,
  type PageMetadata,
  type TransportPolicy
} from '../remote/access'
import { runReportTexts, writeRunReportSet } from '../reports/run-report'
import type { MarkdownRemnantDiagnostic } from '../payload/markdown'
import type { EffectiveConfluenceConfig } from '../config/effective-options'

type PagePayloadFormat = 'md' | 'none'
type FinalStatus = 'success' | 'success_with_findings' | 'incomplete' | 'interrupted'
type InterruptReason = 'none' | 'max_pages_limit_reached' | 'max_download_limit_reached' | 'runtime_error' | 'signal_interrupt'
type DiscoverySource = 'root' | 'tree' | 'linked'
type ResolutionReason = 'not_found' | 'not_unique' | 'candidate_limit' | 'insufficient_data'

type CommandResult = {
  exitCode: number
  stdout: string
  stderr: string
}

type ExportOptions = {
  flags: string[]
  values: Record<string, string>
  config?: EffectiveConfluenceConfig
}

type DownloadedBytes = {
  content: number
  metadata: number
}

type ResumeState =
  | { state: 'absent' }
  | { state: 'rejected' }
  | { state: 'ok', priorFolders: Map<string, string> }

type RootAccessResult =
  | { state: 'ok', identity: string, metadata?: PageMetadata, metadataBytes?: number }
  | { state: 'failed', reason?: unknown }

type PageStorageResult =
  | { state: 'ok', storage: string, metadataBytes?: number }
  | { state: 'failed', metadataBytes?: number }

type PagePayloadResult =
  | { state: 'ok', payload: string, diagnostics?: MarkdownRemnantDiagnostic[], debug?: MarkdownExporterDebugArtifacts }
  | { state: 'failed', error?: string, debug?: MarkdownExporterDebugArtifacts }

type ChildListingResult =
  | { state: 'ok', complete: boolean, children: PageMetadata[], metadataBytes?: number }
  | { state: 'failed', metadataBytes?: number }

type AttachmentPreviewResult =
  | { state: 'ok', count: number | string, preview?: string, metadataBytes?: number }
  | { state: 'failed', metadataBytes?: number }

type AttachmentDataResult =
  | { state: 'ok', items: AttachmentDataItem[], metadataBytes?: number }
  | { state: 'failed', metadataBytes?: number }

type AttachmentPayloadResult =
  | { state: 'ok', bytes: Buffer }
  | { state: 'failed' }

type TitleDiscovery = {
  linkKind: string
  title: string
  spaceKey?: string
}

type PageIdDiscovery = {
  linkKind: string
  pageId: string
}

type PageArtifact = {
  metadata: PageMetadata
  folder: string
  storage?: string | undefined
  payload?: string | undefined
  attachmentPreview?: string | undefined
}

type ManifestRow = {
  page_id: string
  space_key: string
  page_title: string
  folder: string
  discovery_source: DiscoverySource
  execution_mode: ExecutionMode
  attachment_count: string
}

type LinkRow = Record<string, string>
type ScopeFindingRow = Record<string, string>
type FailedPageRow = Record<string, string>

type BasicPlanScope = {
  manifestRows: ManifestRow[]
  resolvedLinkRows: LinkRow[]
  unresolvedLinkRows: LinkRow[]
  failedPageRows: FailedPageRow[]
  scopeFindingRows: ScopeFindingRow[]
  payloadArtifacts: PageArtifact[]
  downloadedBytes: DownloadedBytes
  configuredStopReason: InterruptReason
}

type PageQueueEntry = {
  metadata: PageMetadata
  discoverySource: DiscoverySource
  linkDepth: number
}

type PageSleepState = {
  hasProcessedPage: boolean
  sleepMs: number
  sleep: (milliseconds: number) => Promise<void>
}

type StorageInspectionResult = {
  storage: string | null
  metadataBytes?: number | undefined
  finding: ScopeFindingRow | null
  pageIdLinks: PageIdDiscovery[]
  titleLinks: TitleDiscovery[]
  unsupportedPatterns: string[]
}

type AttachmentPreviewWork = {
  countByPageId: Map<string, string>
  previewByPageId: Map<string, string>
  failedPageRows: FailedPageRow[]
  downloadLimitReached: boolean
}

type MaterializedPayloadResult =
  | { state: 'ok', payload: string, diagnostics: MarkdownRemnantDiagnostic[] }
  | { state: 'failed' }

type LocalizedPayloadResult =
  | { state: 'ok', payload: string }
  | { state: 'failed' }

type LocalizedPayloadInput = {
  artifact: PageArtifact
  dependencies: ExportDependencies
  exportedPageFoldersByTargetKey: Map<string, string>
  pageFoldersByPageId: Map<string, string>
  pageSpaceKeysByPageId: Map<string, string>
  pagePayloadFormat: PagePayloadFormat
  payload: string
  resolvedLinkRows: LinkRow[]
  unresolvedLinkRows: LinkRow[]
}

type AttachmentPayloadArtifact = {
  filename: string
  bytes: Buffer
}

type AttachmentMaterializeResult = {
  count: number | null
  failed: boolean
  downloadLimitReached: boolean
}

type SafeAttachmentDataResult =
  | { state: 'skipped' }
  | { state: 'failed' }
  | { state: 'ok', items: AttachmentDataItem[], metadataBytes: number | undefined }

type SafeAttachmentPreviewResult =
  | { state: 'ok', count: string, preview?: string, metadataBytes: number | undefined }
  | { state: 'failed' }

type SafeChildListingResult =
  | { state: 'ok', complete: boolean, children: PageMetadata[], metadataBytes: number | undefined }
  | { state: 'failed' }

type ResolvePageIdResult =
  | { state: 'ok', metadata: PageMetadata, metadataBytes: number | undefined }
  | { state: 'failed', metadataBytes?: number | undefined }

type ResolveTitleResult =
  | { state: 'ok', metadata: PageMetadata, metadataBytes: number | undefined }
  | { state: 'unresolved', reason: ResolutionReason, finding: boolean, metadataBytes?: number | undefined }

type PageIdDiscoveryResult = {
  pageIdLinks: PageIdDiscovery[]
  titleLinks: TitleDiscovery[]
  unsupportedPatterns: string[]
  unparsedMarkers: boolean
}

type ZipPackageResult =
  | { state: 'ok', zipPath?: string }
  | { state: 'failed' }

type SuccessfulRunOptions = {
  artifactPath?: string
  artifactValue?: string
}

type ExportDependencies = {
  env?: NodeJS.ProcessEnv | undefined
  cwd?: string | undefined
  outputRoot?: string | undefined
  resumeState?: ResumeState | undefined
  markdownBaseUrl?: string | undefined
  debugCollector?: DebugCollector | undefined
  sleepMs?: ((milliseconds: number) => Promise<void>) | undefined
  checkRootPageAccess?: ((pageId: string, env: NodeJS.ProcessEnv, policy: TransportPolicy) => Promise<RootAccessResult>) | undefined
  lookupPageById?: ((pageId: string) => Promise<RootAccessResult>) | undefined
  listChildPages?: ((page: PageMetadata) => Promise<ChildListingResult>) | undefined
  getStorageContent?: ((page: PageMetadata) => Promise<PageStorageResult>) | undefined
  getPagePayload?: ((page: PageMetadata) => Promise<PagePayloadResult>) | undefined
  localizeMarkdownPayload?: ((input: {
    payload: string
    sourcePageId: string
    sourceSpaceKey?: string
    sourceFolder: string
    baseUrl?: string
    resolvedLinkRows: LinkRow[]
    unresolvedLinkRows: LinkRow[]
    pageFoldersByPageId: Map<string, string>
    exportedPageFoldersByTargetKey: Map<string, string>
  }) => Promise<{ payload: string }>) | undefined
  findTitleCandidates?: ((discovery: TitleDiscovery) => Promise<
    | { state: 'ok', complete: boolean, candidates: PageMetadata[], metadataBytes?: number }
    | { state: 'failed', metadataBytes?: number }
  >) | undefined
  getAttachmentPreview?: ((page: PageMetadata) => Promise<AttachmentPreviewResult>) | undefined
  getAttachmentData?: ((page: PageMetadata) => Promise<AttachmentDataResult>) | undefined
  downloadAttachmentPayload?: ((item: AttachmentDataItem) => Promise<AttachmentPayloadResult>) | undefined
}

const UNBOUNDED_RUN_WARNING = 'WARNING: unbounded_run use --max-pages or --max-download-mib\n'
const INSECURE_TRANSPORT_WARNING = 'WARNING: insecure_transport TLS verification disabled or HTTP transport allowed\n'
const BOUNDED_VALUE_OPTIONS = ['--max-pages', '--max-download-mib']
const MAX_FIND_CANDIDATES_OPTION = '--max-find-candidates'
const LINK_DEPTH_OPTION = '--link-depth'
const MIB_BYTES = 1024 * 1024
const RESUME_REPORT_FILENAMES = [
  'manifest.tsv',
  'resolved-links.tsv',
  'unresolved-links.tsv',
  'failed-pages.tsv',
  'scope-findings.tsv',
  'summary.txt'
]
const MANIFEST_HEADER = 'page_id\tspace_key\tpage_title\tfolder\tdiscovery_source\texecution_mode\tattachment_count'

async function runExportRelatedCommand (
  options: ExportOptions,
  dependencies: ExportDependencies = {}
): Promise<CommandResult> {
  const executionMode = effectiveExecutionMode(options)
  const transportPolicy = effectiveTransportPolicy(options)
  const env = effectiveConfluenceEnv(options, dependencies.env ?? process.env)
  const remoteAccessContext = resolveRemoteAccessContext(env, transportPolicy)
  const defaultAttachmentPreview = remoteAccessContext.usable
    ? (page: PageMetadata) => getAttachmentPreview(page, env, transportPolicy)
    : undefined
  const defaultAttachmentData = remoteAccessContext.usable
    ? (page: PageMetadata) => getAttachmentData(page, env, transportPolicy)
    : undefined
  const defaultAttachmentPayloadDownload = remoteAccessContext.usable
    ? (attachment: AttachmentDataItem) => downloadAttachmentPayload(attachment, env, transportPolicy)
    : undefined
  const defaultPagePayload = executionMode === 'materialized' &&
    effectiveExportPagePayloadFormat(options) === 'md' &&
    remoteAccessContext.usable
    ? (page: PageMetadata) => acquireMarkdownPagePayload(page, env, {}, transportPolicy)
    : undefined
  const commandDependencies: ExportDependencies = {
    ...dependencies,
    downloadAttachmentPayload: dependencies.downloadAttachmentPayload ?? defaultAttachmentPayloadDownload,
    getAttachmentData: dependencies.getAttachmentData ?? defaultAttachmentData,
    findTitleCandidates: dependencies.findTitleCandidates ?? ((discovery: TitleDiscovery) => findTitleCandidates(discovery, env, transportPolicy)),
    getAttachmentPreview: dependencies.getAttachmentPreview ?? defaultAttachmentPreview,
    localizeMarkdownPayload: dependencies.localizeMarkdownPayload ?? localizeMarkdownPayload,
    markdownBaseUrl: dependencies.markdownBaseUrl ?? (remoteAccessContext.usable ? remoteAccessContext.baseUrl : undefined),
    getPagePayload: dependencies.getPagePayload ?? defaultPagePayload,
    getStorageContent: dependencies.getStorageContent ?? ((page: PageMetadata) => getPageStorageContent(page, env, transportPolicy)),
    lookupPageById: dependencies.lookupPageById ?? ((pageId: string) => checkRootPageAccess(pageId, env, transportPolicy)),
    listChildPages: dependencies.listChildPages ?? ((page: PageMetadata) => listChildPages(page, env, transportPolicy))
  }
  const pageId = options.values['--page-id']
  const transportWarning = insecureTransportWarning(options)
  if (pageId === undefined) {
    return {
      exitCode: 1,
      stdout: '',
      stderr: `${transportWarning}${formatDiagnostic({
        type: 'missing-required-option',
        optionToken: '--page-id'
      })}\n`
    }
  }
  const accessCheck = commandDependencies.checkRootPageAccess ?? checkRootPageAccess
  const access = await accessCheck(pageId, env, transportPolicy)

  if (access.state !== 'ok') {
    return {
      exitCode: 1,
      stdout: '',
      stderr: `${transportWarning}${formatDiagnostic({
        type: 'validation-failed-page-id',
        requirementId: 'FR-0017',
        pageId
      })}\n`
    }
  }

  const outputRoot = selectOutputRoot(
    executionMode,
    access.identity,
    options,
    dependencies.cwd === undefined ? {} : { cwd: dependencies.cwd }
  )
  if (outputRoot.state === 'rejected') {
    return {
      exitCode: 1,
      stdout: '',
      stderr: `${transportWarning}${formatDiagnostic({
        type: 'validation-failed',
        requirementId: outputRoot.requirementId
      })}\n`
    }
  }

  if (isResumeExport(options)) {
    const resumeState = await evaluateResumeCompatibility(outputRoot.outputRoot, access.identity, options)
    if (resumeState.state === 'rejected') {
      return {
        exitCode: 1,
        stdout: '',
        stderr: `${transportWarning}${formatDiagnostic({
          type: 'validation-failed',
          requirementId: 'FR-0103'
        })}\n`
      }
    }
    commandDependencies.resumeState = resumeState
  }

  const debugCollector = options.flags.includes('--debug')
    ? createDebugCollector(outputRoot.outputRoot, debugSecrets(env, options))
    : disabledDebugCollector()
  commandDependencies.debugCollector = debugCollector
  if (debugCollector.enabled) {
    try {
      await debugCollector.writeRun({
        command: 'export',
        execution_mode: executionMode,
        page_id: pageId,
        output_root: outputRoot.outputRoot
      })
      await debugCollector.writeOptions({
        execution_mode: executionMode,
        flags: options.flags,
        values: options.values,
        config: options.config ?? {}
      })
      await debugCollector.recordEvent('run_accepted', {
        page_id: pageId,
        execution_mode: executionMode
      })
    } catch {
      return {
        exitCode: 4,
        stdout: '',
        stderr: `${transportWarning}ERROR: runtime_failure debug_artifact\n`
      }
    }
  }

  if (access.metadata === undefined && isBasicPlanOrExportOptions(executionMode, options)) {
    return runRootMetadataFailure(executionMode, access.identity, outputRoot.outputRoot, options, commandDependencies, rootDownloadedBytes(access))
  }

  if (isPlanOnlyExport(executionMode, options, access)) {
    return runPlanOnlyExport(access.metadata, outputRoot.outputRoot, options, commandDependencies, rootDownloadedBytes(access))
  }

  if (isBasicExport(executionMode, options, access)) {
    return runBasicExport(access.metadata, outputRoot.outputRoot, options, commandDependencies, rootDownloadedBytes(access))
  }

  return {
    exitCode: 4,
    stdout: '',
    stderr: `${transportWarning}${formatDiagnostic({
      type: 'development-pending',
      command: 'export'
    })}\n`
  }
}

async function runRootMetadataFailure (
  executionMode: ExecutionMode,
  pageId: string,
  outputRoot: string,
  options: ExportOptions,
  _dependencies: ExportDependencies,
  initialDownloadedBytes: DownloadedBytes
): Promise<CommandResult> {
  try {
    const finalStatus = completedFinalStatus(options, true)
    const reportTexts = runReportTexts({
      command: 'export',
      executionMode,
      pageId,
      outputRoot,
      outputPathProvenance: outputPathProvenance(options),
      pagePayloadFormat: executionMode === 'materialized' ? effectiveExportPagePayloadFormat(options) : 'none',
      finalStatus,
      scopeTrust: 'degraded',
      interruptReason: 'none',
      downloadedMib: downloadedMibFields(initialDownloadedBytes),
      failedPageRows: [
        rootMetadataFailedRow(pageId)
      ]
    })
    if (executionMode === 'materialized') {
      await ensureDirectoryNoFollow(path.join(outputRoot, 'pages'))
    }
    await writeRunReportSet(outputRoot, reportTexts)
    return await finalizeRunResult(executionMode, pageId, outputRoot, options, finalStatus)
  } catch {
    return {
      exitCode: 4,
      stdout: '',
      stderr: `ERROR: runtime_failure ${executionMode === 'materialized' ? 'export' : 'plan_only'}_report\n`
    }
  }
}

async function runBasicExport (
  metadata: PageMetadata,
  outputRoot: string,
  options: ExportOptions,
  dependencies: ExportDependencies,
  initialDownloadedBytes: DownloadedBytes
): Promise<CommandResult> {
  try {
    const pagePayloadFormat = effectiveExportPagePayloadFormat(options)
    return await tryRunCleanPayloadExport(metadata, outputRoot, options, dependencies, pagePayloadFormat, initialDownloadedBytes)
  } catch {
    return {
      exitCode: 4,
      stdout: '',
      stderr: 'ERROR: runtime_failure export_report\n'
    }
  }
}

async function tryRunCleanPayloadExport (
  metadata: PageMetadata,
  outputRoot: string,
  options: ExportOptions,
  dependencies: ExportDependencies,
  pagePayloadFormat: PagePayloadFormat,
  initialDownloadedBytes: DownloadedBytes
): Promise<CommandResult> {
  const pageId = metadata.page_id
  const scope = await basicPlanScope(metadata, options, dependencies, 'materialized', initialDownloadedBytes)
  if (scope.configuredStopReason === 'none' && scope.payloadArtifacts.length !== scope.manifestRows.length) {
    scope.failedPageRows.push(pagePayloadFailedRow(metadata))
  }

  const maxDownloadBytes = maxDownloadBytesLimit(options)
  let configuredStopReason = scope.configuredStopReason
  const resumeState = dependencies.resumeState?.state === 'ok'
    ? dependencies.resumeState
    : null
  const isResumeMode = resumeState !== null
  const pageFoldersByPageId = manifestFoldersByPageId(scope.manifestRows)
  const exportedPageFoldersByTargetKey = manifestFoldersByTargetKey(scope.manifestRows)
  const pageSpaceKeysByPageId = manifestSpaceKeysByPageId(scope.manifestRows)
  const attachmentCounts = new Map<string, number>()
  const attachmentFailures: FailedPageRow[] = []
  let reusedPages = 0
  if (configuredStopReason !== 'max_download_limit_reached') {
    for (const artifact of scope.payloadArtifacts) {
      const payloadResult = await materializePagePayload(artifact, pagePayloadFormat, dependencies)
      if (payloadResult.state !== 'ok') {
        scope.failedPageRows.push(pagePayloadFailedRow(artifact.metadata))
        if (!options.flags.includes('--no-fail-fast')) {
          break
        }
        continue
      }
      for (const diagnostic of payloadResult.diagnostics) {
        scope.scopeFindingRows.push(pagePayloadMarkdownRemnantRow(artifact.metadata.page_id, diagnostic))
      }
      const localizedPayload = await localizedPagePayload({
        artifact,
        dependencies,
        exportedPageFoldersByTargetKey,
        pageFoldersByPageId,
        pageSpaceKeysByPageId,
        pagePayloadFormat,
        payload: payloadResult.payload,
        resolvedLinkRows: scope.resolvedLinkRows,
        unresolvedLinkRows: scope.unresolvedLinkRows
      })
      if (localizedPayload.state !== 'ok') {
        scope.failedPageRows.push(pagePayloadFailedRow(artifact.metadata))
        if (!options.flags.includes('--no-fail-fast')) {
          break
        }
        continue
      }
      const reused = await canReusePriorPayload(outputRoot, artifact, pagePayloadFormat, resumeState, localizedPayload.payload)
      if (reused) {
        reusedPages += 1
      } else {
        await writePagePayloadArtifact(outputRoot, artifact.folder, localizedPayload.payload, pagePayloadFormat)
        addContentDownloadBytes(scope.downloadedBytes, localizedPayload.payload)
      }
      if (hasReachedDownloadLimit(scope.downloadedBytes, maxDownloadBytes)) {
        if (configuredStopReason === 'none') {
          configuredStopReason = 'max_download_limit_reached'
        }
        break
      }
      const attachmentWork = await materializeExportAttachments(outputRoot, artifact, dependencies, scope.downloadedBytes, maxDownloadBytes)
      if (attachmentWork.count !== null) {
        attachmentCounts.set(artifact.metadata.page_id, attachmentWork.count)
      }
      if (attachmentWork.failed) {
        attachmentFailures.push(attachmentDownloadFailedRow(artifact.metadata))
        if (!options.flags.includes('--no-fail-fast')) {
          break
        }
      }
      if (attachmentWork.downloadLimitReached) {
        if (configuredStopReason === 'none') {
          configuredStopReason = 'max_download_limit_reached'
        }
        break
      }
    }
  }

  const hasBlockingReasons = scope.scopeFindingRows.length > 0 ||
    scope.unresolvedLinkRows.length > 0 ||
    scope.failedPageRows.length > 0 ||
    attachmentFailures.length > 0
  const finalStatus = configuredStopReason === 'none' ? completedFinalStatus(options, hasBlockingReasons) : 'incomplete'
  const manifestRows = manifestRowsWithAttachmentCounts(scope.manifestRows, attachmentCounts)
  const reportTexts = runReportTexts({
    command: 'export',
    executionMode: 'materialized',
    pageId,
    outputRoot,
    outputPathProvenance: outputPathProvenance(options),
    pagePayloadFormat,
    finalStatus,
    scopeTrust: finalStatus === 'incomplete' || hasBlockingReasons ? 'degraded' : 'trusted',
    interruptReason: configuredStopReason,
    resumeMode: isResumeMode,
    reusedPages,
    freshPages: manifestRows.length - reusedPages,
    downloadedMib: downloadedMibFields(scope.downloadedBytes),
    manifestRows,
    resolvedLinkRows: scope.resolvedLinkRows,
    unresolvedLinkRows: scope.unresolvedLinkRows,
    scopeFindingRows: scope.scopeFindingRows,
    failedPageRows: [
      ...scope.failedPageRows,
      ...attachmentFailures
    ]
  })
  if (finalStatus === 'incomplete') {
    await writeIncompleteMarker(outputRoot)
  } else {
    await removeIncompleteMarker(outputRoot)
  }
  await writeRunReportSet(outputRoot, reportTexts)
  return finalizeRunResult('materialized', pageId, outputRoot, options, finalStatus)
}

async function runPlanOnlyExport (
  metadata: PageMetadata,
  outputRoot: string,
  options: ExportOptions,
  dependencies: ExportDependencies,
  initialDownloadedBytes: DownloadedBytes
): Promise<CommandResult> {
  try {
    const pageId = metadata.page_id
    const scope = await basicPlanScope(metadata, options, dependencies, 'plan_only', initialDownloadedBytes)
    const hasBlockingReasons = scope.scopeFindingRows.length > 0 || scope.unresolvedLinkRows.length > 0 || scope.failedPageRows.length > 0
    const finalStatus = scope.configuredStopReason === 'none' ? completedFinalStatus(options, hasBlockingReasons) : 'incomplete'
    const reportTexts = runReportTexts({
      command: 'export',
      executionMode: 'plan_only',
      pageId,
      outputRoot,
      outputPathProvenance: outputPathProvenance(options),
      pagePayloadFormat: 'none',
      finalStatus,
      scopeTrust: finalStatus === 'incomplete' || hasBlockingReasons ? 'degraded' : 'trusted',
      interruptReason: scope.configuredStopReason,
      downloadedMib: downloadedMibFields(scope.downloadedBytes),
      manifestRows: scope.manifestRows,
      resolvedLinkRows: scope.resolvedLinkRows,
      unresolvedLinkRows: scope.unresolvedLinkRows,
      scopeFindingRows: scope.scopeFindingRows,
      failedPageRows: scope.failedPageRows
    })
    if (finalStatus === 'incomplete') {
      await writeIncompleteMarker(outputRoot)
    }
    await writeRunReportSet(outputRoot, reportTexts)
    return await finalizeRunResult('plan_only', pageId, outputRoot, options, finalStatus)
  } catch {
    return {
      exitCode: 4,
      stdout: '',
      stderr: 'ERROR: runtime_failure plan_only_report\n'
    }
  }
}

async function finalizeRunResult (
  executionMode: ExecutionMode,
  pageId: string,
  outputRoot: string,
  options: ExportOptions,
  finalStatus: FinalStatus
): Promise<CommandResult> {
  return successfulPlainRootRunResult(executionMode, pageId, outputRoot, options, finalStatus)
}

async function successfulPlainRootRunResult (
  executionMode: ExecutionMode,
  pageId: string,
  outputRoot: string,
  options: ExportOptions,
  finalStatus: FinalStatus
): Promise<CommandResult> {
  const zipResult = await packageZipIfRequested(outputRoot, options)
  if (zipResult.state !== 'ok') {
    return zipArchiveFailure()
  }
  return successfulRunResult(executionMode, pageId, outputRoot, options, finalStatus, zipResult.zipPath === undefined
    ? {}
    : { artifactPath: zipResult.zipPath })
}

async function packageZipIfRequested (outputRoot: string, options: ExportOptions): Promise<ZipPackageResult> {
  if (!isZipRequested(options)) {
    return { state: 'ok' }
  }

  const zipPath = zipPathForOutputRoot(outputRoot)
  try {
    await assertZipPathAvailable(zipPath)
    await createZipFromRoot(outputRoot, zipPath)
    await rewriteSummaryFields(outputRoot, {
      zip_path: quotePathString(zipPath)
    })
    return {
      state: 'ok',
      zipPath
    }
  } catch {
    return { state: 'failed' }
  }
}

function zipArchiveFailure (): CommandResult {
  return {
    exitCode: 4,
    stdout: '',
    stderr: 'ERROR: runtime_failure zip_archive\n'
  }
}

function successfulRunResult (
  executionMode: ExecutionMode,
  pageId: string,
  outputRoot: string,
  options: ExportOptions,
  finalStatus: FinalStatus,
  resultOptions: SuccessfulRunOptions = {}
): CommandResult {
  const artifactPath = resultOptions.artifactPath ?? outputRoot
  const artifactValue = resultOptions.artifactValue ?? quotePathString(artifactPath)
  const lines = [
    `RUN_START command=export execution_mode=${executionMode} page_id=${pageId} output_root=${quotePathString(outputRoot)}`,
    'RUN_PHASE phase=scope_discovery',
    'RUN_PHASE phase=report_generation'
  ]
  if (executionMode === 'materialized') {
    lines.splice(2, 0, 'RUN_PHASE phase=page_processing')
  }
  lines.push(`RUN_COMPLETE final_status=${finalStatus} artifact=${artifactValue}`)
  return {
    exitCode: successfulRunExitCode(finalStatus),
    stdout: `${lines.join('\n')}\n`,
    stderr: warningText(options)
  }
}

async function rewriteSummaryFields (outputRoot: string, fields: Record<string, string>): Promise<void> {
  const summaryPath = path.join(outputRoot, 'summary.txt')
  const remaining = new Set(Object.keys(fields))
  const text = await fs.readFile(summaryPath, 'utf8')
  const rewritten = text.split('\n').map((line: string) => {
    const separatorIndex = line.indexOf('=')
    if (separatorIndex === -1) {
      return line
    }
    const key = line.slice(0, separatorIndex)
    if (!remaining.has(key)) {
      return line
    }
    remaining.delete(key)
    const value = fields[key]
    if (value === undefined) {
      throw new Error('summary field missing')
    }
    return `${key}=${value}`
  }).join('\n')
  if (remaining.size > 0) {
    throw new Error('summary key missing')
  }
  await writeFileAtomic(summaryPath, rewritten)
}

function successfulRunExitCode (finalStatus: FinalStatus): number {
  if (finalStatus === 'incomplete') {
    return 3
  }
  return 0
}

function isBasicExport (executionMode: ExecutionMode, options: ExportOptions, access: RootAccessResult): access is RootAccessResult & { metadata: PageMetadata } {
  return access.state === 'ok' && access.metadata !== undefined && isBasicExportOptions(executionMode, options)
}

function isBasicExportOptions (executionMode: ExecutionMode, options: ExportOptions): boolean {
  const allowedValues = ['--page-id', '--out', '--config', '--sleep-ms', MAX_FIND_CANDIDATES_OPTION, LINK_DEPTH_OPTION]
  return executionMode === 'materialized' &&
    hasOnlyFlags(options, ['--debug', '--no-fail-fast', '--resume', '--zip', '--include-children', '--insecure']) &&
    Object.keys(options.values).every(token => allowedValues.includes(token) || BOUNDED_VALUE_OPTIONS.includes(token))
}

function isPlanOnlyExport (executionMode: ExecutionMode, options: ExportOptions, access: RootAccessResult): access is RootAccessResult & { metadata: PageMetadata } {
  return access.state === 'ok' && access.metadata !== undefined && isPlanOnlyExportOptions(executionMode, options)
}

function isPlanOnlyExportOptions (executionMode: ExecutionMode, options: ExportOptions): boolean {
  const allowedValues = ['--page-id', '--out', '--config', '--sleep-ms', MAX_FIND_CANDIDATES_OPTION, LINK_DEPTH_OPTION]
  return executionMode === 'plan_only' &&
    hasOnlyFlags(options, ['--plan-only', '--debug', '--no-fail-fast', '--include-children', '--insecure']) &&
    Object.keys(options.values).every(token => allowedValues.includes(token) || BOUNDED_VALUE_OPTIONS.includes(token))
}

function isBasicPlanOrExportOptions (executionMode: ExecutionMode, options: ExportOptions): boolean {
  return isPlanOnlyExportOptions(executionMode, options) || isBasicExportOptions(executionMode, options)
}

function hasOnlyFlags (options: ExportOptions, allowedFlags: string[]): boolean {
  return options.flags.every((flag: string) => allowedFlags.includes(flag))
}

function isResumeExport (options: ExportOptions): boolean {
  return options.flags.includes('--resume')
}

function isZipRequested (options: ExportOptions): boolean {
  return options.flags.includes('--zip')
}

async function evaluateResumeCompatibility (outputRoot: string, pageId: string, options: ExportOptions): Promise<ResumeState> {
  try {
    if (!await pathIsFile(path.join(outputRoot, 'INCOMPLETE'))) {
      return rejectedResume()
    }
    if (await pathExists(path.join(outputRoot, 'NON_AUTHORITATIVE'))) {
      return rejectedResume()
    }
    for (const filename of RESUME_REPORT_FILENAMES) {
      if (!await pathIsFile(path.join(outputRoot, filename))) {
        return rejectedResume()
      }
    }

    const summary = parseSummaryText(await fs.readFile(path.join(outputRoot, 'summary.txt'), 'utf8'))
    if (summary === null || !resumeSummaryMatches(summary, outputRoot, pageId, options)) {
      return rejectedResume()
    }

    const priorFolders = parseResumeManifest(await fs.readFile(path.join(outputRoot, 'manifest.tsv'), 'utf8'))
    if (priorFolders === null) {
      return rejectedResume()
    }

    return {
      state: 'ok',
      priorFolders
    }
  } catch {
    return rejectedResume()
  }
}

function parseSummaryText (text: string): Map<string, string> | null {
  const values = new Map<string, string>()
  for (const line of text.split('\n')) {
    if (line === '') {
      continue
    }
    const separator = line.indexOf('=')
    if (separator <= 0) {
      return null
    }
    const key = line.slice(0, separator)
    const value = line.slice(separator + 1)
    if (values.has(key)) {
      return null
    }
    values.set(key, value)
  }
  return values
}

function resumeSummaryMatches (summary: Map<string, string>, outputRoot: string, pageId: string, options: ExportOptions): boolean {
  const decodedOutputRoot = jsonStringValue(summary.get('output_root'))
  return summary.get('command') === 'export' &&
    summary.get('execution_mode') === 'materialized' &&
    summary.get('support_profile') === 'default' &&
    summary.get('page_id') === pageId &&
    decodedOutputRoot === outputRoot &&
    summary.get('zip_path') === 'none' &&
    summary.get('output_path_provenance') === 'explicit' &&
    summary.get('page_payload_format') === effectiveExportPagePayloadFormat(options) &&
    (summary.get('final_status') === 'incomplete' || summary.get('final_status') === 'interrupted') &&
    summary.get('resume_mode') === '0' &&
    summary.get('resume_schema_version') === '3'
}

function jsonStringValue (value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  try {
    const parsed = JSON.parse(value) as unknown
    return typeof parsed === 'string' ? parsed : null
  } catch {
    return null
  }
}

function parseResumeManifest (text: string): Map<string, string> | null {
  const lines = text.split('\n')
  if (lines[0] !== MANIFEST_HEADER) {
    return null
  }
  const priorFolders = new Map<string, string>()
  for (const line of lines.slice(1)) {
    if (line === '') {
      continue
    }
    const fields = line.split('\t')
    if (fields.length !== 7) {
      return null
    }
    const [pageId, spaceKey, , folder] = fields
    if (pageId === undefined || spaceKey === undefined || folder === undefined) {
      return null
    }
    if (folder === 'none') {
      continue
    }
    const expectedFolder = pagePayloadFolderForPage(pageId, spaceKey === 'none' ? undefined : spaceKey)
    if (folder !== expectedFolder) {
      return null
    }
    priorFolders.set(pageId, folder)
  }
  return priorFolders
}

async function pathExists (targetPath: string): Promise<boolean> {
  try {
    await fs.lstat(targetPath)
    return true
  } catch (error) {
    if (isNodeErrorCode(error, 'ENOENT')) {
      return false
    }
    throw error
  }
}

async function pathIsFile (targetPath: string): Promise<boolean> {
  try {
    const stat = await fs.lstat(targetPath)
    return stat.isFile()
  } catch (error) {
    if (isNodeErrorCode(error, 'ENOENT')) {
      return false
    }
    throw error
  }
}

function rejectedResume (): ResumeState {
  return {
    state: 'rejected'
  }
}

function warningText (options: ExportOptions): string {
  return `${insecureTransportWarning(options)}${unboundedRunWarning(options)}`
}

function insecureTransportWarning (options: ExportOptions): string {
  return effectiveTransportPolicy(options).insecure ? INSECURE_TRANSPORT_WARNING : ''
}

function unboundedRunWarning (options: ExportOptions): string {
  return hasPositiveBoundedValue(options)
    ? ''
    : UNBOUNDED_RUN_WARNING
}

function effectiveTransportPolicy (options: ExportOptions): TransportPolicy {
  return {
    insecure: options.flags.includes('--insecure') || options.config?.insecure === true
  }
}

function completedFinalStatus (_options: ExportOptions, hasBlockingReasons: boolean): FinalStatus {
  if (!hasBlockingReasons) {
    return 'success'
  }
  return 'success_with_findings'
}

function hasPositiveBoundedValue (options: ExportOptions): boolean {
  return BOUNDED_VALUE_OPTIONS.some(token => isPositiveInteger(options.values[token]))
}

function isPositiveInteger (value: unknown): value is string {
  return typeof value === 'string' && /^(?:[1-9][0-9]*)$/.test(value)
}

function isNonNegativeInteger (value: unknown): value is string {
  return typeof value === 'string' && /^(?:0|[1-9][0-9]*)$/.test(value)
}

function outputPathProvenance (options: ExportOptions): 'explicit' | 'configured' | 'generated' {
  if (!Object.prototype.hasOwnProperty.call(options.values, '--out')) {
    return 'generated'
  }
  return options.config?.outputRoot === options.values['--out'] ? 'configured' : 'explicit'
}

function effectiveExportPagePayloadFormat (options: ExportOptions): PagePayloadFormat {
  void options
  return 'md'
}

function effectiveExecutionMode (options: ExportOptions): ExecutionMode {
  return options.flags.includes('--plan-only') ? 'plan_only' : 'materialized'
}

function debugSecrets (env: NodeJS.ProcessEnv, options: ExportOptions): string[] {
  return [
    env.CONFLUEX_CONFLUENCE_TOKEN,
    options.config?.confluenceToken
  ].filter((value): value is string => typeof value === 'string' && value.length > 0)
}

function rootDownloadedBytes (access: RootAccessResult): DownloadedBytes {
  return {
    content: 0,
    metadata: metadataBytesFromResult(access) ?? 0
  }
}

function downloadedByteState (value: DownloadedBytes | null | undefined): DownloadedBytes {
  const content = value?.content
  const metadata = value?.metadata
  return {
    content: Number.isSafeInteger(content) && content !== undefined && content >= 0 ? content : 0,
    metadata: Number.isSafeInteger(metadata) && metadata !== undefined && metadata >= 0 ? metadata : 0
  }
}

function hasAnyDownloadedBytes (downloadedBytes: DownloadedBytes): boolean {
  return downloadedBytes.content > 0 || downloadedBytes.metadata > 0
}

function pageSleepState (options: ExportOptions, dependencies: ExportDependencies): PageSleepState {
  return {
    hasProcessedPage: false,
    sleepMs: effectiveSleepMs(options),
    sleep: typeof dependencies.sleepMs === 'function' ? dependencies.sleepMs : defaultSleepMs
  }
}

async function sleepBeforePageProcessing (sleepState: PageSleepState): Promise<void> {
  if (!sleepState.hasProcessedPage) {
    sleepState.hasProcessedPage = true
    return
  }
  if (sleepState.sleepMs === 0) {
    return
  }
  await sleepState.sleep(sleepState.sleepMs)
}

function effectiveSleepMs (options: ExportOptions): number {
  if (Object.prototype.hasOwnProperty.call(options.values, '--sleep-ms')) {
    return Number(options.values['--sleep-ms'])
  }
  return 0
}

function defaultSleepMs (milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

async function basicPlanScope (
  rootMetadata: PageMetadata,
  options: ExportOptions,
  dependencies: ExportDependencies,
  executionMode: ExecutionMode = 'plan_only',
  initialDownloadedBytes: DownloadedBytes
): Promise<BasicPlanScope> {
  const maxPages = maxPagesLimit(options)
  const maxDownloadBytes = maxDownloadBytesLimit(options)
  const linkDepth = effectiveLinkDepth(options)
  const includeChildren = isChildTraversalSelected(options)
  const sleepState = pageSleepState(options, dependencies)
  const downloadedBytes = downloadedByteState(initialDownloadedBytes)
  let downloadLimitReached = hasReachedDownloadLimit(downloadedBytes, maxDownloadBytes)
  const pages: PageQueueEntry[] = [
    {
      metadata: rootMetadata,
      discoverySource: 'root',
      linkDepth: 0
    }
  ]
  const seenPageIds = new Set<string>([rootMetadata.page_id])
  const resolvedLinkRows: LinkRow[] = []
  const unresolvedLinkRows: LinkRow[] = []
  const scopeFindingRows: ScopeFindingRow[] = []
  const storageByPageId = new Map<string, string>()
  const byteOperationPages: PageQueueEntry[] = hasAnyDownloadedBytes(downloadedBytes) ? pages.slice(0, 1) : []
  const listChildPages = dependencies.listChildPages

  if (includeChildren) {
    if (typeof listChildPages !== 'function') {
      scopeFindingRows.push(childListingIncompleteRow(rootMetadata.page_id))
    } else {
      for (let index = 0; index < pages.length; index += 1) {
        if (downloadLimitReached || (maxPages !== null && index >= maxPages)) {
          break
        }
        const page = pages[index]
        if (page === undefined) {
          break
        }
        const source = page.metadata
        const listing = await safeListChildPages(listChildPages, source)
        if (listing.state !== 'ok') {
          scopeFindingRows.push(childListingIncompleteRow(source.page_id))
          continue
        }
        const listingMetadataBytes = listing.metadataBytes
        if (Number.isSafeInteger(listingMetadataBytes) && listingMetadataBytes !== undefined && listingMetadataBytes >= 0) {
          byteOperationPages.push(page)
          addMetadataDownloadBytes(downloadedBytes, listingMetadataBytes, '')
          if (hasReachedDownloadLimit(downloadedBytes, maxDownloadBytes)) {
            downloadLimitReached = true
          }
        }
        if (!listing.complete) {
          scopeFindingRows.push(childListingPartialRow(source.page_id))
        }
        for (const child of listing.children) {
          if (!isUsablePageMetadata(child)) {
            scopeFindingRows.push(childListingIncompleteRow(source.page_id))
            continue
          }
          resolvedLinkRows.push(childResultLinkRow(source, child))
          if (!seenPageIds.has(child.page_id)) {
            seenPageIds.add(child.page_id)
            pages.push({
              metadata: child,
              discoverySource: 'tree',
              linkDepth: 0
            })
          }
        }
        if (downloadLimitReached) {
          break
        }
      }
    }
  }

  if (!downloadLimitReached) {
    for (let index = 0; index < pages.length; index += 1) {
      if (downloadLimitReached || (maxPages !== null && index >= maxPages)) {
        break
      }
      const page = pages[index]
      if (page === undefined) {
        break
      }
      await sleepBeforePageProcessing(sleepState)
      const storageResult = await inspectStorageContent(page.metadata, dependencies)
      byteOperationPages.push(page)
      if (typeof storageResult.storage === 'string') {
        storageByPageId.set(page.metadata.page_id, storageResult.storage)
        await dependencies.debugCollector?.writePageStorage(page.metadata.page_id, storageResult.storage)
        addMetadataDownloadBytes(downloadedBytes, storageResult.metadataBytes, storageResult.storage)
        if (hasReachedDownloadLimit(downloadedBytes, maxDownloadBytes)) {
          downloadLimitReached = true
        }
      }
      if (storageResult.finding !== null) {
        scopeFindingRows.push(storageResult.finding)
        if (downloadLimitReached) {
          break
        }
        continue
      }
      if (downloadLimitReached) {
        break
      }
      for (const pattern of storageResult.unsupportedPatterns) {
        scopeFindingRows.push(unsupportedPatternRow(page.metadata.page_id, pattern))
      }
      if (page.linkDepth >= linkDepth) {
        continue
      }
      for (const discovery of storageResult.pageIdLinks) {
        const resolution = await resolvePageId(discovery.pageId, dependencies)
        if (addMetadataResultDownloadBytes(downloadedBytes, resolution, maxDownloadBytes)) {
          downloadLimitReached = true
        }
        if (resolution.state !== 'ok') {
          unresolvedLinkRows.push(unresolvedPageIdLinkRow(page.metadata, discovery))
          if (downloadLimitReached) {
            break
          }
          continue
        }
        resolvedLinkRows.push(pageIdLinkRow(page.metadata, resolution.metadata, discovery))
        if (!seenPageIds.has(resolution.metadata.page_id)) {
          seenPageIds.add(resolution.metadata.page_id)
          pages.push({
            metadata: resolution.metadata,
            discoverySource: 'linked',
            linkDepth: page.linkDepth + 1
          })
        }
        if (downloadLimitReached) {
          break
        }
      }
      if (downloadLimitReached) {
        break
      }
      for (const discovery of storageResult.titleLinks) {
        const resolution = await resolveTitleLink(discovery, dependencies, options)
        if (addMetadataResultDownloadBytes(downloadedBytes, resolution, maxDownloadBytes)) {
          downloadLimitReached = true
        }
        if (resolution.state !== 'ok') {
          unresolvedLinkRows.push(unresolvedTitleLinkRow(page.metadata, discovery, resolution.reason))
          if (resolution.finding) {
            scopeFindingRows.push(titleResolutionIncompleteRow(page.metadata.page_id))
          }
          if (downloadLimitReached) {
            break
          }
          continue
        }
        resolvedLinkRows.push(titleLinkRow(page.metadata, resolution.metadata, discovery))
        if (!seenPageIds.has(resolution.metadata.page_id)) {
          seenPageIds.add(resolution.metadata.page_id)
          pages.push({
            metadata: resolution.metadata,
            discoverySource: 'linked',
            linkDepth: page.linkDepth + 1
          })
        }
        if (downloadLimitReached) {
          break
        }
      }
    }
  }

  const processedPages = processedPageSlice(pages, maxPages)
  const maxPagesStopReason = maxPages !== null && pages.length > processedPages.length
    ? 'max_pages_limit_reached'
    : 'none'

  const reachedDownloadLimitBeforePreview = downloadLimitReached
  const manifestPages = reachedDownloadLimitBeforePreview && maxPagesStopReason === 'none'
    ? uniquePagesById(byteOperationPages)
    : processedPages
  const attachmentPreviewPages = reachedDownloadLimitBeforePreview ? [] : manifestPages
  const attachmentPreviews = await acquireAttachmentPreviews(attachmentPreviewPages, options, dependencies, executionMode, {
    downloadedBytes,
    maxDownloadBytes
  })
  downloadLimitReached = downloadLimitReached || attachmentPreviews.downloadLimitReached
  const configuredStopReason = maxPagesStopReason !== 'none'
    ? maxPagesStopReason
    : downloadLimitReached ? 'max_download_limit_reached' : 'none'
  await writeDebugManifestMetadata(dependencies.debugCollector, manifestPages)

  return {
    configuredStopReason,
    downloadedBytes,
    manifestRows: manifestPages.map(page => planManifestRow(
      page.metadata,
      page.discoverySource,
      executionMode,
      attachmentPreviews.countByPageId.get(page.metadata.page_id) ?? 'none'
    )),
    resolvedLinkRows,
    unresolvedLinkRows,
    scopeFindingRows,
    failedPageRows: attachmentPreviews.failedPageRows,
    payloadArtifacts: manifestPages
      .map(page => payloadArtifactForPage(page, storageByPageId, attachmentPreviews))
      .filter(isPageArtifact)
  }
}

function payloadArtifactForPage (
  page: PageQueueEntry,
  storageByPageId: Map<string, string>,
  attachmentPreviews: AttachmentPreviewWork
): PageArtifact | null {
  const storage = storageByPageId.get(page.metadata.page_id)
  if (storage === undefined) {
    return null
  }
  return {
    ...metadataArtifactForPage(page, storageByPageId, attachmentPreviews),
    storage
  }
}

function metadataArtifactForPage (
  page: PageQueueEntry,
  storageByPageId: Map<string, string>,
  attachmentPreviews: AttachmentPreviewWork
): PageArtifact {
  const storage = storageByPageId.get(page.metadata.page_id)
  const attachmentPreview = attachmentPreviews.previewByPageId.get(page.metadata.page_id)
  return {
    metadata: page.metadata,
    folder: pagePayloadFolderForPage(page.metadata.page_id, page.metadata.space_key),
    ...(storage === undefined ? {} : { storage }),
    ...(attachmentPreview === undefined ? {} : { attachmentPreview })
  }
}

function isPageArtifact (value: PageArtifact | null): value is PageArtifact {
  return value !== null
}

async function writeDebugManifestMetadata (
  debugCollector: DebugCollector | undefined,
  pages: PageQueueEntry[]
): Promise<void> {
  if (debugCollector === undefined || !debugCollector.enabled) {
    return
  }
  for (const page of pages) {
    await debugCollector.writePageMetadata(page.metadata.page_id, page.metadata)
  }
}

function maxPagesLimit (options: ExportOptions): number | null {
  const value = options.values['--max-pages']
  if (isPositiveInteger(value)) {
    const parsed = Number(value)
    return Number.isSafeInteger(parsed) ? parsed : null
  }
  return null
}

function maxDownloadBytesLimit (options: ExportOptions): number | null {
  const value = options.values['--max-download-mib']
  if (isPositiveInteger(value)) {
    const parsed = Number(value)
    const bytes = parsed * MIB_BYTES
    return Number.isSafeInteger(bytes) ? bytes : null
  }
  return null
}

function effectiveLinkDepth (options: ExportOptions): number {
  const value = options.values[LINK_DEPTH_OPTION]
  if (isNonNegativeInteger(value)) {
    const parsed = Number(value)
    return Number.isSafeInteger(parsed) ? parsed : 1
  }
  return 1
}

function isChildTraversalSelected (options: ExportOptions): boolean {
  return options.flags.includes('--include-children')
}

function processedPageSlice (pages: PageQueueEntry[], maxPages: number | null): PageQueueEntry[] {
  return maxPages === null ? pages.slice() : pages.slice(0, maxPages)
}

function addMetadataDownloadBytes (downloadedBytes: DownloadedBytes, metadataBytes: unknown, fallbackText: string): void {
  downloadedBytes.metadata += metadataByteCount(metadataBytes, fallbackText)
}

function addMetadataResultDownloadBytes (
  downloadedBytes: DownloadedBytes,
  result: { metadataBytes?: unknown },
  maxDownloadBytes: number | null
): boolean {
  const metadataBytes = metadataBytesFromResult(result)
  if (metadataBytes === undefined) {
    return false
  }
  addMetadataDownloadBytes(downloadedBytes, metadataBytes, '')
  return hasReachedDownloadLimit(downloadedBytes, maxDownloadBytes)
}

function addContentDownloadBytes (downloadedBytes: DownloadedBytes, text: string): void {
  downloadedBytes.content += Buffer.byteLength(text, 'utf8')
}

function addBufferContentDownloadBytes (downloadedBytes: DownloadedBytes, bytes: Buffer): void {
  downloadedBytes.content += bytes.length
}

function hasReachedDownloadLimit (downloadedBytes: DownloadedBytes, maxDownloadBytes: number | null): boolean {
  return maxDownloadBytes !== null && totalDownloadedBytes(downloadedBytes) >= maxDownloadBytes
}

function totalDownloadedBytes (downloadedBytes: DownloadedBytes): number {
  return downloadedBytes.content + downloadedBytes.metadata
}

function remainingDownloadBudget (downloadedBytes: DownloadedBytes, maxDownloadBytes: number | null): number | null {
  return maxDownloadBytes === null ? null : maxDownloadBytes - totalDownloadedBytes(downloadedBytes)
}

function downloadedMibFields (downloadedBytes: DownloadedBytes = { content: 0, metadata: 0 }): Record<string, string> {
  return {
    total: formatMib(totalDownloadedBytes(downloadedBytes)),
    content: formatMib(downloadedBytes.content),
    metadata: formatMib(downloadedBytes.metadata)
  }
}

function formatMib (bytes: number): string {
  const thousandths = Math.floor((bytes * 1000 + MIB_BYTES / 2) / MIB_BYTES)
  const whole = Math.floor(thousandths / 1000)
  const fractional = String(thousandths % 1000).padStart(3, '0')
  return `${whole}.${fractional}`
}

function uniquePagesById (pages: PageQueueEntry[]): PageQueueEntry[] {
  const seenPageIds = new Set<string>()
  const uniquePages: PageQueueEntry[] = []
  for (const page of pages) {
    if (seenPageIds.has(page.metadata.page_id)) {
      continue
    }
    seenPageIds.add(page.metadata.page_id)
    uniquePages.push(page)
  }
  return uniquePages
}

function manifestRowsWithAttachmentCounts (manifestRows: ManifestRow[], attachmentCounts: Map<string, number>): ManifestRow[] {
  if (attachmentCounts.size === 0) {
    return manifestRows
  }
  return manifestRows.map((row: ManifestRow) => attachmentCounts.has(row.page_id)
    ? {
        ...row,
        attachment_count: String(attachmentCounts.get(row.page_id))
      }
    : row)
}

async function materializePagePayload (
  artifact: PageArtifact,
  _pagePayloadFormat: PagePayloadFormat,
  dependencies: ExportDependencies
): Promise<MaterializedPayloadResult> {
  const getPagePayload = dependencies.getPagePayload
  if (typeof getPagePayload !== 'function') {
    return { state: 'failed' }
  }

  try {
    const result = await getPagePayload(artifact.metadata)
    if (result.debug !== undefined) {
      await dependencies.debugCollector?.writeMarkdownExporter(artifact.metadata.page_id, markdownDebugArtifacts(result.debug))
    }
    if (result.state !== 'ok') {
      return { state: 'failed' }
    }
    return {
      state: 'ok',
      payload: result.payload,
      diagnostics: Array.isArray(result.diagnostics) ? result.diagnostics : []
    }
  } catch {
    return { state: 'failed' }
  }
}

function markdownDebugArtifacts (input: MarkdownExporterDebugArtifacts): MarkdownDebugArtifacts {
  return {
    args: input.args,
    stdout: input.stdout,
    stderr: input.stderr,
    exitCode: input.exitCode,
    ...(input.rawPayload === undefined ? {} : { rawPayload: input.rawPayload }),
    ...(input.normalizedPayload === undefined ? {} : { normalizedPayload: input.normalizedPayload })
  }
}

async function localizedPagePayload (input: LocalizedPayloadInput): Promise<LocalizedPayloadResult> {
  if (input.pagePayloadFormat !== 'md') {
    return {
      state: 'ok',
      payload: input.payload
    }
  }

  if (typeof input.dependencies.localizeMarkdownPayload !== 'function') {
    return { state: 'failed' }
  }

  try {
    const sourceSpaceKey = input.pageSpaceKeysByPageId.get(input.artifact.metadata.page_id)
    const localizeInput = {
      payload: input.payload,
      sourcePageId: input.artifact.metadata.page_id,
      sourceFolder: input.artifact.folder,
      resolvedLinkRows: input.resolvedLinkRows,
      unresolvedLinkRows: input.unresolvedLinkRows,
      pageFoldersByPageId: input.pageFoldersByPageId,
      exportedPageFoldersByTargetKey: input.exportedPageFoldersByTargetKey,
      ...(sourceSpaceKey === undefined ? {} : { sourceSpaceKey })
    }
    const result = await input.dependencies.localizeMarkdownPayload(
      input.dependencies.markdownBaseUrl === undefined
        ? localizeInput
        : { ...localizeInput, baseUrl: input.dependencies.markdownBaseUrl }
    )
    if (typeof result.payload !== 'string') {
      return { state: 'failed' }
    }
    return {
      state: 'ok',
      payload: result.payload
    }
  } catch {
    return { state: 'failed' }
  }
}

async function canReusePriorPayload (
  outputRoot: string,
  artifact: PageArtifact,
  pagePayloadFormat: PagePayloadFormat,
  resumeState: Extract<ResumeState, { state: 'ok' }> | null,
  payload: string
): Promise<boolean> {
  if (resumeState === null) {
    return false
  }
  const priorFolder = resumeState.priorFolders.get(artifact.metadata.page_id)
  if (priorFolder !== artifact.folder) {
    return false
  }

  try {
    if (!await pathSegmentsAreDirectories(outputRoot, artifact.folder)) {
      return false
    }
    const folderPath = path.join(outputRoot, ...artifact.folder.split('/'))
    if (!await payloadFolderEntriesAreReusable(folderPath, pagePayloadFormat)) {
      return false
    }
    const priorPayload = await fs.readFile(path.join(folderPath, pagePayloadFilename(pagePayloadFormat)), 'utf8')
    return priorPayload === payload
  } catch {
    return false
  }
}

async function pathSegmentsAreDirectories (outputRoot: string, relativeFolder: string): Promise<boolean> {
  let currentPath = outputRoot
  for (const segment of relativeFolder.split('/')) {
    currentPath = path.join(currentPath, segment)
    const stat = await fs.lstat(currentPath)
    if (!stat.isDirectory()) {
      return false
    }
  }
  return true
}

function manifestFoldersByPageId (manifestRows: ManifestRow[]): Map<string, string> {
  const folders = new Map<string, string>()
  for (const row of manifestRows) {
    if (row.folder !== 'none') {
      folders.set(row.page_id, row.folder)
    }
  }
  return folders
}

function manifestSpaceKeysByPageId (manifestRows: ManifestRow[]): Map<string, string> {
  const spaceKeys = new Map<string, string>()
  for (const row of manifestRows) {
    if (row.space_key !== 'none') {
      spaceKeys.set(row.page_id, row.space_key)
    }
  }
  return spaceKeys
}

function manifestFoldersByTargetKey (manifestRows: ManifestRow[]): Map<string, string> {
  const folders = new Map<string, string>()
  for (const row of manifestRows) {
    if (row.page_id === '' || row.folder === 'none' || row.folder === '') {
      continue
    }
    folders.set(`page_id:${row.page_id}`, row.folder)
    if (row.space_key !== 'none' && row.space_key !== '' && row.page_title !== '') {
      folders.set(titleTargetKeyWithSpaceKey(row.space_key, row.page_title), row.folder)
    }
  }
  return folders
}

function titleTargetKeyWithSpaceKey (spaceKey: string, title: string): string {
  return [
    'space_key_present=1',
    `space_key_bytes=${Buffer.byteLength(spaceKey, 'utf8')}`,
    `space_key=${spaceKey}`,
    `title_bytes=${Buffer.byteLength(title, 'utf8')}`,
    `title=${title}`
  ].join(';')
}

function pagePayloadFolderForPage (pageId: string, spaceKey: string | undefined): string {
  return pagePayloadFolder(spaceKey === undefined ? { pageId } : { pageId, spaceKey })
}

async function payloadFolderEntriesAreReusable (folderPath: string, pagePayloadFormat: PagePayloadFormat): Promise<boolean> {
  const payloadName = pagePayloadFilename(pagePayloadFormat)
  const allowedNames = new Set([payloadName, 'attachments'])
  const entries = await fs.readdir(folderPath, { withFileTypes: true })
  let hasPayload = false

  for (const entry of entries) {
    if (!allowedNames.has(entry.name)) {
      return false
    }
    if (entry.name === payloadName) {
      if (!entry.isFile()) {
        return false
      }
      hasPayload = true
    }
    if (entry.name === 'attachments' && !entry.isDirectory()) {
      return false
    }
  }

  return hasPayload
}

function metadataByteCount (metadataBytes: unknown, fallbackText: string): number {
  if (typeof metadataBytes === 'number' && Number.isSafeInteger(metadataBytes) && metadataBytes >= 0) {
    return metadataBytes
  }
  return Buffer.byteLength(fallbackText, 'utf8')
}

async function acquireAttachmentPreviews (
  pages: PageQueueEntry[],
  options: ExportOptions,
  dependencies: ExportDependencies,
  executionMode: ExecutionMode,
  downloadAccounting: { downloadedBytes?: DownloadedBytes, maxDownloadBytes?: number | null } = {}
): Promise<AttachmentPreviewWork> {
  const countByPageId = new Map<string, string>()
  const previewByPageId = new Map<string, string>()
  const failedPageRows: FailedPageRow[] = []
  let downloadLimitReached = false
  const getAttachmentPreview = dependencies.getAttachmentPreview
  if (executionMode !== 'plan_only' || typeof getAttachmentPreview !== 'function') {
    return { countByPageId, previewByPageId, failedPageRows, downloadLimitReached }
  }

  for (const page of pages) {
    const result = await safeGetAttachmentPreview(getAttachmentPreview, page.metadata)
    if (result.state !== 'ok') {
      failedPageRows.push(attachmentPreviewFailedRow(page.metadata))
      if (!options.flags.includes('--no-fail-fast')) {
        break
      }
      continue
    }
    await dependencies.debugCollector?.writeAttachmentPreview(page.metadata.page_id, {
      count: result.count,
      ...(typeof result.preview === 'string' ? { preview: result.preview } : {})
    })
    countByPageId.set(page.metadata.page_id, result.count)
    if (typeof result.preview === 'string') {
      previewByPageId.set(page.metadata.page_id, result.preview)
      if (downloadAccounting.downloadedBytes !== undefined) {
        addMetadataDownloadBytes(downloadAccounting.downloadedBytes, result.metadataBytes, result.preview)
      }
      if (
        downloadAccounting.downloadedBytes !== undefined &&
        hasReachedDownloadLimit(downloadAccounting.downloadedBytes, downloadAccounting.maxDownloadBytes ?? null)
      ) {
        downloadLimitReached = true
        break
      }
    }
  }

  return { countByPageId, previewByPageId, failedPageRows, downloadLimitReached }
}

async function materializeExportAttachments (
  outputRoot: string,
  artifact: PageArtifact,
  dependencies: ExportDependencies,
  downloadedBytes: DownloadedBytes,
  maxDownloadBytes: number | null
): Promise<AttachmentMaterializeResult> {
  const attachmentData = await safeGetAttachmentData(dependencies.getAttachmentData, artifact.metadata)
  if (attachmentData.state === 'skipped') {
    return { count: null, failed: false, downloadLimitReached: false }
  }
  if (attachmentData.state !== 'ok') {
    return { count: null, failed: true, downloadLimitReached: false }
  }

  addMetadataDownloadBytes(downloadedBytes, attachmentData.metadataBytes, '')
  if (hasReachedDownloadLimit(downloadedBytes, maxDownloadBytes)) {
    return { count: attachmentData.items.length, failed: false, downloadLimitReached: true }
  }
  if (attachmentData.items.length === 0) {
    return { count: 0, failed: false, downloadLimitReached: false }
  }
  if (!hasValidAttachmentFilenames(attachmentData.items) || typeof dependencies.downloadAttachmentPayload !== 'function') {
    return { count: attachmentData.items.length, failed: true, downloadLimitReached: false }
  }

  const payloads: AttachmentPayloadArtifact[] = []
  let downloadLimitReached = false
  for (const item of orderedAttachmentItems(attachmentData.items)) {
    const remainingBudget = remainingDownloadBudget(downloadedBytes, maxDownloadBytes)
    if (remainingBudget !== null && remainingBudget <= 0) {
      downloadLimitReached = true
      break
    }
    const payload = await safeDownloadAttachmentPayload(dependencies.downloadAttachmentPayload, item)
    if (payload.state !== 'ok') {
      return { count: attachmentData.items.length, failed: true, downloadLimitReached: false }
    }
    addBufferContentDownloadBytes(downloadedBytes, payload.bytes)
    if (remainingBudget !== null && payload.bytes.length > remainingBudget) {
      downloadLimitReached = true
      break
    }
    payloads.push({
      filename: item.filename,
      bytes: payload.bytes
    })
    if (hasReachedDownloadLimit(downloadedBytes, maxDownloadBytes)) {
      downloadLimitReached = true
      break
    }
  }

  await writeAttachmentPayloadArtifacts(outputRoot, artifact.folder, payloads)
  return {
    count: attachmentData.items.length,
    failed: false,
    downloadLimitReached
  }
}

async function safeGetAttachmentData (
  getAttachmentData: ExportDependencies['getAttachmentData'],
  page: PageMetadata
): Promise<SafeAttachmentDataResult> {
  if (typeof getAttachmentData !== 'function') {
    return { state: 'skipped' }
  }
  try {
    const result = await getAttachmentData(page)
    if (result.state !== 'ok' || !Array.isArray(result.items)) {
      return { state: 'failed' }
    }
    const items: AttachmentDataItem[] = []
    for (const item of result.items) {
      const filename = attachmentItemFilename(item)
      if (filename === null) {
        return { state: 'failed' }
      }
      items.push({
        ...item,
        filename
      })
    }
    return {
      state: 'ok',
      items,
      metadataBytes: metadataBytesFromResult(result)
    }
  } catch {
    return { state: 'failed' }
  }
}

function attachmentItemFilename (item: unknown): string | null {
  if (isRecord(item)) {
    if (typeof item.filename === 'string') {
      return item.filename
    }
    if (typeof item.sourceFilename === 'string') {
      return item.sourceFilename
    }
  }
  return null
}

function hasValidAttachmentFilenames (items: AttachmentDataItem[]): boolean {
  const seen = new Set<string>()
  for (const item of items) {
    if (!isValidAttachmentFilename(item.filename)) {
      return false
    }
    const key = item.filename.toLowerCase()
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
  }
  return true
}

function isValidAttachmentFilename (filename: unknown): filename is string {
  if (typeof filename !== 'string' || filename === '.' || filename === '..' || filename.endsWith('.')) {
    return false
  }
  const bytes = Buffer.byteLength(filename, 'utf8')
  if (bytes < 1 || bytes > 255 || !/^[A-Za-z0-9._-]+$/.test(filename)) {
    return false
  }
  const basename = filename.split('.')[0]
  return basename !== undefined && !WINDOWS_RESERVED_BASENAMES.has(basename.toUpperCase())
}

const WINDOWS_RESERVED_BASENAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
])

function orderedAttachmentItems (items: AttachmentDataItem[]): AttachmentDataItem[] {
  return items.slice().sort((left, right) => Buffer.compare(Buffer.from(left.filename, 'utf8'), Buffer.from(right.filename, 'utf8')))
}

async function safeDownloadAttachmentPayload (
  downloadAttachmentPayload: (item: AttachmentDataItem) => Promise<AttachmentPayloadResult>,
  item: AttachmentDataItem
): Promise<AttachmentPayloadResult> {
  try {
    const result = await downloadAttachmentPayload(item)
    if (result.state !== 'ok') {
      return { state: 'failed' }
    }
    const bytes = attachmentPayloadBytes(result.bytes)
    return bytes === null ? { state: 'failed' } : { state: 'ok', bytes }
  } catch {
    return { state: 'failed' }
  }
}

function attachmentPayloadBytes (bytes: unknown): Buffer | null {
  if (Buffer.isBuffer(bytes)) {
    return bytes
  }
  if (bytes instanceof Uint8Array) {
    return Buffer.from(bytes)
  }
  if (typeof bytes === 'string') {
    return Buffer.from(bytes, 'utf8')
  }
  return null
}

async function safeGetAttachmentPreview (
  getAttachmentPreview: (page: PageMetadata) => Promise<AttachmentPreviewResult>,
  page: PageMetadata
): Promise<SafeAttachmentPreviewResult> {
  try {
    const result = await getAttachmentPreview(page)
    if (result.state !== 'ok') {
      return { state: 'failed' }
    }
    const count = normalizeAttachmentCount(result.count)
    if (count === null) {
      return { state: 'failed' }
    }
    return {
      state: 'ok',
      count,
      ...(typeof result.preview === 'string' ? { preview: result.preview } : {}),
      metadataBytes: metadataBytesFromResult(result)
    }
  } catch {
    return { state: 'failed' }
  }
}

function normalizeAttachmentCount (value: unknown): string | null {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value >= 0 ? String(value) : null
  }
  if (typeof value === 'string' && /^(?:0|[1-9][0-9]*)$/.test(value)) {
    return value
  }
  return null
}

async function safeListChildPages (
  listChildPages: (page: PageMetadata) => Promise<ChildListingResult>,
  source: PageMetadata
): Promise<SafeChildListingResult> {
  try {
    const listing = await listChildPages(source)
    if (listing.state !== 'ok' || !Array.isArray(listing.children)) {
      return { state: 'failed' }
    }
    return {
      state: 'ok',
      complete: listing.complete,
      children: listing.children.filter(isUsablePageMetadata),
      metadataBytes: metadataBytesFromResult(listing)
    }
  } catch {
    return { state: 'failed' }
  }
}

function planManifestRow (
  metadata: PageMetadata,
  discoverySource: DiscoverySource,
  executionMode: ExecutionMode = 'plan_only',
  attachmentCount = 'none'
): ManifestRow {
  return {
    page_id: metadata.page_id,
    space_key: metadata.space_key ?? 'none',
    page_title: metadata.page_title,
    folder: executionMode === 'materialized'
      ? pagePayloadFolderForPage(metadata.page_id, metadata.space_key)
      : 'none',
    discovery_source: discoverySource,
    execution_mode: executionMode,
    attachment_count: attachmentCount
  }
}

function childResultLinkRow (source: PageMetadata, child: PageMetadata): LinkRow {
  return {
    source_page_id: source.page_id,
    source_title: source.page_title,
    link_kind: 'child_result',
    raw_link_value: `page_id:${child.page_id}`,
    target_page_id: child.page_id,
    target_space_key: child.space_key ?? 'none',
    target_title: child.page_title
  }
}

function pageIdLinkRow (source: PageMetadata, target: PageMetadata, discovery: PageIdDiscovery): LinkRow {
  return {
    source_page_id: source.page_id,
    source_title: source.page_title,
    link_kind: discovery.linkKind,
    raw_link_value: `page_id:${discovery.pageId}`,
    target_page_id: target.page_id,
    target_space_key: target.space_key ?? 'none',
    target_title: target.page_title
  }
}

function unresolvedPageIdLinkRow (source: PageMetadata, discovery: PageIdDiscovery): LinkRow {
  return {
    source_page_id: source.page_id,
    source_title: source.page_title,
    link_kind: discovery.linkKind,
    raw_link_value: `page_id:${discovery.pageId}`,
    resolution_reason: 'insufficient_data'
  }
}

function titleLinkRow (source: PageMetadata, target: PageMetadata, discovery: TitleDiscovery): LinkRow {
  return {
    source_page_id: source.page_id,
    source_title: source.page_title,
    link_kind: discovery.linkKind,
    raw_link_value: titleRawLinkValue(discovery),
    target_page_id: target.page_id,
    target_space_key: target.space_key ?? 'none',
    target_title: target.page_title
  }
}

function unresolvedTitleLinkRow (source: PageMetadata, discovery: TitleDiscovery, reason: ResolutionReason): LinkRow {
  return {
    source_page_id: source.page_id,
    source_title: source.page_title,
    link_kind: discovery.linkKind,
    raw_link_value: titleRawLinkValue(discovery),
    resolution_reason: reason
  }
}

function titleRawLinkValue (discovery: TitleDiscovery): string {
  const discoveredSpaceKey = discovery.spaceKey
  const spaceKeyPresent = typeof discoveredSpaceKey === 'string'
  const spaceKey = spaceKeyPresent ? discoveredSpaceKey : ''
  return [
    `space_key_present=${spaceKeyPresent ? '1' : '0'}`,
    `space_key_bytes=${Buffer.byteLength(spaceKey, 'utf8')}`,
    `space_key=${spaceKey}`,
    `title_bytes=${Buffer.byteLength(discovery.title, 'utf8')}`,
    `title=${discovery.title}`
  ].join(';')
}

function isUsablePageMetadata (metadata: unknown): metadata is PageMetadata {
  return isRecord(metadata) &&
    typeof metadata.page_id === 'string' &&
    /^(0|[1-9][0-9]*)$/.test(metadata.page_id) &&
    typeof metadata.page_title === 'string' &&
    metadata.page_title !== '' &&
    (metadata.space_key === undefined || typeof metadata.space_key === 'string')
}

async function inspectStorageContent (metadata: PageMetadata, dependencies: ExportDependencies): Promise<StorageInspectionResult> {
  if (typeof dependencies.getStorageContent !== 'function') {
    return {
      finding: storageUnavailableRow(metadata.page_id),
      pageIdLinks: [],
      titleLinks: [],
      unsupportedPatterns: [],
      storage: null
    }
  }

  try {
    const result = await dependencies.getStorageContent(metadata)
    if (result.state !== 'ok' || typeof result.storage !== 'string') {
      return {
        finding: storageUnavailableRow(metadata.page_id),
        pageIdLinks: [],
        titleLinks: [],
        unsupportedPatterns: [],
        storage: null
      }
    }
    const discovery = pageIdDiscoveries(result.storage)
    return discovery.unparsedMarkers
      ? {
          finding: storageUninterpretableRow(metadata.page_id),
          pageIdLinks: [],
          titleLinks: [],
          unsupportedPatterns: [],
          storage: result.storage,
          metadataBytes: metadataBytesFromResult(result)
        }
      : {
          finding: null,
          pageIdLinks: discovery.pageIdLinks,
          titleLinks: discovery.titleLinks,
          unsupportedPatterns: discovery.unsupportedPatterns,
          storage: result.storage,
          metadataBytes: metadataBytesFromResult(result)
        }
  } catch {
    return {
      finding: storageUnavailableRow(metadata.page_id),
      pageIdLinks: [],
      titleLinks: [],
      unsupportedPatterns: [],
      storage: null
    }
  }
}

function metadataBytesFromResult (result: unknown): number | undefined {
  if (!isRecord(result)) {
    return undefined
  }
  const metadataBytes = result.metadataBytes
  return typeof metadataBytes === 'number' && Number.isSafeInteger(metadataBytes) && metadataBytes >= 0
    ? metadataBytes
    : undefined
}

async function resolvePageId (pageId: string, dependencies: ExportDependencies): Promise<ResolvePageIdResult> {
  if (typeof dependencies.lookupPageById !== 'function') {
    return { state: 'failed' }
  }

  try {
    const result = await dependencies.lookupPageById(pageId)
    if (result.state !== 'ok' || !isUsablePageMetadata(result.metadata)) {
      return { state: 'failed' }
    }
    return {
      state: 'ok',
      metadata: result.metadata,
      metadataBytes: metadataBytesFromResult(result)
    }
  } catch {
    return { state: 'failed' }
  }
}

async function resolveTitleLink (
  discovery: TitleDiscovery,
  dependencies: ExportDependencies,
  options: ExportOptions
): Promise<ResolveTitleResult> {
  if (typeof dependencies.findTitleCandidates !== 'function') {
    return { state: 'unresolved', reason: 'insufficient_data', finding: true }
  }

  try {
    const result = await dependencies.findTitleCandidates(discovery)
    const metadataBytes = metadataBytesFromResult(result)
    if (result.state !== 'ok' || !result.complete || !Array.isArray(result.candidates)) {
      return { state: 'unresolved', reason: 'insufficient_data', finding: true, metadataBytes }
    }

    const candidateLimit = effectiveCandidateLimit(options)
    if (candidateLimit !== null && result.candidates.length > candidateLimit) {
      return { state: 'unresolved', reason: 'candidate_limit', finding: false, metadataBytes }
    }
    const compatible = uniqueCompatibleTitleCandidates(discovery, candidateLimit === null ? result.candidates : result.candidates.slice(0, candidateLimit))
    if (compatible.length === 0) {
      return { state: 'unresolved', reason: 'not_found', finding: false, metadataBytes }
    }
    if (compatible.length > 1) {
      return { state: 'unresolved', reason: 'not_unique', finding: false, metadataBytes }
    }
    const selected = compatible[0]
    if (selected === undefined) {
      return { state: 'unresolved', reason: 'not_found', finding: false, metadataBytes }
    }
    return {
      state: 'ok',
      metadata: selected,
      metadataBytes
    }
  } catch {
    return { state: 'unresolved', reason: 'insufficient_data', finding: true }
  }
}

function effectiveCandidateLimit (options: ExportOptions): number | null {
  const explicitLimit = options.values[MAX_FIND_CANDIDATES_OPTION]
  if (isPositiveInteger(explicitLimit)) {
    return Number(explicitLimit)
  }
  return null
}

function uniqueCompatibleTitleCandidates (discovery: TitleDiscovery, candidates: unknown[]): PageMetadata[] {
  const byPageId = new Map<string, PageMetadata>()
  for (const candidate of candidates) {
    if (!isCompatibleTitleCandidate(discovery, candidate) || byPageId.has(candidate.page_id)) {
      continue
    }
    byPageId.set(candidate.page_id, candidate)
  }
  return Array.from(byPageId.values())
}

function isCompatibleTitleCandidate (discovery: TitleDiscovery, candidate: unknown): candidate is PageMetadata {
  return isUsablePageMetadata(candidate) &&
    candidate.page_title === discovery.title &&
    (typeof discovery.spaceKey !== 'string' || candidate.space_key === discovery.spaceKey)
}

function pageIdDiscoveries (storage: string): PageIdDiscoveryResult {
  const pageIdLinks: PageIdDiscovery[] = []
  const titleLinks: TitleDiscovery[] = []
  const contentIdPattern = /<ri:(?:content-entity|page)\b[^>]*\bri:content-id="(0|[1-9][0-9]*)"[^>]*>/g
  const withoutContentIds = storage.replace(contentIdPattern, (_match: string, contentId: string) => {
    pageIdLinks.push({ linkKind: 'content_id', pageId: contentId })
    return ''
  })
  const pageRefPattern = /<ri:page\b[^>]*(?:\/>|><\/ri:page>)/g
  const withoutPageRefs = withoutContentIds.replace(pageRefPattern, (match: string) => {
    const discovery = pageRefDiscovery(match)
    if (discovery === null) {
      return match
    }
    titleLinks.push(discovery)
    return ''
  })
  const macroParamPattern = /<ac:parameter\b[^>]*\bac:name="page"[^>]*>([\s\S]*?)<\/ac:parameter>/g
  const withoutMacroParams = withoutPageRefs.replace(macroParamPattern, (match: string, rawText: string) => {
    const discovery = macroParamDiscovery(rawText)
    if (discovery === null) {
      return match
    }
    titleLinks.push(discovery)
    return ''
  })
  const attachmentRefPattern = /<ri:attachment\b[^>]*(?:\/>|><\/ri:attachment>)/g
  const withoutAttachmentRefs = withoutMacroParams.replace(attachmentRefPattern, '')
  const riUrlPattern = /<ri:url\b[^>]*(?:\/>|><\/ri:url>)/g
  const withoutRiUrlPageIds = withoutAttachmentRefs.replace(riUrlPattern, (match: string) => {
    const valueMatch = /\bri:value="([^"]*)"/.exec(match)
    const value = valueMatch?.[1] === undefined ? null : decodeXmlAttribute(valueMatch[1])
    if (value !== null && isAbsoluteOrSchemeRelativeUrl(value)) {
      return ''
    }
    const pageId = value === null ? null : pageIdFromRelativeUrl(value)
    if (pageId !== null) {
      pageIdLinks.push({ linkKind: 'ri_url_page_id', pageId })
      return ''
    }
    const titleLink = value === null ? null : titleLinkFromRelativeUrl(value, 'ri_url_space_title')
    if (titleLink !== null) {
      titleLinks.push(titleLink)
      return ''
    }
    return match
  })
  const hrefPattern = /\bhref="([^"]*)"/g
  const withoutHrefPageIds = withoutRiUrlPageIds.replace(hrefPattern, (match: string, rawHref: string) => {
    const href = decodeXmlAttribute(rawHref)
    if (href !== null && isAbsoluteOrSchemeRelativeUrl(href)) {
      return ''
    }
    const pageId = href === null ? null : pageIdFromRelativeUrl(href)
    if (pageId !== null) {
      pageIdLinks.push({ linkKind: 'href_page_id', pageId })
      return ''
    }
    const titleLink = href === null ? null : titleLinkFromRelativeUrl(href, 'href_space_title')
    if (titleLink !== null) {
      titleLinks.push(titleLink)
      return ''
    }
    return match
  })
  const ignoredLiteralTextStripped = stripIgnoredLiteralTextContexts(withoutHrefPageIds)
  const unsupported = unsupportedPatternDiscoveries(ignoredLiteralTextStripped)
  return {
    pageIdLinks: uniquePageIdLinks(pageIdLinks),
    titleLinks: uniqueTitleLinks(titleLinks),
    unsupportedPatterns: unsupported.patterns,
    unparsedMarkers: hasUnparsedLinkMarkers(unsupported.storage)
  }
}

function uniquePageIdLinks (links: PageIdDiscovery[]): PageIdDiscovery[] {
  const seen = new Set<string>()
  const unique: PageIdDiscovery[] = []
  for (const link of links) {
    const key = `${link.linkKind}\t${link.pageId}`
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    unique.push(link)
  }
  return unique
}

function uniqueTitleLinks (links: TitleDiscovery[]): TitleDiscovery[] {
  const seen = new Set<string>()
  const unique: TitleDiscovery[] = []
  for (const link of links) {
    const key = `${link.linkKind}\t${link.spaceKey ?? ''}\t${link.title}`
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    unique.push(link)
  }
  return unique
}

function unsupportedPatternDiscoveries (storage: string): { patterns: string[], storage: string } {
  const patterns: string[] = []
  const withoutPatterns = storage.replace(/\b[A-Za-z_:][A-Za-z0-9_:.-]*="([^"]*)"/g, (match: string, rawValue: string) => {
    const value = decodeXmlAttribute(rawValue)
    const unsupported = unsupportedPatternValue(value)
    if (unsupported === null) {
      return match
    }
    patterns.push(unsupported)
    return ''
  })
  return {
    patterns: Array.from(new Set(patterns)),
    storage: withoutPatterns
  }
}

function unsupportedPatternValue (value: string | null): string | null {
  if (value === null) {
    return null
  }
  if (/(^|[^A-Za-z0-9_])pageId=(0|[1-9][0-9]*)(?=$|[^A-Za-z0-9])/.test(value) ||
    /\/pages\/(0|[1-9][0-9]*)(?=$|[/?#&]|[^A-Za-z0-9])/.test(value)) {
    return value
  }
  const parts = relativeUrlParts(value)
  if (parts === null) {
    return null
  }
  return titleLinkFromDisplayPath(parts.pathPart, 'unsupported_pattern') !== null ||
    titleLinkFromQuery(parts.queryPart, 'unsupported_pattern') !== null
    ? value
    : null
}

function stripIgnoredLiteralTextContexts (storage: string): string {
  const withoutPlainTextBody = storage.replace(/<ac:plain-text-body\b([^>]*)>[\s\S]*?<\/ac:plain-text-body>/g, '<ac:plain-text-body$1></ac:plain-text-body>')
  const withoutPreText = withoutPlainTextBody.replace(/<pre\b([^>]*)>[\s\S]*?<\/pre>/g, '<pre$1></pre>')
  const withoutCodeText = withoutPreText.replace(/<code\b([^>]*)>[\s\S]*?<\/code>/g, '<code$1></code>')
  return withoutCodeText.replace(/<ac:parameter\b([^>]*)>[\s\S]*?<\/ac:parameter>/g, (match: string, attrs: string) => {
    return /\bac:name="page"/.test(attrs) ? match : `<ac:parameter${attrs}></ac:parameter>`
  })
}

function pageRefDiscovery (markup: string): TitleDiscovery | null {
  if (/\bri:content-id=/.test(markup)) {
    return null
  }
  const title = decodedXmlAttribute(markup, 'ri:content-title')
  if (title === null || title === '') {
    return null
  }
  const spaceKey = decodedXmlAttribute(markup, 'ri:space-key')
  if (spaceKey === '') {
    return null
  }
  return {
    linkKind: 'page_ref',
    title,
    ...(spaceKey === null ? {} : { spaceKey })
  }
}

function macroParamDiscovery (rawText: string): TitleDiscovery | null {
  const decoded = decodeXmlAttribute(rawText)
  if (decoded === null) {
    return null
  }
  const targetText = decoded.trim()
  if (targetText === '') {
    return null
  }
  const colonIndex = targetText.indexOf(':')
  if (colonIndex > 0) {
    const spaceKey = targetText.slice(0, colonIndex)
    const title = targetText.slice(colonIndex + 1).trim()
    if (/^[A-Z0-9_.-]+$/.test(spaceKey) && title !== '') {
      return {
        linkKind: 'macro_param',
        title,
        spaceKey
      }
    }
  }
  return {
    linkKind: 'macro_param',
    title: targetText
  }
}

function decodedXmlAttribute (markup: string, name: string): string | null {
  const pattern = new RegExp(`\\b${name}="([^"]*)"`)
  const match = pattern.exec(markup)
  return match?.[1] === undefined ? null : decodeXmlAttribute(match[1])
}

function decodeXmlAttribute (value: string): string | null {
  try {
    return value.replace(/&(#x[0-9A-Fa-f]+|#[0-9]+|amp|lt|gt|quot|apos|mdash);/g, (_match: string, entity: string) => {
      if (entity === 'amp') return '&'
      if (entity === 'lt') return '<'
      if (entity === 'gt') return '>'
      if (entity === 'quot') return '"'
      if (entity === 'apos') return "'"
      if (entity === 'mdash') return '—'
      const codePoint = entity.startsWith('#x')
        ? Number.parseInt(entity.slice(2), 16)
        : Number.parseInt(entity.slice(1), 10)
      return String.fromCodePoint(codePoint)
    })
  } catch {
    return null
  }
}

function hasUnparsedLinkMarkers (storage: string): boolean {
  return storage.includes('<ri:') ||
    storage.includes(' ri:') ||
    /<ac:parameter\b[^>]*\bac:name="page"[^>]*>/.test(storage) ||
    storage.includes(' href=') ||
    storage.includes('/pages/') ||
    storage.includes('/display/') ||
    storage.includes('pageId=') ||
    storage.includes('title=')
}

function childListingIncompleteRow (pageId: string): ScopeFindingRow {
  return {
    page_id: pageId,
    finding_area: 'child_listing',
    finding_type: 'incomplete_tree',
    detail: 'child_listing_incomplete'
  }
}

function childListingPartialRow (pageId: string): ScopeFindingRow {
  return {
    page_id: pageId,
    finding_area: 'child_listing',
    finding_type: 'partial_listing',
    detail: 'child_listing_partial'
  }
}

function storageUnavailableRow (pageId: string): ScopeFindingRow {
  return {
    page_id: pageId,
    finding_area: 'storage_content',
    finding_type: 'storage_unavailable',
    detail: 'storage_content_unavailable'
  }
}

function storageUninterpretableRow (pageId: string): ScopeFindingRow {
  return {
    page_id: pageId,
    finding_area: 'storage_content',
    finding_type: 'storage_uninterpretable',
    detail: 'storage_content_uninterpretable'
  }
}

function titleResolutionIncompleteRow (pageId: string): ScopeFindingRow {
  return {
    page_id: pageId,
    finding_area: 'title_resolution',
    finding_type: 'candidate_visibility_incomplete',
    detail: 'candidate_visibility_incomplete'
  }
}

function unsupportedPatternRow (pageId: string, detail: string): ScopeFindingRow {
  return {
    page_id: pageId,
    finding_area: 'unsupported_pattern',
    finding_type: 'unsupported_internal_pattern',
    detail
  }
}

function pagePayloadMarkdownRemnantRow (pageId: string, diagnostic: MarkdownRemnantDiagnostic): ScopeFindingRow {
  return {
    page_id: pageId,
    finding_area: 'page_payload',
    finding_type: 'markdown_remnant',
    detail: diagnostic.detail
  }
}

function pagePayloadFailedRow (metadata: PageMetadata): FailedPageRow {
  return {
    page_id: metadata.page_id,
    page_title: metadata.page_title,
    operation: 'page_payload',
    error_summary: 'page_payload_failed'
  }
}

function attachmentPreviewFailedRow (metadata: PageMetadata): FailedPageRow {
  return {
    page_id: metadata.page_id,
    page_title: metadata.page_title,
    operation: 'attachment_preview',
    error_summary: 'attachment_preview_failed'
  }
}

function attachmentDownloadFailedRow (metadata: PageMetadata): FailedPageRow {
  return {
    page_id: metadata.page_id,
    page_title: metadata.page_title,
    operation: 'attachment_download',
    error_summary: 'attachment_download_failed'
  }
}

function rootMetadataFailedRow (pageId: string): FailedPageRow {
  return {
    page_id: pageId,
    page_title: 'none',
    operation: 'page_metadata',
    error_summary: 'page_metadata_failed'
  }
}

async function writeIncompleteMarker (outputRoot: string): Promise<void> {
  await ensureDirectoryNoFollow(outputRoot)
  await writeFileAtomic(path.join(outputRoot, 'INCOMPLETE'), 'incomplete=1\n')
}

async function removeIncompleteMarker (outputRoot: string): Promise<void> {
  await fs.rm(path.join(outputRoot, 'INCOMPLETE'), { force: true })
}

async function writePagePayloadArtifact (
  outputRoot: string,
  folder: string,
  storage: string,
  pagePayloadFormat: PagePayloadFormat
): Promise<void> {
  const folderPath = path.join(outputRoot, ...folder.split('/'))
  await ensureDirectoryNoFollow(folderPath)
  await writeFileAtomic(path.join(folderPath, pagePayloadFilename(pagePayloadFormat)), storage)
}

function pagePayloadFilename (pagePayloadFormat: PagePayloadFormat): string {
  void pagePayloadFormat
  return 'page.md'
}

async function writeAttachmentPayloadArtifacts (
  outputRoot: string,
  folder: string,
  payloads: AttachmentPayloadArtifact[]
): Promise<void> {
  if (payloads.length === 0) {
    return
  }
  const attachmentsPath = path.join(joinGovernedRelativePath(outputRoot, folder), 'attachments')
  await ensureDirectoryNoFollow(attachmentsPath)
  for (const payload of payloads) {
    await writeFileAtomic(path.join(attachmentsPath, payload.filename), payload.bytes)
  }
}

function isRecord (value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isNodeErrorCode (error: unknown, code: string): boolean {
  return error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === code
}

export {
  runExportRelatedCommand
}
