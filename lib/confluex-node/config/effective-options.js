'use strict'

const optionEnvironmentNames = new Map([
  ['--page-id', 'CONFLUEX_PAGE_ID'],
  ['--out', 'CONFLUEX_OUT'],
  ['--log-file', 'CONFLUEX_LOG_FILE'],
  ['--encryption-key', 'CONFLUEX_ENCRYPTION_KEY'],
  ['--max-pages', 'CONFLUEX_MAX_PAGES'],
  ['--max-download-mib', 'CONFLUEX_MAX_DOWNLOAD_MIB'],
  ['--sleep-ms', 'CONFLUEX_SLEEP_MS'],
  ['--max-find-candidates', 'CONFLUEX_MAX_FIND_CANDIDATES'],
  ['--link-depth', 'CONFLUEX_LINK_DEPTH'],
  ['--url', 'CONFLUEX_SELFTEST_CONFLUENCE_BASE_URL'],
  ['--token', 'CONFLUEX_SELFTEST_CONFLUENCE_TOKEN']
])

function buildEffectiveOptions (commandName, parsedOptions, processEnv, envFileValues) {
  const values = Object.assign({}, parsedOptions.values)
  for (const [optionToken, environmentName] of optionEnvironmentNames) {
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
  buildEffectiveOptions
}
