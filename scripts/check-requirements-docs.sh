#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

declare -A expected_headings=(
  ["docs/README.md"]="# Confluex Documentation"
  ["docs/AGENTS.md"]="# Requirements Agent Guide"
  ["docs/FOUNDATIONS.md"]="# Requirements Foundations"
  ["docs/FR-CMD.md"]="# Command Surface Requirements"
  ["docs/FR-UX.md"]="# Operator Experience Requirements"
  ["docs/FR-VAL.md"]="# Invocation Validation Requirements"
  ["docs/FR-OPT.md"]="# Option Semantics Requirements"
  ["docs/FR-DIAG.md"]="# Diagnostics Requirements"
  ["docs/FR-CONF.md"]="# Configuration Requirements"
  ["docs/FR-LIFE.md"]="# Installation Lifecycle Requirements"
  ["docs/FR-RUN.md"]="# Run Lifecycle Requirements"
  ["docs/FR-SCOPE.md"]="# Scope Discovery Requirements"
  ["docs/FR-DATA.md"]="# Data Acquisition Requirements"
  ["docs/FR-OUT.md"]="# Output And Artifact Requirements"
  ["docs/FR-REP.md"]="# Report Requirements"
  ["docs/FR-SAFE.md"]="# Safety Requirements"
  ["docs/FR-INT.md"]="# Interruption And Runtime-Failure Requirements"
  ["docs/FR-RES.md"]="# Resume And Recovery Requirements"
  ["docs/FR-SEC.md"]="# Encryption Requirements"
  ["docs/FR-OBS.md"]="# Observability And Outcome Requirements"
  ["docs/CONFORMANCE-OUTCOME-MATRIX.md"]="# Conformance Outcome Matrix"
  ["docs/TRACEABILITY-MODEL.md"]="# Traceability Model"
  ["docs/GLOSSARY.md"]="# Glossary"
)

for path in "${!expected_headings[@]}"; do
  if [[ ! -f "$path" ]]; then
    printf 'ERROR: missing required docs file: %s\n' "$path" >&2
    exit 1
  fi

  first_line="$(head -n 1 "$path")"
  if [[ "$first_line" != "${expected_headings[$path]}" ]]; then
    printf 'ERROR: unexpected heading in %s\n' "$path" >&2
    printf 'Expected: %s\n' "${expected_headings[$path]}" >&2
    printf 'Actual: %s\n' "$first_line" >&2
    exit 1
  fi
done

printf 'PASS: requirements docs scaffold exists and headings match.\n'
