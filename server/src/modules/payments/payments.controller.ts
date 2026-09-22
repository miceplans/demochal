import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Public } from '../auth/public.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto.js';
import { PaymentsService, type TossWebhookPayload } from './payments.service.js';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // 토스 successUrl 리다이렉트 이후 클라이언트가 호출하는 승인 엔드포인트.
  // 인증된 신청자 본인의 pending 주문만 확정할 수 있다 — 주문 소유권·금액 대조와
  // 토스 승인 API 호출, 결제 저장+주문 확정 트랜잭션은 서비스에서 처리한다.
  @Post('confirm')
  @HttpCode(200)
  async confirm(@Body() dto: ConfirmPaymentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.confirmPayment(user.id, dto);
  }

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
