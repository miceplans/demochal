import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { PaymentsService, type TossWebhookPayload } from './payments.service.js';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('webhook/toss')
  @HttpCode(200)
  async handleTossWebhook(@Body() payload: TossWebhookPayload) {
    // TODO: verify the request actually came from Toss before trusting the body.
    // Toss doesn't sign webhooks by default — mitigate by calling GET
    // /v1/payments/{paymentKey} with TOSS_SECRET_KEY to confirm status server-side
    // before acting on this payload.
    await this.paymentsService.handleTossWebhook(payload);
    return { received: true };
  }
}
