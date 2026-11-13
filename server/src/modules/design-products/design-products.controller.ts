import { Body, Controller, Get, Post, UnauthorizedException } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { BusinessesService } from '../businesses/businesses.service.js';
import { CreateDesignOrderDto } from './dto/create-design-order.dto.js';
import { DesignProductsService } from './design-products.service.js';

@Controller('design-products')
export class DesignProductsController {
  constructor(
    private readonly designProductsService: DesignProductsService,
    private readonly businessesService: BusinessesService,
  ) {}

  @Get()
  list() {
    return this.designProductsService.list();
  }

  @Post('orders')
  async createOrder(@Body() dto: CreateDesignOrderDto, @CurrentUser() user: AuthenticatedUser) {
    const business = await this.businessesService.findByOwner(user.id);
    if (!business) throw new UnauthorizedException('기업 계정이 필요합니다.');
    return this.designProductsService.createOrder(dto.productCode, user.id);
  }
}
