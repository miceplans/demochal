import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { FilesModule } from '../files/files.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { VerificationsController } from './verifications.controller.js';
import { VerificationsService } from './verifications.service.js';
import { VerificationDocumentRetentionService } from './verification-document-retention.service.js';

// Imported by AppModule (HTTP: submit/get) and WorkerModule (document retention scan).
@Module({
  imports: [NotificationsModule, FilesModule, AuthModule],
  controllers: [VerificationsController],
  providers: [VerificationsService, VerificationDocumentRetentionService],
  exports: [VerificationsService, VerificationDocumentRetentionService],
})
export class VerificationsModule {}
