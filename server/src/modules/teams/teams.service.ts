import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, inArray, ne } from 'drizzle-orm';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { businesses, challenges, teamMembers, teams, users } from '../../db/schema.js';
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
  // query; the table is small enough that this stays fast. Accepted members are
  // loaded in one extra query so list cards can show filled roles and headcount.
  async list(filters: TeamListFilters) {
    const rows = await this.db
      .select({ team: teams, challengeTitle: challenges.title, leaderName: users.name })
      .from(teams)
      .innerJoin(challenges, eq(teams.challengeId, challenges.id))
      .innerJoin(users, eq(teams.leaderUserId, users.id))
      .orderBy(desc(teams.createdAt));
    const q = filters.q?.toLowerCase();
    const matched = rows.filter(({ team }) => {
      if (filters.challengeId && team.challengeId !== filters.challengeId) return false;
      if (filters.region && team.region !== filters.region) return false;
      if (
        q &&
        !team.title.toLowerCase().includes(q) &&
        !(team.introduction ?? '').toLowerCase().includes(q)
      ) {
        return false;
      }
      if (filters.role && !(team.openRoles ?? []).some((slot) => slot.role === filters.role)) {
        return false;
      }
      return true;
    });
    if (matched.length === 0) return [];

    const accepted = await this.db
      .select({ teamId: teamMembers.teamId, role: teamMembers.role })
      .from(teamMembers)
      .where(
        and(
          inArray(
            teamMembers.teamId,
            matched.map(({ team }) => team.id),
          ),
          eq(teamMembers.status, 'accepted'),
        ),
      );
    return matched.map(({ team, challengeTitle, leaderName }) => ({
      ...team,
      challengeTitle,
      leaderName,
      filledRoles: accepted
        .filter((member) => member.teamId === team.id)
        .map((member) => member.role)
        .filter((role): role is string => !!role),
    }));
  }

  async create(dto: CreateTeamDto, user: AuthenticatedUser) {
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
        leaderUserId: user.id,
        title: dto.title?.trim() || `${user.name}의 팀`,
        leaderRole: dto.myRole,
        introduction: dto.introduction,
        preferred: dto.preferred,
        etc: dto.etc,
        region: dto.region,
        openRoles: dto.openRoles ?? [],
        status: 'recruiting',
      })
      .returning();

    // The creator joins their own team immediately as an accepted member.
    await this.db.insert(teamMembers).values({
      teamId: team!.id,
      userId: user.id,
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

  // 마이페이지 지원현황의 "팀 지원현황" — 내가 지원한 팀(리더로 참여 중인 팀은 제외)과 그 결과.
  async listMyApplications(userId: string) {
    const rows = await this.db
      .select({ member: teamMembers, teamTitle: teams.title, challengeTitle: challenges.title })
      .from(teamMembers)
      .innerJoin(teams, eq(teamMembers.teamId, teams.id))
      .innerJoin(challenges, eq(teams.challengeId, challenges.id))
      .where(and(eq(teamMembers.userId, userId), ne(teams.leaderUserId, userId)))
      .orderBy(desc(teamMembers.createdAt));
    return rows.map(({ member, teamTitle, challengeTitle }) => ({
      ...member,
      teamTitle,
      challengeTitle,
    }));
  }

  // 팀 지원현황 관리 화면 — 내가 리더인 팀과 그 지원자 목록(팀장 본인 행 제외).
  async listManaged(userId: string) {
    const myTeams = await this.db
      .select({
        team: teams,
        challengeTitle: challenges.title,
        businessName: businesses.name,
      })
      .from(teams)
      .innerJoin(challenges, eq(teams.challengeId, challenges.id))
      .innerJoin(businesses, eq(challenges.businessId, businesses.id))
      .where(eq(teams.leaderUserId, userId))
      .orderBy(desc(teams.createdAt));
    if (myTeams.length === 0) return [];

    const members = await this.db
      .select({
        id: teamMembers.id,
        teamId: teamMembers.teamId,
        userId: teamMembers.userId,
        name: users.name,
        role: teamMembers.role,
        status: teamMembers.status,
        chatLink: teamMembers.chatLink,
        createdAt: teamMembers.createdAt,
      })
      .from(teamMembers)
      .innerJoin(users, eq(teamMembers.userId, users.id))
      .where(
        and(
          inArray(
            teamMembers.teamId,
            myTeams.map(({ team }) => team.id),
          ),
          ne(teamMembers.userId, userId),
        ),
      )
      .orderBy(desc(teamMembers.createdAt));
    return myTeams.map(({ team, challengeTitle, businessName }) => ({
      ...team,
      challengeTitle,
      businessName,
      members: members.filter((member) => member.teamId === team.id),
    }));
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
    if (member.userId === team.leaderUserId) {
      throw new BadRequestException('The leader cannot decide their own membership');
    }

    const [updated] = await this.db
      .update(teamMembers)
      .set({
        status: dto.status,
        // 불합격으로 바뀌면 이전에 저장된 링크를 지워 합격자 전용 정보가 남지 않게 한다.
        chatLink: dto.status === 'rejected' ? null : (dto.chatLink ?? member.chatLink),
      })
      .where(eq(teamMembers.id, memberId))
      .returning();

    await this.notificationsService.create(member.userId, 'team_matching', {
      teamId,
      status: dto.status,
      ...(dto.status === 'accepted' && dto.chatLink ? { chatLink: dto.chatLink } : {}),
    });
    return updated;
  }
}
