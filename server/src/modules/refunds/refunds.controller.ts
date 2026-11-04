import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard, type AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { CreateRefundRequestDto } from './dto/refund-request.dto.js';
import { RefundsService } from './refunds.service.js';

// 구매자 환불 요청. 승인·반려는 AdminRefundsController(관리자 전용)가 처리한다.
@Controller('orders/:id/refund-requests')
export class RefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(201)
  create(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateRefundRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.refundsService.request(user.id, id, dto.reason);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  list(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.refundsService.listForOrder(user.id, id);
  }
}
