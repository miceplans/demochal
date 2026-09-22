import { Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard, type AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { OrdersService } from './orders.service.js';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.ordersService.findById(id, user.id);
  }

  // 토스 결제창 진입 실패/구매자 취소 후 남는 pending 주문을 신청자가 정리한다.
  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  cancel(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.ordersService.cancelPendingByOwner(id, user.id);
  }
}
