import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, ilike } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { reports, users } from '../../db/schema.js';
import { maskName } from './admin-format.util.js';

interface ListFilters {
  q?: string;
  status?: 'open' | 'resolved' | 'dismissed';
}

@Injectable()
export class AdminReportsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async list(filters: ListFilters) {
    const conditions = [
      filters.q ? ilike(reports.content, `%${filters.q}%`) : undefined,
      filters.status ? eq(reports.status, filters.status) : undefined,
    ].filter((c) => c !== undefined);

    const rows = await this.db
      .select({ report: reports, reporterName: users.name })
      .from(reports)
      .leftJoin(users, eq(reports.reporterUserId, users.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(reports.reportedAt));

    return rows.map((row) => this.toDto(row.report, row.reporterName));
  }

  async resolve(id: string, action: 'resolve' | 'dismiss', note?: string) {
    const status = action === 'resolve' ? 'resolved' : 'dismissed';
    const [report] = await this.db
      .update(reports)
      .set({ status, resolutionNote: note ?? null })
      .where(eq(reports.id, id))
      .returning();
    if (!report) throw new NotFoundException('Report not found');

    const [reporter] = report.reporterUserId
      ? await this.db.select().from(users).where(eq(users.id, report.reporterUserId)).limit(1)
      : [];
    return this.toDto(report, reporter?.name);
  }

  private toDto(report: typeof reports.$inferSelect, reporterName?: string | null) {
    return {
      id: report.id,
      content: report.content,
      targetType: report.targetType,
      org: report.org,
      summary: report.summary,
      detail: report.detail,
      reporter: reporterName ? maskName(reporterName) : '익명',
      reportedAt: report.reportedAt.toISOString(),
      status: report.status,
    };
  }
}
