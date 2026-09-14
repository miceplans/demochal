import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, ilike } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { teamMembers, teams } from '../../db/schema.js';
import type { CreateTeamDto } from './dto/create-team.dto.js';
import type { JoinTeamDto } from './dto/join-team.dto.js';
import type { UpdateTeamMemberDto } from './dto/update-team-member.dto.js';

interface ListTeamsFilters {
  challengeId?: string;
  role?: string;
  region?: string;
  q?: string;
}

@Injectable()
export class TeamsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async list(filters: ListTeamsFilters) {
    const conditions = [
      filters.challengeId ? eq(teams.challengeId, filters.challengeId) : undefined,
      filters.region ? ilike(teams.region, `%${filters.region}%`) : undefined,
      filters.q ? ilike(teams.title, `%${filters.q}%`) : undefined,
    ].filter((c) => c !== undefined);

    const rows = await this.db
      .select()
      .from(teams)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(teams.createdAt));

    // openRoles containment is filtered in-app rather than via a jsonb query —
    // team counts are low and this avoids relying on subtle @> array-of-object semantics.
    if (!filters.role) return rows;
    return rows.filter((team) =>
      (team.openRoles as { role: string; count: number }[]).some((slot) => slot.role === filters.role),
    );
  }

  async create(dto: CreateTeamDto, leaderUserId: string) {
    const [team] = await this.db
      .insert(teams)
      .values({
        challengeId: dto.challengeId,
        leaderUserId,
        title: dto.title,
        leaderRole: dto.myRole,
        region: dto.region,
        openRoles: dto.openRoles ?? [],
      })
      .returning();
    return team;
  }

  async findById(id: string) {
    const [team] = await this.db.select().from(teams).where(eq(teams.id, id)).limit(1);
    if (!team) throw new NotFoundException('Team not found');
    const members = await this.db.select().from(teamMembers).where(eq(teamMembers.teamId, id));
    return { ...team, members };
  }

  async join(teamId: string, dto: JoinTeamDto, userId: string) {
    await this.findTeamOrThrow(teamId);
    const [existing] = await this.db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
      .limit(1);
    if (existing) throw new ConflictException('You have already applied to this team');

    const [member] = await this.db
      .insert(teamMembers)
      .values({ teamId, userId, role: dto.role, status: 'pending' })
      .returning();
    return member!;
  }

  async updateMember(teamId: string, memberId: string, dto: UpdateTeamMemberDto, userId: string) {
    const team = await this.findTeamOrThrow(teamId);
    if (team.leaderUserId !== userId) throw new ForbiddenException('Only the team leader can manage members');

    const [member] = await this.db
      .update(teamMembers)
      .set({ status: dto.status })
      .where(and(eq(teamMembers.id, memberId), eq(teamMembers.teamId, teamId)))
      .returning();
    if (!member) throw new NotFoundException('Team member application not found');
    return member;
  }

  private async findTeamOrThrow(id: string) {
    const [team] = await this.db.select().from(teams).where(eq(teams.id, id)).limit(1);
    if (!team) throw new NotFoundException('Team not found');
    return team;
  }
}
