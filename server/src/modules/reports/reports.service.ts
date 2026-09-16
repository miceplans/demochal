import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { reports, users } from '../../db/schema.js';
import { maskReporterName } from '../admin/admin.service.js';
import type { CreateReportDto } from './dto/create-report.dto.js';

@Injectable()
export class ReportsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async create(dto: CreateReportDto, reporterUserId: string) {
    const [reporter] = await this.db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, reporterUserId))
      .limit(1);

    const [report] = await this.db
      .insert(reports)
      .values({
        content: dto.summary,
        targetType: dto.targetType,
        org: dto.org,
        summary: dto.summary,
        detail: dto.detail,
        reporterUserId,
        reporterName: reporter ? maskReporterName(reporter.name) : '익명',
        status: 'open',
      })
      .returning();
    return report!;
  }
}
