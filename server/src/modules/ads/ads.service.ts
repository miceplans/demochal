import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { and, desc, eq, gt, or } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { adProducts, ads } from '../../db/schema.js';
import type { CreateAdDto } from './dto/create-ad.dto.js';

// Unpaid ('preparing') reservations stop blocking a placement's dates this
// long after creation, so an abandoned checkout can't lock inventory forever.
const PREPARING_TTL_MS = 30 * 60 * 1000;

// Seeded once so the biz console has something to reserve until an admin
// product-management screen exists (tracked separately, out of scope here).
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
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

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

  async create(dto: CreateAdDto, businessId: string) {
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
        throw new BadRequestException('Selected dates overlap an existing reservation for this placement');
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
      return ad;
    });
  }

  // Rows that currently occupy a placement's calendar: paid/active ads, plus
  // preparing ads whose payment window hasn't expired yet.
  private reservingCondition() {
    return or(eq(ads.status, 'active'), and(eq(ads.status, 'preparing'), gt(ads.expiresAt, new Date())));
  }
}
