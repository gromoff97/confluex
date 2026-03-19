#!/usr/bin/env bats

source "${BATS_TEST_DIRNAME}/helpers/confluex_test_helper.bash"

@test "requirements docs scaffold is structurally valid" {
  run bash "$BATS_TEST_DIRNAME/../../scripts/check-requirements-docs.sh"

  assert_success
  assert_output_contains 'PASS: requirements docs scaffold exists and headings match.'
}
