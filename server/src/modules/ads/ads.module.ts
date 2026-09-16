import { Module } from '@nestjs/common';
import { BusinessesModule } from '../businesses/businesses.module.js';
import { AdsController } from './ads.controller.js';
import { AdsService } from './ads.service.js';

@Module({
  imports: [BusinessesModule],
  controllers: [AdsController],
  providers: [AdsService],
  exports: [AdsService],
})
export class AdsModule {}
