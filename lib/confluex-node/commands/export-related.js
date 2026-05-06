'use strict'

const fs = require('node:fs/promises')
const path = require('node:path')
const { formatDiagnostic } = require('../cli/diagnostics')
const { encryptOutputRoot } = require('../encryption/archive')
const { evaluateEncryptionPreflight } = require('../encryption/recipient')
const {
  isAbsoluteOrSchemeRelativeUrl,
  pageIdFromRelativeUrl,
  relativeUrlParts,
  titleLinkFromDisplayPath,
  titleLinkFromQuery,
  titleLinkFromRelativeUrl
} = require('../links/internal-target')
const { preparePersistentLog, writePersistentLog } = require('../output/log-file')
const { pagePayloadFolder } = require('../output/page-folder')
const { selectOutputRoot } = require('../output/root')
const { localizeMarkdownPayload } = require('../payload/markdown-localizer')
const { acquireMarkdownPagePayload } = require('../payload/markdown-exporter')
const { quotePathString } = require('../path/format')
const {
  checkRootPageAccess,
  downloadAttachmentPayload,
  findTitleCandidates,
  getAttachmentData,
  getAttachmentPreview,
  getPageStorageContent,
  listChildPages,
  resolveRemoteAccessContext
} = require('../remote/access')
const { runReportTexts, writeRunReportSet } = require('../reports/run-report')

const UNBOUNDED_RUN_WARNING = 'WARNING: unbounded_run use --safe or --max-pages or --max-download-mib\n'
const CONFIDENTIAL_LOG_WARNING = 'WARNING: confidential_log_file_outside_plaintext_cleanup\n'
const BOUNDED_VALUE_OPTIONS = ['--max-pages', '--max-download-mib']
const MAX_FIND_CANDIDATES_OPTION = '--max-find-candidates'
const LINK_DEPTH_OPTION = '--link-depth'
const SAFE_PROFILE_MAX_FIND_CANDIDATES = 5
const SAFE_PROFILE_MAX_PAGES = 200
const SAFE_PROFILE_MAX_DOWNLOAD_MIB = 256
const MIB_BYTES = 1024 * 1024
const SAFE_PROFILE_SLEEP_MS = 200
const RESUME_REPORT_FILENAMES = [
  'manifest.tsv',
  'resolved-links.tsv',
  'unresolved-links.tsv',
  'failed-pages.tsv',
  'scope-findings.tsv',
  'summary.txt'
]
const MANIFEST_HEADER = 'page_id\tspace_key\tpage_title\tfolder\tdiscovery_source\trun_mode\tattachment_count'

async function runExportRelatedCommand (command, options, dependencies = {}) {
  const env = dependencies.env || process.env
  const remoteAccessContext = resolveRemoteAccessContext(env)
  const defaultAttachmentPreview = remoteAccessContext.usable
    ? page => getAttachmentPreview(page, env)
    : undefined
  const defaultAttachmentData = remoteAccessContext.usable
    ? page => getAttachmentData(page, env)
    : undefined
  const defaultAttachmentPayloadDownload = remoteAccessContext.usable
    ? attachment => downloadAttachmentPayload(attachment, env)
    : undefined
  const defaultPagePayload = command === 'export' &&
    effectiveExportPagePayloadFormat(options) === 'md' &&
    remoteAccessContext.usable
    ? page => acquireMarkdownPagePayload(page, env)
    : undefined
  const commandDependencies = {
    ...dependencies,
    downloadAttachmentPayload: dependencies.downloadAttachmentPayload || defaultAttachmentPayloadDownload,
    encryptOutputRoot: dependencies.encryptOutputRoot || ((outputRoot, recipient) => encryptOutputRoot(outputRoot, recipient)),
    getAttachmentData: dependencies.getAttachmentData || defaultAttachmentData,
    findTitleCandidates: dependencies.findTitleCandidates || (discovery => findTitleCandidates(discovery, env)),
    getAttachmentPreview: dependencies.getAttachmentPreview || defaultAttachmentPreview,
    localizeMarkdownPayload: dependencies.localizeMarkdownPayload || localizeMarkdownPayload,
    markdownBaseUrl: dependencies.markdownBaseUrl || (remoteAccessContext.usable ? remoteAccessContext.baseUrl : undefined),
    getPagePayload: dependencies.getPagePayload || defaultPagePayload,
    getStorageContent: dependencies.getStorageContent || (page => getPageStorageContent(page, env)),
    lookupPageById: dependencies.lookupPageById || (pageId => checkRootPageAccess(pageId, env)),
    listChildPages: dependencies.listChildPages || (page => listChildPages(page, env))
  }
  const encryptionPreflight = evaluateEncryptionPreflight(options, dependencies)
  if (encryptionPreflight.state === 'rejected') {
    return {
      exitCode: 1,
      stdout: '',
      stderr: `${formatDiagnostic({
        type: 'validation-failed',
        requirementId: encryptionPreflight.requirementId
      })}\n`
    }
  }
  if (encryptionPreflight.state === 'ok') {
    commandDependencies.encryptionRecipient = encryptionPreflight.recipient
  }

  const pageId = options.values['--page-id']
  const accessCheck = commandDependencies.checkRootPageAccess || checkRootPageAccess
  const access = await accessCheck(pageId, env)

  if (access.state !== 'ok') {
    return {
      exitCode: 1,
      stdout: '',
      stderr: `${formatDiagnostic({
        type: 'validation-failed-page-id',
        requirementId: 'FR-0017',
        pageId
      })}\n`
    }
  }

  const outputRoot = selectOutputRoot(command, access.identity, options, dependencies)
  if (outputRoot.state === 'rejected') {
    return {
      exitCode: 1,
      stdout: '',
      stderr: `${formatDiagnostic({
        type: 'validation-failed',
        requirementId: outputRoot.requirementId
      })}\n`
    }
  }

  if (isResumeExport(command, options)) {
    const resumeState = await evaluateResumeCompatibility(outputRoot.outputRoot, access.identity, options)
    if (resumeState.state === 'rejected') {
      return {
        exitCode: 1,
        stdout: '',
        stderr: `${formatDiagnostic({
          type: 'validation-failed',
          requirementId: 'FR-0103'
        })}\n`
      }
    }
    commandDependencies.resumeState = resumeState
  }

  const preparedLog = preparePersistentLog(options, {
    ...commandDependencies,
    outputRoot: outputRoot.outputRoot
  })
  if (preparedLog.state === 'rejected') {
    return {
      exitCode: 1,
      stdout: '',
      stderr: `${formatDiagnostic({
        type: 'validation-failed',
        requirementId: preparedLog.requirementId
      })}\n`
    }
  }

  if (access.metadata === undefined && isBasicPlanOrExportOptions(command, options)) {
    return runRootMetadataFailure(command, access.identity, outputRoot.outputRoot, options, preparedLog, commandDependencies, rootDownloadedBytes(access))
  }

  if (isBasicPlan(command, options, access)) {
    return runBasicPlan(access.metadata, outputRoot.outputRoot, options, preparedLog, commandDependencies, rootDownloadedBytes(access))
  }

  if (isBasicExport(command, options, access)) {
    return runBasicExport(access.metadata, outputRoot.outputRoot, options, preparedLog, commandDependencies, rootDownloadedBytes(access))
  }

  return {
    exitCode: 4,
    stdout: '',
    stderr: `${formatDiagnostic({
      type: 'development-pending',
      command
    })}\n`
  }
}

async function runRootMetadataFailure (command, pageId, outputRoot, options, preparedLog, dependencies, initialDownloadedBytes) {
  try {
    const finalStatus = completedFinalStatus(options, true)
    const reportTexts = runReportTexts({
      command,
      pageId,
      outputRoot,
      outputPathProvenance: outputPathProvenance(options),
      pagePayloadFormat: command === 'export' ? effectiveExportPagePayloadFormat(options) : 'none',
      finalStatus,
      scopeTrust: 'degraded',
      interruptReason: 'none',
      downloadedMib: downloadedMibFields(initialDownloadedBytes),
      encryptionEnabled: isEncryptionRequested(options),
      encryptionSuccessful: false,
      failedPageRows: [
        rootMetadataFailedRow(pageId)
      ]
    })
    if (command === 'export') {
      await fs.mkdir(path.join(outputRoot, 'pages'), { recursive: true })
    }
    await writeRunReportSet(outputRoot, reportTexts)
    return finalizeRunResult(command, pageId, outputRoot, options, finalStatus, preparedLog, dependencies)
  } catch {
    return {
      exitCode: 4,
      stdout: '',
      stderr: `ERROR: runtime_failure ${command}_report\n`
    }
  }
}

async function runBasicExport (metadata, outputRoot, options, preparedLog, dependencies, initialDownloadedBytes) {
  try {
    const pageId = metadata.page_id
    const keepMetadata = options.flags.includes('--keep-metadata')
    const folder = keepMetadata
      ? pagePayloadFolder({ pageId, spaceKey: metadata.space_key })
      : 'none'
    const pagePayloadFormat = effectiveExportPagePayloadFormat(options)
    const cleanExport = await tryRunCleanPayloadExport(metadata, outputRoot, options, preparedLog, dependencies, pagePayloadFormat, initialDownloadedBytes)
    if (cleanExport !== null) {
      return cleanExport
    }
    const finalStatus = completedFinalStatus(options, true)
    const reportTexts = runReportTexts({
      command: 'export',
      pageId,
      outputRoot,
      outputPathProvenance: outputPathProvenance(options),
      pagePayloadFormat,
      finalStatus,
      scopeTrust: 'degraded',
      interruptReason: 'none',
      downloadedMib: downloadedMibFields(initialDownloadedBytes),
      encryptionEnabled: isEncryptionRequested(options),
      encryptionSuccessful: false,
      manifestRows: [
        {
          page_id: pageId,
          space_key: metadata.space_key || 'none',
          page_title: metadata.page_title,
          folder,
          discovery_source: 'root',
          run_mode: 'export',
          attachment_count: 'none'
        }
      ],
      scopeFindingRows: rootScopeFindingRows(pageId),
      failedPageRows: [
        {
          page_id: pageId,
          page_title: metadata.page_title,
          operation: 'page_payload',
          error_summary: 'page_payload_failed'
        }
      ]
    })
    if (keepMetadata) {
      await writePageMetadataArtifact(outputRoot, folder, metadata)
    } else {
      await fs.mkdir(path.join(outputRoot, 'pages'), { recursive: true })
    }
    await writeRunReportSet(outputRoot, reportTexts)
    return finalizeRunResult('export', pageId, outputRoot, options, finalStatus, preparedLog, dependencies)
  } catch {
    return {
      exitCode: 4,
      stdout: '',
      stderr: 'ERROR: runtime_failure export_report\n'
    }
  }
}

async function tryRunCleanPayloadExport (metadata, outputRoot, options, preparedLog, dependencies, pagePayloadFormat, initialDownloadedBytes) {
  const pageId = metadata.page_id
  const keepMetadata = options.flags.includes('--keep-metadata')
  const scope = await basicPlanScope(metadata, options, dependencies, 'export', initialDownloadedBytes)
  if (scope.configuredStopReason === 'none' && scope.payloadArtifacts.length !== scope.manifestRows.length) {
    return null
  }

  const maxDownloadBytes = maxDownloadBytesLimit(options)
  let configuredStopReason = scope.configuredStopReason
  const resumeState = dependencies.resumeState && dependencies.resumeState.state === 'ok'
    ? dependencies.resumeState
    : null
  const isResumeMode = resumeState !== null
  const pageFoldersByPageId = manifestFoldersByPageId(scope.manifestRows)
  const exportedPageFoldersByTargetKey = manifestFoldersByTargetKey(scope.manifestRows)
  const pageSpaceKeysByPageId = manifestSpaceKeysByPageId(scope.manifestRows)
  const attachmentCounts = new Map()
  const attachmentFailures = []
  let reusedPages = 0
  if (configuredStopReason !== 'max_download_limit_reached') {
    for (const artifact of scope.payloadArtifacts) {
      const payloadResult = await materializePagePayload(artifact, pagePayloadFormat, dependencies)
      if (payloadResult.state !== 'ok') {
        scope.failedPageRows.push(pagePayloadFailedRow(artifact.metadata))
        if (keepMetadata) {
          await writePageMetadataArtifact(outputRoot, artifact.folder, artifact.metadata, artifact.storage, artifact.attachmentPreview)
        }
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
        if (keepMetadata) {
          await writePageMetadataArtifact(outputRoot, artifact.folder, artifact.metadata, artifact.storage, artifact.attachmentPreview)
        }
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
      if (keepMetadata) {
        await writePageMetadataArtifact(outputRoot, artifact.folder, artifact.metadata, artifact.storage, artifact.attachmentPreview)
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
    encryptionEnabled: isEncryptionRequested(options),
    encryptionSuccessful: false,
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
  return finalizeRunResult('export', pageId, outputRoot, options, finalStatus, preparedLog, dependencies)
}

async function runBasicPlan (metadata, outputRoot, options, preparedLog, dependencies, initialDownloadedBytes) {
  try {
    const pageId = metadata.page_id
    const scope = await basicPlanScope(metadata, options, dependencies, 'plan', initialDownloadedBytes)
    const hasBlockingReasons = scope.scopeFindingRows.length > 0 || scope.unresolvedLinkRows.length > 0 || scope.failedPageRows.length > 0
    const finalStatus = scope.configuredStopReason === 'none' ? completedFinalStatus(options, hasBlockingReasons) : 'incomplete'
    const reportTexts = runReportTexts({
      command: 'plan',
      pageId,
      outputRoot,
      outputPathProvenance: outputPathProvenance(options),
      pagePayloadFormat: 'none',
      finalStatus,
      scopeTrust: finalStatus === 'incomplete' || hasBlockingReasons ? 'degraded' : 'trusted',
      interruptReason: scope.configuredStopReason,
      downloadedMib: downloadedMibFields(scope.downloadedBytes),
      encryptionEnabled: isEncryptionRequested(options),
      encryptionSuccessful: false,
      manifestRows: scope.manifestRows,
      resolvedLinkRows: scope.resolvedLinkRows,
      unresolvedLinkRows: scope.unresolvedLinkRows,
      scopeFindingRows: scope.scopeFindingRows,
      failedPageRows: scope.failedPageRows
    })
    for (const artifact of scope.metadataArtifacts) {
      await writePageMetadataArtifact(outputRoot, artifact.folder, artifact.metadata, artifact.storage, artifact.attachmentPreview)
    }
    if (finalStatus === 'incomplete') {
      await writeIncompleteMarker(outputRoot)
    }
    await writeRunReportSet(outputRoot, reportTexts)
    return finalizeRunResult('plan', pageId, outputRoot, options, finalStatus, preparedLog, dependencies)
  } catch {
    return {
      exitCode: 4,
      stdout: '',
      stderr: 'ERROR: runtime_failure plan_report\n'
    }
  }
}

async function finalizeRunResult (command, pageId, outputRoot, options, finalStatus, preparedLog, dependencies) {
  if (!shouldBeginEncryption(options, finalStatus)) {
    return successfulRunResult(command, pageId, outputRoot, options, finalStatus, preparedLog)
  }

  try {
    await rewriteSummaryFields(outputRoot, {
      encryption_enabled: '1',
      encryption_successful: '1'
    })
  } catch {
    return encryptedFinalizationFailure()
  }

  let encryption
  try {
    encryption = await dependencies.encryptOutputRoot(outputRoot, dependencies.encryptionRecipient)
  } catch {
    encryption = { state: 'failed' }
  }
  if (encryption !== null && typeof encryption === 'object' && encryption.state === 'ok' && typeof encryption.archivePath === 'string') {
    return successfulRunResult(command, pageId, outputRoot, options, finalStatus, preparedLog, {
      artifactPath: encryption.archivePath,
      includeEncryptionPhase: true
    })
  }

  if (isConfidentialRequested(options)) {
    return confidentialEncryptionFailureResult(command, pageId, outputRoot, options, preparedLog, encryption)
  }

  return retainedPlainRootEncryptionFailureResult(command, pageId, outputRoot, options, preparedLog)
}

async function confidentialEncryptionFailureResult (command, pageId, outputRoot, options, preparedLog, encryption) {
  if (encryption !== null && typeof encryption === 'object' && encryption.preservePlainRoot === true) {
    return retainedPlainRootEncryptionFailureResult(command, pageId, outputRoot, options, preparedLog)
  }

  try {
    await fs.rm(outputRoot, { recursive: true, force: true })
  } catch {
    return retainedPlainRootEncryptionFailureResult(command, pageId, outputRoot, options, preparedLog)
  }

  const statusSidecarPath = confidentialStatusSidecarPath(outputRoot)
  try {
    await fs.writeFile(statusSidecarPath, 'final_status=encryption_failed\n', {
      encoding: 'utf8',
      flag: 'wx'
    })
  } catch {
    return successfulRunResult(command, pageId, outputRoot, options, 'encryption_failed', preparedLog, {
      artifactValue: 'none',
      includeEncryptionPhase: true
    })
  }

  return successfulRunResult(command, pageId, outputRoot, options, 'encryption_failed', preparedLog, {
    artifactPath: statusSidecarPath,
    includeEncryptionPhase: true
  })
}

async function retainedPlainRootEncryptionFailureResult (command, pageId, outputRoot, options, preparedLog) {
  try {
    await rewriteSummaryFields(outputRoot, {
      final_status: 'encryption_failed',
      encryption_enabled: '1',
      encryption_successful: '0'
    })
  } catch {
    return encryptedFinalizationFailure()
  }

  return successfulRunResult(command, pageId, outputRoot, options, 'encryption_failed', preparedLog, {
    includeEncryptionPhase: true
  })
}

function confidentialStatusSidecarPath (outputRoot) {
  return `${outputRoot}.status.txt`
}

function successfulRunResult (command, pageId, outputRoot, options, finalStatus, preparedLog, resultOptions = {}) {
  const artifactPath = resultOptions.artifactPath || outputRoot
  const artifactValue = Object.prototype.hasOwnProperty.call(resultOptions, 'artifactValue')
    ? resultOptions.artifactValue
    : quotePathString(artifactPath)
  const lines = [
    `RUN_START command=${command} page_id=${pageId} output_root=${quotePathString(outputRoot)}`,
    'RUN_PHASE phase=scope_discovery',
    'RUN_PHASE phase=page_processing',
    'RUN_PHASE phase=report_generation'
  ]
  if (resultOptions.includeEncryptionPhase === true) {
    lines.push('RUN_PHASE phase=encryption')
  }
  lines.push(`RUN_COMPLETE final_status=${finalStatus} artifact=${artifactValue}`)
  const result = {
    exitCode: successfulRunExitCode(finalStatus),
    stdout: `${lines.join('\n')}\n`,
    stderr: warningText(options)
  }
  const logWrite = writePersistentLog(preparedLog, result.stdout)
  if (logWrite.state !== 'ok') {
    return {
      exitCode: 4,
      stdout: '',
      stderr: 'ERROR: runtime_failure persistent_log\n'
    }
  }
  return result
}

function encryptedFinalizationFailure () {
  return {
    exitCode: 4,
    stdout: '',
    stderr: 'ERROR: runtime_failure encrypted_finalization\n'
  }
}

async function rewriteSummaryFields (outputRoot, fields) {
  const summaryPath = path.join(outputRoot, 'summary.txt')
  const remaining = new Set(Object.keys(fields))
  const text = await fs.readFile(summaryPath, 'utf8')
  const rewritten = text.split('\n').map(line => {
    const separatorIndex = line.indexOf('=')
    if (separatorIndex === -1) {
      return line
    }
    const key = line.slice(0, separatorIndex)
    if (!remaining.has(key)) {
      return line
    }
    remaining.delete(key)
    return `${key}=${fields[key]}`
  }).join('\n')
  if (remaining.size > 0) {
    throw new Error('summary key missing')
  }
  await fs.writeFile(summaryPath, rewritten, 'utf8')
}

function shouldBeginEncryption (options, finalStatus) {
  return isEncryptionRequested(options) &&
    (finalStatus === 'success' || finalStatus === 'success_with_findings' || finalStatus === 'policy_failed')
}

function successfulRunExitCode (finalStatus) {
  if (finalStatus === 'policy_failed') {
    return 2
  }
  if (finalStatus === 'incomplete') {
    return 3
  }
  if (finalStatus === 'encryption_failed') {
    return 5
  }
  return 0
}

function isBasicExport (command, options, access) {
  return access.metadata !== undefined && isBasicExportOptions(command, options)
}

function isBasicExportOptions (command, options) {
  const allowedValues = ['--page-id', '--out', '--page-format', '--log-file', '--encryption-key', '--sleep-ms', MAX_FIND_CANDIDATES_OPTION, LINK_DEPTH_OPTION]
  return command === 'export' &&
    hasOnlyFlags(options, ['--safe', '--keep-metadata', '--critical', '--no-fail-fast', '--encrypt', '--confidential', '--resume']) &&
    Object.keys(options.values).every(token => allowedValues.includes(token) || BOUNDED_VALUE_OPTIONS.includes(token))
}

function isBasicPlan (command, options, access) {
  return access.metadata !== undefined && isBasicPlanOptions(command, options)
}

function isBasicPlanOptions (command, options) {
  const allowedValues = ['--page-id', '--out', '--log-file', '--encryption-key', '--sleep-ms', MAX_FIND_CANDIDATES_OPTION, LINK_DEPTH_OPTION]
  return command === 'plan' &&
    hasOnlyFlags(options, ['--keep-metadata', '--safe', '--critical', '--no-fail-fast', '--encrypt', '--confidential']) &&
    Object.keys(options.values).every(token => allowedValues.includes(token) || BOUNDED_VALUE_OPTIONS.includes(token))
}

function isBasicPlanOrExportOptions (command, options) {
  return isBasicPlanOptions(command, options) || isBasicExportOptions(command, options)
}

function hasOnlyFlags (options, allowedFlags) {
  return options.flags.every(flag => allowedFlags.includes(flag))
}

function isResumeExport (command, options) {
  return command === 'export' && options.flags.includes('--resume')
}

async function evaluateResumeCompatibility (outputRoot, pageId, options) {
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

function parseSummaryText (text) {
  const values = new Map()
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

function resumeSummaryMatches (summary, outputRoot, pageId, options) {
  const decodedOutputRoot = jsonStringValue(summary.get('output_root'))
  return summary.get('command') === 'export' &&
    summary.get('support_profile') === 'default' &&
    summary.get('page_id') === pageId &&
    decodedOutputRoot === outputRoot &&
    summary.get('output_path_provenance') === 'explicit' &&
    summary.get('page_payload_format') === effectiveExportPagePayloadFormat(options) &&
    (summary.get('final_status') === 'incomplete' || summary.get('final_status') === 'interrupted') &&
    summary.get('resume_mode') === '0' &&
    summary.get('resume_schema_version') === '2' &&
    summary.get('encryption_enabled') === '0' &&
    summary.get('encryption_successful') === '0'
}

function jsonStringValue (value) {
  if (typeof value !== 'string') {
    return null
  }
  try {
    const parsed = JSON.parse(value)
    return typeof parsed === 'string' ? parsed : null
  } catch {
    return null
  }
}

function parseResumeManifest (text) {
  const lines = text.split('\n')
  if (lines[0] !== MANIFEST_HEADER) {
    return null
  }
  const priorFolders = new Map()
  for (const line of lines.slice(1)) {
    if (line === '') {
      continue
    }
    const fields = line.split('\t')
    if (fields.length !== 7) {
      return null
    }
    const [pageId, spaceKey, , folder] = fields
    if (folder === 'none') {
      continue
    }
    const expectedFolder = pagePayloadFolder({
      pageId,
      spaceKey: spaceKey === 'none' ? undefined : spaceKey
    })
    if (folder !== expectedFolder) {
      return null
    }
    priorFolders.set(pageId, folder)
  }
  return priorFolders
}

async function pathExists (targetPath) {
  try {
    await fs.lstat(targetPath)
    return true
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return false
    }
    throw error
  }
}

async function pathIsFile (targetPath) {
  try {
    const stat = await fs.lstat(targetPath)
    return stat.isFile()
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return false
    }
    throw error
  }
}

function rejectedResume () {
  return {
    state: 'rejected'
  }
}

function warningText (options) {
  return [
    unboundedRunWarning(options),
    confidentialLogWarning(options)
  ].join('')
}

function unboundedRunWarning (options) {
  return hasSafeProfile(options) || hasPositiveBoundedValue(options)
    ? ''
    : UNBOUNDED_RUN_WARNING
}

function confidentialLogWarning (options) {
  return isConfidentialRequested(options) && Object.prototype.hasOwnProperty.call(options.values, '--log-file')
    ? CONFIDENTIAL_LOG_WARNING
    : ''
}

function isEncryptionRequested (options) {
  return options.flags.includes('--encrypt') || options.flags.includes('--confidential')
}

function isConfidentialRequested (options) {
  return options.flags.includes('--confidential')
}

function hasSafeProfile (options) {
  return options.flags.includes('--safe') || options.flags.includes('--critical') || isConfidentialRequested(options)
}

function completedFinalStatus (options, hasBlockingReasons) {
  if (!hasBlockingReasons) {
    return 'success'
  }
  return options.flags.includes('--critical') || isConfidentialRequested(options) ? 'policy_failed' : 'success_with_findings'
}

function hasPositiveBoundedValue (options) {
  return BOUNDED_VALUE_OPTIONS.some(token => isPositiveInteger(options.values[token]))
}

function isPositiveInteger (value) {
  return /^(?:[1-9][0-9]*)$/.test(value || '')
}

function isNonNegativeInteger (value) {
  return /^(?:0|[1-9][0-9]*)$/.test(value || '')
}

function outputPathProvenance (options) {
  return Object.prototype.hasOwnProperty.call(options.values, '--out') ? 'explicit' : 'generated'
}

function effectiveExportPagePayloadFormat (options) {
  return options.values['--page-format'] || 'md'
}

function rootDownloadedBytes (access) {
  return {
    content: 0,
    metadata: metadataBytesFromResult(access) || 0
  }
}

function downloadedByteState (value) {
  return {
    content: Number.isSafeInteger(value?.content) && value.content >= 0 ? value.content : 0,
    metadata: Number.isSafeInteger(value?.metadata) && value.metadata >= 0 ? value.metadata : 0
  }
}

function hasAnyDownloadedBytes (downloadedBytes) {
  return downloadedBytes.content > 0 || downloadedBytes.metadata > 0
}

function pageSleepState (options, dependencies) {
  return {
    hasProcessedPage: false,
    sleepMs: effectiveSleepMs(options),
    sleep: typeof dependencies.sleepMs === 'function' ? dependencies.sleepMs : defaultSleepMs
  }
}

async function sleepBeforePageProcessing (sleepState) {
  if (sleepState.hasProcessedPage !== true) {
    sleepState.hasProcessedPage = true
    return
  }
  if (sleepState.sleepMs === 0) {
    return
  }
  await sleepState.sleep(sleepState.sleepMs)
}

function effectiveSleepMs (options) {
  if (Object.prototype.hasOwnProperty.call(options.values, '--sleep-ms')) {
    return Number(options.values['--sleep-ms'])
  }
  return hasSafeProfile(options)
    ? SAFE_PROFILE_SLEEP_MS
    : 0
}

function defaultSleepMs (milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

async function basicPlanScope (rootMetadata, options, dependencies, runMode = 'plan', initialDownloadedBytes) {
  const keepMetadata = options.flags.includes('--keep-metadata')
  const maxPages = maxPagesLimit(options)
  const maxDownloadBytes = maxDownloadBytesLimit(options)
  const linkDepth = effectiveLinkDepth(options)
  const sleepState = pageSleepState(options, dependencies)
  const downloadedBytes = downloadedByteState(initialDownloadedBytes)
  let downloadLimitReached = hasReachedDownloadLimit(downloadedBytes, maxDownloadBytes)
  const pages = [
    {
      metadata: rootMetadata,
      discoverySource: 'root',
      linkDepth: 0
    }
  ]
  const seenPageIds = new Set([rootMetadata.page_id])
  const resolvedLinkRows = []
  const unresolvedLinkRows = []
  const scopeFindingRows = []
  const storageByPageId = new Map()
  const byteOperationPages = hasAnyDownloadedBytes(downloadedBytes) ? [pages[0]] : []
  const listChildPages = dependencies.listChildPages

  if (typeof listChildPages !== 'function') {
    scopeFindingRows.push(childListingIncompleteRow(rootMetadata.page_id))
  } else {
    for (let index = 0; index < pages.length; index += 1) {
      if (downloadLimitReached || (maxPages !== null && index >= maxPages)) {
        break
      }
      const source = pages[index].metadata
      const listing = await safeListChildPages(listChildPages, source)
      if (listing.state !== 'ok') {
        scopeFindingRows.push(childListingIncompleteRow(source.page_id))
        continue
      }
      if (Number.isSafeInteger(listing.metadataBytes) && listing.metadataBytes >= 0) {
        byteOperationPages.push(pages[index])
        addMetadataDownloadBytes(downloadedBytes, listing.metadataBytes, '')
        if (hasReachedDownloadLimit(downloadedBytes, maxDownloadBytes)) {
          downloadLimitReached = true
        }
      }
      if (listing.complete !== true) {
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

  if (!downloadLimitReached) {
    for (let index = 0; index < pages.length; index += 1) {
      if (downloadLimitReached || (maxPages !== null && index >= maxPages)) {
        break
      }
      const page = pages[index]
      await sleepBeforePageProcessing(sleepState)
      const storageResult = await inspectStorageContent(page.metadata, dependencies)
      byteOperationPages.push(page)
      if (typeof storageResult.storage === 'string') {
        storageByPageId.set(page.metadata.page_id, storageResult.storage)
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
          if (resolution.finding === true) {
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
  const attachmentPreviews = await acquireAttachmentPreviews(attachmentPreviewPages, options, dependencies, runMode, {
    downloadedBytes,
    maxDownloadBytes
  })
  downloadLimitReached = downloadLimitReached || attachmentPreviews.downloadLimitReached
  const configuredStopReason = maxPagesStopReason !== 'none'
    ? maxPagesStopReason
    : downloadLimitReached ? 'max_download_limit_reached' : 'none'

  return {
    configuredStopReason,
    downloadedBytes,
    manifestRows: manifestPages.map(page => planManifestRow(
      page.metadata,
      page.discoverySource,
      keepMetadata,
      runMode,
      attachmentPreviews.countByPageId.get(page.metadata.page_id) || 'none'
    )),
    resolvedLinkRows,
    unresolvedLinkRows,
    scopeFindingRows,
    failedPageRows: attachmentPreviews.failedPageRows,
    payloadArtifacts: manifestPages
      .map(page => ({
        metadata: page.metadata,
        folder: pagePayloadFolder({ pageId: page.metadata.page_id, spaceKey: page.metadata.space_key }),
        storage: storageByPageId.get(page.metadata.page_id),
        attachmentPreview: attachmentPreviews.previewByPageId.get(page.metadata.page_id)
      }))
      .filter(artifact => typeof artifact.storage === 'string'),
    metadataArtifacts: keepMetadata
      ? manifestPages.map(page => ({
        metadata: page.metadata,
        folder: pagePayloadFolder({ pageId: page.metadata.page_id, spaceKey: page.metadata.space_key }),
        storage: storageByPageId.get(page.metadata.page_id),
        attachmentPreview: attachmentPreviews.previewByPageId.get(page.metadata.page_id)
      }))
      : []
  }
}

function maxPagesLimit (options) {
  const value = options.values['--max-pages']
  if (isPositiveInteger(value)) {
    const parsed = Number(value)
    return Number.isSafeInteger(parsed) ? parsed : null
  }
  return hasSafeProfile(options) ? SAFE_PROFILE_MAX_PAGES : null
}

function maxDownloadBytesLimit (options) {
  const value = options.values['--max-download-mib']
  if (isPositiveInteger(value)) {
    const parsed = Number(value)
    const bytes = parsed * MIB_BYTES
    return Number.isSafeInteger(bytes) ? bytes : null
  }
  return hasSafeProfile(options) ? SAFE_PROFILE_MAX_DOWNLOAD_MIB * MIB_BYTES : null
}

function effectiveLinkDepth (options) {
  const value = options.values[LINK_DEPTH_OPTION]
  if (isNonNegativeInteger(value)) {
    const parsed = Number(value)
    return Number.isSafeInteger(parsed) ? parsed : 1
  }
  return 1
}

function processedPageSlice (pages, maxPages) {
  return maxPages === null ? pages.slice() : pages.slice(0, maxPages)
}

function addMetadataDownloadBytes (downloadedBytes, metadataBytes, fallbackText) {
  downloadedBytes.metadata += metadataByteCount(metadataBytes, fallbackText)
}

function addMetadataResultDownloadBytes (downloadedBytes, result, maxDownloadBytes) {
  const metadataBytes = metadataBytesFromResult(result)
  if (metadataBytes === undefined) {
    return false
  }
  addMetadataDownloadBytes(downloadedBytes, metadataBytes, '')
  return hasReachedDownloadLimit(downloadedBytes, maxDownloadBytes)
}

function addContentDownloadBytes (downloadedBytes, text) {
  downloadedBytes.content += Buffer.byteLength(text, 'utf8')
}

function addBufferContentDownloadBytes (downloadedBytes, bytes) {
  downloadedBytes.content += bytes.length
}

function hasReachedDownloadLimit (downloadedBytes, maxDownloadBytes) {
  return maxDownloadBytes !== null && totalDownloadedBytes(downloadedBytes) >= maxDownloadBytes
}

function totalDownloadedBytes (downloadedBytes) {
  return downloadedBytes.content + downloadedBytes.metadata
}

function downloadedMibFields (downloadedBytes = { content: 0, metadata: 0 }) {
  return {
    total: formatMib(totalDownloadedBytes(downloadedBytes)),
    content: formatMib(downloadedBytes.content),
    metadata: formatMib(downloadedBytes.metadata)
  }
}

function formatMib (bytes) {
  const thousandths = Math.floor((bytes * 1000 + MIB_BYTES / 2) / MIB_BYTES)
  const whole = Math.floor(thousandths / 1000)
  const fractional = String(thousandths % 1000).padStart(3, '0')
  return `${whole}.${fractional}`
}

function uniquePagesById (pages) {
  const seenPageIds = new Set()
  const uniquePages = []
  for (const page of pages) {
    if (seenPageIds.has(page.metadata.page_id)) {
      continue
    }
    seenPageIds.add(page.metadata.page_id)
    uniquePages.push(page)
  }
  return uniquePages
}

function manifestRowsWithAttachmentCounts (manifestRows, attachmentCounts) {
  if (attachmentCounts.size === 0) {
    return manifestRows
  }
  return manifestRows.map(row => attachmentCounts.has(row.page_id)
    ? {
        ...row,
        attachment_count: String(attachmentCounts.get(row.page_id))
      }
    : row)
}

async function materializePagePayload (artifact, pagePayloadFormat, dependencies) {
  if (pagePayloadFormat === 'html') {
    return {
      state: 'ok',
      payload: artifact.storage,
      diagnostics: []
    }
  }

  const getPagePayload = dependencies.getPagePayload
  if (typeof getPagePayload !== 'function') {
    return { state: 'failed' }
  }

  try {
    const result = await getPagePayload(artifact.metadata)
    if (result === null || typeof result !== 'object' || result.state !== 'ok' || typeof result.payload !== 'string') {
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

async function localizedPagePayload (input) {
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
    const result = await input.dependencies.localizeMarkdownPayload({
      payload: input.payload,
      sourcePageId: input.artifact.metadata.page_id,
      sourceSpaceKey: input.pageSpaceKeysByPageId.get(input.artifact.metadata.page_id),
      sourceFolder: input.artifact.folder,
      baseUrl: input.dependencies.markdownBaseUrl,
      resolvedLinkRows: input.resolvedLinkRows,
      unresolvedLinkRows: input.unresolvedLinkRows,
      pageFoldersByPageId: input.pageFoldersByPageId,
      exportedPageFoldersByTargetKey: input.exportedPageFoldersByTargetKey
    })
    if (result === null || typeof result !== 'object' || typeof result.payload !== 'string') {
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

async function canReusePriorPayload (outputRoot, artifact, pagePayloadFormat, resumeState, payload) {
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

async function pathSegmentsAreDirectories (outputRoot, relativeFolder) {
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

function manifestFoldersByPageId (manifestRows) {
  const folders = new Map()
  for (const row of manifestRows) {
    if (row !== null && typeof row === 'object' && typeof row.page_id === 'string' && typeof row.folder === 'string' && row.folder !== 'none') {
      folders.set(row.page_id, row.folder)
    }
  }
  return folders
}

function manifestSpaceKeysByPageId (manifestRows) {
  const spaceKeys = new Map()
  for (const row of manifestRows) {
    if (row !== null && typeof row === 'object' && typeof row.page_id === 'string' && typeof row.space_key === 'string' && row.space_key !== 'none') {
      spaceKeys.set(row.page_id, row.space_key)
    }
  }
  return spaceKeys
}

function manifestFoldersByTargetKey (manifestRows) {
  const folders = new Map()
  for (const row of manifestRows) {
    if (row === null || typeof row !== 'object') {
      continue
    }
    if (typeof row.page_id !== 'string' || row.page_id === '' || typeof row.folder !== 'string' || row.folder === 'none' || row.folder === '') {
      continue
    }
    folders.set(`page_id:${row.page_id}`, row.folder)
    if (typeof row.space_key === 'string' && row.space_key !== 'none' && row.space_key !== '' && typeof row.page_title === 'string' && row.page_title !== '') {
      folders.set(titleTargetKeyWithSpaceKey(row.space_key, row.page_title), row.folder)
    }
  }
  return folders
}

function titleTargetKeyWithSpaceKey (spaceKey, title) {
  return [
    'space_key_present=1',
    `space_key_bytes=${Buffer.byteLength(spaceKey, 'utf8')}`,
    `space_key=${spaceKey}`,
    `title_bytes=${Buffer.byteLength(title, 'utf8')}`,
    `title=${title}`
  ].join(';')
}

async function payloadFolderEntriesAreReusable (folderPath, pagePayloadFormat) {
  const payloadName = pagePayloadFilename(pagePayloadFormat)
  const otherPayloadName = pagePayloadFormat === 'md' ? 'page.html' : 'page.md'
  const allowedNames = new Set([payloadName, 'attachments', '_info.txt', '_storage.xml'])
  const entries = await fs.readdir(folderPath, { withFileTypes: true })
  let hasPayload = false

  for (const entry of entries) {
    if (!allowedNames.has(entry.name) || entry.name === otherPayloadName) {
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
    if ((entry.name === '_info.txt' || entry.name === '_storage.xml') && !entry.isFile()) {
      return false
    }
  }

  return hasPayload
}

function metadataByteCount (metadataBytes, fallbackText) {
  if (Number.isSafeInteger(metadataBytes) && metadataBytes >= 0) {
    return metadataBytes
  }
  return Buffer.byteLength(fallbackText, 'utf8')
}

async function acquireAttachmentPreviews (pages, options, dependencies, runMode, downloadAccounting = {}) {
  const countByPageId = new Map()
  const previewByPageId = new Map()
  const failedPageRows = []
  let downloadLimitReached = false
  const getAttachmentPreview = dependencies.getAttachmentPreview
  if (runMode !== 'plan' || typeof getAttachmentPreview !== 'function') {
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
    countByPageId.set(page.metadata.page_id, result.count)
    if (typeof result.preview === 'string') {
      previewByPageId.set(page.metadata.page_id, result.preview)
      addMetadataDownloadBytes(downloadAccounting.downloadedBytes, result.metadataBytes, result.preview)
      if (hasReachedDownloadLimit(downloadAccounting.downloadedBytes, downloadAccounting.maxDownloadBytes)) {
        downloadLimitReached = true
        break
      }
    }
  }

  return { countByPageId, previewByPageId, failedPageRows, downloadLimitReached }
}

async function materializeExportAttachments (outputRoot, artifact, dependencies, downloadedBytes, maxDownloadBytes) {
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

  const payloads = []
  let downloadLimitReached = false
  for (const item of orderedAttachmentItems(attachmentData.items)) {
    const payload = await safeDownloadAttachmentPayload(dependencies.downloadAttachmentPayload, item)
    if (payload.state !== 'ok') {
      return { count: attachmentData.items.length, failed: true, downloadLimitReached: false }
    }
    addBufferContentDownloadBytes(downloadedBytes, payload.bytes)
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

async function safeGetAttachmentData (getAttachmentData, page) {
  if (typeof getAttachmentData !== 'function') {
    return { state: 'skipped' }
  }
  try {
    const result = await getAttachmentData(page)
    if (result === null || typeof result !== 'object' || result.state !== 'ok' || !Array.isArray(result.items)) {
      return { state: 'failed' }
    }
    const items = []
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

function attachmentItemFilename (item) {
  if (item !== null && typeof item === 'object') {
    if (typeof item.filename === 'string') {
      return item.filename
    }
    if (typeof item.sourceFilename === 'string') {
      return item.sourceFilename
    }
  }
  return null
}

function hasValidAttachmentFilenames (items) {
  const seen = new Set()
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

function isValidAttachmentFilename (filename) {
  if (typeof filename !== 'string' || filename === '.' || filename === '..' || filename.endsWith('.')) {
    return false
  }
  const bytes = Buffer.byteLength(filename, 'utf8')
  if (bytes < 1 || bytes > 255 || !/^[A-Za-z0-9._-]+$/.test(filename)) {
    return false
  }
  return !WINDOWS_RESERVED_BASENAMES.has(filename.split('.')[0].toUpperCase())
}

const WINDOWS_RESERVED_BASENAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
])

function orderedAttachmentItems (items) {
  return items.slice().sort((left, right) => Buffer.compare(Buffer.from(left.filename, 'utf8'), Buffer.from(right.filename, 'utf8')))
}

async function safeDownloadAttachmentPayload (downloadAttachmentPayload, item) {
  try {
    const result = await downloadAttachmentPayload(item)
    if (result === null || typeof result !== 'object' || result.state !== 'ok') {
      return { state: 'failed' }
    }
    const bytes = attachmentPayloadBytes(result.bytes)
    return bytes === null ? { state: 'failed' } : { state: 'ok', bytes }
  } catch {
    return { state: 'failed' }
  }
}

function attachmentPayloadBytes (bytes) {
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

async function safeGetAttachmentPreview (getAttachmentPreview, page) {
  try {
    const result = await getAttachmentPreview(page)
    if (result === null || typeof result !== 'object' || result.state !== 'ok') {
      return { state: 'failed' }
    }
    const count = normalizeAttachmentCount(result.count)
    if (count === null) {
      return { state: 'failed' }
    }
    return {
      state: 'ok',
      count,
      preview: typeof result.preview === 'string' ? result.preview : undefined,
      metadataBytes: metadataBytesFromResult(result)
    }
  } catch {
    return { state: 'failed' }
  }
}

function normalizeAttachmentCount (value) {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value >= 0 ? String(value) : null
  }
  if (typeof value === 'string' && /^(?:0|[1-9][0-9]*)$/.test(value)) {
    return value
  }
  return null
}

async function safeListChildPages (listChildPages, source) {
  try {
    const listing = await listChildPages(source)
    if (listing === null || typeof listing !== 'object' || !Array.isArray(listing.children)) {
      return { state: 'failed' }
    }
    return {
      state: listing.state === 'ok' ? 'ok' : 'failed',
      complete: listing.complete === true,
      children: listing.children,
      metadataBytes: metadataBytesFromResult(listing)
    }
  } catch {
    return { state: 'failed' }
  }
}

function planManifestRow (metadata, discoverySource, keepMetadata, runMode = 'plan', attachmentCount = 'none') {
  return {
    page_id: metadata.page_id,
    space_key: metadata.space_key || 'none',
    page_title: metadata.page_title,
    folder: keepMetadata || runMode === 'export'
      ? pagePayloadFolder({ pageId: metadata.page_id, spaceKey: metadata.space_key })
      : 'none',
    discovery_source: discoverySource,
    run_mode: runMode,
    attachment_count: attachmentCount
  }
}

function childResultLinkRow (source, child) {
  return {
    source_page_id: source.page_id,
    source_title: source.page_title,
    link_kind: 'child_result',
    raw_link_value: `page_id:${child.page_id}`,
    target_page_id: child.page_id,
    target_space_key: child.space_key || 'none',
    target_title: child.page_title
  }
}

function pageIdLinkRow (source, target, discovery) {
  return {
    source_page_id: source.page_id,
    source_title: source.page_title,
    link_kind: discovery.linkKind,
    raw_link_value: `page_id:${discovery.pageId}`,
    target_page_id: target.page_id,
    target_space_key: target.space_key || 'none',
    target_title: target.page_title
  }
}

function unresolvedPageIdLinkRow (source, discovery) {
  return {
    source_page_id: source.page_id,
    source_title: source.page_title,
    link_kind: discovery.linkKind,
    raw_link_value: `page_id:${discovery.pageId}`,
    resolution_reason: 'insufficient_data'
  }
}

function titleLinkRow (source, target, discovery) {
  return {
    source_page_id: source.page_id,
    source_title: source.page_title,
    link_kind: discovery.linkKind,
    raw_link_value: titleRawLinkValue(discovery),
    target_page_id: target.page_id,
    target_space_key: target.space_key || 'none',
    target_title: target.page_title
  }
}

function unresolvedTitleLinkRow (source, discovery, reason) {
  return {
    source_page_id: source.page_id,
    source_title: source.page_title,
    link_kind: discovery.linkKind,
    raw_link_value: titleRawLinkValue(discovery),
    resolution_reason: reason
  }
}

function titleRawLinkValue (discovery) {
  const spaceKeyPresent = typeof discovery.spaceKey === 'string'
  const spaceKey = spaceKeyPresent ? discovery.spaceKey : ''
  return [
    `space_key_present=${spaceKeyPresent ? '1' : '0'}`,
    `space_key_bytes=${Buffer.byteLength(spaceKey, 'utf8')}`,
    `space_key=${spaceKey}`,
    `title_bytes=${Buffer.byteLength(discovery.title, 'utf8')}`,
    `title=${discovery.title}`
  ].join(';')
}

function isUsablePageMetadata (metadata) {
  return metadata !== null &&
    typeof metadata === 'object' &&
    /^(0|[1-9][0-9]*)$/.test(metadata.page_id || '') &&
    typeof metadata.page_title === 'string' &&
    metadata.page_title !== '' &&
    (metadata.space_key === undefined || typeof metadata.space_key === 'string')
}

async function inspectStorageContent (metadata, dependencies) {
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
    if (result === null || typeof result !== 'object' || result.state !== 'ok' || typeof result.storage !== 'string') {
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

function metadataBytesFromResult (result) {
  if (result === null || typeof result !== 'object') {
    return undefined
  }
  return Number.isSafeInteger(result.metadataBytes) && result.metadataBytes >= 0
    ? result.metadataBytes
    : undefined
}

async function resolvePageId (pageId, dependencies) {
  if (typeof dependencies.lookupPageById !== 'function') {
    return { state: 'failed' }
  }

  try {
    const result = await dependencies.lookupPageById(pageId)
    if (result === null || typeof result !== 'object' || result.state !== 'ok' || !isUsablePageMetadata(result.metadata)) {
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

async function resolveTitleLink (discovery, dependencies, options) {
  if (typeof dependencies.findTitleCandidates !== 'function') {
    return { state: 'unresolved', reason: 'insufficient_data', finding: true }
  }

  try {
    const result = await dependencies.findTitleCandidates(discovery)
    const metadataBytes = metadataBytesFromResult(result)
    if (result === null || typeof result !== 'object' || result.state !== 'ok' || result.complete !== true || !Array.isArray(result.candidates)) {
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
    return {
      state: 'ok',
      metadata: compatible[0],
      metadataBytes
    }
  } catch {
    return { state: 'unresolved', reason: 'insufficient_data', finding: true }
  }
}

function effectiveCandidateLimit (options) {
  const explicitLimit = options.values[MAX_FIND_CANDIDATES_OPTION]
  if (isPositiveInteger(explicitLimit)) {
    return Number(explicitLimit)
  }
  return hasSafeProfile(options) ? SAFE_PROFILE_MAX_FIND_CANDIDATES : null
}

function uniqueCompatibleTitleCandidates (discovery, candidates) {
  const byPageId = new Map()
  for (const candidate of candidates) {
    if (!isCompatibleTitleCandidate(discovery, candidate) || byPageId.has(candidate.page_id)) {
      continue
    }
    byPageId.set(candidate.page_id, candidate)
  }
  return Array.from(byPageId.values())
}

function isCompatibleTitleCandidate (discovery, candidate) {
  return isUsablePageMetadata(candidate) &&
    candidate.page_title === discovery.title &&
    (typeof discovery.spaceKey !== 'string' || candidate.space_key === discovery.spaceKey)
}

function pageIdDiscoveries (storage) {
  const pageIdLinks = []
  const titleLinks = []
  const contentIdPattern = /<ri:(?:content-entity|page)\b[^>]*\bri:content-id="(0|[1-9][0-9]*)"[^>]*>/g
  const withoutContentIds = storage.replace(contentIdPattern, (_match, contentId) => {
    pageIdLinks.push({ linkKind: 'content_id', pageId: contentId })
    return ''
  })
  const pageRefPattern = /<ri:page\b[^>]*(?:\/>|><\/ri:page>)/g
  const withoutPageRefs = withoutContentIds.replace(pageRefPattern, match => {
    const discovery = pageRefDiscovery(match)
    if (discovery === null) {
      return match
    }
    titleLinks.push(discovery)
    return ''
  })
  const macroParamPattern = /<ac:parameter\b[^>]*\bac:name="page"[^>]*>([\s\S]*?)<\/ac:parameter>/g
  const withoutMacroParams = withoutPageRefs.replace(macroParamPattern, (match, rawText) => {
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
  const withoutRiUrlPageIds = withoutAttachmentRefs.replace(riUrlPattern, match => {
    const valueMatch = /\bri:value="([^"]*)"/.exec(match)
    const value = valueMatch === null ? null : decodeXmlAttribute(valueMatch[1])
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
  const withoutHrefPageIds = withoutRiUrlPageIds.replace(hrefPattern, (match, rawHref) => {
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

function uniquePageIdLinks (links) {
  const seen = new Set()
  const unique = []
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

function uniqueTitleLinks (links) {
  const seen = new Set()
  const unique = []
  for (const link of links) {
    const key = `${link.linkKind}\t${link.spaceKey || ''}\t${link.title}`
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    unique.push(link)
  }
  return unique
}

function unsupportedPatternDiscoveries (storage) {
  const patterns = []
  const withoutPatterns = storage.replace(/\b[A-Za-z_:][A-Za-z0-9_:.-]*="([^"]*)"/g, (match, rawValue) => {
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

function unsupportedPatternValue (value) {
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

function stripIgnoredLiteralTextContexts (storage) {
  const withoutPlainTextBody = storage.replace(/<ac:plain-text-body\b([^>]*)>[\s\S]*?<\/ac:plain-text-body>/g, '<ac:plain-text-body$1></ac:plain-text-body>')
  const withoutPreText = withoutPlainTextBody.replace(/<pre\b([^>]*)>[\s\S]*?<\/pre>/g, '<pre$1></pre>')
  const withoutCodeText = withoutPreText.replace(/<code\b([^>]*)>[\s\S]*?<\/code>/g, '<code$1></code>')
  return withoutCodeText.replace(/<ac:parameter\b([^>]*)>[\s\S]*?<\/ac:parameter>/g, (match, attrs) => {
    return /\bac:name="page"/.test(attrs) ? match : `<ac:parameter${attrs}></ac:parameter>`
  })
}

function pageRefDiscovery (markup) {
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

function macroParamDiscovery (rawText) {
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

function decodedXmlAttribute (markup, name) {
  const pattern = new RegExp(`\\b${name}="([^"]*)"`)
  const match = pattern.exec(markup)
  return match === null ? null : decodeXmlAttribute(match[1])
}

function decodeXmlAttribute (value) {
  try {
    return value.replace(/&(#x[0-9A-Fa-f]+|#[0-9]+|amp|lt|gt|quot|apos|mdash);/g, (_match, entity) => {
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

function hasUnparsedLinkMarkers (storage) {
  return storage.includes('<ri:') ||
    storage.includes(' ri:') ||
    /<ac:parameter\b[^>]*\bac:name="page"[^>]*>/.test(storage) ||
    storage.includes(' href=') ||
    storage.includes('/pages/') ||
    storage.includes('/display/') ||
    storage.includes('pageId=') ||
    storage.includes('title=')
}

function rootScopeFindingRows (pageId) {
  return [
    childListingIncompleteRow(pageId),
    storageUnavailableRow(pageId)
  ]
}

function childListingIncompleteRow (pageId) {
  return {
    page_id: pageId,
    finding_area: 'child_listing',
    finding_type: 'incomplete_tree',
    detail: 'child_listing_incomplete'
  }
}

function childListingPartialRow (pageId) {
  return {
    page_id: pageId,
    finding_area: 'child_listing',
    finding_type: 'partial_listing',
    detail: 'child_listing_partial'
  }
}

function storageUnavailableRow (pageId) {
  return {
    page_id: pageId,
    finding_area: 'storage_content',
    finding_type: 'storage_unavailable',
    detail: 'storage_content_unavailable'
  }
}

function storageUninterpretableRow (pageId) {
  return {
    page_id: pageId,
    finding_area: 'storage_content',
    finding_type: 'storage_uninterpretable',
    detail: 'storage_content_uninterpretable'
  }
}

function titleResolutionIncompleteRow (pageId) {
  return {
    page_id: pageId,
    finding_area: 'title_resolution',
    finding_type: 'candidate_visibility_incomplete',
    detail: 'candidate_visibility_incomplete'
  }
}

function unsupportedPatternRow (pageId, detail) {
  return {
    page_id: pageId,
    finding_area: 'unsupported_pattern',
    finding_type: 'unsupported_internal_pattern',
    detail
  }
}

function pagePayloadMarkdownRemnantRow (pageId, diagnostic) {
  return {
    page_id: pageId,
    finding_area: 'page_payload',
    finding_type: 'markdown_remnant',
    detail: String(diagnostic.detail)
  }
}

function pagePayloadFailedRow (metadata) {
  return {
    page_id: metadata.page_id,
    page_title: metadata.page_title,
    operation: 'page_payload',
    error_summary: 'page_payload_failed'
  }
}

function attachmentPreviewFailedRow (metadata) {
  return {
    page_id: metadata.page_id,
    page_title: metadata.page_title,
    operation: 'attachment_preview',
    error_summary: 'attachment_preview_failed'
  }
}

function attachmentDownloadFailedRow (metadata) {
  return {
    page_id: metadata.page_id,
    page_title: metadata.page_title,
    operation: 'attachment_download',
    error_summary: 'attachment_download_failed'
  }
}

function rootMetadataFailedRow (pageId) {
  return {
    page_id: pageId,
    page_title: 'none',
    operation: 'page_metadata',
    error_summary: 'page_metadata_failed'
  }
}

async function writePageMetadataArtifact (outputRoot, folder, metadata, storage, attachmentPreview) {
  const folderPath = path.join(outputRoot, ...folder.split('/'))
  await fs.mkdir(folderPath, { recursive: true })
  await fs.writeFile(path.join(folderPath, '_info.txt'), [
    `page_id=${singleLine(metadata.page_id)}`,
    `page_title=${singleLine(metadata.page_title)}`,
    `space_key=${singleLine(metadata.space_key || 'none')}`,
    ''
  ].join('\n'), 'utf8')
  if (typeof storage === 'string') {
    await fs.writeFile(path.join(folderPath, '_storage.xml'), storage, 'utf8')
  }
  if (typeof attachmentPreview === 'string') {
    await fs.writeFile(path.join(folderPath, '_attachments_preview.txt'), attachmentPreview, 'utf8')
  }
}

async function writeIncompleteMarker (outputRoot) {
  await fs.mkdir(outputRoot, { recursive: true })
  await fs.writeFile(path.join(outputRoot, 'INCOMPLETE'), 'incomplete=1\n', 'utf8')
}

async function removeIncompleteMarker (outputRoot) {
  await fs.rm(path.join(outputRoot, 'INCOMPLETE'), { force: true })
}

async function writePagePayloadArtifact (outputRoot, folder, storage, pagePayloadFormat) {
  const folderPath = path.join(outputRoot, ...folder.split('/'))
  await fs.mkdir(folderPath, { recursive: true })
  await fs.writeFile(path.join(folderPath, pagePayloadFilename(pagePayloadFormat)), storage, 'utf8')
}

function pagePayloadFilename (pagePayloadFormat) {
  return pagePayloadFormat === 'md' ? 'page.md' : 'page.html'
}

async function writeAttachmentPayloadArtifacts (outputRoot, folder, payloads) {
  if (payloads.length === 0) {
    return
  }
  const attachmentsPath = path.join(outputRoot, ...folder.split('/'), 'attachments')
  await fs.mkdir(attachmentsPath, { recursive: true })
  for (const payload of payloads) {
    await fs.writeFile(path.join(attachmentsPath, payload.filename), payload.bytes)
  }
}

function singleLine (value) {
  return String(value).replace(/[\t\n\r]/g, ' ')
}

module.exports = {
  runExportRelatedCommand
}
