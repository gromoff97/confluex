export type TsvFieldClass = 'absence' | 'data'

const MAX_SAFE_INTEGER_BIGINT = BigInt(Number.MAX_SAFE_INTEGER)

export function canonicalNonNegativeInteger (value: unknown, name: string): string {
  const text = requireCanonicalIntegerText(value, name, false)
  if (BigInt(text) > MAX_SAFE_INTEGER_BIGINT) {
    throw new TypeError(`${name} must be a safe canonical non-negative integer`)
  }
  return text
}

export function canonicalPositiveInteger (value: unknown, name: string): string {
  const text = requireCanonicalIntegerText(value, name, true)
  if (BigInt(text) > MAX_SAFE_INTEGER_BIGINT) {
    throw new TypeError(`${name} must be a safe canonical positive integer`)
  }
  return text
}

export function bytewiseCompare (left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'))
}

export function tsvDataField (value: unknown, name: string = 'value'): string {
  const normalized = normalizeTsvText(requireString(value, name))
  const escapedBackslash = normalized.startsWith('\\') ? `\\${normalized}` : normalized
  return escapedBackslash === 'none' ? '\\none' : escapedBackslash
}

export function tsvAbsenceOrDataField (value: unknown, name: string = 'value'): string {
  if (value === 'none') {
    return 'none'
  }
  return tsvDataField(value, name)
}

export function tsvFormulaSafeDataField (value: unknown, name: string = 'value'): string {
  const text = requireString(value, name)
  const normalized = tsvDataField(text, name)
  return /^[=+\-@\t\r\n]/.test(text) ? `'${normalized}` : normalized
}

export function governedRelativePath (value: unknown, name: string): string {
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

export function tokenList (tokens: readonly string[]): string {
  return tokens.length === 0 ? 'none' : tokens.join(',')
}

function requireCanonicalIntegerText (value: unknown, name: string, positive: boolean): string {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value)) {
    throw new TypeError(`${name} must be a canonical ${positive ? 'positive' : 'non-negative'} integer`)
  }
  if (positive && value === '0') {
    throw new TypeError(`${name} must be a canonical positive integer`)
  }
  return value
}

function requireString (value: unknown, name: string): string {
  if (typeof value !== 'string') {
    throw new TypeError(`${name} must be a string`)
  }
  return value
}

function normalizeTsvText (value: string): string {
  let normalized = ''
  for (const character of value) {
    const code = character.codePointAt(0)
    normalized += code !== undefined && (code <= 0x1f || code === 0x7f) ? ' ' : character
  }
  return normalized
}
