import { stdin } from 'node:process'

import { readHiddenLine, readVisibleLine } from '../terminal/hidden-input'
import { checkNodeVersion, executableDependencyProbe } from '../prereq/checks'
import { checkCurrentUserAccess, type RemoteOperationFailureReason } from '../remote/access'
import { writeUserConfig } from '../config/user-config'

type CommandResult = {
  exitCode: number
  stdout: string
  stderr: string
}

type SetupFailureReason =
  | 'unsupported_node_runtime'
  | 'missing_markdown_converter'
  | 'invalid_base_url'
  | 'missing_token'
  | 'auth_rejected'
  | 'page_inaccessible'
  | 'transport_dns'
  | 'transport_tls'
  | 'transport_timeout'
  | 'transport_connection_reset'
  | 'transport_proxy'
  | 'hidden_input_unavailable'

type SetupStreams = {
  stdout: NodeJS.WritableStream
}

type SetupDependencies = {
  env?: NodeJS.ProcessEnv
  stdin?: NodeJS.ReadableStream
  nodeVersion?: string
}

export async function runSetupCommand (
  streams: SetupStreams,
  dependencies: SetupDependencies = {}
): Promise<CommandResult> {
  try {
    const input = dependencies.stdin ?? stdin
    const baseUrl = await readVisibleLine('Confluence base URL: ', input, streams.stdout)
    const token = await readHiddenLine('Confluence token: ', input, streams.stdout)
    const env = dependencies.env ?? process.env
    const dependencyFailure = validateSetupDependencies(env, dependencies.nodeVersion)
    if (dependencyFailure !== null) {
      return setupFailure(dependencyFailure)
    }

    const connectionEnv: NodeJS.ProcessEnv = {
      ...env,
      CONFLUEX_CONFLUENCE_BASE_URL: baseUrl,
      CONFLUEX_CONFLUENCE_TOKEN: token
    }
    const connection = await checkCurrentUserAccess(connectionEnv, { insecure: false })
    if (connection.state === 'failed') {
      return setupFailure(setupReason(connection.reason))
    }

    const configPath = writeUserConfig({
      confluenceBaseUrl: connection.baseUrl,
      confluenceToken: token
    }, env)

    return {
      exitCode: 0,
      stdout: `setup_result=passed\nconfig_path=${configPath}\n`,
      stderr: ''
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'interrupted') {
      return {
        exitCode: 130,
        stdout: '',
        stderr: ''
      }
    }
    if (error instanceof Error && error.message === 'hidden_input_unavailable') {
      return setupFailure('hidden_input_unavailable')
    }
    return {
      exitCode: 4,
      stdout: '',
      stderr: 'ERROR: runtime_failure setup\n'
    }
  }
}

function validateSetupDependencies (
  env: NodeJS.ProcessEnv,
  nodeVersion: string = process.versions.node
): SetupFailureReason | null {
  if (checkNodeVersion(nodeVersion).state !== 'passed') {
    return 'unsupported_node_runtime'
  }

  if (executableDependencyProbe('markdown_converter', 'uvx', env).state === 'absent') {
    return 'missing_markdown_converter'
  }

  return null
}

function setupReason (reason: RemoteOperationFailureReason): SetupFailureReason {
  if (reason === 'missing_base_url' || reason === 'invalid_base_url') {
    return 'invalid_base_url'
  }
  return reason
}

function setupFailure (reason: SetupFailureReason): CommandResult {
  return {
    exitCode: 1,
    stdout: '',
    stderr: `ERROR: setup_failed ${reason}\n`
  }
}
