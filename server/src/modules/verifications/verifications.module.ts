import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { FilesModule } from '../files/files.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { OutboxModule } from '../../outbox/outbox.module.js';
import { VerificationsController } from './verifications.controller.js';
import { VerificationsProcessorService } from './verifications.processor.js';
import { VerificationsService } from './verifications.service.js';
import { VerificationDocumentRetentionService } from './verification-document-retention.service.js';

// Imported by both AppModule (HTTP: submit/get) and WorkerModule (SQS processor +
// document retention scan).
@Module({
  imports: [NotificationsModule, FilesModule, AuthModule, OutboxModule],
  controllers: [VerificationsController],
  providers: [
    VerificationsService,
    VerificationsProcessorService,
    VerificationDocumentRetentionService,
  ],
  exports: [
    VerificationsService,
    VerificationsProcessorService,
    VerificationDocumentRetentionService,
  ],
})
export class VerificationsModule {}
