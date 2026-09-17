#!/usr/bin/env bash
# Thin, deliberately non-AI helper for the GitHub-backed AI development workflow.
set -euo pipefail

readonly STATUS_LABELS=(ai-triage ai-ready ai-working ai-review ai-needs-fix ai-complete needs-human)
readonly TYPE_LABELS=(type:bug type:feature type:refactor type:security type:test type:docs type:infrastructure)
readonly SIZE_LABELS=(size:XS size:S size:M size:L size:XL)
readonly RISK_LABELS=(risk:low risk:medium risk:high risk:critical)
readonly MAX_REVIEW_RETRIES=3
readonly MAX_CI_REPAIR_RETRIES=2
readonly MAX_QUALITY_GATE_RETRIES="$MAX_CI_REPAIR_RETRIES"

die() { echo "error: $*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "'$1' is required"; }
issue_labels() { gh issue view "$1" --json labels --jq '.labels[].name'; }
has_label() { issue_labels "$1" | grep -Fxq "$2"; }

set_label_group() {
  local target="$1" group_name="$2" next="$3" label
  local -a group=("${@:4}")
  [[ " ${group[*]} " == *" $next "* ]] || die "invalid $group_name label '$next'"
  for label in "${group[@]}"; do
    [[ "$label" == "$next" ]] && continue
    gh issue edit "$target" --remove-label "$label" >/dev/null 2>&1 || true
  done
  gh issue edit "$target" --add-label "$next"
}

set_status() {
  local issue="$1" next="$2" label
  [[ " ${STATUS_LABELS[*]} " == *" $next "* ]] || die "unknown status '$next'"
  gh issue view "$issue" >/dev/null
  for label in "${STATUS_LABELS[@]}"; do
    [[ "$label" == "$next" ]] && continue
    gh issue edit "$issue" --remove-label "$label" >/dev/null 2>&1 || true
  done
  gh issue edit "$issue" --add-label "$next"
}

cmd_labels() {
  local name color description
  while IFS='|' read -r name color description; do
    gh label create "$name" --color "$color" --description "$description" --force
  done <<'LABELS'
ai-ready|0E8A16|AI can implement this issue from its specification
ai-working|1D76DB|AI worker is implementing this issue
ai-review|5319E7|Independent AI review is pending or in progress
ai-needs-fix|D93F0B|AI review requested concrete changes
ai-complete|0E8A16|AI review passed; PR may be created
needs-human|B60205|Human decision, clarification, or risk review is required
ai-triage|FBCA04|AI triage is pending or in progress
type:bug|D73A4A|Bug fix work item
type:feature|0E8A16|Feature work item
type:refactor|5319E7|Refactoring work item
type:security|B60205|Security-sensitive work item
type:test|1D76DB|Test work item
type:docs|0075CA|Documentation work item
type:infrastructure|6F42C1|Infrastructure work item
size:XS|C2E0C6|Extra small implementation scope
size:S|C2E0C6|Small implementation scope
size:M|FEF2C0|Medium implementation scope
size:L|F9D0C4|Large implementation scope
size:XL|E99695|Extra large implementation scope; human decomposition likely needed
risk:low|C2E0C6|Low regression or security risk
risk:medium|FEF2C0|Medium regression or security risk
risk:high|F9D0C4|High regression or security risk; human focus required
risk:critical|B60205|Critical security, data, or production risk; human handling required
LABELS
}

cmd_issue_create() {
  local title="$1" body="$2" labels="${3:-}"
  [[ -f "$body" ]] || die "issue body file not found: $body"
  [[ "$title" =~ ^(feat|fix|refactor|test|chore|security):\  ]] || die "title must start with feat:, fix:, refactor:, test:, chore:, or security:"
  if gh issue list --state open --search "in:title \"$title\"" --json title --jq '.[].title' | grep -Fxq "$title"; then
    die "an open issue with the same title already exists"
  fi
  local args=(issue create --title "$title" --body-file "$body") label
  IFS=',' read -r -a requested_labels <<< "$labels"
  for label in "${requested_labels[@]}"; do
    [[ -n "$label" ]] && args+=(--label "$label")
  done
  gh "${args[@]}"
}

dependencies_for() {
  gh issue view "$1" --json comments --jq '.comments[].body' \
    | sed -n 's/.*<!-- ai-dependencies: \([^>]*\) -->.*/\1/p' \
    | tail -1 | tr ',' ' '
}

has_dependency_path() {
  local source="$1" target="$2" seen="${3:-}" dep
  [[ " $seen " == *" $source "* ]] && return 1
  for dep in $(dependencies_for "$source" | tr -d '#'); do
    [[ "$dep" == "$target" ]] && return 0
    has_dependency_path "$dep" "$target" "$seen $source" && return 0
  done
  return 1
}

cmd_dependencies() {
  local issue="$1" csv="$2" dep cleaned="" display=""
  gh issue view "$issue" >/dev/null
  for dep in ${csv//,/ }; do
    [[ "$dep" =~ ^[0-9]+$ ]] || die "dependency '$dep' is not an issue number"
    [[ "$dep" != "$issue" ]] || die "an issue cannot depend on itself"
    gh issue view "$dep" >/dev/null
    has_dependency_path "$dep" "$issue" && die "dependency cycle detected: #$dep already depends on #$issue"
    cleaned="${cleaned:+$cleaned,}#$dep"
    display="${display:+$display, }#$dep"
  done
  gh issue comment "$issue" --body $'<!-- ai-dependencies: '"$cleaned"$' -->\n## AI dependency map\nThis issue depends on: '"${display:-None}"$'\nWorkers must wait until every listed issue is CLOSED.'
}

cmd_start() {
  local issue="$1" title issue_type branch dep
  title="$(gh issue view "$issue" --json title --jq .title)"
  issue_type="${title%%:*}"
  [[ "$issue_type" =~ ^(feat|fix|refactor|test|chore|security)$ ]] || die "Issue #$issue title must start with a supported Conventional Commit type"
  branch="${issue_type}/#${issue}"
  has_label "$issue" ai-ready || die "Issue #$issue is not ai-ready"
  for dep in $(dependencies_for "$issue" | tr -d '#'); do
    [[ "$(gh issue view "$dep" --json state --jq .state)" == "CLOSED" ]] || die "Issue #$issue waits for dependency #$dep"
  done
  git diff --quiet && git diff --cached --quiet || die "working tree has changes; use a separate clean worktree"
  [[ "$(git branch --show-current)" != "main" && "$(git branch --show-current)" != "master" ]] || die "create this branch in a separate worktree from origin/main"
  [[ "$(git branch --show-current)" == "$branch" ]] || die "current branch must be $branch"
  set_status "$issue" ai-working
}

cmd_triage() {
  local issue="$1" type="$2" size="$3" risk="$4" next="$5" reason_file="$6"
  [[ -f "$reason_file" ]] || die "triage reason file not found: $reason_file"
  has_label "$issue" ai-triage || die "Issue #$issue is not in ai-triage"
  set_label_group "$issue" type "type:$type" "${TYPE_LABELS[@]}"
  set_label_group "$issue" size "size:$size" "${SIZE_LABELS[@]}"
  set_label_group "$issue" risk "risk:$risk" "${RISK_LABELS[@]}"
  [[ "$next" == "ai-ready" || "$next" == "needs-human" ]] || die "triage result must be ai-ready or needs-human"
  set_status "$issue" "$next"
  gh issue comment "$issue" --body-file "$reason_file"
}

comment_count() {
  local issue="$1" marker="$2"
  gh issue view "$issue" --json comments --jq '.comments[].body' | grep -Fc "$marker" || true
}

cmd_review_result() {
  local issue="$1" result="$2" feedback="$3" retries
  [[ -f "$feedback" ]] || die "review result file not found: $feedback"
  case "$result" in
    PASS) set_status "$issue" ai-complete ;;
    REQUEST_CHANGES)
      retries="$(comment_count "$issue" '<!-- ai-review-retry -->')"
      if (( retries >= MAX_REVIEW_RETRIES )); then
        set_status "$issue" needs-human
      else
        set_status "$issue" ai-needs-fix
        gh issue comment "$issue" --body '<!-- ai-review-retry -->'
      fi
      ;;
    *) die "review result must be PASS or REQUEST_CHANGES" ;;
  esac
  gh issue comment "$issue" --body-file "$feedback"
}

cmd_ci_repair() {
  local issue="$1" report="$2" retries
  [[ -f "$report" ]] || die "CI report file not found: $report"
  retries="$(comment_count "$issue" '<!-- ai-ci-repair -->')"
  if (( retries >= MAX_CI_REPAIR_RETRIES )); then
    set_status "$issue" needs-human
    gh issue comment "$issue" --body $'CI repair retry limit reached.\n<!-- ai-ci-repair-limit -->'
    return
  fi
  gh issue comment "$issue" --body '<!-- ai-ci-repair -->'
  gh issue comment "$issue" --body-file "$report"
}

cmd_quality_gate_result() {
  local issue="$1" result="$2" report="$3" retries
  [[ -f "$report" ]] || die "quality gate report file not found: $report"
  case "$result" in
    PASS)
      has_label "$issue" ai-working || die "Issue #$issue must be ai-working before quality gate PASS"
      set_status "$issue" ai-review
      ;;
    FAIL)
      retries="$(comment_count "$issue" '<!-- ai-quality-gate-repair -->')"
      if (( retries >= MAX_QUALITY_GATE_RETRIES )); then
        set_status "$issue" needs-human
        gh issue comment "$issue" --body $'Quality Gate repair retry limit reached.\n<!-- ai-quality-gate-repair-limit -->'
      else
        set_status "$issue" ai-needs-fix
        gh issue comment "$issue" --body '<!-- ai-quality-gate-repair -->'
      fi
      ;;
    *) die "quality gate result must be PASS or FAIL" ;;
  esac
  gh issue comment "$issue" --body-file "$report"
}

cmd_pr_risk() {
  local pr="$1" risk="$2" report="$3" label existing
  [[ -f "$report" ]] || die "PR risk report file not found: $report"
  label="risk:$risk"
  [[ " ${RISK_LABELS[*]} " == *" $label "* ]] || die "risk must be low, medium, high, or critical"
  for existing in "${RISK_LABELS[@]}"; do gh pr edit "$pr" --remove-label "$existing" >/dev/null 2>&1 || true; done
  gh pr edit "$pr" --add-label "$label"
  gh pr comment "$pr" --body-file "$report"
}

cmd_discover() {
  rg -n --hidden --glob '!.git/**' --glob '!node_modules/**' --glob '!pnpm-lock.yaml' --glob '!**/dist/**' \
    --glob '!scripts/**' --glob '!docs/ai-development-workflow.md' --glob '!server/docs/openapi.html' \
    --glob '!packages/api-client/src/generated/**' \
    'TODO|FIXME|HACK|@deprecated|deprecated' . || true
}

cmd_validate() {
  pnpm lint
  pnpm typecheck
  pnpm --filter @semochal/server test
  pnpm --filter @semochal/api-client build
  pnpm --filter @semochal/front build
  pnpm --filter @semochal/server build
}

cmd_pr() {
  local issue="$1" title="$2" body="$3" branch
  [[ -f "$body" ]] || die "PR body file not found: $body"
  [[ "$title" =~ ^(feat|fix|refactor|test|chore|security):\  ]] || die "title must start with a supported prefix"
  has_label "$issue" ai-complete || die "Issue #$issue must be ai-complete after independent PASS review"
  ! has_label "$issue" needs-human || die "Issue #$issue requires human input"
  git diff --quiet && git diff --cached --quiet || die "commit changes before creating a PR"
  branch="$(git branch --show-current)"
  [[ "$branch" =~ ^(feat|fix|refactor|test|chore|security)/#${issue}- ]] || die "current branch is not an Issue #$issue branch"
  git diff --quiet "origin/main...HEAD" && die "no committed changes relative to origin/main"
  gh pr create --base main --head "$branch" --title "$title" --body-file "$body"
}

main() {
  need gh; need git
  case "${1:-}" in
    labels) cmd_labels ;;
    status) [[ $# -eq 3 ]] || die "usage: status <issue> <label>"; set_status "$2" "$3" ;;
    comment) [[ $# -eq 3 ]] || die "usage: comment <issue> <body-file>"; [[ -f "$3" ]] || die "comment file not found: $3"; gh issue comment "$2" --body-file "$3" ;;
    issue-create) [[ $# -ge 3 && $# -le 4 ]] || die "usage: issue-create <title> <body-file> [labels]"; cmd_issue_create "$2" "$3" "${4:-}" ;;
    dependencies) [[ $# -eq 3 ]] || die "usage: dependencies <issue> <comma-separated-issues>"; cmd_dependencies "$2" "$3" ;;
    start) [[ $# -eq 2 ]] || die "usage: start <issue>"; cmd_start "$2" ;;
    triage) [[ $# -eq 7 ]] || die "usage: triage <issue> <type> <size> <risk> <ai-ready|needs-human> <reason-file>"; cmd_triage "$2" "$3" "$4" "$5" "$6" "$7" ;;
    review-result) [[ $# -eq 4 ]] || die "usage: review-result <issue> <PASS|REQUEST_CHANGES> <result-file>"; cmd_review_result "$2" "$3" "$4" ;;
    ci-repair) [[ $# -eq 3 ]] || die "usage: ci-repair <issue> <report-file>"; cmd_ci_repair "$2" "$3" ;;
    quality-gate-result) [[ $# -eq 4 ]] || die "usage: quality-gate-result <issue> <PASS|FAIL> <report-file>"; cmd_quality_gate_result "$2" "$3" "$4" ;;
    pr-risk) [[ $# -eq 4 ]] || die "usage: pr-risk <pr> <low|medium|high|critical> <report-file>"; cmd_pr_risk "$2" "$3" "$4" ;;
    discover) [[ $# -eq 1 ]] || die "usage: discover"; cmd_discover ;;
    validate) [[ $# -eq 1 ]] || die "usage: validate"; cmd_validate ;;
    pr) [[ $# -eq 4 ]] || die "usage: pr <issue> <title> <body-file>"; cmd_pr "$2" "$3" "$4" ;;
    quality-gate) [[ $# -le 2 ]] || die "usage: quality-gate [base-ref]"; ./scripts/quality-gate.sh "${2:-origin/main}" ;;
    *) die "usage: $0 {labels|status|comment|issue-create|dependencies|start|triage|review-result|ci-repair|quality-gate-result|pr-risk|discover|validate|quality-gate|pr}" ;;
  esac
}

main "$@"
