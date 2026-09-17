import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../../common/auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { BusinessesService } from '../businesses/businesses.service.js';
import { BillingHistoryService } from './billing-history.service.js';
import { BillingService } from './billing.service.js';
import { RegisterPaymentCardDto } from './dto/register-payment-card.dto.js';
import { PaymentHistoryQueryDto } from './dto/payment-history-query.dto.js';

@Controller('billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly billingHistoryService: BillingHistoryService,
    private readonly businessesService: BusinessesService,
  ) {}

  @Get('cards')
  async listCards(@CurrentUser() user: AuthUser) {
    const business = await this.businessesService.findByOwner(user.id);
    if (!business) throw new ForbiddenException('Business account required');
    return this.billingService.listCards(business.id);
  }

  @Post('cards')
  @HttpCode(201)
  async registerCard(@Body() dto: RegisterPaymentCardDto, @CurrentUser() user: AuthUser) {
    const business = await this.businessesService.findByOwner(user.id);
    if (!business) throw new ForbiddenException('Business account required');
    return this.billingService.registerCard(business.id, dto);
  }

  @Get('history')
  async listHistory(@Query() query: PaymentHistoryQueryDto, @CurrentUser() user: AuthUser) {
    const business = await this.businessesService.findByOwner(user.id);
    if (!business) throw new ForbiddenException('Business account required');
    return this.billingHistoryService.forBusiness(business.id, query);
  }
}
