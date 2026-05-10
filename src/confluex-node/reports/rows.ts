import { bytewiseCompare, tsvDataField } from '../base/serialization'

export type SerializedRows = readonly string[]

type RowRecord = Record<string, unknown>

export function mergeResolvedRows (rows: readonly unknown[]): readonly unknown[] {
  return mergeRowsByIdentity(rows, row => [
    stringField(row, 'source_page_id'),
    stringField(row, 'link_kind'),
    stringField(row, 'raw_link_value'),
    stringField(row, 'target_page_id')
  ].join('\t'), mergeAvailableFields(['source_title', 'target_space_key', 'target_title']))
}

export function mergeUnresolvedRows (rows: readonly unknown[]): readonly unknown[] {
  return mergeRowsByIdentity(rows, row => [
    stringField(row, 'source_page_id'),
    stringField(row, 'link_kind'),
    stringField(row, 'raw_link_value'),
    stringField(row, 'resolution_reason')
  ].join('\t'), mergeAvailableFields(['source_title']))
}

export function mergeFailedPageRows (rows: readonly unknown[]): readonly unknown[] {
  return mergeRowsByIdentity(rows, (row, index) => {
    const pageId = stringField(row, 'page_id')
    const operation = stringField(row, 'operation')
    if (pageId === 'none') {
      return `none\t${index}\t${JSON.stringify(row)}`
    }
    return `${pageId}\t${operation}`
  }, mergeSmallestAvailableTitle)
}

export function normalizeTsvField (value: string): string {
  return tsvDataField(value, 'tsv field')
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
  identity: (row: RowRecord, index: number) => string,
  merge: (current: RowRecord, next: RowRecord) => RowRecord = current => current
): readonly unknown[] {
  const mergedByKey = new Map<string, RowRecord>()
  const order: string[] = []
  rows.forEach((value, index) => {
    const row = requireRowRecord(value)
    const key = identity(row, index)
    const current = mergedByKey.get(key)
    if (current !== undefined) {
      mergedByKey.set(key, merge(current, row))
      return
    }
    order.push(key)
    mergedByKey.set(key, row)
  })
  return order.map(key => {
    const row = mergedByKey.get(key)
    if (row === undefined) {
      throw new Error('missing merged row')
    }
    return row
  })
}

function mergeAvailableFields (fieldNames: readonly string[]): (current: RowRecord, next: RowRecord) => RowRecord {
  return (current, next) => {
    const merged = { ...current }
    for (const fieldName of fieldNames) {
      if (stringField(merged, fieldName) === 'none' && stringField(next, fieldName) !== 'none') {
        merged[fieldName] = next[fieldName]
      }
    }
    return merged
  }
}

function mergeSmallestAvailableTitle (current: RowRecord, next: RowRecord): RowRecord {
  const currentTitle = stringField(current, 'page_title')
  const nextTitle = stringField(next, 'page_title')
  if (currentTitle === 'none' && nextTitle !== 'none') {
    return { ...current, page_title: nextTitle }
  }
  if (currentTitle !== 'none' && nextTitle !== 'none' && bytewiseCompare(tsvDataField(nextTitle), tsvDataField(currentTitle)) < 0) {
    return { ...current, page_title: nextTitle }
  }
  return current
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
