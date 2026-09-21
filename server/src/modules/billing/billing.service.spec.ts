import { BadGatewayException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BillingService } from './billing.service.js';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

beforeEach(() => {
  fetchMock.mockReset();
});

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

  it('derives the billing customerKey from the business', () => {
    const service = new BillingService({} as never);
    expect(service.getCustomerKey('biz-1')).toBe('semochal-biz-biz-1');
  });

  it('exchanges the authKey for a billingKey and stores the card without returning it', async () => {
    const { db, values } = createInsertStub({
      id: 'card-3',
      cardName: null,
      maskedNumber: '****-****-****-9012',
    });
    const service = new BillingService(db);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ billingKey: 'bk-new', card: { number: '****-****-****-9012' } }),
    });

    const card = await service.issueCard('biz-1', 'auth-key-1');

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId: 'biz-1',
        billingKey: 'bk-new',
        maskedNumber: '****-****-****-9012',
      }),
    );
    expect(card).toEqual({ id: 'card-3', cardName: null, maskedNumber: '****-****-****-9012' });
    expect(card).not.toHaveProperty('billingKey');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('/v1/billing/authorizations/issue');
    expect(init).toEqual(expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(String((init as { body: string }).body))).toEqual({
      authKey: 'auth-key-1',
      customerKey: 'semochal-biz-biz-1',
    });
  });

  it('rejects when Toss billing authorization fails', async () => {
    const { db } = createInsertStub(undefined);
    const service = new BillingService(db);
    fetchMock.mockResolvedValue({ ok: false, status: 400, json: async () => ({}) });

    await expect(service.issueCard('biz-1', 'bad-auth')).rejects.toThrow(BadGatewayException);
  });

  it('rejects when the Toss billing request itself throws', async () => {
    const { db } = createInsertStub(undefined);
    const service = new BillingService(db);
    fetchMock.mockRejectedValue(new Error('network down'));

    await expect(service.issueCard('biz-1', 'auth')).rejects.toThrow(BadGatewayException);
  });

  it('rejects an incomplete Toss billing response', async () => {
    const { db } = createInsertStub(undefined);
    const service = new BillingService(db);
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ billingKey: 'bk-x' }) });

    await expect(service.issueCard('biz-1', 'auth')).rejects.toThrow(
      'Toss billing authorization response incomplete',
    );
  });

  it('fails when the card insert returns no row', async () => {
    const { db } = createInsertStub(undefined);
    const service = new BillingService(db);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ billingKey: 'bk-new', card: { number: '****-****-****-9012' } }),
    });

    await expect(service.issueCard('biz-1', 'auth-key-1')).rejects.toThrow(
      'Failed to register card',
    );
  });
});
