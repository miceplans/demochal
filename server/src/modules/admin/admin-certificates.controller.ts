import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AdminRoleGuard } from './admin-role.guard.js';
import { AdminCertificatesService } from './admin-certificates.service.js';
import { VerifyCertificateDto } from './dto/verify-certificate.dto.js';

@Controller('admin/certificates')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminCertificatesController {
  constructor(private readonly adminCertificatesService: AdminCertificatesService) {}

  @Get()
  list(@Query('status') status?: 'pending' | 'verified' | 'rejected', @Query('q') q?: string) {
    return this.adminCertificatesService.list({ status, q });
  }

  @Post(':id/verify')
  verify(@Param('id') id: string, @Body() dto: VerifyCertificateDto) {
    return this.adminCertificatesService.verify(id, dto.action);
  }
}
