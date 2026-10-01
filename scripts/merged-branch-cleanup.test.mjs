#!/usr/bin/env node
/**
 * Unit tests for scripts/merged-branch-cleanup.mjs. The GitHub API is replaced
 * by a deterministic in-memory mock, so every run is offline and reproducible.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { createCleaner } from './merged-branch-cleanup.mjs';

const NOW = new Date('2026-10-01T12:00:00Z');
const MERGED_25H_AGO = '2026-09-30T11:00:00Z';
const MERGED_2H_AGO = '2026-10-01T10:00:00Z';
const COMMIT_BEFORE_MERGE = '2026-09-30T10:00:00Z';
const COMMIT_AFTER_MERGE = '2026-09-30T12:00:00Z';

function jsonResponse(body, status = 200) {
  const nullBody = status === 204 || status === 205 || status === 304;
  return new Response(nullBody ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// handlers: { 'METHOD /pathname': [status, body] }. A request with no matching
// handler throws, so fetching something the test did not expect fails loudly.
function mockFetch(handlers) {
  const calls = [];
  const fn = async (url, init = {}) => {
    const key = `${init.method ?? 'GET'} ${new URL(url).pathname}`;
    const handler = handlers[key];
    if (!handler) throw new Error(`no mock handler for ${key}`);
    const [status, body] = handler;
    calls.push({ key, body: init.body ? JSON.parse(init.body) : undefined });
    return jsonResponse(body ?? {}, status);
  };
  fn.calls = calls;
  fn.has = (method, fragment) =>
    calls.some((call) => call.key.startsWith(`${method} `) && call.key.includes(fragment));
  fn.count = (method) => calls.filter((call) => call.key.startsWith(`${method} `)).length;
  return fn;
}

function defaultHandlers(overrides = {}) {
  return {
    'GET /repos/octo/demo': [200, { default_branch: 'main' }],
    'GET /search/issues': [
      200,
      {
        items: [
          { number: 10, pull_request: { merged_at: MERGED_25H_AGO } },
          { number: 11, pull_request: { merged_at: MERGED_2H_AGO } },
        ],
      },
    ],
    'GET /repos/octo/demo/pulls/10': [
      200,
      { head: { ref: 'feat/old', sha: 'aaaa', repo: { full_name: 'octo/demo' } } },
    ],
    'GET /repos/octo/demo/git/ref/heads/feat/old': [200, { object: { sha: 'aaaa' } }],
    'GET /repos/octo/demo/commits/aaaa': [
      200,
      { commit: { committer: { date: COMMIT_BEFORE_MERGE } } },
    ],
    'DELETE /repos/octo/demo/git/ref/heads/feat/old': [204],
    'POST /repos/octo/demo/issues/10/comments': [201, {}],
    ...overrides,
  };
}

function makeCleaner(handlers, options = {}) {
  const fetchImpl = mockFetch(handlers);
  const cleaner = createCleaner({
    repo: 'octo/demo',
    token: 'example-token',
    fetchImpl,
    now: () => NOW,
    log: () => {},
    ...options,
  });
  return { cleaner, fetchImpl };
}

test('deletes inactive merged branches and comments on the PR', async () => {
  const { cleaner, fetchImpl } = makeCleaner(defaultHandlers());
  const summary = await cleaner.run();

  assert.equal(summary.scanned, 2);
  assert.deepEqual(summary.deleted, ['feat/old']);
  assert.deepEqual(summary.wouldDelete, []);
  assert.ok(fetchImpl.has('DELETE', '/git/ref/heads/feat/old'));
  const comment = fetchImpl.calls.find(
    (call) => call.key === 'POST /repos/octo/demo/issues/10/comments',
  );
  assert.ok(comment, 'expected an audit comment on PR #10');
  assert.match(comment.body.body, /feat\/old/);
  assert.ok(!fetchImpl.has('GET', '/pulls/11'), 'recently merged PR must not be inspected');
});

test('keeps branches merged within the retention window', async () => {
  const handlers = defaultHandlers({
    'GET /search/issues': [
      200,
      { items: [{ number: 11, pull_request: { merged_at: MERGED_2H_AGO } }] },
    ],
  });
  const { cleaner, fetchImpl } = makeCleaner(handlers);
  const summary = await cleaner.run();

  assert.deepEqual(summary.deleted, []);
  assert.equal(fetchImpl.calls.filter((call) => call.key.includes('/pulls/')).length, 0);
});

test('keeps branches with new commits pushed after the merge', async () => {
  const handlers = defaultHandlers({
    'GET /repos/octo/demo/git/ref/heads/feat/old': [200, { object: { sha: 'cccc' } }],
  });
  const { cleaner, fetchImpl } = makeCleaner(handlers);
  const summary = await cleaner.run();

  assert.deepEqual(summary.deleted, []);
  assert.ok(summary.skipped.some((entry) => entry.reason.includes('new commits')));
  assert.ok(!fetchImpl.has('DELETE', 'feat/old'));
});

test('keeps branches whose head commit postdates the merge', async () => {
  const handlers = defaultHandlers({
    'GET /repos/octo/demo/commits/aaaa': [
      200,
      { commit: { committer: { date: COMMIT_AFTER_MERGE } } },
    ],
  });
  const { cleaner } = makeCleaner(handlers);
  const summary = await cleaner.run();

  assert.deepEqual(summary.deleted, []);
  assert.ok(summary.skipped.some((entry) => entry.reason.includes('newer than the merge')));
});

test('never deletes the default branch', async () => {
  const handlers = defaultHandlers({
    'GET /repos/octo/demo/pulls/10': [
      200,
      { head: { ref: 'main', sha: 'aaaa', repo: { full_name: 'octo/demo' } } },
    ],
  });
  const { cleaner, fetchImpl } = makeCleaner(handlers);
  const summary = await cleaner.run();

  assert.deepEqual(summary.deleted, []);
  assert.equal(fetchImpl.count('DELETE'), 0);
});

test('skips fork PRs and deleted head repositories', async () => {
  const handlers = defaultHandlers({
    'GET /search/issues': [
      200,
      {
        items: [
          { number: 10, pull_request: { merged_at: MERGED_25H_AGO } },
          { number: 12, pull_request: { merged_at: MERGED_25H_AGO } },
        ],
      },
    ],
    'GET /repos/octo/demo/pulls/10': [
      200,
      { head: { ref: 'feat/fork', sha: 'aaaa', repo: { full_name: 'fork/demo' } } },
    ],
    'GET /repos/octo/demo/pulls/12': [
      200,
      { head: { ref: 'feat/null-repo', sha: 'dddd', repo: null } },
    ],
  });
  const { cleaner, fetchImpl } = makeCleaner(handlers);
  const summary = await cleaner.run();

  assert.deepEqual(summary.deleted, []);
  assert.equal(summary.skipped.length, 2);
  assert.equal(fetchImpl.count('DELETE'), 0);
});

test('skips branches that are already deleted', async () => {
  const handlers = defaultHandlers({
    'GET /repos/octo/demo/git/ref/heads/feat/old': [404, { message: 'Not Found' }],
  });
  const { cleaner, fetchImpl } = makeCleaner(handlers);
  const summary = await cleaner.run();

  assert.deepEqual(summary.deleted, []);
  assert.ok(summary.skipped.some((entry) => entry.reason.includes('already deleted')));
  assert.ok(!fetchImpl.has('DELETE', 'feat/old'));
});

test('continues after a refused delete and records the failure', async () => {
  const handlers = defaultHandlers({
    'GET /search/issues': [
      200,
      {
        items: [
          { number: 10, pull_request: { merged_at: MERGED_25H_AGO } },
          { number: 12, pull_request: { merged_at: MERGED_25H_AGO } },
        ],
      },
    ],
    'DELETE /repos/octo/demo/git/ref/heads/feat/old': [422, { message: 'protected' }],
    'GET /repos/octo/demo/pulls/12': [
      200,
      { head: { ref: 'feat/other', sha: 'eeee', repo: { full_name: 'octo/demo' } } },
    ],
    'GET /repos/octo/demo/git/ref/heads/feat/other': [200, { object: { sha: 'eeee' } }],
    'GET /repos/octo/demo/commits/eeee': [
      200,
      { commit: { committer: { date: COMMIT_BEFORE_MERGE } } },
    ],
    'DELETE /repos/octo/demo/git/ref/heads/feat/other': [204],
    'POST /repos/octo/demo/issues/12/comments': [201, {}],
  });
  const { cleaner } = makeCleaner(handlers);
  const summary = await cleaner.run();

  assert.deepEqual(summary.deleted, ['feat/other']);
  assert.equal(summary.failed.length, 1);
  assert.equal(summary.failed[0].status, 422);
});

test('dry run lists targets without deleting or commenting', async () => {
  const { cleaner, fetchImpl } = makeCleaner(defaultHandlers(), { dryRun: true });
  const summary = await cleaner.run();

  assert.deepEqual(summary.wouldDelete, ['feat/old']);
  assert.deepEqual(summary.deleted, []);
  assert.equal(fetchImpl.count('DELETE'), 0);
  assert.equal(fetchImpl.count('POST'), 0);
});

test('fails fast on authentication errors', async () => {
  const handlers = defaultHandlers({
    'GET /repos/octo/demo': [401, { message: 'Bad credentials' }],
  });
  const { cleaner } = makeCleaner(handlers);

  await assert.rejects(cleaner.run(), /401/);
});
