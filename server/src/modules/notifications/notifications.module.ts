import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { OutboxModule } from '../../outbox/outbox.module.js';
import { NotificationEmailProcessorService } from './email/notification-email.processor.js';
import { ChallengeNotificationScanService } from './challenge-notification-scan.service.js';
import { NotificationsStreamController } from './notifications-stream.controller.js';
import { NotificationsStreamService } from './notifications-stream.service.js';
import { SesEmailClient } from './email/ses-email.client.js';
import { SupportEmailService } from './email/support-email.service.js';

// Imported by both AppModule (HTTP + email outbox writes) and WorkerModule
// (NotificationEmailProcessorService, driven by worker.ts's email queue loop).
@Module({
  imports: [AuthModule, OutboxModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationEmailProcessorService,
    ChallengeNotificationScanService,
    SesEmailClient,
    SupportEmailService,
  ],
  exports: [
    NotificationsService,
    NotificationEmailProcessorService,
    ChallengeNotificationScanService,
    SesEmailClient,
    SupportEmailService,
  ],
})
export class NotificationsModule {}

// HTTP-only realtime stream. Separate from NotificationsModule so WorkerModule never opens
// a LISTEN connection; only AppModule imports it.
@Module({
  imports: [AuthModule],
  controllers: [NotificationsStreamController],
  providers: [NotificationsStreamService],
})
export class NotificationsStreamModule {}
