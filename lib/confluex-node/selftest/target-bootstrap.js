'use strict'

const { createSelftestConfluenceClient } = require('./confluence-client')

async function bootstrapSelftestTarget (target, dependencies = {}) {
  const client = dependencies.client || createSelftestConfluenceClient(target)

  try {
    const spaces = await client.readSpaces({ limit: 1 })
    if (!Array.isArray(spaces) || spaces.length !== 0) {
      return { state: 'failed' }
    }

    return { state: 'passed' }
  } catch {
    return { state: 'failed' }
  }
}

module.exports = {
  bootstrapSelftestTarget
}
