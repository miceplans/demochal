import assert from 'node:assert/strict';
import test from 'node:test';
import { createAwsRequestDeployment, createHandler } from './secret-redeploy.mjs';

const env = {
  ECS_CLUSTER: 'semochal-staging',
  API_SERVICE: 'api',
  WORKER_SERVICE: 'worker',
  APP_SECRET_ARN:
    'arn:aws:secretsmanager:ap-northeast-2:724229572952:secret:semochal-staging/app-abc',
  APP_SECRET_NAME: 'semochal-staging/app',
};

function event({
  secretArn = env.APP_SECRET_ARN,
  secretName = env.APP_SECRET_NAME,
  label = 'AWSCURRENT',
} = {}) {
  return {
    'detail-type': 'Secret Label Updated',
    resources: [secretArn],
    detail: { name: secretName, labelUpdated: label },
  };
}

function harness() {
  const requests = [];
  const logs = [];
  const handler = createHandler({
    env,
    logger: { info: (message) => logs.push(message) },
    requestDeployment: async (cluster, service) => requests.push({ cluster, service }),
  });
  return { handler, logs, requests };
}

test('AWSCURRENT change restarts exactly API and worker', async () => {
  const { handler, requests } = harness();
  await handler(event());
  assert.deepEqual(requests, [
    { cluster: env.ECS_CLUSTER, service: env.API_SERVICE },
    { cluster: env.ECS_CLUSTER, service: env.WORKER_SERVICE },
  ]);
});

test('unrelated secret and metadata label do not restart services', async () => {
  const first = harness();
  await first.handler(event({ secretArn: 'arn:other', secretName: 'other' }));
  assert.deepEqual(first.requests, []);

  const second = harness();
  await second.handler(event({ label: 'AWSPREVIOUS' }));
  assert.deepEqual(second.requests, []);
});

test('propagates ECS failure without logging event content', async () => {
  const logs = [];
  const handler = createHandler({
    env,
    logger: { info: (message) => logs.push(message) },
    requestDeployment: async () => {
      throw new Error('ECS unavailable');
    },
  });
  await assert.rejects(handler(event()), /ECS unavailable/);
  assert.equal(
    logs.some((message) => message.includes(env.APP_SECRET_ARN)),
    false,
  );
});

test('creates force-new-deployment ECS requests for both services', async () => {
  const commands = [];
  class FakeUpdateServiceCommand {
    constructor(input) {
      this.input = input;
    }
  }
  const requestDeployment = createAwsRequestDeployment({
    UpdateServiceCommand: FakeUpdateServiceCommand,
    send: async (command) => commands.push(command),
  });

  await Promise.all([
    requestDeployment(env.ECS_CLUSTER, env.API_SERVICE),
    requestDeployment(env.ECS_CLUSTER, env.WORKER_SERVICE),
  ]);

  assert.deepEqual(
    commands.map(({ input }) => input),
    [
      { cluster: env.ECS_CLUSTER, service: env.API_SERVICE, forceNewDeployment: true },
      { cluster: env.ECS_CLUSTER, service: env.WORKER_SERVICE, forceNewDeployment: true },
    ],
  );
});
