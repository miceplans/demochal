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
  // inArray() binds its value list either as Param entries or as a raw array chunk.
  if (Array.isArray(node?.value)) {
    acc.push(...node.value);
    return acc;
  }
  if (Array.isArray(node?.queryChunks)) node.queryChunks.forEach((c: any) => collectValues(c, acc));
  if (Array.isArray(node)) node.forEach((c: any) => collectValues(c, acc));
  return acc;
}

const ROWS = [
  {
    id: 'pay-1',
    name: '홈 히어로 배너 광고',
    amount: 100_000,
    status: 'paid',
    approvedAt: new Date('2026-09-10T09:00:00Z'),
  },
  {
    id: 'pay-2',
    name: null,
    amount: 50_000,
    status: 'canceled',
    approvedAt: new Date('2026-09-05T09:00:00Z'),
  },
  { id: 'pay-3', name: '개발자 챌린지', amount: 30_000, status: 'expired', approvedAt: null },
  { id: 'pay-4', name: '갤러리 광고', amount: 20_000, status: 'ready', approvedAt: null },
  // Legacy DB vocabulary from older writers — it remains available to API
  // consumers, and 'done' remains a charged balance movement.
  {
    id: 'pay-5',
    name: '지난 챌린지',
    amount: 10_000,
    status: 'done',
    approvedAt: new Date('2026-09-01T09:00:00Z'),
  },
  {
    id: 'pay-6',
    name: '지난 광고',
    amount: 5_000,
    status: 'cancelled',
    approvedAt: new Date('2026-08-30T09:00:00Z'),
  },
];

describe('BillingHistoryService', () => {
  it('maps charged rows to items; never-charged rows never reach the mapping', async () => {
    // The DB applies the charged-status filter (asserted in the test below), so
    // only charged rows ever reach the mapping — simulate that filtered result.
    const chargedRows = ROWS.filter((row) => row.status !== 'expired' && row.status !== 'ready');
    const { db } = createDbStub(chargedRows);
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
        // Refunded rows display as positive amounts (PaymentHistoryItem contract),
        // even though the writer keeps the original charge's sign in the DB.
        amount: 50_000,
        paidAt: '2026-09-05T09:00:00.000Z',
        status: 'refunded',
      },
      {
        id: 'pay-5',
        name: '지난 챌린지',
        amount: -10_000,
        paidAt: '2026-09-01T09:00:00.000Z',
        status: 'paid',
      },
      {
        id: 'pay-6',
        name: '지난 광고',
        amount: 5_000,
        paidAt: '2026-08-30T09:00:00.000Z',
        status: 'refunded',
      },
    ]);
    // Charged rows move the balance: 'paid' and legacy 'done' count, while
    // canceled/refunded, expired, and ready rows contribute 0. Positive refund
    // display amounts (pay-2, pay-6) are not part of this reduce — they don't
    // get subtracted a second time.
    expect(total).toBe(-110_000);
  });

  it('filters never-charged payment attempts (expired/ready) out of the query', async () => {
    const { db, where } = createDbStub(ROWS);
    const service = new BillingHistoryService(db);

    await service.forBusiness('biz-1', {});

    // inArray(payments.status, ['paid', 'done', 'canceled', 'cancelled']) — a
    // failed/expired attempt must not render as a negative charge or epoch date.
    const values = collectValues(where.mock.calls[0]![0]);
    for (const status of ['paid', 'done', 'canceled', 'cancelled']) {
      expect(values).toContain(status);
    }
    expect(values).not.toContain('expired');
    expect(values).not.toContain('ready');
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
