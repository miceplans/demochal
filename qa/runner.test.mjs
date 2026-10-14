import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, writeFile } from 'node:fs/promises';
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

test('no-issue judgment stores only the judgment and never submits', async () => {
  let submitted = false;
  const outputDir = await mkdtemp(join(tmpdir(), 'qa-runner-'));
  const screenshot = join(outputDir, 'filled-user@example.com.png');
  await writeFile(join(outputDir, 'report.json'), 'stale report');
  await writeFile(join(outputDir, 'observation.json'), 'stale observation');
  await writeFile(screenshot, 'filled user@example.com');
  const result = await runQa({
    scenario,
    outputDir,
    execute: async () => ({
      url: 'https://example.com/',
      title: 'Example user@example.com',
      domSummary: 'password=secret',
      stepResults: [{ label: 'cookie=session-secret', error: 'Bearer abc123' }],
      consoleErrors: ['email@example.com'],
      networkFailures: [],
      screenshots: [screenshot],
    }),
    judge: async () => ({ kind: 'none', confidence: 0.95, sensitiveAreas: [] }),
    submit: async () => {
      submitted = true;
    },
  });
  assert.equal(result.status, 'no_issue');
  assert.equal(submitted, false);
  assert.deepEqual(
    JSON.parse(await readFile(join(outputDir, 'judgment.json'), 'utf8')),
    result.judgment,
  );
  await assert.rejects(() => access(join(outputDir, 'report.json')));
  await assert.rejects(() => access(join(outputDir, 'observation.json')));
  await assert.rejects(() => access(screenshot));
});

test('invalid judgment never submits a report', async () => {
  let submitted = false;
  const outputDir = await mkdtemp(join(tmpdir(), 'qa-runner-'));
  await assert.rejects(
    () =>
      runQa({
        scenario,
        outputDir,
        execute: async () => ({ url: 'https://example.com/', screenshots: [] }),
        judge: async () => ({
          kind: 'none',
          confidence: 1,
          sensitiveAreas: [],
          extra: 'untrusted',
        }),
        submit: async () => {
          submitted = true;
        },
      }),
    /invalid schema/,
  );
  assert.equal(submitted, false);
});

test('defect judgment still writes a report and submits it', async () => {
  let submitted;
  const outputDir = await mkdtemp(join(tmpdir(), 'qa-runner-'));
  const result = await runQa({
    scenario,
    outputDir,
    execute: async () => ({
      url: 'https://example.com/',
      title: 'Example',
      domSummary: 'ok',
      stepResults: [],
      consoleErrors: [],
      networkFailures: [],
      screenshots: [],
    }),
    judge: async () => judgment,
    submit: async (report) => {
      submitted = report;
    },
  });
  assert.equal(result.status, 'ok');
  assert.equal(submitted.fingerprint, result.report.fingerprint);
  assert.deepEqual(
    JSON.parse(await readFile(join(outputDir, 'report.json'), 'utf8')),
    result.report,
  );
  assert.match(await readFile(join(outputDir, 'observation.json'), 'utf8'), /Example/);
});
