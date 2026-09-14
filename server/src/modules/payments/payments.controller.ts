import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { PaymentsService, type TossWebhookPayload } from './payments.service.js';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('webhook/toss')
  @HttpCode(200)
  async handleTossWebhook(@Body() payload: TossWebhookPayload) {
    await this.paymentsService.handleTossWebhook(payload);
    return { received: true };
  }
}
