import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { configureApp } from './app.configure.js';

// Reusable Nest application factory; main.ts bootstraps the HTTP server directly.
export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  return app;
}
