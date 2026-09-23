import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { challenges } from '../../db/schema.js';
import { AdsService } from '../ads/ads.service.js';
import { BillingHistoryService } from '../billing/billing-history.service.js';
import { BusinessesService } from '../businesses/businesses.service.js';
import { ChallengesService } from '../challenges/challenges.service.js';

@Injectable()
export class BizService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly businessesService: BusinessesService,
    private readonly challengesService: ChallengesService,
    private readonly billingHistoryService: BillingHistoryService,
    private readonly adsService: AdsService,
  ) {}

  async dashboard(userId: string) {
    const business = await this.businessesService.findByOwner(userId);
    if (!business) throw new ForbiddenException('Business account required');

    const [recentPosting] = await this.db
      .select()
      .from(challenges)
      .where(eq(challenges.businessId, business.id))
      .orderBy(desc(challenges.createdAt))
      .limit(1);

    // Use the same complete stats contract exposed by GET /challenges/{id}/stats.
    const stats = recentPosting ? await this.challengesService.getStats(recentPosting.id) : null;
    const history = await this.billingHistoryService.forBusiness(business.id, {});
    // 노출 비콘이 없어 월별 광고 노출은 정직하게 0 구조만 반환 (리포트 주석 참고).
    return {
      recentPosting: recentPosting ?? null,
      stats,
      monthlyAdExposure: [] as { label: string; value: number }[],
      payments: history.items.slice(0, 3),
      paymentTotal: history.total,
      activeAds: await this.adsService.listMine(business.id, 'active'),
    };
  }
}
