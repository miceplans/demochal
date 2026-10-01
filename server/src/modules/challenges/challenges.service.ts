import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  gt,
  ilike,
  inArray,
  lt,
  lte,
  ne,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
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
import { interestsMatch } from './interest-matching.js';
import { FilesService } from '../files/files.service.js';

// draft -> published -> closed; no other transition is valid.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft: ['published'],
  published: ['closed'],
};

const CHALLENGE_SORTS = ['latest', 'deadline', 'popular'] as const;
const PUBLIC_CHALLENGE_STATUSES = ['published', 'closed'];
type ChallengeSort = (typeof CHALLENGE_SORTS)[number];

export interface ListChallengesOptions {
  cursor?: string;
  limit: number;
  q?: string;
  /** 콤마로 구분한 복수 값도 받는다(예: `IT/SW,디자인`) — 단일 값은 기존과 동일하게 정확 일치. */
  category?: string;
  /** 콤마 구분 대상 목록 — 하나라도 겹치는 챌린지를 반환(배열 overlap). */
  targets?: string;
  /** 콤마 구분 주최기관 유형 목록 — 정확 일치(OR). */
  organizerType?: string;
  /** 총상금(만원) 하한/상한 — 상금이 없는(null) 챌린지는 범위 지정 시 제외된다. */
  prizeMin?: number;
  prizeMax?: number;
  includeClosed?: boolean;
  sort?: string;
}

const splitList = (value?: string) =>
  (value ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

type ParsedCursor =
  | { kind: 'latest'; createdAt: Date; id: string | null }
  | { kind: 'deadline'; endDate: Date; id: string | null }
  | { kind: 'popular'; viewCount: number; id: string | null };

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Exposure boost for challenges recruiting through the in-service (seMOchall)
// application form, as advertised on the biz posting form. Chosen so a boosted
// challenge outranks the popularity cap (50 + 3*20 = 110) and a single interest
// match (100), but not a double interest match (200).
const SEMO_FORM_BOOST = 150;

@Injectable()
export class ChallengesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly adminSettingsService: AdminSettingsService,
    private readonly filesService: FilesService,
  ) {}

  /**
   * 공개 챌린지 목록. 기본 where는 항상 draft를 제외한다(공개 리스트 유출 방지) —
   * draft 목록이 필요한 관리자 경로는 admin 모듈에서 별도 처리한다.
   * 정렬별 키셋 페이지네이션: 커서는 `${정렬컬럼값}|${id}` 복합 형태이고, latest는
   * 구버전 단일 createdAt ISO 커서도 계속 받는다.
   */
  async list(options: ListChallengesOptions) {
    const {
      cursor,
      limit,
      q,
      category,
      targets,
      organizerType,
      prizeMin,
      prizeMax,
      includeClosed = true,
      sort: requestedSort,
    } = options;
    const sort: ChallengeSort = requestedSort ? this.parseSort(requestedSort) : 'latest';

    const conditions = [
      inArray(challenges.status, PUBLIC_CHALLENGE_STATUSES),
      eq(challenges.visibility, 'public'),
    ];
    if (!includeClosed) conditions.push(ne(challenges.status, 'closed'));
    const categoryList = splitList(category);
    if (categoryList.length) conditions.push(inArray(challenges.category, categoryList));
    const targetList = splitList(targets);
    if (targetList.length) {
      const targetArray = sql`ARRAY[${sql.join(
        targetList.map((t) => sql`${t}`),
        sql`, `,
      )}]::text[]`;
      conditions.push(sql`${challenges.targets} && ${targetArray}`);
    }
    const organizerTypeList = splitList(organizerType);
    if (organizerTypeList.length) {
      conditions.push(inArray(challenges.organizerType, organizerTypeList));
    }
    if (prizeMin !== undefined) conditions.push(gte(challenges.prizeAmount, prizeMin));
    if (prizeMax !== undefined) conditions.push(lte(challenges.prizeAmount, prizeMax));
    if (q) {
      conditions.push(or(ilike(challenges.title, `%${q}%`), ilike(challenges.category, `%${q}%`))!);
    }
    if (cursor) conditions.push(this.keysetCondition(this.parseCursor(sort, cursor)));

    const rows = await this.db
      .select()
      .from(challenges)
      .where(and(...conditions))
      .orderBy(...this.orderBy(sort))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);
    const last = items[items.length - 1];
    const nextCursor = hasMore && last ? this.encodeCursor(sort, last) : null;
    return { items, nextCursor };
  }

  private parseSort(sort: string): ChallengeSort {
    if ((CHALLENGE_SORTS as readonly string[]).includes(sort)) return sort as ChallengeSort;
    throw new BadRequestException(`sort must be one of: ${CHALLENGE_SORTS.join(', ')}`);
  }

  private orderBy(sort: ChallengeSort) {
    // id를 항상 2차 정렬키로 둬 동일 정렬값 행 사이에서도 결정적이게 한다.
    if (sort === 'deadline') return [asc(challenges.endDate), asc(challenges.id)];
    if (sort === 'popular') return [desc(challenges.viewCount), desc(challenges.id)];
    return [desc(challenges.createdAt), desc(challenges.id)];
  }

  private parseCursor(sort: ChallengeSort, cursor: string): ParsedCursor {
    const separator = cursor.indexOf('|');
    if (separator === -1) {
      // 단일값 커서는 latest(createdAt ISO) 전용 레거시 형식이다.
      if (sort !== 'latest') {
        throw new BadRequestException(
          `cursor for sort=${sort} must be a compound "value|id" cursor`,
        );
      }
      const createdAt = new Date(cursor);
      if (Number.isNaN(createdAt.getTime())) {
        throw new BadRequestException('cursor must be a valid ISO 8601 timestamp or "value|id"');
      }
      return { kind: 'latest', createdAt, id: null };
    }
    const rawValue = cursor.slice(0, separator);
    const id = cursor.slice(separator + 1);
    if (!id) throw new BadRequestException('cursor id part must not be empty');
    if (sort === 'popular') {
      const viewCount = Number(rawValue);
      if (!Number.isFinite(viewCount)) {
        throw new BadRequestException('popular cursor value must be a number');
      }
      return { kind: 'popular', viewCount, id };
    }
    const date = new Date(rawValue);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('cursor value part must be a valid ISO 8601 timestamp');
    }
    return sort === 'deadline'
      ? { kind: 'deadline', endDate: date, id }
      : { kind: 'latest', createdAt: date, id };
  }

  private keysetCondition(parsed: ParsedCursor) {
    if (parsed.kind === 'popular') {
      return parsed.id
        ? (or(
            lt(challenges.viewCount, parsed.viewCount),
            and(eq(challenges.viewCount, parsed.viewCount), lt(challenges.id, parsed.id)),
          ) as SQL)
        : lt(challenges.viewCount, parsed.viewCount);
    }
    const column = parsed.kind === 'deadline' ? challenges.endDate : challenges.createdAt;
    if (parsed.kind === 'deadline') {
      // 마감 임박 순(오름차순): 커서보다 뒤에 오는 (endDate, id) 튜플만.
      return parsed.id
        ? (or(
            gt(column, parsed.endDate),
            and(eq(column, parsed.endDate), gt(challenges.id, parsed.id)),
          ) as SQL)
        : gt(column, parsed.endDate);
    }
    return parsed.id
      ? (or(
          lt(column, parsed.createdAt),
          and(eq(column, parsed.createdAt), lt(challenges.id, parsed.id)),
        ) as SQL)
      : lt(column, parsed.createdAt);
  }

  private encodeCursor(
    sort: ChallengeSort,
    row: { id: string; createdAt: Date; endDate: Date; viewCount: number },
  ) {
    if (sort === 'deadline') return `${row.endDate.toISOString()}|${row.id}`;
    if (sort === 'popular') return `${row.viewCount}|${row.id}`;
    return `${row.createdAt.toISOString()}|${row.id}`;
  }

  private async getOrThrow(id: string) {
    const [challenge] = await this.db
      .select()
      .from(challenges)
      .where(eq(challenges.id, id))
      .limit(1);
    if (!challenge) throw new NotFoundException('챌린지를 찾을 수 없습니다.');
    return challenge;
  }

  private async getPublicOrThrow(id: string) {
    const [challenge] = await this.db
      .select()
      .from(challenges)
      .where(
        and(
          eq(challenges.id, id),
          inArray(challenges.status, PUBLIC_CHALLENGE_STATUSES),
          eq(challenges.visibility, 'public'),
        ),
      )
      .limit(1);
    if (!challenge) throw new NotFoundException('챌린지를 찾을 수 없습니다.');
    return challenge;
  }

  async findById(id: string) {
    const challenge = await this.getPublicOrThrow(id);
    // Every detail fetch is a real "click" into the posting — see challengeViews' comment in schema.ts.
    await this.db.insert(challengeViews).values({ challengeId: id });
    // 포스터 공개 URL은 서버가 함께 내린다 — 클라이언트가 파일 API를 직접 호출하면 업로더 소유권 검사에 막힌다.
    const posterUrl = await this.filesService.resolvePublicUrl(challenge.posterFileId);
    return { ...challenge, posterUrl };
  }

  async stats(id: string) {
    await this.getPublicOrThrow(id);
    const [views] = await this.db
      .select({ count: count() })
      .from(challengeViews)
      .where(eq(challengeViews.challengeId, id));
    return { views: Number(views?.count ?? 0) };
  }

  /** Drafts are visible only to the business account that owns them. */
  async findMineById(id: string, ownerUserId: string) {
    const [row] = await this.db
      .select({ challenge: challenges })
      .from(challenges)
      .innerJoin(businesses, eq(businesses.id, challenges.businessId))
      .where(and(eq(challenges.id, id), eq(businesses.ownerUserId, ownerUserId)))
      .limit(1);
    if (!row) throw new NotFoundException('챌린지를 찾을 수 없습니다.');
    const posterUrl = await this.filesService.resolvePublicUrl(row.challenge.posterFileId);
    return { ...row.challenge, posterUrl };
  }

  async getStatsForOwner(id: string, ownerUserId: string) {
    await this.findMineById(id, ownerUserId);
    return this.getStatsForExistingChallenge(id);
  }

  private async getStatsForExistingChallenge(id: string) {
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
      exposure: clicks,
      applicantDistribution,
      monthlyExposure,
    };
  }

  async create(dto: CreateChallengeDto, ownerUserId: string) {
    const [business] = await this.db
      .select({ id: businesses.id })
      .from(businesses)
      .where(and(eq(businesses.id, dto.businessId), eq(businesses.ownerUserId, ownerUserId)))
      .limit(1);
    if (!business) throw new NotFoundException('기업 정보를 찾을 수 없거나 조회 권한이 없습니다.');
    if (dto.posterFileId) await this.filesService.assertReadyPublic(dto.posterFileId);

    const recruitMethod = dto.recruitMethod ?? 'external';
    if (recruitMethod === 'external' && !dto.recruitUrl) {
      throw new BadRequestException('recruitUrl is required when recruitMethod is external');
    }

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
        targets: dto.targets,
        organizerType: dto.organizerType,
        prizeAmount: dto.prizeAmount,
        posterFileId: dto.posterFileId,
        recruitMethod,
        recruitUrl: recruitMethod === 'external' ? dto.recruitUrl : null,
        summary: dto.summary,
        hashtags: dto.hashtags ?? [],
        topics: dto.topics ?? [],
        inquiryContact: dto.inquiryContact,
        visibility: dto.visibility ?? 'public',
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
      .select({
        startDate: challenges.startDate,
        endDate: challenges.endDate,
        recruitMethod: challenges.recruitMethod,
      })
      .from(challenges)
      .innerJoin(businesses, eq(businesses.id, challenges.businessId))
      .where(ownership)
      .limit(1);
    if (!current) throw new NotFoundException('챌린지를 찾을 수 없습니다.');
    // null은 포스터 제거라 검증에서 제외 — 존재하고 public+ready인 파일만 참조할 수 있다.
    if (dto.posterFileId) await this.filesService.assertReadyPublic(dto.posterFileId);

    const startDate = dto.startDate ? new Date(dto.startDate) : current.startDate;
    const endDate = dto.endDate ? new Date(dto.endDate) : current.endDate;
    if (endDate.getTime() < startDate.getTime()) {
      throw new BadRequestException('종료일은 시작일 이후여야 합니다.');
    }

    const patch = {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.price !== undefined && { price: dto.price }),
      ...(dto.capacity !== undefined && { capacity: dto.capacity }),
      ...(dto.startDate !== undefined && { startDate }),
      ...(dto.endDate !== undefined && { endDate }),
      ...(dto.category !== undefined && { category: dto.category }),
      ...(dto.recruitUrl !== undefined &&
        current.recruitMethod === 'external' && { recruitUrl: dto.recruitUrl }),
      ...(dto.targets !== undefined && { targets: dto.targets }),
      ...(dto.organizerType !== undefined && { organizerType: dto.organizerType }),
      ...(dto.prizeAmount !== undefined && { prizeAmount: dto.prizeAmount }),
      ...(dto.posterFileId !== undefined && { posterFileId: dto.posterFileId }),
      ...(dto.applicationForm !== undefined && { applicationForm: dto.applicationForm }),
      ...(dto.summary !== undefined && { summary: dto.summary }),
      ...(dto.hashtags !== undefined && { hashtags: dto.hashtags ?? [] }),
      ...(dto.topics !== undefined && { topics: dto.topics ?? [] }),
      ...(dto.inquiryContact !== undefined && { inquiryContact: dto.inquiryContact }),
      ...(dto.visibility !== undefined && { visibility: dto.visibility }),
    };
    if (Object.keys(patch).length === 0) throw new BadRequestException('수정할 항목이 없습니다.');

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
    if (!challenge) throw new NotFoundException('챌린지를 찾을 수 없습니다.');

    const allowed = ALLOWED_TRANSITIONS[challenge.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new ConflictException(
        `${challenge.status} 상태의 챌린지를 ${dto.status}(으)로 변경할 수 없습니다.`,
      );
    }

    const [updated] = await this.db
      .update(challenges)
      .set({ status: dto.status })
      .where(eq(challenges.id, id))
      .returning();
    return updated;
  }

  async getStats(id: string) {
    await this.getPublicOrThrow(id);
    return this.getStatsForExistingChallenge(id);
  }

  async listSimilar(id: string) {
    const challenge = await this.getPublicOrThrow(id);

    const byCategory = challenge.category
      ? await this.db
          .select()
          .from(challenges)
          .where(
            and(
              eq(challenges.category, challenge.category),
              ne(challenges.id, id),
              inArray(challenges.status, PUBLIC_CHALLENGE_STATUSES),
              eq(challenges.visibility, 'public'),
            ),
          )
          .orderBy(desc(challenges.createdAt))
          .limit(3)
      : [];
    if (byCategory.length >= 3) return byCategory;

    const excludeIds = new Set([id, ...byCategory.map((c) => c.id)]);
    const fallback = await this.db
      .select()
      .from(challenges)
      .where(
        and(
          ne(challenges.id, id),
          inArray(challenges.status, PUBLIC_CHALLENGE_STATUSES),
          eq(challenges.visibility, 'public'),
        ),
      )
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
      .where(
        and(
          eq(challenges.status, 'published'),
          eq(challenges.visibility, 'public'),
          gt(challenges.endDate, now),
        ),
      )
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
            interests.filter((interest) => interestsMatch(interest, challenge.category)).length *
            100;
          const popularityScore =
            Math.min(views.get(challenge.id) ?? 0, 50) +
            3 * Math.min(bookmarkCounts.get(challenge.id) ?? 0, 20);
          const semoFormBoost = challenge.recruitMethod === 'seMOchall' ? SEMO_FORM_BOOST : 0;
          return { challenge, score: interestScore + popularityScore + semoFormBoost };
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
