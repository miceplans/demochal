import { Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { notifications } from '../../db/schema.js';

@Injectable()
export class NotificationsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  // TODO: fan out to a real channel (push/email/in-app socket) in addition to persisting.
  async create(userId: string, type: string, payload: Record<string, unknown>) {
    const [notification] = await this.db
      .insert(notifications)
      .values({ userId, type, payload })
      .returning();
    return notification;
  }

  async listForUser(userId: string) {
    return this.db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }
}
