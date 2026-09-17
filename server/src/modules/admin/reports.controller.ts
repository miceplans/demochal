import { Body, Controller, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { AdminService } from './admin.service.js';
import { CreateReportDto } from './dto/create-report.dto.js';

// User-facing report filing — authenticated via the global guard, NOT admin-only.
@Controller('reports')
export class ReportsController {
  constructor(private readonly adminService: AdminService) {}

  @Post()
  create(@Body() dto: CreateReportDto, @CurrentUser() user: AuthenticatedUser) {
    return this.adminService.createReport(dto, user);
  }
}
