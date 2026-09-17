import { Module } from '@nestjs/common';
import { AdsModule } from '../ads/ads.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { BillingModule } from '../billing/billing.module.js';
import { BusinessesModule } from '../businesses/businesses.module.js';
import { ChallengesModule } from '../challenges/challenges.module.js';
import { BizController } from './biz.controller.js';
import { BizService } from './biz.service.js';

@Module({
  imports: [AuthModule, BusinessesModule, ChallengesModule, AdsModule, BillingModule],
  controllers: [BizController],
  providers: [BizService],
  exports: [BizService],
})
export class BizModule {}
