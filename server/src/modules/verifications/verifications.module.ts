import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { ClovaOcrClient } from './clients/clova-ocr.client.js';
import { NtsClient } from './clients/nts.client.js';
import { VerificationsController } from './verifications.controller.js';
import { VerificationsProcessorService } from './verifications.processor.js';
import { VerificationsService } from './verifications.service.js';

// Imported by both AppModule (HTTP: submit/get) and WorkerModule (SQS processor).
@Module({
  imports: [NotificationsModule],
  controllers: [VerificationsController],
  providers: [VerificationsService, VerificationsProcessorService, ClovaOcrClient, NtsClient],
  exports: [VerificationsService, VerificationsProcessorService],
})
export class VerificationsModule {}
