import test from 'node:test';
import assert from 'node:assert/strict';
import { judgeWithGlm, validateJudgment } from './glm.mjs';

const judgment = {
  kind: 'bug',
  summary: 'x',
  scenario: 's',
  environment: 'e',
  viewport: 'v',
  area: 'a',
  reproSteps: ['r'],
  expected: 'e',
  actual: 'a',
  acceptanceCriteria: ['c'],
  risk: 'low',
  confidence: 0.9,
  sensitiveAreas: [],
};

test('GLM client parses Anthropic-compatible JSON response', async () => {
  const result = await judgeWithGlm({
    apiKey: 'test',
    observation: { ok: true },
    fetchImpl: async () =>
      new Response(
        JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(judgment) }] }),
        { status: 200 },
      ),
  });
  assert.equal(result.kind, 'bug');
});

test('GLM judgment rejects missing or unknown fields', () => {
  assert.throws(() => validateJudgment({ kind: 'bug' }), /invalid schema/);
  assert.throws(
    () =>
      validateJudgment({ kind: 'none', summary: 'unexpected', confidence: 1, sensitiveAreas: [] }),
    /invalid schema/,
  );
});

test('GLM accepts the minimal no-issue schema', () => {
  const result = validateJudgment({ kind: 'none', confidence: 0.95, sensitiveAreas: [] });
  assert.equal(result.kind, 'none');
  assert.throws(
    () => validateJudgment({ kind: 'none', confidence: 0.95, sensitiveAreas: ['not-allowed'] }),
    /unsupported value/,
  );
});

test('GLM client rejects non-success responses', async () => {
  await assert.rejects(
    () =>
      judgeWithGlm({
        apiKey: 'test',
        observation: {},
        fetchImpl: async () => new Response('no', { status: 503 }),
      }),
    /HTTP 503/,
  );
});
