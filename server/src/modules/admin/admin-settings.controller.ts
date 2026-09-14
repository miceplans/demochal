import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard, type AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { AdminRoleGuard } from './admin-role.guard.js';
import { AdminSettingsService } from './admin-settings.service.js';
import type { UpdateAdminSettingsDto } from './dto/update-admin-settings.dto.js';

@Controller('admin/settings')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminSettingsController {
  constructor(private readonly adminSettingsService: AdminSettingsService) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.adminSettingsService.get(user.id);
  }

  @Put()
  update(@Body() body: UpdateAdminSettingsDto) {
    return this.adminSettingsService.update(body);
  }
}
