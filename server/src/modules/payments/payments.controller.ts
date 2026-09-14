import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Public } from '../../common/auth/public.decorator.js';
import { PaymentsService, type TossWebhookPayload } from './payments.service.js';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // Public webhook endpoint. The service re-fetches the payment from Toss with
  // the secret key before trusting the payload, so no signature is required here.
  @Public()
  @Post('webhook/toss')
  @HttpCode(200)
  async handleTossWebhook(@Body() payload: TossWebhookPayload) {
    await this.paymentsService.handleTossWebhook(payload);
    return { received: true };
  }
}
