import { reportRawLinkValue } from '../links/target-reference'
import { targetReferenceFromRelativeUrl } from '../links/target-reference'

type MarkdownDestinationInput = {
  destination: string
}

export type MarkdownDestinationClassification =
  | { kind: 'neutralized_dangerous', reason: 'dangerous_scheme' }
  | { kind: 'preserved_external', url: string }
  | { kind: 'unresolved_internal', marker: string }
  | { kind: 'unsupported', marker: string }

export function classifyMarkdownDestination (input: MarkdownDestinationInput): MarkdownDestinationClassification {
  const destination = input.destination.trim()
  if (hasDangerousScheme(destination)) {
    return {
      kind: 'neutralized_dangerous',
      reason: 'dangerous_scheme'
    }
  }

  if (isPreservedExternalUrl(destination)) {
    return {
      kind: 'preserved_external',
      url: destination
    }
  }

  const target = targetReferenceFromRelativeUrl(destination)
  if (target.state === 'ok') {
    return {
      kind: 'unresolved_internal',
      marker: unresolvedTargetMarker(reportRawLinkValue(target.target))
    }
  }

  return {
    kind: 'unsupported',
    marker: `[unsupported: markdown_destination; value="${escapeDoubleQuotes(destination)}"]`
  }
}

function hasDangerousScheme (value: string): boolean {
  const match = /^[A-Za-z][A-Za-z0-9+.-]*:/.exec(value)
  if (match === null) {
    return false
  }
  return new Set(['javascript:', 'data:', 'vbscript:', 'file:']).has(match[0].toLowerCase())
}

function isPreservedExternalUrl (value: string): boolean {
  return /^(?:https?:|mailto:)/i.test(value)
}

function unresolvedTargetMarker (rawLinkValue: string): string {
  if (rawLinkValue.startsWith('page_id:')) {
    return `[unresolved: page; target_hint=page_id; value="${escapeDoubleQuotes(rawLinkValue.slice('page_id:'.length))}"]`
  }
  if (rawLinkValue.startsWith('title:')) {
    return `[unresolved: page; target_hint=title; value="${escapeDoubleQuotes(rawLinkValue)}"]`
  }
  return `[unresolved: page; target_hint=raw; value="${escapeDoubleQuotes(rawLinkValue)}"]`
}

function escapeDoubleQuotes (value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}
