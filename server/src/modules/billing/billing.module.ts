import { Module } from '@nestjs/common';
import { AdsModule } from '../ads/ads.module.js';
import { ChallengesModule } from '../challenges/challenges.module.js';
import { BillingController } from './billing.controller.js';
import { BillingService } from './billing.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [ChallengesModule, AdsModule, AuthModule],
  controllers: [BillingController],
  providers: [BillingService],
})
export class BillingModule {}
