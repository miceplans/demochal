import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { AdminAlertsService } from './admin-alerts.service.js';
import { AdminSettingsService } from './admin-settings.service.js';

@Module({
  imports: [NotificationsModule],
  providers: [AdminSettingsService, AdminAlertsService],
  exports: [AdminSettingsService, AdminAlertsService],
})
export class AdminSettingsModule {}
