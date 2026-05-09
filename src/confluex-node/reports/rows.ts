export type SerializedRows = readonly string[]

type RowRecord = Record<string, unknown>

export function mergeResolvedRows (rows: readonly unknown[]): readonly unknown[] {
  return mergeRowsByIdentity(rows, row => [
    stringField(row, 'source_page_id'),
    stringField(row, 'link_kind'),
    stringField(row, 'raw_link_value'),
    stringField(row, 'target_page_id')
  ].join('\t'))
}

export function mergeUnresolvedRows (rows: readonly unknown[]): readonly unknown[] {
  return mergeRowsByIdentity(rows, row => [
    stringField(row, 'source_page_id'),
    stringField(row, 'link_kind'),
    stringField(row, 'raw_link_value'),
    stringField(row, 'resolution_reason')
  ].join('\t'))
}

export function mergeFailedPageRows (rows: readonly unknown[]): readonly unknown[] {
  return mergeRowsByIdentity(rows, (row, index) => {
    const pageId = stringField(row, 'page_id')
    const operation = stringField(row, 'operation')
    if (pageId === 'none') {
      return `none\t${index}\t${JSON.stringify(row)}`
    }
    return `${pageId}\t${operation}`
  })
}

export function normalizeTsvField (value: string): string {
  let normalized = ''
  for (const character of value) {
    const code = character.codePointAt(0)
    normalized += code !== undefined && (code <= 0x1f || code === 0x7f) ? ' ' : character
  }

  const escapedBackslash = normalized.startsWith('\\') ? `\\${normalized}` : normalized
  return escapedBackslash === 'none' ? '\\none' : escapedBackslash
}

export function structuredRawLinkValue (kind: 'page_id' | 'title', parts: readonly string[]): string {
  if (kind === 'page_id') {
    const pageId = parts[0]
    if (typeof pageId !== 'string') {
      throw new TypeError('page_id raw link value requires page id')
    }
    return `page_id:${normalizeTsvField(pageId)}`
  }

  const spaceKeyPresent = parts[0]
  const spaceKey = parts[1]
  const title = parts[2]
  if ((spaceKeyPresent !== '0' && spaceKeyPresent !== '1') || typeof spaceKey !== 'string' || typeof title !== 'string') {
    throw new TypeError('title raw link value requires presence, space key, and title')
  }

  const normalizedSpaceKey = normalizeTsvField(spaceKey)
  const normalizedTitle = normalizeTsvField(title)
  return [
    `space_key_present=${spaceKeyPresent}`,
    `space_key_bytes=${Buffer.byteLength(normalizedSpaceKey, 'utf8')}`,
    `space_key=${normalizedSpaceKey}`,
    `title_bytes=${Buffer.byteLength(normalizedTitle, 'utf8')}`,
    `title=${normalizedTitle}`
  ].join(';')
}

function mergeRowsByIdentity (
  rows: readonly unknown[],
  identity: (row: RowRecord, index: number) => string
): readonly unknown[] {
  const seen = new Set<string>()
  const merged: unknown[] = []
  rows.forEach((value, index) => {
    const row = requireRowRecord(value)
    const key = identity(row, index)
    if (seen.has(key)) {
      return
    }
    seen.add(key)
    merged.push(value)
  })
  return merged
}

function stringField (row: RowRecord, key: string): string {
  const value = row[key]
  if (typeof value !== 'string') {
    throw new TypeError(`${key} must be a string`)
  }
  return value
}

function requireRowRecord (value: unknown): RowRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('row must be an object')
  }
  return value as RowRecord
}
