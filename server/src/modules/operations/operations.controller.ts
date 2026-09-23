import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Public } from '../auth/public.decorator.js';
import { SubmitOperationsInquiryDto } from './dto/submit-operations-inquiry.dto.js';
import { OperationsService } from './operations.service.js';

@Controller('operations')
export class OperationsController {
  constructor(private readonly operationsService: OperationsService) {}

  // Anyone (including logged-out visitors) can submit an operations inquiry.
  @Public()
  @Post('inquiries')
  @HttpCode(201)
  createInquiry(@Body() dto: SubmitOperationsInquiryDto) {
    return this.operationsService.createInquiry(dto);
  }
}
