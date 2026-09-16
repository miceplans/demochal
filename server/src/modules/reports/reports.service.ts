import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { reports } from '../../db/schema.js';
import type { CreateReportDto } from './dto/create-report.dto.js';

@Injectable()
export class ReportsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async create(dto: CreateReportDto, reporterUserId: string) {
    const [report] = await this.db
      .insert(reports)
      .values({ ...dto, content: dto.summary, reporterUserId, status: 'open' })
      .returning();
    return report!;
  }
}
