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
import { KcpConfirmDto } from './dto/kcp-confirm.dto.js';
import { KcpRegisterDto } from './dto/kcp-register.dto.js';
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

  // KCP 네이버페이(bz) 모바일 결제창 호출 전 거래등록. 본인 pending 주문의 approvalKey·PayUrl을
  // 내리고, 금액은 서버 주문 금액으로 고정한다 — 상세 계약은 PaymentsService.registerKcpTransaction.
  @Post('kcp/register')
  @HttpCode(200)
  async registerKcp(@Body() dto: KcpRegisterDto, @CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.registerKcpTransaction(user.id, dto);
  }

  // KCP 네이버페이 PC 결제창 콜백 이후 클라이언트가 호출하는 승인 엔드포인트.
  // enc_data·enc_info를 capability로 쓰되 주문·금액 대사는 전부 서버 기준으로 다시 한다.
  @Post('kcp/confirm')
  @HttpCode(200)
  async confirmKcp(@Body() dto: KcpConfirmDto, @CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.confirmKcpPayment(user.id, dto);
  }

  // KCP 모바일 결제창 인증 결과 수신(Ret_URL). 가맹점 브라우저가 KCP 창에서 전체 페이지로
  // 도착하는 공개 엔드포인트라 사용자 인증은 없다 — enc_data·enc_info 없이는 승인할 수 없고
  // 승인·정산은 서비스에서 주문·금액을 DB 기준으로 대조해 처리한다. 프론트의
  // /payments/kcp/return 경로 핸들러가 이 결과를 받아 브라우저를 성공/실패 페이지로 본다.
  // 토스 웹훅과 같은 이유로 스로틀을 걸어 임의 orderId·enc_data로 KCP 승인 API를 대신
  // 호출하는 증폭을 막는다.
  @Public()
  @Post('kcp/return')
  @HttpCode(200)
  @Throttle(TOSS_WEBHOOK_THROTTLE)
  async handleKcpMobileReturn(@Body() body: Record<string, string>) {
    return this.paymentsService.handleKcpMobileReturn(body);
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
