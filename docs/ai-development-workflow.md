# GitHub Issue 기반 AI 개발 자동화

이 저장소의 AI 개발 단위는 **요청이 아니라 GitHub Issue**다. Codex CLI에서 자연어로 요청하면 Codex가 이 문서와 루트 `AGENTS.md`를 따라 분석, 명세화, 구현, 독립 review, PR 생성을 수행한다. GitHub Issue/label/comment/PR이 별도 DB 없이 작업의 감사 기록과 상태 저장소가 된다.

## 최초 설정

저장소 관리자 또는 권한 있는 개발자가 한 번 실행한다.

```bash
gh auth login -h github.com
./scripts/ai-workflow.sh labels
```

CLI 토큰은 private repository에서 Issue/PR을 읽고 쓰며 branch를 push할 수 있는 `repo` 권한과 workflow 파일을 push할 수 있는 `workflow` 권한이 필요하다. 토큰 값은 Issue, PR, 로그에 기록하지 않는다.

## 상태와 소유권

| Label          | 의미                                                            |
| -------------- | --------------------------------------------------------------- |
| `ai-ready`     | 명세가 충분하여 AI가 구현할 수 있음                             |
| `ai-working`   | worker가 현재 구현 중                                           |
| `ai-review`    | 구현 완료, 독립 reviewer 대기/진행 중                           |
| `ai-needs-fix` | deterministic Quality Gate 또는 reviewer가 구체적 수정을 요청함 |
| `ai-complete`  | review 통과 및 PR 생성 가능                                     |
| `needs-human`  | 정책/정보/위험 판단이 필요하여 자동화 중단                      |

추가 분류 label은 `type:bug|feature|refactor|security|test|docs|infrastructure`, `size:XS|S|M|L|XL`, `risk:low|medium|high|critical`이다. 각 그룹도 동시에 하나만 유지한다.

상태 label은 하나만 유지한다. Issue comment는 시작 계획, 검증 요약, review 결과, PR 링크처럼 추적 가치가 있는 전환에서만 남긴다.

## AI Triage와 dependency

Issue 생성 직후 [Issue AI orchestration](../.github/workflows/issue-ai-orchestration.yml)이 `ai-triage`를 붙이고, 설정된 신뢰된 AI runner에게 triage를 전달한다. runner는 Issue 전체 명세와 관련 코드를 읽고 다음만 결정한다.

- type: `bug`, `feature`, `refactor`, `security`, `test`, `docs`, `infrastructure`
- size: `XS`~`XL`
- risk: `low`~`critical`
- 결과 상태: 충분히 명세화된 경우만 `ai-ready`, 그 외 `needs-human`

runner는 추측하지 않는다. 본문이 부족하거나 정책 결정이 필요한 경우 이유와 함께 `needs-human`으로 분류한다. 수동 triage도 같은 계약을 사용한다.

```bash
./scripts/ai-workflow.sh triage 123 bug M medium ai-ready /tmp/triage.md
```

Planner는 여러 Issue의 선후 관계를 분석하고 다음 명령으로 GitHub comment에 사람이 읽을 수 있는 dependency map을 남긴다. marker는 worker가 실제로 읽는 source of truth다.

```bash
./scripts/ai-workflow.sh dependencies 104 101,102
```

명령은 Issue 존재, self dependency, 순환 dependency를 검사한다. worker 시작은 모든 선행 Issue가 `CLOSED`일 때만 허용된다. dependency 없는 Issue는 별도 worktree/branch에서 병렬 실행할 수 있다. `ai-ready` label 이벤트는 Issue 번호별 Actions concurrency group으로 직렬화되어 같은 Issue의 runner dispatch가 중복되지 않는다. 동일 파일을 크게 수정할 가능성은 Issue의 `Conflict Surface`에서 Planner가 선언하고, worker가 순차 처리로 넘긴다.

## Planner: 자연어 요청을 Issue로 만들기

예: `admin 인증 구조를 분석해서 문제를 작업 단위로 나누고 GitHub Issue로 만들어줘.`

1. workspace 구조, `AGENTS.md`/`CLAUDE.md`, package scripts, 관련 코드와 테스트, 기존 CI를 읽는다.
2. `gh issue list --state open`으로 열린 Issue를 확인해 중복이나 이미 진행 중인 작업을 제외한다.
3. 현재 동작, 위험, 의존성을 근거와 함께 분석한다. 분석만으로 해결할 수 없는 정책 선택은 `needs-human` Issue로 만든다.
4. 독립 구현·검증 가능한 최소 작업으로 나눈다. 의존 Issue가 있으면 본문 `Dependencies`에 `#번호`로 기록하고 Issue comment에도 링크한다.
5. [AI work issue form](../.github/ISSUE_TEMPLATE/ai-work.yml)의 모든 섹션을 채운다. 구현 가능한 작업에만 `ai-ready`를 붙인다.

`gh`로 본문 파일을 사용해 생성한다. 스크립트는 동일한 열린 제목이 있으면 생성을 거부한다.

```bash
./scripts/ai-workflow.sh issue-create 'fix: admin session redirect loop' /tmp/issue.md ai-ready
```

## CLI UX

별도 slash command는 필요 없다. Codex CLI에서 다음처럼 자연어로 요청한다. 루트 `AGENTS.md`가 이 절차를 기본 동작으로 만든다.

| 요청                                                     | Codex 동작                                                                                           |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `이 요구사항을 분석해서 Issue로 만들어줘.`               | Planner 절차로 분석·중복 확인·Issue 명세화                                                           |
| `Issue #123 구현해줘.`                                   | Worker 절차로 branch/worktree·구현·검증                                                              |
| `PR #456을 Issue 기준으로 리뷰해줘.`                     | PR의 연결 Issue와 diff를 읽는 독립 review. `PASS`/`REQUEST_CHANGES`만 반환                           |
| `이 요구사항을 분석하고 Issue 생성부터 PR까지 진행해줘.` | Planner 후 `ai-ready` Issue를 순서대로 Worker/Reviewer/PR 절차로 진행. `needs-human` 항목에서는 멈춤 |

## Worker: Issue에서 branch까지

예: `Issue #123 구현해줘.`

1. `gh issue view 123`으로 원문과 labels를 확인한다. `ai-ready`가 아니면 중단한다.
2. 관련 코드, 현재 구현, 영향 범위와 repository 검증 명령을 탐색한다. 구현 계획을 Issue에 간결하게 comment한다.
3. 깨끗한 작업 트리 또는 별도 worktree에서 branch를 만든다. 사용자 변경이 있는 worktree는 사용하지 않는다.

```bash
git worktree add ../semochall-issue-123 -b fix/#123 origin/main
cd ../semochall-issue-123
./scripts/ai-workflow.sh start 123
```

4. `ai-working`으로 전환하고 Issue의 scope와 acceptance criteria만 구현한다.
5. 먼저 테스트와 Quality Gate를 실행한다. 이 monorepo의 기본 검증은 lint, formatting, typecheck, server unit/coverage test, api-client unit test, 실제 build 대상(`api-client`, `front`, `server`)의 build, changed-line secret scan, production dependency audit이다. 현재 root `pnpm build`는 build script가 없는 `packages/config`까지 선택하므로 이 워크플로에서는 사용하지 않는다.

```bash
./scripts/ai-workflow.sh validate
./scripts/ai-workflow.sh quality-gate origin/main
```

6. `quality-gate`는 각 검사와 마지막 `QUALITY_GATE_PASS` 또는 `QUALITY_GATE_FAIL`을 출력한다. FAIL이면 reviewer에게 넘기지 않는다. worker는 원인 코드를 최소 수정한 뒤 같은 Gate를 재실행한다. 결과 report는 GitHub state에도 남긴다.

```bash
./scripts/ai-workflow.sh quality-gate-result 123 PASS /tmp/quality-gate.md
# FAIL이면 ai-needs-fix로 전환하고 worker가 다시 작업한다.
./scripts/ai-workflow.sh quality-gate-result 123 FAIL /tmp/quality-gate.md
```

Quality Gate PASS만 `ai-review` 상태로 전환한다. FAIL은 `MAX_QUALITY_GATE_RETRIES=2`(기존 CI repair 값과 동일)까지 수정할 수 있으며, 반복 실패·원인 불명·Gate 우회가 필요해 보이는 경우 `needs-human`으로 전환한다. 테스트 삭제, lint/typecheck/coverage/security 규칙 완화, 오류 ignore는 허용하지 않는다.

7. 각 acceptance criterion과 결과를 확인해 Issue에 요약한다. 실패한 검증은 성공으로 표기하지 않는다.

### Test Agent 점검

검증 명령 실행과 별개로 구현자와 다른 test agent/session이 Issue acceptance criteria와 `git diff origin/main...HEAD`를 읽는다. 이 agent는 기존 Vitest/Nest 및 기존 frontend test 관례를 우선하며 새 framework를 추가하지 않는다. 다음 관점에서 누락된 테스트를 report한다: happy path, edge case, regression, input validation, authentication, authorization, error handling. 의미 있는 누락은 worker가 테스트를 추가한 뒤 review로 진행한다.

## Quality Gate와 independent review의 분리

Quality Gate는 AI 판단을 하지 않는 객관적 검사다. lint, 변경 파일 formatting, typecheck, server coverage test, api-client 회귀 test(`pnpm --filter @semochal/api-client test`), build, 추가된 줄의 credential pattern, production dependency의 high/critical vulnerability만 판정한다. formatting은 기존 전체 baseline을 일괄 수정하거나 기존 부채 때문에 모든 PR을 막지 않도록 PR/worker 변경 파일에만 적용한다. coverage는 이미 존재하던 `test:cov` 명령을 사용하지만, 현재 baseline/threshold가 없으므로 새 전역 threshold는 강제하지 않는다. e2e config는 존재하나 실행에 필요한 환경과 테스트가 정립되지 않았고, OpenAPI YAML과 Drizzle migration은 검증 전용 명령/격리 DB가 없으므로 이번 Gate에서는 `PARTIAL`로 두고 자동 실행하지 않는다.

Issue/PR risk도 Gate 실행 범위를 결정한다. `low`는 기본 Gate, `medium`은 test agent가 변경 API/validation의 관련 regression test를 추가 확인, `high`는 관련 test 범위와 security 결과를 반드시 확인하고 human reviewer focus를 PR에 기록한다. `critical`은 Gate가 통과해도 `needs-human`으로 넘겨 human security/data review 없이는 진행하지 않는다. Gate 자체의 기준은 risk에 따라 낮아지지 않는다.

AI reviewer는 lint/typecheck 같은 deterministic check를 대체하지 않는다. Gate가 PASS한 뒤에만 다음 의미적 검토를 수행한다.

## Independent review와 수정

worker가 `ai-review`로 전환한 뒤, 구현자와 다른 Codex agent/session이 review한다. reviewer 입력은 원 Issue, criteria, `git diff origin/main...HEAD`, 변경 파일, 관련 코드, 검증 결과다.

reviewer 결과 형식:

```text
PASS
```

또는:

```text
REQUEST_CHANGES
- 위치: server/src/example.ts:42
  원인: 권한 검증이 누락됨
  중요도: high
  조건: 일반 사용자가 admin endpoint를 호출할 때
  필요한 수정: 역할 guard를 적용하고 회귀 테스트를 추가할 것
```

`REQUEST_CHANGES`는 file, location, severity, problem, reason, required fix를 반드시 포함한다. `ai-needs-fix`로 전환하고 worker가 정확히 그 피드백만 해결한 뒤 다시 검증/review한다. `./scripts/ai-workflow.sh review-result`은 `MAX_REVIEW_RETRIES=3` marker를 기록하며 초과 시 `needs-human`으로 전환한다. reviewer 자신이 구현을 수정하거나 자신의 변경을 승인해서는 안 된다.

## PR

review `PASS`, 필수 검증 성공, Issue `ai-complete`일 때만 만든다. PR에는 사람이 판단할 수 있는 근거를 남긴다.

```bash
git push -u origin HEAD
./scripts/ai-workflow.sh pr 123 'fix: prevent admin session redirect loop' /tmp/pr.md
```

PR body에는 다음을 포함한다.

```md
Closes #123

## Summary

## Changes

## Implementation Details

## Testing

- `pnpm lint` — pass
- `pnpm typecheck` — pass
- `pnpm --filter @semochal/server test` — pass
- `pnpm --filter @semochal/api-client test` — pass
- `pnpm --filter @semochal/api-client build && pnpm --filter @semochal/front build && pnpm --filter @semochal/server build` — pass

## Acceptance Criteria

- [x] ...

## AI Review

PASS (reviewer: separate agent/session)

## Risk / Regression Points

## Human reviewer focus
```

AI는 PR까지만 만든다. 인간 reviewer가 최종 merge를 담당한다.

### PR risk scoring

PR 생성 및 synchronize 시 [PR AI orchestration](../.github/workflows/pr-ai-orchestration.yml)이 독립 AI runner에 diff 기반 risk analysis를 전달한다. 단순 line count 대신 authentication, authorization, payment, database/migration, infrastructure, file ownership, secrets, permissions, API contract, 변경 의미와 regression surface를 분석한다.

결과는 PR의 단일 `risk:low|medium|high|critical` label 및 review comment로 기록한다.

```bash
./scripts/ai-workflow.sh pr-risk 456 high /tmp/pr-risk.md
```

`HIGH`와 `CRITICAL` report에는 사람이 확인할 파일/동작/attack or regression path를 구체적으로 적는다. 어떤 risk든 자동 merge는 하지 않는다.

## GitHub Actions 책임과 PR Quality Gate

`.github/workflows/pr-validation.yml`은 PR의 `opened`, `synchronize`, `reopened` 이벤트에서 기존 CI를 재사용해 `lint`, `formatting`, `typecheck`, `tests`, `build`를 각각 보이는 job으로 실행한다. 새 `secret-scan`은 PR에서 추가한 줄만 검사하고 값 자체를 출력하지 않으며, `dependency-audit`은 production dependency의 high/critical known vulnerability를 막는다. 마지막 `quality-gate` job은 일곱 job 모두 성공할 때만 `QUALITY_GATE_PASS`로 성공한다. 이 job이 PR의 재현 가능한 최종 Gate다.

`issue-ai-orchestration.yml`은 Issue triage/worker label event를, `pr-ai-orchestration.yml`은 PR risk와 failed validation event를 신뢰된 AI runner에 전달한다. 이들은 code checkout/수정/merge를 하지 않는다.

AI runner를 연결하려면 repository secret `AI_AUTOMATION_WEBHOOK_URL`, `AI_AUTOMATION_WEBHOOK_TOKEN`을 설정한다. runner는 자기 GitHub token으로 Issue/PR 내용을 다시 읽고, `scripts/ai-workflow.sh`의 guard를 통과해 labels/comments/branch/PR을 변경한다. secret이 없으면 dispatch는 no-op으로 성공하며 `ai-triage`는 사람이 CLI에서 처리할 수 있다. Actions 권한은 `contents: read`, Issue label/comment용 `issues: write`, PR metadata용 `pull-requests: read`로 한정된다. fork PR에는 secret이 노출되지 않는다.

### CI failure / Quality Gate repair

PR Quality Gate를 포함한 validation 실패는 runner에게 workflow run URL만 전달한다. runner는 실패한 job의 log와 Issue/diff를 읽고 안전하고 최소적인 수정일 때만 AI branch에 commit/push한다. `./scripts/ai-workflow.sh ci-repair`가 `MAX_CI_REPAIR_RETRIES=2`를 기록하며, 반복 실패·원인 불명·위험한 수정은 `needs-human`으로 전환한다. 테스트 삭제, assertion 완화, validation/typecheck 비활성화, coverage 기준 하향, security scan 비활성화로 CI를 우회할 수 없다.

### Branch protection

저장소 설정은 자동으로 바꾸지 않는다. 기본 branch ruleset 또는 branch protection에서 **Required status check**로 `quality-gate`를 지정한다. 필요하다면 개별 원인을 빠르게 보이게 하기 위해 `lint`, `formatting`, `typecheck`, `tests`, `build`, `secret-scan`, `dependency-audit`도 함께 required로 지정한다. `quality-gate` 실패 시 merge는 불가능하고, 통과 후에도 human approval과 human merge가 필요하다.

## 수동 Issue Discovery

Discovery는 기본 자동 실행하지 않는다. Codex에 `repository를 scan해서 Issue 후보만 보고해줘`라고 요청하거나 아래 명령으로 후보를 시작한다.

```bash
./scripts/ai-workflow.sh discover
```

TODO/FIXME, deprecated usage를 기계적으로 후보로 찾은 뒤 AI가 OpenAPI/구현 불일치, 테스트 누락, authorization, documentation mismatch, dead code, 반복 CI 실패를 실제 코드와 기존 열린 Issue에 대조한다. confidence가 낮으면 Issue를 만들지 않고 candidate report로만 남긴다. 충분한 근거, 중복 없음, 적절한 중요도가 확인된 경우에만 Planner 절차로 Issue를 만든다.

## 금지 및 중단 조건

- `main`/`master` 직접 push, force push, auto merge, production deploy 금지
- 파괴적 migration, production secret/config 변경, 승인 없는 인증/인가 정책 변경 금지
- scope 밖의 대규모 변경, 모호한 acceptance criteria, 검증 실패는 `needs-human`으로 전환
- secret/API key를 source, Issue, PR, comment, output에 노출 금지

## 실제 사용 예

개발자: `admin 인증 구조 분석해서 버그들을 Issue로 만들어줘.`

Codex: repository와 열린 Issue를 분석한 뒤, 예를 들어 `fix: ...` Issue 3개를 작성한다. 구현 가능한 것은 `ai-ready`, 정책 선택이 필요한 것은 `needs-human`으로 표시한다.

개발자: `Issue #101 구현해줘.`

Codex: `fix/#101` branch/worktree에서 구현·검증하고, 별도 agent/session review가 통과하면 `Closes #101` PR을 생성한다. Issue와 PR comments/labels에서 계획, 검증, review 판단과 변경 이력을 모두 추적할 수 있다.
