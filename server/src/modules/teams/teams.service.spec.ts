import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { TeamsService } from './teams.service.js';

function createNotificationsStub() {
  return { create: vi.fn().mockResolvedValue({ id: 'notification-1' }) };
}

// 파일 URL 해결은 FilesService 책임 — 팀 서비스 스펙에서는 고정 맵을 돌려주는 스텁으로 둔다.
function createFilesStub(urls: Record<string, string | null> = {}) {
  return {
    resolvePublicUrl: vi.fn(async (id: string | null | undefined) =>
      id ? (urls[id] ?? null) : null,
    ),
    resolvePublicUrls: vi.fn(async (ids: (string | null | undefined)[]) => {
      return new Map(
        ids.filter((id): id is string => Boolean(id)).map((id) => [id, urls[id] ?? null]),
      );
    }),
  };
}

function selectChain(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const orderBy = vi.fn().mockResolvedValue(rows);
  // `.where()` is awaited directly on join queries and chained into
  // `.limit()`/`.orderBy()` on others; a real promise carrying the chain
  // props satisfies both shapes.
  const whereResult = Object.assign(Promise.resolve(rows), { limit, orderBy });
  const where = vi.fn().mockReturnValue(whereResult);
  const joinTarget: { where: unknown; innerJoin: unknown; orderBy: unknown } = {
    where,
    innerJoin: undefined,
    orderBy,
  };
  joinTarget.innerJoin = vi.fn().mockReturnValue(joinTarget);
  const from = vi.fn().mockReturnValue({ where, orderBy, innerJoin: joinTarget.innerJoin });
  return { from };
}

function createDbStub() {
  const db: any = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  };
  return db;
}

const leader: AuthenticatedUser = {
  id: 'user-leader',
  email: 'l@x.com',
  name: 'Leader',
  role: 'user',
};
const applicant: AuthenticatedUser = {
  id: 'user-applicant',
  email: 'a@x.com',
  name: 'Applicant',
  role: 'user',
};

const createDto = {
  challengeId: 'challenge-1',
  title: 'AI 해커톤 팀',
  myRole: '기획',
  region: '서울',
};

describe('TeamsService', () => {
  it('list filters by challenge, region, title/introduction substring, and open role slot', async () => {
    const rows = [
      {
        id: 'team-1',
        challengeId: 'challenge-1',
        title: 'AI 해커톤 팀',
        introduction: null,
        region: '서울',
        openRoles: [{ role: '개발', count: 2 }],
      },
      {
        id: 'team-2',
        challengeId: 'challenge-1',
        title: 'Design Sprint',
        introduction: null,
        region: '부산',
        openRoles: [{ role: '디자인', count: 1 }],
      },
      {
        id: 'team-3',
        challengeId: 'challenge-2',
        title: 'ai 스터디',
        introduction: null,
        region: '서울',
        openRoles: null,
      },
      {
        id: 'team-4',
        challengeId: 'challenge-1',
        title: 'Leader의 팀',
        introduction: '공공데이터 해커톤 같이 나가요',
        region: '서울',
        openRoles: [{ role: '개발', count: 1 }],
      },
    ].map((team) => ({ team, challengeTitle: '2026 AI 챌린지', leaderName: 'Leader' }));
    const db = createDbStub();
    db.select.mockReturnValueOnce(selectChain(rows)).mockReturnValueOnce(
      selectChain([
        { teamId: 'team-1', role: '기획' },
        { teamId: 'team-4', role: null },
      ]),
    );
    const service = new TeamsService(
      db,
      createNotificationsStub() as any,
      createFilesStub() as any,
    );

    const result = await service.list({
      challengeId: 'challenge-1',
      region: '서울',
      q: '해커톤',
      role: '개발',
    });

    expect(result.map((team) => team.id)).toEqual(['team-1', 'team-4']);
    expect(result[0]).toMatchObject({
      challengeTitle: '2026 AI 챌린지',
      leaderName: 'Leader',
      filledRoles: ['기획'],
    });
    expect(result[1]?.filledRoles).toEqual([]);
  });

  it('list resolves challengePosterUrl through the files service', async () => {
    const rows = [
      {
        team: { id: 'team-1', challengeId: 'challenge-1', region: '서울' },
        challengeTitle: '2026 AI 챌린지',
        challengePosterFileId: 'file-poster-1',
        leaderName: 'Leader',
      },
      {
        team: { id: 'team-2', challengeId: 'challenge-2', region: '서울' },
        challengeTitle: '포스터 없는 챌린지',
        challengePosterFileId: null,
        leaderName: 'Leader',
      },
    ];
    const db = createDbStub();
    db.select.mockReturnValueOnce(selectChain(rows)).mockReturnValueOnce(selectChain([]));
    const files = createFilesStub({
      'file-poster-1': 'https://cdn.example.com/uploads/poster.webp',
    });
    const service = new TeamsService(db, createNotificationsStub() as any, files as any);

    const result = await service.list({});

    expect(result[0]?.challengePosterUrl).toBe('https://cdn.example.com/uploads/poster.webp');
    expect(result[1]?.challengePosterUrl).toBeNull();
  });

  it('list accepts comma-separated regions and roles (OR)', async () => {
    const rows = [
      { id: 'team-1', region: '서울', openRoles: [{ role: '개발', count: 1 }] },
      { id: 'team-2', region: '부산', openRoles: [{ role: '디자인', count: 1 }] },
      { id: 'team-3', region: '제주', openRoles: [{ role: '개발', count: 1 }] },
      { id: 'team-4', region: '서울', openRoles: [{ role: '기획', count: 1 }] },
    ].map((team) => ({
      team: { challengeId: 'c', title: 't', introduction: null, ...team },
      challengeTitle: 'c',
      leaderName: 'Leader',
    }));
    const db = createDbStub();
    db.select.mockReturnValueOnce(selectChain(rows)).mockReturnValueOnce(selectChain([]));
    const service = new TeamsService(
      db,
      createNotificationsStub() as any,
      createFilesStub() as any,
    );

    const result = await service.list({ region: '서울,부산', role: '개발,디자인' });

    expect(result.map((team) => team.id)).toEqual(['team-1', 'team-2']);
  });

  it('list skips the member query when nothing matches', async () => {
    const db = createDbStub();
    db.select.mockReturnValueOnce(selectChain([]));
    const service = new TeamsService(
      db,
      createNotificationsStub() as any,
      createFilesStub() as any,
    );

    await expect(service.list({})).resolves.toEqual([]);
    expect(db.select).toHaveBeenCalledTimes(1);
  });

  it('create throws 404 when the challenge does not exist', async () => {
    const db = createDbStub();
    db.select.mockReturnValue(selectChain([]));
    const service = new TeamsService(
      db,
      createNotificationsStub() as any,
      createFilesStub() as any,
    );

    await expect(service.create(createDto as any, leader)).rejects.toThrow(NotFoundException);
  });

  it('create inserts the team and an accepted member row for the leader', async () => {
    const teamRow = { id: 'team-1', ...createDto, leaderUserId: leader.id, status: 'recruiting' };
    const db = createDbStub();
    db.select.mockReturnValue(selectChain([{ id: 'challenge-1' }]));
    const teamValues = vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([teamRow]) });
    const memberValues = vi.fn().mockResolvedValue(undefined);
    db.insert = vi
      .fn()
      .mockReturnValueOnce({ values: teamValues })
      .mockReturnValueOnce({ values: memberValues });
    const service = new TeamsService(
      db,
      createNotificationsStub() as any,
      createFilesStub() as any,
    );

    const result = await service.create(createDto as any, leader);

    expect(teamValues).toHaveBeenCalledWith(
      expect.objectContaining({
        leaderUserId: leader.id,
        title: 'AI 해커톤 팀',
        leaderRole: '기획',
        status: 'recruiting',
        openRoles: [],
      }),
    );
    expect(memberValues).toHaveBeenCalledWith({
      teamId: 'team-1',
      userId: leader.id,
      role: '기획',
      status: 'accepted',
    });
    expect(result).toEqual(teamRow);
  });

  it('create stores the survey fields and defaults the title to the leader name', async () => {
    const db = createDbStub();
    db.select.mockReturnValue(selectChain([{ id: 'challenge-1' }]));
    const teamValues = vi
      .fn()
      .mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'team-1' }]) });
    db.insert = vi
      .fn()
      .mockReturnValueOnce({ values: teamValues })
      .mockReturnValueOnce({ values: vi.fn().mockResolvedValue(undefined) });
    const service = new TeamsService(
      db,
      createNotificationsStub() as any,
      createFilesStub() as any,
    );

    await service.create(
      {
        challengeId: 'challenge-1',
        title: '  ',
        myRole: '프론트엔드',
        introduction: '다정한 팀입니다',
        preferred: '팔로워 성향',
        etc: '없음',
      } as any,
      leader,
    );

    expect(teamValues).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Leader의 팀',
        introduction: '다정한 팀입니다',
        preferred: '팔로워 성향',
        etc: '없음',
      }),
    );
  });

  it('findById joins challenge title, leader name, and members', async () => {
    const db = createDbStub();
    db.select
      .mockReturnValueOnce(
        selectChain([
          {
            team: { id: 'team-1', title: 'AI 해커톤 팀' },
            challengeTitle: '2026 AI 챌린지',
            challengePosterFileId: 'file-poster-1',
            leaderName: 'Leader',
          },
        ]),
      )
      .mockReturnValueOnce(
        selectChain([
          { id: 'member-1', userId: leader.id, name: 'Leader', role: '기획', status: 'accepted' },
        ]),
      );
    const service = new TeamsService(
      db,
      createNotificationsStub() as any,
      createFilesStub({ 'file-poster-1': 'https://cdn.example.com/uploads/poster.webp' }) as any,
    );

    const result = await service.findById('team-1');

    expect(result.challengeTitle).toBe('2026 AI 챌린지');
    expect(result.challengePosterFileId).toBe('file-poster-1');
    expect(result.challengePosterUrl).toBe('https://cdn.example.com/uploads/poster.webp');
    expect(result.leaderName).toBe('Leader');
    expect(result.members).toHaveLength(1);
    expect(result.members[0]).toMatchObject({ userId: leader.id, status: 'accepted' });
  });

  it('join throws 404 for a missing team', async () => {
    const db = createDbStub();
    db.select.mockReturnValue(selectChain([]));
    const service = new TeamsService(
      db,
      createNotificationsStub() as any,
      createFilesStub() as any,
    );

    await expect(service.join('team-x', '개발', applicant.id)).rejects.toThrow(NotFoundException);
  });

  it('join blocks the leader and duplicate applicants with 400', async () => {
    const db = createDbStub();
    db.select
      .mockReturnValueOnce(selectChain([{ id: 'team-1', leaderUserId: leader.id }]))
      .mockReturnValueOnce(selectChain([{ id: 'team-1', leaderUserId: leader.id }]))
      .mockReturnValueOnce(selectChain([{ id: 'member-1' }]));
    const service = new TeamsService(
      db,
      createNotificationsStub() as any,
      createFilesStub() as any,
    );

    await expect(service.join('team-1', undefined, leader.id)).rejects.toThrow(BadRequestException);
    await expect(service.join('team-1', '개발', applicant.id)).rejects.toThrow(BadRequestException);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('join inserts a pending member and notifies the leader', async () => {
    const memberRow = {
      id: 'member-2',
      teamId: 'team-1',
      userId: applicant.id,
      role: '개발',
      status: 'pending',
    };
    const db = createDbStub();
    db.select
      .mockReturnValueOnce(selectChain([{ id: 'team-1', leaderUserId: leader.id }]))
      .mockReturnValueOnce(selectChain([]));
    const values = vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([memberRow]) });
    db.insert = vi.fn().mockReturnValue({ values });
    const notifications = createNotificationsStub();
    const service = new TeamsService(db, notifications as any, createFilesStub() as any);

    const result = await service.join('team-1', '개발', applicant.id);

    expect(values).toHaveBeenCalledWith({
      teamId: 'team-1',
      userId: applicant.id,
      role: '개발',
      status: 'pending',
    });
    expect(notifications.create).toHaveBeenCalledWith(leader.id, 'team_matching', {
      teamId: 'team-1',
      applicantUserId: applicant.id,
      role: '개발',
    });
    expect(result).toEqual(memberRow);
  });

  it('updateMember throws 403 for non-leaders but allows admins', async () => {
    const db = createDbStub();
    db.select
      .mockReturnValueOnce(selectChain([{ id: 'team-1', leaderUserId: leader.id }]))
      .mockReturnValueOnce(selectChain([{ id: 'member-1', userId: applicant.id }]))
      .mockReturnValueOnce(selectChain([{ id: 'team-1', leaderUserId: leader.id }]))
      .mockReturnValueOnce(selectChain([{ id: 'member-1', userId: applicant.id }]));
    const returning = vi.fn().mockResolvedValue([{ id: 'member-1', status: 'accepted' }]);
    db.update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning }) }),
    });
    const notifications = createNotificationsStub();
    const service = new TeamsService(db, notifications as any, createFilesStub() as any);

    await expect(
      service.updateMember('team-1', 'member-1', { status: 'accepted' }, applicant),
    ).rejects.toThrow(ForbiddenException);

    const admin: AuthenticatedUser = { ...applicant, role: 'admin' };
    await service.updateMember('team-1', 'member-1', { status: 'accepted' }, admin);
    expect(returning).toHaveBeenCalled();
  });

  it('updateMember notifies the applicant with the decision', async () => {
    const db = createDbStub();
    db.select
      .mockReturnValueOnce(selectChain([{ id: 'team-1', leaderUserId: leader.id }]))
      .mockReturnValueOnce(selectChain([{ id: 'member-1', userId: applicant.id }]));
    const updated = { id: 'member-1', status: 'rejected' };
    const returning = vi.fn().mockResolvedValue([updated]);
    db.update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning }) }),
    });
    const notifications = createNotificationsStub();
    const service = new TeamsService(db, notifications as any, createFilesStub() as any);

    const result = await service.updateMember('team-1', 'member-1', { status: 'rejected' }, leader);

    expect(result).toEqual(updated);
    expect(notifications.create).toHaveBeenCalledWith(applicant.id, 'team_matching', {
      teamId: 'team-1',
      status: 'rejected',
    });
  });

  it('updateMember throws 404 when the member row is missing', async () => {
    const db = createDbStub();
    db.select
      .mockReturnValueOnce(selectChain([{ id: 'team-1', leaderUserId: leader.id }]))
      .mockReturnValueOnce(selectChain([]));
    const service = new TeamsService(
      db,
      createNotificationsStub() as any,
      createFilesStub() as any,
    );

    await expect(
      service.updateMember('team-1', 'member-x', { status: 'accepted' }, leader),
    ).rejects.toThrow(NotFoundException);
  });

  it('updateMember throws 400 when the leader decides their own membership', async () => {
    const db = createDbStub();
    db.select
      .mockReturnValueOnce(selectChain([{ id: 'team-1', leaderUserId: leader.id }]))
      .mockReturnValueOnce(
        selectChain([{ id: 'member-1', userId: leader.id, status: 'accepted' }]),
      );
    const service = new TeamsService(
      db,
      createNotificationsStub() as any,
      createFilesStub() as any,
    );

    await expect(
      service.updateMember('team-1', 'member-1', { status: 'rejected' }, leader),
    ).rejects.toThrow(BadRequestException);
    expect(db.update).not.toHaveBeenCalled();
  });

  it('updateMember stores the chat link for accepted members and includes it in the notification', async () => {
    const db = createDbStub();
    db.select
      .mockReturnValueOnce(selectChain([{ id: 'team-1', leaderUserId: leader.id }]))
      .mockReturnValueOnce(
        selectChain([{ id: 'member-1', userId: applicant.id, status: 'pending', chatLink: null }]),
      );
    const set = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'member-1', status: 'accepted' }]),
      }),
    });
    db.update = vi.fn().mockReturnValue({ set });
    const notifications = createNotificationsStub();
    const service = new TeamsService(db, notifications as any, createFilesStub() as any);

    await service.updateMember(
      'team-1',
      'member-1',
      { status: 'accepted', chatLink: 'https://open.kakao.com/o/abc' },
      leader,
    );

    expect(set).toHaveBeenCalledWith({
      status: 'accepted',
      chatLink: 'https://open.kakao.com/o/abc',
    });
    expect(notifications.create).toHaveBeenCalledWith(applicant.id, 'team_matching', {
      teamId: 'team-1',
      status: 'accepted',
      chatLink: 'https://open.kakao.com/o/abc',
    });
  });

  it('updateMember clears the chat link when a member is rejected', async () => {
    const db = createDbStub();
    db.select
      .mockReturnValueOnce(selectChain([{ id: 'team-1', leaderUserId: leader.id }]))
      .mockReturnValueOnce(
        selectChain([
          {
            id: 'member-1',
            userId: applicant.id,
            status: 'accepted',
            chatLink: 'https://open.kakao.com/o/abc',
          },
        ]),
      );
    const set = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'member-1', status: 'rejected' }]),
      }),
    });
    db.update = vi.fn().mockReturnValue({ set });
    const service = new TeamsService(
      db,
      createNotificationsStub() as any,
      createFilesStub() as any,
    );

    await service.updateMember('team-1', 'member-1', { status: 'rejected' }, leader);

    expect(set).toHaveBeenCalledWith({ status: 'rejected', chatLink: null });
  });

  it('listMyApplications returns applied teams with titles, excluding teams I lead', async () => {
    const rows = [
      {
        member: { id: 'member-1', teamId: 'team-1', userId: applicant.id, status: 'pending' },
        teamTitle: 'AI 해커톤 팀',
        challengeTitle: '2026 AI 챌린지',
      },
      {
        member: { id: 'member-2', teamId: 'team-2', userId: applicant.id, status: 'accepted' },
        teamTitle: 'Leader의 팀',
        challengeTitle: '공공데이터 챌린지',
      },
    ];
    const db = createDbStub();
    db.select.mockReturnValueOnce(selectChain(rows));
    const service = new TeamsService(
      db,
      createNotificationsStub() as any,
      createFilesStub() as any,
    );

    const result = await service.listMyApplications(applicant.id);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: 'member-1',
      status: 'pending',
      teamTitle: 'AI 해커톤 팀',
      challengeTitle: '2026 AI 챌린지',
    });
  });

  it('listManaged returns my teams with applicants, excluding my own member row', async () => {
    const db = createDbStub();
    db.select
      .mockReturnValueOnce(
        selectChain([
          {
            team: { id: 'team-1', title: 'AI 해커톤 팀', leaderUserId: leader.id },
            challengeTitle: '2026 AI 챌린지',
            businessName: '한국데이터산업진흥원',
          },
        ]),
      )
      .mockReturnValueOnce(
        // SQL(ne) already drops the leader's own row before rows reach the service.
        selectChain([
          {
            id: 'member-1',
            teamId: 'team-1',
            userId: applicant.id,
            name: 'Applicant',
            role: '개발',
            status: 'pending',
            chatLink: null,
            createdAt: '2026-09-01T00:00:00.000Z',
          },
        ]),
      );
    const service = new TeamsService(
      db,
      createNotificationsStub() as any,
      createFilesStub() as any,
    );

    const result = await service.listManaged(leader.id);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'team-1',
      challengeTitle: '2026 AI 챌린지',
      businessName: '한국데이터산업진흥원',
    });
    expect(result[0]?.members).toHaveLength(1);
    expect(result[0]?.members[0]).toMatchObject({ id: 'member-1', name: 'Applicant' });
  });

  it('listManaged skips the member query when I lead no teams', async () => {
    const db = createDbStub();
    db.select.mockReturnValueOnce(selectChain([]));
    const service = new TeamsService(
      db,
      createNotificationsStub() as any,
      createFilesStub() as any,
    );

    await expect(service.listManaged(leader.id)).resolves.toEqual([]);
    expect(db.select).toHaveBeenCalledTimes(1);
  });

  it('invite throws 403 for non-leaders', async () => {
    const db = createDbStub();
    db.select.mockReturnValue(selectChain([{ id: 'team-1', leaderUserId: leader.id }]));
    const service = new TeamsService(
      db,
      createNotificationsStub() as any,
      createFilesStub() as any,
    );

    await expect(service.invite('team-1', { userId: 'user-x' }, applicant)).rejects.toThrow(
      ForbiddenException,
    );
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('invite throws 400 for the leader themselves and 404 for a missing user or team', async () => {
    const db = createDbStub();
    db.select
      .mockReturnValueOnce(selectChain([{ id: 'team-1', leaderUserId: leader.id }]))
      .mockReturnValueOnce(selectChain([{ id: 'team-1', leaderUserId: leader.id }]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]));
    const service = new TeamsService(
      db,
      createNotificationsStub() as any,
      createFilesStub() as any,
    );

    await expect(service.invite('team-1', { userId: leader.id }, leader)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.invite('team-1', { userId: 'user-x' }, leader)).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.invite('team-x', { userId: applicant.id }, leader)).rejects.toThrow(
      NotFoundException,
    );
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('invite throws 409 when the user already applied or was invited', async () => {
    const db = createDbStub();
    db.select
      .mockReturnValueOnce(selectChain([{ id: 'team-1', leaderUserId: leader.id }]))
      .mockReturnValueOnce(selectChain([{ id: applicant.id }]))
      .mockReturnValueOnce(selectChain([{ id: 'member-1' }]));
    const service = new TeamsService(
      db,
      createNotificationsStub() as any,
      createFilesStub() as any,
    );

    await expect(service.invite('team-1', { userId: applicant.id }, leader)).rejects.toThrow(
      ConflictException,
    );
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('invite inserts an invited member and notifies the invitee', async () => {
    const memberRow = {
      id: 'member-9',
      teamId: 'team-1',
      userId: applicant.id,
      role: '백엔드',
      status: 'invited',
    };
    const db = createDbStub();
    db.select
      .mockReturnValueOnce(selectChain([{ id: 'team-1', leaderUserId: leader.id }]))
      .mockReturnValueOnce(selectChain([{ id: applicant.id }]))
      .mockReturnValueOnce(selectChain([]));
    const values = vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([memberRow]) });
    db.insert = vi.fn().mockReturnValue({ values });
    const notifications = createNotificationsStub();
    const service = new TeamsService(db, notifications as any, createFilesStub() as any);

    const result = await service.invite('team-1', { userId: applicant.id, role: '백엔드' }, leader);

    expect(values).toHaveBeenCalledWith({
      teamId: 'team-1',
      userId: applicant.id,
      role: '백엔드',
      status: 'invited',
    });
    expect(notifications.create).toHaveBeenCalledWith(applicant.id, 'team_matching', {
      teamId: 'team-1',
      invitedUserId: applicant.id,
      memberId: 'member-9',
      role: '백엔드',
    });
    expect(result).toEqual(memberRow);
  });

  it('updateMember lets the invitee accept their own invite and notifies the leader', async () => {
    const db = createDbStub();
    db.select
      .mockReturnValueOnce(selectChain([{ id: 'team-1', leaderUserId: leader.id }]))
      .mockReturnValueOnce(
        selectChain([{ id: 'member-9', userId: applicant.id, status: 'invited', chatLink: null }]),
      );
    const set = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'member-9', status: 'accepted' }]),
      }),
    });
    db.update = vi.fn().mockReturnValue({ set });
    const notifications = createNotificationsStub();
    const service = new TeamsService(db, notifications as any, createFilesStub() as any);

    await service.updateMember('team-1', 'member-9', { status: 'accepted' }, applicant);

    expect(set).toHaveBeenCalledWith({ status: 'accepted', chatLink: null });
    expect(notifications.create).toHaveBeenCalledWith(leader.id, 'team_matching', {
      teamId: 'team-1',
      applicantUserId: applicant.id,
      inviteAccepted: true,
    });
  });

  it('updateMember invite rejection stores the decision without notifying the leader', async () => {
    const db = createDbStub();
    db.select
      .mockReturnValueOnce(selectChain([{ id: 'team-1', leaderUserId: leader.id }]))
      .mockReturnValueOnce(
        selectChain([{ id: 'member-9', userId: applicant.id, status: 'invited', chatLink: null }]),
      );
    const set = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'member-9', status: 'rejected' }]),
      }),
    });
    db.update = vi.fn().mockReturnValue({ set });
    const notifications = createNotificationsStub();
    const service = new TeamsService(db, notifications as any, createFilesStub() as any);

    await service.updateMember('team-1', 'member-9', { status: 'rejected' }, applicant);

    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('updateMember still forbids a non-leader deciding an application that is not their invite', async () => {
    const db = createDbStub();
    db.select
      .mockReturnValueOnce(selectChain([{ id: 'team-1', leaderUserId: leader.id }]))
      .mockReturnValueOnce(
        selectChain([{ id: 'member-1', userId: applicant.id, status: 'pending' }]),
      );
    const service = new TeamsService(
      db,
      createNotificationsStub() as any,
      createFilesStub() as any,
    );

    await expect(
      service.updateMember('team-1', 'member-1', { status: 'accepted' }, applicant),
    ).rejects.toThrow(ForbiddenException);
  });
});
