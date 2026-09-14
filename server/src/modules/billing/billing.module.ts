import { Module } from '@nestjs/common';
import { BusinessesModule } from '../businesses/businesses.module.js';
import { BillingController } from './billing.controller.js';
import { BillingHistoryService } from './billing-history.service.js';
import { BillingService } from './billing.service.js';

@Module({
  imports: [BusinessesModule],
  controllers: [BillingController],
  providers: [BillingService, BillingHistoryService],
  // BillingHistoryService is shared with the biz dashboard (single history query).
  exports: [BillingHistoryService],
})
export class BillingModule {}
