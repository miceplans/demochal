import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, count, eq, gte, lt } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { ads, applications, businesses, challenges, users } from '../../db/schema.js';
import { AdsService } from '../ads/ads.service.js';
import { formatCount, formatShortDate, formatWon } from './admin-format.util.js';
import { AdminReportsService } from './admin-reports.service.js';

const AD_SLOT_COUNT = 3; // hero | gallery | team — see ad_products seed in drizzle/0004_ads.sql.
const DAY_MS = 86_400_000;

@Injectable()
export class AdminAnalyticsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly adsService: AdsService,
    private readonly adminReportsService: AdminReportsService,
  ) {}

  async getDashboard(range: '7days' | '30days' | '1year') {
    const [approvedBusinesses, publishedChallenges, totalApplications, newUsers] =
      await Promise.all([
        this.db.select({ value: count() }).from(businesses).where(eq(businesses.verificationStatus, 'approved')).then(firstCount),
        this.db.select({ value: count() }).from(challenges).where(eq(challenges.status, 'published')).then(firstCount),
        this.db.select({ value: count() }).from(applications).then(firstCount),
        this.db
          .select({ value: count() })
          .from(users)
          .where(gte(users.createdAt, new Date(Date.now() - 7 * DAY_MS)))
          .then(firstCount),
      ]);

    const stats = [
      { label: '승인된 기관', value: formatCount(approvedBusinesses), meta: null, dot: '#0877FF' },
      { label: '진행 중 챌린지', value: formatCount(publishedChallenges), meta: null, dot: '#22C55E' },
      { label: '누적 제출물', value: formatCount(totalApplications), meta: null, dot: '#8B5CF6' },
      { label: '신규 가입자', value: formatCount(newUsers), meta: '최근 7일', dot: '#F59E0B' },
    ];

    const activeAds = await this.db.select().from(ads).where(eq(ads.status, 'active'));
    const totalPaid = activeAds.reduce((sum, ad) => sum + ad.paidAmount, 0);
    // "유저 광고 비율" is ambiguous in the spec (no numeric relationship is named) — read here as
    // ad-slot occupancy (active ads / the 3 fixed placements), a real, defensible ratio.
    const adRatio = {
      value: `${totalPaid.toLocaleString('ko-KR')} ₩`,
      ratio: Math.min(1, activeAds.length / AD_SLOT_COUNT),
    };

    const traffic = await this.getTrafficSeries(range);
    const reports = await this.adminReportsService.list({});

    return { stats, adRatio, traffic, reports };
  }

  async getAnalytics(adNumber?: number, from?: string, to?: string) {
    const adReport = adNumber ? await this.getAdReport(adNumber) : null;

    const start = from ? new Date(from) : new Date(Date.now() - 30 * DAY_MS);
    const end = to ? new Date(to) : new Date();

    const [newUsers, newChallenges, revenue] = await Promise.all([
      this.db
        .select({ value: count() })
        .from(users)
        .where(and(gte(users.createdAt, start), lt(users.createdAt, end)))
        .then(firstCount),
      this.db
        .select({ value: count() })
        .from(challenges)
        .where(and(gte(challenges.createdAt, start), lt(challenges.createdAt, end)))
        .then(firstCount),
      this.sumPaidAdAmount(start, end),
    ]);

    const stats = [
      { label: '신규 가입자', value: formatCount(newUsers), meta: null, dot: '#0877FF' },
      { label: '신규 챌린지', value: formatCount(newChallenges), meta: null, dot: '#22C55E' },
      { label: '플랫폼 수익', value: formatWon(revenue), meta: null, dot: '#8B5CF6' },
    ];

    const activity = await this.getActivityChart();

    return { adReport, stats, activity };
  }

  private async getAdReport(adNumber: number) {
    const [ad] = await this.db.select().from(ads).where(eq(ads.adNumber, adNumber)).limit(1);
    if (!ad) throw new NotFoundException('Ad not found');
    const [business] = await this.db
      .select()
      .from(businesses)
      .where(eq(businesses.id, ad.businessId))
      .limit(1);

    const report = await this.adsService.getReportForAdmin(ad.id);
    return {
      adNumber: ad.adNumber,
      organization: business?.name ?? '',
      period: `${formatShortDate(ad.startDate)}~${formatShortDate(ad.endDate)}`,
      stats: [
        { label: '노출수', value: formatCount(report.totals.impressions), meta: null, dot: '#0877FF' },
        { label: '클릭수', value: formatCount(report.totals.clicks), meta: null, dot: '#22C55E' },
        { label: 'CTR', value: `${report.totals.ctr.toFixed(1)}%`, meta: null, dot: '#8B5CF6' },
        { label: '집행 광고비', value: formatWon(ad.paidAmount), meta: null, dot: '#F59E0B' },
      ],
      daily: report.daily,
    };
  }

  private async getTrafficSeries(range: '7days' | '30days' | '1year') {
    const buckets = range === '1year' ? 12 : range === '30days' ? 30 : 7;
    const now = new Date();
    const labels: string[] = [];
    const primary: number[] = [];
    const secondary: number[] = [];

    for (let i = buckets - 1; i >= 0; i -= 1) {
      const bucketStart =
        range === '1year'
          ? new Date(now.getFullYear(), now.getMonth() - i, 1)
          : new Date(now.getTime() - i * DAY_MS);
      const bucketEnd =
        range === '1year'
          ? new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
          : new Date(bucketStart.getTime() + DAY_MS);

      const [primaryCount, secondaryCount] = await Promise.all([
        this.countUsersByRole('user', bucketStart, bucketEnd),
        this.countUsersByRole('business', bucketStart, bucketEnd),
      ]);

      labels.push(range === '1year' ? `${bucketStart.getMonth() + 1}월` : formatShortDate(bucketStart));
      primary.push(primaryCount);
      secondary.push(secondaryCount);
    }

    return { labels, primary, secondary };
  }

  private async getActivityChart() {
    const now = new Date();
    const months: string[] = [];
    const general: number[] = [];
    const corp: number[] = [];

    for (let i = 5; i >= 0; i -= 1) {
      const bucketStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const bucketEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

      const [generalCount, corpCount] = await Promise.all([
        this.countUsersByRole('user', bucketStart, bucketEnd),
        this.countUsersByRole('business', bucketStart, bucketEnd),
      ]);

      months.push(`${bucketStart.getMonth() + 1}월`);
      general.push(generalCount);
      corp.push(corpCount);
    }

    const yMax = Math.max(2, Math.ceil(Math.max(...general, ...corp, 1) / 2) * 2);
    return { months, general, corp, yMax };
  }

  private async sumPaidAdAmount(start: Date, end: Date) {
    const rows = await this.db
      .select()
      .from(ads)
      .where(and(gte(ads.createdAt, start), lt(ads.createdAt, end)));
    return rows
      .filter((ad) => ad.status === 'active' || ad.status === 'ended')
      .reduce((sum, ad) => sum + ad.paidAmount, 0);
  }

  private async countUsersByRole(role: string, start: Date, end: Date): Promise<number> {
    const rows = await this.db
      .select({ value: count() })
      .from(users)
      .where(and(eq(users.role, role), gte(users.createdAt, start), lt(users.createdAt, end)));
    return Number(rows[0]?.value ?? 0);
  }
}

function firstCount(rows: { value: number }[]): number {
  return Number(rows[0]?.value ?? 0);
}
