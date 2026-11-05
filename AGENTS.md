# AI 개발 워크플로

이 저장소에서 기능 변경, 버그 수정, 리팩터링 요청을 처리할 때는 코드를 바로 수정하지 말고 `docs/ai-development-workflow.md`의 Issue 기반 절차를 따른다.

## 필수 규칙

- 요청과 관련된 repository 구조, 코드, 테스트 및 열린 GitHub Issue를 먼저 분석한다. 분석 전 Issue를 만들지 않는다.
- 분석 결과를 바탕으로, 구현·수정 작업마다 GitHub Issue를 반드시 만든다(기존에 해당 작업을 정확히 다루는 열린 Issue가 있으면 그 Issue를 사용한다). Issue 없이 구현을 시작하지 않는다.
- 코드·문서·설정 등 어떤 변경이든 기존 Issue가 정확히 다루는지 먼저 확인한다. 없으면 변경 전에 새 Issue를 생성하고 `ai-triage` → `ai-ready` 절차를 거친다.
- 구현 작업의 source of truth는 GitHub Issue 본문이다. Issue에 없는 대규모 변경이나 리팩터링은 하지 않는다.
- 작업 중 Issue 본문 밖의 추가 변경이 필요해지면 별도 Issue를 만들거나 작업을 중단한다. 임의로 scope를 넓히지 않는다.
- 구현 전 Issue, 관련 코드, 영향 범위, 현재 동작을 확인하고 짧은 계획을 Issue comment에 남긴다.
- `ai-ready` Issue만 자동 구현한다. 정책 결정, 모호한 요구사항, 위험한 변경은 `needs-human`으로 전환하고 구현하지 않는다.
- 새 Issue는 먼저 `ai-triage`에서 type/size/risk와 구현 가능성을 분류한다. dependency가 열려 있거나 순환하면 worker를 시작하지 않는다.
- Issue별 브랜치는 반드시 `<issue-type>/#<number>` 형식으로 만든다. `issue-type`은 Issue 제목의 Conventional Commit 접두사(`feat`, `fix`, `refactor`, `test`, `chore`, `security`)를 사용한다. `main`/`master`에 직접 push하거나 force push하지 않는다.
- git worktree를 생성할 수 있다. 단, 작업 완료 후 반드시 `git worktree remove`와 `git worktree prune`으로 정리한다.
- 구현자와 reviewer는 논리적으로 분리한다. reviewer는 원 Issue, acceptance criteria, diff, 바뀐 파일, 관련 코드와 검증 결과를 보고 `PASS` 또는 구조화한 `REQUEST_CHANGES`만 낸다.
- 수정/review 재시도는 최대 3회다. 그 뒤에도 해결되지 않으면 `needs-human`으로 전환한다.
- 구현 뒤에는 Issue criteria와 diff를 기준으로 happy path, edge case, 회귀, validation, 인증/인가, error handling test의 누락을 별도로 검사한다. 그 뒤 재현 가능한 Quality Gate(lint, format, typecheck, coverage test, build, secret/dependency scan)를 통과해야 독립 AI review로 넘어갈 수 있다.
- Quality Gate/CI repair는 각각 최대 2회이며 테스트 삭제·검증 완화·규칙 비활성화로 통과시키지 않는다. 필수 검증과 Quality Gate가 성공하고 review가 `PASS`이면 해당 Issue의 PR을 반드시 생성한다. AI는 merge, 배포, production secret 변경, destructive DB migration을 하지 않는다.
- 검증을 통과한 변경은 의미 있는 단위로 커밋한다. 커밋하지 않은 변경을 push하거나 PR로 만들지 않으며, 커밋·push·PR 생성까지 완료한 뒤 작업 결과를 보고한다.
- 위 Issue 기반 범위 안에서는 Issue 생성/triage, worktree·branch 생성, 파일 수정, commit, push, PR 생성, worktree 정리를 별도 확인 요청 없이 수행할 수 있다. 허용 범위의 유일한 종료 권한 제한은 merge이며, AI는 merge하지 않는다.
- 토큰, secret, 개인 정보는 코드, Issue, PR, comment, 로그에 절대 넣지 않는다.

반복적인 GitHub 상태 변경은 `scripts/ai-workflow.sh`를 사용한다. 실제 명령과 템플릿은 `docs/ai-development-workflow.md`를 따른다.
