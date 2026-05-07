'use strict'

const { formatDiagnostic } = require('../cli/diagnostics')
const { effectiveConfluenceEnv } = require('../config/effective-options')
const { preparePersistentLog, writePersistentLog } = require('../output/log-file')
const { executableDependencyProbe, nodeRuntimeDependency } = require('../prereq/checks')
const { checkRootPageAccess, resolveRemoteAccessContext } = require('../remote/access')

const dependencies = [
  ['markdown_converter', 'uvx']
]

const supportedLinkForms = [
  'child_result',
  'content_id',
  'page_ref',
  'macro_param',
  'href_page_id',
  'href_space_title',
  'ri_url_page_id',
  'ri_url_space_title'
]

const nextActionOrder = [
  'upgrade_node_runtime',
  'install_markdown_converter',
  'set_confluence_base_url',
  'set_confluence_token',
  'fix_confluence_base_url',
  'check_page_access'
]

async function runDoctorCommand (options, commandDependencies = {}) {
  const dependencyProbe = commandDependencies.dependencyProbe || defaultDependencyProbe
  const pageAccessChecker = commandDependencies.pageAccessChecker || checkRootPageAccess
  const env = effectiveConfluenceEnv(options, commandDependencies.env || process.env)
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
      nodeRuntimeDependency(commandDependencies.nodeVersion || process.version),
      ...dependencies.map(([label, executable]) => dependencyProbe(label, executable))
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

function determineConfiguration (env) {
  const context = resolveRemoteAccessContext(env)
  return context.usable ? 'ok' : context.reason
}

async function determinePageAccess (options, pageAccessChecker, env) {
  if (!Object.prototype.hasOwnProperty.call(options.values, '--page-id')) {
    return { state: 'skipped' }
  }

  const result = await pageAccessChecker(options.values['--page-id'], env)
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

function pageAccessLines (pageAccess) {
  if (pageAccess.state === 'skipped') {
    return ['page_access=skipped']
  }

  return [
    `page_access=${pageAccess.state}`,
    `page_access_reason=${pageAccess.reason}`,
    ...pageIdentityLines(pageAccess)
  ]
}

function pageIdentityLines (pageAccess) {
  return pageAccess.state === 'ok' ? [`page_identity=${pageAccess.identity}`] : []
}

const pageAccessReasons = new Set([
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

function normalizePageAccessReason (reason) {
  return pageAccessReasons.has(reason) ? reason : 'page_inaccessible'
}

function determineNextActions (dependencyStates, configuration, pageAccess) {
  const actions = new Set()
  const stateByLabel = new Map(dependencyStates.map(dependency => [dependency.label, dependency.state]))

  if (typeof stateByLabel.get('node_runtime') === 'string' && stateByLabel.get('node_runtime').startsWith('unsupported:')) {
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

function defaultDependencyProbe (label, executable) {
  return executableDependencyProbe(label, executable)
}

module.exports = {
  runDoctorCommand
}
