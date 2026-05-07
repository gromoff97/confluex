'use strict'

const { findCommand } = require('../cli/registry')

const optionEnvironmentNames = new Map([
  ['--page-id', 'CONFLUEX_PAGE_ID'],
  ['--out', 'CONFLUEX_OUT'],
  ['--log-file', 'CONFLUEX_LOG_FILE'],
  ['--max-pages', 'CONFLUEX_MAX_PAGES'],
  ['--max-download-mib', 'CONFLUEX_MAX_DOWNLOAD_MIB'],
  ['--sleep-ms', 'CONFLUEX_SLEEP_MS'],
  ['--max-find-candidates', 'CONFLUEX_MAX_FIND_CANDIDATES'],
  ['--link-depth', 'CONFLUEX_LINK_DEPTH']
])

function buildEffectiveOptions (commandName, parsedOptions, processEnv, envFileValues) {
  const values = Object.assign({}, parsedOptions.values)
  const supportedOptions = supportedValueOptions(commandName)
  for (const [optionToken, environmentName] of optionEnvironmentNames) {
    if (!supportedOptions.has(optionToken)) {
      continue
    }

    if (values[optionToken] !== undefined) {
      continue
    }

    const value = selectedValue(environmentName, envFileValues, processEnv)
    if (value !== undefined) {
      values[optionToken] = value
    }
  }

  return {
    flags: parsedOptions.flags.slice(),
    values,
    config: {
      confluenceBaseUrl: selectedValue('CONFLUEX_CONFLUENCE_BASE_URL', envFileValues, processEnv),
      confluenceToken: selectedValue('CONFLUEX_CONFLUENCE_TOKEN', envFileValues, processEnv)
    }
  }
}

function supportedValueOptions (commandName) {
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

function effectiveConfluenceEnv (options, processEnv = process.env) {
  const config = options === null || options === undefined ? undefined : options.config
  const env = Object.assign({}, processEnv)
  if (config === null || config === undefined) {
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

function selectedValue (name, envFileValues, processEnv) {
  if (envFileValues instanceof Map && envFileValues.has(name)) {
    return envFileValues.get(name)
  }
  if (Object.prototype.hasOwnProperty.call(processEnv, name)) {
    return processEnv[name]
  }
  return undefined
}

module.exports = {
  buildEffectiveOptions,
  effectiveConfluenceEnv
}
