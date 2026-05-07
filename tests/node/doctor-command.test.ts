'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { runDoctorCommand } = require('../../dist/confluex-node/commands/doctor')

const supportedLinkForms = 'child_result,content_id,page_ref,macro_param,href_page_id,href_space_title,ri_url_page_id,ri_url_space_title'
const nodeRuntimeLine = `dependency_node_runtime=present:${process.version}`
const readyEnv = {
  CONFLUEX_CONFLUENCE_BASE_URL: 'https://confluence.example',
  CONFLUEX_CONFLUENCE_TOKEN: 'token'
}

function options ({ logFile, pageId }: { logFile?: string, pageId?: string } = {}) {
  return {
    flags: [],
    values: {
      ...(logFile === undefined ? {} : { '--log-file': logFile }),
      ...(pageId === undefined ? {} : { '--page-id': pageId })
    }
  }
}

function presentProbe (label, executable) {
  assert.equal(label, 'markdown_converter')
  assert.equal(executable, 'uvx')
  return {
    label,
    state: `present:${label} version`
  }
}

function absentProbe (label, executable) {
  assert.equal(label, 'markdown_converter')
  assert.equal(executable, 'uvx')
  return {
    label,
    state: 'absent'
  }
}

test('doctor without options emits governed no-page stdout contract', async () => {
  const result = await runDoctorCommand(options(), {
    dependencyProbe: presentProbe,
    env: readyEnv
  })

  assert.deepEqual(result, {
    exitCode: 0,
    stdout: [
      nodeRuntimeLine,
      'dependency_markdown_converter=present:markdown_converter version',
      'configuration=ok',
      'page_access=skipped',
      'support_profile=default',
      `supported_link_forms=${supportedLinkForms}`,
      'next_action=none',
      ''
    ].join('\n'),
    stderr: ''
  })
})

test('doctor reports missing base URL configuration and next action', async () => {
  const result = await runDoctorCommand(options(), {
    dependencyProbe: presentProbe,
    env: {}
  })

  assert.equal(result.exitCode, 0)
  assert.equal(result.stderr, '')
  assert.match(result.stdout, /^configuration=missing_base_url$/m)
  assert.match(result.stdout, /^next_action=set_confluence_base_url$/m)
})

test('doctor reports missing token and invalid base URL configuration states', async () => {
  const missingToken = await runDoctorCommand(options(), {
    dependencyProbe: presentProbe,
    env: { CONFLUEX_CONFLUENCE_BASE_URL: 'https://confluence.example' }
  })
  const invalidBaseUrl = await runDoctorCommand(options(), {
    dependencyProbe: presentProbe,
    env: {
      CONFLUEX_CONFLUENCE_BASE_URL: 'ftp://confluence.example',
      CONFLUEX_CONFLUENCE_TOKEN: 'token'
    }
  })

  assert.match(missingToken.stdout, /^configuration=missing_token$/m)
  assert.match(missingToken.stdout, /^next_action=set_confluence_token$/m)
  assert.match(invalidBaseUrl.stdout, /^configuration=invalid_base_url$/m)
  assert.match(invalidBaseUrl.stdout, /^next_action=fix_confluence_base_url$/m)
})

test('absent markdown converter produces install next action', async () => {
  const result = await runDoctorCommand(options(), {
    dependencyProbe: absentProbe,
    env: readyEnv
  })

  assert.equal(result.exitCode, 0)
  assert.equal(result.stderr, '')
  assert.equal(result.stdout.split('\n').at(-2), 'next_action=install_markdown_converter')
})

test('unsupported node runtime produces upgrade next action first', async () => {
  const result = await runDoctorCommand(options(), {
    dependencyProbe: absentProbe,
    env: readyEnv,
    nodeVersion: 'v20.10.0'
  })

  assert.equal(result.exitCode, 0)
  assert.match(result.stdout, /^dependency_node_runtime=unsupported:v20.10.0$/m)
  assert.equal(result.stdout.split('\n').at(-2), 'next_action=upgrade_node_runtime,install_markdown_converter')
})

test('doctor log-file replaces selected file with current stdout', async () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-doctor-log-'))
  const logFile = path.join(cwd, 'doctor.log')
  fs.writeFileSync(logFile, 'stale\n', 'utf8')

  const result = await runDoctorCommand(options({ logFile }), {
    dependencyProbe: presentProbe,
    cwd,
    env: readyEnv
  })

  assert.equal(result.exitCode, 0)
  assert.equal(result.stderr, '')
  assert.equal(fs.readFileSync(logFile, 'utf8'), result.stdout)
})

test('doctor rejects directory log-file before dependency probes', async () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-doctor-log-reject-'))
  const logFile = path.join(cwd, 'directory-log')
  fs.mkdirSync(logFile)

  const result = await runDoctorCommand(options({ logFile }), {
    dependencyProbe () {
      throw new Error('dependency probe must not run')
    },
    cwd,
    env: readyEnv
  })

  assert.deepEqual(result, {
    exitCode: 1,
    stdout: '',
    stderr: 'ERROR: validation_failed FR-0134\n'
  })
})

test('doctor page access ok emits page identity after page access line', async () => {
  const result = await runDoctorCommand(options({ pageId: '123' }), {
    dependencyProbe: presentProbe,
    env: readyEnv,
    pageAccessChecker (pageId) {
      assert.equal(pageId, '123')
      return { state: 'ok', identity: '456' }
    }
  })

  assert.equal(result.exitCode, 0)
  assert.match(result.stdout, /^page_access=ok\npage_access_reason=none\npage_identity=456$/m)
  assert.match(result.stdout, /^next_action=none$/m)
})

test('doctor page access failure emits check page access next action', async () => {
  const result = await runDoctorCommand(options({ pageId: '123' }), {
    dependencyProbe: presentProbe,
    env: readyEnv,
    pageAccessChecker () {
      return { state: 'failed', reason: 'auth_rejected' }
    }
  })

  assert.equal(result.exitCode, 0)
  assert.match(result.stdout, /^page_access=failed\npage_access_reason=auth_rejected$/m)
  assert.doesNotMatch(result.stdout, /^page_identity=/m)
  assert.match(result.stdout, /^next_action=check_page_access$/m)
})
