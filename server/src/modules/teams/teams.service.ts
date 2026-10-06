import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, count, desc, eq, inArray, isNotNull, ne } from 'drizzle-orm';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import {
  applications,
  businesses,
  challenges,
  teamMembers,
  teams,
  users,
} from '../../db/schema.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { FilesService } from '../files/files.service.js';
import type { CreateTeamDto } from './dto/create-team.dto.js';
import type { InviteTeamDto } from './dto/invite-team.dto.js';
import type { UpdateTeamMemberDto } from './dto/update-team-member.dto.js';

export interface TeamListFilters {
  challengeId?: string;
  /** 콤마 구분 필요 역할 목록 — 하나라도 모집 중인 팀을 반환(OR). */
  role?: string;
  /** 콤마 구분 지역 목록 — 하나라도 일치하는 팀을 반환(OR, 정확 일치). */
  region?: string;
  q?: string;
}

/** 사람찾기 스카우트 제안은 팀당 이 횟수까지 보낼 수 있다(거절/취소돼도 차감). */
export const SCOUT_LIMIT_PER_TEAM = 3;

const splitList = (value?: string) =>
  (value ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

@Injectable()
export class TeamsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly notificationsService: NotificationsService,
    private readonly filesService: FilesService,
  ) {}

  // openRoles is jsonb, so the role filter scans slots in JS after one cheap
  // query; the table is small enough that this stays fast. Accepted members are
  // loaded in one extra query so list cards can show filled roles and headcount.
  async list(filters: TeamListFilters) {
    const rows = await this.db
      .select({
        team: teams,
        challengeTitle: challenges.title,
        challengePosterFileId: challenges.posterFileId,
        leaderName: users.name,
      })
      .from(teams)
      .innerJoin(challenges, eq(teams.challengeId, challenges.id))
      .innerJoin(users, eq(teams.leaderUserId, users.id))
      .where(eq(challenges.visibility, 'public'))
      .orderBy(desc(teams.createdAt));
    const q = filters.q?.toLowerCase();
    const regionList = splitList(filters.region);
    const roleList = splitList(filters.role);
    const matched = rows.filter(({ team }) => {
      if (filters.challengeId && team.challengeId !== filters.challengeId) return false;
      if (regionList.length && !regionList.includes(team.region ?? '')) return false;
      if (
        q &&
        !team.title.toLowerCase().includes(q) &&
        !(team.introduction ?? '').toLowerCase().includes(q)
      ) {
        return false;
      }
      if (
        roleList.length &&
        !(team.openRoles ?? []).some((slot) => roleList.includes(slot.role ?? ''))
      ) {
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
    // 포스터 URL은 서버가 함께 내린다 — 클라이언트가 파일 API를 직접 호출하면 업로더 소유권 검사에 막힌다.
    const posterUrls = await this.filesService.resolvePublicUrls(
      matched.map(({ challengePosterFileId }) => challengePosterFileId),
    );
    return matched.map(({ team, challengeTitle, challengePosterFileId, leaderName }) => ({
      ...team,
      challengeTitle,
      challengePosterFileId,
      challengePosterUrl: challengePosterFileId
        ? (posterUrls.get(challengePosterFileId) ?? null)
        : null,
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
      .where(and(eq(challenges.id, dto.challengeId), eq(challenges.visibility, 'public')))
      .limit(1);
    if (!challenge) throw new NotFoundException('챌린지를 찾을 수 없습니다.');

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
        challengePosterFileId: challenges.posterFileId,
        leaderName: users.name,
      })
      .from(teams)
      .innerJoin(challenges, eq(teams.challengeId, challenges.id))
      .innerJoin(users, eq(teams.leaderUserId, users.id))
      .where(eq(teams.id, id))
      .limit(1);
    if (!row) throw new NotFoundException('팀을 찾을 수 없습니다.');

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

    return {
      ...row.team,
      challengeTitle: row.challengeTitle,
      challengePosterFileId: row.challengePosterFileId,
      challengePosterUrl: await this.filesService.resolvePublicUrl(row.challengePosterFileId),
      leaderName: row.leaderName,
      members,
    };
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
    if (!team) throw new NotFoundException('팀을 찾을 수 없습니다.');
    if (team.leaderUserId === userId) {
      throw new BadRequestException('이미 이 팀의 리더입니다.');
    }

    const [existing] = await this.db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, id), eq(teamMembers.userId, userId)))
      .limit(1);
    if (existing) throw new BadRequestException('이미 이 팀에 신청하셨습니다.');

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

  // 프로필의 '팀에 초대' — 팀장이 특정 사용자를 팀에 초대한다. 지원과 달리 방향이
  // 리더→사용자이므로 member 행을 invited 상태로 만들고, 초대받는 사람이 수락/거절한다.
  async invite(id: string, dto: InviteTeamDto, user: AuthenticatedUser) {
    const [team] = await this.db.select().from(teams).where(eq(teams.id, id)).limit(1);
    if (!team) throw new NotFoundException('팀을 찾을 수 없습니다.');
    if (team.leaderUserId !== user.id && user.role !== 'admin') {
      throw new ForbiddenException('팀 리더만 팀원을 초대할 수 있습니다.');
    }
    if (dto.userId === team.leaderUserId) {
      throw new BadRequestException('리더는 이미 이 팀의 팀원입니다.');
    }

    const [target] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, dto.userId))
      .limit(1);
    if (!target) throw new NotFoundException('사용자를 찾을 수 없습니다.');

    const [existing] = await this.db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, id), eq(teamMembers.userId, dto.userId)))
      .limit(1);
    if (existing) throw new ConflictException('이미 지원하거나 초대된 멤버예요');

    // TODO: 동시 요청 시 한도를 넘을 수 있다 — 필요하면 팀 행 잠금(SELECT ... FOR UPDATE)으로 직렬화.
    const { used } = await this.countScouts(id);
    if (used >= SCOUT_LIMIT_PER_TEAM) {
      throw new ConflictException('이 팀의 스카우트 횟수를 모두 사용했어요');
    }

    const [member] = await this.db
      .insert(teamMembers)
      .values({
        teamId: id,
        userId: dto.userId,
        role: dto.role,
        status: 'invited',
        scoutedAt: new Date(),
        scoutMessage: dto.message?.trim() || null,
      })
      .returning();

    await this.notificationsService.create(dto.userId, 'team_matching', {
      teamId: id,
      invitedUserId: dto.userId,
      memberId: member!.id,
      ...(dto.role ? { role: dto.role } : {}),
    });
    return member;
  }

  private async countScouts(teamId: string) {
    const [row] = await this.db
      .select({ used: count() })
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), isNotNull(teamMembers.scoutedAt)));
    return { used: row?.used ?? 0 };
  }

  // 스카우트 제안 모달의 "남은 스카우트 n / 3". 팀장(또는 관리자)만 조회한다.
  async getScoutQuota(teamId: string, user: AuthenticatedUser) {
    const [team] = await this.db
      .select({ id: teams.id, leaderUserId: teams.leaderUserId })
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);
    if (!team) throw new NotFoundException('팀을 찾을 수 없습니다.');
    if (team.leaderUserId !== user.id && user.role !== 'admin') {
      throw new ForbiddenException('팀 리더만 스카우트 잔여 횟수를 조회할 수 있습니다.');
    }
    const { used } = await this.countScouts(teamId);
    return {
      limit: SCOUT_LIMIT_PER_TEAM,
      used,
      remaining: Math.max(0, SCOUT_LIMIT_PER_TEAM - used),
    };
  }

  // 제안 상세(`/offers/{memberId}`) — 받은 사람 본인, 보낸 팀장, 관리자만 볼 수 있다.
  async getOffer(memberId: string, user: AuthenticatedUser) {
    const [row] = await this.db
      .select({
        member: teamMembers,
        team: teams,
        challengeTitle: challenges.title,
      })
      .from(teamMembers)
      .innerJoin(teams, eq(teamMembers.teamId, teams.id))
      .innerJoin(challenges, eq(teams.challengeId, challenges.id))
      .where(eq(teamMembers.id, memberId))
      .limit(1);
    // 제안(초대)이 아닌 지원 행이거나 권한이 없으면 존재 여부를 숨기려 404로 통일한다.
    if (!row || row.member.scoutedAt === null)
      throw new NotFoundException('제안을 찾을 수 없습니다.');
    const { member, team, challengeTitle } = row;
    const isRecipient = member.userId === user.id;
    const isSender = team.leaderUserId === user.id;
    if (!isRecipient && !isSender && user.role !== 'admin') {
      throw new NotFoundException('제안을 찾을 수 없습니다.');
    }

    const [leader] = await this.db
      .select({ id: users.id, name: users.name, badges: users.badges })
      .from(users)
      .where(eq(users.id, team.leaderUserId))
      .limit(1);
    const [challengeRow] = await this.db
      .select({ total: count() })
      .from(applications)
      .where(eq(applications.userId, team.leaderUserId));
    const [memberRow] = await this.db
      .select({ accepted: count() })
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, team.id), eq(teamMembers.status, 'accepted')));

    const capacity = 1 + team.openRoles.reduce((sum, slot) => sum + slot.count, 0);
    return {
      id: member.id,
      teamId: team.id,
      status: member.status,
      role: member.role,
      message: member.scoutMessage,
      receivedAt: member.scoutedAt,
      team: {
        id: team.id,
        title: team.title,
        challengeTitle,
        introduction: team.introduction,
        status: team.status,
        // 팀장 포함 인원 / 정원(팀장 + 모집 슬롯 합계).
        memberCount: 1 + (memberRow?.accepted ?? 0),
        capacity,
      },
      sender: {
        id: leader?.id ?? team.leaderUserId,
        name: leader?.name ?? null,
        challengeCount: challengeRow?.total ?? 0,
        badgeCount: leader?.badges.length ?? 0,
      },
    };
  }

  async updateMember(
    teamId: string,
    memberId: string,
    dto: UpdateTeamMemberDto,
    user: AuthenticatedUser,
  ) {
    const [team] = await this.db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
    if (!team) throw new NotFoundException('팀을 찾을 수 없습니다.');
    const [member] = await this.db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.id, memberId), eq(teamMembers.teamId, teamId)))
      .limit(1);
    if (!member) throw new NotFoundException('팀원을 찾을 수 없습니다.');
    const isLeader = team.leaderUserId === user.id || user.role === 'admin';
    // 초대받은 사람은 본인의 초대(invited)에 한해 직접 수락/거절할 수 있다.
    const isInviteResponse = member.userId === user.id && member.status === 'invited';
    if (!isLeader && !isInviteResponse) {
      throw new ForbiddenException('팀 리더만 가입 신청을 처리할 수 있습니다.');
    }
    if (member.userId === team.leaderUserId) {
      throw new BadRequestException('리더는 자신의 멤버십을 변경할 수 없습니다.');
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

    if (isInviteResponse) {
      // 초대 수락 시에만 리더에게 알린다(거절은 지원자 관리 화면에서 확인).
      // inviteAccepted 마커로 '새 지원자' 알림과 설정 키를 분리한다.
      if (dto.status === 'accepted') {
        await this.notificationsService.create(team.leaderUserId, 'team_matching', {
          teamId,
          applicantUserId: member.userId,
          inviteAccepted: true,
        });
      }
    } else {
      await this.notificationsService.create(member.userId, 'team_matching', {
        teamId,
        status: dto.status,
        ...(dto.status === 'accepted' && dto.chatLink ? { chatLink: dto.chatLink } : {}),
      });
    }
    return updated;
  }
}
