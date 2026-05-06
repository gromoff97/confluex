'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { runDoctorCommand } = require('../../lib/confluex-node/commands/doctor')

const supportedLinkForms = 'child_result,content_id,page_ref,macro_param,href_page_id,href_space_title,ri_url_page_id,ri_url_space_title'
const nodeRuntimeLine = `dependency_node_runtime=present:${process.version}`

function options ({ verify = false, key, logFile } = {}) {
  return {
    flags: verify ? ['--verify-encryption'] : [],
    values: {
      ...(key === undefined ? {} : { '--encryption-key': key }),
      ...(logFile === undefined ? {} : { '--log-file': logFile })
    }
  }
}

function presentProbe (label) {
  return {
    label,
    state: `present:${label} version`
  }
}

function absentProbe (label) {
  return {
    label,
    state: 'absent'
  }
}

function storeWithValue (value) {
  return {
    readDefaultEncryptionKey () {
      return value
    }
  }
}

test('doctor without options emits governed no-page stdout contract', async () => {
  const result = await runDoctorCommand(options(), {
    dependencyProbe: presentProbe,
    store: storeWithValue(null)
  })

  assert.deepEqual(result, {
    exitCode: 0,
    stdout: [
      nodeRuntimeLine,
      'dependency_docker_cli=present:docker_cli version',
      'dependency_gpg=present:gpg version',
      'dependency_markdown_converter=present:markdown_converter version',
      'page_access=skipped',
      'encryption_recipient=skipped',
      'support_profile=default',
      `supported_link_forms=${supportedLinkForms}`,
      'next_action=none',
      ''
    ].join('\n'),
    stderr: ''
  })
})

test('doctor log-file replaces selected file with current stdout', async () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'confluex-doctor-log-'))
  const logFile = path.join(cwd, 'doctor.log')
  fs.writeFileSync(logFile, 'stale\n', 'utf8')

  const result = await runDoctorCommand(options({ logFile }), {
    dependencyProbe: presentProbe,
    store: storeWithValue(null),
    cwd
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
    store: storeWithValue(null),
    cwd
  })

  assert.deepEqual(result, {
    exitCode: 1,
    stdout: '',
    stderr: 'ERROR: validation_failed FR-0134\n'
  })
})

test('absent dependencies produce install next actions in governed order', async () => {
  const result = await runDoctorCommand(options(), {
    dependencyProbe: absentProbe,
    store: storeWithValue(null)
  })

  assert.equal(result.exitCode, 0)
  assert.equal(result.stderr, '')
  assert.equal(result.stdout.split('\n').at(-2), 'next_action=install_docker_cli,install_gpg,install_markdown_converter')
})

test('verify encryption without effective recipient reports missing and set action', async () => {
  const result = await runDoctorCommand(options({ verify: true }), {
    dependencyProbe: presentProbe,
    store: storeWithValue(null)
  })

  assert.equal(result.exitCode, 0)
  assert.match(result.stdout, /^encryption_recipient=missing$/m)
  assert.match(result.stdout, /^next_action=set_encryption_key$/m)
})

test('explicit recipient is validated and can report ok', async () => {
  const result = await runDoctorCommand(options({ verify: true, key: 'recipient' }), {
    dependencyProbe: presentProbe,
    recipientValidator (recipient) {
      assert.equal(recipient, 'recipient')
      return true
    },
    store: storeWithValue(null)
  })

  assert.equal(result.exitCode, 0)
  assert.match(result.stdout, /^encryption_recipient=ok$/m)
  assert.match(result.stdout, /^next_action=none$/m)
})

test('saved recipient is used when explicit key is absent', async () => {
  const result = await runDoctorCommand(options({ verify: true }), {
    dependencyProbe: presentProbe,
    recipientValidator (recipient) {
      assert.equal(recipient, 'saved-recipient')
      return true
    },
    store: storeWithValue('saved-recipient')
  })

  assert.equal(result.exitCode, 0)
  assert.match(result.stdout, /^encryption_recipient=ok$/m)
})

test('recipient validation failure reports failed and fix action when gpg is present', async () => {
  const result = await runDoctorCommand(options({ verify: true, key: 'recipient' }), {
    dependencyProbe: presentProbe,
    recipientValidator () {
      return false
    },
    store: storeWithValue(null)
  })

  assert.equal(result.exitCode, 0)
  assert.match(result.stdout, /^encryption_recipient=failed$/m)
  assert.match(result.stdout, /^next_action=fix_encryption_key$/m)
})

test('doctor page access ok emits page identity after page access line', async () => {
  const result = await runDoctorCommand({
    flags: [],
    values: { '--page-id': '123' }
  }, {
    dependencyProbe: presentProbe,
    pageAccessChecker (pageId) {
      assert.equal(pageId, '123')
      return { state: 'ok', identity: '456' }
    },
    store: storeWithValue(null)
  })

  assert.equal(result.exitCode, 0)
  assert.match(result.stdout, /^page_access=ok\npage_access_reason=none\npage_identity=456$/m)
  assert.match(result.stdout, /^next_action=none$/m)
})

test('doctor page access failure emits check page access next action', async () => {
  const result = await runDoctorCommand({
    flags: [],
    values: { '--page-id': '123' }
  }, {
    dependencyProbe: presentProbe,
    pageAccessChecker () {
      return { state: 'failed', reason: 'auth_rejected' }
    },
    store: storeWithValue(null)
  })

  assert.equal(result.exitCode, 0)
  assert.match(result.stdout, /^page_access=failed\npage_access_reason=auth_rejected$/m)
  assert.doesNotMatch(result.stdout, /^page_identity=/m)
  assert.match(result.stdout, /^next_action=check_page_access$/m)
})

test('state read failure returns utility runtime failure result', async () => {
  const result = await runDoctorCommand(options({ verify: true }), {
    dependencyProbe: presentProbe,
    store: {
      readDefaultEncryptionKey () {
        throw new Error('state read failed')
      }
    }
  })

  assert.deepEqual(result, {
    exitCode: 4,
    stdout: '',
    stderr: 'ERROR: runtime_failure doctor_state\n'
  })
})
