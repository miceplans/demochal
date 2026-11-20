import { Body, Controller, ForbiddenException, Get, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { BusinessesService } from '../businesses/businesses.service.js';
import { DESIGN_ORDER_THROTTLE } from '../../common/throttling/throttling.js';
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

  // 주문 생성은 결제 row를 만드는 쓰기 작업이라 전용 한도를 둔다(DESIGN_ORDER_THROTTLE).
  // 로그인은 했지만 기업이 없거나 인증되지 않은 경우는 인증 실패(401)가 아니라
  // 인가 실패이므로 403으로 응답한다 — 미인증 요청의 401은 가드가 담당한다.
  @Post('orders')
  @Throttle(DESIGN_ORDER_THROTTLE)
  async createOrder(@Body() dto: CreateDesignOrderDto, @CurrentUser() user: AuthenticatedUser) {
    const business = await this.businessesService.findByOwner(user.id);
    if (!business) throw new ForbiddenException('기업 계정이 필요합니다.');
    if (business.verificationStatus !== 'verified') {
      throw new ForbiddenException('기업 인증이 필요합니다.');
    }
    return this.designProductsService.createOrder(dto.productCode, user.id);
  }
}
