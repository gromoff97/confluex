'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { bootstrapSelftestTarget } = require('../../lib/confluex-node/selftest/target-bootstrap')

const target = {
  baseUrl: 'http://127.0.0.1:8090',
  username: 'admin',
  password: 'admin'
}

test('selftest target bootstrap passes only when target has no spaces', async () => {
  const calls = []

  const result = await bootstrapSelftestTarget(target, {
    client: {
      async readSpaces (request) {
        calls.push(request)
        return []
      }
    }
  })

  assert.deepEqual(result, { state: 'passed' })
  assert.deepEqual(calls, [{ limit: 1 }])
})

test('selftest target bootstrap fails when target already has spaces', async () => {
  const result = await bootstrapSelftestTarget(target, {
    client: {
      async readSpaces () {
        return [{ key: 'SANDBOX', name: 'Sandbox' }]
      }
    }
  })

  assert.deepEqual(result, { state: 'failed' })
})

test('selftest target bootstrap fails when target cannot be probed', async () => {
  const result = await bootstrapSelftestTarget(target, {
    client: {
      async readSpaces () {
        throw new Error('unreachable')
      }
    }
  })

  assert.deepEqual(result, { state: 'failed' })
})
