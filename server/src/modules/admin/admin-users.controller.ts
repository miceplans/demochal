import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AdminRoleGuard } from './admin-role.guard.js';
import { AdminUsersService } from './admin-users.service.js';
import { SuspendUserDto } from './dto/suspend-user.dto.js';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  list(@Query('q') q?: string, @Query('status') status?: 'active' | 'suspended') {
    return this.adminUsersService.list({ q, status });
  }

  @Post(':id/suspend')
  suspend(@Param('id') id: string, @Body() dto: SuspendUserDto) {
    return this.adminUsersService.suspend(id, dto.suspended, dto.reason);
  }
}
