import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { DEFAULT_THROTTLE } from './common/throttling/throttling.js';
import { DbModule } from './db/db.module.js';
import { QueueModule } from './queue/queue.module.js';
import { OutboxModule } from './outbox/outbox.module.js';
import { VerificationsModule } from './modules/verifications/verifications.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';

// Subset of AppModule needed to process background jobs. Shares the same
// VerificationsModule/NotificationsModule as the HTTP app — only the entry
// point (worker.ts vs main.ts) differs; no HTTP listener is started here.
// ThrottlerModule is required because AuthModule (pulled in transitively) declares
// LoginAttemptThrottlerGuard, which needs THROTTLER:MODULE_OPTIONS to resolve.
@Module({
  imports: [
    ThrottlerModule.forRoot({ throttlers: [DEFAULT_THROTTLE] }),
    DbModule,
    QueueModule,
    OutboxModule,
    VerificationsModule,
    NotificationsModule,
  ],
})
export class WorkerModule {}
