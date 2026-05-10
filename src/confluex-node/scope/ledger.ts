export type DiscoverySource = 'root' | 'tree' | 'linked'
export type ScopeStopReason = 'none' | 'max_pages_limit_reached' | 'max_download_limit_reached'

export type ScopeLedgerEntry = {
  pageId: string
  source: DiscoverySource
  depth: number
  ordinal: number
}

export class ScopeLedger {
  private readonly orderedEntries: ScopeLedgerEntry[] = []
  private readonly entriesByPageId = new Map<string, ScopeLedgerEntry>()
  private currentStopReason: ScopeStopReason = 'none'

  add (entry: Omit<ScopeLedgerEntry, 'ordinal'>): ScopeLedgerEntry {
    validateEntry(entry)
    const existing = this.entriesByPageId.get(entry.pageId)
    if (existing !== undefined) {
      return existing
    }

    const next: ScopeLedgerEntry = {
      ...entry,
      ordinal: this.orderedEntries.length
    }
    this.orderedEntries.push(next)
    this.entriesByPageId.set(next.pageId, next)
    return next
  }

  entries (): readonly ScopeLedgerEntry[] {
    return this.orderedEntries.map(entry => ({ ...entry }))
  }

  stop (reason: ScopeStopReason): void {
    if (!isScopeStopReason(reason)) {
      throw new TypeError('invalid stop reason')
    }
    if (this.currentStopReason === 'none') {
      this.currentStopReason = reason
    }
  }

  stopReason (): ScopeStopReason {
    return this.currentStopReason
  }
}

function validateEntry (entry: Omit<ScopeLedgerEntry, 'ordinal'>): void {
  if (!/^(0|[1-9][0-9]*)$/.test(entry.pageId)) {
    throw new TypeError('invalid pageId')
  }
  if (!isDiscoverySource(entry.source)) {
    throw new TypeError('invalid source')
  }
  if (!Number.isSafeInteger(entry.depth) || entry.depth < 0) {
    throw new TypeError('invalid depth')
  }
}

function isDiscoverySource (value: unknown): value is DiscoverySource {
  return value === 'root' || value === 'tree' || value === 'linked'
}

function isScopeStopReason (value: unknown): value is ScopeStopReason {
  return value === 'none' || value === 'max_pages_limit_reached' || value === 'max_download_limit_reached'
}
