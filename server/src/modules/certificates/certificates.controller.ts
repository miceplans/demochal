import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard, type AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { CertificatesService } from './certificates.service.js';
import { CreateCertificateDto } from './dto/create-certificate.dto.js';

@Controller('certificates')
@UseGuards(JwtAuthGuard)
export class CertificatesController {
  constructor(private readonly certificatesService: CertificatesService) {}

  @Post()
  create(@Body() dto: CreateCertificateDto, @CurrentUser() user: AuthenticatedUser) {
    return this.certificatesService.create(dto, user.id);
  }

  @Get('me')
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.certificatesService.listMine(user.id);
  }
}
