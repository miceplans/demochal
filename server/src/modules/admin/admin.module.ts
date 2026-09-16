import { Module } from '@nestjs/common';
import { AdsModule } from '../ads/ads.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { AdminAdsController } from './admin-ads.controller.js';
import { AdminAdsService } from './admin-ads.service.js';
import { AdminAnalyticsController } from './admin-analytics.controller.js';
import { AdminAnalyticsService } from './admin-analytics.service.js';
import { AdminBusinessesController } from './admin-businesses.controller.js';
import { AdminBusinessesService } from './admin-businesses.service.js';
import { AdminCertificatesController } from './admin-certificates.controller.js';
import { AdminCertificatesService } from './admin-certificates.service.js';
import { AdminContentsController } from './admin-contents.controller.js';
import { AdminContentsService } from './admin-contents.service.js';
import { AdminReportsController } from './admin-reports.controller.js';
import { AdminReportsService } from './admin-reports.service.js';
import { AdminSettingsController } from './admin-settings.controller.js';
import { AdminUsersController } from './admin-users.controller.js';
import { AdminUsersService } from './admin-users.service.js';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { AdminSettingsModule } from './admin-settings.module.js';

@Module({
  imports: [AuthModule, NotificationsModule, AdsModule, AdminSettingsModule],
  controllers: [
    AdminController,
    AdminAdsController,
    AdminAnalyticsController,
    AdminBusinessesController,
    AdminCertificatesController,
    AdminContentsController,
    AdminReportsController,
    AdminUsersController,
    AdminSettingsController,
  ],
  providers: [
    AdminService,
    AdminAdsService,
    AdminAnalyticsService,
    AdminBusinessesService,
    AdminCertificatesService,
    AdminContentsService,
    AdminReportsService,
    AdminUsersService,
  ],
  exports: [AdminService],
})
export class AdminModule {}
