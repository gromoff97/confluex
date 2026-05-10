export const REPORT_FILE_ORDER = [
  'manifest.tsv',
  'resolved-links.tsv',
  'unresolved-links.tsv',
  'failed-pages.tsv',
  'scope-findings.tsv',
  'summary.txt'
] as const

export const SUMMARY_KEYS = [
  'command',
  'execution_mode',
  'page_id',
  'output_root',
  'zip_path',
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
  'fresh_pages'
] as const

export const LINK_KINDS = ['child_result', 'content_id', 'page_ref', 'macro_param', 'href_page_id', 'href_space_title', 'ri_url_page_id', 'ri_url_space_title'] as const
export const RESOLUTION_REASONS = ['not_found', 'not_unique', 'candidate_limit', 'insufficient_data'] as const
export const DISCOVERY_SOURCES = ['root', 'tree', 'linked'] as const
export const EXECUTION_MODES = ['materialized', 'plan_only'] as const
export const FINAL_STATUSES = ['success', 'success_with_findings', 'incomplete', 'interrupted'] as const
export const SCOPE_TRUST_VALUES = ['trusted', 'degraded'] as const
export const INTERRUPT_REASONS = ['none', 'max_pages_limit_reached', 'max_download_limit_reached', 'runtime_error', 'signal_interrupt'] as const
export const FAILED_OPERATIONS = ['page_metadata', 'storage_content', 'child_listing', 'title_resolution', 'attachment_preview', 'page_payload', 'attachment_download'] as const
export const FINDING_AREAS = ['child_listing', 'storage_content', 'title_resolution', 'unsupported_pattern', 'page_payload'] as const
export const FINDING_TYPES = ['incomplete_tree', 'partial_listing', 'storage_unavailable', 'storage_uninterpretable', 'candidate_visibility_incomplete', 'unsupported_internal_pattern', 'markdown_remnant'] as const

const VALID_SCOPE_FINDING_PAIRS = new Set([
  'child_listing\tincomplete_tree',
  'child_listing\tpartial_listing',
  'storage_content\tstorage_unavailable',
  'storage_content\tstorage_uninterpretable',
  'title_resolution\tcandidate_visibility_incomplete',
  'unsupported_pattern\tunsupported_internal_pattern',
  'page_payload\tmarkdown_remnant'
])

export function isValidScopeFindingPair (findingArea: string, findingType: string): boolean {
  return VALID_SCOPE_FINDING_PAIRS.has(`${findingArea}\t${findingType}`)
}
