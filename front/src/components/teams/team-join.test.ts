import { describe, expect, it } from 'vitest';
import { canSubmitTeamJoin, joinRoleForTeam } from './team-join';

describe('team join helpers', () => {
  it('allows a role-less team application and omits role from the request', () => {
    expect(joinRoleForTeam([], '')).toBeUndefined();
    expect(
      canSubmitTeamJoin({
        authPending: false,
        joinPending: false,
        isLeader: false,
        hasMembership: false,
      }),
    ).toBe(true);
  });

  it('keeps existing application blocking conditions', () => {
    expect(
      canSubmitTeamJoin({
        authPending: false,
        joinPending: false,
        isLeader: true,
        hasMembership: false,
      }),
    ).toBe(false);
    expect(
      canSubmitTeamJoin({
        authPending: false,
        joinPending: false,
        isLeader: false,
        hasMembership: true,
      }),
    ).toBe(false);
  });

  it('uses the selected role or the first open role', () => {
    expect(joinRoleForTeam(['개발', '디자인'], '디자인')).toBe('디자인');
    expect(joinRoleForTeam(['개발'], '없는 역할')).toBe('개발');
  });
});
