import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, ilike } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { businesses, verifications } from '../../db/schema.js';
import { formatShortDate, maskBizNumber } from './admin-format.util.js';

interface ListFilters {
  q?: string;
  type?: string;
  status?: 'pending' | 'approved' | 'rejected';
}

@Injectable()
export class AdminBusinessesService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async list(filters: ListFilters) {
    // The businesses table has no `type` column (BizReviewEntry.type is
    // hardcoded '기업'), so the query param is accepted but not filtered on.
    void filters.type;
    const conditions = [
      filters.q ? ilike(businesses.name, `%${filters.q}%`) : undefined,
      filters.status ? eq(businesses.verificationStatus, filters.status) : undefined,
    ].filter((c) => c !== undefined);

    const rows = await this.db
      .select()
      .from(businesses)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(businesses.createdAt));

    const items = await Promise.all(
      rows.map(async (business) => {
        const [latestVerification] = await this.db
          .select()
          .from(verifications)
          .where(eq(verifications.businessId, business.id))
          .orderBy(desc(verifications.createdAt))
          .limit(1);

        return {
          id: business.id,
          org: business.name,
          type: '기업',
          bizNumber: maskBizNumber(business.registrationNumber),
          appliedAt: formatShortDate(latestVerification?.createdAt ?? business.createdAt),
          // Derived from verification.status — the OCR pipeline doesn't persist a distinct
          // success/failed/closed/unrecognized category, only pass/fail (see verifications.processor.ts).
          nts: this.deriveNtsResult(latestVerification?.status),
          status: business.verificationStatus as 'pending' | 'approved' | 'rejected',
        };
      }),
    );

    const all = await this.db.select().from(businesses);
    const stats = [
      { label: '전체 신청', value: String(all.length), meta: null, dot: '#0877FF' },
      {
        label: '승인',
        value: String(all.filter((b) => b.verificationStatus === 'approved').length),
        meta: null,
        dot: '#22C55E',
      },
      {
        label: '거부',
        value: String(all.filter((b) => b.verificationStatus === 'rejected').length),
        meta: null,
        dot: '#EF4444',
      },
      {
        label: '대기',
        value: String(all.filter((b) => b.verificationStatus === 'pending').length),
        meta: null,
        dot: '#F59E0B',
      },
    ];

    return { stats, items };
  }

  private deriveNtsResult(status?: string): 'success' | 'failed' | 'closed' | 'unrecognized' {
    if (status === 'verified' || status === 'approved') return 'success';
    if (status === 'rejected') return 'failed';
    return 'unrecognized';
  }
}
