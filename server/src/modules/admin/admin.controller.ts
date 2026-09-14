import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { VerificationsService } from '../verifications/verifications.service.js';
import { AdminRoleGuard } from './admin-role.guard.js';
import { RejectVerificationDto } from './dto/reject-verification.dto.js';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminController {
  constructor(private readonly verificationsService: VerificationsService) {}

  @Post('verifications/:id/approve')
  approveVerification(@Param('id') id: string) {
    return this.verificationsService.approve(id);
  }

  @Post('verifications/:id/reject')
  rejectVerification(@Param('id') id: string, @Body() dto: RejectVerificationDto) {
    return this.verificationsService.reject(id, dto.reason);
  }
}
