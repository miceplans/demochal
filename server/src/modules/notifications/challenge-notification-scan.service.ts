import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, isNull, lte } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { bookmarks, challenges, notifications, users } from '../../db/schema.js';
import { interestsMatch } from '../challenges/interest-matching.js';

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
 * 알림 설정 옵트아웃은 NotificationsService.create()의 settingsKeyFor와 동일한 키
 * 매핑(deadline→'deadline', posting→'challenge')으로 여기서 먼저 걸러낸다. bulk
 * insert + ON CONFLICT가 필요해서 create()를 직접 쓰진 않고 검사만 동일하게 유지한다 —
 * 새 매핑을 추가할 때 두 곳을 함께 바꿔야 한다.
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
        notificationSettings: users.notificationSettings,
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
      rows
        .filter((row) => this.isOptedIn(row.notificationSettings, 'deadline'))
        .map((row) => ({
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
        notificationSettings: users.notificationSettings,
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
      rows
        .filter((row) => this.isOptedIn(row.notificationSettings, 'challenge'))
        .map((row) => ({
          userId: row.userId,
          type: 'posting',
          dedupeKey: `posting:open:${row.challengeId}`,
          payload: { kind: 'bookmark_open', challengeId: row.challengeId, title: row.title },
        })),
    );
  }

  // 관심분야(users.interests)에 챌린지 category가 포함된 사용자에게 새 챌린지 알림.
  // 어휘 체계가 달라 SQL 조건으로는 매칭이 불가능해(리뷰 지적) 두 쿼리를 뽑아 애플리케이션
  // 단에서 추천 엔진과 동일한 토큰 정규화 매칭(interest-matching.ts)으로 걸러낸다.
  private async scanInterestNewChallenges(now: Date) {
    const recentChallenges = await this.db
      .select({ id: challenges.id, title: challenges.title, category: challenges.category })
      .from(challenges)
      .where(
        and(
          eq(challenges.status, 'published'),
          gt(challenges.createdAt, new Date(now.getTime() - RECENT_WINDOW_MS)),
          gt(challenges.endDate, now),
        ),
      );
    if (recentChallenges.length === 0) return 0;
    const candidates = await this.db
      .select({
        id: users.id,
        interests: users.interests,
        notificationSettings: users.notificationSettings,
      })
      .from(users)
      .where(and(isNull(users.withdrawnAt), eq(users.suspended, false)));
    const values: NewNotification[] = [];
    for (const challenge of recentChallenges) {
      for (const user of candidates) {
        if (!user.interests.some((interest) => interestsMatch(interest, challenge.category))) {
          continue;
        }
        if (!this.isOptedIn(user.notificationSettings, 'challenge')) continue;
        values.push({
          userId: user.id,
          type: 'posting',
          dedupeKey: `posting:new:${challenge.id}`,
          payload: {
            kind: 'interest_new',
            challengeId: challenge.id,
            title: challenge.title,
            category: challenge.category,
          },
        });
      }
    }
    return this.insert(values);
  }

  // 알림 설정(user-design.ts notificationSettings)에서 명시적 false로 끈 유형은 만들지 않는다.
  private isOptedIn(
    notificationSettings: Record<string, boolean> | undefined,
    key: 'deadline' | 'challenge',
  ) {
    return notificationSettings?.[key] !== false;
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
