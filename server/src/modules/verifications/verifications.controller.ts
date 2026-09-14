import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard, type AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { VerificationsService } from './verifications.service.js';
import { SubmitVerificationDto } from './dto/submit-verification.dto.js';

@Controller('verifications')
@UseGuards(JwtAuthGuard)
export class VerificationsController {
  constructor(private readonly verificationsService: VerificationsService) {}

  @Post()
  submit(@Body() dto: SubmitVerificationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.verificationsService.submit(dto, user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.verificationsService.findById(id);
  }
}
