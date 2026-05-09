import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { writeFileNoFollowAtomic } from '../output/filesystem-safety'
import { decodeStrictUtf8JsonObject, parseConfluexConfigObject, type ConfluexConfig } from './json-config'

export type UserConfig = ConfluexConfig
export type SetupUserConfig = {
  confluenceBaseUrl: string
  confluenceToken: string
}

export type LoadedUserConfig =
  | { state: 'ok', path: string, config: UserConfig }
  | { state: 'invalid', path: string }

export function userConfigPath (
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform
): string {
  if (platform === 'win32') {
    const base = nonEmpty(env.APPDATA)
    if (base === undefined) {
      throw new Error('missing APPDATA')
    }
    return path.win32.resolve(base, 'confluex', 'config.json')
  }

  const configRoot = nonEmpty(env.XDG_CONFIG_HOME) ?? path.join(homeDirectory(env), '.config')
  return path.resolve(configRoot, 'confluex', 'config.json')
}

export function loadUserConfig (env: NodeJS.ProcessEnv = process.env): LoadedUserConfig {
  const configPath = selectedUserConfigPath(env)
  if (configPath === null) {
    return {
      state: 'invalid',
      path: ''
    }
  }
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

  const decoded = decodeStrictUtf8JsonObject(bytes)
  const config = decoded === null ? null : parseConfluexConfigObject(decoded)
  if (config === null) {
    return {
      state: 'invalid',
      path: configPath
    }
  }
  return {
    state: 'ok',
    path: configPath,
    config
  }
}

export async function writeUserConfig (
  config: SetupUserConfig,
  env: NodeJS.ProcessEnv = process.env
): Promise<string> {
  const configPath = userConfigPath(env)
  await writeFileNoFollowAtomic(configPath, `${JSON.stringify(config, null, 2)}\n`, 0o600)
  return configPath
}

function homeDirectory (env: NodeJS.ProcessEnv): string {
  return nonEmpty(env.HOME) ?? os.homedir()
}

function selectedUserConfigPath (env: NodeJS.ProcessEnv): string | null {
  try {
    return userConfigPath(env)
  } catch {
    return null
  }
}

function nonEmpty (value: string | undefined): string | undefined {
  return value === undefined || value === '' ? undefined : value
}

function isNodeError (error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}
