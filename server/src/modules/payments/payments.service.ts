import {
  BadGatewayException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { and, ne } from 'drizzle-orm';
import { fetchJson } from '../../common/http/fetch-json.js';
import { env } from '../../config/env.js';
import { DRIZZLE, type Database, type DbTx } from '../../db/drizzle.provider.js';
import { payments } from '../../db/schema.js';
import { OrdersService } from '../orders/orders.service.js';

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

    // TODO: PARTIAL_CANCELED (https://docs.tosspayments.com/reference#status) is
    // still silently ignored — reconciling a partial refund needs the payments
    // table to track a refunded amount separate from the original charge, which
    // doesn't exist yet.
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

    await this.persistPayment(this.db, {
      orderId: order.id,
      provider: 'toss',
      providerPaymentKey: tossPayment.paymentKey,
      amount: tossPayment.totalAmount,
      status: 'paid',
      approvedAt: new Date(),
    });

    await this.ordersService.markPaid(order.id);
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

    await this.persistPayment(this.db, {
      orderId: order.id,
      provider: 'toss',
      providerPaymentKey: tossPayment.paymentKey,
      amount: tossPayment.totalAmount,
      status: 'canceled',
    });

    await this.ordersService.markCancelled(order.id);
  }

  private async handleExpired(orderId: string, paymentKey: string): Promise<void> {
    const [order, tossPayment] = await Promise.all([
      this.ordersService.findByIdInternal(orderId),
      this.getTossPayment(paymentKey),
    ]);

    if (
      tossPayment.status !== 'EXPIRED' ||
      tossPayment.orderId !== order.id ||
      tossPayment.totalAmount !== order.amount
    ) {
      this.logger.warn(`Rejected unverified Toss expiry for order ${orderId}`);
      throw new UnauthorizedException('Toss payment did not match the order');
    }

    // A DONE webhook may have already settled this order before this (possibly
    // out-of-order) EXPIRED notification arrived — never cancel a paid order.
    if (order.status !== 'pending') return;

    // The payment write and the order transition must commit or roll back
    // together — an expired payment whose order stays pending is unrecoverable.
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
