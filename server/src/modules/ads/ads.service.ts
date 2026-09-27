import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { and, desc, eq, gt, gte, inArray, lt, or, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { adEventCounters, adProducts, ads, files, orders } from '../../db/schema.js';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { BusinessesService } from '../businesses/businesses.service.js';
import { buildPublicFileUrl } from '../files/public-file-url.js';
import type { CreateAdDto } from './dto/create-ad.dto.js';
import type { AdReportQueryDto } from './dto/ad-report-query.dto.js';
import type { UpdateAdDto } from './dto/update-ad.dto.js';
import type { RecordAdEventDto } from './dto/record-ad-event.dto.js';

// Unpaid ('preparing') reservations stop blocking a placement's dates this
// long after creation, so an abandoned checkout can't lock inventory forever.
const PREPARING_TTL_MS = 30 * 60 * 1000;

// Seeded once so the biz console has something to reserve until an admin
// product-management screen exists (tracked separately, out of scope here).
const DEFAULT_PRODUCTS = [
  {
    id: 'hero',
    name: '홈 히어로 배너',
    placement: 'hero',
    dailyPrice: 100_000,
    description: '홈 화면 최상단 히어로 배너 노출',
  },
  {
    id: 'gallery',
    name: '갤러리 노출',
    placement: 'gallery',
    dailyPrice: 50_000,
    description: '홈 화면 갤러리 영역 노출',
  },
  {
    id: 'team',
    name: '팀 모집 홍보',
    placement: 'team',
    dailyPrice: 30_000,
    description: '팀원 모집 영역 홍보',
  },
];

const SEOUL_TIME_ZONE = 'Asia/Seoul';
const EVENT_WINDOW_MS = 60_000;
const MAX_EVENTS_PER_WINDOW = 120;

@Injectable()
export class AdsService implements OnModuleInit {
  private readonly recentEventIds = new Map<string, number>();
  private readonly eventWindowStarts = new Map<string, { startedAt: number; count: number }>();

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly businessesService: BusinessesService,
  ) {}

  async onModuleInit() {
    // placement has a unique constraint, so concurrent boots racing this
    // insert converge on one row per placement instead of duplicating rows.
    await this.db.insert(adProducts).values(DEFAULT_PRODUCTS).onConflictDoNothing({
      target: adProducts.placement,
    });
  }

  async listProducts() {
    const products = await this.db.select().from(adProducts);
    const reserving = await this.db.select().from(ads).where(this.reservingCondition());

    return products.map((product) => ({
      ...product,
      reservedPeriods: reserving
        .filter((ad) => ad.productId === product.id)
        .map((ad) => ({
          startDate: ad.startDate.toISOString(),
          endDate: ad.endDate.toISOString(),
        })),
    }));
  }

  async listMine(businessId: string, status?: string) {
    if (!businessId) return [];
    const conditions = [eq(ads.businessId, businessId)];
    if (status) conditions.push(eq(ads.status, status));
    const rows = await this.db
      .select()
      .from(ads)
      .where(and(...conditions))
      .orderBy(desc(ads.createdAt));
    return this.withImageUrls(rows);
  }

  // Promoted ad creatives live in the public bucket; resolve imageFileId to a
  // ready CloudFront URL here instead of making every caller (frontend, admin)
  // know the bucket/CDN layout. Batched to avoid one query per ad.
  private async withImageUrls<T extends { imageFileId: string | null }>(
    rows: T[],
  ): Promise<(T & { imageUrl: string | null })[]> {
    const fileIds = [
      ...new Set(rows.map((row) => row.imageFileId).filter((id): id is string => !!id)),
    ];
    if (fileIds.length === 0) return rows.map((row) => ({ ...row, imageUrl: null }));
    const imageFiles = await this.db.select().from(files).where(inArray(files.id, fileIds));
    const urlById = new Map(imageFiles.map((file) => [file.id, buildPublicFileUrl(file)]));
    return rows.map((row) => ({
      ...row,
      imageUrl: row.imageFileId ? (urlById.get(row.imageFileId) ?? null) : null,
    }));
  }

  async create(dto: CreateAdDto, businessId: string, userId: string) {
    if (!businessId) throw new UnauthorizedException('Business authentication is required');

    const ad = await this.db.transaction(async (tx) => {
      // Lock the product row so a second concurrent create() for the same
      // placement waits here instead of racing this transaction's overlap
      // check.
      const [product] = await tx
        .select()
        .from(adProducts)
        .where(eq(adProducts.id, dto.productId))
        .for('update')
        .limit(1);
      if (!product) throw new NotFoundException('Ad product not found');

      if (dto.expectedDailyPrice !== product.dailyPrice) {
        throw new ConflictException({
          message: 'Ad pricing has changed since this quote was shown; please re-confirm.',
          currentDailyPrice: product.dailyPrice,
        });
      }

      const startDate = new Date(dto.startDate);
      const endDate = new Date(dto.endDate);
      if (endDate < startDate) {
        throw new BadRequestException('endDate must not be before startDate');
      }

      const reserving = await tx
        .select()
        .from(ads)
        .where(and(eq(ads.productId, dto.productId), this.reservingCondition()));
      const hasOverlap = reserving.some((ad) => ad.startDate <= endDate && ad.endDate >= startDate);
      if (hasOverlap) {
        throw new BadRequestException(
          'Selected dates overlap an existing reservation for this placement',
        );
      }

      const days = Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
      const paidAmount = days * product.dailyPrice;

      const [ad] = await tx
        .insert(ads)
        .values({
          businessId,
          productId: dto.productId,
          title: dto.title ?? product.name,
          imageFileId: dto.imageFileId,
          landingUrl: dto.landingUrl,
          startDate,
          endDate,
          status: 'preparing',
          expiresAt: new Date(Date.now() + PREPARING_TTL_MS),
          paidAmount,
        })
        .returning();

      // Pending payment for this reservation; POST /payments/webhook/toss
      // settles it (OrdersService.markPaid flips the ad to active).
      await tx.insert(orders).values({ adId: ad!.id, userId, amount: paidAmount });

      return ad!;
    });
    return (await this.withImageUrls([ad]))[0]!;
  }

  async findById(id: string) {
    const [ad] = await this.db.select().from(ads).where(eq(ads.id, id)).limit(1);
    if (!ad) throw new NotFoundException('Ad not found');
    return ad;
  }

  async updateStatus(id: string, dto: UpdateAdDto, user: AuthenticatedUser) {
    const ad = await this.findById(id);
    const business = await this.businessesService.findByOwner(user.id);
    if (user.role !== 'admin' && (!business || business.id !== ad.businessId)) {
      throw new ForbiddenException('Only the owning business can change this ad');
    }
    // 결제 전 preparing 광고를 직접 active로 바꾸는 건 불가 — 활성화는 결제
    // 웹훅(OrdersService.markPaid)이 담당한다.
    if (dto.status === 'active' && ad.status === 'preparing') {
      throw new BadRequestException(
        'Unpaid ads cannot be activated directly; complete payment first',
      );
    }
    if (dto.status === 'paused' && ad.status !== 'active') {
      throw new BadRequestException('Only active ads can be paused');
    }
    if (dto.status === 'active') {
      return this.db.transaction(async (tx) => {
        // markCancelled locks this same order row. This makes cancellation and
        // reactivation serialize, so a refunded order cannot resume serving.
        const [order] = await tx.select().from(orders).where(eq(orders.adId, id)).for('update');
        if (!order || order.status !== 'paid') {
          throw new BadRequestException('Only ads with a paid order can be activated');
        }
        const [updated] = await tx
          .update(ads)
          .set({ status: dto.status })
          .where(eq(ads.id, id))
          .returning();
        return updated;
      });
    }
    const [updated] = await this.db
      .update(ads)
      .set({ status: dto.status })
      .where(eq(ads.id, id))
      .returning();
    return updated;
  }

  async report(id: string, query: AdReportQueryDto, user: AuthenticatedUser) {
    const ad = await this.findById(id);
    const business = await this.businessesService.findByOwner(user.id);
    if (user.role !== 'admin' && (!business || business.id !== ad.businessId)) {
      throw new ForbiddenException('Only the owning business can view this report');
    }

    const end = query.to ?? seoulDateString(new Date());
    let start = query.from ?? addDateString(end, -6);
    // 기간 상한 31일: 그 이상 요청되면 시작일을 당겨 맞춘다.
    if (diffDays(start, end) > 30) start = addDateString(end, -30);
    if (start > end) start = end;

    return this.buildReport(id, start, end);
  }

  async getReportForAdmin(id: string) {
    const ad = await this.findById(id);
    const rawStart = seoulDateString(ad.startDate);
    const end = seoulDateString(new Date(Math.min(ad.endDate.getTime(), Date.now())));
    // 관리자 리포트도 공개 리포트와 동일하게 최대 31일만 계산한다.
    const start =
      rawStart > end
        ? end
        : rawStart > addDateString(end, -30)
          ? rawStart
          : addDateString(end, -30);
    return this.buildReport(id, start, end);
  }

  async recordEvent(id: string, type: 'impressions' | 'clicks', dto: RecordAdEventDto) {
    const [ad] = await this.db
      .select({ id: ads.id, status: ads.status })
      .from(ads)
      .where(eq(ads.id, id))
      .limit(1);
    if (!ad || ad.status !== 'active') return { recorded: false };

    const now = Date.now();
    this.pruneRecentEventIds(now);
    if (dto.eventId) {
      const key = `${id}:${type}:${dto.eventId}`;
      if (this.recentEventIds.has(key)) return { recorded: false };
      this.recentEventIds.set(key, now + EVENT_WINDOW_MS);
    }
    const rateKey = `${id}:${type}`;
    const window = this.eventWindowStarts.get(rateKey);
    if (!window || now - window.startedAt >= EVENT_WINDOW_MS) {
      this.eventWindowStarts.set(rateKey, { startedAt: now, count: 1 });
    } else if (window.count >= MAX_EVENTS_PER_WINDOW) {
      return { recorded: false };
    } else {
      window.count += 1;
    }

    const bucketStart = hourBucket(new Date());
    const increment = type === 'impressions' ? { impressions: 1 } : { clicks: 1 };
    await this.db
      .insert(adEventCounters)
      .values({ adId: id, bucketStart, ...increment })
      .onConflictDoUpdate({
        target: [adEventCounters.adId, adEventCounters.bucketStart],
        set:
          type === 'impressions'
            ? { impressions: sql`${adEventCounters.impressions} + 1` }
            : { clicks: sql`${adEventCounters.clicks} + 1` },
      });
    return { recorded: true };
  }

  async monthlyExposureForBusiness(businessId: string) {
    const result = await this.db
      .select({
        bucketStart: adEventCounters.bucketStart,
        impressions: adEventCounters.impressions,
      })
      .from(adEventCounters)
      .innerJoin(ads, eq(adEventCounters.adId, ads.id))
      .where(eq(ads.businessId, businessId));
    const rows = Array.isArray(result) ? result : [];
    const byMonth = new Map<string, number>();
    for (const row of rows) {
      const month = seoulMonthKey(row.bucketStart);
      byMonth.set(month, (byMonth.get(month) ?? 0) + row.impressions);
    }
    return [...byMonth.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([month, value]) => ({ label: `${Number(month.slice(5))}월`, value }));
  }

  private async buildReport(id: string, start: string, end: string) {
    // 집계 시간대는 서비스 사업 기준인 Asia/Seoul이며, DB에는 UTC timestamp 버킷을 저장한다.
    const result = await this.db
      .select({
        bucketStart: adEventCounters.bucketStart,
        impressions: adEventCounters.impressions,
        clicks: adEventCounters.clicks,
      })
      .from(adEventCounters)
      .where(
        and(
          eq(adEventCounters.adId, id),
          gte(adEventCounters.bucketStart, seoulDate(start)),
          lt(adEventCounters.bucketStart, seoulDate(addDateString(end, 1))),
        ),
      );
    const rows = Array.isArray(result) ? result : [];
    const dailyMap = new Map<string, Metric>();
    const hourlyMap = new Map<number, Metric>();
    const monthlyMap = new Map<string, number>();
    for (const row of rows) {
      const date = seoulDateString(row.bucketStart);
      addMetric(dailyMap, date, row);
      const hour = seoulHour(row.bucketStart);
      addMetric(hourlyMap, hour, row);
      const month = date.slice(0, 7);
      monthlyMap.set(month, (monthlyMap.get(month) ?? 0) + row.clicks);
    }
    const daily = enumerateDateStrings(start, end).map((date) => ({
      date,
      ...withCtr(dailyMap.get(date) ?? emptyMetric()),
    }));
    const hourly = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      label: `${hour}시~${hour + 1}시`,
      ...metricRow(hourlyMap.get(hour)),
    }));
    const totals = daily.reduce((sum, row) => addMetric(sum, row), emptyMetric());
    return {
      totals: withCtr(totals),
      daily,
      hourly,
      monthlyClicks: [...monthlyMap.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([month, value]) => ({ label: `${Number(month.slice(5))}월`, value })),
    };
  }

  private pruneRecentEventIds(now: number) {
    for (const [key, expiresAt] of this.recentEventIds) {
      if (expiresAt <= now) this.recentEventIds.delete(key);
    }
  }

  // Rows that currently occupy a placement's calendar: paid/active ads, plus
  // preparing ads whose payment window hasn't expired yet.
  private reservingCondition() {
    return or(
      eq(ads.status, 'active'),
      and(eq(ads.status, 'preparing'), gt(ads.expiresAt, new Date())),
    );
  }
}

function parseDate(value: string) {
  return new Date(`${value}T00:00:00+09:00`);
}

function seoulDate(value: string | Date) {
  return typeof value === 'string' ? parseDate(value) : value;
}

function addDateString(date: string, days: number) {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function diffDays(start: string, end: string) {
  return Math.round(
    (new Date(`${end}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()) /
      86_400_000,
  );
}

/** Inclusive [start..end] as YYYY-MM-DD strings. */
function enumerateDateStrings(start: string, end: string) {
  const dates: string[] = [];
  for (let day = start; day <= end; day = addDateString(day, 1)) {
    dates.push(day);
  }
  return dates;
}

type Metric = { impressions: number; clicks: number };

function emptyMetric(): Metric {
  return { impressions: 0, clicks: 0 };
}

function addMetric(target: Map<unknown, Metric>, key: unknown, value: Metric): void;
function addMetric(target: Metric, value: Metric): Metric;
function addMetric(target: Map<unknown, Metric> | Metric, key: unknown, value?: Metric) {
  if (target instanceof Map) {
    const current = target.get(key) ?? emptyMetric();
    target.set(key, {
      impressions: current.impressions + value!.impressions,
      clicks: current.clicks + value!.clicks,
    });
    return;
  }
  return {
    impressions: target.impressions + (key as Metric).impressions,
    clicks: target.clicks + (key as Metric).clicks,
  };
}

function withCtr(metric: Metric) {
  return {
    ...metric,
    ctr: metric.impressions ? Number(((metric.clicks / metric.impressions) * 100).toFixed(2)) : 0,
  };
}

function metricRow(metric?: Metric) {
  return withCtr(metric ?? emptyMetric());
}

function seoulDateString(value: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SEOUL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

function seoulMonthKey(value: Date) {
  return seoulDateString(value).slice(0, 7);
}

function seoulHour(value: Date) {
  return Number(
    new Intl.DateTimeFormat('en-US', { timeZone: SEOUL_TIME_ZONE, hour: '2-digit', hour12: false })
      .format(value)
      .replace(/^24$/, '0'),
  );
}

function hourBucket(value: Date) {
  const bucket = new Date(value);
  bucket.setUTCMinutes(0, 0, 0);
  return bucket;
}
