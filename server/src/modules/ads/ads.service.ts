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
import { and, asc, desc, eq, gt, gte, inArray, lt, lte, or, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { adEventCounters, adProducts, ads, files, orders } from '../../db/schema.js';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { BusinessesService } from '../businesses/businesses.service.js';
import { adPeriod, adToday } from './ad-period.js';
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

  async listMine(businessId: string, status?: string, opts?: { withinServingWindow?: boolean }) {
    if (!businessId) return [];
    const conditions = [eq(ads.businessId, businessId)];
    if (status) conditions.push(eq(ads.status, status));
    if (opts?.withinServingWindow) {
      // listPublic과 동일한 노출 기간 조건이다(KST 날짜 기준). 계약이 만료된 'active'
      // 광고는 실제로 노출되지 않으므로 대시보드 진행중 광고 집계에서도 제외한다.
      const today = adToday();
      conditions.push(lte(ads.startDate, today), gte(ads.endDate, today));
    }
    const rows = await this.db
      .select()
      .from(ads)
      .where(and(...conditions))
      .orderBy(desc(ads.createdAt));
    return this.withImageUrls(rows);
  }

  async listPublic(placement: 'hero' | 'gallery') {
    // 광고 기간은 KST 날짜(자정 UTC로 저장)이므로 결제 확정과 같은 adToday 기준으로 비교한다.
    const today = adToday();
    const rows = await this.db
      .select({
        id: ads.id,
        title: ads.title,
        imageFileId: ads.imageFileId,
        landingUrl: ads.landingUrl,
        placement: adProducts.placement,
        startDate: ads.startDate,
        createdAt: ads.createdAt,
      })
      .from(ads)
      .innerJoin(adProducts, eq(ads.productId, adProducts.id))
      .where(
        and(
          eq(ads.status, 'active'),
          eq(adProducts.placement, placement),
          lte(ads.startDate, today),
          // 종료일 당일까지 노출한다.
          gte(ads.endDate, today),
        ),
      )
      .orderBy(asc(ads.startDate), asc(ads.createdAt));

    return (await this.withImageUrls(rows))
      .filter((ad): ad is typeof ad & { imageUrl: string } => ad.imageUrl !== null)
      .map(({ id, title, imageUrl, landingUrl, placement: adPlacement }) => ({
        id,
        title,
        imageUrl,
        landingUrl,
        placement: adPlacement as 'hero' | 'gallery',
      }));
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
    if (!businessId) throw new UnauthorizedException('기업 인증이 필요합니다.');

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
      if (!product) throw new NotFoundException('광고 상품을 찾을 수 없습니다.');

      if (dto.expectedDailyPrice !== product.dailyPrice) {
        throw new ConflictException({
          message: '조회하신 이후 광고 단가가 변경되었습니다. 다시 확인해 주세요.',
          currentDailyPrice: product.dailyPrice,
        });
      }

      // 오늘(KST) 이후의 올바른 기간만 허용한다 — 결제 확정(settleOrderPaid)이 이미
      // 지난 기간을 거절하므로, 생성 단계에서 같은 기준으로 막아 결제 후 환불을 방지한다.
      const { startDate, endDate, days } = adPeriod(dto.startDate, dto.endDate);

      const reserving = await tx
        .select()
        .from(ads)
        .where(and(eq(ads.productId, dto.productId), this.reservingCondition()));
      const hasOverlap = reserving.some((ad) => ad.startDate <= endDate && ad.endDate >= startDate);
      if (hasOverlap) {
        throw new BadRequestException('선택한 날짜가 이미 예약된 기간과 겹칩니다.');
      }

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
    if (!ad) throw new NotFoundException('광고를 찾을 수 없습니다.');
    return ad;
  }

  async updateStatus(id: string, dto: UpdateAdDto, user: AuthenticatedUser) {
    const ad = await this.findById(id);
    const business = await this.businessesService.findByOwner(user.id);
    // 관리자 중단은 전용 엔드포인트(POST /admin/ads/:id/pause)가 담당한다.
    if (!business || business.id !== ad.businessId) {
      throw new ForbiddenException('해당 기업만 광고를 변경할 수 있습니다.');
    }
    // 결제 전 preparing 광고를 직접 active로 바꾸는 건 불가 — 활성화는 결제
    // 웹훅(OrdersService.markPaid)이 담당한다.
    if (dto.status === 'active' && ad.status === 'preparing') {
      throw new BadRequestException(
        '결제 전 광고는 직접 활성화할 수 없습니다. 먼저 결제를 완료해 주세요.',
      );
    }
    if (dto.status === 'paused' && ad.status !== 'active') {
      throw new BadRequestException('진행 중인 광고만 일시정지할 수 있습니다.');
    }
    if (dto.status === 'active') {
      if (ad.status === 'paused' && ad.pausedBy === 'admin') {
        throw new ForbiddenException('관리자가 중단한 광고는 직접 재개할 수 없습니다.');
      }
      if (ad.status !== 'paused' && ad.status !== 'active') {
        throw new BadRequestException('일시정지된 광고만 재개할 수 있습니다.');
      }
      if (ad.endDate < adToday()) {
        throw new BadRequestException('계약 기간이 끝난 광고는 재개할 수 없습니다.');
      }
      return this.db.transaction(async (tx) => {
        // markCancelled locks this same order row. This makes cancellation and
        // reactivation serialize, so a refunded order cannot resume serving.
        const [order] = await tx.select().from(orders).where(eq(orders.adId, id)).for('update');
        if (!order || order.status !== 'paid') {
          throw new BadRequestException('결제가 완료된 광고만 활성화할 수 있습니다.');
        }
        const [updated] = await tx
          .update(ads)
          .set({ status: dto.status, pausedBy: null })
          .where(eq(ads.id, id))
          .returning();
        return updated;
      });
    }
    const [updated] = await this.db
      .update(ads)
      .set(
        dto.status === 'paused'
          ? { status: dto.status, pausedBy: 'owner' }
          : { status: dto.status },
      )
      .where(eq(ads.id, id))
      .returning();
    return updated;
  }

  async report(id: string, query: AdReportQueryDto, user: AuthenticatedUser) {
    const ad = await this.findById(id);
    const business = await this.businessesService.findByOwner(user.id);
    if (user.role !== 'admin' && (!business || business.id !== ad.businessId)) {
      throw new ForbiddenException('해당 기업만 리포트를 조회할 수 있습니다.');
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

  // Rows that currently occupy a placement's calendar: paid ads (active, or paused
  // — a paused ad can be resumed, so it keeps holding its dates), plus preparing
  // ads whose payment window hasn't expired yet.
  private reservingCondition() {
    return or(
      inArray(ads.status, ['active', 'paused']),
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
