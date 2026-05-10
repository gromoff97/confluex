const STORAGE_MARKERS = ['<ac:', '<ri:']
const HTML_MARKERS = [
  '<p',
  '</p>',
  '<table',
  '</table>',
  '<tr',
  '</tr>',
  '<td',
  '</td>',
  '<th',
  '</th>',
  '<div',
  '</div>',
  '<span',
  '</span>',
  '<img'
]

export type MarkdownRemnantKind = 'storage_format_remnant' | 'html_remnant'

export type MarkdownRemnantDiagnostic = {
  kind: MarkdownRemnantKind
  token: string
  detail: string
}

export function normalizeMarkdownPayload (payload: string): string {
  const text = payload
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(line => {
      const withoutTrailing = line.replace(/[ \t]+$/g, '')
      return /^[ \t]*$/.test(withoutTrailing) ? '' : withoutTrailing
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+/g, '')
    .replace(/\n*$/g, '')

  return `${text}\n`
}

export function markdownRemnantDiagnostics (markdown: string): MarkdownRemnantDiagnostic[] {
  const diagnostics: MarkdownRemnantDiagnostic[] = []
  const seen = new Set<string>()

  for (const token of STORAGE_MARKERS) {
    addDiagnostic(diagnostics, seen, 'storage_format_remnant', token, markdown)
  }
  for (const token of HTML_MARKERS) {
    addDiagnostic(diagnostics, seen, 'html_remnant', token, markdown)
  }

  return diagnostics
}

function addDiagnostic (
  diagnostics: MarkdownRemnantDiagnostic[],
  seen: Set<string>,
  kind: MarkdownRemnantKind,
  token: string,
  text: string
): void {
  if (!text.includes(token)) {
    return
  }
  const key = `${kind}\t${token}`
  if (seen.has(key)) {
    return
  }
  seen.add(key)
  diagnostics.push({
    kind,
    token,
    detail: `markdown_remnant_kind=${kind};token=${token}`
  })
}
