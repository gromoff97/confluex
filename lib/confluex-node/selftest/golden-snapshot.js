'use strict'

const fs = require('node:fs')
const path = require('node:path')

const TOP_LEVEL_TEMPLATES = [
  'summary.txt',
  'manifest.tsv',
  'resolved-links.tsv',
  'unresolved-links.tsv',
  'scope-findings.tsv',
  'failed-pages.tsv'
]

function compareGoldenSnapshot ({ reportRoot, expectedRoot, actualRoot }) {
  const failures = []

  try {
    const identities = readJsonObject(path.join(reportRoot, 'identities.json'))
    const expectedLogicalPages = new Set(sortedDirectoryNames(path.join(expectedRoot, 'pages')))
    const pageFolders = pageFoldersByLogicalName(path.join(actualRoot, 'manifest.tsv'), identities, expectedLogicalPages)
    const substitutions = createSubstitutions({ identities, pageFolders, actualRoot })

    compareTopLevelTextFiles({ expectedRoot, actualRoot, substitutions, failures })
    compareExpectedPages({ expectedRoot, actualRoot, pageFolders, substitutions, failures })
    compareExtraActualFiles({ expectedRoot, actualRoot, pageFolders, failures })
  } catch (error) {
    failures.push(`comparison error: ${error.message}`)
  }

  return failures.length === 0
    ? { state: 'passed', failures: [] }
    : { state: 'failed', failures }
}

function readJsonObject (absolutePath) {
  const value = JSON.parse(fs.readFileSync(absolutePath, 'utf8'))
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`json is not object: ${absolutePath}`)
  }
  return value
}

function pageFoldersByLogicalName (manifestPath, identities, expectedLogicalPages) {
  const lines = fs.readFileSync(manifestPath, 'utf8').trimEnd().split('\n')
  const header = lines.shift()
  if (header !== 'page_id\tspace_key\tpage_title\tfolder\tdiscovery_source\trun_mode\tattachment_count') {
    throw new Error('unexpected manifest header')
  }

  const logicalByPageId = new Map()
  for (const [logicalName, identity] of Object.entries(identities)) {
    if (expectedLogicalPages.has(logicalName) && identity && typeof identity.page_id === 'string') {
      logicalByPageId.set(identity.page_id, logicalName)
    }
  }

  const folders = new Map()
  for (const line of lines) {
    if (line.length === 0) {
      continue
    }

    const fields = line.split('\t')
    const logicalName = logicalByPageId.get(fields[0])
    if (logicalName !== undefined) {
      folders.set(logicalName, fields[3])
    }
  }
  return folders
}

function createSubstitutions ({ identities, pageFolders, actualRoot }) {
  return function substitute (value) {
    return value
      .replace(/<output-root>/g, actualRoot)
      .replace(/<page-id:([A-Za-z0-9_.-]+)>/g, (_match, logicalName) => {
        const identity = identities[logicalName]
        if (!identity || typeof identity.page_id !== 'string') {
          throw new Error(`unknown page placeholder: ${logicalName}`)
        }
        return identity.page_id
      })
      .replace(/<actual-folder:([A-Za-z0-9_.-]+)>/g, (_match, logicalName) => {
        const folder = pageFolders.get(logicalName)
        if (typeof folder !== 'string' || folder.length === 0) {
          throw new Error(`unknown folder placeholder: ${logicalName}`)
        }
        return folder
      })
  }
}

function compareTopLevelTextFiles ({ expectedRoot, actualRoot, substitutions, failures }) {
  for (const name of TOP_LEVEL_TEMPLATES) {
    compareTextTemplate({
      expectedPath: path.join(expectedRoot, `${name}.template`),
      actualPath: path.join(actualRoot, name),
      label: `${name}.template`,
      substitutions,
      failures
    })
  }
}

function compareTextTemplate ({ expectedPath, actualPath, label, substitutions, failures }) {
  if (!fs.existsSync(expectedPath)) {
    failures.push(`missing expected file: ${label}`)
    return
  }
  if (!fs.existsSync(actualPath)) {
    failures.push(`missing actual file: ${label}`)
    return
  }

  const actual = fs.readFileSync(actualPath, 'utf8')
  let expected = substitutions(fs.readFileSync(expectedPath, 'utf8'))
  if (label === 'summary.txt.template') {
    expected = substituteActualSummaryPlaceholders(expected, actual)
  }
  if (actual !== expected) {
    failures.push(`content mismatch: ${label}`)
  }
  if (label.endsWith('/page.md.template')) {
    failures.push(...markdownHygieneFailures(actual, label))
  }
}

function markdownHygieneFailures (content, label) {
  const failures = []
  const lines = content.split('\n')
  let blankRun = 0

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const lineNumber = index + 1

    if (/[ \t]+$/.test(line)) {
      failures.push(`markdown hygiene trailing whitespace: ${label}:${lineNumber}`)
    }
    if (/^[ \t]+$/.test(line)) {
      failures.push(`markdown hygiene whitespace-only line: ${label}:${lineNumber}`)
    }

    if (line.length === 0) {
      blankRun += 1
      if (blankRun > 2) {
        failures.push(`markdown hygiene excessive blank lines: ${label}:${lineNumber}`)
      }
    } else {
      blankRun = 0
    }
  }

  return failures
}

function substituteActualSummaryPlaceholders (expected, actual) {
  const values = summaryValues(actual)
  return expected.replace(/<actual-summary:(downloaded_mib_(?:total|content|metadata))>/g, (_match, key) => {
    const value = values.get(key)
    if (value === undefined) {
      throw new Error(`unknown actual summary placeholder: ${key}`)
    }
    return value
  })
}

function summaryValues (summaryText) {
  const values = new Map()
  for (const line of summaryText.trimEnd().split('\n')) {
    const index = line.indexOf('=')
    if (index !== -1) {
      values.set(line.slice(0, index), line.slice(index + 1))
    }
  }
  return values
}

function compareExpectedPages ({ expectedRoot, actualRoot, pageFolders, substitutions, failures }) {
  const expectedPagesRoot = path.join(expectedRoot, 'pages')
  for (const logicalName of sortedDirectoryNames(expectedPagesRoot)) {
    const folder = pageFolders.get(logicalName)
    if (folder === undefined) {
      failures.push(`missing actual page folder for logical page: ${logicalName}`)
      continue
    }

    compareTextTemplate({
      expectedPath: path.join(expectedPagesRoot, logicalName, 'page.md.template'),
      actualPath: path.join(actualRoot, folder, 'page.md'),
      label: `pages/${logicalName}/page.md.template`,
      substitutions,
      failures
    })

    compareExpectedAttachments({
      expectedPageRoot: path.join(expectedPagesRoot, logicalName),
      actualPageRoot: path.join(actualRoot, folder),
      logicalName,
      failures
    })
  }
}

function compareExpectedAttachments ({ expectedPageRoot, actualPageRoot, logicalName, failures }) {
  const expectedAttachmentsRoot = path.join(expectedPageRoot, 'attachments')
  const actualAttachmentsRoot = path.join(actualPageRoot, 'attachments')
  const expectedFiles = regularRelativeFiles(expectedAttachmentsRoot)
  const actualFiles = regularRelativeFiles(actualAttachmentsRoot)

  for (const relativePath of expectedFiles) {
    const expected = fs.readFileSync(path.join(expectedAttachmentsRoot, relativePath))
    const actualPath = path.join(actualAttachmentsRoot, relativePath)
    if (!fs.existsSync(actualPath)) {
      failures.push(`missing attachment: pages/${logicalName}/attachments/${relativePath}`)
      continue
    }
    const actual = fs.readFileSync(actualPath)
    if (Buffer.compare(actual, expected) !== 0) {
      failures.push(`attachment mismatch: pages/${logicalName}/attachments/${relativePath}`)
    }
  }

  for (const relativePath of actualFiles) {
    if (!expectedFiles.includes(relativePath)) {
      failures.push(`extra attachment: pages/${logicalName}/attachments/${relativePath}`)
    }
  }
}

function compareExtraActualFiles ({ expectedRoot, actualRoot, pageFolders, failures }) {
  const allowed = new Set()
  const expectedPagesRoot = path.join(expectedRoot, 'pages')
  for (const logicalName of sortedDirectoryNames(expectedPagesRoot)) {
    const folder = pageFolders.get(logicalName)
    if (folder === undefined) {
      continue
    }

    allowed.add(`${folder}/page.md`)
    for (const relativePath of regularRelativeFiles(path.join(expectedPagesRoot, logicalName, 'attachments'))) {
      allowed.add(`${folder}/attachments/${relativePath}`)
    }
  }

  const actualPagesRoot = path.join(actualRoot, 'pages')
  for (const relativePath of regularRelativeFiles(actualPagesRoot)) {
    const actualRelativePath = `pages/${relativePath}`
    if (!allowed.has(actualRelativePath)) {
      failures.push(`extra file: ${actualRelativePath}`)
    }
  }
}

function sortedDirectoryNames (directory) {
  if (!fs.existsSync(directory)) {
    return []
  }

  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

function regularRelativeFiles (directory) {
  if (!fs.existsSync(directory)) {
    return []
  }

  const files = []
  visitFiles(directory, '', files)
  return files.sort()
}

function visitFiles (root, prefix, files) {
  for (const entry of fs.readdirSync(path.join(root, prefix), { withFileTypes: true })) {
    const relativePath = prefix.length === 0 ? entry.name : `${prefix}/${entry.name}`
    if (entry.isDirectory()) {
      visitFiles(root, relativePath, files)
    } else if (entry.isFile()) {
      files.push(relativePath)
    }
  }
}

module.exports = {
  compareGoldenSnapshot
}
