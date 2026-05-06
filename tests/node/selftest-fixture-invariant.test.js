'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { applyFixtureDataset } = require('../../lib/confluex-node/selftest/fixture-apply')
const { loadFixtureBundle } = require('../../lib/confluex-node/selftest/fixture-bundle')
const { checkFixtureInvariants } = require('../../lib/confluex-node/selftest/fixture-invariant')

const repoRoot = path.resolve(__dirname, '../..')

function tempDir (prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

test('fixture invariant check validates identities against read-only client data', async () => {
  const { reportRoot, identities } = await createFixtureReport()

  const result = await checkFixtureInvariants(repoRoot, reportRoot, {
    client: createReadOnlyFixtureClient(identities)
  })

  assert.deepEqual(result, { state: 'passed' })
})

test('fixture invariant check accepts equivalent self-closing storage XML', async () => {
  const { reportRoot, identities } = await createFixtureReport()

  const result = await checkFixtureInvariants(repoRoot, reportRoot, {
    client: createReadOnlyFixtureClient(identities, {
      pageOverrides: {
        linked_scope_root: {
          bodyStorage: expectedBodyStorage(
            loadFixtureBundle(repoRoot).pages.find(page => page.logicalName === 'linked_scope_root'),
            identities
          ).replace('/></ac:link>', ' /></ac:link>')
        }
      }
    })
  })

  assert.deepEqual(result, { state: 'passed' })
})

test('fixture invariant check accepts Confluence generated macro attributes', async () => {
  const { reportRoot, identities } = await createFixtureReport()
  const page = loadFixtureBundle(repoRoot).pages.find(page => page.logicalName === 'scope_noise_root')

  const result = await checkFixtureInvariants(repoRoot, reportRoot, {
    client: createReadOnlyFixtureClient(identities, {
      pageOverrides: {
        scope_noise_root: {
          bodyStorage: expectedBodyStorage(page, identities)
            .replace(
              '<ac:structured-macro ac:name="code">',
              '<ac:structured-macro ac:name="code" ac:schema-version="1" ac:macro-id="generated">'
            )
            .replace(/\n$/, '')
        }
      }
    })
  })

  assert.deepEqual(result, { state: 'passed' })
})

test('fixture invariant check accepts Confluence macro tag canonicalization', async () => {
  const { reportRoot, identities } = await createFixtureReport()
  const page = loadFixtureBundle(repoRoot).pages.find(page => page.logicalName === 'root_page')

  const result = await checkFixtureInvariants(repoRoot, reportRoot, {
    client: createReadOnlyFixtureClient(identities, {
      pageOverrides: {
        root_page: {
          bodyStorage: expectedBodyStorage(page, identities)
            .replace('<ac:structured-macro ac:name="dummy">', '<ac:macro ac:name="dummy">')
            .replace('</ac:structured-macro>', '</ac:macro>')
        }
      }
    })
  })

  assert.deepEqual(result, { state: 'passed' })
})

test('fixture invariant check accepts Confluence storage entity canonicalization', async () => {
  const { reportRoot, identities } = await createFixtureReport()
  const page = loadFixtureBundle(repoRoot).pages.find(page => page.logicalName === 'messy_russian_page')

  const result = await checkFixtureInvariants(repoRoot, reportRoot, {
    client: createReadOnlyFixtureClient(identities, {
      pageOverrides: {
        messy_russian_page: {
          bodyStorage: expectedBodyStorage(page, identities)
            .replaceAll('—', '&mdash;')
            .replaceAll('&#39;', "'")
        }
      }
    })
  })

  assert.deepEqual(result, { state: 'passed' })
})

test('fixture invariant check fails when retained page content no longer matches dataset', async () => {
  const { reportRoot, identities } = await createFixtureReport()

  const result = await checkFixtureInvariants(repoRoot, reportRoot, {
    client: createReadOnlyFixtureClient(identities, {
      pageOverrides: {
        root_page: {
          bodyStorage: '<p>changed</p>'
        }
      }
    })
  })

  assert.deepEqual(result, { state: 'failed' })
})

async function createFixtureReport () {
  const reportRoot = tempDir('confluex-fixture-invariant-report-')
  let nextPageId = 1000
  const result = await applyFixtureDataset(repoRootForFixtures(), {
    client: {
      async applySpace (space) {
        return {
          spaceKey: space.key,
          spaceName: space.name
        }
      },
      async applyPage () {
        const pageId = String(nextPageId)
        nextPageId += 1
        return { pageId }
      },
      async applyAttachment (attachment) {
        return { filename: attachment.filename }
      }
    }
  })

  assert.equal(result.state, 'passed')
  fs.writeFileSync(path.join(reportRoot, 'identities.json'), `${JSON.stringify(result.identities)}\n`, 'utf8')
  return {
    reportRoot,
    identities: result.identities
  }
}

function repoRootForFixtures () {
  return repoRoot
}

function createReadOnlyFixtureClient (identities, options = {}) {
  const bundle = loadFixtureBundle(repoRoot)
  const spacesByKey = new Map(bundle.spaces.map(space => [space.spaceKey, space]))
  const pagesById = new Map(bundle.pages.map(page => [identities[page.logicalName].page_id, page]))
  const logicalNameByPageId = new Map(bundle.pages.map(page => [identities[page.logicalName].page_id, page.logicalName]))
  const attachmentsByPageFilename = new Map(bundle.attachments.map(attachment => [
    `${identities[attachment.pageLogicalName].page_id}\n${attachment.filename}`,
    attachment
  ]))

  return {
    async readSpace ({ spaceKey }) {
      const space = spacesByKey.get(spaceKey)
      return {
        spaceKey: space.spaceKey,
        spaceName: space.spaceName
      }
    },
    async readPage ({ pageId }) {
      const page = pagesById.get(pageId)
      const logicalName = logicalNameByPageId.get(pageId)
      const override = (options.pageOverrides || {})[logicalName] || {}
      return {
        pageId,
        title: override.title || page.title,
        spaceKey: override.spaceKey || identities[logicalName].space_key,
        parentId: override.parentId || (page.parentLogicalName ? identities[page.parentLogicalName].page_id : null),
        bodyStorage: override.bodyStorage || expectedBodyStorage(page, identities)
      }
    },
    async readAttachment ({ pageId, filename }) {
      const attachment = attachmentsByPageFilename.get(`${pageId}\n${filename}`)
      return {
        pageId,
        filename,
        bytes: attachment.bytes
      }
    }
  }
}

function expectedBodyStorage (page, identities) {
  if (typeof page.bodyStorageTemplate === 'string') {
    return page.bodyStorageTemplate.replace(/\{\{page_id:([A-Za-z0-9_.-]+)\}\}/g, (_match, logicalName) => {
      return identities[logicalName].page_id
    })
  }

  throw new Error('page has no body storage template')
}
