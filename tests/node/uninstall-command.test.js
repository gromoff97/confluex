'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { runInstallCommand } = require('../../lib/confluex-node/commands/install')
const { runUninstallCommand } = require('../../lib/confluex-node/commands/uninstall')

const repoRoot = path.resolve(__dirname, '..', '..')

function options ({ installDir } = {}) {
  return {
    flags: [],
    values: installDir === undefined ? {} : { '--install-dir': installDir }
  }
}

function tempDir (prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

test('uninstall reports absent when target directory is absent', async () => {
  const target = path.join(tempDir('confluex-uninstall-absent-parent-'), 'missing')

  const result = await runUninstallCommand(options({ installDir: target }), {
    runtimeRoot: repoRoot,
    env: { HOME: tempDir('confluex-uninstall-home-') }
  })

  assert.equal(result.exitCode, 0)
  assert.equal(result.stdout, `uninstall_result=absent target="${target}"\n`)
  assert.equal(result.stderr, '')
})

test('uninstall reports absent and preserves target content when manifest is missing', async () => {
  const target = path.join(tempDir('confluex-uninstall-missing-manifest-'), 'bin')
  fs.mkdirSync(target, { recursive: true })
  fs.writeFileSync(path.join(target, 'keep.txt'), 'keep\n', 'utf8')

  const result = await runUninstallCommand(options({ installDir: target }), {
    runtimeRoot: repoRoot,
    env: { HOME: tempDir('confluex-uninstall-home-') }
  })

  assert.equal(result.exitCode, 0)
  assert.equal(result.stdout, `uninstall_result=absent target="${target}"\n`)
  assert.equal(result.stderr, '')
  assert.equal(fs.readFileSync(path.join(target, 'keep.txt'), 'utf8'), 'keep\n')
})

test('uninstall rejects invalid install manifest before removal', async () => {
  const target = path.join(tempDir('confluex-uninstall-invalid-manifest-'), 'bin')
  fs.mkdirSync(target, { recursive: true })
  fs.writeFileSync(path.join(target, '.confluex-install-manifest.txt'), 'confluex', 'utf8')
  fs.writeFileSync(path.join(target, 'confluex'), 'owned\n', 'utf8')

  const result = await runUninstallCommand(options({ installDir: target }), {
    runtimeRoot: repoRoot,
    env: { HOME: tempDir('confluex-uninstall-home-') }
  })

  assert.equal(result.exitCode, 1)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, 'ERROR: validation_failed FR-0170\n')
  assert.equal(fs.readFileSync(path.join(target, 'confluex'), 'utf8'), 'owned\n')
})

test('uninstall removes install-created footprint and preserves unrelated target content', async () => {
  const target = path.join(tempDir('confluex-uninstall-installed-'), 'bin')
  const installResult = await runInstallCommand(options({ installDir: target }), {
    runtimeRoot: repoRoot,
    env: { HOME: tempDir('confluex-uninstall-home-') }
  })
  assert.equal(installResult.exitCode, 0)
  fs.writeFileSync(path.join(target, 'keep.txt'), 'keep\n', 'utf8')

  const result = await runUninstallCommand(options({ installDir: target }), {
    runtimeRoot: repoRoot,
    env: { HOME: tempDir('confluex-uninstall-home-') }
  })

  assert.equal(result.exitCode, 0)
  assert.equal(result.stdout, `uninstall_result=removed target="${target}"\n`)
  assert.equal(result.stderr, '')
  assert.equal(fs.existsSync(path.join(target, 'confluex')), false)
  assert.equal(fs.existsSync(path.join(target, '.confluex-install-manifest.txt')), false)
  assert.equal(fs.existsSync(path.join(target, 'lib', 'confluex-node')), false)
  assert.equal(fs.existsSync(path.join(target, 'lib')), true)
  assert.equal(fs.readFileSync(path.join(target, 'keep.txt'), 'utf8'), 'keep\n')
})

test('uninstall fails before manifest removal when a listed directory is not empty', async () => {
  const target = path.join(tempDir('confluex-uninstall-nonempty-'), 'bin')
  fs.mkdirSync(path.join(target, 'owned-dir'), { recursive: true })
  fs.writeFileSync(path.join(target, 'owned-dir', 'owned.txt'), 'owned\n', 'utf8')
  fs.writeFileSync(path.join(target, 'owned-dir', 'foreign.txt'), 'foreign\n', 'utf8')
  fs.writeFileSync(path.join(target, '.confluex-install-manifest.txt'), [
    '.confluex-install-manifest.txt',
    'owned-dir',
    'owned-dir/owned.txt',
    ''
  ].join('\n'), 'utf8')

  const result = await runUninstallCommand(options({ installDir: target }), {
    runtimeRoot: repoRoot,
    env: { HOME: tempDir('confluex-uninstall-home-') }
  })

  assert.equal(result.exitCode, 4)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, 'ERROR: runtime_failure uninstall\n')
  assert.equal(fs.existsSync(path.join(target, '.confluex-install-manifest.txt')), true)
  assert.equal(fs.readFileSync(path.join(target, 'owned-dir', 'foreign.txt'), 'utf8'), 'foreign\n')
})
