import { formatDiagnostic, type Diagnostic } from './diagnostics'
import { parseInvocation } from './parse'
import { buildEffectiveOptions, type EffectiveCommandOptions } from '../config/effective-options'
import { loadConfigurationSelection } from '../config/selection'

export type InvocationGateResult =
  | { state: 'accepted', request: InvocationRequest }
  | { state: 'rejected', exitCode: number, stderr: string }

export type InvocationRequest = {
  command: string
  options: EffectiveCommandOptions
  cwd: string
}

export async function acceptInvocation (
  argv: string[],
  env: NodeJS.ProcessEnv,
  cwd: string
): Promise<InvocationGateResult> {
  const preliminary = parseInvocation(argv, {}, { deferResumeOutputRootRequirement: true })
  if (preliminary.kind === 'rejected') {
    return rejected(preliminary.diagnostic)
  }
  if (preliminary.kind !== 'command') {
    return {
      state: 'accepted',
      request: {
        command: preliminary.kind,
        options: { flags: [], values: {}, config: {} },
        cwd
      }
    }
  }

  const context = loadConfigurationSelection(preliminary, cwd, env)
  if (context.diagnostic !== null) {
    return rejected(context.diagnostic)
  }

  const parsed = parseInvocation(argv, context.defaultValues)
  if (parsed.kind === 'rejected') {
    return rejected(parsed.diagnostic)
  }
  if (parsed.kind !== 'command') {
    return {
      state: 'accepted',
      request: {
        command: parsed.kind,
        options: { flags: [], values: {}, config: {} },
        cwd
      }
    }
  }

  return {
    state: 'accepted',
    request: {
      command: parsed.command,
      options: buildEffectiveOptions(parsed.command, parsed.options, env, context.explicitConfig, context.userConfig),
      cwd
    }
  }
}

function rejected (diagnostic: Diagnostic): InvocationGateResult {
  return {
    state: 'rejected',
    exitCode: 1,
    stderr: `${formatDiagnostic(diagnostic)}\n`
  }
}
