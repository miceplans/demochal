import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { adToday } from '../ads/ad-period.js';
import { and, asc, desc, eq, gte, ilike, inArray, lt, lte, or, sql, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import {
  adProducts,
  ads,
  applications,
  businesses,
  certificates,
  orders,
  challenges,
  files,
  payments,
  reports,
  teamMembers,
  teams,
  users,
  verifications,
  type reports as reportsTable,
} from '../../db/schema.js';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { AdminSettingsService } from './admin-settings.service.js';
import { FilesService } from '../files/files.service.js';
import { buildPublicFileUrl } from '../files/public-file-url.js';
import { AdsService } from '../ads/ads.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { AdPricingSlotDto } from './dto/update-ad-pricing.dto.js';
import type { ResolveReportDto } from './dto/resolve-report.dto.js';
import type { SuspendUserDto } from './dto/suspend-user.dto.js';
import type { VerifyCertificateDto } from './dto/verify-certificate.dto.js';

type ReportRow = typeof reportsTable.$inferSelect;

export interface AdminStatCard {
  label: string;
  value: string;
  meta: string;
  dot: string | null;
}

export interface AdminAdReport {
  adId: string;
  adNumber: number;
  organization: string;
  period: string;
  stats: AdminStatCard[];
  daily: { date: string; impressions: number; clicks: number; ctr: number }[];
}

export interface AdminAnalytics {
  adReport?: AdminAdReport;
  stats: AdminStatCard[];
  activity: { months: string[]; general: number[]; corp: number[]; yMax: number };
}

const countRows = sql<number>`count(*)::int`;

/** ilike 검색어의 %, _, 역슬래시를 이스케이프해 리터럴 부분 문자열로 매칭한다. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
const like = (value: string) => `%${escapeLike(value)}%`;

const DAY_MS = 86_400_000;
const DEFAULT_USERS_PAGE_SIZE = 30;
const MAX_USERS_PAGE_SIZE = 50;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type BucketUnit = 'day' | 'month';
interface TimeBuckets {
  unit: BucketUnit;
  since: Date;
  keys: string[];
  labels: string[];
}

const toDateKey = (date: Date) => date.toISOString().slice(0, 10);

/** 관리자 집계 버킷의 기준 시간대. 저장은 UTC, 일/월 경계는 KST(UTC+9, DST 없음)로 자른다. */
const BUCKET_TIME_ZONE = 'Asia/Seoul';
const BUCKET_OFFSET_MS = 9 * 3_600_000;

/**
 * Consecutive KST day/month buckets ending at `now` (inclusive). Keys match
 * {@link bucketKey}'s `YYYY-MM-DD` output so SQL group-by rows can be joined back.
 */
export function timeBuckets(unit: BucketUnit, count: number, now = new Date()): TimeBuckets {
  // KST 벽시계 시각을 UTC 필드로 옮겨 계산한 뒤, since만 실제 순간(UTC)으로 되돌린다.
  const kstNow = new Date(now.getTime() + BUCKET_OFFSET_MS);
  const starts = Array.from({ length: count }, (_, i) => {
    const offset = count - 1 - i;
    return unit === 'day'
      ? new Date(
          Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate() - offset),
        )
      : new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth() - offset, 1));
  });
  return {
    unit,
    since: new Date(starts[0]!.getTime() - BUCKET_OFFSET_MS),
    keys: starts.map(toDateKey),
    labels: starts.map((date) =>
      unit === 'day'
        ? `${date.getUTCMonth() + 1}/${date.getUTCDate()}`
        : `${date.getUTCMonth() + 1}월`,
    ),
  };
}

const RANGE_BUCKETS: Record<string, [BucketUnit, number]> = {
  '7days': ['day', 7],
  '30days': ['day', 30],
  '1year': ['month', 12],
};

/**
 * `YYYY-MM-DD` of the KST day/month a timestamp falls in. 컬럼은 tz 없는 `timestamp`(UTC 저장)이라
 * UTC로 해석한 뒤 KST로 변환해 DB 세션 TZ와 무관하게 버킷 경계가 고정된다.
 */
function bucketKey(unit: BucketUnit, column: PgColumn) {
  return sql<string>`to_char(date_trunc(${sql.raw(`'${unit}'`)}, ${column} AT TIME ZONE 'UTC' AT TIME ZONE ${sql.raw(`'${BUCKET_TIME_ZONE}'`)}), 'YYYY-MM-DD')`;
}

/** Smallest 1/2/5×10ⁿ ≥ max (at least 10) so the chart's five even ticks stay round. */
export function niceMax(max: number) {
  if (max <= 10) return 10;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const step = [1, 2, 5, 10].find((factor) => factor * magnitude >= max) ?? 10;
  return step * magnitude;
}

/** `GET /admin/contents` section page size: default 8 cards, "더보기" grows it, capped at 50. */
const CONTENTS_PAGE_SIZE = 8;
const CONTENTS_MAX_LIMIT = 50;
function clampContentsLimit(value?: string) {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return CONTENTS_PAGE_SIZE;
  return Math.min(parsed, CONTENTS_MAX_LIMIT);
}

/** `GET /admin/users?joinedWithin=` → lookback window in days. */
const JOINED_WITHIN_DAYS: Record<string, number> = { '7d': 7, '30d': 30, '1y': 365 };

const ADMIN_ROLE_LABELS: Record<string, string> = {
  admin: '관리자',
  business: '기업',
  user: '일반 사용자',
};

/** 'kim.dev@gmail.com' → 'k***@gmail.com' (local part first char + '***'). */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return `${email.charAt(0)}***`;
  return `${email.charAt(0)}***${email.slice(at)}`;
}

/** '123-45-67890' → '123-45-*****' (keep the first two digit groups, trailing dash included). */
export function maskBizNumber(registrationNumber: string): string {
  return `${registrationNumber.slice(0, 7)}*****`;
}

/** ads의 노출 기간 기준(AdsService.listPublic과 동일): 종료일 당일까지 노출된다. */
// 광고 기간은 KST 날짜 기준이다(adToday) — 목록/집계도 같은 기준을 쓴다.
const utcDayStart = (now = new Date()) => adToday(now);

const formatMonthDay = (date: Date) =>
  `${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;

const formatMonthDayShort = (date: Date) => `${date.getMonth() + 1}/${date.getDate()}`;

@Injectable()
export class AdminService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly notificationsService: NotificationsService,
    private readonly adsService: AdsService,
    private readonly filesService: FilesService,
    private readonly adminSettingsService: AdminSettingsService,
  ) {}

  // ---------------------------------------------------------------- dashboard

  async getDashboard(range?: string) {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * DAY_MS);

    const [approvedBiz] = await this.db
      .select({ count: countRows })
      .from(businesses)
      .where(eq(businesses.verificationStatus, 'verified'));
    const [publishedChallenges] = await this.db
      .select({ count: countRows })
      .from(challenges)
      .where(eq(challenges.status, 'published'));
    const [totalApplications] = await this.db.select({ count: countRows }).from(applications);
    const [newUsers] = await this.db
      .select({ count: countRows })
      .from(users)
      .where(gte(users.createdAt, weekAgo));
    const recentReports = await this.db
      .select()
      .from(reports)
      .orderBy(desc(reports.createdAt))
      .limit(5);

    const [unit, count] = RANGE_BUCKETS[range ?? ''] ?? RANGE_BUCKETS['1year']!;
    const buckets = timeBuckets(unit, count, now);

    // TODO: 페이지뷰 계측이 없어 '유저 트래픽'은 기간별 신규 가입(users)과
    // 신규 제출물(applications)로 대신한다. 방문 계측을 도입하면 이 시리즈를 교체한다.
    const signupBucket = bucketKey(unit, users.createdAt);
    const signupRows = await this.db
      .select({ bucket: signupBucket, count: countRows })
      .from(users)
      .where(and(gte(users.createdAt, buckets.since), eq(users.role, 'user')))
      .groupBy(signupBucket);
    const submissionBucket = bucketKey(unit, applications.createdAt);
    const submissionRows = await this.db
      .select({ bucket: submissionBucket, count: countRows })
      .from(applications)
      .where(gte(applications.createdAt, buckets.since))
      .groupBy(submissionBucket);
    const seriesOf = (rows: { bucket: string; count: number }[]) => {
      const byBucket = new Map(rows.map((row) => [row.bucket, row.count]));
      return buckets.keys.map((key) => byBucket.get(key) ?? 0);
    };

    // 광고 비율: 같은 기간 결제 완료(paid + legacy done, billing-history.service.ts의
    // charged 정의와 동일) 순매출 중 광고 주문(orders.adId)에서 나온 순매출 비중.
    const [revenueRow] = await this.db
      .select({
        total: sql<number>`coalesce(sum(${payments.amount} - ${payments.refundedAmount}), 0)::int`,
        ad: sql<number>`coalesce(sum(${payments.amount} - ${payments.refundedAmount}) filter (where ${orders.adId} is not null), 0)::int`,
      })
      .from(payments)
      .innerJoin(orders, eq(payments.orderId, orders.id))
      .where(
        and(inArray(payments.status, ['paid', 'done']), gte(payments.approvedAt, buckets.since)),
      );
    const totalRevenue = revenueRow?.total ?? 0;
    const adRevenue = revenueRow?.ad ?? 0;

    const stats: AdminStatCard[] = [
      {
        label: '승인된 기관',
        value: String(approvedBiz?.count ?? 0),
        meta: '누적',
        dot: '#0877FF',
      },
      {
        label: '진행 중 챌린지',
        value: String(publishedChallenges?.count ?? 0),
        meta: '현재 진행 중',
        dot: '#22C55E',
      },
      {
        label: '누적 제출물',
        value: String(totalApplications?.count ?? 0),
        meta: '전체 누적',
        dot: '#F59E0B',
      },
      {
        label: '신규 가입자',
        value: String(newUsers?.count ?? 0),
        meta: `+${newUsers?.count ?? 0} 최근 7일`,
        dot: '#8B5CF6',
      },
    ];

    return {
      stats,
      adRatio: {
        value: `${adRevenue.toLocaleString('ko-KR')} ₩`,
        ratio: totalRevenue > 0 ? adRevenue / totalRevenue : 0,
      },
      traffic: {
        labels: buckets.labels,
        primary: seriesOf(signupRows),
        secondary: seriesOf(submissionRows),
      },
      reports: recentReports.map((row) => this.toReport(row)),
      generatedAt: now.toISOString(),
    };
  }

  // --------------------------------------------------------------- businesses

  async listBusinesses(q?: string, type?: string, status?: string) {
    const [totalRow] = await this.db.select({ count: countRows }).from(businesses);
    const [approvedRow] = await this.db
      .select({ count: countRows })
      .from(businesses)
      .where(eq(businesses.verificationStatus, 'verified'));
    const [rejectedRow] = await this.db
      .select({ count: countRows })
      .from(businesses)
      .where(eq(businesses.verificationStatus, 'rejected'));
    const [pendingRow] = await this.db
      .select({ count: countRows })
      .from(businesses)
      .where(eq(businesses.verificationStatus, 'pending'));

    const conditions = [];
    // 검색창이 "기관명/담당자"이므로 기관 소유자(담당자) 이름도 함께 매칭한다.
    if (q) {
      conditions.push(
        or(
          ilike(businesses.name, like(q)),
          sql`${businesses.ownerUserId} in (select ${users.id} from ${users} where ${users.name} ilike ${like(q)})`,
        ),
      );
    }
    if (status) conditions.push(eq(businesses.verificationStatus, status));
    if (type) conditions.push(eq(businesses.type, type));
    const rows = await this.db
      .select()
      .from(businesses)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(businesses.createdAt));

    const businessIds = rows.map((row) => row.id);
    const verificationRows = businessIds.length
      ? await this.db
          .select()
          .from(verifications)
          .where(inArray(verifications.businessId, businessIds))
          .orderBy(desc(verifications.createdAt))
      : [];

    // First occurrence per business is the latest verification (desc order).
    const latestByBusiness = new Map<string, (typeof verificationRows)[number]>();
    const allByBusiness = new Map<string, (typeof verificationRows)[number][]>();
    for (const row of verificationRows) {
      if (!latestByBusiness.has(row.businessId)) latestByBusiness.set(row.businessId, row);
      const list = allByBusiness.get(row.businessId) ?? [];
      list.push(row);
      allByBusiness.set(row.businessId, list);
    }

    const stats: AdminStatCard[] = [
      { label: '전체 신청', value: String(totalRow?.count ?? 0), meta: '전체', dot: '#0877FF' },
      { label: '승인', value: String(approvedRow?.count ?? 0), meta: '누적 승인', dot: '#22C55E' },
      { label: '거부', value: String(rejectedRow?.count ?? 0), meta: '누적 거부', dot: '#EF4444' },
      { label: '대기', value: String(pendingRow?.count ?? 0), meta: '심사 대기', dot: '#F59E0B' },
    ];

    const items = rows.map((business) => {
      const businessVerifications = allByBusiness.get(business.id) ?? [];
      const latest = latestByBusiness.get(business.id);
      // Closed-business OCR markers take precedence over raw status so a 폐업/
      // 휴업 row surfaces as 'closed' rather than a generic 'failed'.
      const ocrDump = businessVerifications
        .map((row) => JSON.stringify(row.ocrResult ?? {}))
        .join('');
      const nts =
        ocrDump.includes('폐업자') || ocrDump.includes('휴업자')
          ? 'closed'
          : businessVerifications.some((row) => row.status === 'verified')
            ? 'success'
            : businessVerifications.some((row) => row.status === 'rejected')
              ? 'failed'
              : 'unrecognized';
      const appliedAt = latest?.createdAt ?? business.createdAt;
      return {
        id: business.id,
        // 승인/거부 API는 인증 요청 id를 받는다 — 기관 id가 아니라 최신 요청을 넘긴다.
        verificationId: latest?.id ?? null,
        org: business.name ?? '기관명 미등록',
        // Businesses registered before the type column existed have no value.
        type: business.type ?? '미지정',
        // 학교/비영리 등은 사업자번호가 없다.
        bizNumber: business.registrationNumber ? maskBizNumber(business.registrationNumber) : '-',
        appliedAt: formatMonthDay(appliedAt),
        nts,
        status: business.verificationStatus,
      };
    });

    return { stats, items };
  }

  // ------------------------------------------------------------- verification

  async approveVerification(id: string) {
    return this.setVerificationResult(id, 'verified', null);
  }

  async rejectVerification(id: string, reason: string) {
    return this.setVerificationResult(id, 'rejected', reason);
  }

  private async setVerificationResult(
    id: string,
    status: 'verified' | 'rejected',
    reason: string | null,
  ) {
    // 조회·상태 전이·기관 상태 갱신·결과 알림을 한 트랜잭션에서 처리한다(행 잠금).
    const updated = await this.db.transaction(async (tx) => {
      const [verification] = await tx
        .select()
        .from(verifications)
        .where(eq(verifications.id, id))
        .for('update')
        .limit(1);
      if (!verification) throw new NotFoundException('인증 요청을 찾을 수 없습니다.');
      if (verification.status === status) {
        throw new ConflictException(`이미 ${status} 상태의 인증 요청입니다.`);
      }

      const [row] = await tx
        .update(verifications)
        .set({
          status,
          rejectionReason: status === 'rejected' ? reason : null,
          updatedAt: new Date(),
        })
        .where(eq(verifications.id, id))
        .returning();

      const [business] = await tx
        .select()
        .from(businesses)
        .where(eq(businesses.id, verification.businessId))
        .limit(1);
      if (business) {
        await tx
          .update(businesses)
          .set({ verificationStatus: status })
          .where(
            and(
              eq(businesses.id, business.id),
              // 더 최근 인증 요청이 있으면 이 처리가 기관의 현재 상태를 덮어쓰지 않는다.
              sql`not exists (select 1 from ${verifications} where ${verifications.businessId} = ${business.id} and ${verifications.createdAt} > ${verification.createdAt})`,
            ),
          );
      }
      if (business?.ownerUserId) {
        await this.notificationsService.create(
          business.ownerUserId,
          'verification.result',
          { verificationId: id, status, ...(reason ? { reason } : {}) },
          tx,
        );
      }
      return row;
    });

    return updated;
  }

  // ------------------------------------------------------------- certificates

  async listCertificates(status?: string, q?: string, category?: string) {
    const conditions = [];
    if (status) conditions.push(eq(certificates.status, status));
    if (category) conditions.push(eq(certificates.category, category));
    if (q) {
      conditions.push(or(ilike(certificates.title, like(q)), ilike(users.name, like(q))));
    }
    const rows = await this.db
      .select({ certificate: certificates, userName: users.name, file: files })
      .from(certificates)
      .innerJoin(users, eq(certificates.userId, users.id))
      .leftJoin(files, eq(certificates.fileId, files.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(certificates.createdAt));

    return Promise.all(
      rows.map(async ({ certificate, userName, file }) => ({
        id: certificate.id,
        user: userName,
        award: certificate.title,
        category: certificate.category,
        fileId: certificate.fileId,
        ...(await this.certificateFile(file)),
        status: certificate.status,
      })),
    );
  }

  /**
   * Viewable URL for a certificate's original. Public files use the CDN URL;
   * private ones get a 5-minute presigned GET (never a public link) per the
   * private-bucket rule. Unfinished/rejected uploads have nothing to show.
   */
  private async certificateFile(file: typeof files.$inferSelect | null) {
    if (!file || file.uploadStatus !== 'ready') return { fileUrl: null, fileContentType: null };
    const fileUrl =
      file.bucket === 'private'
        ? await this.filesService.getPrivateReadUrl(file.key)
        : buildPublicFileUrl(file);
    return { fileUrl, fileContentType: file.contentType };
  }

  async verifyCertificate(id: string, dto: VerifyCertificateDto) {
    const reason = dto.reason?.trim();
    if (dto.action === 'reject' && !reason) {
      throw new BadRequestException('A rejection reason is required');
    }
    const [certificate] = await this.db
      .select()
      .from(certificates)
      .where(eq(certificates.id, id))
      .limit(1);
    if (!certificate) throw new NotFoundException('인증서를 찾을 수 없습니다.');

    const status = dto.action === 'approve' ? 'verified' : 'rejected';
    if (certificate.status === status) {
      throw new ConflictException(`이미 ${status} 상태의 인증서입니다.`);
    }
    // 상태 전이와 뱃지 부여/회수는 한 트랜잭션으로 처리해 서로 어긋나지 않게 한다.
    const { updated, owner } = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(certificates)
        .set({
          status,
          rejectionReason: dto.action === 'reject' ? (reason ?? null) : null,
        })
        .where(eq(certificates.id, id))
        .returning();

      const [certificateOwner] = await tx
        .select()
        .from(users)
        .where(eq(users.id, certificate.userId))
        .limit(1);

      if (dto.action === 'approve' && certificateOwner) {
        // read-modify-write 대신 단일 UPDATE로 원자적으로 중복 없이 추가한다.
        await tx
          .update(users)
          .set({
            badges: sql`case when ${users.badges} @> jsonb_build_array(${certificate.title}::text)
            then ${users.badges}
            else ${users.badges} || jsonb_build_array(${certificate.title}::text) end`,
          })
          .where(eq(users.id, certificateOwner.id));
      } else if (dto.action === 'reject' && certificate.status === 'verified' && certificateOwner) {
        // 승인했던 인증서를 거부로 뒤집으면 그 인증서로 받은 뱃지를 회수한다
        // (같은 제목의 다른 인증 완료 인증서가 있으면 유지).
        await tx
          .update(users)
          .set({
            badges: sql`case when exists (
              select 1 from ${certificates}
              where ${certificates.userId} = ${certificateOwner.id}
                and ${certificates.title} = ${certificate.title}
                and ${certificates.status} = 'verified'
                and ${certificates.id} <> ${id}
            ) then ${users.badges} else ${users.badges} - ${certificate.title}::text end`,
          })
          .where(eq(users.id, certificateOwner.id));
      }
      return { updated: row, owner: certificateOwner };
    });

    return {
      id: updated!.id,
      user: owner?.name ?? '',
      award: updated!.title,
      category: updated!.category,
      fileId: updated!.fileId,
      status: updated!.status,
    };
  }

  // ---------------------------------------------------------------------- ads

  /** 관리자 광고 중단 — 진행중(active) 광고만 paused로 전이한다. 원자적 조건부 UPDATE. */
  async pauseAd(id: string) {
    const [updated] = await this.db
      .update(ads)
      .set({ status: 'paused', pausedBy: 'admin' })
      .where(and(eq(ads.id, id), eq(ads.status, 'active')))
      .returning({ id: ads.id, status: ads.status });
    if (updated) return updated;
    const [existing] = await this.db
      .select({ id: ads.id })
      .from(ads)
      .where(eq(ads.id, id))
      .limit(1);
    if (!existing) throw new NotFoundException('광고를 찾을 수 없습니다.');
    throw new BadRequestException('진행 중인 광고만 일시정지할 수 있습니다.');
  }

  async listAds(q?: string, status?: string) {
    // 'ended'로 전환하는 배치가 없어 계약이 끝난 광고도 DB에는 active로 남는다.
    // 실제로 노출되지 않으므로 목록에서는 종료로 취급해 상태·필터를 일치시킨다.
    const todayStart = utcDayStart();
    const conditions = [];
    if (q) conditions.push(or(ilike(ads.title, like(q)), ilike(businesses.name, like(q))));
    if (status === 'active') {
      conditions.push(and(eq(ads.status, 'active'), gte(ads.endDate, todayStart)));
    } else if (status === 'ended') {
      conditions.push(
        or(eq(ads.status, 'ended'), and(eq(ads.status, 'active'), lt(ads.endDate, todayStart))),
      );
    } else if (status) {
      conditions.push(eq(ads.status, status));
    }
    const rows = await this.db
      .select({ ad: ads, organization: businesses.name, productName: adProducts.name })
      .from(ads)
      .innerJoin(businesses, eq(ads.businessId, businesses.id))
      .innerJoin(adProducts, eq(ads.productId, adProducts.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(ads.createdAt));

    return rows.map(({ ad, organization, productName }) => ({
      ...ad,
      status: ad.status === 'active' && ad.endDate < todayStart ? 'ended' : ad.status,
      organization,
      productName,
    }));
  }

  async getAdPricing() {
    const products = await this.db.select().from(adProducts).orderBy(asc(adProducts.createdAt));
    const now = new Date();
    const result = [];
    for (const product of products) {
      const [current] = await this.db
        .select({ ad: ads, organization: businesses.name })
        .from(ads)
        .innerJoin(businesses, eq(ads.businessId, businesses.id))
        .where(
          and(
            eq(ads.productId, product.id),
            eq(ads.status, 'active'),
            // 노출 기간이 끝났거나 아직 시작 전인 광고는 "현재 광고"가 아니다.
            lte(ads.startDate, now),
            gte(ads.endDate, utcDayStart(now)),
          ),
        )
        .orderBy(desc(ads.createdAt))
        .limit(1);
      result.push({
        slot: product.placement,
        dailyPrice: product.dailyPrice,
        currentAdId: current?.ad.id ?? null,
        organization: current?.organization ?? null,
        period: current
          ? `${formatMonthDayShort(current.ad.startDate)}~${formatMonthDayShort(current.ad.endDate)}`
          : null,
      });
    }
    return result;
  }

  async updateAdPricing(items: AdPricingSlotDto[]) {
    const products = await this.db.select().from(adProducts);
    const knownPlacements = new Set(products.map((product) => product.placement));
    for (const item of items) {
      if (!knownPlacements.has(item.slot)) {
        throw new BadRequestException(`알 수 없는 광고 자리입니다: ${item.slot}`);
      }
    }
    if (new Set(items.map((item) => item.slot)).size !== items.length) {
      throw new BadRequestException('Duplicate ad slot');
    }
    // 일부 슬롯만 반영되지 않도록 한 트랜잭션으로 갱신한다.
    await this.db.transaction(async (tx) => {
      for (const item of items) {
        await tx
          .update(adProducts)
          .set({ dailyPrice: item.dailyPrice })
          .where(eq(adProducts.placement, item.slot));
      }
    });
    return this.getAdPricing();
  }

  // --------------------------------------------------------------------- users

  async listUsers(
    q?: string,
    status?: string,
    joinedWithin?: string,
    position?: string,
    pageParam?: number,
    pageSizeParam?: number,
  ) {
    const page = Math.max(1, Math.trunc(pageParam ?? 1) || 1);
    const pageSize = Math.min(
      MAX_USERS_PAGE_SIZE,
      Math.max(1, Math.trunc(pageSizeParam ?? DEFAULT_USERS_PAGE_SIZE) || DEFAULT_USERS_PAGE_SIZE),
    );
    const conditions = [];
    if (q) conditions.push(or(ilike(users.name, like(q)), ilike(users.email, like(q))));
    if (status) conditions.push(eq(users.suspended, status === 'suspended'));
    const joinedWithinDays = joinedWithin ? JOINED_WITHIN_DAYS[joinedWithin] : undefined;
    if (joinedWithinDays !== undefined) {
      conditions.push(gte(users.createdAt, new Date(Date.now() - joinedWithinDays * 86_400_000)));
    }
    // users.position is free text ("프론트엔드 개발자" etc.), so match the badge as a substring.
    if (position) conditions.push(ilike(users.position, like(position)));
    const where = conditions.length ? and(...conditions) : undefined;
    // id를 보조 정렬키로 둬 createdAt이 같은 행도 페이지 사이에서 중복·누락되지 않게 한다.
    const [rows, [totalRow]] = await Promise.all([
      this.db
        .select()
        .from(users)
        .where(where)
        .orderBy(desc(users.createdAt), desc(users.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db.select({ count: countRows }).from(users).where(where),
    ]);

    const countByUser = await this.countReportsAgainst(rows.map((row) => row.id));
    return {
      items: rows.map((row) => this.toAdminUser(row, countByUser.get(row.id) ?? 0)),
      total: totalRow?.count ?? 0,
      page,
      pageSize,
    };
  }

  async suspendUser(id: string, dto: SuspendUserDto) {
    const [target] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!target) throw new NotFoundException('사용자를 찾을 수 없습니다.');
    // 관리자(자기 자신 포함)를 정지하면 JwtAuthGuard가 즉시 차단해 콘솔이 복구 불가가 된다.
    if (dto.suspended && target.role === 'admin') {
      throw new ForbiddenException('관리자 계정은 정지할 수 없습니다.');
    }

    const [user] = await this.db
      .update(users)
      .set(
        dto.suspended
          ? { suspended: true, suspendedReason: dto.reason ?? null, suspendedAt: new Date() }
          : { suspended: false, suspendedReason: null, suspendedAt: null },
      )
      .where(eq(users.id, id))
      .returning();
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');

    const countByUser = await this.countReportsAgainst([user.id]);
    return this.toAdminUser(user, countByUser.get(user.id) ?? 0);
  }

  /** "신고 누적" = reports filed against the user (reportedUserId), not by them. */
  private async countReportsAgainst(userIds: string[]) {
    if (!userIds.length) return new Map<string, number>();
    const rows = await this.db
      .select({ reportedUserId: reports.reportedUserId, count: countRows })
      .from(reports)
      .where(inArray(reports.reportedUserId, userIds))
      .groupBy(reports.reportedUserId);
    return new Map(
      rows
        .filter((row) => row.reportedUserId !== null)
        .map((row) => [row.reportedUserId as string, row.count]),
    );
  }

  private toAdminUser(row: typeof users.$inferSelect, reportCount: number) {
    return {
      id: row.id,
      name: row.name ?? '탈퇴한 사용자',
      email: row.email ? maskEmail(row.email) : '탈퇴한 사용자',
      position: row.position ?? '',
      reports: reportCount,
      status: row.suspended ? ('suspended' as const) : ('active' as const),
      suspendedReason: row.suspendedReason ?? null,
    };
  }

  // ------------------------------------------------------------------- reports

  async listReports(q?: string, status?: string, targetType?: string) {
    const conditions = [];
    if (q) {
      conditions.push(
        or(
          ilike(reports.content, like(q)),
          ilike(reports.summary, like(q)),
          ilike(reports.org, like(q)),
        ),
      );
    }
    if (status) conditions.push(eq(reports.status, status));
    if (targetType) conditions.push(eq(reports.targetType, targetType));
    const rows = await this.db
      .select()
      .from(reports)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(reports.createdAt));
    return rows.map((row) => this.toReport(row));
  }

  async resolveReport(id: string, dto: ResolveReportDto) {
    // 대기(open) 신고만 처리할 수 있다 — 이미 처리된 신고의 상태/처리일을 덮어쓰지 않는다.
    const [updated] = await this.db
      .update(reports)
      .set({
        status: dto.action === 'resolve' ? 'resolved' : 'dismissed',
        note: dto.note ?? null,
        resolvedAt: new Date(),
      })
      .where(and(eq(reports.id, id), eq(reports.status, 'open')))
      .returning();
    if (updated) return this.toReport(updated);
    const [existing] = await this.db
      .select({ id: reports.id })
      .from(reports)
      .where(eq(reports.id, id))
      .limit(1);
    if (!existing) throw new NotFoundException('Report not found');
    throw new ConflictException('Report is already processed');
  }

  // ------------------------------------------------------------------ contents

  async getContents(teamsLimitParam?: string, contestsLimitParam?: string) {
    const teamsLimit = clampContentsLimit(teamsLimitParam);
    const contestsLimit = clampContentsLimit(contestsLimitParam);

    const [teamsTotal] = await this.db.select({ count: countRows }).from(teams);
    const teamRows = await this.db
      .select({ team: teams, challengeTitle: challenges.title })
      .from(teams)
      .innerJoin(challenges, eq(teams.challengeId, challenges.id))
      .orderBy(desc(teams.createdAt))
      .limit(teamsLimit);

    const teamIds = teamRows.map((row) => row.team.id);
    const acceptedRows = teamIds.length
      ? await this.db
          .select({ teamId: teamMembers.teamId, role: teamMembers.role, count: countRows })
          .from(teamMembers)
          .where(and(inArray(teamMembers.teamId, teamIds), eq(teamMembers.status, 'accepted')))
          .groupBy(teamMembers.teamId, teamMembers.role)
      : [];
    const acceptedByTeam = new Map<string, Map<string, number>>();
    for (const row of acceptedRows) {
      const byRole = acceptedByTeam.get(row.teamId) ?? new Map<string, number>();
      byRole.set(row.role ?? '', row.count);
      acceptedByTeam.set(row.teamId, byRole);
    }

    const [contestsTotal] = await this.db.select({ count: countRows }).from(challenges);
    const contestRows = await this.db
      .select()
      .from(challenges)
      .orderBy(desc(challenges.createdAt))
      .limit(contestsLimit);
    const challengeIds = contestRows.map((row) => row.id);
    const teamCountRows = challengeIds.length
      ? await this.db
          .select({ challengeId: teams.challengeId, count: countRows })
          .from(teams)
          .where(inArray(teams.challengeId, challengeIds))
          .groupBy(teams.challengeId)
      : [];
    const teamCountByChallenge = new Map(teamCountRows.map((row) => [row.challengeId, row.count]));

    // "확인 필요" 도트 = 아직 처리되지 않은(open) 신고가 걸린 팀/챌린지.
    const flaggedIds = [...teamIds, ...challengeIds];
    const openReportRows = flaggedIds.length
      ? await this.db
          .select({ targetId: reports.targetId })
          .from(reports)
          .where(
            and(
              eq(reports.status, 'open'),
              inArray(reports.targetType, ['team', 'challenge']),
              inArray(reports.targetId, flaggedIds),
            ),
          )
      : [];
    const flagged = new Set(openReportRows.map((row) => row.targetId));

    const teamCards = teamRows.map(({ team, challengeTitle }) => {
      const acceptedByRole = acceptedByTeam.get(team.id) ?? new Map<string, number>();
      const accepted = [...acceptedByRole.values()].reduce((sum, count) => sum + count, 0);
      const openRoles = team.openRoles ?? [];
      const capacity = openRoles.reduce((sum, slot) => sum + slot.count, 0) + 1;
      // A role is complete once accepted members fill every slot opened for it.
      const isFilled = (slot: { role: string; count: number }) =>
        (acceptedByRole.get(slot.role) ?? 0) >= slot.count;
      return {
        id: team.id,
        name: team.title,
        challenge: challengeTitle,
        roles: openRoles.filter(isFilled).map((slot) => slot.role),
        otherRoles: openRoles.filter((slot) => !isFilled(slot)).map((slot) => slot.role),
        members: `${accepted}/${capacity}명 참여중`,
        unread: flagged.has(team.id),
      };
    });

    const now = Date.now();
    const contestCards = contestRows.map((challenge) => {
      const daysLeft = Math.max(0, Math.ceil((challenge.endDate.getTime() - now) / 86_400_000));
      return {
        id: challenge.id,
        title: challenge.title,
        category: challenge.category ?? '',
        dday: `D-${daysLeft}`,
        teams: `팀 모집 ${teamCountByChallenge.get(challenge.id) ?? 0}건`,
        unread: flagged.has(challenge.id),
      };
    });

    const reportRows = await this.db
      .select()
      .from(reports)
      .orderBy(desc(reports.createdAt))
      .limit(5);

    return {
      teams: teamCards,
      teamsTotal: teamsTotal?.count ?? 0,
      contests: contestCards,
      contestsTotal: contestsTotal?.count ?? 0,
      reports: reportRows.map((row) => this.toReport(row)),
    };
  }

  // --------------------------------------------------------------- analytics

  async getAnalytics(ad?: string) {
    const monthAgo = new Date(Date.now() - 30 * DAY_MS);
    const [userRow] = await this.db
      .select({ count: countRows })
      .from(users)
      .where(gte(users.createdAt, monthAgo));
    const [challengeRow] = await this.db
      .select({ count: countRows })
      .from(challenges)
      .where(gte(challenges.createdAt, monthAgo));
    // 결제 완료(paid + legacy done, billing-history.service.ts의 charged 정의와 동일) 행만
    // 대상으로 하고(취소/만료/미결제 제외), 부분환불(Toss PARTIAL_CANCELED)이
    // 반영된 refundedAmount를 뺀 순수익을 합산한다 — refundedAmount는
    // PaymentsService의 PARTIAL_CANCELED 재조회로 채워진다(payments.service.ts).
    const [revenueRow] = await this.db
      .select({
        total: sql<number>`coalesce(sum(${payments.amount} - ${payments.refundedAmount}), 0)::int`,
      })
      .from(payments)
      .where(inArray(payments.status, ['paid', 'done']));

    // 활동: 최근 6개월 월별 일반 사용자 신규 가입(users) / 신규 기업 가입(businesses).
    const buckets = timeBuckets('month', 6);
    const general = await this.countByMonth(
      users,
      users.createdAt,
      buckets,
      eq(users.role, 'user'),
    );
    const corp = await this.countByMonth(businesses, businesses.createdAt, buckets);

    const stats: AdminStatCard[] = [
      {
        label: '신규 가입자',
        value: String(userRow?.count ?? 0),
        meta: '최근 30일',
        dot: '#0877FF',
      },
      {
        label: '신규 챌린지',
        value: String(challengeRow?.count ?? 0),
        meta: '최근 30일',
        dot: '#22C55E',
      },
      {
        label: '플랫폼 수익',
        value: String(revenueRow?.total ?? 0),
        meta: '결제 완료 기준',
        dot: '#8B5CF6',
      },
    ];
    const base: AdminAnalytics = {
      stats,
      activity: {
        months: buckets.labels,
        general,
        corp,
        yMax: niceMax(Math.max(0, ...general, ...corp)),
      },
    };

    if (ad !== undefined && ad !== '') {
      base.adReport = await this.buildAdReport(ad);
    }
    return base;
  }

  private async countByMonth(
    table: typeof applications | typeof challenges | typeof users | typeof businesses,
    column: PgColumn,
    buckets: TimeBuckets,
    extra?: SQL,
  ) {
    const bucket = bucketKey('month', column);
    const rows = await this.db
      .select({ bucket, count: countRows })
      .from(table)
      .where(and(gte(column, buckets.since), extra))
      .groupBy(bucket);
    const byBucket = new Map(rows.map((row) => [row.bucket, row.count]));
    return buckets.keys.map((key) => byBucket.get(key) ?? 0);
  }

  /**
   * `?ad=` accepts the ad's uuid or its stable `ads.ad_number` serial — never a
   * list position, so reordering/deleting ads can't open another ad's report.
   */
  private async buildAdReport(adParam: string): Promise<AdminAdReport> {
    // ads.ad_number는 int4 serial이라 그 범위를 넘는 숫자는 DB 캐스트 전에 404로 막는다.
    const MAX_AD_NUMBER = 2_147_483_647;
    const adNumber = /^\d+$/.test(adParam) ? Number.parseInt(adParam, 10) : null;
    const condition =
      adNumber !== null && adNumber <= MAX_AD_NUMBER
        ? eq(ads.adNumber, adNumber)
        : UUID_PATTERN.test(adParam)
          ? eq(ads.id, adParam)
          : null;
    if (!condition) throw new NotFoundException('광고를 찾을 수 없습니다.');

    const [row] = await this.db
      .select({ ad: ads, organization: businesses.name })
      .from(ads)
      .innerJoin(businesses, eq(ads.businessId, businesses.id))
      .where(condition)
      .limit(1);
    if (!row) throw new NotFoundException('광고를 찾을 수 없습니다.');

    const report = await this.adsService.getReportForAdmin(row.ad.id);
    // 라벨은 "결제 완료 금액"이므로 예약가(paidAmount)가 아니라 실제 결제 순액을 쓴다.
    const [spend] = await this.db
      .select({
        total: sql<number>`coalesce(sum(${payments.amount} - ${payments.refundedAmount}), 0)::int`,
      })
      .from(payments)
      .innerJoin(orders, eq(payments.orderId, orders.id))
      .where(and(eq(orders.adId, row.ad.id), inArray(payments.status, ['paid', 'done'])));
    return {
      adId: row.ad.id,
      adNumber: row.ad.adNumber,
      organization: row.organization ?? '',
      period: `${formatMonthDayShort(row.ad.startDate)}~${formatMonthDayShort(row.ad.endDate)}`,
      stats: [
        {
          label: '노출수',
          value: String(report.totals.impressions),
          meta: '최근 31일 계측값',
          dot: '#0877FF',
        },
        {
          label: '클릭수',
          value: String(report.totals.clicks),
          meta: '최근 31일 계측값',
          dot: '#22C55E',
        },
        { label: 'CTR', value: `${report.totals.ctr}%`, meta: '최근 31일 계측값', dot: '#F59E0B' },
        {
          label: '집행 광고비',
          value: String(spend?.total ?? 0),
          meta: '결제 완료 금액',
          dot: '#8B5CF6',
        },
      ] satisfies AdminStatCard[],
      daily: report.daily,
    };
  }

  // ------------------------------------------------------------------ settings

  async getSettings(user: AuthenticatedUser) {
    return {
      profile: {
        name: user.name,
        role: ADMIN_ROLE_LABELS[user.role] ?? user.role,
        email: user.email,
        // TODO: 관리자 2단계 인증은 미구현 — 도입 시 users에 TOTP 시크릿/활성 플래그를 추가한다.
        // https://datatracker.ietf.org/doc/html/rfc6238
        twoFactorEnabled: false,
      },
      ...(await this.adminSettingsService.get()),
    };
  }

  async updateSettings(values: Record<string, unknown>, user: AuthenticatedUser) {
    await this.adminSettingsService.update(values ?? {});
    return this.getSettings(user);
  }

  // ------------------------------------------------------------------ helpers

  /** Contract Report shape: reporter is the masked name; reportedAt = createdAt. */
  private toReport(row: ReportRow) {
    return {
      id: row.id,
      content: row.content,
      targetType: row.targetType,
      org: row.org,
      summary: row.summary,
      detail: row.detail,
      reporter: row.reporterName,
      reportedAt: row.createdAt,
      status: row.status,
    };
  }
}
