import { Injectable } from '@nestjs/common';
import type { Database } from '../db/drizzle.provider.js';
import { outboxEvents } from '../db/schema.js';

@Injectable()
export class OutboxService {
  /**
   * Inserts an outbox row. `tx` must be the same transaction handle used for
   * the triggering business-row write, so both commit or roll back together.
   */
  async enqueue(tx: Database, eventType: string, payload: unknown): Promise<void> {
    await tx.insert(outboxEvents).values({ eventType, payload });
  }
}
