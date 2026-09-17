import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { challenges, teamMembers, teams, users } from '../../db/schema.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { CreateTeamDto } from './dto/create-team.dto.js';
import type { UpdateTeamMemberDto } from './dto/update-team-member.dto.js';

export interface TeamListFilters {
  challengeId?: string;
  role?: string;
  region?: string;
  q?: string;
}

@Injectable()
export class TeamsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly notificationsService: NotificationsService,
  ) {}

  // openRoles is jsonb, so the role filter scans slots in JS after one cheap
  // query; the table is small enough that this stays fast.
  async list(filters: TeamListFilters) {
    const rows = await this.db.select().from(teams).orderBy(desc(teams.createdAt));
    const q = filters.q?.toLowerCase();
    return rows.filter((team) => {
      if (filters.challengeId && team.challengeId !== filters.challengeId) return false;
      if (filters.region && team.region !== filters.region) return false;
      if (q && !team.title.toLowerCase().includes(q)) return false;
      if (filters.role && !(team.openRoles ?? []).some((slot) => slot.role === filters.role)) {
        return false;
      }
      return true;
    });
  }

  async create(dto: CreateTeamDto, userId: string) {
    const [challenge] = await this.db
      .select({ id: challenges.id })
      .from(challenges)
      .where(eq(challenges.id, dto.challengeId))
      .limit(1);
    if (!challenge) throw new NotFoundException('Challenge not found');

    const [team] = await this.db
      .insert(teams)
      .values({
        challengeId: dto.challengeId,
        leaderUserId: userId,
        title: dto.title,
        region: dto.region,
        openRoles: dto.openRoles ?? [],
        status: 'recruiting',
      })
      .returning();

    // The creator joins their own team immediately as an accepted member.
    await this.db.insert(teamMembers).values({
      teamId: team!.id,
      userId,
      role: dto.myRole,
      status: 'accepted',
    });
    return team;
  }

  async findById(id: string) {
    const [row] = await this.db
      .select({
        team: teams,
        challengeTitle: challenges.title,
        leaderName: users.name,
      })
      .from(teams)
      .innerJoin(challenges, eq(teams.challengeId, challenges.id))
      .innerJoin(users, eq(teams.leaderUserId, users.id))
      .where(eq(teams.id, id))
      .limit(1);
    if (!row) throw new NotFoundException('Team not found');

    const members = await this.db
      .select({
        id: teamMembers.id,
        userId: teamMembers.userId,
        name: users.name,
        role: teamMembers.role,
        status: teamMembers.status,
      })
      .from(teamMembers)
      .innerJoin(users, eq(teamMembers.userId, users.id))
      .where(eq(teamMembers.teamId, id));

    return { ...row.team, challengeTitle: row.challengeTitle, leaderName: row.leaderName, members };
  }

  async join(id: string, role: string | undefined, userId: string) {
    const [team] = await this.db.select().from(teams).where(eq(teams.id, id)).limit(1);
    if (!team) throw new NotFoundException('Team not found');
    if (team.leaderUserId === userId) {
      throw new BadRequestException('You are already the leader of this team');
    }

    const [existing] = await this.db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, id), eq(teamMembers.userId, userId)))
      .limit(1);
    if (existing) throw new BadRequestException('You already applied to this team');

    const [member] = await this.db
      .insert(teamMembers)
      .values({ teamId: id, userId, role, status: 'pending' })
      .returning();

    await this.notificationsService.create(team.leaderUserId, 'team_matching', {
      teamId: id,
      applicantUserId: userId,
      ...(role ? { role } : {}),
    });
    return member;
  }

  async updateMember(
    teamId: string,
    memberId: string,
    dto: UpdateTeamMemberDto,
    user: AuthenticatedUser,
  ) {
    const [team] = await this.db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
    if (!team) throw new NotFoundException('Team not found');
    const [member] = await this.db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.id, memberId), eq(teamMembers.teamId, teamId)))
      .limit(1);
    if (!member) throw new NotFoundException('Team member not found');
    if (team.leaderUserId !== user.id && user.role !== 'admin') {
      throw new ForbiddenException('Only the team leader can decide join requests');
    }

    const [updated] = await this.db
      .update(teamMembers)
      .set({ status: dto.status })
      .where(eq(teamMembers.id, memberId))
      .returning();

    await this.notificationsService.create(member.userId, 'team_matching', {
      teamId,
      status: dto.status,
    });
    return updated;
  }
}
