import { and, asc, eq, inArray, lt, sql } from 'drizzle-orm';
import type { Database } from '../../db/drizzle.provider.js';
import { outboxEvents } from '../../db/schema.js';

/**
 * KCP 승인 호출 기록. 승인 요청 직전에 남기고 결과가 확정되면 닫는다 — 응답이 유실되거나
 * 프로세스가 죽으면 'pending'으로 남아 워커의 recoverKcpApprovals가 거래조회로 복구한다.
 * outbox_events를 쓰지만 SQS로 보내지 않는다(릴레이는 자기 eventType만 집는다).
 * status: pending(결과 미확정) | sent(확정) | failed(자동 판단 불가 — 수동 확인)
 */
export const KCP_APPROVAL_EVENT = 'payment.kcp_approval_attempt';
export const KCP_APPROVAL_MAX_CHECKS = 6;
// 진행 중인 승인 요청(타임아웃 10초)을 워커가 가로채지 않도록 두는 여유.
const IN_FLIGHT_GRACE_MS = 2 * 60 * 1000;
const BATCH_LIMIT = 50;

export interface KcpApprovalAttempt {
  id: string;
  orderId: string;
  attemptedAt: Date;
  checks: number;
}

type AttemptRow = typeof outboxEvents.$inferSelect;

function toAttempt(row: AttemptRow): KcpApprovalAttempt {
  // created_at은 시간대가 없어 DB 세션 TZ에 좌우된다 — 거래조회 날짜는 기록해 둔 UTC 시각으로 만든다.
  const payload = row.payload as { orderId: string; attemptedAt?: string };
  return {
    id: row.id,
    orderId: payload.orderId,
    // 시각을 기록하기 전(#1105)의 row는 created_at으로 대신한다.
    attemptedAt: payload.attemptedAt ? new Date(payload.attemptedAt) : row.createdAt,
    checks: row.attempts,
  };
}

export async function openKcpApprovalAttempt(
  db: Database,
  orderId: string,
  attemptedAt: Date,
): Promise<string> {
  const [row] = await db
    .insert(outboxEvents)
    .values({
      eventType: KCP_APPROVAL_EVENT,
      payload: { orderId, attemptedAt: attemptedAt.toISOString() },
    })
    .returning({ id: outboxEvents.id });
  if (!row) throw new Error('Failed to record the KCP approval attempt');
  return row.id;
}

export async function closeKcpApprovalAttempt(
  db: Database,
  id: string,
  status: 'sent' | 'failed' = 'sent',
): Promise<void> {
  await db.update(outboxEvents).set({ status, sentAt: new Date() }).where(eq(outboxEvents.id, id));
}

/** 거래조회가 답을 줬지만 승인을 확인하지 못한 횟수를 올린다. */
export async function countKcpApprovalCheck(db: Database, id: string): Promise<void> {
  await db
    .update(outboxEvents)
    .set({ attempts: sql`${outboxEvents.attempts} + 1` })
    .where(eq(outboxEvents.id, id));
}

export async function listDueKcpApprovalAttempts(
  db: Database,
  now: Date,
): Promise<KcpApprovalAttempt[]> {
  const rows = await db
    .select()
    .from(outboxEvents)
    .where(
      and(
        eq(outboxEvents.eventType, KCP_APPROVAL_EVENT),
        eq(outboxEvents.status, 'pending'),
        lt(outboxEvents.createdAt, new Date(now.getTime() - IN_FLIGHT_GRACE_MS)),
      ),
    )
    .orderBy(asc(outboxEvents.createdAt))
    .limit(BATCH_LIMIT);
  return rows.map(toAttempt);
}

export async function findOpenKcpApprovalAttempts(
  db: Database,
  orderId: string,
): Promise<KcpApprovalAttempt[]> {
  const rows = await db
    .select()
    .from(outboxEvents)
    .where(
      and(
        eq(outboxEvents.eventType, KCP_APPROVAL_EVENT),
        // failed(자동 판단 불가)도 다시 확인하기 전에는 재결제를 막아야 한다.
        inArray(outboxEvents.status, ['pending', 'failed']),
        sql`${outboxEvents.payload}->>'orderId' = ${orderId}`,
      ),
    )
    .orderBy(asc(outboxEvents.createdAt));
  return rows.map(toAttempt);
}
