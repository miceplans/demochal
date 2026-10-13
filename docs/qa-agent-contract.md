# Browser QA Agent 계약

이 문서는 외부 브라우저 QA runner와 이 저장소의 GitHub Actions 사이의 경계를 정의한다. QA runner는 브라우저를 탐색하지만 저장소 코드를 수정하거나 PR을 만들지 않는다.

## 시작

`Browser QA agent` workflow를 수동 실행한다. workflow는 다음 정보만 trusted runner에 전달한다.

```json
{
  "mode": "qa",
  "qa": {
    "targetUrl": "https://staging.example.com",
    "scenario": "프로필 저장",
    "environment": "staging",
    "reportEvent": "qa-report"
  }
}
```

`AI_AUTOMATION_WEBHOOK_TOKEN`은 Authorization header에만 사용한다. URL, 시나리오, Issue, 로그, screenshot metadata에 token·cookie·password·개인정보를 넣지 않는다.

## 결과 제출

runner는 GitHub `repository_dispatch`의 `qa-report` event로 다음 형태의 `client_payload.report`를 제출한다. GitHub token은 runner에만 보관한다.

```json
{
  "kind": "bug",
  "summary": "저장 버튼이 동작하지 않음",
  "url": "https://staging.example.com/profile",
  "scenario": "프로필 저장",
  "environment": "staging / desktop",
  "viewport": "390x844",
  "area": "profile editor",
  "reproSteps": ["프로필을 연다", "값을 변경하고 저장한다"],
  "expected": "성공 피드백이 표시된다",
  "actual": "화면 변화가 없다",
  "acceptanceCriteria": ["성공 피드백이 표시된다"],
  "risk": "low",
  "confidence": 0.95,
  "screenshots": [],
  "consoleErrors": [],
  "networkFailures": [],
  "sensitiveAreas": []
}
```

검증기는 Issue를 만들기 전에 필수 필드, URL scheme, 길이, 배열 크기, risk, confidence, 민감 영역을 확인하고 URL 자격증명·토큰·email·전화번호를 `[REDACTED]`로 치환한다.

## 자동화 경계

- `confidence < 0.8` 또는 `risk`가 `high`/`critical`이면 `needs-human` Issue를 만든다.
- `sensitiveAreas`는 반드시 배열로 보내야 하며, 값이 없을 때는 빈 배열을 명시한다.
- `sensitiveAreas`에 `auth`, `authorization`, `payment`, `personal-data`, `data-deletion`, `security`, `policy`가 하나라도 있으면 risk 값과 무관하게 `needs-human` Issue를 만든다.
- 인증/인가, 결제, 개인정보, 데이터 삭제, 보안, 정책 변경은 report의 risk를 높게 설정한다.
- 정상 report는 `fix:` 또는 `feat:` Issue로 만들고 `ai-triage`에 위임한다.
- fingerprint가 같은 열린 QA Issue가 있으면 새 Issue 대신 기존 Issue에 재현 comment를 추가한다.
- QA Issue 생성 이후의 구현·검증·review·PR은 기존 `docs/ai-development-workflow.md`를 따른다.

## 실제 브라우저 runner 실행

저장소의 `qa/runner.mjs`는 Playwright로 Chromium을 실행하고, GLM은 관찰 결과를 QA report JSON으로 판정한다. GLM은 브라우저 도구를 직접 호출하지 않는다.

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm qa:browser -- --scenario qa/scenario.example.json --dry-run
```

실제 제출 시에는 다음 환경변수를 runner에만 설정한다.

```text
GLM_API_KEY 또는 ZAI_API_KEY
GLM_BASE_URL=https://api.z.ai/api/anthropic
GLM_MODEL=glm-4.7
QA_REPORT_TOKEN=<GitHub repository_dispatch 권한 token>
GITHUB_REPOSITORY=owner/repository
```

`QA_REPORT_ENDPOINT`를 지정하면 기본 GitHub repository dispatch endpoint를 대체할 수 있다. GitHub Issue workflow가 받는 event type은 `qa-report`다. `--dry-run`은 GitHub에 제출하지 않고 `QA_OUTPUT_DIR`에 screenshot과 `report.json`만 저장한다.

시나리오는 JSON으로 정의하며 지원 action은 `click`, `fill`, `press`, `wait`, `screenshot`이다. 인증이 필요한 시나리오는 cookie나 password를 파일·Issue·로그에 기록하지 않는 별도 staging 계정과 runner 전용 secret을 사용한다.
