import {
  BadGatewayException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { env } from '../../config/env.js';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
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

    if (status !== 'DONE') {
      await this.reflectCancellation(status, paymentKey);
      return;
    }

    const [order, tossPayment] = await Promise.all([
      this.ordersService.findByIdInternal(payload.data.orderId),
      this.getTossPayment(payload.data.paymentKey),
    ]);

    if (
      tossPayment.status !== 'DONE' ||
      tossPayment.orderId !== order.id ||
      tossPayment.totalAmount !== order.amount
    ) {
      this.logger.warn(`Rejected unverified Toss webhook for order ${payload.data.orderId}`);
      throw new UnauthorizedException('Toss payment did not match the order');
    }

    const [existingPayment] = await this.db
      .select({ id: payments.id })
      .from(payments)
      .where(eq(payments.orderId, order.id))
      .limit(1);
    if (!existingPayment) {
      await this.db.insert(payments).values({
        orderId: order.id,
        provider: 'toss',
        providerPaymentKey: tossPayment.paymentKey,
        amount: tossPayment.totalAmount,
        status: 'paid',
        approvedAt: new Date(),
      });
    }

    await this.ordersService.markPaid(order.id);
  }

  /**
   * Cancel/expire events only relabel an already-recorded payment; they never
   * create a row. Unrecognized event statuses are ignored.
   */
  private async reflectCancellation(eventStatus: string, paymentKey: string): Promise<void> {
    const status =
      eventStatus === 'PARTIAL_CANCELED'
        ? 'refunded'
        : eventStatus === 'CANCELED' || eventStatus === 'EXPIRED' || eventStatus === 'ABORTED'
          ? 'cancelled'
          : null;
    if (!status) return;
    await this.db
      .update(payments)
      .set({ status })
      .where(eq(payments.providerPaymentKey, paymentKey));
  }

  private async getTossPayment(paymentKey: string): Promise<TossPayment> {
    if (!env.tossSecretKey)
      throw new BadGatewayException('Toss payment verification is not configured');

    const authorization = Buffer.from(`${env.tossSecretKey}:`).toString('base64');
    let response: Response;
    try {
      response = await fetch(
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
