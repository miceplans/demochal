/** 역할이 없더라도 서버는 role 없이 팀 참가 신청을 받을 수 있다. */
export function joinRoleForTeam(openRoles: string[], pickedRole: string): string | undefined {
  return openRoles.includes(pickedRole) ? pickedRole : openRoles[0];
}

export function canSubmitTeamJoin({
  authPending,
  joinPending,
  challengePending,
  isLeader,
  hasMembership,
}: {
  authPending: boolean;
  joinPending: boolean;
  /** 팀의 챌린지(신청서 여부 판단에 필요)가 아직 안 왔으면 신청을 막는다. */
  challengePending: boolean;
  isLeader: boolean;
  hasMembership: boolean;
}): boolean {
  return !authPending && !joinPending && !challengePending && !isLeader && !hasMembership;
}
