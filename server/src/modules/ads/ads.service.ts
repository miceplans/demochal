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
import { and, desc, eq, gt, or } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { adProducts, ads, orders } from '../../db/schema.js';
import type { AuthUser } from '../../common/auth/current-user.decorator.js';
import { BusinessesService } from '../businesses/businesses.service.js';
import type { CreateAdDto } from './dto/create-ad.dto.js';
import type { AdReportQueryDto } from './dto/ad-report-query.dto.js';
import type { UpdateAdDto } from './dto/update-ad.dto.js';

// Unpaid ('preparing') reservations stop blocking a placement's dates this
// long after creation, so an abandoned checkout can't lock inventory forever.
const PREPARING_TTL_MS = 30 * 60 * 1000;

// Seeded once so the biz console has something to reserve until an admin
// product-management screen exists (tracked separately, out of scope here).
// ad_products.id is a server-generated uuid (gen_random_uuid), so the seed
// leaves it out and lets the default fill it.
const DEFAULT_PRODUCTS = [
  {
    name: '홈 히어로 배너',
    placement: 'hero',
    dailyPrice: 100_000,
    description: '홈 화면 최상단 히어로 배너 노출',
  },
  {
    name: '갤러리 노출',
    placement: 'gallery',
    dailyPrice: 50_000,
    description: '홈 화면 갤러리 영역 노출',
  },
  {
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
    return this.db
      .select()
      .from(ads)
      .where(and(...conditions))
      .orderBy(desc(ads.createdAt));
  }

  async create(dto: CreateAdDto, businessId: string, userId: string) {
    if (!businessId) throw new UnauthorizedException('Business authentication is required');

    return this.db.transaction(async (tx) => {
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

      return ad;
    });
  }

  async findById(id: string) {
    const [ad] = await this.db.select().from(ads).where(eq(ads.id, id)).limit(1);
    if (!ad) throw new NotFoundException('Ad not found');
    return ad;
  }

  async updateStatus(id: string, dto: UpdateAdDto, user: AuthUser) {
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
  async report(id: string, query: AdReportQueryDto, user: AuthUser) {
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

    return this.buildReport(start, end);
  }

  /**
   * 관리자 분석 화면용 리포트. 노출/클릭 계측 비콘이 없어 노출·클릭·CTR은
   * 정직하게 0이며, 집행 광고비만 실제로 쿼리 가능한 지표(이 광고의 결제 완료
   * 주문 합계)로 채운다.
   */
  async getReportForAdmin(id: string) {
    await this.findById(id);
    const end = new Date();
    const start = addDays(end, -6);

    const paidOrders = await this.db
      .select({ amount: orders.amount })
      .from(orders)
      .where(and(eq(orders.adId, id), eq(orders.status, 'paid')));
    const spend = paidOrders.reduce((sum, order) => sum + order.amount, 0);

    return {
      ...this.buildReport(start, end),
      totals: { impressions: 0, clicks: 0, ctr: 0, spend },
    };
  }

  private buildReport(start: Date, end: Date) {
    const zero = { impressions: 0, clicks: 0, ctr: 0 };
    const daily = enumerateDays(start, end).map((date) => ({ date, ...zero }));
    const hourly = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      label: `${hour}시~${hour + 1}시`,
      ...zero,
    }));
    return { totals: { ...zero }, daily, hourly, monthlyClicks: [] };
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
