import type { generated } from '@semochal/api-client';
import type { Team } from '@/data/user-design';

export type ApiTeam = generated.ListTeamsQueryResult['data'][number];

export const TEAM_COVER_FALLBACK = '/mock/mock-poster.png';

/** 팀장 1명 + 모집 슬롯 인원 합. 생성 시점 기준 정원이다. */
export function teamCapacity(team: Pick<ApiTeam, 'openRoles'>): number {
  return 1 + (team.openRoles ?? []).reduce((sum, slot) => sum + (slot.count ?? 0), 0);
}

export function toTeamCard(team: ApiTeam): Team {
  const filledRoles = team.filledRoles ?? [];
  const joined = Math.max(filledRoles.length, 1);
  const capacity = teamCapacity(team);
  return {
    id: team.id ?? '',
    name: team.title ?? '',
    challenge: team.challengeTitle ?? '',
    region: team.region,
    // 서버가 내린 공개 URL이 없으면 빈 문자열 — TeamCard가 중성 플레이스홀더를 렌더한다.
    poster: team.challengePosterUrl ?? '',
    members: `${joined}/${capacity}명 참여중`,
    joined,
    capacity,
    filledRoles,
    recruitingRoles: (team.openRoles ?? []).map((slot) => slot.role ?? '').filter(Boolean),
  };
}
