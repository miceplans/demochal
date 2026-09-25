import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, gte, ilike, inArray, or, sql } from 'drizzle-orm';
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

    // TODO: 페이지뷰 계측이 없어 '유저 트래픽'은 기간별 신규 가입(일반 user / 비즈니스
    // business)으로 대신한다. 방문 계측을 도입하면 이 시리즈를 교체한다.
    const userBucket = bucketKey(unit, users.createdAt);
    const signupRows = await this.db
      .select({ bucket: userBucket, role: users.role, count: countRows })
      .from(users)
      .where(and(gte(users.createdAt, buckets.since), inArray(users.role, ['user', 'business'])))
      .groupBy(userBucket, users.role);
    const signupsOf = (role: string) => {
      const byBucket = new Map(
        signupRows.filter((row) => row.role === role).map((row) => [row.bucket, row.count]),
      );
      return buckets.keys.map((key) => byBucket.get(key) ?? 0);
    };

    // 광고 비율: 같은 기간 결제 완료 매출 중 광고 주문(orders.adId)에서 나온 순매출 비중.
    const [revenueRow] = await this.db
      .select({
        total: sql<number>`coalesce(sum(${payments.amount} - ${payments.refundedAmount}), 0)::int`,
        ad: sql<number>`coalesce(sum(${payments.amount} - ${payments.refundedAmount}) filter (where ${orders.adId} is not null), 0)::int`,
      })
      .from(payments)
      .innerJoin(orders, eq(payments.orderId, orders.id))
      .where(and(eq(payments.status, 'paid'), gte(payments.approvedAt, buckets.since)));
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
        primary: signupsOf('user'),
        secondary: signupsOf('business'),
      },
      reports: recentReports.map((row) => this.toReport(row)),
      generatedAt: now.toISOString(),
    };
  }

  // --------------------------------------------------------------- businesses

  async listBusinesses(q?: string, type?: string, status?: string) {
    void type; // BizReviewEntry.type is a hardcoded '기업' — no column to filter on.

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
        type: business.type ?? '기업',
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

  async listCertificates(status?: string, q?: string) {
    const conditions = [];
    if (status) conditions.push(eq(certificates.status, status));
    if (q) {
      conditions.push(or(ilike(certificates.title, `%${q}%`), ilike(users.name, `%${q}%`)));
    }
    const rows = await this.db
      .select({ certificate: certificates, userName: users.name })
      .from(certificates)
      .innerJoin(users, eq(certificates.userId, users.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(certificates.createdAt));

    return rows.map(({ certificate, userName }) => ({
      id: certificate.id,
      user: userName,
      award: certificate.title,
      category: certificate.category,
      fileId: certificate.fileId,
      status: certificate.status,
    }));
  }

  async verifyCertificate(id: string, dto: VerifyCertificateDto) {
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
        rejectionReason: dto.action === 'reject' ? (dto.reason ?? null) : null,
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

  async listUsers(q?: string, status?: string) {
    const conditions = [];
    if (q) conditions.push(or(ilike(users.name, `%${q}%`), ilike(users.email, `%${q}%`)));
    if (status) conditions.push(eq(users.suspended, status === 'suspended'));
    const rows = await this.db
      .select()
      .from(users)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(users.createdAt));

    // reports has no per-target-user link, so "신고 누적" counts the reports
    // the user filed (reporterUserId), not reports filed against them.
    const filedCounts = await this.db
      .select({ reporterUserId: reports.reporterUserId, count: countRows })
      .from(reports)
      .groupBy(reports.reporterUserId);
    const countByUser = new Map(
      filedCounts
        .filter((row) => row.reporterUserId !== null)
        .map((row) => [row.reporterUserId as string, row.count]),
    );

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: maskEmail(row.email),
      position: row.position ?? '',
      reports: countByUser.get(row.id) ?? 0,
      status: row.suspended ? ('suspended' as const) : ('active' as const),
    }));
  }

  async suspendUser(id: string, dto: SuspendUserDto) {
    await this.db
      .update(users)
      .set(
        dto.suspended
          ? { suspended: true, suspendedReason: dto.reason ?? null, suspendedAt: new Date() }
          : { suspended: false, suspendedReason: null, suspendedAt: null },
      )
      .where(eq(users.id, id));

    const [user] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!user) throw new NotFoundException('User not found');
    const [filedCount] = await this.db
      .select({ count: countRows })
      .from(reports)
      .where(eq(reports.reporterUserId, id));

    return {
      id: user.id,
      name: user.name,
      email: maskEmail(user.email),
      position: user.position ?? '',
      reports: filedCount?.count ?? 0,
      status: user.suspended ? ('suspended' as const) : ('active' as const),
    };
  }

  // ------------------------------------------------------------------- reports

  async listReports(q?: string, status?: string) {
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

  async getContents() {
    const teamRows = await this.db
      .select({ team: teams, challengeTitle: challenges.title })
      .from(teams)
      .innerJoin(challenges, eq(teams.challengeId, challenges.id))
      .orderBy(desc(teams.createdAt))
      .limit(5);

    const teamIds = teamRows.map((row) => row.team.id);
    const acceptedRows = teamIds.length
      ? await this.db
          .select({ teamId: teamMembers.teamId, count: countRows })
          .from(teamMembers)
          .where(and(inArray(teamMembers.teamId, teamIds), eq(teamMembers.status, 'accepted')))
          .groupBy(teamMembers.teamId)
      : [];
    const acceptedByTeam = new Map(acceptedRows.map((row) => [row.teamId, row.count]));

    const teamCards = teamRows.map(({ team, challengeTitle }) => {
      const capacity = team.openRoles
        ? team.openRoles.reduce((sum, slot) => sum + slot.count, 0) + 1
        : '?';
      const accepted = acceptedByTeam.get(team.id) ?? 0;
      return {
        id: team.id,
        name: team.title,
        challenge: challengeTitle,
        // completed-role badges have no reliable signal yet — always empty.
        roles: [] as string[],
        otherRoles: team.openRoles?.map((slot) => slot.role) ?? [],
        members: `${accepted}/${capacity}명 참여중`,
        unread: false,
      };
    });

    const contestRows = await this.db
      .select()
      .from(challenges)
      .orderBy(desc(challenges.createdAt))
      .limit(5);
    const challengeIds = contestRows.map((row) => row.id);
    const teamCountRows = challengeIds.length
      ? await this.db
          .select({ challengeId: teams.challengeId, count: countRows })
          .from(teams)
          .where(inArray(teams.challengeId, challengeIds))
          .groupBy(teams.challengeId)
      : [];
    const teamCountByChallenge = new Map(teamCountRows.map((row) => [row.challengeId, row.count]));

    const now = Date.now();
    const contestCards = contestRows.map((challenge) => {
      const daysLeft = Math.max(0, Math.ceil((challenge.endDate.getTime() - now) / 86_400_000));
      return {
        id: challenge.id,
        title: challenge.title,
        category: challenge.category ?? '',
        dday: `D-${daysLeft}`,
        teams: `팀 모집 ${teamCountByChallenge.get(challenge.id) ?? 0}건`,
        unread: false,
      };
    });

    const reportRows = await this.db
      .select()
      .from(reports)
      .orderBy(desc(reports.createdAt))
      .limit(5);

    return {
      teams: teamCards,
      contests: contestCards,
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
    // 'paid' 행만 대상으로 하고(취소/만료/미결제 제외), 부분환불(Toss PARTIAL_CANCELED)이
    // 반영된 refundedAmount를 뺀 순수익을 합산한다 — refundedAmount는
    // PaymentsService의 PARTIAL_CANCELED 재조회로 채워진다(payments.service.ts).
    const [revenueRow] = await this.db
      .select({
        total: sql<number>`coalesce(sum(${payments.amount} - ${payments.refundedAmount}), 0)::int`,
      })
      .from(payments)
      .where(eq(payments.status, 'paid'));

    // 활동: 최근 6개월 월별 일반 사용자 지원서 제출(applications) / 기업 챌린지 등록(challenges).
    const buckets = timeBuckets('month', 6);
    const general = await this.countByMonth(applications, applications.createdAt, buckets);
    const corp = await this.countByMonth(challenges, challenges.createdAt, buckets);

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
    table: typeof applications | typeof challenges,
    column: PgColumn,
    buckets: TimeBuckets,
  ) {
    const bucket = bucketKey('month', column);
    const rows = await this.db
      .select({ bucket, count: countRows })
      .from(table)
      .where(gte(column, buckets.since))
      .groupBy(bucket);
    const byBucket = new Map(rows.map((row) => [row.bucket, row.count]));
    return buckets.keys.map((key) => byBucket.get(key) ?? 0);
  }

  /**
   * `?ad=` accepts the ad's uuid or its stable `ads.ad_number` serial — never a
   * list position, so reordering/deleting ads can't open another ad's report.
   */
  private async buildAdReport(adParam: string): Promise<AdminAdReport> {
    const condition = /^\d+$/.test(adParam)
      ? eq(ads.adNumber, Number.parseInt(adParam, 10))
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
        role: 'Super Admin',
        email: user.email,
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
