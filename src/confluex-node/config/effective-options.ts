import { findCommand } from '../cli/registry'
import type { EffectiveOptions } from '../cli/validate'

export type EffectiveConfluenceConfig = {
  confluenceBaseUrl?: string
  confluenceToken?: string
}

export type EffectiveCommandOptions = EffectiveOptions & {
  config: EffectiveConfluenceConfig
}

export type EnvMap = NodeJS.ProcessEnv | Record<string, string | undefined>

const optionEnvironmentNames = new Map<string, string>([
  ['--out', 'CONFLUEX_OUTPUT_ROOT'],
  ['--log-file', 'CONFLUEX_LOG_FILE'],
  ['--max-pages', 'CONFLUEX_MAX_PAGES'],
  ['--max-download-mib', 'CONFLUEX_MAX_DOWNLOAD_MIB'],
  ['--sleep-ms', 'CONFLUEX_SLEEP_MS'],
  ['--max-find-candidates', 'CONFLUEX_MAX_FIND_CANDIDATES'],
  ['--link-depth', 'CONFLUEX_LINK_DEPTH']
])

export function buildEffectiveOptions (
  commandName: string,
  parsedOptions: EffectiveOptions,
  processEnv: EnvMap,
  envFileValues: Map<string, string>,
  userConfigValues: Map<string, string> = new Map()
): EffectiveCommandOptions {
  const values: Record<string, string> = { ...parsedOptions.values }
  const supportedOptions = supportedValueOptions(commandName)
  for (const [optionToken, environmentName] of optionEnvironmentNames) {
    if (!supportedOptions.has(optionToken)) {
      continue
    }

    if (values[optionToken] !== undefined) {
      continue
    }

    const value = selectedValue(environmentName, envFileValues, userConfigValues, processEnv)
    if (value !== undefined) {
      values[optionToken] = value
    }
  }

  const config: EffectiveConfluenceConfig = {}
  const confluenceBaseUrl = selectedValue('CONFLUEX_CONFLUENCE_BASE_URL', envFileValues, userConfigValues, processEnv)
  const confluenceToken = selectedValue('CONFLUEX_CONFLUENCE_TOKEN', envFileValues, userConfigValues, processEnv)
  if (confluenceBaseUrl !== undefined) {
    config.confluenceBaseUrl = confluenceBaseUrl
  }
  if (confluenceToken !== undefined) {
    config.confluenceToken = confluenceToken
  }

  return {
    flags: parsedOptions.flags.slice(),
    values,
    config
  }
}

function supportedValueOptions (commandName: string): Set<string> {
  const command = findCommand(commandName)
  if (command === null) {
    return new Set()
  }

  return new Set(
    command.options
      .filter(option => option.value !== undefined)
      .map(option => option.token)
  )
}

export function effectiveConfluenceEnv (
  options: { config?: EffectiveConfluenceConfig } | null | undefined,
  processEnv: EnvMap = process.env
): NodeJS.ProcessEnv {
  const config = options?.config
  const env: NodeJS.ProcessEnv = { ...processEnv }
  if (config === undefined) {
    return env
  }

  if (config.confluenceBaseUrl !== undefined) {
    env.CONFLUEX_CONFLUENCE_BASE_URL = config.confluenceBaseUrl
  }
  if (config.confluenceToken !== undefined) {
    env.CONFLUEX_CONFLUENCE_TOKEN = config.confluenceToken
  }
  return env
}

function selectedValue (
  name: string,
  envFileValues: Map<string, string>,
  userConfigValues: Map<string, string>,
  processEnv: EnvMap
): string | undefined {
  if (envFileValues.has(name)) {
    return envFileValues.get(name)
  }
  if (userConfigValues.has(name)) {
    return userConfigValues.get(name)
  }
  if (Object.prototype.hasOwnProperty.call(processEnv, name)) {
    return processEnv[name]
  }
  return undefined
}
