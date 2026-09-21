import { BadGatewayException, ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { billingAuthAttempts, paymentCards } from '../../db/schema.js';
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

/**
 * Stub covering issueCard()'s full surface: the attempts-table insert with
 * onConflictDoNothing, the paymentCards insert, the attempts update/delete,
 * and the three select shapes (by id / by hash / orphan scan).
 */
function createIssueDbStub(options: {
  attemptInsert?: Array<{ id: string }>;
  cardInsert?: Array<Record<string, unknown>>;
  attemptByHash?: Array<Record<string, unknown>>;
  cardById?: Array<Record<string, unknown>>;
  orphanCards?: Array<Record<string, unknown>>;
}) {
  const update = vi.fn(() => ({
    set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
  }));
  const deleteOp = vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) }));

  const limit = vi.fn();
  const selectFrom = vi.fn((table: unknown) => ({
    where: vi.fn(() => {
      // Orphan-card scan is the only select with orderBy.
      limit.mockResolvedValue(options.orphanCards ?? []);
      return {
        orderBy: vi.fn(() => ({ limit })),
        limit: vi.fn(async () => {
          if (table === paymentCards) return options.cardById ?? [];
          return options.attemptByHash ?? [];
        }),
      };
    }),
  }));
  const select = vi.fn(() => ({ from: selectFrom }));

  const attemptsValues = vi.fn(() => ({
    onConflictDoNothing: vi.fn(() => ({
      returning: vi.fn().mockResolvedValue(options.attemptInsert ?? []),
    })),
  }));
  const cardValues = vi.fn(() => ({
    returning: vi.fn().mockResolvedValue(options.cardInsert ?? []),
  }));

  const insert = vi.fn((table: unknown) => ({
    values: table === billingAuthAttempts ? attemptsValues : cardValues,
  }));

  const db: any = { insert, select, update, delete: deleteOp };
  return { db, insert, update, deleteOp, attemptsValues, cardValues };
}

const ISSUE_URL = 'https://api.tosspayments.com/v1/billing/authorizations/issue';
const issuedBody = { billingKey: 'bk-new', card: { number: '****-****-****-9012' } };

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
    const { db, cardValues } = createIssueDbStub({
      attemptInsert: [{ id: 'attempt-1' }],
      cardInsert: [{ id: 'card-3', cardName: null, maskedNumber: '****-****-****-9012' }],
    });
    const service = new BillingService(db);
    fetchMock.mockResolvedValue({ ok: true, json: async () => issuedBody });

    const card = await service.issueCard('biz-1', 'auth-key-1');

    expect(cardValues).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId: 'biz-1',
        billingKey: 'bk-new',
        maskedNumber: '****-****-****-9012',
      }),
    );
    expect(card).toEqual({ id: 'card-3', cardName: null, maskedNumber: '****-****-****-9012' });
    expect(card).not.toHaveProperty('billingKey');
    // The idempotency record is linked to the stored card.
    expect(db.update).toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('/v1/billing/authorizations/issue');
    expect(init).toEqual(expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(String((init as { body: string }).body))).toEqual({
      authKey: 'auth-key-1',
      customerKey: 'semochal-biz-biz-1',
    });
  });

  it('returns the stored card on a retried authKey instead of failing or duplicating', async () => {
    // The attempts insert conflicts (authKey already seen) and the recorded
    // attempt points at an existing card — the lost-response remount case.
    const { db } = createIssueDbStub({
      attemptInsert: [],
      attemptByHash: [{ id: 'attempt-1', cardId: 'card-3', createdAt: new Date() }],
      cardById: [{ id: 'card-3', cardName: null, maskedNumber: '****-****-****-9012' }],
    });
    const service = new BillingService(db);
    const fetchCallsBefore = fetchMock.mock.calls.length;

    const card = await service.issueCard('biz-1', 'auth-key-1');

    expect(fetchMock.mock.calls.length).toBe(fetchCallsBefore);
    expect(card).toEqual({ id: 'card-3', cardName: null, maskedNumber: '****-****-****-9012' });
    expect(db.insert).toHaveBeenCalledTimes(1); // only the conflicting attempts insert
  });

  it('reconciles a retried authKey whose exchange succeeded but the response was lost', async () => {
    const { db, update } = createIssueDbStub({
      attemptInsert: [],
      attemptByHash: [
        { id: 'attempt-1', cardId: null, createdAt: new Date('2026-09-20T00:00:00Z') },
      ],
      orphanCards: [{ id: 'card-9', cardName: null, maskedNumber: '****-****-****-1111' }],
    });
    const service = new BillingService(db);
    const fetchCallsBefore = fetchMock.mock.calls.length;

    const card = await service.issueCard('biz-1', 'auth-key-1');

    expect(fetchMock.mock.calls.length).toBe(fetchCallsBefore);
    expect(card.id).toBe('card-9');
    // The recovered card is linked onto the attempt for future retries.
    expect(update).toHaveBeenCalled();
  });

  it('refuses to re-exchange an authKey whose attempt has no stored card', async () => {
    const { db } = createIssueDbStub({
      attemptInsert: [],
      attemptByHash: [
        { id: 'attempt-1', cardId: null, createdAt: new Date('2026-09-20T00:00:00Z') },
      ],
    });
    const service = new BillingService(db);
    const fetchCallsBefore = fetchMock.mock.calls.length;

    await expect(service.issueCard('biz-1', 'auth-key-1')).rejects.toThrow(ConflictException);
    expect(fetchMock.mock.calls.length).toBe(fetchCallsBefore);
  });

  it('clears the attempt record when the Toss request itself fails so a retry can re-exchange', async () => {
    const { db, deleteOp } = createIssueDbStub({ attemptInsert: [{ id: 'attempt-1' }] });
    const service = new BillingService(db);
    fetchMock.mockRejectedValue(new Error('network down'));

    await expect(service.issueCard('biz-1', 'auth')).rejects.toThrow(BadGatewayException);
    // The exchange may never have reached Toss — drop the record so the retry
    // (fresh page load issues a fresh authKey anyway) starts clean.
    expect(deleteOp).toHaveBeenCalled();
  });

  it('keeps the attempt record when Toss rejects the exchange (one-time key consumed)', async () => {
    const { db, deleteOp } = createIssueDbStub({ attemptInsert: [{ id: 'attempt-1' }] });
    const service = new BillingService(db);
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ code: 'ALREADY_PROCESSED' }),
    });

    await expect(service.issueCard('biz-1', 'bad-auth')).rejects.toThrow(BadGatewayException);
    expect(deleteOp).not.toHaveBeenCalled();
  });

  it('rejects an incomplete Toss billing response', async () => {
    const { db } = createIssueDbStub({ attemptInsert: [{ id: 'attempt-1' }] });
    const service = new BillingService(db);
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ billingKey: 'bk-x' }) });

    await expect(service.issueCard('biz-1', 'auth')).rejects.toThrow(
      'Toss billing authorization response incomplete',
    );
  });

  it('fails when the card insert returns no row', async () => {
    const { db } = createIssueDbStub({ attemptInsert: [{ id: 'attempt-1' }], cardInsert: [] });
    const service = new BillingService(db);
    fetchMock.mockResolvedValue({ ok: true, json: async () => issuedBody });

    await expect(service.issueCard('biz-1', 'auth-key-1')).rejects.toThrow(
      'Failed to register card',
    );
  });
});
