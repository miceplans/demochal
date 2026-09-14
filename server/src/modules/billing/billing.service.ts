import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, isNotNull, lte } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { adProducts, ads, businesses, challenges, orders, paymentCards } from '../../db/schema.js';
import { AdsService } from '../ads/ads.service.js';
import { ChallengesService } from '../challenges/challenges.service.js';
import type { RegisterPaymentCardDto } from './dto/register-payment-card.dto.js';

@Injectable()
export class BillingService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly challengesService: ChallengesService,
    private readonly adsService: AdsService,
  ) {}

  // TODO: derive the owning business from the authenticated request once auth is implemented.
  private async getOwnedBusiness(userId: string) {
    const [business] = await this.db
      .select()
      .from(businesses)
      .where(eq(businesses.ownerUserId, userId))
      .limit(1);
    return business;
  }

  async listCards(userId: string) {
    const business = await this.getOwnedBusiness(userId);
    if (!business) return [];

    const rows = await this.db
      .select()
      .from(paymentCards)
      .where(eq(paymentCards.businessId, business.id))
      .orderBy(desc(paymentCards.createdAt));

    // billingKey is a secret — never serialized back to the client.
    return rows.map(({ billingKey: _billingKey, ...card }) => card);
  }

  async registerCard(dto: RegisterPaymentCardDto, userId: string) {
    const business = await this.getOwnedBusiness(userId);
    if (!business) throw new BadRequestException('No business registered for this account');

    const [card] = await this.db
      .insert(paymentCards)
      .values({
        businessId: business.id,
        cardName: dto.cardName,
        maskedNumber: dto.maskedNumber,
        billingKey: dto.billingKey,
      })
      .returning();
    if (!card) throw new Error('Failed to register card');

    const { billingKey: _billingKey, ...publicCard } = card;
    return publicCard;
  }

  async getHistory(userId: string, from?: string, to?: string) {
    const business = await this.getOwnedBusiness(userId);
    if (!business) return { items: [], total: 0 };

    const conditions = [
      eq(orders.userId, userId),
      isNotNull(orders.adId),
      eq(orders.status, 'paid'),
      from ? gte(orders.createdAt, new Date(from)) : undefined,
      to ? lte(orders.createdAt, new Date(to)) : undefined,
    ].filter((c) => c !== undefined);

    const rows = await this.db
      .select({ order: orders, ad: ads, product: adProducts })
      .from(orders)
      .innerJoin(ads, eq(orders.adId, ads.id))
      .leftJoin(adProducts, eq(ads.productId, adProducts.id))
      .where(and(...conditions))
      .orderBy(desc(orders.createdAt));

    const items = rows.map((row) => ({
      id: row.order.id,
      name: `${row.ad.title} - ${row.product?.name ?? row.ad.productId}`,
      amount: -row.order.amount,
      // No separate paid-at timestamp is tracked on orders yet — createdAt is the
      // closest real value (payments.service.ts doesn't persist a Payment row either).
      paidAt: row.order.createdAt.toISOString(),
      status: 'paid' as const,
    }));

    return { items, total: items.reduce((sum, item) => sum + item.amount, 0) };
  }

  async getBizDashboard(userId: string) {
    const business = await this.getOwnedBusiness(userId);
    if (!business) {
      return {
        recentPosting: null,
        stats: null,
        monthlyAdExposure: this.zeroMonths(),
        payments: [],
        paymentTotal: 0,
        activeAds: [],
      };
    }

    const [recentPosting] = await this.db
      .select()
      .from(challenges)
      .where(eq(challenges.businessId, business.id))
      .orderBy(desc(challenges.createdAt))
      .limit(1);

    const [stats, history, activeAds] = await Promise.all([
      recentPosting ? this.challengesService.getStats(recentPosting.id) : null,
      this.getHistory(userId),
      this.adsService.listMine(userId, 'active'),
    ]);

    return {
      recentPosting: recentPosting ?? null,
      stats,
      // Same limitation as AdsService.getReport — no impression beacon to source real
      // per-month ad exposure from, so this is honestly zero rather than fabricated.
      monthlyAdExposure: this.zeroMonths(),
      payments: history.items.slice(0, 3),
      paymentTotal: history.total,
      activeAds,
    };
  }

  private zeroMonths() {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const bucket = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return { label: `${bucket.getMonth() + 1}월`, value: 0 };
    });
  }
}
