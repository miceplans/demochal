import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AdminRoleGuard } from './admin-role.guard.js';
import { AdminReportsService } from './admin-reports.service.js';
import { ResolveReportDto } from './dto/resolve-report.dto.js';

@Controller('admin/reports')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminReportsController {
  constructor(private readonly adminReportsService: AdminReportsService) {}

  @Get()
  list(@Query('q') q?: string, @Query('status') status?: 'open' | 'resolved' | 'dismissed') {
    return this.adminReportsService.list({ q, status });
  }

  @Post(':id/resolve')
  resolve(@Param('id') id: string, @Body() dto: ResolveReportDto) {
    return this.adminReportsService.resolve(id, dto.action, dto.note);
  }
}
