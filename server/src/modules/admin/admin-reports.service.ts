import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, ilike } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { reports } from '../../db/schema.js';

interface ListFilters {
  q?: string;
  status?: 'open' | 'resolved' | 'dismissed';
  /** Cap the rows returned for dashboard-style previews. */
  limit?: number;
}

@Injectable()
export class AdminReportsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async list(filters: ListFilters) {
    const conditions = [
      filters.q ? ilike(reports.content, `%${filters.q}%`) : undefined,
      filters.status ? eq(reports.status, filters.status) : undefined,
    ].filter((c) => c !== undefined);

    const ordered = this.db
      .select()
      .from(reports)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(reports.createdAt));
    const rows = filters.limit !== undefined ? await ordered.limit(filters.limit) : await ordered;

    return rows.map((row) => this.toDto(row));
  }

  async resolve(id: string, action: 'resolve' | 'dismiss', note?: string) {
    const status = action === 'resolve' ? 'resolved' : 'dismissed';
    const [report] = await this.db
      .update(reports)
      .set({ status, note: note ?? null, resolvedAt: new Date() })
      .where(eq(reports.id, id))
      .returning();
    if (!report) throw new NotFoundException('Report not found');

    return this.toDto(report);
  }

  private toDto(report: typeof reports.$inferSelect) {
    return {
      id: report.id,
      content: report.content,
      targetType: report.targetType,
      org: report.org,
      summary: report.summary,
      detail: report.detail,
      // reporter_name is stored already-masked at filing time; it is NOT NULL
      // in the DB, the fallback only covers a physically missing value.
      reporter: report.reporterName || '익명',
      reportedAt: report.createdAt.toISOString(),
      status: report.status,
    };
  }
}
