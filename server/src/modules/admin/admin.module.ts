import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdsModule } from '../ads/ads.module.js';
import { FilesModule } from '../files/files.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';

@Module({
  imports: [AuthModule, NotificationsModule, AdsModule, FilesModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
