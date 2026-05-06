'use strict'

const fs = require('node:fs/promises')
const path = require('node:path')
const { quotePathString } = require('../path/format')

const REPORT_FILE_ORDER = [
  'manifest.tsv',
  'resolved-links.tsv',
  'unresolved-links.tsv',
  'failed-pages.tsv',
  'scope-findings.tsv',
  'summary.txt'
]

const HEADER_TEXT = {
  'manifest.tsv': 'page_id\tspace_key\tpage_title\tfolder\tdiscovery_source\trun_mode\tattachment_count\n',
  'resolved-links.tsv': 'source_page_id\tsource_title\tlink_kind\traw_link_value\ttarget_page_id\ttarget_space_key\ttarget_title\n',
  'unresolved-links.tsv': 'source_page_id\tsource_title\tlink_kind\traw_link_value\tresolution_reason\n',
  'failed-pages.tsv': 'page_id\tpage_title\toperation\terror_summary\n',
  'scope-findings.tsv': 'page_id\tfinding_area\tfinding_type\tdetail\n'
}

const SUMMARY_KEYS = [
  'command',
  'page_id',
  'output_root',
  'output_path_provenance',
  'support_profile',
  'page_payload_format',
  'final_status',
  'scope_trust',
  'processed_pages',
  'root_pages',
  'tree_pages',
  'linked_pages',
  'other_pages',
  'resolved_links',
  'unresolved_links',
  'scope_findings',
  'failed_operations',
  'downloaded_mib_total',
  'downloaded_mib_content',
  'downloaded_mib_metadata',
  'blocking_reasons',
  'interrupt_reason',
  'resume_mode',
  'resume_schema_version',
  'reused_pages',
  'fresh_pages',
  'encryption_enabled',
  'encryption_successful'
]

function emptyRunReportTexts (input) {
  return runReportTexts(input)
}

function runReportTexts (input) {
  const manifestRows = sortedManifestRows(rowArray(input.manifestRows, 'manifestRows')).map(serializeManifestRow)
  const resolvedLinkRows = sortedSerializedRows(rowArray(input.resolvedLinkRows, 'resolvedLinkRows'), serializeResolvedLinkRow)
  const unresolvedLinkRows = sortedSerializedRows(rowArray(input.unresolvedLinkRows, 'unresolvedLinkRows'), serializeUnresolvedLinkRow)
  const failedPageRows = sortedSerializedRows(rowArray(input.failedPageRows, 'failedPageRows'), serializeFailedPageRow)
  const scopeFindingRows = sortedSerializedRows(rowArray(input.scopeFindingRows, 'scopeFindingRows'), serializeScopeFindingRow)
  const counts = {
    processedPages: manifestRows.length,
    rootPages: manifestRows.filter(row => row.includes('\troot\t')).length,
    treePages: manifestRows.filter(row => row.includes('\ttree\t')).length,
    linkedPages: manifestRows.filter(row => row.includes('\tlinked\t')).length,
    resolvedLinks: resolvedLinkRows.length,
    unresolvedLinks: unresolvedLinkRows.length,
    scopeFindings: scopeFindingRows.length,
    failedOperations: failedPageRows.length
  }

  return {
    'manifest.tsv': tsvText(HEADER_TEXT['manifest.tsv'], manifestRows),
    'resolved-links.tsv': tsvText(HEADER_TEXT['resolved-links.tsv'], resolvedLinkRows),
    'unresolved-links.tsv': tsvText(HEADER_TEXT['unresolved-links.tsv'], unresolvedLinkRows),
    'failed-pages.tsv': tsvText(HEADER_TEXT['failed-pages.tsv'], failedPageRows),
    'scope-findings.tsv': tsvText(HEADER_TEXT['scope-findings.tsv'], scopeFindingRows),
    'summary.txt': summaryText(input, counts)
  }
}

async function writeRunReportSet (outputRoot, reportTexts) {
  validateReportTexts(reportTexts)
  await fs.mkdir(outputRoot, { recursive: true })
  for (const name of REPORT_FILE_ORDER) {
    await fs.writeFile(path.join(outputRoot, name), reportTexts[name], 'utf8')
  }
}

function summaryText (input, counts) {
  const values = summaryValues(input, counts)
  return SUMMARY_KEYS.map(key => `${key}=${values[key]}`).join('\n') + '\n'
}

function summaryValues (input, counts = zeroCounts()) {
  const command = requireOneOf(input.command, ['export', 'plan'], 'command')
  const pageId = requireCanonicalNonNegativeInteger(input.pageId, 'pageId')
  const outputRoot = requireString(input.outputRoot, 'outputRoot')
  const outputPathProvenance = requireOneOf(input.outputPathProvenance, ['explicit', 'generated'], 'outputPathProvenance')
  const pagePayloadFormat = requirePagePayloadFormat(command, input.pagePayloadFormat)
  const finalStatus = requireOneOf(input.finalStatus, ['success', 'success_with_findings', 'policy_failed', 'incomplete', 'interrupted', 'encryption_failed'], 'finalStatus')
  const scopeTrust = requireOneOf(input.scopeTrust, ['trusted', 'degraded'], 'scopeTrust')
  const interruptReason = requireOneOf(input.interruptReason, ['none', 'max_pages_limit_reached', 'max_download_limit_reached', 'runtime_error', 'signal_interrupt'], 'interruptReason')
  const downloadedMib = downloadedMibValues(input.downloadedMib)

  return {
    command,
    page_id: pageId,
    output_root: quotePathString(outputRoot),
    output_path_provenance: outputPathProvenance,
    support_profile: 'default',
    page_payload_format: pagePayloadFormat,
    final_status: finalStatus,
    scope_trust: scopeTrust,
    processed_pages: String(counts.processedPages),
    root_pages: String(counts.rootPages),
    tree_pages: String(counts.treePages),
    linked_pages: String(counts.linkedPages),
    other_pages: '0',
    resolved_links: String(counts.resolvedLinks),
    unresolved_links: String(counts.unresolvedLinks),
    scope_findings: String(counts.scopeFindings),
    failed_operations: String(counts.failedOperations),
    downloaded_mib_total: downloadedMib.total,
    downloaded_mib_content: downloadedMib.content,
    downloaded_mib_metadata: downloadedMib.metadata,
    blocking_reasons: blockingReasons(counts),
    interrupt_reason: interruptReason,
    resume_mode: booleanValue(input.resumeMode === undefined ? false : input.resumeMode, 'resumeMode'),
    resume_schema_version: '2',
    reused_pages: nonNegativeIntegerValue(input.reusedPages, 'reusedPages', 0),
    fresh_pages: nonNegativeIntegerValue(input.freshPages, 'freshPages', counts.processedPages),
    encryption_enabled: booleanValue(input.encryptionEnabled, 'encryptionEnabled'),
    encryption_successful: booleanValue(input.encryptionSuccessful, 'encryptionSuccessful')
  }
}

function rowArray (value, name) {
  if (value === undefined) {
    return []
  }
  if (!Array.isArray(value)) {
    throw new TypeError(`${name} must be an array`)
  }
  return value
}

function tsvText (headerText, serializedRows) {
  return headerText + serializedRows.join('')
}

function sortedManifestRows (rows) {
  return rows.slice().sort((left, right) => {
    return discoveryRank(left.discovery_source) - discoveryRank(right.discovery_source) ||
      bytewiseCompare(normalizeManifestFolder(left.folder), normalizeManifestFolder(right.folder)) ||
      bytewiseCompare(requireCanonicalNonNegativeInteger(left.page_id, 'manifest.page_id'), requireCanonicalNonNegativeInteger(right.page_id, 'manifest.page_id'))
  })
}

function sortedSerializedRows (rows, serialize) {
  return Array.from(new Set(rows.map(serialize))).sort(bytewiseCompare)
}

function serializeManifestRow (row) {
  const discoverySource = requireOneOf(row.discovery_source, ['root', 'tree', 'linked'], 'manifest.discovery_source')
  const runMode = requireOneOf(row.run_mode, ['export', 'plan'], 'manifest.run_mode')
  const fields = [
    requireCanonicalNonNegativeInteger(row.page_id, 'manifest.page_id'),
    absenceOrDataField(row.space_key, 'manifest.space_key'),
    dataField(row.page_title, 'manifest.page_title'),
    normalizeManifestFolder(row.folder),
    discoverySource,
    runMode,
    attachmentCountField(row.attachment_count)
  ]
  return `${fields.join('\t')}\n`
}

function serializeResolvedLinkRow (row) {
  return `${[
    requireCanonicalNonNegativeInteger(row.source_page_id, 'resolved.source_page_id'),
    absenceOrDataField(row.source_title, 'resolved.source_title'),
    requireOneOf(row.link_kind, ['child_result', 'content_id', 'page_ref', 'macro_param', 'href_page_id', 'href_space_title', 'ri_url_page_id', 'ri_url_space_title'], 'resolved.link_kind'),
    dataField(row.raw_link_value, 'resolved.raw_link_value'),
    requireCanonicalNonNegativeInteger(row.target_page_id, 'resolved.target_page_id'),
    absenceOrDataField(row.target_space_key, 'resolved.target_space_key'),
    absenceOrDataField(row.target_title, 'resolved.target_title')
  ].join('\t')}\n`
}

function serializeUnresolvedLinkRow (row) {
  return `${[
    requireCanonicalNonNegativeInteger(row.source_page_id, 'unresolved.source_page_id'),
    absenceOrDataField(row.source_title, 'unresolved.source_title'),
    requireOneOf(row.link_kind, ['child_result', 'content_id', 'page_ref', 'macro_param', 'href_page_id', 'href_space_title', 'ri_url_page_id', 'ri_url_space_title'], 'unresolved.link_kind'),
    dataField(row.raw_link_value, 'unresolved.raw_link_value'),
    requireOneOf(row.resolution_reason, ['not_found', 'not_unique', 'candidate_limit', 'insufficient_data'], 'unresolved.resolution_reason')
  ].join('\t')}\n`
}

function serializeFailedPageRow (row) {
  const operation = requireOneOf(row.operation, ['page_metadata', 'storage_content', 'child_listing', 'title_resolution', 'attachment_preview', 'page_payload', 'attachment_download'], 'failed.operation')
  const expectedSummary = `${operation}_failed`
  requireOneOf(row.error_summary, [expectedSummary], 'failed.error_summary')
  return `${[
    canonicalIdOrAbsence(row.page_id, 'failed.page_id'),
    absenceOrDataField(row.page_title, 'failed.page_title'),
    operation,
    row.error_summary
  ].join('\t')}\n`
}

function serializeScopeFindingRow (row) {
  const findingArea = requireOneOf(row.finding_area, ['child_listing', 'storage_content', 'title_resolution', 'unsupported_pattern', 'page_payload'], 'scope.finding_area')
  const findingType = requireOneOf(row.finding_type, ['incomplete_tree', 'partial_listing', 'storage_unavailable', 'storage_uninterpretable', 'candidate_visibility_incomplete', 'unsupported_internal_pattern', 'markdown_remnant'], 'scope.finding_type')
  return `${[
    canonicalIdOrAbsence(row.page_id, 'scope.page_id'),
    findingArea,
    findingType,
    dataField(row.detail, 'scope.detail')
  ].join('\t')}\n`
}

function normalizeManifestFolder (value) {
  if (value === 'none') {
    return 'none'
  }
  return governedRelativePath(value, 'manifest.folder')
}

function attachmentCountField (value) {
  if (value === 'none') {
    return 'none'
  }
  return requireCanonicalNonNegativeInteger(value, 'manifest.attachment_count')
}

function canonicalIdOrAbsence (value, name) {
  if (value === 'none') {
    return 'none'
  }
  return requireCanonicalNonNegativeInteger(value, name)
}

function absenceOrDataField (value, name) {
  if (value === 'none') {
    return 'none'
  }
  return dataField(value, name)
}

function dataField (value, name) {
  const stringValue = normalizeControlCharacters(requireString(value, name))
  const escapedBackslash = stringValue.startsWith('\\') ? `\\${stringValue}` : stringValue
  return escapedBackslash === 'none' ? '\\none' : escapedBackslash
}

function normalizeControlCharacters (value) {
  let normalized = ''
  for (const character of value) {
    normalized += character.codePointAt(0) <= 0x1F ? ' ' : character
  }
  return normalized
}

function governedRelativePath (value, name) {
  const stringValue = requireString(value, name)
  if (
    stringValue.startsWith('/') ||
    stringValue.endsWith('/') ||
    stringValue.includes('\\') ||
    stringValue.includes(':') ||
    stringValue.includes('\t') ||
    stringValue.includes('\n') ||
    stringValue.includes('\r') ||
    stringValue.split('/').some(segment => segment === '' || segment === '.' || segment === '..')
  ) {
    throw new TypeError(`${name} must be a governed relative path`)
  }
  return stringValue
}

function discoveryRank (value) {
  return {
    root: 0,
    tree: 1,
    linked: 2
  }[requireOneOf(value, ['root', 'tree', 'linked'], 'manifest.discovery_source')]
}

function blockingReasons (counts) {
  const tokens = []
  if (counts.unresolvedLinks > 0) {
    tokens.push('unresolved_links')
  }
  if (counts.scopeFindings > 0) {
    tokens.push('scope_findings')
  }
  if (counts.failedOperations > 0) {
    tokens.push('failed_operations')
  }
  return tokens.length === 0 ? 'none' : tokens.join(',')
}

function downloadedMibValues (value) {
  if (value === undefined) {
    return {
      total: '0.000',
      content: '0.000',
      metadata: '0.000'
    }
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('downloadedMib must be an object')
  }
  return {
    total: decimalMibValue(value.total, 'downloadedMib.total'),
    content: decimalMibValue(value.content, 'downloadedMib.content'),
    metadata: decimalMibValue(value.metadata, 'downloadedMib.metadata')
  }
}

function decimalMibValue (value, name) {
  if (typeof value !== 'string' || !/^(?:0|[1-9][0-9]*)\.[0-9]{3}$/.test(value)) {
    throw new TypeError(`${name} must be a decimal MiB string`)
  }
  return value
}

function zeroCounts () {
  return {
    processedPages: 0,
    rootPages: 0,
    treePages: 0,
    linkedPages: 0,
    resolvedLinks: 0,
    unresolvedLinks: 0,
    scopeFindings: 0,
    failedOperations: 0
  }
}

function validateReportTexts (reportTexts) {
  if (reportTexts === null || typeof reportTexts !== 'object' || Array.isArray(reportTexts)) {
    throw new TypeError('reportTexts must be an object')
  }

  const actual = Object.keys(reportTexts)
  if (actual.join('\n') !== REPORT_FILE_ORDER.join('\n')) {
    throw new TypeError('reportTexts must contain exactly the governed report files in order')
  }

  for (const name of REPORT_FILE_ORDER) {
    if (typeof reportTexts[name] !== 'string') {
      throw new TypeError(`${name} text must be a string`)
    }
  }
}

function requirePagePayloadFormat (command, value) {
  if (command === 'plan') {
    return requireOneOf(value, ['none'], 'pagePayloadFormat')
  }

  return requireOneOf(value, ['md', 'html'], 'pagePayloadFormat')
}

function requireString (value, name) {
  if (typeof value !== 'string' || value === '') {
    throw new TypeError(`${name} must be a non-empty string`)
  }
  return value
}

function requireCanonicalNonNegativeInteger (value, name) {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value)) {
    throw new TypeError(`${name} must be a canonical non-negative integer string`)
  }
  return value
}

function requireOneOf (value, allowed, name) {
  if (!allowed.includes(value)) {
    throw new TypeError(`${name} must be one of ${allowed.join(',')}`)
  }
  return value
}

function booleanValue (value, name) {
  if (value !== true && value !== false) {
    throw new TypeError(`${name} must be a boolean`)
  }
  return value ? '1' : '0'
}

function nonNegativeIntegerValue (value, name, defaultValue) {
  const candidate = value === undefined ? defaultValue : value
  if (!Number.isSafeInteger(candidate) || candidate < 0) {
    throw new TypeError(`${name} must be a non-negative safe integer`)
  }
  return String(candidate)
}

function bytewiseCompare (left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'))
}

module.exports = {
  REPORT_FILE_ORDER,
  emptyRunReportTexts,
  runReportTexts,
  writeRunReportSet
}
