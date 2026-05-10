export type AcceptedRunFailureKind = 'report' | 'artifact' | 'zip' | 'debug_artifact' | 'remote' | 'signal'
export type RuntimeBranch = 'rejected' | 'completed' | 'incomplete' | 'interrupted'
export type PartialReportEligibility = 'not_applicable' | 'eligible' | 'blocked'
export type RetainedCleanupAction = 'none' | 'remove_temp' | 'mark_incomplete'
export type RetainedAuthority = 'authoritative' | 'incomplete' | 'non_authoritative'

export type RuntimeFailureBranch = {
  branch: RuntimeBranch
  failureKind: AcceptedRunFailureKind
  partialReportEligibility: PartialReportEligibility
  retainedAuthority: RetainedAuthority
  cleanup: RetainedCleanupAction
}

export type CliOutcome = {
  exitCode: number
  stdout: string
  stderr: string
}

let acceptedRunDepth = 0

export function beginAcceptedRun (): void {
  acceptedRunDepth += 1
}

export function endAcceptedRun (): void {
  acceptedRunDepth = Math.max(0, acceptedRunDepth - 1)
}

export function isAcceptedRunActive (): boolean {
  return acceptedRunDepth > 0
}

export function runtimeFailureOutcome (kind: AcceptedRunFailureKind, context: { command: 'export' | 'setup' }): CliOutcome {
  if (context.command === 'setup') {
    return {
      exitCode: 4,
      stdout: '',
      stderr: 'ERROR: runtime_failure setup\n'
    }
  }

  return {
    exitCode: 4,
    stdout: '',
    stderr: `ERROR: runtime_failure ${runtimeFailureToken(kind)}\n`
  }
}

export function acceptedRuntimeFailureBranch (
  failureKind: Exclude<AcceptedRunFailureKind, 'signal'>,
  policy: Pick<RuntimeFailureBranch, 'partialReportEligibility' | 'retainedAuthority' | 'cleanup'>
): RuntimeFailureBranch {
  return {
    branch: policy.retainedAuthority === 'authoritative' ? 'completed' : 'incomplete',
    failureKind,
    partialReportEligibility: policy.partialReportEligibility,
    retainedAuthority: policy.retainedAuthority,
    cleanup: policy.cleanup
  }
}

export function signalInterruptionBranch (
  policy: Pick<RuntimeFailureBranch, 'partialReportEligibility' | 'retainedAuthority' | 'cleanup'>
): RuntimeFailureBranch {
  return {
    branch: 'interrupted',
    failureKind: 'signal',
    partialReportEligibility: policy.partialReportEligibility,
    retainedAuthority: policy.retainedAuthority,
    cleanup: policy.cleanup
  }
}

export function signalInterruptedOutcome (): CliOutcome {
  return {
    exitCode: 130,
    stdout: '',
    stderr: ''
  }
}

function runtimeFailureToken (kind: AcceptedRunFailureKind): string {
  switch (kind) {
    case 'report':
      return 'report_synthesis'
    case 'zip':
      return 'zip_archive'
    case 'artifact':
      return 'artifact'
    case 'debug_artifact':
      return 'debug_artifact'
    case 'remote':
      return 'remote'
    case 'signal':
      return 'signal'
  }
}
