import { Module } from '@nestjs/common';
import { AdsModule } from '../ads/ads.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { FilesModule } from '../files/files.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { AdminController } from './admin.controller.js';
import { AdminSettingsModule } from './admin-settings.module.js';
import { AdminService } from './admin.service.js';
import { EmailModule } from '../email/email.module.js';

@Module({
  imports: [
    AuthModule,
    NotificationsModule,
    AdsModule,
    FilesModule,
    AdminSettingsModule,
    EmailModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
