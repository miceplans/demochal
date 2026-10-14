import { describe, expect, it } from 'vitest';
import { createDbStub, createService } from './admin.test-helpers.js';

describe('AdminService — contents', () => {
  const team = {
    id: 't1',
    title: '세모팀',
    leaderRole: '기획',
    region: '서울',
    introduction: '같이 해요',
    preferred: '열정',
    etc: null,
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    openRoles: [
      { role: '프론트엔드', count: 1 },
      { role: '백엔드', count: 2 },
    ],
  };
  const challenge = {
    id: 'ch1',
    title: 'AI 챌린지',
    category: 'IT',
    summary: null,
    description: '공고 본문',
    startDate: new Date('2026-10-01T00:00:00.000Z'),
    price: 0,
    capacity: 10,
    prizeAmount: 500,
    targets: ['대학생'],
    hashtags: ['ai'],
    status: 'published',
    endDate: new Date(Date.now() + 3 * 86_400_000),
  };

  it('splits filled vs open roles, flags open reports and returns section totals', async () => {
    const { db } = createDbStub({
      select: [
        [{ count: 12 }], // teams total
        [{ team, challengeTitle: 'AI 챌린지', leaderName: '김팀장' }],
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
        leaderName: '김팀장',
        leaderRole: '기획',
        region: '서울',
        introduction: '같이 해요',
        preferred: '열정',
        etc: '',
        openRoles: team.openRoles,
        createdAt: '2026-10-01T00:00:00.000Z',
      },
    ]);
    expect(result.contests[0]).toMatchObject({
      id: 'ch1',
      teams: '팀 모집 1건',
      unread: true,
      description: '공고 본문',
      prizeAmount: 500,
      status: 'published',
    });
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
