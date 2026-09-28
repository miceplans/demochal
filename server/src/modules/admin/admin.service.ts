import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, gte, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
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
  adminSettings,
  type reports as reportsTable,
} from '../../db/schema.js';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { ADMIN_SETTINGS_ID, DEFAULT_VALUES } from './admin-settings.service.js';
import { FilesService } from '../files/files.service.js';
import { buildPublicFileUrl } from '../files/public-file-url.js';
import { AdsService } from '../ads/ads.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { AdPricingSlotDto } from './dto/update-ad-pricing.dto.js';
import type { CreateCertificateDto } from './dto/create-certificate.dto.js';
import type { CreateReportDto } from './dto/create-report.dto.js';
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

const DAY_MS = 86_400_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type BucketUnit = 'day' | 'month';
interface TimeBuckets {
  unit: BucketUnit;
  since: Date;
  keys: string[];
  labels: string[];
}

const toDateKey = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Consecutive UTC day/month buckets ending at `now` (inclusive). Keys match
 * {@link bucketKey}'s `YYYY-MM-DD` output so SQL group-by rows can be joined back.
 */
export function timeBuckets(unit: BucketUnit, count: number, now = new Date()): TimeBuckets {
  const starts = Array.from({ length: count }, (_, i) => {
    const offset = count - 1 - i;
    return unit === 'day'
      ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offset))
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
  });
  return {
    unit,
    since: starts[0]!,
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

/** `YYYY-MM-DD` of the day/month a timestamp falls in (timestamps are stored as UTC). */
function bucketKey(unit: BucketUnit, column: PgColumn) {
  return sql<string>`to_char(date_trunc(${sql.raw(`'${unit}'`)}, ${column}), 'YYYY-MM-DD')`;
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

/** '김수아' → '김*아', two-char names '김아' → '김*'. */
export function maskReporterName(name: string): string {
  if (name.length <= 1) return name;
  if (name.length === 2) return `${name.charAt(0)}*`;
  return `${name.charAt(0)}*${name.charAt(name.length - 1)}`;
}

/** '123-45-67890' → '123-45-*****' (keep the first two digit groups, trailing dash included). */
export function maskBizNumber(registrationNumber: string): string {
  return `${registrationNumber.slice(0, 7)}*****`;
}

const formatMonthDay = (date: Date) =>
  `${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;

const formatMonthDayShort = (date: Date) => `${date.getMonth() + 1}/${date.getDate()}`;

// Settings metadata is static copy (Korean labels/descriptions from the
// design spec); only the boolean values are persisted.
const SETTINGS_GROUPS = [
  {
    title: '서비스 설정',
    rows: [
      {
        key: 'bizAutoApprove',
        label: '기관 가입 자동 승인',
        description: '제출 서류 심사 없이 기관 가입 신청을 즉시 승인합니다.',
      },
      {
        key: 'contestAutoPublish',
        label: '공고 자동 게시',
        description: '기관이 등록한 공고를 검수 없이 바로 게시합니다.',
      },
      {
        key: 'maintenanceMode',
        label: '점검 모드',
        description: '접속자에게 점검 안내를 표시하고 서비스를 일시 중단합니다.',
      },
    ],
  },
  {
    title: '알림 설정',
    rows: [
      {
        key: 'reportAlert',
        label: '신고 접수 알림',
        description: '신고가 접수되면 관리자에게 즉시 알림을 볩니다.',
      },
      {
        key: 'newBusinessAlert',
        label: '신규 기관 가입 알림',
        description: '신규 기관 가입 신청이 들어오면 관리자에게 알림을 볩니다.',
      },
    ],
  },
];

@Injectable()
export class AdminService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly notificationsService: NotificationsService,
    private readonly adsService: AdsService,
    private readonly filesService: FilesService,
  ) {}

  // ---------------------------------------------------------------- dashboard

  async getDashboard(range?: string) {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * DAY_MS);

    const [approvedBiz] = await this.db
      .select({ count: countRows })
      .from(businesses)
      .where(eq(businesses.verificationStatus, 'approved'));
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
      .where(eq(businesses.verificationStatus, 'approved'));
    const [rejectedRow] = await this.db
      .select({ count: countRows })
      .from(businesses)
      .where(eq(businesses.verificationStatus, 'rejected'));
    const [pendingRow] = await this.db
      .select({ count: countRows })
      .from(businesses)
      .where(eq(businesses.verificationStatus, 'pending'));

    const conditions = [];
    if (q) conditions.push(ilike(businesses.name, `%${q}%`));
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
          : businessVerifications.some(
                (row) => row.status === 'approved' || row.status === 'verified',
              )
            ? 'success'
            : businessVerifications.some((row) => row.status === 'rejected')
              ? 'failed'
              : 'unrecognized';
      const appliedAt = latest?.createdAt ?? business.createdAt;
      return {
        id: business.id,
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
    return this.setVerificationResult(id, 'approved', null);
  }

  async rejectVerification(id: string, reason: string) {
    return this.setVerificationResult(id, 'rejected', reason);
  }

  private async setVerificationResult(
    id: string,
    status: 'approved' | 'rejected',
    reason: string | null,
  ) {
    const [verification] = await this.db
      .select()
      .from(verifications)
      .where(eq(verifications.id, id))
      .limit(1);
    if (!verification) throw new NotFoundException('Verification not found');

    const [updated] = await this.db
      .update(verifications)
      .set({
        status,
        rejectionReason: status === 'rejected' ? reason : null,
        updatedAt: new Date(),
      })
      .where(eq(verifications.id, id))
      .returning();

    const [business] = await this.db
      .select()
      .from(businesses)
      .where(eq(businesses.id, verification.businessId))
      .limit(1);
    if (business) {
      await this.db
        .update(businesses)
        .set({ verificationStatus: status })
        .where(eq(businesses.id, business.id));
      await this.notificationsService.create(business.ownerUserId, 'verification.result', {
        verificationId: id,
        status,
      });
    }

    return updated;
  }

  // ------------------------------------------------------------- certificates

  async listCertificates(status?: string, q?: string, category?: string) {
    const conditions = [];
    if (status) conditions.push(eq(certificates.status, status));
    if (category) conditions.push(eq(certificates.category, category));
    if (q) {
      conditions.push(or(ilike(certificates.title, `%${q}%`), ilike(users.name, `%${q}%`)));
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
    if (!certificate) throw new NotFoundException('Certificate not found');

    const status = dto.action === 'approve' ? 'verified' : 'rejected';
    const [updated] = await this.db
      .update(certificates)
      .set({
        status,
        rejectionReason: dto.action === 'reject' ? (reason ?? null) : null,
      })
      .where(eq(certificates.id, id))
      .returning();

    const [owner] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, certificate.userId))
      .limit(1);

    if (dto.action === 'approve' && owner) {
      const badges = owner.badges ?? [];
      if (!badges.includes(certificate.title)) {
        await this.db
          .update(users)
          .set({ badges: [...badges, certificate.title] })
          .where(eq(users.id, owner.id));
      }
    }

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

  async listAds(q?: string, status?: string) {
    const conditions = [];
    if (q) conditions.push(or(ilike(ads.title, `%${q}%`), ilike(businesses.name, `%${q}%`)));
    if (status) conditions.push(eq(ads.status, status));
    const rows = await this.db
      .select({ ad: ads, organization: businesses.name, productName: adProducts.name })
      .from(ads)
      .innerJoin(businesses, eq(ads.businessId, businesses.id))
      .innerJoin(adProducts, eq(ads.productId, adProducts.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(ads.createdAt));

    return rows.map(({ ad, organization, productName }) => ({ ...ad, organization, productName }));
  }

  async getAdPricing() {
    const products = await this.db.select().from(adProducts).orderBy(asc(adProducts.createdAt));
    const result = [];
    for (const product of products) {
      const [current] = await this.db
        .select({ ad: ads, organization: businesses.name })
        .from(ads)
        .innerJoin(businesses, eq(ads.businessId, businesses.id))
        .where(and(eq(ads.productId, product.id), eq(ads.status, 'active')))
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
        throw new BadRequestException(`Unknown ad slot: ${item.slot}`);
      }
    }
    for (const item of items) {
      await this.db
        .update(adProducts)
        .set({ dailyPrice: item.dailyPrice })
        .where(eq(adProducts.placement, item.slot));
    }
    return this.getAdPricing();
  }

  // --------------------------------------------------------------------- users

  async listUsers(q?: string, status?: string, joinedWithin?: string, position?: string) {
    const conditions = [];
    if (q) conditions.push(or(ilike(users.name, `%${q}%`), ilike(users.email, `%${q}%`)));
    if (status) conditions.push(eq(users.suspended, status === 'suspended'));
    const joinedWithinDays = joinedWithin ? JOINED_WITHIN_DAYS[joinedWithin] : undefined;
    if (joinedWithinDays !== undefined) {
      conditions.push(gte(users.createdAt, new Date(Date.now() - joinedWithinDays * 86_400_000)));
    }
    // users.position is free text ("프론트엔드 개발자" etc.), so match the badge as a substring.
    if (position) conditions.push(ilike(users.position, `%${position}%`));
    const rows = await this.db
      .select()
      .from(users)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(users.createdAt));

    const countByUser = await this.countReportsAgainst(rows.map((row) => row.id));
    return rows.map((row) => this.toAdminUser(row, countByUser.get(row.id) ?? 0));
  }

  async suspendUser(id: string, dto: SuspendUserDto) {
    const [user] = await this.db
      .update(users)
      .set(
        dto.suspended
          ? { suspended: true, suspendedReason: dto.reason ?? null, suspendedAt: new Date() }
          : { suspended: false, suspendedReason: null, suspendedAt: null },
      )
      .where(eq(users.id, id))
      .returning();
    if (!user) throw new NotFoundException('User not found');

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
          ilike(reports.content, `%${q}%`),
          ilike(reports.summary, `%${q}%`),
          ilike(reports.org, `%${q}%`),
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
    const [updated] = await this.db
      .update(reports)
      .set({
        status: dto.action === 'resolve' ? 'resolved' : 'dismissed',
        note: dto.note ?? null,
        resolvedAt: new Date(),
      })
      .where(eq(reports.id, id))
      .returning();
    if (!updated) throw new NotFoundException('Report not found');
    return this.toReport(updated);
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
    if (!condition) throw new NotFoundException('Ad not found');

    const [row] = await this.db
      .select({ ad: ads, organization: businesses.name })
      .from(ads)
      .innerJoin(businesses, eq(ads.businessId, businesses.id))
      .where(condition)
      .limit(1);
    if (!row) throw new NotFoundException('Ad not found');

    const report = await this.adsService.getReportForAdmin(row.ad.id);
    return {
      adId: row.ad.id,
      adNumber: row.ad.adNumber,
      organization: row.organization ?? '',
      period: `${formatMonthDayShort(row.ad.startDate)}~${formatMonthDayShort(row.ad.endDate)}`,
      stats: [
        {
          label: '노출수',
          value: String(report.totals.impressions),
          meta: '누적 계측값',
          dot: '#0877FF',
        },
        {
          label: '클릭수',
          value: String(report.totals.clicks),
          meta: '누적 계측값',
          dot: '#22C55E',
        },
        { label: 'CTR', value: `${report.totals.ctr}%`, meta: '누적 계측값', dot: '#F59E0B' },
        {
          label: '집행 광고비',
          value: String(row.ad.paidAmount),
          meta: '결제 완료 금액',
          dot: '#8B5CF6',
        },
      ] satisfies AdminStatCard[],
      daily: report.daily,
    };
  }

  // ------------------------------------------------------------------ settings

  async getSettings(user: AuthenticatedUser) {
    const [row] = await this.db
      .select()
      .from(adminSettings)
      .where(eq(adminSettings.id, ADMIN_SETTINGS_ID))
      .limit(1);
    return {
      profile: {
        name: user.name,
        role: ADMIN_ROLE_LABELS[user.role] ?? user.role,
        email: user.email,
        // TODO: 관리자 2단계 인증은 미구현 — 도입 시 users에 TOTP 시크릿/활성 플래그를 추가한다.
        // https://datatracker.ietf.org/doc/html/rfc6238
        twoFactorEnabled: false,
      },
      groups: SETTINGS_GROUPS,
      values: { ...DEFAULT_VALUES, ...(row?.values ?? {}) },
    };
  }

  async updateSettings(values: Record<string, boolean>, user: AuthenticatedUser) {
    // The body is a free-form key→boolean map; drop anything that isn't a boolean.
    const clean = Object.fromEntries(
      Object.entries(values ?? {}).filter(([, value]) => typeof value === 'boolean'),
    ) as Record<string, boolean>;

    const [existing] = await this.db
      .select()
      .from(adminSettings)
      .where(eq(adminSettings.id, ADMIN_SETTINGS_ID))
      .limit(1);
    if (existing) {
      await this.db
        .update(adminSettings)
        .set({ values: { ...existing.values, ...clean }, updatedAt: new Date() })
        .where(eq(adminSettings.id, ADMIN_SETTINGS_ID));
    } else {
      await this.db.insert(adminSettings).values({ id: ADMIN_SETTINGS_ID, values: clean });
    }
    return this.getSettings(user);
  }

  // -------------------------------------------------------- user-facing writes

  async createCertificate(dto: CreateCertificateDto, user: AuthenticatedUser) {
    const [row] = await this.db
      .insert(certificates)
      .values({
        userId: user.id,
        title: dto.title,
        category: dto.category,
        fileId: dto.fileId,
        status: 'pending',
      })
      .returning();
    return row;
  }

  async createReport(dto: CreateReportDto, user: AuthenticatedUser) {
    const [row] = await this.db
      .insert(reports)
      .values({
        content: dto.content,
        targetType: dto.targetType,
        org: dto.org,
        summary: dto.summary,
        detail: dto.detail,
        reporterUserId: user.id,
        reporterName: maskReporterName(user.name),
      })
      .returning();
    return this.toReport(row!);
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
