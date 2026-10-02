'use client';
import Link from 'next/link';
import styled from '@emotion/styled';
import type { Team } from '@/data/user-design';
import { colors as c, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';

export function TeamCard({ team, displayOnly = false }: { team: Team; displayOnly?: boolean }) {
  const poster = team.poster;
  const content = (
    <>
      {poster ? (
        <img className="team-artwork" src={poster} alt="" width={400} height={135} />
      ) : (
        <PosterPlaceholder role="img" aria-label={`${team.challenge || team.name} 대표 이미지`}>
          <PosterInitial>{(team.challenge || team.name).slice(0, 1)}</PosterInitial>
          <PosterChallenge>{team.challenge || team.name}</PosterChallenge>
        </PosterPlaceholder>
      )}
      <Body>
        <TopRow>
          <Challenge>{team.challenge}</Challenge>
          <Region>지역 · {team.region?.trim() || '무관'}</Region>
          <NameRow>
            <h3>{team.name}</h3>
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
          {!displayOnly && <Apply>지원하기</Apply>}
        </BottomRow>
      </Body>
    </>
  );
  return (
    <Card data-component="team-card">
      {displayOnly ? (
        content
      ) : (
        <CardLink href={`/teams/${team.id}`} aria-label={`${team.name} 상세 보기`}>
          {content}
        </CardLink>
      )}
    </Card>
  );
}

const Card = styled.article({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  gap: 24,
  minWidth: 0,
  background: c.white,
  border: `1px solid ${c.gray100}`,
  borderRadius: 14,
  overflow: 'hidden',
  h3: { ...textStyle.mTabLabel, color: c.gray900, minWidth: 0 },
  '.team-artwork': {
    width: '100%',
    height: 135,
    objectFit: 'cover',
    objectPosition: 'center top',
    background: c.gray100,
  },
  [mobile]: { '.team-artwork': { display: 'none' } },
});

const CardLink = styled(Link)({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  gap: 24,
  flex: 1,
  minWidth: 0,
  borderRadius: 'inherit',
  '&:focus-visible': { outline: `2px solid ${c.primary}`, outlineOffset: -2 },
});

const Body = styled.div({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  gap: 24,
  flex: 1,
  minWidth: 0,
  padding: 14,
});

const PosterPlaceholder = styled.div({
  width: '100%',
  height: 135,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  background: c.gray100,
  [mobile]: { display: 'none' },
});

const PosterInitial = styled.span({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 44,
  height: 44,
  borderRadius: 12,
  background: c.gray200,
  color: c.gray500,
  ...textStyle.h2,
});

const PosterChallenge = styled.span({
  ...textStyle.caption,
  color: c.gray500,
  maxWidth: '100%',
  padding: '0 16px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

const TopRow = styled.div({ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 });

const Challenge = styled.p({ ...textStyle.mSubText, color: c.gray500, margin: 0 });

const Region = styled.p({
  ...textStyle.caption,
  color: c.gray700,
  margin: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

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

const Apply = styled.span({
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
  flexShrink: 0,
});

export const TeamGrid = styled.div({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 16,
  [mobile]: { gridTemplateColumns: '1fr', gap: 12 },
});
