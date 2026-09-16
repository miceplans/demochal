import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
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

  async markRead(id: string, userId: string) {
    const [notification] = await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();
    if (!notification) throw new NotFoundException('Notification not found');
    return notification;
  }

  async markAllRead(userId: string) {
    await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    return { read: true };
  }
}
