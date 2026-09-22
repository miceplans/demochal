import {
  BadGatewayException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { and, eq, ne } from 'drizzle-orm';
import { fetchJson } from '../../common/http/fetch-json.js';
import { env } from '../../config/env.js';
import { DRIZZLE, type Database, type DbTx } from '../../db/drizzle.provider.js';
import { payments } from '../../db/schema.js';
import { OrdersService } from '../orders/orders.service.js';
import type { ConfirmPaymentDto } from './dto/confirm-payment.dto.js';

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

    // TODO: other non-terminal/rare Toss statuses (IN_PROGRESS —
    // https://docs.tosspayments.com/reference#status) are still silently
    // ignored; none of them require a balance reconciliation today.
  }

  /**
   * 토스 successUrl 리다이렉트에 대응하는 클라이언트 호출 승인 경로. 카드 결제는 토스가
   * 웹훅 없이도 이 승인 호출을 요구하므로, 폴리만으로는 주문이 paid에 도달할 수 없다.
   * 결제 저장과 주문 확정은 같은 트랜잭션에서 처리하고, 이미 확정된 주문의 재요청은
   * 토스 재호출 없이 기존 결과를 돌려준다(새로고침 멱등).
   */
  async confirmPayment(userId: string, dto: ConfirmPaymentDto) {
    const order = await this.ordersService.findById(dto.orderId, userId);
    if (order.status === 'paid') return order;
    if (order.status !== 'pending') {
      throw new ConflictException('결제할 수 없는 주문입니다.');
    }
    if (dto.amount !== order.amount) {
      this.logger.warn(`Rejected payment confirm with mismatched amount for order ${order.id}`);
      throw new UnauthorizedException('Payment amount does not match the order');
    }

    const tossPayment = await this.confirmWithToss(dto);
    if (
      tossPayment.status !== 'DONE' ||
      tossPayment.orderId !== order.id ||
      tossPayment.totalAmount !== order.amount
    ) {
      this.logger.warn(`Rejected unverified Toss confirmation for order ${order.id}`);
      throw new UnauthorizedException('Toss payment did not match the order');
    }

    // The payment write and the order transition must commit or roll back
    // together — a paid order without its payment row (or vice versa) is
    // unrecoverable.
    return this.db.transaction(async (tx) => {
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
  }

  private async confirmWithToss(dto: ConfirmPaymentDto): Promise<TossPayment> {
    if (!env.tossSecretKey) {
      throw new BadGatewayException('Toss payment confirmation is not configured');
    }

    const authorization = Buffer.from(`${env.tossSecretKey}:`).toString('base64');
    let response;
    try {
      response = await fetchJson('https://api.tosspayments.com/v1/payments/confirm', {
        method: 'POST',
        headers: { Authorization: `Basic ${authorization}` },
        body: JSON.stringify({
          paymentKey: dto.paymentKey,
          orderId: dto.orderId,
          amount: dto.amount,
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      this.logger.error(
        `Toss payment confirm transport failed for order ${dto.orderId}`,
        (error as Error | undefined)?.stack,
      );
      throw new BadGatewayException('Toss payment confirmation failed');
    }
    if (!response.ok) {
      this.logger.error(
        `Toss payment confirm rejected for order ${dto.orderId}: HTTP ${response.status}`,
      );
      throw new BadGatewayException('Toss payment confirmation failed');
    }
    return (await response.json()) as TossPayment;
  }

  private async handleDone(orderId: string, paymentKey: string): Promise<void> {
    const [order, tossPayment] = await Promise.all([
      this.ordersService.findByIdInternal(orderId),
      this.getTossPayment(paymentKey),
    ]);

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
    if (order.status !== 'pending') {
      this.logger.warn(
        `Ignoring DONE for order ${orderId} already in terminal status ${order.status}`,
      );
      return;
    }

    // The payment write and the order transition must commit or roll back
    // together — a paid order without its payment row (or vice versa) is
    // unrecoverable.
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
