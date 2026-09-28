import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { businesses, challenges, reports, teams, users } from '../../db/schema.js';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import type { CreateReportDto } from './dto/create-report.dto.js';

/** '김수아' → '김*아', two-char names '김아' → '김*'. */
export function maskReporterName(name: string): string {
  if (name.length <= 1) return name;
  if (name.length === 2) return `${name.charAt(0)}*`;
  return `${name.charAt(0)}*${name.charAt(name.length - 1)}`;
}

/** 관리자 신고 로그의 콘텐츠명/등록기관/피신고자 — 클라이언트 값이 아니라 DB 대상에서 가져온다. */
interface ReportTarget {
  content: string;
  org: string | null;
  reportedUserId: string;
}

@Injectable()
export class ReportsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async create(dto: CreateReportDto, reporter: AuthenticatedUser) {
    const target = dto.targetId ? await this.resolveTarget(dto.targetType, dto.targetId) : null;
    const [report] = await this.db
      .insert(reports)
      .values({
        ...dto,
        content: target?.content ?? dto.summary,
        org: target ? target.org : dto.org,
        reportedUserId: target?.reportedUserId ?? dto.reportedUserId,
        reporterUserId: reporter.id,
        reporterName: maskReporterName(reporter.name),
        status: 'open',
      })
      .returning();
    return report!;
  }

  /**
   * challenge → 등록 기관 owner, team → 팀장, user → 본인. `award`는 아직 대상 테이블이
   * 정해지지 않아 클라이언트 값을 그대로 쓴다(null 반환).
   */
  private async resolveTarget(
    targetType: CreateReportDto['targetType'],
    targetId: string,
  ): Promise<ReportTarget | null> {
    if (targetType === 'challenge') {
      const [row] = await this.db
        .select({ title: challenges.title, org: businesses.name, ownerId: businesses.ownerUserId })
        .from(challenges)
        .innerJoin(businesses, eq(challenges.businessId, businesses.id))
        .where(eq(challenges.id, targetId))
        .limit(1);
      if (!row) throw new NotFoundException('Report target not found');
      return { content: row.title, org: row.org, reportedUserId: row.ownerId };
    }
    if (targetType === 'team') {
      const [row] = await this.db
        .select({ title: teams.title, org: challenges.title, leaderId: teams.leaderUserId })
        .from(teams)
        .innerJoin(challenges, eq(teams.challengeId, challenges.id))
        .where(eq(teams.id, targetId))
        .limit(1);
      if (!row) throw new NotFoundException('Report target not found');
      return { content: row.title, org: row.org, reportedUserId: row.leaderId };
    }
    if (targetType === 'user') {
      const [row] = await this.db
        .select({ name: users.name, position: users.position })
        .from(users)
        .where(eq(users.id, targetId))
        .limit(1);
      if (!row) throw new NotFoundException('Report target not found');
      // 탈퇴 tombstone은 이름이 파기돼 null이다.
      return { content: row.name ?? '탈퇴한 사용자', org: row.position, reportedUserId: targetId };
    }
    return null;
  }
}
