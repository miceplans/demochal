'use client';
import Link from 'next/link';
import styled from '@emotion/styled';
import type { Team } from '@/data/user-design';
import { colors as c, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';

export function TeamCard({ team, displayOnly = false }: { team: Team; displayOnly?: boolean }) {
  const poster = team.poster;
  return (
    <Card data-component="team-card">
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
          <NameRow>
            <h3>{displayOnly ? team.name : <Link href={`/teams/${team.id}`}>{team.name}</Link>}</h3>
            <Count>
              ({team.joined}/{team.capacity})
            </Count>
          </NameRow>
        </TopRow>
        <BottomRow>
          <RoleRow>
            {team.recruitingRoles.slice(0, 1).map((role, i) => (
              <RoleChip key={`recruiting-${role}-${i}`}>{role}</RoleChip>
            ))}
            {team.recruitingRoles.length > 1 && <More aria-hidden>…</More>}
            {team.filledRoles.length > 0 && (
              <FilledRole
                role="img"
                aria-label={`${team.filledRoles.join(', ')} 모집 완료`}
                title={team.filledRoles.join(', ')}
              >
                <img src="/assets/icons/team-role-check.svg" alt="" width={16} height={17} />
              </FilledRole>
            )}
          </RoleRow>
          {!displayOnly && (
            <Actions>
              <Apply href={`/teams/${team.id}`}>지원하기</Apply>
            </Actions>
          )}
        </BottomRow>
      </Body>
    </Card>
  );
}

const Card = styled.article({
  position: 'relative',
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
  // 제목 링크를 카드 전체로 확장(stretched link)
  'h3 a::after': { content: '""', position: 'absolute', inset: 0 },
  '.team-artwork': {
    width: '100%',
    height: 135,
    objectFit: 'cover',
    objectPosition: 'center top',
    background: c.gray100,
  },
  [mobile]: { '.team-artwork': { display: 'none' } },
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

const More = styled.span({ ...textStyle.mRoleText, color: c.gray500 });

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
  position: 'relative',
  zIndex: 1,
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

export const TeamGrid = styled.div({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 16,
  [mobile]: { gridTemplateColumns: '1fr', gap: 12 },
});
