import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { notifications, users } from '../../db/schema.js';
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
   *
   * 수신자의 notificationSettings가 매핑 키를 명시적 false로 가지면 insert와 이메일
   * outbox를 모두 생략하고 null을 반환한다. 매핑 키가 없는 타입(설정 화면에 스위치가
   * 없는 알림)은 항상 발송된다. 모든 호출부는 반환값을 쓰지 않으므로 null은 안전하다.
   */
  // TODO: push/in-app socket channels are not implemented yet.
  async create(userId: string, type: string, payload: Record<string, unknown>) {
    const settingsKey = this.settingsKeyFor(type, payload);
    if (settingsKey) {
      const [user] = await this.db
        .select({ notificationSettings: users.notificationSettings })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (user && user.notificationSettings[settingsKey] === false) return null;
    }
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

  // 알림 설정 화면(front user-design.ts notificationSettings)의 스위치 키 매핑.
  // 지원 알림(applicantUserId), 결과 알림(status), 팀 초대(invitedUserId) 모두
  // team_matching 타입이므로 payload 필드로 구분한다.
  private settingsKeyFor(
    type: string,
    payload: Record<string, unknown>,
  ): 'applicant' | 'result' | 'invite' | 'invite_result' | undefined {
    if (type !== 'team_matching') return undefined;
    if (typeof payload.invitedUserId === 'string') return 'invite';
    // 초대 수락 알림은 팀장에게 가는 별도 키 — '새 지원자'와 설정을 분리한다.
    if (typeof payload.applicantUserId === 'string')
      return payload.inviteAccepted === true ? 'invite_result' : 'applicant';
    if ('status' in payload) return 'result';
    return undefined;
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
