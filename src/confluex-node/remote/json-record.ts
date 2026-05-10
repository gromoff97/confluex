import { TextDecoder } from 'node:util'

export type JsonRecordDecodeResult =
  | { state: 'ok', value: Record<string, unknown>, bytes: number }
  | { state: 'failed', reason: 'invalid_utf8' | 'invalid_json' | 'non_object_json' }

const decoder = new TextDecoder('utf-8', { fatal: true })

export function decodeJsonRecord (body: Buffer): JsonRecordDecodeResult {
  let text: string
  try {
    text = decoder.decode(body)
  } catch {
    return { state: 'failed', reason: 'invalid_utf8' }
  }

  let value: unknown
  try {
    value = JSON.parse(text) as unknown
  } catch {
    return { state: 'failed', reason: 'invalid_json' }
  }

  if (!isRecord(value)) {
    return { state: 'failed', reason: 'non_object_json' }
  }

  return {
    state: 'ok',
    value,
    bytes: body.length
  }
}

export function isRecord (value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
