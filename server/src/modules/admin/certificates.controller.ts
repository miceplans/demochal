import { Body, Controller, Post } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../../common/auth/current-user.decorator.js';
import { AdminService } from './admin.service.js';
import { CreateCertificateDto } from './dto/create-certificate.dto.js';

// User-facing certificate submission — authenticated via the global guard, NOT admin-only.
@Controller('users/me/certificates')
export class CertificatesController {
  constructor(private readonly adminService: AdminService) {}

  @Post()
  create(@Body() dto: CreateCertificateDto, @CurrentUser() user: AuthUser) {
    return this.adminService.createCertificate(dto, user);
  }
}
