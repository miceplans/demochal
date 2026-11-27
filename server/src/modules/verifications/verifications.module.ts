import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { FilesModule } from '../files/files.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { VerificationsController } from './verifications.controller.js';
import { VerificationsService } from './verifications.service.js';

@Module({
  imports: [NotificationsModule, FilesModule, AuthModule],
  controllers: [VerificationsController],
  providers: [VerificationsService],
  exports: [VerificationsService],
})
export class VerificationsModule {}
