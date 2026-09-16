import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AdminRoleGuard } from './admin-role.guard.js';
import { AdminContentsService } from './admin-contents.service.js';

@Controller('admin/contents')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminContentsController {
  constructor(private readonly adminContentsService: AdminContentsService) {}

  @Get()
  get() {
    return this.adminContentsService.get();
  }
}
