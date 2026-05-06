'use strict'

const fs = require('node:fs')
const path = require('node:path')

function loadFixtureBundle (runtimeRoot) {
  const contentRoot = path.join(path.resolve(runtimeRoot), 'fixtures/confluence-7137/content')
  const manifest = readJsonObject(path.join(contentRoot, 'manifest.json'))
  const spaces = normalizeSpaces(manifest.spaces || [])
  const pages = normalizePages(manifest.pages || [], spaces, contentRoot)
  const attachments = normalizeAttachments(manifest.attachments || [], pages, contentRoot)
  validatePageAttachmentReferences(pages, attachments)

  return {
    contentRoot,
    spaces,
    pages,
    attachments
  }
}

function readJsonObject (filePath) {
  const value = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('fixture manifest is not object')
  }

  return value
}

function normalizeSpaces (records) {
  if (!Array.isArray(records)) {
    throw new Error('fixture spaces must be array')
  }

  const seen = new Set()
  return records.map((record) => {
    const logicalName = requireNonEmptyString(record, 'logical_name')
    if (seen.has(logicalName)) {
      throw new Error(`duplicate fixture space: ${logicalName}`)
    }
    seen.add(logicalName)
    return {
      logicalName,
      spaceKey: requireNonEmptyString(record, 'key'),
      spaceName: requireNonEmptyString(record, 'name')
    }
  })
}

function normalizePages (records, spaces, contentRoot) {
  if (!Array.isArray(records)) {
    throw new Error('fixture pages must be array')
  }

  const knownSpaces = new Set(spaces.map((space) => space.logicalName))
  const seen = new Set()
  const pages = records.map((record) => {
    const logicalName = requireNonEmptyString(record, 'logical_name')
    if (seen.has(logicalName)) {
      throw new Error(`duplicate fixture page: ${logicalName}`)
    }
    seen.add(logicalName)

    const spaceLogicalName = requireNonEmptyString(record, 'space')
    if (!knownSpaces.has(spaceLogicalName)) {
      throw new Error(`unknown fixture space: ${spaceLogicalName}`)
    }

    const bodyStoragePath = requireNonEmptyString(record, 'body_path')
    const bodyStorageAbsolutePath = path.join(contentRoot, bodyStoragePath)
    if (!isRegularFile(bodyStorageAbsolutePath)) {
      throw new Error(`missing fixture page body: ${bodyStoragePath}`)
    }

    return {
      logicalName,
      spaceLogicalName,
      title: requireNonEmptyString(record, 'title'),
      parentLogicalName: optionalNonEmptyString(record, 'parent'),
      bodyStoragePath,
      bodyStorageAbsolutePath,
      bodyStorageTemplate: fs.readFileSync(bodyStorageAbsolutePath, 'utf8'),
      attachmentLogicalNames: optionalStringArray(record, 'attachments')
    }
  })

  const knownPages = new Set(pages.map((page) => page.logicalName))
  for (const page of pages) {
    if (page.parentLogicalName !== null && !knownPages.has(page.parentLogicalName)) {
      throw new Error(`unknown fixture parent: ${page.parentLogicalName}`)
    }
  }

  return pages
}

function normalizeAttachments (records, pages, contentRoot) {
  if (!Array.isArray(records)) {
    throw new Error('fixture attachments must be array')
  }

  const knownPages = new Set(pages.map((page) => page.logicalName))
  const seen = new Set()
  return records.map((record) => {
    const logicalName = requireNonEmptyString(record, 'logical_name')
    if (seen.has(logicalName)) {
      throw new Error(`duplicate fixture attachment: ${logicalName}`)
    }
    seen.add(logicalName)

    const pageLogicalName = requireNonEmptyString(record, 'page')
    if (!knownPages.has(pageLogicalName)) {
      throw new Error(`attachment references unknown page: ${pageLogicalName}`)
    }

    const attachmentPath = requireNonEmptyString(record, 'path')
    const attachmentAbsolutePath = path.join(contentRoot, attachmentPath)
    if (!isRegularFile(attachmentAbsolutePath)) {
      throw new Error(`missing fixture attachment payload: ${attachmentPath}`)
    }

    return {
      logicalName,
      pageLogicalName,
      attachmentPath,
      attachmentAbsolutePath,
      filename: path.basename(attachmentPath),
      mediaType: requireNonEmptyString(record, 'media_type'),
      bytes: fs.readFileSync(attachmentAbsolutePath)
    }
  })
}

function validatePageAttachmentReferences (pages, attachments) {
  const knownAttachments = new Set(attachments.map((attachment) => attachment.logicalName))
  for (const page of pages) {
    for (const logicalName of page.attachmentLogicalNames) {
      if (!knownAttachments.has(logicalName)) {
        throw new Error(`unknown fixture attachment reference: ${logicalName}`)
      }
    }
  }
}

function requireNonEmptyString (record, key) {
  if (record === null || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error(`fixture record is not object for key: ${key}`)
  }
  if (typeof record[key] !== 'string' || record[key].length === 0) {
    throw new Error(`missing string property: ${key}`)
  }
  return record[key]
}

function optionalNonEmptyString (record, key) {
  if (!(key in record)) {
    return null
  }
  if (typeof record[key] !== 'string' || record[key].length === 0) {
    throw new Error(`invalid optional string property: ${key}`)
  }
  return record[key]
}

function optionalStringArray (record, key) {
  if (!(key in record)) {
    return []
  }
  if (!Array.isArray(record[key])) {
    throw new Error(`invalid attachment list: ${key}`)
  }
  return record[key].map((value) => {
    if (typeof value !== 'string' || value.length === 0) {
      throw new Error(`invalid attachment logical name in ${key}`)
    }
    return value
  })
}

function isRegularFile (absolutePath) {
  try {
    return fs.lstatSync(absolutePath).isFile()
  } catch {
    return false
  }
}

module.exports = {
  loadFixtureBundle
}
