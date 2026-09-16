#!/usr/bin/env bash
# Local counterpart of the PR quality-gate jobs. CI keeps checks visible as jobs;
# this script only gives workers the same deterministic pass/fail contract.
set -u -o pipefail

base_ref="${1:-origin/main}"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
failed=0

run_check() {
  local name="$1"
  shift
  if "$@" >"$tmp_dir/$name.log" 2>&1; then
    printf '%s: PASS\n' "$name"
  else
    printf '%s: FAIL\n' "$name"
    sed -n '1,160p' "$tmp_dir/$name.log"
    failed=1
  fi
}

run_check lint pnpm lint
run_check formatting node scripts/format-check.mjs --base "$base_ref"
run_check typecheck pnpm typecheck
run_check tests pnpm --filter @semochal/server test:cov
run_check api-client-build pnpm --filter @semochal/api-client build
run_check front-build pnpm --filter @semochal/front build
run_check server-build pnpm --filter @semochal/server build
run_check secret-scan node scripts/secret-scan.mjs --base "$base_ref"
run_check dependency-audit pnpm audit --prod --audit-level high

if (( failed )); then
  echo 'QUALITY_GATE_FAIL'
  exit 1
fi
echo 'QUALITY_GATE_PASS'
