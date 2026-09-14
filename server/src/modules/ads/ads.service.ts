import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { adProducts, ads } from '../../db/schema.js';
import type { CreateAdDto } from './dto/create-ad.dto.js';

const RESERVING_STATUSES = ['preparing', 'active'] as const;

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
    const existing = await this.db.select().from(adProducts).limit(1);
    if (existing.length > 0) return;
    await this.db.insert(adProducts).values(DEFAULT_PRODUCTS);
  }

  async listProducts() {
    const products = await this.db.select().from(adProducts);
    const reserving = await this.db
      .select()
      .from(ads)
      .where(inArray(ads.status, [...RESERVING_STATUSES]));

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

    const [product] = await this.db
      .select()
      .from(adProducts)
      .where(eq(adProducts.id, dto.productId))
      .limit(1);
    if (!product) throw new NotFoundException('Ad product not found');

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (endDate < startDate) throw new BadRequestException('endDate must not be before startDate');

    const reserving = await this.db
      .select()
      .from(ads)
      .where(and(eq(ads.productId, dto.productId), inArray(ads.status, [...RESERVING_STATUSES])));
    const hasOverlap = reserving.some((ad) => ad.startDate <= endDate && ad.endDate >= startDate);
    if (hasOverlap) {
      throw new BadRequestException('Selected dates overlap an existing reservation for this placement');
    }

    const days = Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
    const paidAmount = days * product.dailyPrice;

    const [ad] = await this.db
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
        paidAmount,
      })
      .returning();
    return ad;
  }
}
