import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, ilike, gte, lte, inArray } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { adProducts, ads, businesses, notifications, orders } from '../../db/schema.js';
import { formatShortDate } from './admin-format.util.js';
import type { AdPricingEntryDto } from './dto/update-ad-pricing.dto.js';
import { adToday } from '../ads/ad-period.js';

@Injectable()
export class AdminAdsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async listAds(q?: string, status?: string) {
    const conditions = [
      q ? ilike(ads.title, `%${q}%`) : undefined,
      status ? eq(ads.status, status) : undefined,
    ].filter((c) => c !== undefined);

    return this.db
      .select()
      .from(ads)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(ads.createdAt));
  }

  async getAdPricing() {
    const products = await this.db.select().from(adProducts);

    return Promise.all(
      products.map(async (product) => {
        const [current] = await this.db
          .select({ ad: ads, businessName: businesses.name })
          .from(ads)
          .innerJoin(businesses, eq(ads.businessId, businesses.id))
          .where(
            and(
              eq(ads.productId, product.id),
              eq(ads.status, 'active'),
              lte(ads.startDate, adToday()),
              gte(ads.endDate, adToday()),
            ),
          )
          .orderBy(desc(ads.createdAt))
          .limit(1);

        return {
          slot: product.placement,
          dailyPrice: product.dailyPrice,
          currentAdId: current?.ad.id ?? null,
          organization: current?.businessName ?? null,
          period: current
            ? `${formatShortDate(current.ad.startDate)}~${formatShortDate(current.ad.endDate)}`
            : null,
        };
      }),
    );
  }

  async updateAdPricing(entries: AdPricingEntryDto[]) {
    await this.db.transaction(async (tx) => {
      for (const entry of [...entries].sort((a, b) => a.slot.localeCompare(b.slot))) {
        const products = await tx
          .select()
          .from(adProducts)
          .where(eq(adProducts.placement, entry.slot))
          .for('update');
        for (const product of products) {
          if (product.dailyPrice === entry.dailyPrice) continue;
          await tx
            .update(adProducts)
            .set({ dailyPrice: entry.dailyPrice })
            .where(eq(adProducts.id, product.id));
          const contracts = await tx
            .select({ ad: ads, userId: businesses.ownerUserId })
            .from(ads)
            .innerJoin(businesses, eq(ads.businessId, businesses.id))
            .innerJoin(orders, and(eq(orders.adId, ads.id), eq(orders.status, 'paid')))
            .where(
              and(
                eq(ads.productId, product.id),
                inArray(ads.status, ['active', 'paused']),
                gte(ads.endDate, adToday()),
              ),
            );
          for (const { ad, userId } of contracts) {
            await tx.insert(notifications).values({
              userId,
              type: 'ad_price_changed',
              payload: {
                adId: ad.id,
                productId: product.id,
                previousDailyPrice: product.dailyPrice,
                dailyPrice: entry.dailyPrice,
                paidAmount: ad.paidAmount,
                title: '광고 단가 변경 안내',
                message: `${product.name}의 하루 광고비가 ${entry.dailyPrice.toLocaleString()}원으로 변경되었습니다. 기존 계약의 결제 금액 ${ad.paidAmount.toLocaleString()}원과 광고 기간은 그대로 유지됩니다. 변경된 단가는 새 계약부터 적용됩니다.`,
              },
            });
          }
        }
      }
    });
    return this.getAdPricing();
  }
}
