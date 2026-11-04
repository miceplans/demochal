import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { AdminRefundsController } from './admin-refunds.controller.js';
import { RefundsController } from './refunds.controller.js';
import { RefundsService } from './refunds.service.js';

@Module({
  imports: [AuthModule, NotificationsModule, OrdersModule, PaymentsModule],
  controllers: [RefundsController, AdminRefundsController],
  providers: [RefundsService],
})
export class RefundsModule {}
