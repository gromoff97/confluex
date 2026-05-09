const REDACTED = '[REDACTED]'
const SECRET_KEY_NAMES = new Set([
  'token',
  'secret',
  'password',
  'authorization',
  'apikey',
  'apitoken',
  'accesstoken',
  'refreshtoken',
  'bearertoken',
  'confluencetoken',
  'pat'
])

export function redactForDebug (value: unknown, secrets: readonly string[] = []): unknown {
  return redactUnknown(value, normalizedSecrets(secrets))
}

export function redactTextForDebug (text: string, secrets: readonly string[] = []): string {
  return redactString(text, normalizedSecrets(secrets))
}

function redactUnknown (value: unknown, secrets: readonly string[]): unknown {
  if (typeof value === 'string') {
    return redactString(value, secrets)
  }
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return value
  }
  if (Array.isArray(value)) {
    return value.map(item => redactUnknown(item, secrets))
  }
  if (isRecord(value)) {
    const redacted: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) {
      redacted[key] = isSecretKey(key) ? REDACTED : redactUnknown(item, secrets)
    }
    return redacted
  }
  return String(value)
}

function redactString (value: string, secrets: readonly string[]): string {
  let redacted = value
  for (const secret of secrets) {
    redacted = redacted.split(secret).join(REDACTED)
  }
  return redactBearerText(redacted)
}

function normalizedSecrets (secrets: readonly string[]): string[] {
  const derived = new Set<string>()
  for (const secret of secrets) {
    if (secret.length === 0) {
      continue
    }

    derived.add(secret)
    const jsonLiteral = JSON.stringify(secret)
    derived.add(jsonLiteral)
    derived.add(jsonLiteral.slice(1, -1))
    derived.add(encodeURIComponent(secret))
    derived.add(`Authorization: Bearer ${secret}`)
    derived.add(`Bearer ${secret}`)
  }

  return Array.from(derived).sort((left, right) => right.length - left.length)
}

function isRecord (value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isSecretKey (key: string): boolean {
  return SECRET_KEY_NAMES.has(key.replace(/[-_]/g, '').toLowerCase())
}

function redactBearerText (value: string): string {
  return value
    .replace(/\bAuthorization\s*[:=]\s*Bearer\s+[^\s,;]+/gi, `Authorization: Bearer ${REDACTED}`)
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, `Bearer ${REDACTED}`)
}
