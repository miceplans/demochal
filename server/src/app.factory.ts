import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { configureApp } from './app.configure.js';

// Used by api/index.js (Vercel serverless entry); main.ts bootstraps directly
// with NestFactory so zero-config hosts that scan src/main.ts still detect it.
export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  return app;
}
