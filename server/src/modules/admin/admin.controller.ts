import { Body, Controller, Param, Post } from '@nestjs/common';
import { Roles } from '../../common/auth/roles.decorator.js';
import { AdminService } from './admin.service.js';
import { RejectVerificationDto } from './dto/reject-verification.dto.js';

// Business-verification decisions live here; every other admin route is served
// by the split admin-*.controller.ts files wired in AdminModule, one copy each.
@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('verifications/:id/approve')
  approveVerification(@Param('id') id: string) {
    return this.adminService.approveVerification(id);
  }

  @Post('verifications/:id/reject')
  rejectVerification(@Param('id') id: string, @Body() dto: RejectVerificationDto) {
    return this.adminService.rejectVerification(id, dto.reason);
  }
}
