import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

test('comment workflow uses an identifier-only payload and blocks automation replies', async () => {
  const workflow = await readFile('.github/workflows/pr-ai-orchestration.yml', 'utf8');

  assert.match(workflow, /pull_request_review_comment:\s*\n\s*types: \[created\]/);
  assert.match(workflow, /issue_comment:\s*\n\s*types: \[created\]/);
  assert.match(
    workflow,
    /!contains\(github\.event\.comment\.body, '<!-- ai-automation-reply -->'\)/,
  );
  assert.match(workflow, /pullRequest: \{ number: \(\$pr_number \| tonumber\) \}/);
  assert.match(
    workflow,
    /idempotencyKey:\s*\(\s*\$repository \+ ":pr-comment:" \+ \$comment_id\s*\)/,
  );
  assert.match(workflow, /curl --fail-with-body --silent --show-error/);
  assert.doesNotMatch(workflow, /\$comment\.body|\$comment\.diff_hunk|\$pr\.body|\$pr\.title/);
});

test('QA dispatch sanitizes input before sending the runner payload', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'qa-dispatch-'));
  const eventPath = join(directory, 'event.json');
  await writeFile(
    eventPath,
    JSON.stringify({
      inputs: {
        target_url: 'https://staging.example.com/profile?access_token=secret#private',
        scenario: 'save password=secret user@example.com',
        environment: 'staging phone 010-1234-5678',
      },
    }),
  );
  let received;
  const server = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => {
      received = JSON.parse(body);
      response.end('ok');
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await execFileAsync('node', ['scripts/ai-dispatch.mjs', 'qa'], {
    env: {
      ...process.env,
      GITHUB_EVENT_PATH: eventPath,
      AI_AUTOMATION_WEBHOOK_URL: `http://127.0.0.1:${port}`,
      AI_AUTOMATION_WEBHOOK_TOKEN: 'test-token',
    },
  });
  server.close();
  assert.equal(received.qa.targetUrl, 'https://staging.example.com/profile');
  assert.doesNotMatch(JSON.stringify(received.qa), /secret|user@example.com|010-1234-5678/);
});

test('PR review comment dispatch includes a stable coding-agent session key', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pr-comment-dispatch-'));
  const eventPath = join(directory, 'event.json');
  await writeFile(
    eventPath,
    JSON.stringify({
      pull_request: {
        number: 570,
        title: 'feat: QA',
        body: 'body',
        head: { ref: 'feat/#565' },
        base: { ref: 'main' },
      },
      comment: {
        id: 12345,
        user: { login: 'reviewer' },
        body: 'fix password=secret',
        path: 'qa/runner.mjs',
        line: 12,
        side: 'RIGHT',
        diff_hunk: '@@',
        created_at: '2026-10-13T00:00:00Z',
      },
    }),
  );
  let received;
  const server = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => {
      received = JSON.parse(body);
      response.end('ok');
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await execFileAsync('node', ['scripts/ai-dispatch.mjs', 'pr-review-comment'], {
    env: {
      ...process.env,
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_REPOSITORY: 'miceplans/demochal',
      AI_AUTOMATION_WEBHOOK_URL: `http://127.0.0.1:${port}`,
      AI_AUTOMATION_WEBHOOK_TOKEN: 'test-token',
    },
  });
  server.close();
  assert.equal(received.mode, 'pr-review-comment');
  assert.equal(received.reviewComment.sessionKey, 'miceplans/demochal:pr:570');
  assert.equal(received.reviewComment.idempotencyKey, 'miceplans/demochal:pr-comment:12345');
  assert.doesNotMatch(received.reviewComment.body, /secret/);
});

test('issue comment dispatch resolves PR refs from the GitHub API', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'issue-comment-dispatch-'));
  const eventPath = join(directory, 'event.json');
  await writeFile(
    eventPath,
    JSON.stringify({
      issue: {
        number: 570,
        title: 'old',
        body: 'old',
        pull_request: { url: 'https://api.github.com/repos/miceplans/demochal/pulls/570' },
      },
      comment: { id: 12346, user: { login: 'reviewer' }, body: 'please fix' },
    }),
  );
  let received;
  const server = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => {
      if (request.method === 'GET') response.setHeader('content-type', 'application/json');
      if (request.method === 'GET')
        response.end(
          JSON.stringify({
            title: 'feat: QA',
            body: 'body',
            head: { ref: 'feat/#565' },
            base: { ref: 'main', sha: 'abc123' },
          }),
        );
      else {
        received = JSON.parse(body);
        response.end('ok');
      }
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await execFileAsync('node', ['scripts/ai-dispatch.mjs', 'pr-review-comment'], {
    env: {
      ...process.env,
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_REPOSITORY: 'miceplans/demochal',
      GITHUB_TOKEN: 'test-github-token',
      GITHUB_API_URL: `http://127.0.0.1:${port}`,
      AI_AUTOMATION_WEBHOOK_URL: `http://127.0.0.1:${port}`,
      AI_AUTOMATION_WEBHOOK_TOKEN: 'test-token',
    },
  });
  server.close();
  assert.equal(received.pullRequest.head, 'feat/#565');
  assert.equal(received.pullRequest.base, 'main');
});

test('issue comment dispatch fails closed when PR metadata cannot be resolved', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'issue-comment-failure-'));
  const eventPath = join(directory, 'event.json');
  await writeFile(
    eventPath,
    JSON.stringify({
      issue: {
        number: 570,
        pull_request: { url: 'https://api.github.com/repos/miceplans/demochal/pulls/570' },
      },
      comment: { id: 12347, body: 'please fix' },
    }),
  );
  const server = createServer((_request, response) => {
    response.statusCode = 404;
    response.end('not found');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await assert.rejects(
    () =>
      execFileAsync('node', ['scripts/ai-dispatch.mjs', 'pr-review-comment'], {
        env: {
          ...process.env,
          GITHUB_EVENT_PATH: eventPath,
          GITHUB_REPOSITORY: 'miceplans/demochal',
          GITHUB_TOKEN: 'test-github-token',
          GITHUB_API_URL: `http://127.0.0.1:${port}`,
          AI_AUTOMATION_WEBHOOK_URL: `http://127.0.0.1:${port}`,
          AI_AUTOMATION_WEBHOOK_TOKEN: 'test-token',
        },
      }),
    /Unable to resolve PR metadata/,
  );
  server.close();
});
