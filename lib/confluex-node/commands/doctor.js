'use strict'

const { spawnSync } = require('node:child_process')

const { formatDiagnostic } = require('../cli/diagnostics')
const { effectiveConfluenceEnv } = require('../config/effective-options')
const { createConfigStore } = require('../config/store')
const { preparePersistentLog, writePersistentLog } = require('../output/log-file')
const { executableDependencyProbe, nodeRuntimeDependency } = require('../prereq/checks')
const { checkRootPageAccess } = require('../remote/access')

const dependencies = [
  ['docker_cli', 'docker'],
  ['gpg', 'gpg'],
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
  'install_docker_cli',
  'install_gpg',
  'install_markdown_converter',
  'check_page_access',
  'set_encryption_key',
  'fix_encryption_key'
]

async function runDoctorCommand (options, commandDependencies = {}) {
  const store = commandDependencies.store || createConfigStore()
  const dependencyProbe = commandDependencies.dependencyProbe || defaultDependencyProbe
  const recipientValidator = commandDependencies.recipientValidator || defaultRecipientValidator
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
    const pageAccess = await determinePageAccess(options, pageAccessChecker, env)
    const encryptionRecipient = determineEncryptionRecipient(options, store, recipientValidator)
    const nextActions = determineNextActions(dependencyStates, pageAccess.state, encryptionRecipient)
    const stdout = [
      ...dependencyStates.map(dependency => `dependency_${dependency.label}=${dependency.state}`),
      ...pageAccessLines(pageAccess),
      `encryption_recipient=${encryptionRecipient}`,
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
  'missing_token',
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

function determineEncryptionRecipient (options, store, recipientValidator) {
  if (!options.flags.includes('--verify-encryption')) {
    return 'skipped'
  }

  const recipient = Object.prototype.hasOwnProperty.call(options.values, '--encryption-key')
    ? options.values['--encryption-key']
    : store.readDefaultEncryptionKey()

  if (recipient === null) {
    return 'missing'
  }

  return recipientValidator(recipient) ? 'ok' : 'failed'
}

function determineNextActions (dependencyStates, pageAccess, encryptionRecipient) {
  const actions = new Set()
  const stateByLabel = new Map(dependencyStates.map(dependency => [dependency.label, dependency.state]))

  if (stateByLabel.get('docker_cli') === 'absent') {
    actions.add('install_docker_cli')
  }

  if (stateByLabel.get('gpg') === 'absent') {
    actions.add('install_gpg')
  }

  if (stateByLabel.get('markdown_converter') === 'absent') {
    actions.add('install_markdown_converter')
  }

  if (pageAccess === 'failed') {
    actions.add('check_page_access')
  }

  if (encryptionRecipient === 'missing') {
    actions.add('set_encryption_key')
  }

  if (encryptionRecipient === 'failed' && stateByLabel.get('gpg') !== 'absent') {
    actions.add('fix_encryption_key')
  }

  return nextActionOrder.filter(action => actions.has(action))
}

function defaultDependencyProbe (label, executable) {
  return executableDependencyProbe(label, executable)
}

function defaultRecipientValidator (recipient) {
  const result = spawnSync('gpg', ['--list-keys', '--with-colons', recipient], {
    encoding: 'buffer'
  })

  return result.status === 0
}

module.exports = {
  runDoctorCommand
}
