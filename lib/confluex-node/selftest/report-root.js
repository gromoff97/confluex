'use strict'

const fs = require('node:fs')
const path = require('node:path')

function createSelftestReportRoot (dependencies = {}) {
  const cwd = path.resolve(dependencies.cwd || process.cwd())
  const baseName = `confluex_selftest_${formatUtcTimestamp(dependencies.now || new Date())}`

  for (let suffix = 0; suffix < Number.MAX_SAFE_INTEGER; suffix += 1) {
    const candidateName = suffix === 0 ? baseName : `${baseName}_${suffix}`
    const reportRoot = path.join(cwd, candidateName)

    try {
      fs.mkdirSync(reportRoot)
      return {
        state: 'ok',
        reportRoot
      }
    } catch (error) {
      if (!error || error.code !== 'EEXIST') {
        return { state: 'failed' }
      }
    }
  }

  return { state: 'failed' }
}

function formatUtcTimestamp (date) {
  return [
    date.getUTCFullYear().toString().padStart(4, '0'),
    (date.getUTCMonth() + 1).toString().padStart(2, '0'),
    date.getUTCDate().toString().padStart(2, '0'),
    'T',
    date.getUTCHours().toString().padStart(2, '0'),
    date.getUTCMinutes().toString().padStart(2, '0'),
    date.getUTCSeconds().toString().padStart(2, '0'),
    'Z'
  ].join('')
}

module.exports = {
  createSelftestReportRoot
}
