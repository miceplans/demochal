import { Injectable, Logger } from '@nestjs/common';
import { OrdersService } from '../orders/orders.service.js';

export interface TossWebhookPayload {
  eventType: string;
  data: {
    paymentKey: string;
    orderId: string;
    status: string;
  };
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(private readonly ordersService: OrdersService) {}

  async handleTossWebhook(payload: TossWebhookPayload): Promise<void> {
    this.logger.log(`Received Toss webhook: ${payload.eventType} for ${payload.data.orderId}`);

    if (payload.data.status === 'DONE') {
      await this.ordersService.markPaid(payload.data.orderId);
    }
    // TODO: handle CANCELED/PARTIAL_CANCELED/EXPIRED and persist a Payment row.
  }
}
