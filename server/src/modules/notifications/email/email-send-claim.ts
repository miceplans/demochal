import { and, eq, lt, sql } from 'drizzle-orm';
import type { Database } from '../../../db/drizzle.provider.js';
import { emailSendStates } from '../../../db/schema.js';

// A 'sending' claim older than this is treated as abandoned by a crashed
// worker and may be taken over. Must exceed one SES call by a wide margin.
export const EMAIL_SEND_LEASE_MS = 5 * 60_000;
// claimed_at is always written and compared with the DB clock (now()), so the
// lease is immune to worker clock skew and to the timestamp column's time zone.
const leaseCutoff = sql`now() - make_interval(secs => ${EMAIL_SEND_LEASE_MS / 1000})`;

/** Thrown when another delivery of the same event holds a live claim. */
export class EmailSendInFlightError extends Error {
  override readonly name = 'EmailSendInFlightError';
}

export type EmailSendClaimResult = 'claimed' | 'sent' | 'in_flight';

/**
 * Atomically claims an outbox event before SES is called, so only the claim
 * holder sends (SQS is at-least-once and relays can double-send).
 */
export async function claimEmailSend(db: Database, eventId: string): Promise<EmailSendClaimResult> {
  const [inserted] = await db
    .insert(emailSendStates)
    .values({ outboxEventId: eventId, status: 'sending', claimedAt: sql`now()` })
    .onConflictDoNothing({ target: emailSendStates.outboxEventId })
    .returning({ id: emailSendStates.id });
  if (inserted) return 'claimed';

  // Row exists: take over only an abandoned 'sending' claim. The conditional
  // UPDATE is atomic, so at most one delivery wins a stale lease.
  const [takenOver] = await db
    .update(emailSendStates)
    .set({ claimedAt: sql`now()` })
    .where(
      and(
        eq(emailSendStates.outboxEventId, eventId),
        eq(emailSendStates.status, 'sending'),
        lt(emailSendStates.claimedAt, leaseCutoff),
      ),
    )
    .returning({ id: emailSendStates.id });
  if (takenOver) return 'claimed';

  const [existing] = await db
    .select({ status: emailSendStates.status })
    .from(emailSendStates)
    .where(eq(emailSendStates.outboxEventId, eventId))
    .limit(1);
  return existing?.status === 'sent' ? 'sent' : 'in_flight';
}

export async function markEmailSent(db: Database, eventId: string): Promise<void> {
  await db
    .update(emailSendStates)
    .set({ status: 'sent', sentAt: sql`now()` })
    .where(eq(emailSendStates.outboxEventId, eventId));
}

/** Best effort: an unreleased claim simply expires after the lease. Returns false on failure. */
export async function releaseEmailSendClaim(db: Database, eventId: string): Promise<boolean> {
  try {
    await db
      .delete(emailSendStates)
      .where(
        and(eq(emailSendStates.outboxEventId, eventId), eq(emailSendStates.status, 'sending')),
      );
    return true;
  } catch {
    return false;
  }
}
