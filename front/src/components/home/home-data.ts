import type { Contest, Team } from '@/data/user-design';

export function withFallback<T>(items: T[], fallback: T[]): T[] {
  return items.length ? items : fallback;
}

export function getHomeFallbackData({
  recommendationContests,
  deadlineContests,
  teams,
  fallbackContests,
  fallbackTeams,
}: {
  recommendationContests: Contest[];
  deadlineContests: Contest[];
  teams: Team[];
  fallbackContests: Contest[];
  fallbackTeams: Team[];
}) {
  const isFallbackTeamList = teams.length === 0;
  return {
    recommendationContests: withFallback(recommendationContests, fallbackContests),
    deadlineContests: withFallback(deadlineContests, fallbackContests),
    teams: withFallback(teams, fallbackTeams),
    isFallbackTeamList,
  };
}
