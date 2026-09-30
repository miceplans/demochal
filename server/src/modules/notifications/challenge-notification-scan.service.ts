import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, isNull, lte, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { bookmarks, challenges, notifications, users } from '../../db/schema.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEADLINE_WINDOW_DAYS = 7;
// 새 챌린지/접수 시작은 최근 하루 안의 것만 알린다(스캔 공백 뒤 옛 공고 폭탄 방지).
const RECENT_WINDOW_MS = DAY_MS;
const INSERT_CHUNK = 500;

type NewNotification = typeof notifications.$inferInsert;

/**
 * 마감/공고 알림 생성 스캔. 워커가 주기적으로 `scan()`을 호출한다.
 * 같은 (사용자, dedupeKey)는 유니크 인덱스 + ON CONFLICT DO NOTHING으로 한 번만 만들어져
 * 스캔이 겹치거나 워커가 여러 대여도 안전하다. DB 행만 만들고 외부 부수효과(이메일 등)는 없다.
 *
 * TODO: "관심분야 새 수상작" 알림은 수상작 데이터가 없어 미구현.
 * TODO: 챌린지가 draft→published가 된 시점 기준이 아니라 createdAt 기준으로 "새 챌린지"를 판단한다.
 */
@Injectable()
export class ChallengeNotificationScanService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async scan(now = new Date()) {
    const deadline = await this.scanDeadlines(now);
    const opened = await this.scanBookmarkedOpens(now);
    const interest = await this.scanInterestNewChallenges(now);
    return { created: deadline + opened + interest };
  }

  // 북마크한 published 챌린지가 마감 7일 이내에 들어오면 1회 알림 (Figma: "마감 D-7").
  private async scanDeadlines(now: Date) {
    const rows = await this.db
      .select({
        userId: bookmarks.userId,
        challengeId: challenges.id,
        title: challenges.title,
        endDate: challenges.endDate,
      })
      .from(bookmarks)
      .innerJoin(challenges, eq(challenges.id, bookmarks.challengeId))
      .innerJoin(users, eq(users.id, bookmarks.userId))
      .where(
        and(
          eq(challenges.status, 'published'),
          gt(challenges.endDate, now),
          lte(challenges.endDate, new Date(now.getTime() + DEADLINE_WINDOW_DAYS * DAY_MS)),
          isNull(users.withdrawnAt),
          eq(users.suspended, false),
        ),
      );
    return this.insert(
      rows.map((row) => ({
        userId: row.userId,
        type: 'deadline',
        dedupeKey: `deadline:${row.challengeId}`,
        payload: {
          challengeId: row.challengeId,
          title: row.title,
          endDate: row.endDate.toISOString(),
          daysLeft: Math.max(0, Math.ceil((row.endDate.getTime() - now.getTime()) / DAY_MS)),
        },
      })),
    );
  }

  // 북마크한 챌린지의 참가접수(startDate)가 방금 시작됐을 때.
  private async scanBookmarkedOpens(now: Date) {
    const rows = await this.db
      .select({
        userId: bookmarks.userId,
        challengeId: challenges.id,
        title: challenges.title,
      })
      .from(bookmarks)
      .innerJoin(challenges, eq(challenges.id, bookmarks.challengeId))
      .innerJoin(users, eq(users.id, bookmarks.userId))
      .where(
        and(
          eq(challenges.status, 'published'),
          lte(challenges.startDate, now),
          gt(challenges.startDate, new Date(now.getTime() - RECENT_WINDOW_MS)),
          gt(challenges.endDate, now),
          isNull(users.withdrawnAt),
          eq(users.suspended, false),
        ),
      );
    return this.insert(
      rows.map((row) => ({
        userId: row.userId,
        type: 'posting',
        dedupeKey: `posting:open:${row.challengeId}`,
        payload: { kind: 'bookmark_open', challengeId: row.challengeId, title: row.title },
      })),
    );
  }

  // 관심분야(users.interests)에 챌린지 category가 포함된 사용자에게 새 챌린지 알림.
  private async scanInterestNewChallenges(now: Date) {
    const rows = await this.db
      .select({
        userId: users.id,
        challengeId: challenges.id,
        title: challenges.title,
        category: challenges.category,
      })
      .from(challenges)
      .innerJoin(users, sql`jsonb_exists(${users.interests}, ${challenges.category})`)
      .where(
        and(
          eq(challenges.status, 'published'),
          gt(challenges.createdAt, new Date(now.getTime() - RECENT_WINDOW_MS)),
          gt(challenges.endDate, now),
          isNull(users.withdrawnAt),
          eq(users.suspended, false),
        ),
      );
    return this.insert(
      rows.map((row) => ({
        userId: row.userId,
        type: 'posting',
        dedupeKey: `posting:new:${row.challengeId}`,
        payload: {
          kind: 'interest_new',
          challengeId: row.challengeId,
          title: row.title,
          category: row.category,
        },
      })),
    );
  }

  private async insert(values: NewNotification[]) {
    let created = 0;
    for (let i = 0; i < values.length; i += INSERT_CHUNK) {
      const inserted = await this.db
        .insert(notifications)
        .values(values.slice(i, i + INSERT_CHUNK))
        .onConflictDoNothing({ target: [notifications.userId, notifications.dedupeKey] })
        .returning({ id: notifications.id });
      created += inserted.length;
    }
    return created;
  }
}
