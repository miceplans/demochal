import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { CertificatesController } from './certificates.controller.js';
import { ReportsController } from './reports.controller.js';

@Module({
  imports: [NotificationsModule],
  controllers: [AdminController, CertificatesController, ReportsController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
