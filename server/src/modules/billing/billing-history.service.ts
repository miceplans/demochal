import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, inArray, lte, or, sql } from 'drizzle-orm';
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
    // 결제되지 않은 시도(expired/ready)는 잔액 변동이 없으므로 내역에서 제외한다 —
    // 실패한 시도가 음수 과금 항목·1970년대 일시로 표시되는 것을 방지(총액에서도 이미 제외).
    conditions.push(inArray(payments.status, ['paid', 'done', 'canceled', 'cancelled']));
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

    const items: PaymentHistoryItem[] = rows.map((row) => {
      const status: PaymentHistoryItem['status'] =
        row.status === 'paid' || row.status === 'done'
          ? 'paid'
          : row.status === 'canceled' || row.status === 'cancelled'
            ? 'refunded'
            : 'failed';
      // payments.service.ts(writer)는 취소되어도 원 결제 금액의 부호를 뒤집지 않고 그대로
      // 보관한다. refunded 행을 -row.amount로 내보내면 PaymentHistoryItem 계약(환불은 양수)을
      // 어기고, total에서 환불이 또 한번 잔액을 깎는 것처럼 보이게 된다 — 매핑된 status 기준으로
      // 부호를 정한다. paid 행은 기존 음수(차감) 표시 규약을 유지한다.
      const amount = status === 'refunded' ? row.amount : -row.amount;
      return {
        id: row.id,
        name: row.name ?? '주문',
        amount,
        paidAt: row.approvedAt ? row.approvedAt.toISOString() : null,
        status,
      };
    });
    // Only charged rows represent an actual balance movement: 'canceled'/'cancelled'
    // payments were refunded (net 0) and 'expired'/'ready' rows were never charged.
    // 'done' is the legacy writer vocabulary for a charged payment, so it counts
    // alongside 'paid'. The item mapping above preserves both current and legacy
    // status vocabulary for API consumers.
    const total = rows.reduce(
      (sum, row) => (row.status === 'paid' || row.status === 'done' ? sum - row.amount : sum),
      0,
    );
    return { items, total };
  }
}
