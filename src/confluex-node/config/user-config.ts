import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export type UserConfig = {
  confluenceBaseUrl?: string
  confluenceToken?: string
}

export type LoadedUserConfig =
  | { state: 'ok', path: string, config: UserConfig }
  | { state: 'invalid', path: string }

const userConfigKeys = new Set(['confluenceBaseUrl', 'confluenceToken'])

export function userConfigPath (
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform
): string {
  if (platform === 'win32') {
    const base = nonEmpty(env.APPDATA) ?? path.join(homeDirectory(env), 'AppData', 'Roaming')
    return path.join(base, 'confluex', 'config.json')
  }

  const configRoot = nonEmpty(env.XDG_CONFIG_HOME) ?? path.join(homeDirectory(env), '.config')
  return path.join(configRoot, 'confluex', 'config.json')
}

export function loadUserConfig (env: NodeJS.ProcessEnv = process.env): LoadedUserConfig {
  const configPath = userConfigPath(env)
  let bytes: Buffer

  try {
    bytes = fs.readFileSync(configPath)
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return {
        state: 'ok',
        path: configPath,
        config: {}
      }
    }
    return {
      state: 'invalid',
      path: configPath
    }
  }

  try {
    const parsed = JSON.parse(bytes.toString('utf8')) as unknown
    if (!isRecord(parsed)) {
      return { state: 'invalid', path: configPath }
    }

    const config: UserConfig = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (!userConfigKeys.has(key) || typeof value !== 'string') {
        return { state: 'invalid', path: configPath }
      }
      if (key === 'confluenceBaseUrl') {
        config.confluenceBaseUrl = value
      } else if (key === 'confluenceToken') {
        config.confluenceToken = value
      }
    }

    return {
      state: 'ok',
      path: configPath,
      config
    }
  } catch {
    return {
      state: 'invalid',
      path: configPath
    }
  }
}

export function userConfigEnvironmentValues (config: UserConfig): Map<string, string> {
  const values = new Map<string, string>()
  if (config.confluenceBaseUrl !== undefined) {
    values.set('CONFLUEX_CONFLUENCE_BASE_URL', config.confluenceBaseUrl)
  }
  if (config.confluenceToken !== undefined) {
    values.set('CONFLUEX_CONFLUENCE_TOKEN', config.confluenceToken)
  }
  return values
}

export function writeUserConfig (
  config: Required<UserConfig>,
  env: NodeJS.ProcessEnv = process.env
): string {
  const configPath = userConfigPath(env)
  fs.mkdirSync(path.dirname(configPath), {
    recursive: true,
    mode: 0o700
  })
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600
  })
  try {
    fs.chmodSync(configPath, 0o600)
  } catch {
    // POSIX modes are best-effort on platforms that do not support chmod.
  }
  return configPath
}

function homeDirectory (env: NodeJS.ProcessEnv): string {
  return nonEmpty(env.HOME) ?? os.homedir()
}

function nonEmpty (value: string | undefined): string | undefined {
  return value === undefined || value === '' ? undefined : value
}

function isRecord (value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isNodeError (error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}
