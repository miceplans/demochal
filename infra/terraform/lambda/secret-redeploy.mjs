function isAppSecret(event, env) {
  return (
    event?.detail?.name === env.APP_SECRET_NAME && event?.resources?.includes(env.APP_SECRET_ARN)
  );
}

function changesCurrentValue(event) {
  return (
    event?.['detail-type'] === 'Secret Label Updated' &&
    event?.detail?.labelUpdated === 'AWSCURRENT'
  );
}

export function createHandler({ requestDeployment, logger = console, env = process.env }) {
  return async function handleSecretChange(event) {
    if (!isAppSecret(event, env) || !changesCurrentValue(event)) {
      logger.info('Ignored a non-value or non-application-secret event.');
      return;
    }

    await Promise.all(
      [env.API_SERVICE, env.WORKER_SERVICE].map((service) =>
        requestDeployment(env.ECS_CLUSTER, service),
      ),
    );
    logger.info('Requested new deployments for the API and worker services.');
  };
}

export function createAwsRequestDeployment({ send, UpdateServiceCommand }) {
  return (cluster, service) =>
    send(new UpdateServiceCommand({ cluster, service, forceNewDeployment: true }));
}

export async function handler(event) {
  // AWS Lambda Node.js runtimes include AWS SDK for JavaScript v3. Keeping the
  // import here allows the event-routing logic to be unit-tested without a
  // packaged SDK or access to the secret value.
  const { ECSClient, UpdateServiceCommand } = await import('@aws-sdk/client-ecs');
  const ecs = new ECSClient({});
  return createHandler({
    requestDeployment: createAwsRequestDeployment({
      send: (command) => ecs.send(command),
      UpdateServiceCommand,
    }),
  })(event);
}
