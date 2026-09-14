import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard, type AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { BillingService } from './billing.service.js';
import { RegisterPaymentCardDto } from './dto/register-payment-card.dto.js';

@Controller()
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('billing/cards')
  listCards(@CurrentUser() user: AuthenticatedUser) {
    return this.billingService.listCards(user.id);
  }

  @Post('billing/cards')
  registerCard(@Body() dto: RegisterPaymentCardDto, @CurrentUser() user: AuthenticatedUser) {
    return this.billingService.registerCard(dto, user.id);
  }

  @Get('billing/history')
  getHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.billingService.getHistory(user.id, from, to);
  }

  @Get('biz/dashboard')
  getBizDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.billingService.getBizDashboard(user.id);
  }
}
