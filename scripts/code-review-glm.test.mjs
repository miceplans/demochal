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
