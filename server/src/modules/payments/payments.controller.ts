import { Body, Controller, HttpCode, Post, Req, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../auth/public.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { TOSS_WEBHOOK_THROTTLE } from '../../common/throttling/throttling.js';
import { isIpAllowed } from '../../common/throttling/ip-allowlist.js';
import { env } from '../../config/env.js';
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
  // TOSS_WEBHOOK_THROTTLE caps how often one client can make us relay Toss API
  // calls, and the optional IP allowlist (TOSS_WEBHOOK_ALLOWED_IPS) rejects
  // callers outside Toss's published inbound ranges with 401.
  // Note: req.ip is the ALB-observed peer because app.configure.ts sets
  // `trust proxy` to exactly one hop. If another proxy/LB layer is added in
  // front of the API, that setting — not this check — must be revisited, since
  // the X-Forwarded-For chain decides which address Express reports as req.ip.
  @Public()
  @Post('webhook/toss')
  @HttpCode(200)
  @Throttle(TOSS_WEBHOOK_THROTTLE)
  async handleTossWebhook(@Body() payload: TossWebhookPayload, @Req() req: Request) {
    // req.ip가 알 수 없으면(프록시 체인 등) 허용목록 활성 시 401로 처리한다.
    if (!isIpAllowed(req.ip ?? '', env.tossWebhookAllowlist)) {
      throw new UnauthorizedException('Toss webhook source IP is not allowed');
    }
    await this.paymentsService.handleTossWebhook(payload);
    return { received: true };
  }
}
