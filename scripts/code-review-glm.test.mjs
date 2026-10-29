import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('workflow, not GLM, publishes exactly one top-level PR summary', async () => {
  const workflow = await readFile('.github/workflows/code-review-glm.yml', 'utf8');

  assert.match(workflow, /--allowedTools "mcp__github_inline_comment__create_inline_comment"/);
  assert.doesNotMatch(workflow, /Bash\(gh pr comment:\*\)/);
  assert.match(workflow, /Publish GLM review summary/);
  assert.match(workflow, /if: always\(\)/);
  assert.match(workflow, /gh pr comment "\$PR_NUMBER" --body "\$body"/);
  assert.match(workflow, /GLM 코드 리뷰 요약/);
  assert.match(workflow, /github_token: \$\{\{ github\.token \}\}/);
  assert.match(workflow, /--json-schema/);
  assert.match(workflow, /SKIP_REVIEW: \$\{\{ needs\.check-quota\.outputs\.skip_review \}\}/);
  assert.match(workflow, /REVIEW_OUTCOME: \$\{\{ steps\.glm-review\.outcome \}\}/);
  assert.match(workflow, /GLM_OUTPUT: \$\{\{ steps\.glm-review\.outputs\.structured_output \}\}/);
  assert.match(workflow, /jq -er '\.summary'/);
  assert.match(workflow, /Z\.AI 잔액 또는 한도 문제로 GLM 리뷰를 실행하지 않았습니다/);
  assert.match(workflow, /GLM 리뷰 실행이 완료되지 않아 상세 요약을 생성하지 못했습니다/);
});

test('GLM review is diff-first, tiered by risk, and skips generated-only changes', async () => {
  const workflow = await readFile('.github/workflows/code-review-glm.yml', 'utf8');

  assert.match(workflow, /classify-review:/);
  assert.match(workflow, /review_model=glm-4\.5-air/);
  assert.match(workflow, /review_model=glm-4\.7/);
  assert.match(workflow, /ADDITIONS: \$\{\{ github\.event\.pull_request\.additions \}\}/);
  assert.match(workflow, /DELETIONS: \$\{\{ github\.event\.pull_request\.deletions \}\}/);
  assert.match(workflow, /changed_lines=\$\(\(ADDITIONS \+ DELETIONS\)\)/);
  assert.match(workflow, /CHANGED_FILES > 15 \|\| changed_lines > 600/);
  assert.doesNotMatch(
    workflow,
    /\$\{\{ github\.event\.pull_request\.additions \+ github\.event\.pull_request\.deletions \}\}/,
  );
  assert.match(workflow, /server\/src\/modules\/\(auth\|files\|payments\)/);
  assert.match(workflow, /packages\/api-client\/src\/generated\/\*\*/);
  assert.match(workflow, /변경 파일 목록과 diff만 검토/);
  assert.match(workflow, /전체 레포를\s*탐색하지 마/);
  assert.match(
    workflow,
    /ANTHROPIC_DEFAULT_SONNET_MODEL: \$\{\{ needs\.classify-review\.outputs\.review_model \}\}/,
  );
});
