import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { and, asc, eq, lt, ne } from 'drizzle-orm';
import { fetchJson } from '../../common/http/fetch-json.js';
import { env } from '../../config/env.js';
import { DRIZZLE, type Database, type DbTx } from '../../db/drizzle.provider.js';
import { payments } from '../../db/schema.js';
import { OrdersService } from '../orders/orders.service.js';
import type { ConfirmPaymentDto } from './dto/confirm-payment.dto.js';
import type { KcpConfirmDto } from './dto/kcp-confirm.dto.js';
import type { KcpRegisterDto } from './dto/kcp-register.dto.js';
import {
  NAVERPAY_PAYMENT_COMPLETED,
  cancelNaverPayPayment,
  fetchNaverPayPaymentDetail,
} from './naverpay.client.js';
import { approveKcpPayment, cancelKcpPayment, registerKcpTransaction } from './kcp.client.js';
import { KcpAmountMismatchError } from './kcp.client.js';

// refund_pending 재시도 정책(워커의 retryRefundPendingPayments 스캔이 사용):
// 지수 백오프로 Toss API 호출을 제한하고, 시도 상한을 둬 '영원히 실패하는 취소'가
// 스캔 주기마다 API를 때리는 걸 막는다. 상한에 도달한 row는 refund_pending으로
// 남기고 로그로 수동 환불이 필요함을 남긴다.
const REFUND_RETRY_BASE_BACKOFF_MS = 5 * 60 * 1000;
const REFUND_RETRY_MAX_BACKOFF_MS = 6 * 60 * 60 * 1000;
const REFUND_RETRY_MAX_ATTEMPTS = 5;
const REFUND_RETRY_BATCH_LIMIT = 50;

export interface TossWebhookPayload {
  eventType: string;
  data: {
    paymentKey: string;
    orderId: string;
    status: string;
  };
}

interface TossPayment {
  paymentKey: string;
  orderId: string;
  status: string;
  totalAmount: number;
  // Present on DONE/CANCELED/PARTIAL_CANCELED responses: the amount still not
  // canceled. https://docs.tosspayments.com/reference#payment-객체
  balanceAmount?: number;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly ordersService: OrdersService,
  ) {}

  async handleTossWebhook(payload: TossWebhookPayload): Promise<void> {
    const { status, paymentKey, orderId } = payload.data;
    if (!paymentKey || !orderId) return;

    if (status === 'DONE') {
      await this.handleDone(orderId, paymentKey);
      return;
    }
    if (status === 'CANCELED') {
      await this.handleCanceled(orderId, paymentKey);
      return;
    }
    if (status === 'EXPIRED') {
      await this.handleExpired(orderId, paymentKey);
      return;
    }
    if (status === 'WAITING_FOR_DEPOSIT') {
      // Virtual-account payment awaiting deposit — an intermediate state, not
      // a terminal one. Toss follows up with DONE (deposit received) or
      // EXPIRED (deposit window closed), so there's nothing to reconcile yet.
      this.logger.debug(`Toss payment ${paymentKey} awaiting deposit for order ${orderId}`);
      return;
    }
    if (status === 'ABORTED') {
      await this.handleAborted(orderId, paymentKey);
      return;
    }
    if (status === 'PARTIAL_CANCELED') {
      await this.handlePartialCanceled(orderId, paymentKey);
      return;
    }

    if (status === 'READY' || status === 'IN_PROGRESS') {
      // 결제창 진입(READY)·인증 완료 후 승인 대기(IN_PROGRESS)는 승인 전 중간 상태다.
      // 승인(DONE) 또는 실패(ABORTED/EXPIRED) 웹훅이 뒤따르므로 대사할 잔액이 없다.
      this.logger.debug(`Toss payment ${paymentKey} is ${status} for order ${orderId}`);
      return;
    }

    // 알 수 없는 상태는 조용히 버리지 않고 남겨 운영자가 새 상태 추가를 알아챌 수 있게 한다.
    // TODO: https://docs.tosspayments.com/reference#status 에 새 상태가 생기면 분기를 추가한다.
    this.logger.warn(`Ignoring Toss webhook with unhandled status ${status} for order ${orderId}`);
  }

  /**
   * 결제 승인 success 리다이렉트에 대응하는 클라이언트 호출 승인 경로. 카드 결제는
   * 토스가 웹훅 없이도 이 승인 호출을 요구하고, 네이버페이는 웹훅 없이 이 confirm이
   * 정산 유일 진입점이다. 결제 저장과 주문 확정은 같은 트랜잭션에서 처리하고,
   * 이미 확정된 주문의 재요청은 PG 재호출 없이 기존 결과를 돌려준다(새로고침 멱등).
   */
  async confirmPayment(userId: string, dto: ConfirmPaymentDto) {
    const order = await this.ordersService.findById(dto.orderId, userId);
    if (order.status === 'paid') return order;
    if (order.status !== 'pending') {
      throw new ConflictException('결제할 수 없는 주문입니다.');
    }

    // 네이버페이(bz 서브도메인) — 금액 위변조 방어는 클라이언트 금액 대조 대신
    // 서버 주문 금액 기준 가맹점 확인 API 대사로 대신한다.
    if (dto.provider === 'naverpay') {
      if (!dto.paymentId?.trim()) {
        throw new BadRequestException('네이버페이 결제번호가 필요합니다.');
      }
      return this.confirmNaverPay(order, dto.paymentId.trim());
    }

    if (!dto.paymentKey) {
      throw new BadRequestException('결제 키가 필요합니다.');
    }
    if (dto.amount !== order.amount) {
      this.logger.warn(`Rejected payment confirm with mismatched amount for order ${order.id}`);
      throw new ConflictException('결제 금액이 주문 금액과 일치하지 않습니다.');
    }

    // 토스 승인 요청에는 클라이언트가 본 금액이 아니라 서버에 저장된 주문 금액을 싣는다.
    const tossPayment = await this.confirmWithToss(
      { orderId: dto.orderId, paymentKey: dto.paymentKey },
      order.amount,
    );
    if (
      tossPayment.status !== 'DONE' ||
      tossPayment.orderId !== order.id ||
      tossPayment.totalAmount !== order.amount
    ) {
      this.logger.warn(`Rejected unverified Toss confirmation for order ${order.id}`);
      throw new BadRequestException('결제 정보가 주문 내용과 일치하지 않습니다.');
    }

    // The payment write and the order transition must commit or roll back
    // together — a paid order without its payment row (or vice versa) is
    // unrecoverable.
    try {
      return await this.db.transaction(async (tx) => {
        await this.persistPayment(tx, {
          orderId: order.id,
          provider: 'toss',
          providerPaymentKey: tossPayment.paymentKey,
          amount: tossPayment.totalAmount,
          status: 'paid',
          approvedAt: new Date(),
        });

        return this.ordersService.settleOrderPaid(tx, order.id);
      });
    } catch (error) {
      await this.compensateIfUnsettleable(error, order.id, tossPayment);
      throw error;
    }
  }

  /**
   * KCP 네이버페이 모바일 결제창 호출 전 거래등록. 본인의 pending 주문만 등록할 수 있고,
   * 금액은 서버 주문 금액으로 고정해 거래등록 자체의 금액 위변조를 막는다.
   * 응답의 approvalKey·PayUrl로 프론트가 모바일 결제창을 연다.
   */
  async registerKcpTransaction(userId: string, dto: KcpRegisterDto) {
    const order = await this.ordersService.findById(dto.orderId, userId);
    if (order.status !== 'pending') {
      throw new ConflictException('결제할 수 없는 주문입니다.');
    }
    return registerKcpTransaction({
      orderId: order.id,
      goodName: dto.orderName,
      amount: order.amount,
      flow: dto.flow,
    });
  }

  /** KCP 네이버페이 PC 결제창 콜백 경로 — 인증된 신청자 본인 주문만 승인한다. */
  async confirmKcpPayment(userId: string, dto: KcpConfirmDto) {
    const order = await this.ordersService.findById(dto.orderId, userId);
    return this.confirmKcpOrder(order, dto);
  }

  /**
   * KCP 모바일 결제창 인증 결과(Ret_URL) 처리. 가맹점 브라우저가 KCP 창에서 전체 페이지로
   * 도착하는 공개 진입점이므로 사용자 인증 대신 enc_data·enc_info(KCP 발급 암호화 값)를
   * capability로 쓰고, 주문·금액 대사는 전부 DB 기준으로 다시 한다. 결과를 리다이렉트
   * 대상으로 번역해 컨트롤러에 넘긴다 — 예외가 나도 브라우저에는 실패 페이지로 본다.
   */
  async handleKcpMobileReturn(fields: Record<string, string | undefined>): Promise<{
    outcome: 'success' | 'failed';
    orderId?: string;
    flow?: 'ad' | 'design';
    code?: string;
  }> {
    // 공개 엔드포인트라 비문자열(객체·숫자) 필드가 올 수 있다 — 로직에 쓰는 값만 문자열로 좁혀 쓴다.
    const asString = (value: unknown): string | undefined =>
      typeof value === 'string' && value.trim() ? value : undefined;
    const orderId = asString(fields?.ordr_idxx)?.trim() || undefined;
    const paramOpt1 = asString(fields?.param_opt_1);
    const flow = paramOpt1 === 'ad' || paramOpt1 === 'design' ? paramOpt1 : undefined;
    // 인증 실패(사용자 취소 res_cd 3001 포함)는 승인 요청 없이 실패 페이지로 본다.
    if (asString(fields?.res_cd) !== '0000') {
      return { outcome: 'failed', orderId, flow, code: asString(fields?.res_cd) || 'res_error' };
    }
    const encData = asString(fields?.enc_data);
    const encInfo = asString(fields?.enc_info);
    if (!orderId || !encData || !encInfo) {
      this.logger.warn('Ignoring KCP mobile return with missing auth fields');
      return { outcome: 'failed', orderId, flow, code: 'res_error' };
    }

    try {
      const order = await this.ordersService.findByIdInternal(orderId);
      await this.confirmKcpOrder(order, { encData, encInfo, tranCd: asString(fields?.tran_cd) });
      return { outcome: 'success', orderId, flow };
    } catch (error) {
      // 이미 확정된 주문의 KCP 재전송은 성공으로 수렴하고, 나머지 실패는 실패 페이지로 본다.
      this.logger.warn(`KCP mobile return confirm failed for order ${orderId}`);
      return { outcome: 'failed', orderId, flow, code: 'confirm_failed' };
    }
  }

  /**
   * KCP 네이버페이 승인 공통 코어(PC confirm·모바일 return이 함께 쓴다). 토스 confirm과
   * 동일한 계약 — KCP 승인 API의 res_cd·금액 대사, 거래번호(tno)의 주문 간 재사용 방어,
   * 결제 저장+주문 확정 트랜잭션, 확정 불가 시 KCP 취소 보상.
   */
  private async confirmKcpOrder(
    order: { id: string; amount: number; status: string },
    dto: { encData: string; encInfo: string; tranCd?: string },
  ) {
    if (order.status === 'paid') return order;
    if (order.status !== 'pending') {
      throw new ConflictException('결제할 수 없는 주문입니다.');
    }

    const approval = await (async () => {
      try {
        return await approveKcpPayment({
          orderId: order.id,
          amount: order.amount,
          encData: dto.encData,
          encInfo: dto.encInfo,
          tranCd: dto.tranCd,
        });
      } catch (error) {
        // 승인 자체는 됐고 응답 금액만 어긋난 경우 — 이미 청구된 결제다. 다른 주문에 이미
        // 바인딩된 tno는 우리 것이 아니므로 취소하지 않고, 우리 주문 것이면 취소로 보상한다.
        if (error instanceof KcpAmountMismatchError) {
          const [bound] = await this.db
            .select({ orderId: payments.orderId })
            .from(payments)
            .where(and(eq(payments.provider, 'kcp'), eq(payments.providerPaymentKey, error.tno)))
            .limit(1);
          if (bound && bound.orderId !== order.id) {
            this.logger.warn(
              `Not compensating KCP payment bound to another order (tno ${error.tno})`,
            );
          } else {
            await this.compensateKcpIfUnsettleable(
              new ConflictException('결제 금액이 주문 금액과 일치하지 않습니다.'),
              order.id,
              error.tno,
              error.approvedAmount,
            );
          }
          throw new BadRequestException('결제 정보가 주문 내용과 일치하지 않습니다.');
        }
        throw error;
      }
    })();

    // tno는 KCP 결제 1건당 1개다. 이미 다른 주문의 결제 row에 바인딩된 tno로 confirm하면
    // 결제 1건으로 주문 2건이 정산된다 — 네이버페이 경로의 paymentId 대조와 같은 안전망.
    const [bound] = await this.db
      .select({ orderId: payments.orderId })
      .from(payments)
      .where(and(eq(payments.provider, 'kcp'), eq(payments.providerPaymentKey, approval.tno)))
      .limit(1);
    if (bound && bound.orderId !== order.id) {
      this.logger.warn(`Rejected KCP tno reuse across orders for order ${order.id}`);
      throw new BadRequestException('결제 정보가 주문 내용과 일치하지 않습니다.');
    }

    try {
      return await this.db.transaction(async (tx) => {
        await this.persistPayment(tx, {
          orderId: order.id,
          provider: 'kcp',
          providerPaymentKey: approval.tno,
          amount: order.amount,
          status: 'paid',
          approvedAt: new Date(),
        });

        return this.ordersService.settleOrderPaid(tx, order.id);
      });
    } catch (error) {
      // 사전 SELECT를 동시에 통과한 병렬 confirm은 payments(provider, provider_payment_key)
      // unique 인덱스가 막는다 — 정산 불가(보상 취소 대상)가 아니라 검증 실패로 거부한다.
      if (
        (error as { code?: string; cause?: { code?: string } })?.code === '23505' ||
        (error as { cause?: { code?: string } })?.cause?.code === '23505'
      ) {
        this.logger.warn(`Rejected concurrent KCP tno reuse for order ${order.id}`);
        throw new BadRequestException('결제 정보가 주문 내용과 일치하지 않습니다.');
      }
      await this.compensateKcpIfUnsettleable(error, order.id, approval.tno, order.amount);
      throw error;
    }
  }

  /**
   * KCP로 이미 승인됐지만 주문을 확정할 수 없게 된 경우 KCP 취소로 보상한다. 취소마저 실패하면
   * refund_pending으로 남겨 워커의 재시도 스캔이 잡는다. ConflictException 외의 실패(DB 일시
   * 오류 등)는 트랜잭션 커밋 여부를 주문 상태로 다시 읽어 판별한다 — 이미 paid면 정산 커밋으로
   * 보상하지 않고, pending이면 승인만 남은 건으로 똑같이 보상한다. KCP에는 토스의 웹훅·재조회
   * 같은 정산 안전망이 없어 토스보다 이 흔적이 중요하다.
   */
  private async compensateKcpIfUnsettleable(
    error: unknown,
    orderId: string,
    tno: string,
    amount: number,
  ): Promise<'skipped' | 'refunded' | 'failed'> {
    if (!(error instanceof ConflictException)) {
      // 승인 후 트랜잭션 실패 — 커밋 여부를 주문 상태로 판별한다. 조회가 불가능하면
      // 상태를 모르는 채 되돌릴 수 없는 취소를 하면 안 된다 — 흔적(로그)만 남기고
      // 운영자가 KCP 거래내역과 주문을 수동 대사하도록 남긴다.
      let order: { status: string } | null = null;
      try {
        order = await this.ordersService.findByIdInternal(orderId);
      } catch (lookupError) {
        this.logger.error(
          `Cannot verify order ${orderId} state after a failed settlement — ` +
            `manual reconciliation required for KCP tno ${tno}`,
          (lookupError as Error | undefined)?.stack,
        );
        return 'skipped';
      }
      if (order.status === 'paid') return 'skipped'; // 정산은 커밋됐으니 취소하면 안 된다.
    }
    try {
      await cancelKcpPayment({ tno, cancelReason: '주문을 확정할 수 없어 자동 취소되었습니다.' });
    } catch (cancelError) {
      this.logger.error(
        `Compensating KCP cancel failed for order ${orderId} — manual refund required`,
        (cancelError as Error | undefined)?.stack,
      );
      await this.recordLocally(orderId, 'kcp', { paymentKey: tno, amount }, 'refund_pending');
      return 'failed';
    }
    this.logger.warn(`Canceled KCP payment for unsettleable order ${orderId}`);
    // KCP 보상은 주문이 여전히 pending일 때만 기록한다 — 같은 주문의 다른 승인(tno2)이
    // 그사이 정산을 커밋했을 때 cancelOrder가 Conflict로 트랜잭션을 롤백시켜, 이미 paid인
    // 결제 row·주문을 취소로 덮어쓰는 경쟁 상태를 막는다.
    await this.recordLocally(orderId, 'kcp', { paymentKey: tno, amount }, 'canceled', ['pending']);
    return 'refunded';
  }

  /**
   * Toss already charged the buyer but the order can no longer be settled (it was
   * canceled in the meantime, or its ad contract ended/was canceled — a
   * ConflictException from settleOrderPaid). Refund via Toss so the buyer is not
   * left charged for an unpaid order. Transient errors are NOT compensated: the
   * DONE webhook / a retried confirm can still settle the order later.
   */
  private async compensateIfUnsettleable(
    error: unknown,
    orderId: string,
    tossPayment: TossPayment,
  ): Promise<'skipped' | 'refunded' | 'failed'> {
    if (!(error instanceof ConflictException)) return 'skipped';
    try {
      await this.cancelWithToss(
        orderId,
        tossPayment.paymentKey,
        '주문을 확정할 수 없어 자동 취소되었습니다.',
      );
    } catch (cancelError) {
      this.logger.error(
        `Compensating Toss cancel failed for order ${orderId} — manual refund required`,
        (cancelError as Error | undefined)?.stack,
      );
      // Leave a local trail of the charged-but-unrefunded payment; the worker's
      // retryRefundPendingPayments scan retries the cancel with backoff and logs
      // when the retry cap is reached. DONE redelivery also retries the cancel.
      // https://docs.tosspayments.com/reference#결제-취소
      await this.recordLocally(
        orderId,
        'toss',
        { paymentKey: tossPayment.paymentKey, amount: tossPayment.totalAmount },
        'refund_pending',
      );
      return 'failed';
    }
    this.logger.warn(`Canceled Toss payment for unsettleable order ${orderId}`);
    // Don't wait for Toss's CANCELED webhook: record the cancellation and close the
    // order now, so a redelivered DONE sees a settled state instead of looping.
    await this.recordLocally(
      orderId,
      'toss',
      { paymentKey: tossPayment.paymentKey, amount: tossPayment.totalAmount },
      'canceled',
    );
    return 'refunded';
  }

  /**
   * 네이버페이 success 리다이렉트 confirm 경로. 네이버페이 결제형에는 토스 같은 정산용
   * 웹훅이 없으므로 이 confirm이 주문 확정의 유일 진입점이다. 가맹점 확인 API로 결제
   * 상태·금액을 서버 주문과 대조(재검증)한 뒤, 결제 저장과 주문 확정을 같은 트랜잭션에
   * 묻는다 — 토스 confirm과 동일한 계약이다.
   */
  private async confirmNaverPay(order: { id: string; amount: number }, paymentId: string) {
    const detail = await fetchNaverPayPaymentDetail(paymentId);
    if (
      detail.paymentStatus !== NAVERPAY_PAYMENT_COMPLETED ||
      detail.totalPayAmount !== order.amount
    ) {
      this.logger.warn(`Rejected unverified Naver Pay confirmation for order ${order.id}`);
      throw new BadRequestException('결제 정보가 주문 내용과 일치하지 않습니다.');
    }

    // PG 레벨 결제-주문 바인딩: 결제 요청에 merchantPayKey=주문 ID를 실었으므로 응답에 값이
    // 있으면 반드시 이 주문과 같아야 한다(토스의 tossPayment.orderId 대조와 같은 역할).
    // TODO: 가맹점 연동 가이드(developer.pay.naver.com, 로그인 필요)로 응답 필드명
    // (merchantPayKey/orderNo)을 실측 확인한 뒤, 값이 없을 때도 거부하도록 강화한다.
    const boundMerchantKey = detail.merchantPayKey ?? detail.orderNo;
    if (boundMerchantKey && boundMerchantKey !== order.id) {
      this.logger.warn(`Rejected Naver Pay merchant key mismatch for order ${order.id}`);
      throw new BadRequestException('결제 정보가 주문 내용과 일치하지 않습니다.');
    }

    // paymentId는 네이버페이 결제 1건당 1개다. 이미 다른 주문의 결제 row에 바인딩된
    // paymentId로 confirm하면 결제 1건으로 주문 2건이 정산된다(같은 금액의 주문 A·B를
    // 만든 뒤 A의 결제로 B를 확정하는 공격). 토스 경로의 tossPayment.orderId 대조와
    // 같은 역할의 안전망 — 확인 API 응답이 가맹점 주문번호를 주지 않아도 잡는다.
    // 주의: 보상 취소(compensate)로 이어지는 ConflictException이 아니라 검증 실패로
    // 거부해, 다른 주문 것인 결제가 취소되지 않게 한다.
    const [bound] = await this.db
      .select({ orderId: payments.orderId })
      .from(payments)
      .where(eq(payments.providerPaymentKey, paymentId))
      .limit(1);
    if (bound && bound.orderId !== order.id) {
      this.logger.warn(`Rejected Naver Pay paymentId reuse across orders for order ${order.id}`);
      throw new BadRequestException('결제 정보가 주문 내용과 일치하지 않습니다.');
    }

    try {
      return await this.db.transaction(async (tx) => {
        await this.persistPayment(tx, {
          orderId: order.id,
          provider: 'naverpay',
          providerPaymentKey: paymentId,
          amount: order.amount,
          status: 'paid',
          approvedAt: new Date(),
        });

        return this.ordersService.settleOrderPaid(tx, order.id);
      });
    } catch (error) {
      // 사전 SELECT를 동시에 통과한 병렬 confirm은 payments(provider, provider_payment_key)
      // unique 인덱스가 막는다 — 정산 불가(보상 취소 대상)가 아니라 검증 실패로 거부한다.
      if (
        (error as { code?: string; cause?: { code?: string } })?.code === '23505' ||
        (error as { cause?: { code?: string } })?.cause?.code === '23505'
      ) {
        this.logger.warn(`Rejected concurrent Naver Pay paymentId reuse for order ${order.id}`);
        throw new BadRequestException('결제 정보가 주문 내용과 일치하지 않습니다.');
      }
      await this.compensateNaverPayIfUnsettleable(error, order.id, paymentId, order.amount);
      throw error;
    }
  }

  /**
   * 네이버페이로 이미 청구됐지만 주문을 확정할 수 없게 된 경우(확인 창에서 취소 등)
   * 네이버페이 취소로 보상한다. 토스 경로 compensateIfUnsettleable과 동일 계약 —
   * 취소마저 실패하면 refund_pending으로 남겨 워커의 재시도 스캔이 잡는다.
   */
  private async compensateNaverPayIfUnsettleable(
    error: unknown,
    orderId: string,
    paymentId: string,
    amount: number,
  ): Promise<'skipped' | 'refunded' | 'failed'> {
    if (!(error instanceof ConflictException)) return 'skipped';
    try {
      await cancelNaverPayPayment({
        paymentId,
        orderId,
        cancelAmount: amount,
        cancelReason: '주문을 확정할 수 없어 자동 취소되었습니다.',
      });
    } catch (cancelError) {
      this.logger.error(
        `Compensating Naver Pay cancel failed for order ${orderId} — manual refund required`,
        (cancelError as Error | undefined)?.stack,
      );
      await this.recordLocally(
        orderId,
        'naverpay',
        { paymentKey: paymentId, amount },
        'refund_pending',
      );
      return 'failed';
    }
    this.logger.warn(`Canceled Naver Pay payment for unsettleable order ${orderId}`);
    await this.recordLocally(orderId, 'naverpay', { paymentKey: paymentId, amount }, 'canceled');
    return 'refunded';
  }

  private async recordLocally(
    orderId: string,
    provider: 'toss' | 'naverpay' | 'kcp',
    payment: { paymentKey: string; amount: number },
    status: 'canceled' | 'refund_pending',
    // 주문 취소가 허용되는 출발 상태 — KCP 보상처럼 pending에서만 기록해야 하는 경로가
    // 있어 기본값(pending·paid)을 그대로 두고 필요한 경로만 좁힌다.
    orderAllowedFrom: string[] = ['pending', 'paid'],
  ): Promise<void> {
    try {
      await this.db.transaction(async (tx) => {
        await this.persistPayment(tx, {
          orderId,
          provider,
          providerPaymentKey: payment.paymentKey,
          amount: payment.amount,
          status,
        });
        if (status === 'canceled')
          await this.ordersService.cancelOrder(tx, orderId, orderAllowedFrom);
      });
    } catch (error) {
      this.logger.error(
        `Failed to record ${status} payment for order ${orderId}`,
        (error as Error | undefined)?.stack,
      );
    }
  }

  /**
   * 워커가 주기적으로 호출하는 refund_pending 스캔. 결제는 됐지만 주문 확정이
   * 불가능해 Toss 취소(환불)마저 실패한 결제를 찾아 취소를 재시도한다.
   * 성공하면 recordLocally(..., 'canceled')로 결제와 주문을 같은 트랜잭션에서
   * 정산하고, 실패하면 refundRetryCount/refundRetriedAt을 갱신해 지수 백오프 뒤
   * 다시 시도한다. Toss 취소는 cancelWithToss를 그대로 재사용해 Idempotency-Key
   * (cancel:{orderId})로 중복 취소를 방지한다. 이미 'canceled'로 정산된 row는
   * 조건에서 제외되므로 재처리하지 않는다(멱등).
   */
  async retryRefundPendingPayments(now = new Date()): Promise<{
    scanned: number;
    attempted: number;
    refunded: number;
    failed: number;
  }> {
    const candidates = await this.db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.status, 'refund_pending'),
          lt(payments.refundRetryCount, REFUND_RETRY_MAX_ATTEMPTS),
        ),
      )
      .orderBy(asc(payments.refundRetriedAt))
      .limit(REFUND_RETRY_BATCH_LIMIT);

    const summary = { scanned: candidates.length, attempted: 0, refunded: 0, failed: 0 };
    if (candidates.length === 0) return summary;

    for (const payment of candidates) {
      // WHERE이 이미 좁혀줬지만, 재처리 대상 조건을 애플리케이션에서도 다시 검사해
      // 정산(취소)된 row가 절대 다시 취소되지 않도록 한다.
      if (
        payment.status !== 'refund_pending' ||
        payment.refundRetryCount >= REFUND_RETRY_MAX_ATTEMPTS
      ) {
        continue;
      }
      const dueAt = payment.refundRetriedAt
        ? payment.refundRetriedAt.getTime() + this.refundRetryBackoffMs(payment.refundRetryCount)
        : Number.NEGATIVE_INFINITY;
      if (dueAt > now.getTime()) continue;

      const providerConfigured =
        payment.provider === 'kcp'
          ? Boolean(env.kcpSiteCd && env.kcpCertInfo && env.kcpPrivateKey)
          : payment.provider === 'naverpay'
            ? Boolean(env.naverpayClientId && env.naverpayClientSecret && env.naverpayChainId)
            : Boolean(env.tossSecretKey);
      if (!providerConfigured) {
        // Misconfiguration must not burn retry attempts — every cancel would fail.
        this.logger.error(
          `${payment.provider} is not configured; skipping the refund_pending retry for order ${payment.orderId}`,
        );
        continue;
      }

      summary.attempted += 1;
      try {
        if (payment.provider === 'kcp') {
          await cancelKcpPayment({
            tno: payment.providerPaymentKey,
            cancelReason: '주문을 확정할 수 없어 자동 취소되었습니다.',
          });
        } else if (payment.provider === 'naverpay') {
          await cancelNaverPayPayment({
            paymentId: payment.providerPaymentKey,
            orderId: payment.orderId,
            cancelAmount: payment.amount,
            cancelReason: '주문을 확정할 수 없어 자동 취소되었습니다.',
          });
        } else {
          await this.cancelWithToss(
            payment.orderId,
            payment.providerPaymentKey,
            '주문을 확정할 수 없어 자동 취소되었습니다.',
          );
        }
      } catch (error) {
        summary.failed += 1;
        await this.recordRefundRetry(payment.id, payment.refundRetryCount + 1, now);
        if (payment.refundRetryCount + 1 >= REFUND_RETRY_MAX_ATTEMPTS) {
          this.logger.error(
            `Refund retry cap reached for order ${payment.orderId} ` +
              `after ${payment.refundRetryCount + 1} attempts — manual refund required`,
            (error as Error | undefined)?.stack,
          );
        } else {
          this.logger.warn(
            `Refund retry ${payment.refundRetryCount + 1}/${REFUND_RETRY_MAX_ATTEMPTS} ` +
              `failed for order ${payment.orderId}; backing off`,
          );
        }
        continue;
      }

      this.logger.warn(`Refunded unsettleable payment for order ${payment.orderId} on retry`);
      await this.recordLocally(
        payment.orderId,
        payment.provider === 'kcp' ? 'kcp' : payment.provider === 'naverpay' ? 'naverpay' : 'toss',
        { paymentKey: payment.providerPaymentKey, amount: payment.amount },
        'canceled',
      );
      summary.refunded += 1;
    }
    return summary;
  }

  // 지수 백오프: 기준 간격 × 2^(이미 시도한 횟수)에 상한을 둔다. 마지막 시도
  // 시각부터 이 간격이 지난 row만 재시도 대상이 된다.
  private refundRetryBackoffMs(attempts: number): number {
    return Math.min(REFUND_RETRY_BASE_BACKOFF_MS * 2 ** attempts, REFUND_RETRY_MAX_BACKOFF_MS);
  }

  private async recordRefundRetry(paymentId: string, attempts: number, retriedAt: Date) {
    try {
      await this.db
        .update(payments)
        .set({ refundRetryCount: attempts, refundRetriedAt: retriedAt })
        .where(eq(payments.id, paymentId));
    } catch (error) {
      this.logger.error(
        `Failed to record refund retry for payment ${paymentId}`,
        (error as Error | undefined)?.stack,
      );
    }
  }

  /**
   * 관리자가 승인한 환불: 결제 row의 provider에 따라 네이버페이/토스 취소 API로 전액(잔액)
   * 취소 → 결제 canceled + 주문 canceled 전이를 `settle` 콜백(환불 요청 상태 갱신 등)과
   * 같은 트랜잭션으로 커밋한다.
   * Toss 취소는 주문 단위 Idempotency-Key라 재시도해도 이중 취소되지 않고, 이미 취소된 결제
   * (ALREADY_CANCELED_PAYMENT — 이전 시도의 응답 유실·웹훅 선행)는 성공으로 수렴한다.
   * @returns 환불된 결제 금액(원 결제액 - 이전 부분 환불액)
   */
  async refundPaidOrder(
    orderId: string,
    cancelReason: string,
    settle: (tx: DbTx, refundedAmount: number) => Promise<void>,
  ): Promise<number> {
    const [payment] = await this.db
      .select()
      .from(payments)
      .where(eq(payments.orderId, orderId))
      .limit(1);
    if (!payment || payment.status !== 'paid') {
      throw new ConflictException('환불할 수 있는 결제가 아닙니다.');
    }

    const refundedAmount = payment.amount - payment.refundedAmount;
    // KCP 결제는 KCP 취소 API(서명데이터 포함)로, 네이버페이 결제는 네이버페이 취소 API로,
    // 토스 결제는 토스 취소 API로 전액(잔액) 취소한다.
    // 토스 취소는 주문 단위 Idempotency-Key라 재시도해도 이중 취소되지 않고, 이미 취소된 결제
    // (ALREADY_CANCELED_PAYMENT — 이전 시도의 응답 유실·웹훅 선행)는 성공으로 수렴한다.
    if (payment.provider === 'kcp') {
      await cancelKcpPayment({
        tno: payment.providerPaymentKey,
        cancelReason,
      });
    } else if (payment.provider === 'naverpay') {
      await cancelNaverPayPayment({
        paymentId: payment.providerPaymentKey,
        orderId,
        cancelAmount: refundedAmount,
        cancelReason,
      });
    } else {
      await this.cancelTossPayment(payment.providerPaymentKey, cancelReason, orderId);
    }

    await this.db.transaction(async (tx) => {
      await tx.update(payments).set({ status: 'canceled' }).where(eq(payments.id, payment.id));
      await this.ordersService.cancelOrder(tx, orderId);
      await settle(tx, refundedAmount);
    });
    return refundedAmount;
  }

  // 토스 결제 전액(잔액) 취소 공통 처리 — refundPaidOrder와 cancelWithToss가 함께 쓴다.
  private async cancelTossPayment(
    paymentKey: string,
    cancelReason: string,
    orderId: string,
  ): Promise<void> {
    if (!env.tossSecretKey) {
      throw new BadGatewayException('결제 서비스가 구성되지 않았습니다.');
    }
    const authorization = Buffer.from(`${env.tossSecretKey}:`).toString('base64');
    let response;
    try {
      response = await fetchJson(
        `https://api.tosspayments.com/v1/payments/${encodeURIComponent(paymentKey)}/cancel`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${authorization}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': `refund:${orderId}`,
          },
          body: JSON.stringify({ cancelReason }),
          signal: AbortSignal.timeout(10_000),
        },
      );
    } catch (error) {
      this.logger.error(
        `Toss refund transport failed for order ${orderId}`,
        (error as Error | undefined)?.stack,
      );
      throw new BadGatewayException('결제 취소에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    }
    if (!response.ok) {
      let code: string | undefined;
      try {
        code = ((await response.json()) as { code?: string } | null)?.code;
      } catch {
        // Error body is not JSON — treat as a plain rejection below.
      }
      if (code !== 'ALREADY_CANCELED_PAYMENT') {
        this.logger.error(`Toss refund rejected for order ${orderId}: HTTP ${response.status}`);
        throw new BadGatewayException('결제 취소에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      }
    }
  }

  private async cancelWithToss(
    orderId: string,
    paymentKey: string,
    cancelReason: string,
  ): Promise<void> {
    if (!env.tossSecretKey) {
      throw new BadGatewayException('결제 서비스가 구성되지 않았습니다.');
    }
    const authorization = Buffer.from(`${env.tossSecretKey}:`).toString('base64');
    const response = await fetchJson(
      `https://api.tosspayments.com/v1/payments/${encodeURIComponent(paymentKey)}/cancel`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${authorization}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `cancel:${orderId}`,
        },
        body: JSON.stringify({ cancelReason }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) {
      throw new BadGatewayException(`Toss cancel rejected: HTTP ${response.status}`);
    }
  }

  private async confirmWithToss(
    dto: { orderId: string; paymentKey: string },
    amount: number,
  ): Promise<TossPayment> {
    if (!env.tossSecretKey) {
      throw new BadGatewayException('결제 서비스가 구성되지 않았습니다.');
    }

    const authorization = Buffer.from(`${env.tossSecretKey}:`).toString('base64');
    let response;
    try {
      response = await fetchJson('https://api.tosspayments.com/v1/payments/confirm', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${authorization}`,
          'Content-Type': 'application/json',
          // Toss replays the first result for a repeated key, so a retried confirm
          // after a timeout cannot double-charge.
          'Idempotency-Key': `confirm:${dto.orderId}`,
        },
        body: JSON.stringify({
          paymentKey: dto.paymentKey,
          orderId: dto.orderId,
          amount,
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      this.logger.error(
        `Toss payment confirm transport failed for order ${dto.orderId}`,
        (error as Error | undefined)?.stack,
      );
      throw new BadGatewayException('결제 승인에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    }
    if (!response.ok) {
      let code: string | undefined;
      try {
        code = ((await response.json()) as { code?: string } | null)?.code;
      } catch {
        // Error body is not JSON — treat as a plain rejection below.
      }
      if (code === 'ALREADY_PROCESSED_PAYMENT') {
        // A previous confirm (e.g. one whose response we lost to a timeout) already
        // went through — converge on Toss's recorded state instead of failing.
        return this.getTossPayment(dto.paymentKey);
      }
      this.logger.error(
        `Toss payment confirm rejected for order ${dto.orderId}: HTTP ${response.status}`,
      );
      throw new BadGatewayException('결제 승인에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    }
    return (await response.json()) as TossPayment;
  }

  private async handleDone(orderId: string, paymentKey: string): Promise<void> {
    const [order, tossPayment] = await Promise.all([
      this.ordersService.findByIdInternal(orderId),
      this.getTossPayment(paymentKey),
    ]);

    // A DONE redelivered after we refunded the payment ourselves (see
    // compensateIfUnsettleable): Toss now reports CANCELED, which is settled — ack.
    if (
      tossPayment.status === 'CANCELED' &&
      tossPayment.orderId === order.id &&
      tossPayment.totalAmount === order.amount &&
      order.status === 'canceled'
    ) {
      return;
    }

    if (
      tossPayment.status !== 'DONE' ||
      tossPayment.orderId !== order.id ||
      tossPayment.totalAmount !== order.amount
    ) {
      this.logger.warn(`Rejected unverified Toss webhook for order ${orderId}`);
      throw new UnauthorizedException('Toss payment did not match the order');
    }

    // Idempotency: Toss redelivers DONE, and it can also arrive after an
    // earlier terminal webhook (EXPIRED/CANCELED) already settled the order.
    // Acknowledge instead of throwing — a 4xx here makes Toss retry a
    // permanently settled state forever.
    if (order.status === 'paid') return;
    if (order.status === 'canceled') {
      // Toss really charged the buyer (verified DONE above) but the order was
      // canceled in the meantime (e.g. the buyer canceled while checkout was
      // open). Refund like the confirm path does instead of keeping the money;
      // a failed cancel rethrows so Toss redelivers and the retry scan picks it up.
      const outcome = await this.compensateIfUnsettleable(
        new ConflictException('취소된 주문입니다.'),
        order.id,
        tossPayment,
      );
      if (outcome === 'failed') {
        throw new BadGatewayException('Toss refund for a canceled order failed');
      }
      return;
    }
    if (order.status !== 'pending') {
      this.logger.warn(
        `Ignoring DONE for order ${orderId} already in terminal status ${order.status}`,
      );
      return;
    }

    // The payment write and the order transition must commit or roll back
    // together — a paid order without its payment row (or vice versa) is
    // unrecoverable.
    try {
      await this.db.transaction(async (tx) => {
        await this.persistPayment(tx, {
          orderId: order.id,
          provider: 'toss',
          providerPaymentKey: tossPayment.paymentKey,
          amount: tossPayment.totalAmount,
          status: 'paid',
          approvedAt: new Date(),
        });

        await this.ordersService.settleOrderPaid(tx, order.id);
      });
    } catch (error) {
      // Refunded and converged locally → ack. Otherwise rethrow so Toss redelivers
      // the DONE webhook, which drives the refund retry.
      const outcome = await this.compensateIfUnsettleable(error, order.id, tossPayment);
      if (outcome === 'refunded') return;
      throw error;
    }
  }

  private async handleCanceled(orderId: string, paymentKey: string): Promise<void> {
    const [order, tossPayment] = await Promise.all([
      this.ordersService.findByIdInternal(orderId),
      this.getTossPayment(paymentKey),
    ]);

    if (
      tossPayment.status !== 'CANCELED' ||
      tossPayment.orderId !== order.id ||
      tossPayment.totalAmount !== order.amount
    ) {
      this.logger.warn(`Rejected unverified Toss cancellation for order ${orderId}`);
      throw new UnauthorizedException('Toss payment did not match the order');
    }

    // The payment write and the order transition must commit or roll back
    // together (same contract as handleExpired).
    await this.db.transaction(async (tx) => {
      await this.persistPayment(tx, {
        orderId: order.id,
        provider: 'toss',
        providerPaymentKey: tossPayment.paymentKey,
        amount: tossPayment.totalAmount,
        status: 'canceled',
      });

      await this.ordersService.cancelOrder(tx, order.id);
    });
  }

  private async handleExpired(orderId: string, paymentKey: string): Promise<void> {
    await this.handleNeverCharged(orderId, paymentKey, 'EXPIRED');
  }

  // ABORTED: 인증은 끝났지만 승인까지 이어지지 않은 결제(사용자 중도 이탈 등).
  // EXPIRED와 동일하게 '결제되지 않음'으로 정리해 pending 주문을 계속 남기지 않는다.
  private async handleAborted(orderId: string, paymentKey: string): Promise<void> {
    await this.handleNeverCharged(orderId, paymentKey, 'ABORTED');
  }

  private async handleNeverCharged(
    orderId: string,
    paymentKey: string,
    tossStatus: 'EXPIRED' | 'ABORTED',
  ): Promise<void> {
    const [order, tossPayment] = await Promise.all([
      this.ordersService.findByIdInternal(orderId),
      this.getTossPayment(paymentKey),
    ]);

    if (
      tossPayment.status !== tossStatus ||
      tossPayment.orderId !== order.id ||
      tossPayment.totalAmount !== order.amount
    ) {
      this.logger.warn(`Rejected unverified Toss ${tossStatus} for order ${orderId}`);
      throw new UnauthorizedException('Toss payment did not match the order');
    }

    // A DONE webhook may have already settled this order before this (possibly
    // out-of-order) terminal notification arrived — never cancel a paid order.
    if (order.status !== 'pending') return;

    // The payment write and the order transition must commit or roll back
    // together — an unsettled payment whose order stays pending is unrecoverable.
    await this.db.transaction(async (tx) => {
      await this.persistPayment(tx, {
        orderId: order.id,
        provider: 'toss',
        providerPaymentKey: tossPayment.paymentKey,
        amount: tossPayment.totalAmount,
        status: 'expired',
      });
      await this.ordersService.cancelOrder(tx, order.id, ['pending']);
    });
  }

  private async handlePartialCanceled(orderId: string, paymentKey: string): Promise<void> {
    const [order, tossPayment] = await Promise.all([
      this.ordersService.findByIdInternal(orderId),
      this.getTossPayment(paymentKey),
    ]);

    if (
      tossPayment.status !== 'PARTIAL_CANCELED' ||
      tossPayment.orderId !== order.id ||
      tossPayment.totalAmount !== order.amount
    ) {
      this.logger.warn(`Rejected unverified Toss partial cancellation for order ${orderId}`);
      throw new UnauthorizedException('Toss payment did not match the order');
    }
    if (typeof tossPayment.balanceAmount !== 'number') {
      throw new BadGatewayException('Toss partial cancellation response missing balanceAmount');
    }

    // Toss only allows a partial cancel on an already-approved payment, so
    // this webhook must never be the first one we process for an order. When
    // it outruns the DONE webhook there is no payment row yet, and the upsert
    // below would insert a phantom 'paid' row onto a still-pending order.
    // Reject instead — Toss redelivers, and once DONE settles, the redelivery
    // applies normally (same re-verify-and-redeliver pattern as the
    // verification failures above).
    const [payment] = await this.db
      .select({ status: payments.status })
      .from(payments)
      .where(eq(payments.orderId, order.id))
      .limit(1);
    if (order.status === 'pending' || !payment) {
      this.logger.warn(`Rejected PARTIAL_CANCELED for order ${orderId} without a settled payment`);
      throw new UnauthorizedException(
        'Toss partial cancellation arrived before the payment was settled',
      );
    }

    // Terminal or inconsistent settled states are acknowledged, never rejected:
    // a 4xx would make Toss retry a state no redelivery can change (same
    // contract as handleDone). The upsert's setWhere below still guards the
    // row against a concurrent full cancel racing this read.
    if (order.status !== 'paid' || payment.status !== 'paid') {
      this.logger.warn(
        `Ignoring PARTIAL_CANCELED for order ${orderId} settled as ${order.status}/${payment.status}`,
      );
      return;
    }

    // Toss reports the running balance, not a per-webhook delta: always SET
    // refundedAmount from it (never increment) so an out-of-order or
    // redelivered webhook converges to the same value instead of
    // double-counting a refund.
    const refundedAmount = Math.max(0, tossPayment.totalAmount - tossPayment.balanceAmount);

    await this.db
      .insert(payments)
      .values({
        orderId: order.id,
        provider: 'toss',
        providerPaymentKey: tossPayment.paymentKey,
        amount: tossPayment.totalAmount,
        status: 'paid',
        refundedAmount,
        approvedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: payments.orderId,
        set: { refundedAmount },
        // A partial refund only adjusts a payment that is still in force as
        // 'paid' — it never resurrects a row already settled as fully
        // canceled or expired.
        setWhere: eq(payments.status, 'paid'),
      });
  }

  private persistPayment(
    tx: Database | DbTx,
    values: {
      orderId: string;
      provider: string;
      providerPaymentKey: string;
      amount: number;
      status: string;
      approvedAt?: Date;
    },
  ) {
    const insert = tx.insert(payments).values(values);
    if (values.status === 'paid') {
      // DONE never overwrites an existing payment row.
      return insert.onConflictDoNothing({ target: payments.orderId });
    }
    return insert.onConflictDoUpdate({
      target: payments.orderId,
      set: { status: values.status },
      setWhere:
        values.status === 'expired'
          ? and(
              ne(payments.status, 'paid'),
              ne(payments.status, 'expired'),
              ne(payments.status, 'canceled'),
            )
          : ne(payments.status, 'canceled'),
    });
  }

  private async getTossPayment(paymentKey: string): Promise<TossPayment> {
    if (!env.tossSecretKey)
      throw new BadGatewayException('Toss payment verification is not configured');

    const authorization = Buffer.from(`${env.tossSecretKey}:`).toString('base64');
    let response;
    try {
      response = await fetchJson(
        `https://api.tosspayments.com/v1/payments/${encodeURIComponent(paymentKey)}`,
        {
          headers: { Authorization: `Basic ${authorization}` },
          signal: AbortSignal.timeout(10_000),
        },
      );
    } catch {
      throw new BadGatewayException('Toss payment verification failed');
    }
    if (!response.ok) throw new BadGatewayException('Toss payment verification failed');
    return (await response.json()) as TossPayment;
  }
}
