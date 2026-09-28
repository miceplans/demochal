import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../db/drizzle.provider.js';
import { outboxEvents } from '../db/schema.js';
import { SqsService } from '../queue/sqs.service.js';

const MAX_ATTEMPTS = 5;

@Injectable()
export class OutboxRelayService {
  private readonly logger = new Logger(OutboxRelayService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly sqsService: SqsService,
  ) {}

  /**
   * Sends every pending `eventType` row to `queueUrl`, marking each sent on
   * success. A row that keeps failing is left `pending` for the next call to
   * retry, up to MAX_ATTEMPTS, after which it's marked `failed` (needs manual
   * requeue — no DLQ for the outbox table itself yet).
   *
   * Assumes a single relay caller at a time (worker.ts runs one poll loop);
   * running multiple worker replicas can double-send a row, which is safe
   * here since SQS delivery is already at-least-once.
   *
   * `includeEventId` wraps the row payload in an `{ eventId, payload }`
   * envelope so the consumer can key idempotent side effects (e.g. SES
   * sends) on the outbox event id; the default keeps the bare payload shape
   * used by the verifications queue.
   */
  async relay(
    eventType: string,
    queueUrl: string,
    batchSize = 10,
    options?: { includeEventId?: boolean },
  ): Promise<void> {
    const rows = await this.db
      .select()
      .from(outboxEvents)
      .where(and(eq(outboxEvents.eventType, eventType), eq(outboxEvents.status, 'pending')))
      .orderBy(asc(outboxEvents.createdAt))
      .limit(batchSize);

    for (const row of rows) {
      try {
        const body = options?.includeEventId
          ? { eventId: row.id, payload: row.payload }
          : row.payload;
        await this.sqsService.sendMessage(queueUrl, body);
        await this.db
          .update(outboxEvents)
          .set({ status: 'sent', sentAt: new Date() })
          .where(eq(outboxEvents.id, row.id));
      } catch (error) {
        const attempts = row.attempts + 1;
        this.logger.error(`Failed to relay outbox event ${row.id} (attempt ${attempts})`, error);
        await this.db
          .update(outboxEvents)
          .set({ attempts, status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending' })
          .where(eq(outboxEvents.id, row.id));
      }
    }
  }
}
