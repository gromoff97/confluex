export type OutputRootProvenance = 'explicit' | 'configured' | 'generated'

export type ConfigurationSession = {
  values: Record<string, string>
  outputRootProvenance: OutputRootProvenance
  userConfigPath: string | null
  secrets: readonly string[]
}

const configOptionNames = new Map<string, string>([
  ['--out', 'outputRoot'],
  ['--max-pages', 'maxPages'],
  ['--max-download-mib', 'maxDownloadMib'],
  ['--sleep-ms', 'sleepMs'],
  ['--max-find-candidates', 'maxFindCandidates'],
  ['--link-depth', 'linkDepth']
])

export function buildConfigurationSession (input: {
  argvValues: Record<string, string>
  explicitConfig: Record<string, unknown>
  userConfig: Record<string, unknown>
  env: NodeJS.ProcessEnv
}): ConfigurationSession {
  const values: Record<string, string> = { ...input.argvValues }
  for (const [optionToken, configName] of configOptionNames) {
    if (values[optionToken] !== undefined) {
      continue
    }
    const value = selectedConfigValue(configName, input.explicitConfig, input.userConfig)
    if (value !== undefined) {
      values[optionToken] = String(value)
    }
  }

  return {
    values,
    outputRootProvenance: outputRootProvenance(input.argvValues, values),
    userConfigPath: null,
    secrets: selectedSecrets(input.explicitConfig, input.userConfig, input.env)
  }
}

function outputRootProvenance (
  argvValues: Record<string, string>,
  values: Record<string, string>
): OutputRootProvenance {
  if (argvValues['--out'] !== undefined) {
    return 'explicit'
  }
  if (values['--out'] !== undefined) {
    return 'configured'
  }
  return 'generated'
}

function selectedSecrets (
  explicitConfig: Record<string, unknown>,
  userConfig: Record<string, unknown>,
  env: NodeJS.ProcessEnv
): readonly string[] {
  const token = selectedConfigValue('confluenceToken', explicitConfig, userConfig) ?? env.CONFLUEX_CONFLUENCE_TOKEN
  return typeof token === 'string' && token.length > 0 ? [token] : []
}

function selectedConfigValue (
  name: string,
  explicitConfig: Record<string, unknown>,
  userConfig: Record<string, unknown>
): unknown {
  const explicitValue = explicitConfig[name]
  if (explicitValue !== undefined) {
    return explicitValue
  }
  return userConfig[name]
}
