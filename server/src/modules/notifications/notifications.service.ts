import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { notifications } from '../../db/schema.js';
import { OutboxService } from '../../outbox/outbox.service.js';
import {
  EMAIL_NOTIFICATION_TYPES,
  NOTIFICATION_EMAIL_EVENT,
  isEmailDeliveryConfigured,
  type NotificationEmailPayload,
} from './email/notification-email.js';

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly outboxService: OutboxService,
  ) {}

  /**
   * Persists the in-app notification and, for service-email types, enqueues
   * the email outbox event in the same transaction — both commit or neither
   * does. Email is skipped entirely when SES/queue config is absent, so DB
   * notifications keep working in dev.
   */
  // TODO: push/in-app socket channels are not implemented yet.
  async create(userId: string, type: string, payload: Record<string, unknown>) {
    return this.db.transaction(async (tx) => {
      const [notification] = await tx
        .insert(notifications)
        .values({ userId, type, payload })
        .returning();
      if (notification && EMAIL_NOTIFICATION_TYPES.has(type) && isEmailDeliveryConfigured()) {
        const emailPayload: NotificationEmailPayload = { notificationId: notification.id };
        await this.outboxService.enqueue(tx, NOTIFICATION_EMAIL_EVENT, emailPayload);
      }
      return notification;
    });
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
