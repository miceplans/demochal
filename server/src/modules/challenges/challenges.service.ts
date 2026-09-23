import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, count, desc, eq, gte, gt, inArray, lt, ne, or } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import {
  applications,
  bookmarks,
  businesses,
  challengeViews,
  challenges,
  orders,
  users,
} from '../../db/schema.js';
import type { CreateChallengeDto } from './dto/create-challenge.dto.js';
import type { UpdateChallengeDto } from './dto/update-challenge.dto.js';
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

  /**
   * 공고 내용 부분 수정. 소유 비즈니스 또는 admin만 가능하며, 권한이 없으면 존재 여부를
   * 노출하지 않도록 404로 응답한다(updateStatus와 동일).
   * TODO: 모집 중/마감 공고의 수정 가능 범위(예: 신청자가 있을 때 참가비·정원 축소 금지)는
   * 정책 미확정. https://docs.nestjs.com/exception-filters#built-in-http-exceptions
   */
  async update(id: string, dto: UpdateChallengeDto, user: { id: string; role: string }) {
    const ownership =
      user.role === 'admin'
        ? eq(challenges.id, id)
        : and(eq(challenges.id, id), eq(businesses.ownerUserId, user.id));
    const [current] = await this.db
      .select({ startDate: challenges.startDate, endDate: challenges.endDate })
      .from(challenges)
      .innerJoin(businesses, eq(businesses.id, challenges.businessId))
      .where(ownership)
      .limit(1);
    if (!current) throw new NotFoundException('Challenge not found');

    const startDate = dto.startDate ? new Date(dto.startDate) : current.startDate;
    const endDate = dto.endDate ? new Date(dto.endDate) : current.endDate;
    if (endDate.getTime() < startDate.getTime()) {
      throw new BadRequestException('endDate must not be before startDate');
    }

    const patch = {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.price !== undefined && { price: dto.price }),
      ...(dto.capacity !== undefined && { capacity: dto.capacity }),
      ...(dto.startDate !== undefined && { startDate }),
      ...(dto.endDate !== undefined && { endDate }),
      ...(dto.category !== undefined && { category: dto.category }),
    };
    if (Object.keys(patch).length === 0) throw new BadRequestException('No fields to update');

    const [updated] = await this.db
      .update(challenges)
      .set(patch)
      .where(eq(challenges.id, id))
      .returning();
    return updated;
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

  async listRecommended(userId: string, requestedLimit?: number) {
    const limit = Math.max(1, Math.min(20, Number.isFinite(requestedLimit) ? requestedLimit! : 6));
    const [user] = await this.db
      .select({ interests: users.interests, onboardingSurvey: users.onboardingSurvey })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const surveyInterests = this.surveyInterests(user?.onboardingSurvey);
    const interests = [...new Set([...(user?.interests ?? []), ...surveyInterests])];
    const now = new Date();
    // Low-volume assumption: score only the 200 newest eligible candidates. Revisit with SQL scoring
    // and an index when the published catalogue grows beyond this bounded window.
    const candidates = await this.db
      .select()
      .from(challenges)
      .where(and(eq(challenges.status, 'published'), gt(challenges.endDate, now)))
      .orderBy(desc(challenges.createdAt))
      .limit(200);

    if (candidates.length === 0) return { items: [] };

    const candidateIds = candidates.map((challenge) => challenge.id);
    const [viewRows, bookmarkRows] = await Promise.all([
      this.db
        .select({ challengeId: challengeViews.challengeId, total: count() })
        .from(challengeViews)
        .where(inArray(challengeViews.challengeId, candidateIds))
        .groupBy(challengeViews.challengeId),
      this.db
        .select({ challengeId: bookmarks.challengeId, total: count() })
        .from(bookmarks)
        .where(inArray(bookmarks.challengeId, candidateIds))
        .groupBy(bookmarks.challengeId),
    ]);
    const views = new Map(viewRows.map((row) => [row.challengeId, Number(row.total)]));
    const bookmarkCounts = new Map(bookmarkRows.map((row) => [row.challengeId, Number(row.total)]));

    return {
      items: candidates
        .map((challenge) => {
          const interestScore =
            interests.filter((interest) => this.interestsMatch(interest, challenge.category))
              .length * 100;
          const popularityScore =
            Math.min(views.get(challenge.id) ?? 0, 50) +
            3 * Math.min(bookmarkCounts.get(challenge.id) ?? 0, 20);
          return { challenge, score: interestScore + popularityScore };
        })
        .sort(
          (left, right) =>
            right.score - left.score ||
            right.challenge.createdAt.getTime() - left.challenge.createdAt.getTime() ||
            left.challenge.id.localeCompare(right.challenge.id),
        )
        .slice(0, limit)
        .map(({ challenge }) => challenge),
    };
  }

  private surveyInterests(survey: unknown): string[] {
    if (!survey || typeof survey !== 'object') return [];
    const interests = (survey as { interests?: unknown }).interests;
    return Array.isArray(interests)
      ? interests.filter((interest): interest is string => typeof interest === 'string')
      : [];
  }

  private interestsMatch(interest: string, category: string | null): boolean {
    if (!category) return false;
    const interestTokens = this.normalizeInterestTokens(interest);
    const categoryTokens = this.normalizeInterestTokens(category);
    return interestTokens.some((interestToken) =>
      categoryTokens.some((categoryToken) => this.tokensMatch(interestToken, categoryToken)),
    );
  }

  // 2자 이하 영문/숫자 토큰(ai, it 등)은 부분 일치 시 mail/digital 같은 무관한 단어에
  // 걸리므로 정확히 같을 때만 매칭한다. 한글 토큰(영상, 창업 등)은 부분 일치를 유지한다.
  private tokensMatch(left: string, right: string): boolean {
    if (left === right) return true;
    const isShortAscii = (token: string) => /^[a-z0-9]{1,2}$/.test(token);
    if (isShortAscii(left) || isShortAscii(right)) return false;
    return left.includes(right) || right.includes(left);
  }

  private normalizeInterestTokens(value: string): string[] {
    return value
      .toLowerCase()
      .replace(/[·/\-_\s()]/g, ' ')
      .split(' ')
      .filter(Boolean);
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
