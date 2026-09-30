'use client';
import Link from 'next/link';
import styled from '@emotion/styled';
import type { Team } from '@/data/user-design';
import { colors as c, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';

export function TeamCard({ team, displayOnly = false }: { team: Team; displayOnly?: boolean }) {
  return (
    <Card data-component="team-card">
      <TopRow>
        <Challenge>{team.challenge}</Challenge>
        <NameRow>
          <h3>{displayOnly ? team.name : <Link href={`/teams/${team.id}`}>{team.name}</Link>}</h3>
          <Count>
            ({team.joined}/{team.capacity})
          </Count>
        </NameRow>
      </TopRow>
      <BottomRow>
        <RoleRow>
          {team.recruitingRoles.map((role) => (
            <RoleChip key={role}>{role}</RoleChip>
          ))}
          {team.filledRoles.map((role) => (
            <FilledRole key={role} role="img" aria-label={`${role} 모집 완료`} title={role}>
              <img src="/assets/icons/team-role-check.svg" alt="" width={16} height={17} />
            </FilledRole>
          ))}
        </RoleRow>
        {!displayOnly && (
          <Actions>
            <Report href={`/reports/new?type=team&id=${team.id}`}>신고</Report>
            <Apply href={`/teams/${team.id}`}>지원하기</Apply>
          </Actions>
        )}
      </BottomRow>
    </Card>
  );
}

const Card = styled.article({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  gap: 24,
  minWidth: 0,
  padding: 14,
  background: c.white,
  border: `1px solid ${c.gray100}`,
  borderRadius: 14,
  h3: { ...textStyle.mTabLabel, color: c.gray900, minWidth: 0 },
});

const TopRow = styled.div({ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 });

const Challenge = styled.p({ ...textStyle.mSubText, color: c.gray500, margin: 0 });

const NameRow = styled.div({ display: 'flex', alignItems: 'baseline', gap: 2, minWidth: 0 });

const Count = styled.span({ ...textStyle.mNameLabel, color: c.gray900, flexShrink: 0 });

const BottomRow = styled.div({
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 8,
});

const RoleRow = styled.div({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 });

const RoleChip = styled.span({
  ...textStyle.mRoleText,
  padding: '4px 7px',
  borderRadius: 4,
  background: c.gray100,
  border: `1px solid ${c.gray100}`,
  color: c.gray500,
  whiteSpace: 'nowrap',
});

const FilledRole = styled.span({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 2,
  borderRadius: 26,
  background: c.green,
});

const Actions = styled.div({ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 });

const Apply = styled(Link)({
  ...textStyle.mBadgeText,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: 25,
  padding: '6px 14px',
  borderRadius: 8,
  background: c.primary,
  color: c.gray50,
  whiteSpace: 'nowrap',
});

const Report = styled(Link)({
  ...textStyle.overline,
  color: c.gray500,
  whiteSpace: 'nowrap',
  padding: '6px 4px',
});

export const TeamGrid = styled.div({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 16,
  [mobile]: { gridTemplateColumns: '1fr', gap: 12 },
});
