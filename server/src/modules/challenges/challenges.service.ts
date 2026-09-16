import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, count, desc, eq, lt, ne, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { applications, bookmarks, businesses, challenges } from '../../db/schema.js';
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
    // Every detail fetch is a real "click" into the posting. The DB keeps only a
    // running counter on the challenge row (no per-view event table), which is
    // what backs the "popular" bookmark sort and the dashboard click stats.
    await this.db
      .update(challenges)
      .set({ viewCount: sql`${challenges.viewCount} + 1` })
      .where(eq(challenges.id, id));
    return challenge;
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
    const challenge = await this.getOrThrow(id);
    const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS);

    const [bookmarkStats, applicantDistribution] = await Promise.all([
      this.bookmarkStatWithDelta(id, sevenDaysAgo),
      this.getApplicantDistribution(id),
    ]);

    // Detail-view total is the challenge's own counter; with no per-view event
    // table the week-over-week delta is unknowable, so it stays 0 (not fabricated).
    const clicks = { value: challenge.viewCount, deltaPercent: 0 };
    return {
      clicks,
      bookmarks: bookmarkStats,
      // Card-impression tracking (as opposed to detail-page clicks) has no beacon yet,
      // so "exposure" reuses the same click/view signal rather than a fabricated number.
      exposure: clicks,
      applicantDistribution,
      monthlyExposure: this.getMonthlyExposure(),
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

  private async bookmarkStatWithDelta(challengeId: string, sevenDaysAgo: Date) {
    const totalRows = await this.db
      .select({ value: count() })
      .from(bookmarks)
      .where(eq(bookmarks.challengeId, challengeId));
    const beforeRows = await this.db
      .select({ value: count() })
      .from(bookmarks)
      .where(and(eq(bookmarks.challengeId, challengeId), lt(bookmarks.createdAt, sevenDaysAgo)));

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
      .where(eq(applications.challengeId, challengeId))
      .groupBy(applications.role);

    const total = rows.reduce((sum, row) => sum + Number(row.total), 0);
    if (total === 0) return [];
    return rows.map((row) => ({
      label: row.role ?? '미지정',
      value: Math.round((Number(row.total) / total) * 1000) / 10,
    }));
  }

  // The DB stores only the running view counter, so a per-month exposure
  // history cannot be derived — the chart keeps its real month labels at 0
  // rather than inventing a distribution (see the /stats note in openapi.yaml).
  private getMonthlyExposure() {
    const now = new Date();
    const months: { label: string; value: number }[] = [];
    for (let i = 5; i >= 0; i -= 1) {
      const bucket = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ label: `${bucket.getMonth() + 1}월`, value: 0 });
    }
    return months;
  }
}
