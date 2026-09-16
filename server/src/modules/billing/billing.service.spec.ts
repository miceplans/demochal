import { describe, expect, it, vi } from 'vitest';
import { BillingService } from './billing.service.js';

/** select().from().where().orderBy() chain. */
function createSelectStub(rows: unknown[]) {
  const orderBy = vi.fn().mockResolvedValue(rows);
  const where = vi.fn((..._args: unknown[]) => ({ orderBy }));
  let projection: unknown;
  const select = vi.fn((proj: unknown) => {
    projection = proj;
    return { from: vi.fn(() => ({ where })) };
  });
  const db: any = { select };
  return { db, where, getProjection: () => projection };
}

// drizzle wraps bound params in a Param holder rather than inlining them.
function collectParamValues(node: any, acc: unknown[] = []): unknown[] {
  if (node instanceof Date || typeof node === 'string') {
    acc.push(node);
    return acc;
  }
  if (
    node?.constructor?.name === 'Param' &&
    (node.value instanceof Date || typeof node.value === 'string')
  ) {
    acc.push(node.value);
    return acc;
  }
  if (Array.isArray(node?.queryChunks))
    node.queryChunks.forEach((c: any) => collectParamValues(c, acc));
  return acc;
}

function createInsertStub(created: unknown) {
  const returning = vi.fn().mockResolvedValue([created]);
  const values = vi.fn().mockReturnValue({ returning });
  const insert = vi.fn(() => ({ values }));
  const db: any = { insert };
  return { db, insert, values };
}

describe('BillingService', () => {
  it('lists cards without the billingKey, scoped and ordered by the business', async () => {
    const { db, where, getProjection } = createSelectStub([
      { id: 'card-1', cardName: '국민카드', maskedNumber: '****-****-****-1234' },
    ]);
    const service = new BillingService(db);

    const cards = await service.listCards('biz-1');

    // Column projection must exclude billingKey entirely.
    expect(Object.keys(getProjection() as Record<string, unknown>)).toEqual([
      'id',
      'cardName',
      'maskedNumber',
    ]);
    expect(collectParamValues(where.mock.calls[0]![0])).toContain('biz-1');
    expect(cards).toEqual([
      { id: 'card-1', cardName: '국민카드', maskedNumber: '****-****-****-1234' },
    ]);
    expect(JSON.stringify(cards)).not.toContain('billingKey');
  });

  it('stores the billingKey but returns the card without it', async () => {
    const { db, values } = createInsertStub({
      id: 'card-2',
      cardName: null,
      maskedNumber: '****-****-****-5678',
    });
    const service = new BillingService(db);

    const card = await service.registerCard('biz-1', {
      billingKey: 'bk-secret',
      maskedNumber: '****-****-****-5678',
    });

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ businessId: 'biz-1', billingKey: 'bk-secret' }),
    );
    expect(card).toEqual({ id: 'card-2', cardName: null, maskedNumber: '****-****-****-5678' });
    expect(card).not.toHaveProperty('billingKey');
  });
});
