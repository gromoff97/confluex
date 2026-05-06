'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { bootstrapSelftestTarget } = require('../../lib/confluex-node/selftest/target-bootstrap')

const target = {
  baseUrl: 'http://127.0.0.1:8090',
  token: 'test-token'
}

test('selftest target bootstrap resets stand before proving it has no spaces', async () => {
  const calls = []

  const result = await bootstrapSelftestTarget(target, {
    client: {
      async resetStand () {
        calls.push({ operation: 'resetStand' })
        return { state: 'passed' }
      },
      async readSpaces (request) {
        calls.push({ operation: 'readSpaces', request })
        return []
      }
    }
  })

  assert.deepEqual(result, { state: 'passed' })
  assert.deepEqual(calls, [
    { operation: 'resetStand' },
    { operation: 'readSpaces', request: { limit: 1 } }
  ])
})

test('selftest target bootstrap fails when target already has spaces', async () => {
  const result = await bootstrapSelftestTarget(target, {
    client: {
      async resetStand () {
        return { state: 'passed' }
      },
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
      async resetStand () {
        return { state: 'passed' }
      },
      async readSpaces () {
        throw new Error('unreachable')
      }
    }
  })

  assert.deepEqual(result, { state: 'failed' })
})

test('selftest target bootstrap fails when reset API fails', async () => {
  const result = await bootstrapSelftestTarget(target, {
    client: {
      async resetStand () {
        return { state: 'failed' }
      },
      async readSpaces () {
        throw new Error('must not probe before reset')
      }
    }
  })

  assert.deepEqual(result, { state: 'failed' })
})
