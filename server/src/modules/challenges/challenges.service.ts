import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, count, desc, eq, gte, lt, ne, or } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import {
  applications,
  bookmarks,
  businesses,
  challengeViews,
  challenges,
  orders,
} from '../../db/schema.js';
import type { CreateChallengeDto } from './dto/create-challenge.dto.js';
import type { UpdateChallengeStatusDto } from './dto/update-challenge-status.dto.js';
import { AdminSettingsService } from '../admin/admin-settings.service.js';

// draft -> published -> closed; no other transition is valid.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft: ['published'],
  published: ['closed'],
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class ChallengesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly adminSettingsService: AdminSettingsService,
  ) {}

  // Keyset pagination on createdAt. Good enough while volume is low; revisit
  // with a compound (createdAt, id) cursor if createdAt collisions appear.
  async list(cursor: string | undefined, limit: number) {
    const where = cursor ? lt(challenges.createdAt, new Date(cursor)) : undefined;
    const rows = await this.db
      .select()
      .from(challenges)
      .where(where)
      .orderBy(desc(challenges.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);
    const nextCursor = hasMore ? items[items.length - 1]!.createdAt.toISOString() : null;
    return { items, nextCursor };
  }

  private async getOrThrow(id: string) {
    const [challenge] = await this.db
      .select()
      .from(challenges)
      .where(eq(challenges.id, id))
      .limit(1);
    if (!challenge) throw new NotFoundException('Challenge not found');
    return challenge;
  }

  async findById(id: string) {
    const challenge = await this.getOrThrow(id);
    // Every detail fetch is a real "click" into the posting — see challengeViews' comment in schema.ts.
    await this.db.insert(challengeViews).values({ challengeId: id });
    return challenge;
  }

  async stats(id: string) {
    await this.getOrThrow(id);
    const [views] = await this.db
      .select({ count: count() })
      .from(challengeViews)
      .where(eq(challengeViews.challengeId, id));
    return { views: Number(views?.count ?? 0) };
  }

  async create(dto: CreateChallengeDto, ownerUserId: string) {
    const [business] = await this.db
      .select({ id: businesses.id })
      .from(businesses)
      .where(and(eq(businesses.id, dto.businessId), eq(businesses.ownerUserId, ownerUserId)))
      .limit(1);
    if (!business) throw new NotFoundException('Business not found or not owned by user');

    const [challenge] = await this.db
      .insert(challenges)
      .values({
        businessId: dto.businessId,
        title: dto.title,
        description: dto.description,
        price: dto.price,
        capacity: dto.capacity,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        category: dto.category,
        status: (await this.adminSettingsService.isEnabled('contestAutoPublish'))
          ? 'published'
          : 'draft',
      })
      .returning();
    return challenge;
  }

  async updateStatus(id: string, dto: UpdateChallengeStatusDto, ownerUserId: string) {
    const [challenge] = await this.db
      .select({ id: challenges.id, status: challenges.status, businessId: challenges.businessId })
      .from(challenges)
      .innerJoin(businesses, eq(businesses.id, challenges.businessId))
      .where(and(eq(challenges.id, id), eq(businesses.ownerUserId, ownerUserId)))
      .limit(1);
    if (!challenge) throw new NotFoundException('Challenge not found');

    const allowed = ALLOWED_TRANSITIONS[challenge.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new ConflictException(`Cannot move a ${challenge.status} challenge to ${dto.status}`);
    }

    const [updated] = await this.db
      .update(challenges)
      .set({ status: dto.status })
      .where(eq(challenges.id, id))
      .returning();
    return updated;
  }

  async getStats(id: string) {
    await this.getOrThrow(id);
    const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS);

    const [clicks, bookmarkStats, applicantDistribution, monthlyExposure] = await Promise.all([
      this.statWithDelta(challengeViews, eq(challengeViews.challengeId, id), sevenDaysAgo),
      this.statWithDelta(bookmarks, eq(bookmarks.challengeId, id), sevenDaysAgo),
      this.getApplicantDistribution(id),
      this.getMonthlyViewCounts(id),
    ]);

    return {
      clicks,
      bookmarks: bookmarkStats,
      // Card-impression tracking (as opposed to detail-page clicks) has no beacon yet,
      // so "exposure" reuses the same click/view signal rather than a fabricated number.
      exposure: clicks,
      applicantDistribution,
      monthlyExposure,
    };
  }

  async listSimilar(id: string) {
    const challenge = await this.getOrThrow(id);

    const byCategory = challenge.category
      ? await this.db
          .select()
          .from(challenges)
          .where(and(eq(challenges.category, challenge.category), ne(challenges.id, id)))
          .orderBy(desc(challenges.createdAt))
          .limit(3)
      : [];
    if (byCategory.length >= 3) return byCategory;

    const excludeIds = new Set([id, ...byCategory.map((c) => c.id)]);
    const fallback = await this.db
      .select()
      .from(challenges)
      .where(ne(challenges.id, id))
      .orderBy(desc(challenges.createdAt))
      .limit(3 + excludeIds.size);

    const backfill = fallback.filter((c) => !excludeIds.has(c.id)).slice(0, 3 - byCategory.length);
    return [...byCategory, ...backfill];
  }

  private async statWithDelta(
    table: typeof challengeViews | typeof bookmarks,
    whereEq: ReturnType<typeof eq>,
    sevenDaysAgo: Date,
  ) {
    const totalRows = await this.db
      .select({ value: count() })
      .from(table as typeof challengeViews)
      .where(whereEq);
    const beforeRows = await this.db
      .select({ value: count() })
      .from(table as typeof challengeViews)
      .where(and(whereEq, lt(table.createdAt, sevenDaysAgo)));

    const value = Number(totalRows[0]?.value ?? 0);
    const beforeValue = Number(beforeRows[0]?.value ?? 0);
    const deltaPercent =
      beforeValue === 0 ? (value > 0 ? 100 : 0) : ((value - beforeValue) / beforeValue) * 100;
    return { value, deltaPercent: Math.round(deltaPercent * 10) / 10 };
  }

  private async getApplicantDistribution(challengeId: string) {
    const rows = await this.db
      .select({ role: applications.role, total: count() })
      .from(applications)
      .innerJoin(challenges, eq(applications.challengeId, challenges.id))
      .leftJoin(orders, eq(orders.applicationId, applications.id))
      .where(
        and(
          eq(applications.challengeId, challengeId),
          // 유료 챌린지의 미결제 신청 시도(pending 주문만 있는 행)는 아직 실제
          // 신청이 아니므로 지원자 통계에서 제외한다 — 주문이 paid에 도달한 것만 집계.
          or(eq(challenges.price, 0), eq(orders.status, 'paid')),
        ),
      )
      .groupBy(applications.role);

    const total = rows.reduce((sum, row) => sum + Number(row.total), 0);
    if (total === 0) return [];
    return rows.map((row) => ({
      label: row.role ?? '미지정',
      value: Math.round((Number(row.total) / total) * 1000) / 10,
    }));
  }

  private async getMonthlyViewCounts(challengeId: string) {
    const now = new Date();
    const rangeStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const rows = await this.db
      .select({ createdAt: challengeViews.createdAt })
      .from(challengeViews)
      .where(
        and(eq(challengeViews.challengeId, challengeId), gte(challengeViews.createdAt, rangeStart)),
      );

    const months: { label: string; value: number }[] = [];
    for (let i = 5; i >= 0; i -= 1) {
      const bucket = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = rows.filter(
        (row) =>
          row.createdAt.getFullYear() === bucket.getFullYear() &&
          row.createdAt.getMonth() === bucket.getMonth(),
      ).length;
      months.push({ label: `${bucket.getMonth() + 1}월`, value });
    }
    return months;
  }
}
