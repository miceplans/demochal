import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { WorkerModule } from './worker.module.js';
import { ChallengeNotificationScanService } from './modules/notifications/challenge-notification-scan.service.js';
import { NotificationEmailProcessorService } from './modules/notifications/email/notification-email.processor.js';
import { SupportEmailProcessorService } from './modules/notifications/email/support-email.processor.js';

describe('WorkerModule', () => {
  // Regression: AuthModule (transitively imported) needs ThrottlerModule options,
  // otherwise the worker process crashes on boot with UnknownDependenciesException.
  it('resolves the full DI graph', async () => {
    const app = await NestFactory.createApplicationContext(WorkerModule, { logger: false });
    expect(app).toBeDefined();
    expect(app.get(NotificationEmailProcessorService)).toBeInstanceOf(
      NotificationEmailProcessorService,
    );
    expect(app.get(SupportEmailProcessorService)).toBeInstanceOf(SupportEmailProcessorService);
    expect(app.get(ChallengeNotificationScanService)).toBeInstanceOf(
      ChallengeNotificationScanService,
    );
    await app.close();
  });
});
