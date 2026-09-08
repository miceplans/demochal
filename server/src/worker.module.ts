import { Module } from '@nestjs/common';
import { DbModule } from './db/db.module.js';
import { QueueModule } from './queue/queue.module.js';
import { VerificationsModule } from './modules/verifications/verifications.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';

// Subset of AppModule needed to process background jobs. Shares the same
// VerificationsModule/NotificationsModule as the HTTP app — only the entry
// point (worker.ts vs main.ts) differs; no HTTP listener is started here.
@Module({
  imports: [DbModule, QueueModule, VerificationsModule, NotificationsModule],
})
export class WorkerModule {}
