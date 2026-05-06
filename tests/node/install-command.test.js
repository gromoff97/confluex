'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const { runInstallCommand } = require('../../lib/confluex-node/commands/install')

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

test('install copies JS runtime footprint and writes valid manifest', async () => {
  const target = path.join(tempDir('confluex-install-target-'), 'bin')

  const result = await runInstallCommand(options({ installDir: target }), {
    runtimeRoot: repoRoot,
    env: { HOME: tempDir('confluex-install-home-') }
  })

  assert.equal(result.exitCode, 0)
  assert.equal(result.stdout, `install_result=installed target="${target}"\n`)
  assert.equal(result.stderr, '')
  assert.equal(fs.existsSync(path.join(target, 'confluex')), true)
  assert.equal(fs.existsSync(path.join(target, 'lib', 'confluex-node', 'main.js')), true)
  assert.equal(fs.existsSync(path.join(target, 'lib', 'confluex')), false)
  assert.equal(fs.existsSync(path.join(target, 'scripts', 'selftest')), false)
  assert.equal(fs.existsSync(path.join(target, 'fixtures', 'confluence-7137')), true)
  assert.equal(fs.existsSync(path.join(target, 'docker', 'confluence-7137')), false)
  assert.equal(fs.existsSync(path.join(target, 'tests', 'live-bats')), true)

  const manifest = fs.readFileSync(path.join(target, '.confluex-install-manifest.txt'), 'utf8')
  const lines = manifest.trimEnd().split('\n')
  assert.equal(manifest.endsWith('\n'), true)
  assert.equal(lines.includes('confluex'), true)
  assert.equal(lines.includes('lib/confluex-node/main.js'), true)
  assert.deepEqual(lines, lines.slice().sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right))))

  const installed = spawnSync(path.join(target, 'confluex'), ['--help'], { encoding: 'utf8' })
  assert.equal(installed.status, 0)
  assert.equal(installed.stderr, '')
  assert.equal(installed.stdout.startsWith('Usage\n'), true)
})

test('install defaults target to HOME .local bin on POSIX', async () => {
  const home = tempDir('confluex-install-default-home-')

  const result = await runInstallCommand(options(), {
    runtimeRoot: repoRoot,
    env: { HOME: home }
  })

  assert.equal(result.exitCode, 0)
  assert.equal(result.stdout, `install_result=installed target="${path.join(home, '.local', 'bin')}"\n`)
})

test('install rejects runtime-root overlap before writing', async () => {
  const result = await runInstallCommand(options({ installDir: repoRoot }), {
    runtimeRoot: repoRoot,
    env: { HOME: tempDir('confluex-install-home-') }
  })

  assert.equal(result.exitCode, 1)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, 'ERROR: validation_failed FR-0166\n')
})
