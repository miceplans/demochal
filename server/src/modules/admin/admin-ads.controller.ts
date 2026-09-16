import { Body, Controller, Get, ParseArrayPipe, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AdminRoleGuard } from './admin-role.guard.js';
import { AdminAdsService } from './admin-ads.service.js';
import { AdPricingEntryDto } from './dto/update-ad-pricing.dto.js';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminAdsController {
  constructor(private readonly adminAdsService: AdminAdsService) {}

  @Get('ads')
  listAds(@Query('q') q?: string, @Query('status') status?: string) {
    return this.adminAdsService.listAds(q, status);
  }

  @Get('ad-pricing')
  getAdPricing() {
    return this.adminAdsService.getAdPricing();
  }

  @Put('ad-pricing')
  updateAdPricing(
    @Body(new ParseArrayPipe({ items: AdPricingEntryDto })) entries: AdPricingEntryDto[],
  ) {
    return this.adminAdsService.updateAdPricing(entries);
  }
}
