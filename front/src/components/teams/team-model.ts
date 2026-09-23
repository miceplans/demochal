import type { generated } from '@semochal/api-client';
import type { Team } from '@/data/user-design';

export type ApiTeam = generated.ListTeamsQueryResult['data'][number];

// TODO: 챌린지 포스터(`server/docs/openapi.yaml` Challenge.posterFileId)는 planned 상태라 아직 내려오지 않는다.
// 포스터 업로드/조회가 구현되면 챌린지 포스터 URL로 교체한다 — 그 전까지는 목 포스터로 커버를 채운다.
// https://nextjs.org/docs/app/api-reference/components/image
export const TEAM_COVER_FALLBACK = '/mock/mock-poster.png';

/** 팀장 1명 + 모집 슬롯 인원 합. 생성 시점 기준 정원이다. */
export function teamCapacity(team: Pick<ApiTeam, 'openRoles'>): number {
  return 1 + (team.openRoles ?? []).reduce((sum, slot) => sum + (slot.count ?? 0), 0);
}

export function toTeamCard(team: ApiTeam): Team {
  const filledRoles = team.filledRoles ?? [];
  return {
    id: team.id ?? '',
    name: team.title ?? '',
    challenge: team.challengeTitle ?? '',
    poster: TEAM_COVER_FALLBACK,
    members: `${Math.max(filledRoles.length, 1)}/${teamCapacity(team)}명 참여중`,
    filledRoles,
    recruitingRoles: (team.openRoles ?? []).map((slot) => slot.role ?? '').filter(Boolean),
  };
}
