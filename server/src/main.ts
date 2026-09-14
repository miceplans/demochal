import { createApp } from './app.factory.js';
import { env } from './config/env.js';

// HTTP API entry point — sits behind the ALB, ALB inbound only.
async function bootstrap() {
  const app = await createApp();
  await app.listen(env.port);
}

await bootstrap();
