'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const {
  checkNodeVersion,
  nodeRuntimeDependency,
  runtimePrerequisiteFailure
} = require('../../dist/confluex-node/prereq/checks')

test('node prerequisite accepts only the governed minimum runtime', () => {
  assert.equal(checkNodeVersion('20.11.0').state, 'passed')
  assert.equal(checkNodeVersion('20.10.9').state, 'failed')
  assert.equal(checkNodeVersion('v21.0.0').state, 'passed')
})

test('node runtime dependency emits doctor-compatible state', () => {
  assert.deepEqual(nodeRuntimeDependency('v20.11.0'), {
    label: 'node_runtime',
    state: 'present:v20.11.0'
  })
  assert.deepEqual(nodeRuntimeDependency('v20.10.9'), {
    label: 'node_runtime',
    state: 'unsupported:v20.10.9'
  })
})

test('runtime prerequisite diagnostics are concise and governed', () => {
  assert.equal(
    runtimePrerequisiteFailure('node_version', 'required=>=20.11.0 actual=20.10.9'),
    'ERROR: runtime_prerequisite_failed node_version required=>=20.11.0 actual=20.10.9\n'
  )
})
