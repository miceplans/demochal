import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { OutboxModule } from '../../outbox/outbox.module.js';
import { NotificationEmailProcessorService } from './email/notification-email.processor.js';
import { SesEmailClient } from './email/ses-email.client.js';

// Imported by both AppModule (HTTP + email outbox writes) and WorkerModule
// (NotificationEmailProcessorService, driven by worker.ts's email queue loop).
@Module({
  imports: [AuthModule, OutboxModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationEmailProcessorService, SesEmailClient],
  exports: [NotificationsService, NotificationEmailProcessorService],
})
export class NotificationsModule {}
