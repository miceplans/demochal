import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { WorkerModule } from './worker.module.js';

describe('WorkerModule', () => {
  // Regression: AuthModule (transitively imported) needs ThrottlerModule options,
  // otherwise the worker process crashes on boot with UnknownDependenciesException.
  it('resolves the full DI graph', async () => {
    const app = await NestFactory.createApplicationContext(WorkerModule, { logger: false });
    expect(app).toBeDefined();
    await app.close();
  });
});
