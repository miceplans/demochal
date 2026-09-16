import { Body, Controller, Post } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../../common/auth/current-user.decorator.js';
import { AdminService } from './admin.service.js';
import { CreateReportDto } from './dto/create-report.dto.js';

// User-facing report filing — authenticated via the global guard, NOT admin-only.
@Controller('reports')
export class ReportsController {
  constructor(private readonly adminService: AdminService) {}

  @Post()
  create(@Body() dto: CreateReportDto, @CurrentUser() user: AuthUser) {
    return this.adminService.createReport(dto, user);
  }
}
