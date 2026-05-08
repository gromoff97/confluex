const SECRET_NAME_PATTERN = /(?:^|[_-])(token|secret|password|authorization|api[_-]?token|pat)(?:$|[_-])/i
const REDACTED = '[REDACTED]'

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
      redacted[key] = SECRET_NAME_PATTERN.test(key) ? REDACTED : redactUnknown(item, secrets)
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
  return redacted
}

function normalizedSecrets (secrets: readonly string[]): string[] {
  return Array.from(new Set(secrets.filter(secret => secret.length > 0)))
}

function isRecord (value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
