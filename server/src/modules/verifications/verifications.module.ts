import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { FilesModule } from '../files/files.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { AdminSettingsModule } from '../admin/admin-settings.module.js';
import { ClovaOcrClient } from './clients/clova-ocr.client.js';
import { NtsClient } from './clients/nts.client.js';
import { VerificationsController } from './verifications.controller.js';
import { VerificationsProcessorService } from './verifications.processor.js';
import { VerificationsService } from './verifications.service.js';

// Imported by both AppModule (HTTP: submit/get) and WorkerModule (SQS processor).
@Module({
  imports: [NotificationsModule, FilesModule, AuthModule, AdminSettingsModule],
  controllers: [VerificationsController],
  providers: [VerificationsService, VerificationsProcessorService, ClovaOcrClient, NtsClient],
  exports: [VerificationsService, VerificationsProcessorService],
})
export class VerificationsModule {}
