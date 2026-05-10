export type StorageTraceResult =
  | { state: 'ok', storage: string, bytes: number }
  | { state: 'failed', bytes: number }

export function storageTraceResult (input: { storage?: string, bytes?: number }): StorageTraceResult {
  const bytes = Number.isSafeInteger(input.bytes) && input.bytes !== undefined && input.bytes >= 0 ? input.bytes : 0
  if (typeof input.storage !== 'string') {
    return { state: 'failed', bytes }
  }
  return {
    state: 'ok',
    storage: input.storage,
    bytes
  }
}
