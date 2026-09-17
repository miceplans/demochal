import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BusinessesModule } from '../businesses/businesses.module.js';
import { AdsController } from './ads.controller.js';
import { AdsService } from './ads.service.js';

@Module({
  imports: [AuthModule, BusinessesModule],
  controllers: [AdsController],
  providers: [AdsService],
  exports: [AdsService],
})
export class AdsModule {}
