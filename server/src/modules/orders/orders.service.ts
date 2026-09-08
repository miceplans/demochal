import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { orders } from '../../db/schema.js';

@Injectable()
export class OrdersService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findById(id: string) {
    const [order] = await this.db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async markPaid(id: string) {
    const [order] = await this.db
      .update(orders)
      .set({ status: 'paid' })
      .where(eq(orders.id, id))
      .returning();
    return order;
  }
}
