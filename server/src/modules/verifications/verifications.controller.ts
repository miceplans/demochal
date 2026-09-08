import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { VerificationsService } from './verifications.service.js';
import { SubmitVerificationDto } from './dto/submit-verification.dto.js';

@Controller('verifications')
export class VerificationsController {
  constructor(private readonly verificationsService: VerificationsService) {}

  @Post()
  submit(@Body() dto: SubmitVerificationDto) {
    return this.verificationsService.submit(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.verificationsService.findById(id);
  }
}
