import { describe, expect, it } from 'vitest';
import type { Contest, Team } from '@/data/user-design';
import { getHomeFallbackData } from './home-data';

describe('getHomeFallbackData', () => {
  const fallbackContests: Contest[] = [
    { id: 'fallback-contest', title: 'Fallback contest', category: '기타', days: 1 },
  ];
  const fallbackTeams: Team[] = [
    {
      id: 'fallback-team',
      name: 'Fallback team',
      challenge: 'Fallback contest',
      poster: '',
      members: '1/2명 참여중',
      joined: 1,
      capacity: 2,
      filledRoles: [],
      recruitingRoles: ['기획'],
    },
  ];
  const liveContest: Contest = {
    id: 'live-contest',
    title: 'Live contest',
    category: 'IT/SW',
    days: 3,
  };
  const liveTeam: Team = { ...fallbackTeams[0], id: 'live-team', name: 'Live team' };

  function getData({
    recommendationContests = [],
    deadlineContests = [],
    teams = [],
  }: Partial<Parameters<typeof getHomeFallbackData>[0]> = {}) {
    return getHomeFallbackData({
      recommendationContests,
      deadlineContests,
      teams,
      fallbackContests,
      fallbackTeams,
    });
  }

  it('fills all home rails with mocks when API lists are empty', () => {
    expect(getData()).toMatchObject({
      recommendationContests: fallbackContests,
      deadlineContests: fallbackContests,
      teams: fallbackTeams,
      isFallbackTeamList: true,
    });
  });

  it('keeps non-empty API lists ahead of each fallback independently', () => {
    expect(
      getData({
        recommendationContests: [liveContest],
        deadlineContests: [liveContest],
        teams: [liveTeam],
      }),
    ).toMatchObject({
      recommendationContests: [liveContest],
      deadlineContests: [liveContest],
      teams: [liveTeam],
      isFallbackTeamList: false,
    });
  });
});
