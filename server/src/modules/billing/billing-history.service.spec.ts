import { describe, expect, it, vi } from 'vitest';
import { BillingHistoryService } from './billing-history.service.js';

/** select().from().innerJoin().leftJoin()*.where().orderBy() chain. */
function createDbStub(rows: unknown[]) {
  const orderBy = vi.fn().mockResolvedValue(rows);
  const where = vi.fn((..._args: unknown[]) => ({ orderBy }));
  const joinChain: any = {};
  joinChain.innerJoin = vi.fn((..._args: unknown[]) => joinChain);
  joinChain.leftJoin = vi.fn((..._args: unknown[]) => joinChain);
  joinChain.where = where;
  const db: any = { select: vi.fn((..._args: unknown[]) => ({ from: vi.fn(() => joinChain) })) };
  return { db, where };
}

function collectValues(node: any, acc: unknown[] = []): unknown[] {
  if (node instanceof Date || typeof node === 'string') {
    acc.push(node);
    return acc;
  }
  // drizzle wraps bound params in a Param holder rather than inlining them.
  if (
    node?.constructor?.name === 'Param' &&
    (node.value instanceof Date || typeof node.value === 'string')
  ) {
    acc.push(node.value);
    return acc;
  }
  if (Array.isArray(node?.queryChunks)) node.queryChunks.forEach((c: any) => collectValues(c, acc));
  return acc;
}

const ROWS = [
  {
    id: 'pay-1',
    name: '홈 히어로 배너 광고',
    amount: 100_000,
    status: 'done',
    approvedAt: new Date('2026-09-10T09:00:00Z'),
  },
  {
    id: 'pay-2',
    name: null,
    amount: 50_000,
    status: 'cancelled',
    approvedAt: new Date('2026-09-05T09:00:00Z'),
  },
  { id: 'pay-3', name: '개발자 챌린지', amount: 30_000, status: 'failed', approvedAt: null },
  { id: 'pay-4', name: '갤러리 광고', amount: 20_000, status: 'ready', approvedAt: null },
];

describe('BillingHistoryService', () => {
  it('maps names, negative amounts, and payment statuses, summing the total', async () => {
    const { db } = createDbStub(ROWS);
    const service = new BillingHistoryService(db);

    const { items, total } = await service.forBusiness('biz-1', {});

    expect(items).toEqual([
      {
        id: 'pay-1',
        name: '홈 히어로 배너 광고',
        amount: -100_000,
        paidAt: '2026-09-10T09:00:00.000Z',
        status: 'paid',
      },
      {
        id: 'pay-2',
        name: '주문',
        amount: -50_000,
        paidAt: '2026-09-05T09:00:00.000Z',
        status: 'refunded',
      },
      { id: 'pay-3', name: '개발자 챌린지', amount: -30_000, paidAt: null, status: 'failed' },
      // 'ready' (unpaid) rows surface as 'failed' per the status mapping contract.
      { id: 'pay-4', name: '갤러리 광고', amount: -20_000, paidAt: null, status: 'failed' },
    ]);
    expect(total).toBe(-200_000);
  });

  it('scopes rows to the business via ads or applications→challenges', async () => {
    const { db, where } = createDbStub(ROWS);
    const service = new BillingHistoryService(db);

    await service.forBusiness('biz-1', {});

    const values = collectValues(where.mock.calls[0]![0]);
    expect(values.filter((v) => v === 'biz-1')).toHaveLength(2);
    // No from/to → no approvedAt date conditions.
    expect(values.filter((v) => v instanceof Date)).toHaveLength(0);
  });

  it('applies from/to filters on approvedAt when provided', async () => {
    const { db, where } = createDbStub(ROWS);
    const service = new BillingHistoryService(db);

    await service.forBusiness('biz-1', { from: '2026-09-01', to: '2026-09-30' });

    const dates = collectValues(where.mock.calls[0]![0]).filter(
      (v): v is Date => v instanceof Date,
    );
    expect(dates).toHaveLength(2);
    expect(dates[0]).toEqual(new Date('2026-09-01T00:00:00.000Z'));
    expect(dates[1]).toEqual(new Date('2026-09-30T23:59:59.999Z'));
  });
});
