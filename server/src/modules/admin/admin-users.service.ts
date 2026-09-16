import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, count, eq, ilike, isNotNull } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { reports, users } from '../../db/schema.js';
import { maskEmail } from './admin-format.util.js';

interface ListFilters {
  q?: string;
  status?: 'active' | 'suspended';
}

@Injectable()
export class AdminUsersService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async list(filters: ListFilters) {
    const conditions = [
      eq(users.role, 'user'),
      filters.q ? ilike(users.name, `%${filters.q}%`) : undefined,
      filters.status ? eq(users.suspended, filters.status === 'suspended') : undefined,
    ].filter((c) => c !== undefined);

    const rows = await this.db
      .select()
      .from(users)
      .where(and(...conditions));

    const reportCounts = await this.db
      .select({ userId: reports.reportedUserId, count: count() })
      .from(reports)
      .where(isNotNull(reports.reportedUserId))
      .groupBy(reports.reportedUserId);
    const reportsByUserId = new Map(reportCounts.map((row) => [row.userId!, Number(row.count)]));

    return rows.map((user) => ({
      id: user.id,
      name: user.name,
      email: maskEmail(user.email),
      position: user.position,
      reports: reportsByUserId.get(user.id) ?? 0,
      status: user.suspended ? ('suspended' as const) : ('active' as const),
    }));
  }

  async suspend(id: string, suspended: boolean, reason?: string) {
    const [user] = await this.db
      .update(users)
      .set({ suspended, suspendedReason: suspended ? (reason ?? null) : null })
      .where(eq(users.id, id))
      .returning();
    if (!user) throw new NotFoundException('User not found');

    return {
      id: user.id,
      name: user.name,
      email: maskEmail(user.email),
      position: user.position,
      reports: await this.countReportsForUser(user.id),
      status: user.suspended ? ('suspended' as const) : ('active' as const),
    };
  }

  private async countReportsForUser(userId: string) {
    const [result] = await this.db
      .select({ count: count() })
      .from(reports)
      .where(eq(reports.reportedUserId, userId));
    return Number(result?.count ?? 0);
  }
}
