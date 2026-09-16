import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AdminRoleGuard } from './admin-role.guard.js';
import { AdminBusinessesService } from './admin-businesses.service.js';

@Controller('admin/businesses')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminBusinessesController {
  constructor(private readonly adminBusinessesService: AdminBusinessesService) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('type') type?: string,
    @Query('status') status?: 'pending' | 'approved' | 'rejected',
  ) {
    return this.adminBusinessesService.list({ q, type, status });
  }
}
