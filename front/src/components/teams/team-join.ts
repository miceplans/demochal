/** 역할이 없더라도 서버는 role 없이 팀 참가 신청을 받을 수 있다. */
export function joinRoleForTeam(openRoles: string[], pickedRole: string): string | undefined {
  return openRoles.includes(pickedRole) ? pickedRole : openRoles[0];
}

export function canSubmitTeamJoin({
  authPending,
  joinPending,
  isLeader,
  hasMembership,
}: {
  authPending: boolean;
  joinPending: boolean;
  isLeader: boolean;
  hasMembership: boolean;
}): boolean {
  return !authPending && !joinPending && !isLeader && !hasMembership;
}
