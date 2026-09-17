import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Database, type DbTx } from '../../db/drizzle.provider.js';
import { ads, orders } from '../../db/schema.js';
import { adToday } from '../ads/ad-period.js';

@Injectable()
export class OrdersService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findById(id: string, userId: string) {
    const [order] = await this.db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!order || order.userId !== userId) throw new NotFoundException('Order not found');
    return order;
  }

  /** Trusted server-side lookup (webhooks, internal jobs) — no ownership check. */
  async findByIdInternal(id: string) {
    const [order] = await this.db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async markPaid(id: string) {
    return this.db.transaction(async (tx) => {
      const [existing] = await tx.select().from(orders).where(eq(orders.id, id)).for('update');
      if (!existing) throw new NotFoundException('Order not found');
      if (existing.status === 'paid') return existing;
      if (existing.status !== 'pending') throw new ConflictException('결제할 수 없는 주문입니다.');
      if (existing.adId) {
        const [ad] = await tx.select().from(ads).where(eq(ads.id, existing.adId)).for('update');
        if (!ad || ad.status !== 'preparing' || ad.endDate < adToday()) {
          throw new ConflictException('종료되거나 취소된 광고 계약입니다.');
        }
      }
      const [order] = await tx
        .update(orders)
        .set({ status: 'paid' })
        .where(eq(orders.id, id))
        .returning();

      if (order?.adId) {
        await tx.update(ads).set({ status: 'active' }).where(eq(ads.id, order.adId));
      }

      return order;
    });
  }

  async markCancelled(id: string) {
    return this.db.transaction((tx) => this.cancelOrder(tx, id));
  }

  /** Caller-supplied transaction so the cancellation can commit atomically with a related write. */
  async cancelOrder(tx: DbTx, id: string, allowedFrom: string[] = ['pending', 'paid']) {
    const [existing] = await tx.select().from(orders).where(eq(orders.id, id)).for('update');
    if (!existing) throw new NotFoundException('Order not found');
    if (existing.status === 'canceled') return existing;
    if (!allowedFrom.includes(existing.status)) {
      throw new ConflictException('취소할 수 없는 주문입니다.');
    }
    // TODO: a canceled/refunded order whose ad was already activated by markPaid
    // still leaves ads.status = 'active' — reverting the ad isn't implemented yet.
    const [order] = await tx
      .update(orders)
      .set({ status: 'canceled' })
      .where(eq(orders.id, id))
      .returning();

    return order;
  }
}
