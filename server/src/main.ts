import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module.js';
import { configureApp } from './app/app.configure.js';
import { env } from './infra/config/env.js';

// HTTP API entry point — sits behind the ALB, ALB inbound only.
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  await app.listen(env.port);
}

await bootstrap();
