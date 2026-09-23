import { Body, Controller, ForbiddenException, Get, HttpCode, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { BusinessesService } from '../businesses/businesses.service.js';
import { BillingHistoryService } from './billing-history.service.js';
import { BillingService } from './billing.service.js';
import { IssueBillingAuthorizationDto } from './dto/issue-billing-authorization.dto.js';
import { RegisterPaymentCardDto } from './dto/register-payment-card.dto.js';
import { PaymentHistoryQueryDto } from './dto/payment-history-query.dto.js';

@Controller('billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly billingHistoryService: BillingHistoryService,
    private readonly businessesService: BusinessesService,
  ) {}

  @Get('cards')
  async listCards(@CurrentUser() user: AuthenticatedUser) {
    const business = await this.businessesService.findByOwner(user.id);
    if (!business) throw new ForbiddenException('Business account required');
    return this.billingService.listCards(business.id);
  }

  @Post('cards')
  @HttpCode(201)
  async registerCard(@Body() dto: RegisterPaymentCardDto, @CurrentUser() user: AuthenticatedUser) {
    const business = await this.businessesService.findByOwner(user.id);
    if (!business) throw new ForbiddenException('Business account required');
    return this.billingService.registerCard(business.id, dto);
  }

  @Get('history')
  async listHistory(
    @Query() query: PaymentHistoryQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const business = await this.businessesService.findByOwner(user.id);
    if (!business) throw new ForbiddenException('Business account required');
    return this.billingHistoryService.forBusiness(business.id, query);
  }

  // 토스 빌링 인증(requestBillingAuth)에 필요한 customerKey를 사전에 제공한다.
  @Get('authorizations/customer-key')
  async getCustomerKey(@CurrentUser() user: AuthenticatedUser) {
    const business = await this.businessesService.findByOwner(user.id);
    if (!business) throw new ForbiddenException('Business account required');
    return { customerKey: this.billingService.getCustomerKey(business.id) };
  }

  // 빌링 인증 성공 리다이렉트의 authKey를 받아 토스에서 billingKey를 발급·저장한다(시크릿 키 사용, 클라이언트 미노출).
  @Post('authorizations/issue')
  @HttpCode(201)
  async issueCard(
    @Body() dto: IssueBillingAuthorizationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const business = await this.businessesService.findByOwner(user.id);
    if (!business) throw new ForbiddenException('Business account required');
    return this.billingService.issueCard(business.id, dto.authKey);
  }
}
