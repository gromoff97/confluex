import { findCommand } from '../cli/registry'
import type { EffectiveOptions } from '../cli/validate'
import type { ConfluexConfig } from './json-config'

export type EffectiveConfluenceConfig = ConfluexConfig

export type EffectiveCommandOptions = EffectiveOptions & {
  config: EffectiveConfluenceConfig
}

export type EnvMap = NodeJS.ProcessEnv | Record<string, string | undefined>

const configOptionNames = new Map<string, keyof ConfluexConfig>([
  ['--out', 'outputRoot'],
  ['--max-pages', 'maxPages'],
  ['--max-download-mib', 'maxDownloadMib'],
  ['--sleep-ms', 'sleepMs'],
  ['--max-find-candidates', 'maxFindCandidates'],
  ['--link-depth', 'linkDepth']
])

export function buildEffectiveOptions (
  commandName: string,
  parsedOptions: EffectiveOptions,
  processEnv: EnvMap,
  explicitConfig: ConfluexConfig = {},
  userConfig: ConfluexConfig = {}
): EffectiveCommandOptions {
  const values: Record<string, string> = { ...parsedOptions.values }
  const supportedOptions = supportedValueOptions(commandName)
  let configuredOutputRoot: string | undefined
  for (const [optionToken, configName] of configOptionNames) {
    if (!supportedOptions.has(optionToken)) {
      continue
    }

    if (values[optionToken] !== undefined) {
      continue
    }

    const value = selectedConfigValue(configName, explicitConfig, userConfig)
    if (value !== undefined) {
      values[optionToken] = String(value)
      if (optionToken === '--out') {
        configuredOutputRoot = String(value)
      }
    }
  }

  const config: EffectiveConfluenceConfig = {}
  const confluenceBaseUrl = selectedStringConfigValue(
    'confluenceBaseUrl',
    explicitConfig,
    userConfig,
    processEnv,
    'CONFLUEX_CONFLUENCE_BASE_URL'
  )
  const confluenceToken = selectedStringConfigValue(
    'confluenceToken',
    explicitConfig,
    userConfig,
    processEnv,
    'CONFLUEX_CONFLUENCE_TOKEN'
  )
  const insecure = selectedConfigValue('insecure', explicitConfig, userConfig)
  if (confluenceBaseUrl !== undefined) {
    config.confluenceBaseUrl = confluenceBaseUrl
  }
  if (confluenceToken !== undefined) {
    config.confluenceToken = confluenceToken
  }
  if (insecure !== undefined) {
    config.insecure = insecure
  }
  if (configuredOutputRoot !== undefined) {
    config.outputRoot = configuredOutputRoot
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
  processEnv: EnvMap
): string | undefined {
  if (Object.prototype.hasOwnProperty.call(processEnv, name)) {
    return processEnv[name]
  }
  return undefined
}

function selectedStringConfigValue (
  configName: keyof ConfluexConfig,
  explicitConfig: ConfluexConfig,
  userConfig: ConfluexConfig,
  processEnv: EnvMap,
  environmentName: string
): string | undefined {
  const configValue = selectedConfigValue(configName, explicitConfig, userConfig)
  if (typeof configValue === 'string') {
    return configValue
  }
  return selectedValue(environmentName, processEnv)
}

function selectedConfigValue<K extends keyof ConfluexConfig> (
  configName: K,
  explicitConfig: ConfluexConfig,
  userConfig: ConfluexConfig
): ConfluexConfig[K] | undefined {
  const explicitValue = explicitConfig[configName]
  if (explicitValue !== undefined) {
    return explicitValue
  }
  return userConfig[configName]
}
