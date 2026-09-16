import { Module } from '@nestjs/common';
import { HealthModule } from './common/health/health.module.js';
import { DbModule } from './db/db.module.js';
import { QueueModule } from './queue/queue.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { BusinessesModule } from './modules/businesses/businesses.module.js';
import { VerificationsModule } from './modules/verifications/verifications.module.js';
import { ChallengesModule } from './modules/challenges/challenges.module.js';
import { ApplicationsModule } from './modules/applications/applications.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { FilesModule } from './modules/files/files.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { AdsModule } from './modules/ads/ads.module.js';
import { CertificatesModule } from './modules/certificates/certificates.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { AdminSettingsModule } from './modules/admin/admin-settings.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { BillingModule } from './modules/billing/billing.module.js';
import { TeamsModule } from './modules/teams/teams.module.js';
import { BookmarksModule } from './modules/bookmarks/bookmarks.module.js';
import { InterestsModule } from './modules/interests/interests.module.js';
import { OperationsModule } from './modules/operations/operations.module.js';

// Full module tree, served over HTTP by main.ts.
@Module({
  imports: [
    DbModule,
    QueueModule,
    HealthModule,
    AuthModule,
    UsersModule,
    BusinessesModule,
    VerificationsModule,
    ChallengesModule,
    ApplicationsModule,
    OrdersModule,
    PaymentsModule,
    FilesModule,
    NotificationsModule,
    AdsModule,
    CertificatesModule,
    ReportsModule,
    AdminSettingsModule,
    AdminModule,
    BillingModule,
    TeamsModule,
    BookmarksModule,
    InterestsModule,
    OperationsModule,
  ],
})
export class AppModule {}
