import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, lte, or, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { ads, applications, challenges, orders, payments } from '../../db/schema.js';

export interface PaymentHistoryRange {
  from?: string;
  to?: string;
}

// Mirrors packages/api-client PaymentHistoryItem (field names must match).
export interface PaymentHistoryItem {
  id: string;
  name: string;
  amount: number;
  paidAt: string | null;
  status: 'paid' | 'refunded' | 'failed';
}

@Injectable()
export class BillingHistoryService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * 결제 내역: payments→orders→(ads | applications→challenges) 조인. 광고 결제는 음수 부호
   * 규약(amount = -payments.amount), 충전·환불 양수 플로우는 아직 스펙에 없다. approvedAt이
   * 없는 행(결제 대기/실패)은 COALESCE로 정렬 시 맨 아래로 본다.
   */
  async forBusiness(businessId: string, range: PaymentHistoryRange) {
    const conditions = [or(eq(ads.businessId, businessId), eq(challenges.businessId, businessId))];
    if (range.from) conditions.push(gte(payments.approvedAt, new Date(range.from)));
    if (range.to) conditions.push(lte(payments.approvedAt, new Date(`${range.to}T23:59:59.999Z`)));

    const rows = await this.db
      .select({
        id: payments.id,
        name: sql<string | null>`coalesce(${ads.title}, ${challenges.title})`,
        amount: payments.amount,
        status: payments.status,
        approvedAt: payments.approvedAt,
      })
      .from(payments)
      .innerJoin(orders, eq(payments.orderId, orders.id))
      .leftJoin(ads, eq(orders.adId, ads.id))
      .leftJoin(applications, eq(orders.applicationId, applications.id))
      .leftJoin(challenges, eq(applications.challengeId, challenges.id))
      .where(and(...conditions))
      .orderBy(desc(sql`coalesce(${payments.approvedAt}, timestamp '1970-01-01 00:00:00')`));

    const items: PaymentHistoryItem[] = rows.map((row) => ({
      id: row.id,
      name: row.name ?? '주문',
      amount: -row.amount,
      paidAt: row.approvedAt ? row.approvedAt.toISOString() : null,
      status:
        row.status === 'paid'
          ? 'paid'
          : row.status === 'refunded' || row.status === 'cancelled'
            ? 'refunded'
            : 'failed',
    }));
    const total = items.reduce((sum, item) => sum + item.amount, 0);
    return { items, total };
  }
}
