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
import { and, asc, desc, eq, gt, gte, inArray, lte, or } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { adProducts, ads, files, orders } from '../../db/schema.js';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { BusinessesService } from '../businesses/businesses.service.js';
import { buildPublicFileUrl } from '../files/public-file-url.js';
import type { CreateAdDto } from './dto/create-ad.dto.js';
import type { AdReportQueryDto } from './dto/ad-report-query.dto.js';
import type { UpdateAdDto } from './dto/update-ad.dto.js';

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

@Injectable()
export class AdsService implements OnModuleInit {
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

  async listPublic(placement: 'hero' | 'gallery') {
    const now = new Date();
    const todayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
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
          lte(ads.startDate, now),
          // Ad dates are stored at midnight. Compare the end date with the
          // start of today so a contract remains visible through its stated
          // end date, not only until that day's first instant.
          gte(ads.endDate, todayStart),
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

  /**
   * 광고 성과 리포트. 노출/클릭 계측 비콘이 아직 없어(광고는 클라이언트에서만
   * 렌더링) 구조는 실제 스키마와 동일하되 모든 지표가 정직하게 0으로 채워진다.
   */
  async report(id: string, query: AdReportQueryDto, user: AuthenticatedUser) {
    const ad = await this.findById(id);
    const business = await this.businessesService.findByOwner(user.id);
    if (user.role !== 'admin' && (!business || business.id !== ad.businessId)) {
      throw new ForbiddenException('Only the owning business can view this report');
    }

    const end = query.to ? parseDate(query.to) : new Date();
    let start = query.from ? parseDate(query.from) : addDays(end, -6);
    // 기간 상한 31일: 그 이상 요청되면 시작일을 당겨 맞춘다.
    if (diffDays(start, end) > 30) start = addDays(end, -30);
    if (start.getTime() > end.getTime()) start = end;

    const zero = { impressions: 0, clicks: 0, ctr: 0 };
    const daily = enumerateDays(start, end).map((date) => ({ date, ...zero }));
    const hourly = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      label: `${hour}시~${hour + 1}시`,
      ...zero,
    }));
    return { totals: { ...zero }, daily, hourly, monthlyClicks: [] };
  }

  async getReportForAdmin(id: string) {
    await this.findById(id);
    const zero = { impressions: 0, clicks: 0, ctr: 0 };
    return { totals: zero, daily: [], hourly: [], monthlyClicks: [] };
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
  return new Date(`${value}T00:00:00Z`);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function diffDays(start: Date, end: Date) {
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

/** Inclusive [start..end] as YYYY-MM-DD strings. */
function enumerateDays(start: Date, end: Date) {
  const dates: string[] = [];
  for (let day = start; day.getTime() <= end.getTime(); day = addDays(day, 1)) {
    dates.push(day.toISOString().slice(0, 10));
  }
  return dates;
}
