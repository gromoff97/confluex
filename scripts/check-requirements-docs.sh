#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

fail() {
  printf 'ERROR: %s\n' "$1" >&2
  exit 1
}

declare -A expected_headings=(
  ["docs/README.md"]="# Confluex Documentation"
  ["docs/AGENTS.md"]="# Requirements Agent Guide"
  ["docs/FOUNDATIONS.md"]="# Requirements Foundations"
  ["docs/WORKFLOW-DOCTOR.md"]="# Doctor Workflow Guide"
  ["docs/WORKFLOW-PLAN.md"]="# Plan Workflow Guide"
  ["docs/WORKFLOW-EXPORT.md"]="# Export Workflow Guide"
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

declare -A expected_counts=(
  ["docs/FR-CMD.md"]=6
  ["docs/FR-UX.md"]=4
  ["docs/FR-VAL.md"]=9
  ["docs/FR-OPT.md"]=18
  ["docs/FR-DIAG.md"]=7
  ["docs/FR-CONF.md"]=3
  ["docs/FR-LIFE.md"]=4
  ["docs/FR-RUN.md"]=7
  ["docs/FR-SCOPE.md"]=10
  ["docs/FR-DATA.md"]=7
  ["docs/FR-OUT.md"]=9
  ["docs/FR-REP.md"]=9
  ["docs/FR-SAFE.md"]=6
  ["docs/FR-INT.md"]=3
  ["docs/FR-RES.md"]=4
  ["docs/FR-SEC.md"]=6
  ["docs/FR-OBS.md"]=8
)

for path in "${!expected_headings[@]}"; do
  if [[ ! -f "$path" ]]; then
    fail "missing required docs file: $path"
  fi

  first_line="$(head -n 1 "$path")"
  if [[ "$first_line" != "${expected_headings[$path]}" ]]; then
    fail "unexpected heading in $path"
  fi
done

workflow_guides=(
  "docs/WORKFLOW-DOCTOR.md"
  "docs/WORKFLOW-PLAN.md"
  "docs/WORKFLOW-EXPORT.md"
)

for path in "${workflow_guides[@]}"; do
  grep -Fq '## Status' "$path" || fail "missing Status section in $path"
  grep -Fq 'This file is non-normative.' "$path" || fail "missing non-normative marker in $path"
  grep -Fq 'Canonical requirements live in `docs/FOUNDATIONS.md` and `docs/FR-*.md`.' "$path" || fail "missing canonical-source marker in $path"
  grep -Fq '## Use This Guide When' "$path" || fail "missing Use This Guide When section in $path"
  grep -Fq '## Read First' "$path" || fail "missing Read First section in $path"
  grep -Fq '## Read Next If Needed' "$path" || fail "missing Read Next If Needed section in $path"
  grep -Fq '## Typical Task Routing' "$path" || fail "missing Typical Task Routing section in $path"
  grep -Fq '## Precedence' "$path" || fail "missing Precedence section in $path"
  if rg -q '^### FR-[0-9]{4}$' "$path"; then
    fail "workflow guide must not contain normative requirement cards: $path"
  fi
  if grep -Fq '**Requirement**:' "$path"; then
    fail "workflow guide must not contain normative requirement markers: $path"
  fi
  if rg -q 'FR-[0-9]{4}|FR-[A-Z]+-[0-9]{3}' "$path"; then
    fail "workflow guide must not contain requirement IDs: $path"
  fi
done

for path in "${!expected_counts[@]}"; do
  count="$(rg -c '^### FR-[0-9]{4}$' "$path")"
  if [[ "$count" != "${expected_counts[$path]}" ]]; then
    fail "$path has $count requirement cards; expected ${expected_counts[$path]}"
  fi
done

for path in "${!expected_counts[@]}"; do
  awk '
    function check_card() {
      if (id == "") {
        return
      }
      if (!req || !app || !rat || !acc || !dep || !tr) {
        printf("ERROR: incomplete requirement card in %s at %s\n", FILENAME, id) > "/dev/stderr"
        exit 1
      }
    }
    /^### FR-[0-9]{4}$/ {
      check_card()
      id=$0
      req=app=rat=acc=dep=tr=0
      next
    }
    /^\*\*Requirement\*\*:/ { req=1; next }
    /^\*\*Applicability\*\*:/ { app=1; next }
    /^\*\*Rationale\*\*:/ { rat=1; next }
    /^\*\*Acceptance Criteria\*\*:/ { acc=1; next }
    /^\*\*Dependencies\*\*:/ { dep=1; next }
    /^\*\*Traceability\*\*:/ { tr=1; next }
    END { check_card() }
  ' "$path" || exit 1
done

mapfile -t ids < <(
  for path in "${!expected_counts[@]}"; do
    rg '^### FR-[0-9]{4}$' "$path" | sed 's/^### //'
  done
)
if [[ "${#ids[@]}" -ne 120 ]]; then
  fail "expected 120 migrated requirement IDs; found ${#ids[@]}"
fi

mapfile -t unique_ids < <(printf '%s\n' "${ids[@]}" | sort -u)
if [[ "${#unique_ids[@]}" -ne 120 ]]; then
  fail 'duplicate migrated requirement IDs detected'
fi

for i in $(seq 1 120); do
  expected_id="$(printf 'FR-%04d' "$i")"
  if [[ ! " ${ids[*]} " =~ [[:space:]]${expected_id}[[:space:]] ]]; then
    fail "missing migrated requirement ID: ${expected_id}"
  fi
done

mapfile -t referenced_ids < <(
  for path in "${!expected_counts[@]}"; do
    rg -o 'FR-[0-9]{4}' "$path"
  done | sort -u
)
for referenced_id in "${referenced_ids[@]}"; do
  if [[ ! " ${unique_ids[*]} " =~ [[:space:]]${referenced_id}[[:space:]] ]]; then
    fail "unresolved requirement reference: ${referenced_id}"
  fi
done

legacy_count=0
declare -A seen_legacy=()
declare -A seen_new=()
while read -r legacy_id new_id file_path; do
  [[ -z "$legacy_id" ]] && continue
  if [[ ! "$legacy_id" =~ ^FR-[A-Z]+-[0-9]{3}$ ]]; then
    continue
  fi
  if [[ ! "$new_id" =~ ^FR-[0-9]{4}$ ]]; then
    fail "invalid new ID in crosswalk: ${new_id}"
  fi
  if [[ ! -f "$file_path" ]]; then
    fail "crosswalk points to missing file: ${file_path}"
  fi
  if [[ -n "${seen_legacy[$legacy_id]:-}" ]]; then
    fail "duplicate legacy crosswalk ID: ${legacy_id}"
  fi
  if [[ -n "${seen_new[$new_id]:-}" ]]; then
    fail "duplicate new crosswalk ID: ${new_id}"
  fi
  seen_legacy["$legacy_id"]=1
  seen_new["$new_id"]=1
  ((legacy_count+=1))
done < <(
  awk -F'`' '
    /^\| `FR-/ {
      legacy=$2
      new=$4
      file=$6
      if (legacy ~ /^FR-[A-Z]+-[0-9]{3}$/ && new ~ /^FR-[0-9]{4}$/ && file ~ /^docs\/FR-[A-Z]+\.md$/) {
        print legacy, new, file
      }
    }
  ' docs/TRACEABILITY-MODEL.md
)

if [[ "$legacy_count" -ne 120 ]]; then
  fail "expected 120 legacy crosswalk rows; found ${legacy_count}"
fi

printf 'PASS: requirements docs validated (120 IDs, 120 crosswalk rows, 3 workflow guides).\n'
