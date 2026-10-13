import test from 'node:test';
import assert from 'node:assert/strict';
import { validateScenario } from './scenario.mjs';

test('scenario validates supported browser actions', () => {
  const result = validateScenario({
    name: 'smoke',
    targetUrl: 'https://example.com',
    steps: [{ action: 'wait', ms: 10 }],
  });
  assert.equal(result.viewport.width, 1440);
});

test('scenario rejects unsafe or malformed steps', () => {
  assert.throws(
    () =>
      validateScenario({
        name: 'bad',
        targetUrl: 'javascript:alert(1)',
        steps: [{ action: 'wait', ms: 1 }],
      }),
    /http/,
  );
  assert.throws(
    () =>
      validateScenario({
        name: 'bad',
        targetUrl: 'https://user:pass@example.com',
        steps: [{ action: 'wait', ms: 1 }],
      }),
    /credentials/,
  );
  assert.throws(
    () =>
      validateScenario({
        name: 'bad',
        targetUrl: 'https://example.com',
        steps: [{ action: 'fill', selector: '#x' }],
      }),
    /value/,
  );
});
