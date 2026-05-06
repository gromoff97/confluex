'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const http = require('node:http')
const os = require('node:os')
const path = require('node:path')
const { spawn, spawnSync } = require('node:child_process')

const repoRoot = path.resolve(__dirname, '..', '..')
const nodeMain = path.join(repoRoot, 'lib', 'confluex-node', 'main.js')
const launcher = path.join(repoRoot, 'confluex')

function runNodeMain (argv) {
  return spawnSync(process.execPath, [nodeMain, ...argv], {
    cwd: repoRoot,
    encoding: 'utf8'
  })
}

function runLauncher (argv) {
  return spawnSync(launcher, argv, {
    cwd: repoRoot,
    encoding: 'utf8'
  })
}

function runLauncherWithHome (argv, home, cwd = repoRoot) {
  return spawnSync(launcher, argv, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      HOME: home,
      USERPROFILE: home
    }
  })
}

function runLauncherWithEnv (argv, env, cwd = repoRoot) {
  return spawnSync(launcher, argv, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...env
    }
  })
}

function runLauncherWithEnvAsync (argv, env, cwd = repoRoot) {
  return new Promise(resolve => {
    const child = spawn(launcher, argv, {
      cwd,
      env: {
        ...process.env,
        ...env
      }
    })
    let stdout = ''
    let stderr = ''
    const timeout = setTimeout(() => child.kill('SIGKILL'), 5000)

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })
    child.on('close', (code, signal) => {
      clearTimeout(timeout)
      resolve({
        status: code,
        signal,
        stdout,
        stderr
      })
    })
  })
}

function writeExecutable (file, content) {
  fs.writeFileSync(file, content, 'utf8')
  fs.chmodSync(file, 0o755)
}

async function withServer (handler, run) {
  const server = http.createServer(handler)
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    const { port } = server.address()
    return await run(`http://127.0.0.1:${port}`)
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
}

function fakeDoctorBin () {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-doctor-bin-'))
  fs.symlinkSync(process.execPath, path.join(bin, 'node'))
  writeExecutable(path.join(bin, 'docker'), [
    '#!/bin/sh',
    'if [ "$1" = "--version" ]; then',
    '  printf "Docker version 27.0.0\\n"',
    '  exit 0',
    'fi',
    'exit 1',
    ''
  ].join('\n'))
  writeExecutable(path.join(bin, 'bats'), [
    '#!/bin/sh',
    'if [ "$1" = "--version" ]; then',
    '  printf "Bats 1.11.0\\n"',
    '  exit 0',
    'fi',
    'exit 1',
    ''
  ].join('\n'))
  writeExecutable(path.join(bin, 'gpg'), [
    '#!/bin/sh',
    'if [ "$1" = "--version" ]; then',
    '  printf "gpg 2.4.0\\n"',
    '  exit 0',
    'fi',
    'if [ "$1" = "--list-keys" ] && [ "$2" = "--with-colons" ] && [ "$3" = "recipient" ]; then',
    '  exit 0',
    'fi',
    'exit 2',
    ''
  ].join('\n'))
  return bin
}

function fakeFailingDockerBin () {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-failing-docker-bin-'))
  writeExecutable(path.join(bin, 'docker'), [
    '#!/bin/sh',
    'exit 1',
    ''
  ].join('\n'))
  return bin
}

test('node entrypoint renders top-level help for no argv', () => {
  const result = runNodeMain([])
  assert.equal(result.status, 0)
  assert.equal(result.stderr, '')
  assert.equal(result.stdout.startsWith('Usage\n  confluex <command> [options]\nCommands\n'), true)
})

test('node entrypoint renders command help', () => {
  const result = runNodeMain(['selftest', '--help'])
  assert.equal(result.status, 0)
  assert.equal(result.stderr, '')
  assert.equal(result.stdout, [
    'Usage',
    '  confluex selftest --url <base-url> --token <token>',
    'Purpose',
    '  explicit-target live regression self-test workflow for an already running Confluence 7.13.7 stand with fixture preparation, live regression, and self-test report root',
    'Required options',
    '  --url <base-url>  Base URL of the already running Confluence stand.',
    '  --token <token>  Bearer token used for selftest reset, fixture apply, and live regression.',
    'Optional options',
    '  --env-file <file>  Read configuration from this env file.',
    'Examples',
    '  confluex selftest --url http://127.0.0.1:8090 --token test-token',
    ''
  ].join('\n'))
})

test('node entrypoint rejects unknown command on stderr only', () => {
  const result = runNodeMain(['bad command'])
  assert.equal(result.status, 1)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, 'ERROR: unknown_command bad%20command\n')
})

test('node entrypoint rejects missing required known-command options', () => {
  const result = runNodeMain(['export'])
  assert.equal(result.status, 1)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, 'ERROR: missing_required_option --page-id\n')
})

test('node entrypoint rejects unsupported known-command options on stderr only', () => {
  const result = runNodeMain([
    'selftest',
    '--url',
    'http://127.0.0.1:8090',
    '--token',
    'test-token',
    '--safe'
  ])
  assert.equal(result.status, 1)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, 'ERROR: unsupported_option --safe\n')
})

test('node entrypoint rejects export when root page preflight cannot run', () => {
  const result = runNodeMain(['export', '--page-id', '123'])
  assert.equal(result.status, 1)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, 'ERROR: validation_failed FR-0017 --page-id 123\n')
})

test('public launcher uses JS top-level help without legacy Bash fallback', () => {
  const result = runLauncher(['--help'])
  assert.equal(result.status, 0)
  assert.equal(result.stderr, '')
  assert.equal(result.stdout.includes('\n\n'), false)
  assert.equal(result.stdout, [
    'Usage',
    '  confluex <command> [options]',
    'Commands',
    '  export  materialized export workflow',
    '  plan  dry-run planning workflow',
    '  doctor  diagnostic workflow',
    '  config  configuration workflow',
    '  selftest  live regression self-test workflow',
    ''
  ].join('\n'))
})

test('public launcher rejects unknown command through JS diagnostics', () => {
  const result = runLauncher(['bogus'])
  assert.equal(result.status, 1)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, 'ERROR: unknown_command bogus\n')
})

test('public launcher validates known commands before development checkpoint', () => {
  const rejected = runLauncher([
    'selftest',
    '--url',
    'http://127.0.0.1:8090',
    '--token',
    'test-token',
    '--safe'
  ])
  assert.equal(rejected.status, 1)
  assert.equal(rejected.stdout, '')
  assert.equal(rejected.stderr, 'ERROR: unsupported_option --safe\n')

  const preflightRejected = runLauncher(['plan', '--page-id', '123'])
  assert.equal(preflightRejected.status, 1)
  assert.equal(preflightRejected.stdout, '')
  assert.equal(preflightRejected.stderr, 'ERROR: validation_failed FR-0017 --page-id 123\n')
})

test('public launcher rejects bare selftest before report root creation', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-selftest-launcher-'))
  const bin = fakeFailingDockerBin()
  const result = runLauncherWithEnv(['selftest'], {
    PATH: `${bin}${path.delimiter}${process.env.PATH || ''}`
  }, cwd)

  assert.equal(result.status, 1)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, 'ERROR: missing_required_option --url\n')
  assert.deepEqual(fs.readdirSync(cwd), [])
})

test('public launcher rejects encrypted export with missing recipient before page preflight', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-export-encrypt-missing-'))

  const result = runLauncherWithHome(['export', '--page-id', '123', '--encrypt'], home)

  assert.equal(result.status, 1)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, 'ERROR: validation_failed FR-0024\n')
})

test('public launcher validates encryption recipient before page preflight', () => {
  const bin = fakeDoctorBin()
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-export-encrypt-valid-'))
  const env = {
    HOME: home,
    USERPROFILE: home,
    PATH: `${bin}${path.delimiter}${process.env.PATH || ''}`
  }

  const result = runLauncherWithEnv(['export', '--page-id', '123', '--encrypt', '--encryption-key', 'recipient'], env)

  assert.equal(result.status, 1)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, 'ERROR: validation_failed FR-0017 --page-id 123\n')
})

test('public launcher rejects existing output root after successful page preflight', async () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-plan-existing-out-'))
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-plan-existing-home-'))
  const requests = []

  await withServer((request, response) => {
    requests.push({ method: request.method, url: request.url })
    response.setHeader('content-type', 'application/json')
    response.end(JSON.stringify({ id: '123' }))
  }, async baseUrl => {
    const result = await runLauncherWithEnvAsync(['plan', '--page-id', '123', '--out', out], {
      HOME: home,
      USERPROFILE: home,
      CONFLUEX_CONFLUENCE_BASE_URL: baseUrl,
      CONFLUEX_CONFLUENCE_TOKEN: 'token'
    })

    assert.equal(result.status, 1)
    assert.equal(result.stdout, '')
    assert.equal(result.stderr, 'ERROR: validation_failed FR-0016\n')
  })

  assert.deepEqual(requests, [{ method: 'GET', url: '/rest/api/content/123' }])
})

test('public launcher plans remote child tree when child listing is available', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-plan-remote-tree-')), 'out')
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-plan-remote-home-'))
  const requests = []

  await withServer((request, response) => {
    requests.push({ method: request.method, url: request.url })
    response.setHeader('content-type', 'application/json')
    if (request.url === '/rest/api/content/123') {
      response.end(JSON.stringify({
        id: '123',
        title: 'Root Page',
        space: { key: 'CX' }
      }))
      return
    }
    if (request.url === '/rest/api/content/123/child/page?limit=200&expand=space') {
      response.end(JSON.stringify({
        results: [
          {
            id: '456',
            title: 'Child Page',
            space: { key: 'CX' }
          }
        ],
        _links: {}
      }))
      return
    }
    if (request.url === '/rest/api/content/456/child/page?limit=200&expand=space') {
      response.end(JSON.stringify({
        results: [],
        _links: {}
      }))
      return
    }
    if (request.url === '/rest/api/content/123?expand=body.storage') {
      response.end(JSON.stringify({
        id: '123',
        body: {
          storage: {
            value: '<p>Root page with no links.</p>'
          }
        }
      }))
      return
    }
    if (request.url === '/rest/api/content/456?expand=body.storage') {
      response.end(JSON.stringify({
        id: '456',
        body: {
          storage: {
            value: '<p>Child page with no links.</p>'
          }
        }
      }))
      return
    }
    if (request.url === '/rest/api/content/123/child/attachment?limit=200') {
      response.end(JSON.stringify({
        results: [],
        _links: {}
      }))
      return
    }
    if (request.url === '/rest/api/content/456/child/attachment?limit=200') {
      response.end(JSON.stringify({
        results: [
          { title: 'child.bin' }
        ],
        _links: {}
      }))
      return
    }
    response.statusCode = 404
    response.end('missing')
  }, async baseUrl => {
    const result = await runLauncherWithEnvAsync(['plan', '--page-id', '123', '--out', out, '--safe'], {
      HOME: home,
      USERPROFILE: home,
      CONFLUEX_CONFLUENCE_BASE_URL: baseUrl,
      CONFLUEX_CONFLUENCE_TOKEN: 'token'
    })

    assert.equal(result.status, 0)
    assert.equal(result.stderr, '')
    assert.match(result.stdout, /^RUN_COMPLETE final_status=success artifact=/m)
  })

  assert.deepEqual(requests, [
    { method: 'GET', url: '/rest/api/content/123' },
    { method: 'GET', url: '/rest/api/content/123/child/page?limit=200&expand=space' },
    { method: 'GET', url: '/rest/api/content/456/child/page?limit=200&expand=space' },
    { method: 'GET', url: '/rest/api/content/123?expand=body.storage' },
    { method: 'GET', url: '/rest/api/content/456?expand=body.storage' },
    { method: 'GET', url: '/rest/api/content/123/child/attachment?limit=200' },
    { method: 'GET', url: '/rest/api/content/456/child/attachment?limit=200' }
  ])
  assert.match(fs.readFileSync(path.join(out, 'manifest.tsv'), 'utf8'), /^123\tCX\tRoot Page\tnone\troot\tplan\t0$/m)
  assert.match(fs.readFileSync(path.join(out, 'manifest.tsv'), 'utf8'), /^456\tCX\tChild Page\tnone\ttree\tplan\t1$/m)
})

test('public launcher resolves remote title links when candidate listing is available', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-plan-remote-title-')), 'out')
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-plan-remote-title-home-'))
  const requests = []

  await withServer((request, response) => {
    requests.push({ method: request.method, url: request.url })
    response.setHeader('content-type', 'application/json')
    if (request.url === '/rest/api/content/123') {
      response.end(JSON.stringify({
        id: '123',
        title: 'Root Page',
        space: { key: 'CX' }
      }))
      return
    }
    if (request.url === '/rest/api/content/123/child/page?limit=200&expand=space') {
      response.end(JSON.stringify({
        results: [],
        _links: {}
      }))
      return
    }
    if (request.url === '/rest/api/content/123?expand=body.storage') {
      response.end(JSON.stringify({
        id: '123',
        body: {
          storage: {
            value: '<p><a href="/display/CX/Linked+Page">Linked</a></p>'
          }
        }
      }))
      return
    }
    if (request.url === '/rest/api/content?type=page&title=Linked+Page&spaceKey=CX&limit=200&expand=space') {
      response.end(JSON.stringify({
        results: [
          {
            id: '456',
            title: 'Linked Page',
            space: { key: 'CX' }
          }
        ],
        _links: {}
      }))
      return
    }
    if (request.url === '/rest/api/content/456?expand=body.storage') {
      response.end(JSON.stringify({
        id: '456',
        body: {
          storage: {
            value: '<p>Linked page has no links.</p>'
          }
        }
      }))
      return
    }
    if (request.url === '/rest/api/content/123/child/attachment?limit=200') {
      response.end(JSON.stringify({
        results: [],
        _links: {}
      }))
      return
    }
    if (request.url === '/rest/api/content/456/child/attachment?limit=200') {
      response.end(JSON.stringify({
        results: [],
        _links: {}
      }))
      return
    }
    response.statusCode = 404
    response.end('missing')
  }, async baseUrl => {
    const result = await runLauncherWithEnvAsync(['plan', '--page-id', '123', '--out', out, '--safe'], {
      HOME: home,
      USERPROFILE: home,
      CONFLUEX_CONFLUENCE_BASE_URL: baseUrl,
      CONFLUEX_CONFLUENCE_TOKEN: 'token'
    })

    assert.equal(result.status, 0)
    assert.equal(result.stderr, '')
    assert.match(result.stdout, /^RUN_COMPLETE final_status=success artifact=/m)
  })

  assert.deepEqual(requests, [
    { method: 'GET', url: '/rest/api/content/123' },
    { method: 'GET', url: '/rest/api/content/123/child/page?limit=200&expand=space' },
    { method: 'GET', url: '/rest/api/content/123?expand=body.storage' },
    { method: 'GET', url: '/rest/api/content?type=page&title=Linked+Page&spaceKey=CX&limit=200&expand=space' },
    { method: 'GET', url: '/rest/api/content/456?expand=body.storage' },
    { method: 'GET', url: '/rest/api/content/123/child/attachment?limit=200' },
    { method: 'GET', url: '/rest/api/content/456/child/attachment?limit=200' }
  ])
  assert.match(fs.readFileSync(path.join(out, 'manifest.tsv'), 'utf8'), /^123\tCX\tRoot Page\tnone\troot\tplan\t0$/m)
  assert.match(fs.readFileSync(path.join(out, 'manifest.tsv'), 'utf8'), /^456\tCX\tLinked Page\tnone\tlinked\tplan\t0$/m)
  assert.match(fs.readFileSync(path.join(out, 'resolved-links.tsv'), 'utf8'), /^123\tRoot Page\thref_space_title\tspace_key_present=1;space_key_bytes=2;space_key=CX;title_bytes=11;title=Linked Page\t456\tCX\tLinked Page$/m)
})

test('public launcher implements doctor scaffold without page access', () => {
  const bin = fakeDoctorBin()
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-doctor-home-'))
  const env = {
    HOME: home,
    USERPROFILE: home,
    PATH: `${bin}${path.delimiter}${process.env.PATH || ''}`
  }

  const result = runLauncherWithEnv(['doctor'], env)

  assert.equal(result.status, 0)
  assert.equal(result.stderr, '')
  assert.equal(result.stdout, [
    'dependency_docker_cli=present:Docker version 27.0.0',
    'dependency_gpg=present:gpg 2.4.0',
    'page_access=skipped',
    'encryption_recipient=skipped',
    'support_profile=default',
    'supported_link_forms=child_result,content_id,page_ref,macro_param,href_page_id,href_space_title,ri_url_page_id,ri_url_space_title',
    'next_action=none',
    ''
  ].join('\n'))
})

test('public launcher implements doctor encryption verification with explicit recipient', () => {
  const bin = fakeDoctorBin()
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-doctor-verify-'))
  const env = {
    HOME: home,
    USERPROFILE: home,
    PATH: `${bin}${path.delimiter}${process.env.PATH || ''}`
  }

  const result = runLauncherWithEnv(['doctor', '--verify-encryption', '--encryption-key', 'recipient'], env)

  assert.equal(result.status, 0)
  assert.equal(result.stderr, '')
  assert.equal(result.stdout, [
    'dependency_docker_cli=present:Docker version 27.0.0',
    'dependency_gpg=present:gpg 2.4.0',
    'page_access=skipped',
    'encryption_recipient=ok',
    'support_profile=default',
    'supported_link_forms=child_result,content_id,page_ref,macro_param,href_page_id,href_space_title,ri_url_page_id,ri_url_space_title',
    'next_action=none',
    ''
  ].join('\n'))
})

test('public launcher reports failed doctor page access when remote context is absent', () => {
  const result = runLauncher(['doctor', '--page-id', '123'])
  assert.equal(result.status, 0)
  assert.equal(result.stderr, '')
  assert.match(result.stdout, /^page_access=failed$/m)
  assert.match(result.stdout, /^page_access_reason=missing_token$/m)
  assert.doesNotMatch(result.stdout, /^page_identity=/m)
  assert.match(result.stdout, /^next_action=.*check_page_access/m)
})

test('public launcher rejects removed lifecycle commands', () => {
  for (const command of ['install', 'uninstall']) {
    const result = runLauncher([command])
    assert.equal(result.status, 1, command)
    assert.equal(result.stdout, '', command)
    assert.equal(result.stderr, `ERROR: unknown_command ${command}\n`, command)
  }
})

test('public launcher implements config read save and clear with home-local state', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-config-home-'))
  const otherCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-config-cwd-'))

  const initial = runLauncherWithHome(['config'], home)
  assert.equal(initial.status, 0)
  assert.equal(initial.stdout, 'default_encryption_key=none\n')
  assert.equal(initial.stderr, '')

  const saved = runLauncherWithHome(['config', '--encryption-key', 'recipient'], home)
  assert.equal(saved.status, 0)
  assert.equal(saved.stdout, 'default_encryption_key=recipient\n')
  assert.equal(saved.stderr, '')

  const readFromOtherCwd = runLauncherWithHome(['config'], home, otherCwd)
  assert.equal(readFromOtherCwd.status, 0)
  assert.equal(readFromOtherCwd.stdout, 'default_encryption_key=recipient\n')
  assert.equal(readFromOtherCwd.stderr, '')

  const cleared = runLauncherWithHome(['config', '--clear-encryption-key'], home)
  assert.equal(cleared.status, 0)
  assert.equal(cleared.stdout, 'default_encryption_key=none\n')
  assert.equal(cleared.stderr, '')

  const afterClear = runLauncherWithHome(['config'], home)
  assert.equal(afterClear.status, 0)
  assert.equal(afterClear.stdout, 'default_encryption_key=none\n')
  assert.equal(afterClear.stderr, '')
})

test('public launcher keeps invalid config invocations rejected before state mutation', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-config-invalid-'))

  const result = runLauncherWithHome(['config', '--clear-encryption-key', '--encryption-key', 'recipient'], home)

  assert.equal(result.status, 1)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, 'ERROR: invalid_option_combination --clear-encryption-key,--encryption-key\n')
})
