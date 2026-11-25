import { drizzle } from 'drizzle-orm/pg-proxy';
import { describe, expect, it, vi } from 'vitest';
import type { Database } from '../../db/drizzle.provider.js';
import {
  KCP_APPROVAL_EVENT,
  closeKcpApprovalAttempt,
  countKcpApprovalCheck,
  findOpenKcpApprovalAttempts,
  listDueKcpApprovalAttempts,
  openKcpApprovalAttempt,
} from './kcp-approval-attempts.js';

/** Captures the generated SQL without a database. */
function createDb(rows: unknown[][] = []) {
  const query = vi.fn(async (_sql: string, _params: unknown[]) => ({ rows }));
  return { db: drizzle(query) as unknown as Database, query };
}

describe('kcp-approval-attempts', () => {
  const attemptedAt = new Date('2026-11-25T01:00:00Z');

  it('records the attempt with only the order id and time', async () => {
    const { db, query } = createDb([['attempt-1']]);
    await expect(openKcpApprovalAttempt(db, 'order-1', attemptedAt)).resolves.toBe('attempt-1');
    expect(query.mock.calls[0]![1]).toEqual([
      KCP_APPROVAL_EVENT,
      '{"orderId":"order-1","attemptedAt":"2026-11-25T01:00:00.000Z"}',
    ]);
  });

  it('refuses to continue when the attempt could not be recorded', async () => {
    const { db } = createDb([]);
    await expect(openKcpApprovalAttempt(db, 'order-1', attemptedAt)).rejects.toThrow(
      'Failed to record',
    );
  });

  it('lists only pending attempts past the in-flight grace period', async () => {
    const { db, query } = createDb();
    const now = new Date('2026-11-25T01:00:00Z');
    await listDueKcpApprovalAttempts(db, now);
    const [sql, params] = query.mock.calls[0]!;
    expect(sql).toMatch(/"created_at" < /);
    expect(params).toEqual(
      expect.arrayContaining([KCP_APPROVAL_EVENT, 'pending', '2026-11-25T00:58:00.000Z']),
    );
    expect(params).not.toContain('failed');
  });

  it('also returns failed attempts of an order so a retry re-checks them', async () => {
    const { db, query } = createDb();
    await findOpenKcpApprovalAttempts(db, 'order-1');
    expect(query.mock.calls[0]![1]).toEqual([KCP_APPROVAL_EVENT, 'pending', 'failed', 'order-1']);
  });

  it('closes and counts a single attempt', async () => {
    const { db, query } = createDb();
    await closeKcpApprovalAttempt(db, 'attempt-1', 'failed');
    await countKcpApprovalCheck(db, 'attempt-1');
    expect(query.mock.calls[0]![1]).toEqual(expect.arrayContaining(['failed', 'attempt-1']));
    expect(query.mock.calls[1]![0]).toMatch(/"attempts" \+ 1/);
  });

  it('restores the attempt time from the payload, not the timezone-less column', async () => {
    const payload = { orderId: 'order-1', attemptedAt: attemptedAt.toISOString() };
    const { db } = createDb([
      ['a', KCP_APPROVAL_EVENT, payload, 'pending', 2, '2026-11-25 10:00:00', null],
    ]);
    await expect(findOpenKcpApprovalAttempts(db, 'order-1')).resolves.toEqual([
      { id: 'a', orderId: 'order-1', attemptedAt, checks: 2 },
    ]);
  });
});
