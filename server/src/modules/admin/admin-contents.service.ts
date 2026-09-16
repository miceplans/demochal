import { Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { challenges, teams } from '../../db/schema.js';
import { AdminReportsService } from './admin-reports.service.js';
import { formatDday } from './admin-format.util.js';

const RECENT_LIMIT = 10;

@Injectable()
export class AdminContentsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly adminReportsService: AdminReportsService,
  ) {}

  async get() {
    const [teamRows, challengeRows, reportRows] = await Promise.all([
      this.db.select().from(teams).orderBy(desc(teams.createdAt)).limit(RECENT_LIMIT),
      this.db.select().from(challenges).orderBy(desc(challenges.createdAt)).limit(RECENT_LIMIT),
      this.adminReportsService.list({ limit: 5 }),
    ]);

    const teamCards = await Promise.all(
      teamRows.map(async (team) => {
        const [challenge] = await this.db
          .select()
          .from(challenges)
          .where(eq(challenges.id, team.challengeId))
          .limit(1);
        const openRoles = team.openRoles as { role: string; count: number }[];
        const totalSlots = 1 + openRoles.reduce((sum, slot) => sum + slot.count, 0);

        return {
          id: team.id,
          name: team.title,
          challenge: challenge?.title ?? '',
          // No team-join endpoint exists yet, so only the leader is ever "filled" —
          // see teams.service.ts / the Teams module for the underlying limitation.
          members: `1/${totalSlots}명 참여중`,
          roles: [] as string[],
          otherRoles: openRoles.map((slot) => slot.role),
          unread: true,
        };
      }),
    );

    const contestCards = await Promise.all(
      challengeRows.map(async (challenge) => {
        const teamsForChallenge = await this.db
          .select()
          .from(teams)
          .where(eq(teams.challengeId, challenge.id));

        return {
          id: challenge.id,
          title: challenge.title,
          category: challenge.category ?? '',
          dday: formatDday(challenge.endDate),
          teams: `팀 모집 ${teamsForChallenge.length}건`,
          unread: true,
        };
      }),
    );

    return { teams: teamCards, contests: contestCards, reports: reportRows };
  }
}
