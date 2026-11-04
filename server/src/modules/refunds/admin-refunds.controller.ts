import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  ParseEnumPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminRoleGuard } from '../admin/admin-role.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { RefundRequestStatus, RejectRefundRequestDto } from './dto/refund-request.dto.js';
import { RefundsService } from './refunds.service.js';

@UseGuards(AdminRoleGuard)
@Controller('admin/refund-requests')
export class AdminRefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  @Get()
  list(
    @Query('status', new ParseEnumPipe(RefundRequestStatus, { optional: true }))
    status?: RefundRequestStatus,
  ) {
    return this.refundsService.adminList(status);
  }

  @Post(':id/approve')
  @HttpCode(200)
  approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() admin: AuthenticatedUser) {
    return this.refundsService.approve(id, admin.id);
  }

  @Post(':id/reject')
  @HttpCode(200)
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectRefundRequestDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.refundsService.reject(id, admin.id, dto.reason);
  }
}
