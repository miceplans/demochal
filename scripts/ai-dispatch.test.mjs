import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

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
