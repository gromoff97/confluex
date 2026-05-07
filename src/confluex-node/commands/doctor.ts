import { formatDiagnostic } from '../cli/diagnostics'
import { effectiveConfluenceEnv } from '../config/effective-options'
import type { EffectiveOptions } from '../cli/validate'
import { preparePersistentLog, writePersistentLog } from '../output/log-file'
import { executableDependencyProbe, nodeRuntimeDependency, type DependencyState } from '../prereq/checks'
import { checkRootPageAccess, resolveRemoteAccessContext, type RemoteAccessFailureReason } from '../remote/access'

type CommandResult = {
  exitCode: number
  stdout: string
  stderr: string
}

type DoctorOptions = EffectiveOptions & {
  config?: {
    confluenceBaseUrl?: string
    confluenceToken?: string
  }
}

type DependencyProbe = (label: string, executable: string) => DependencyState

type PageAccessCheckResult =
  | { state: 'ok', identity: string }
  | { state: 'failed', reason?: unknown }

type PageAccessChecker = (pageId: string, env: NodeJS.ProcessEnv) => Promise<PageAccessCheckResult>

type DoctorDependencies = {
  dependencyProbe?: DependencyProbe
  pageAccessChecker?: PageAccessChecker
  env?: NodeJS.ProcessEnv
  nodeVersion?: string
  cwd?: string
  outputRoot?: string
}

type ConfigurationState = 'ok' | RemoteAccessFailureReason

type PageAccess =
  | { state: 'skipped' }
  | { state: 'ok', reason: 'none', identity: string }
  | { state: 'failed', reason: PageAccessReason }

type PageAccessReason =
  | RemoteAccessFailureReason
  | 'auth_rejected'
  | 'page_inaccessible'
  | 'transport_tls'
  | 'transport_dns'
  | 'transport_timeout'
  | 'transport_connection_reset'
  | 'transport_proxy'
  | 'converter_auth_incompatible'

type NextAction =
  | 'upgrade_node_runtime'
  | 'install_markdown_converter'
  | 'set_confluence_base_url'
  | 'set_confluence_token'
  | 'fix_confluence_base_url'
  | 'check_page_access'

const converterDependencies = [
  ['markdown_converter', 'uvx']
] as const

const supportedLinkForms = [
  'child_result',
  'content_id',
  'page_ref',
  'macro_param',
  'href_page_id',
  'href_space_title',
  'ri_url_page_id',
  'ri_url_space_title'
] as const

const nextActionOrder: NextAction[] = [
  'upgrade_node_runtime',
  'install_markdown_converter',
  'set_confluence_base_url',
  'set_confluence_token',
  'fix_confluence_base_url',
  'check_page_access'
]

export async function runDoctorCommand (
  options: DoctorOptions,
  commandDependencies: DoctorDependencies = {}
): Promise<CommandResult> {
  const dependencyProbe = commandDependencies.dependencyProbe ?? defaultDependencyProbe
  const pageAccessChecker = commandDependencies.pageAccessChecker ?? checkRootPageAccess
  const env = effectiveConfluenceEnv(options, commandDependencies.env ?? process.env)
  const preparedLog = preparePersistentLog(options, commandDependencies)

  if (preparedLog.state === 'rejected') {
    return {
      exitCode: 1,
      stdout: '',
      stderr: `${formatDiagnostic({
        type: 'validation-failed',
        requirementId: preparedLog.requirementId
      })}\n`
    }
  }

  try {
    const dependencyStates = [
      nodeRuntimeDependency(commandDependencies.nodeVersion ?? process.version),
      ...converterDependencies.map(([label, executable]) => dependencyProbe(label, executable))
    ]
    const configuration = determineConfiguration(env)
    const pageAccess = await determinePageAccess(options, pageAccessChecker, env)
    const nextActions = determineNextActions(dependencyStates, configuration, pageAccess.state)
    const stdout = [
      ...dependencyStates.map(dependency => `dependency_${dependency.label}=${dependency.state}`),
      `configuration=${configuration}`,
      ...pageAccessLines(pageAccess),
      'support_profile=default',
      `supported_link_forms=${supportedLinkForms.join(',')}`,
      `next_action=${nextActions.length === 0 ? 'none' : nextActions.join(',')}`,
      ''
    ].join('\n')

    const logWrite = writePersistentLog(preparedLog, stdout)
    if (logWrite.state !== 'ok') {
      return {
        exitCode: 4,
        stdout: '',
        stderr: 'ERROR: runtime_failure doctor_log\n'
      }
    }

    return {
      exitCode: 0,
      stdout,
      stderr: ''
    }
  } catch {
    return {
      exitCode: 4,
      stdout: '',
      stderr: 'ERROR: runtime_failure doctor_state\n'
    }
  }
}

function determineConfiguration (env: NodeJS.ProcessEnv): ConfigurationState {
  const context = resolveRemoteAccessContext(env)
  return context.usable ? 'ok' : context.reason
}

async function determinePageAccess (
  options: DoctorOptions,
  pageAccessChecker: PageAccessChecker,
  env: NodeJS.ProcessEnv
): Promise<PageAccess> {
  if (!Object.prototype.hasOwnProperty.call(options.values, '--page-id')) {
    return { state: 'skipped' }
  }

  const pageId = options.values['--page-id']
  if (pageId === undefined) {
    return {
      state: 'failed',
      reason: 'page_inaccessible'
    }
  }

  const result = await pageAccessChecker(pageId, env)
  if (result.state === 'ok') {
    return {
      state: 'ok',
      reason: 'none',
      identity: result.identity
    }
  }

  return {
    state: 'failed',
    reason: normalizePageAccessReason(result.reason)
  }
}

function pageAccessLines (pageAccess: PageAccess): string[] {
  if (pageAccess.state === 'skipped') {
    return ['page_access=skipped']
  }

  return [
    `page_access=${pageAccess.state}`,
    `page_access_reason=${pageAccess.reason}`,
    ...pageIdentityLines(pageAccess)
  ]
}

function pageIdentityLines (pageAccess: PageAccess): string[] {
  return pageAccess.state === 'ok' ? [`page_identity=${pageAccess.identity}`] : []
}

const pageAccessReasons = new Set<PageAccessReason>([
  'missing_base_url',
  'missing_token',
  'invalid_base_url',
  'auth_rejected',
  'page_inaccessible',
  'transport_tls',
  'transport_dns',
  'transport_timeout',
  'transport_connection_reset',
  'transport_proxy',
  'converter_auth_incompatible'
])

function normalizePageAccessReason (reason: unknown): PageAccessReason {
  return typeof reason === 'string' && pageAccessReasons.has(reason as PageAccessReason)
    ? reason as PageAccessReason
    : 'page_inaccessible'
}

function determineNextActions (
  dependencyStates: DependencyState[],
  configuration: ConfigurationState,
  pageAccess: PageAccess['state']
): NextAction[] {
  const actions = new Set<NextAction>()
  const stateByLabel = new Map(dependencyStates.map(dependency => [dependency.label, dependency.state]))
  const nodeRuntimeState = stateByLabel.get('node_runtime')

  if (typeof nodeRuntimeState === 'string' && nodeRuntimeState.startsWith('unsupported:')) {
    actions.add('upgrade_node_runtime')
  }

  if (stateByLabel.get('markdown_converter') === 'absent') {
    actions.add('install_markdown_converter')
  }

  if (configuration === 'missing_base_url') {
    actions.add('set_confluence_base_url')
  }

  if (configuration === 'missing_token') {
    actions.add('set_confluence_token')
  }

  if (configuration === 'invalid_base_url') {
    actions.add('fix_confluence_base_url')
  }

  if (pageAccess === 'failed') {
    actions.add('check_page_access')
  }

  return nextActionOrder.filter(action => actions.has(action))
}

function defaultDependencyProbe (label: string, executable: string): DependencyState {
  return executableDependencyProbe(label, executable)
}
