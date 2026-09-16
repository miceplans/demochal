import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AdminRoleGuard } from './admin-role.guard.js';
import { AdminAnalyticsService } from './admin-analytics.service.js';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminAnalyticsController {
  constructor(private readonly adminAnalyticsService: AdminAnalyticsService) {}

  @Get('dashboard')
  getDashboard(@Query('range') range: '7days' | '30days' | '1year' = '1year') {
    return this.adminAnalyticsService.getDashboard(range);
  }

  @Get('analytics')
  getAnalytics(@Query('ad') ad?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.adminAnalyticsService.getAnalytics(ad, from, to);
  }
}
