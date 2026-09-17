import { Body, Controller, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { AdminService } from './admin.service.js';
import { CreateCertificateDto } from './dto/create-certificate.dto.js';

// User-facing certificate submission — authenticated via the global guard, NOT admin-only.
@Controller('users/me/certificates')
export class CertificatesController {
  constructor(private readonly adminService: AdminService) {}

  @Post()
  create(@Body() dto: CreateCertificateDto, @CurrentUser() user: AuthenticatedUser) {
    return this.adminService.createCertificate(dto, user);
  }
}
