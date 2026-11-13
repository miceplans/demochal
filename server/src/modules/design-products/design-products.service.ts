import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { orders } from '../../db/schema.js';
import { DESIGN_PRODUCTS, type DesignProductCode } from './design-products.catalog.js';

@Injectable()
export class DesignProductsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  list() {
    return DESIGN_PRODUCTS.map((p) => ({ ...p }));
  }

  /** 결제 대기(pending) 주문을 만든다. 확정은 POST /payments/confirm · Toss 웹훅이 맡는다. */
  async createOrder(code: DesignProductCode, userId: string) {
    const product = DESIGN_PRODUCTS.find((p) => p.code === code);
    if (!product) throw new NotFoundException('디자인 상품을 찾을 수 없습니다.');
    const [order] = await this.db
      .insert(orders)
      .values({ userId, designProduct: product.code, amount: product.price })
      .returning({ id: orders.id, amount: orders.amount });
    if (!order) throw new Error('Failed to create design product order');
    return { ...order, name: product.name };
  }
}
