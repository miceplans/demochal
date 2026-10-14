import { NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { createDbStub, createService } from './admin.test-helpers.js';

describe('AdminService — contents', () => {
  const team = {
    id: 't1',
    title: '세모팀',
    openRoles: [
      { role: '프론트엔드', count: 1 },
      { role: '백엔드', count: 2 },
    ],
  };
  const challenge = {
    id: 'ch1',
    title: 'AI 챌린지',
    category: 'IT',
    endDate: new Date(Date.now() + 3 * 86_400_000),
  };

  it('splits filled vs open roles, flags open reports and returns section totals', async () => {
    const { db } = createDbStub({
      select: [
        [{ count: 12 }], // teams total
        [{ team, challengeTitle: 'AI 챌린지' }],
        [
          { teamId: 't1', role: '프론트엔드', count: 1 },
          { teamId: 't1', role: '백엔드', count: 1 },
        ],
        [{ count: 30 }], // challenges total
        [challenge],
        [{ challengeId: 'ch1', count: 1 }],
        [{ targetId: 'ch1' }], // open report on the challenge only
        [],
      ],
    });
    const { service } = createService(db);

    const result = await service.getContents();

    expect(result.teams).toEqual([
      {
        id: 't1',
        name: '세모팀',
        challenge: 'AI 챌린지',
        roles: ['프론트엔드'],
        otherRoles: ['백엔드'],
        members: '2/4명 참여중',
        unread: false,
      },
    ]);
    expect(result.contests[0]).toMatchObject({ id: 'ch1', teams: '팀 모집 1건', unread: true });
    expect(result.teamsTotal).toBe(12);
    expect(result.contestsTotal).toBe(30);
  });

  it('clamps section limits to 1..50 with a default page of 8', async () => {
    const { db, limitCalls } = createDbStub();
    const { service } = createService(db);

    await service.getContents('500', 'abc');

    // teams, challenges, then the fixed 5-row report log.
    expect(limitCalls.map((args) => args[0])).toEqual([50, 8, 5]);
  });
});

describe('AdminService — content detail', () => {
  it('returns a team with its members and reports, 404 when missing', async () => {
    const team = {
      id: 't1',
      title: '세모팀',
      challengeId: 'ch1',
      status: 'recruiting',
      leaderRole: null,
      region: null,
      introduction: '같이 해요',
      preferred: null,
      etc: null,
      openRoles: [{ role: '백엔드', count: 1 }],
      createdAt: new Date('2026-10-01T00:00:00.000Z'),
    };
    const report = {
      id: 'r1',
      content: '세모팀',
      targetType: 'team',
      org: null,
      summary: '스팸',
      detail: null,
      reporterName: '김*아',
      createdAt: new Date('2026-10-02T00:00:00.000Z'),
      status: 'open',
    };
    const { db } = createDbStub({
      select: [
        [{ team, challengeTitle: 'AI 챌린지', leaderName: '김팀장' }],
        [{ name: '이팀원', role: '백엔드' }],
        [report],
      ],
    });
    const result = await createService(db).service.getTeamDetail('t1');
    expect(result).toMatchObject({
      name: '세모팀',
      challenge: 'AI 챌린지',
      leaderName: '김팀장',
      introduction: '같이 해요',
      preferred: '',
      members: [{ name: '이팀원', role: '백엔드' }],
    });
    expect(result.reports).toHaveLength(1);

    const missing = createService(createDbStub({ select: [[]] }).db).service;
    await expect(missing.getTeamDetail('x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns a challenge with organization and team count, 404 when missing', async () => {
    const challenge = {
      id: 'ch1',
      title: 'AI 챌린지',
      status: 'published',
      category: null,
      summary: null,
      description: '본문',
      startDate: new Date('2026-10-01T00:00:00.000Z'),
      endDate: new Date('2026-11-01T00:00:00.000Z'),
      price: 0,
      capacity: 10,
      prizeAmount: null,
      targets: null,
      hashtags: ['ai'],
      recruitMethod: 'external',
      recruitUrl: null,
      createdAt: new Date('2026-09-30T00:00:00.000Z'),
    };
    const { db } = createDbStub({
      select: [
        [{ challenge, organization: '세모기관' }],
        [{ id: 't1', title: '세모팀', status: 'recruiting', leaderName: '김팀장' }],
        [],
      ],
    });
    const result = await createService(db).service.getChallengeDetail('ch1');
    expect(result).toMatchObject({
      organization: '세모기관',
      description: '본문',
      teams: [{ id: 't1', name: '세모팀', leaderName: '김팀장', status: 'recruiting' }],
      targets: [],
      reports: [],
    });

    const missing = createService(createDbStub({ select: [[]] }).db).service;
    await expect(missing.getChallengeDetail('x')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('AdminService — confirm', () => {
  it('stamps adminReviewedAt on a team/challenge and 404s when missing', async () => {
    const team = createDbStub({ update: [[{ id: 't1' }], [{ id: 'r1' }, { id: 'r2' }]] });
    await expect(createService(team.db).service.confirmTeam('t1')).resolves.toEqual({
      id: 't1',
      confirmed: true,
      resolvedReports: 2,
    });
    expect(team.setCalls[0]?.[0]).toHaveProperty('adminReviewedAt');
    expect(team.setCalls[1]?.[0]).toMatchObject({ status: 'resolved' });

    const challenge = createDbStub({ update: [[{ id: 'c1' }], []] });
    await expect(createService(challenge.db).service.confirmChallenge('c1')).resolves.toEqual({
      id: 'c1',
      confirmed: true,
      resolvedReports: 0,
    });

    const missing = createService(createDbStub({ update: [[]] }).db).service;
    await expect(missing.confirmTeam('x')).rejects.toBeInstanceOf(NotFoundException);
    await expect(missing.confirmChallenge('x')).rejects.toBeInstanceOf(NotFoundException);
  });
});
