import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { TeamsService } from './teams.service.js';

function createNotificationsStub() {
  return { create: vi.fn().mockResolvedValue({ id: 'notification-1' }) };
}

function selectChain(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const orderBy = vi.fn().mockResolvedValue(rows);
  // `.where()` is awaited directly on join queries and chained into
  // `.limit()`/`.orderBy()` on others; a real promise carrying the chain
  // props satisfies both shapes.
  const whereResult = Object.assign(Promise.resolve(rows), { limit, orderBy });
  const where = vi.fn().mockReturnValue(whereResult);
  const joinTarget: { where: unknown; innerJoin: unknown } = { where, innerJoin: undefined };
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
  it('list filters by challenge, region, title substring, and open role slot', async () => {
    const rows = [
      {
        id: 'team-1',
        challengeId: 'challenge-1',
        title: 'AI 해커톤 팀',
        region: '서울',
        openRoles: [{ role: '개발', count: 2 }],
      },
      {
        id: 'team-2',
        challengeId: 'challenge-1',
        title: 'Design Sprint',
        region: '부산',
        openRoles: [{ role: '디자인', count: 1 }],
      },
      {
        id: 'team-3',
        challengeId: 'challenge-2',
        title: 'ai 스터디',
        region: '서울',
        openRoles: null,
      },
    ];
    const db = createDbStub();
    db.select.mockReturnValue(selectChain(rows));
    const service = new TeamsService(db, createNotificationsStub() as any);

    const result = await service.list({
      challengeId: 'challenge-1',
      region: '서울',
      q: '해커톤',
      role: '개발',
    });

    expect(result.map((team) => team.id)).toEqual(['team-1']);
  });

  it('create throws 404 when the challenge does not exist', async () => {
    const db = createDbStub();
    db.select.mockReturnValue(selectChain([]));
    const service = new TeamsService(db, createNotificationsStub() as any);

    await expect(service.create(createDto as any, leader.id)).rejects.toThrow(NotFoundException);
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
    const service = new TeamsService(db, createNotificationsStub() as any);

    const result = await service.create(createDto as any, leader.id);

    expect(teamValues).toHaveBeenCalledWith(
      expect.objectContaining({ leaderUserId: leader.id, status: 'recruiting', openRoles: [] }),
    );
    expect(memberValues).toHaveBeenCalledWith({
      teamId: 'team-1',
      userId: leader.id,
      role: '기획',
      status: 'accepted',
    });
    expect(result).toEqual(teamRow);
  });

  it('findById joins challenge title, leader name, and members', async () => {
    const db = createDbStub();
    db.select
      .mockReturnValueOnce(
        selectChain([
          {
            team: { id: 'team-1', title: 'AI 해커톤 팀' },
            challengeTitle: '2026 AI 챌린지',
            leaderName: 'Leader',
          },
        ]),
      )
      .mockReturnValueOnce(
        selectChain([
          { id: 'member-1', userId: leader.id, name: 'Leader', role: '기획', status: 'accepted' },
        ]),
      );
    const service = new TeamsService(db, createNotificationsStub() as any);

    const result = await service.findById('team-1');

    expect(result.challengeTitle).toBe('2026 AI 챌린지');
    expect(result.leaderName).toBe('Leader');
    expect(result.members).toHaveLength(1);
    expect(result.members[0]).toMatchObject({ userId: leader.id, status: 'accepted' });
  });

  it('join throws 404 for a missing team', async () => {
    const db = createDbStub();
    db.select.mockReturnValue(selectChain([]));
    const service = new TeamsService(db, createNotificationsStub() as any);

    await expect(service.join('team-x', '개발', applicant.id)).rejects.toThrow(NotFoundException);
  });

  it('join blocks the leader and duplicate applicants with 400', async () => {
    const db = createDbStub();
    db.select
      .mockReturnValueOnce(selectChain([{ id: 'team-1', leaderUserId: leader.id }]))
      .mockReturnValueOnce(selectChain([{ id: 'team-1', leaderUserId: leader.id }]))
      .mockReturnValueOnce(selectChain([{ id: 'member-1' }]));
    const service = new TeamsService(db, createNotificationsStub() as any);

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
    const service = new TeamsService(db, notifications as any);

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
    const service = new TeamsService(db, notifications as any);

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
    const service = new TeamsService(db, notifications as any);

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
    const service = new TeamsService(db, createNotificationsStub() as any);

    await expect(
      service.updateMember('team-1', 'member-x', { status: 'accepted' }, leader),
    ).rejects.toThrow(NotFoundException);
  });
});
