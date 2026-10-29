import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('GLM review can publish exactly one top-level PR summary', async () => {
  const workflow = await readFile('.github/workflows/code-review-glm.yml', 'utf8');

  assert.match(
    workflow,
    /--allowedTools "mcp__github_inline_comment__create_inline_comment,Bash\(gh pr comment:\*\)"/,
  );
  assert.match(workflow, /`gh pr comment`로 PR 일반 코멘트를 정확히 한 건 남겨줘/);
  assert.match(workflow, /문제가 없으면 "문제 없음"과 검토 범위를/);
  assert.match(workflow, /문제가 있으면 인라인 지적의 요약과 확인 요청을/);
});

test('GLM review is diff-first, tiered by risk, and skips generated-only changes', async () => {
  const workflow = await readFile('.github/workflows/code-review-glm.yml', 'utf8');

  assert.match(workflow, /classify-review:/);
  assert.match(workflow, /review_model=glm-4\.5-air/);
  assert.match(workflow, /review_model=glm-4\.7/);
  assert.match(workflow, /CHANGED_FILES > 15 \|\| CHANGED_LINES > 600/);
  assert.match(workflow, /server\/src\/modules\/\(auth\|files\|payments\)/);
  assert.match(workflow, /packages\/api-client\/src\/generated\/\*\*/);
  assert.match(workflow, /변경 파일 목록과 diff만 검토/);
  assert.match(workflow, /전체 레포를\s*탐색하지 마/);
  assert.match(
    workflow,
    /ANTHROPIC_DEFAULT_SONNET_MODEL: \$\{\{ needs\.classify-review\.outputs\.review_model \}\}/,
  );
});
