import type { Diagnostic } from '../cli/diagnostics'
import type { ParseResult } from '../cli/parse'
import { buildEffectiveOptions } from './effective-options'
import { loadExplicitJsonConfig, type ConfluexConfig } from './json-config'
import { loadUserConfig } from './user-config'

type CommandParseResult = Extract<ParseResult, { kind: 'command' }>

export type ConfigurationSelection = {
  explicitConfig: ConfluexConfig
  userConfig: ConfluexConfig
  defaultValues: Record<string, string>
  diagnostic: Diagnostic | null
}

export function loadConfigurationSelection (
  parsed: CommandParseResult,
  cwd: string,
  env: NodeJS.ProcessEnv
): ConfigurationSelection {
  const empty: ConfigurationSelection = {
    explicitConfig: {},
    userConfig: {},
    defaultValues: {},
    diagnostic: null
  }

  if (parsed.command !== 'export') {
    return empty
  }

  const explicitConfigPath = parsed.options.values['--config']
  let explicitConfig: ConfluexConfig = {}
  if (explicitConfigPath !== undefined) {
    const loadedExplicitConfig = loadExplicitJsonConfig(cwd, explicitConfigPath)
    if (loadedExplicitConfig.state !== 'ok') {
      return {
        explicitConfig: {},
        userConfig: {},
        defaultValues: {},
        diagnostic: {
          type: 'validation-failed',
          requirementId: loadedExplicitConfig.state === 'absent' ? 'FR-0219' : 'FR-0246'
        }
      }
    }
    explicitConfig = loadedExplicitConfig.config
  }

  const loadedUserConfig = loadUserConfig(env)
  if (loadedUserConfig.state === 'invalid') {
    return {
      explicitConfig,
      userConfig: {},
      defaultValues: {},
      diagnostic: {
        type: 'validation-failed',
        requirementId: 'FR-0246'
      }
    }
  }

  const defaults = buildEffectiveOptions(parsed.command, {
    flags: [],
    values: {}
  }, env, explicitConfig, loadedUserConfig.config)

  return {
    explicitConfig,
    userConfig: loadedUserConfig.config,
    defaultValues: defaults.values,
    diagnostic: null
  }
}
