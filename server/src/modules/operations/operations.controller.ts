import { Body, Controller, Post } from '@nestjs/common';
import { OperationsService } from './operations.service.js';
import { SubmitOperationsInquiryDto } from './dto/submit-operations-inquiry.dto.js';

@Controller('operations')
export class OperationsController {
  constructor(private readonly operationsService: OperationsService) {}

  @Post('inquiries')
  submit(@Body() dto: SubmitOperationsInquiryDto) {
    return this.operationsService.submitInquiry(dto);
  }
}
