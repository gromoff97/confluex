export type OptionDefinition = {
  token: string
  value?: string
  required?: true
  description: string
}

export type CommandDefinition = {
  name: 'setup' | 'export'
  purpose: string
  helpPurpose?: string
  usage: string
  examples: string[]
  options: OptionDefinition[]
  notes: string[]
}

const commands: CommandDefinition[] = [
  {
    name: 'setup',
    purpose: 'interactive user configuration workflow',
    usage: 'confluex setup',
    examples: [
      'confluex setup'
    ],
    options: [],
    notes: []
  },
  {
    name: 'export',
    purpose: 'Confluence export workflow',
    usage: 'confluex export --page-id <id> [options]',
    examples: [
      'confluex export --page-id <id>',
      'confluex export --page-id <id> --plan-only'
    ],
    options: [
      { token: '--page-id', value: '<id>', required: true, description: 'Root Confluence page id to export.' },
      { token: '--out', value: '<path>', description: 'Output directory. Default: generated automatically.' },
      { token: '--plan-only', description: 'Inspect export scope and reports without materializing page payloads.' },
      { token: '--include-children', description: 'Include the recursive Confluence child tree.' },
      { token: '--zip', description: 'Create a ZIP archive beside the Markdown output root.' },
      { token: '--debug', description: 'Write sanitized diagnostic artifacts inside the output root.' },
      { token: '--config', value: '<file>', description: 'Load public configuration from this JSON file.' },
      { token: '--insecure', description: 'Allow insecure export transport for this invocation.' },
      { token: '--max-pages', value: '<n>', description: 'Stop after n processed pages.' },
      { token: '--max-download-mib', value: '<n>', description: 'Stop after downloading n MiB in total.' },
      { token: '--sleep-ms', value: '<n>', description: 'Sleep n ms between processed pages.' },
      { token: '--max-find-candidates', value: '<n>', description: 'Inspect at most n title-resolution candidates per link.' },
      { token: '--link-depth', value: '<n>', description: 'Follow supported internal links up to n hops from pages already in scope; default: 1.' },
      { token: '--resume', description: 'Reuse a compatible existing materialized export root selected by --out.' },
      { token: '--no-fail-fast', description: 'Continue after page-local runtime failures.' }
    ],
    notes: [
      '--resume requires --out'
    ]
  }
]

export function allCommands (): CommandDefinition[] {
  return commands.slice()
}

export function findCommand (name: string): CommandDefinition | null {
  return commands.find(command => command.name === name) ?? null
}

export function isCommand (name: string): boolean {
  return findCommand(name) !== null
}
