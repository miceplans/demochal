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
  ],
})
export class AppModule {}
