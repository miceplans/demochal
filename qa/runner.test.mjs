import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { formatHttpFailure, runQa, submitReport } from './runner.mjs';
import { validateScenario } from './scenario.mjs';

const scenario = validateScenario({
  name: 'profile password=secret',
  targetUrl: 'https://example.com',
  environment: 'staging email@example.com',
  steps: [{ action: 'fill', selector: '#name password=secret', value: 'password=secret' }],
});
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

test('model observation excludes fill values and dry-run does not submit', async () => {
  let submitted = false;
  await runQa({
    scenario,
    outputDir: await mkdtemp(join(tmpdir(), 'qa-runner-')),
    dryRun: true,
    execute: async () => ({
      url: 'https://example.com/',
      title: 'Example',
      domSummary: 'ok',
      stepResults: [],
      consoleErrors: [],
      networkFailures: [],
      screenshots: [],
    }),
    judge: async ({ observation }) => {
      assert.doesNotMatch(JSON.stringify(observation), /secret/);
      assert.doesNotMatch(JSON.stringify(observation), /email@example.com/);
      return judgment;
    },
    submit: async () => {
      submitted = true;
    },
  });
  assert.equal(submitted, false);
});

test('HTTP error evidence is formatted', () => {
  assert.match(
    formatHttpFailure({ method: 'GET', url: 'https://example.com/api', status: 503 }),
    /HTTP 503/,
  );
});

test('report submission sends the GitHub dispatch payload and rejects non-2xx', async () => {
  let request;
  const fetchImpl = async (url, options) => {
    request = { url, options };
    return new Response('', { status: 200 });
  };
  await submitReport(
    { fingerprint: 'abc' },
    { endpoint: 'https://github.example/dispatches', token: 'token', fetchImpl },
  );
  assert.equal(request.options.headers.authorization, 'Bearer token');
  assert.match(request.options.body, /qa-report/);
  await assert.rejects(
    () =>
      submitReport(
        {},
        {
          endpoint: 'https://github.example/dispatches',
          token: 'token',
          fetchImpl: async () => new Response('fail', { status: 500 }),
        },
      ),
    /HTTP 500/,
  );
});

test('browser execution failure never submits a report', async () => {
  let submitted = false;
  const outputDir = await mkdtemp(join(tmpdir(), 'qa-runner-'));
  await assert.rejects(
    () =>
      runQa({
        scenario,
        outputDir,
        execute: async () => ({ executionError: 'navigation failed' }),
        judge: async () => judgment,
        submit: async () => {
          submitted = true;
        },
      }),
    /not submitted/,
  );
  assert.equal(submitted, false);
});
