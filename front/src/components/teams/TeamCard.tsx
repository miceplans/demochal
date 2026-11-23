'use client';
import Link from 'next/link';
import styled from '@emotion/styled';
import type { Team } from '@/data/user-design';
import { colors as c, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';

export function TeamCard({
  team,
  manage,
  variant = 'default',
}: {
  team: Team;
  /** 내가 만든 팀: '지원하기' 대신 지원자 확인 버튼을 보여준다. 버튼이 링크라 카드 전체 링크는 걸지 않는다. */
  manage?: { href: string; applicants: number };
  /** thumbnail: 홈 레일용(Figma card/Thumnail 195:2930) — 공모전 포스터 카드와 같은 298:416 비율. */
  variant?: 'default' | 'thumbnail';
}) {
  if (variant === 'thumbnail') return <ThumbnailTeamCard team={team} />;
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
          <NameRow>
            <h3>{team.name}</h3>
            <Count>
              ({team.joined}/{team.capacity})
            </Count>
          </NameRow>
        </TopRow>
        <BottomRow>
          <RoleBox>
            <RoleRow>
              {team.recruitingRoles.map((role, i) => (
                <RoleChip key={`recruiting-${role}-${i}`}>{role}</RoleChip>
              ))}
              {team.filledRoles.map((role, i) => (
                <FilledRole
                  key={`filled-${role}-${i}`}
                  role="img"
                  aria-label={`${role} 모집 완료`}
                  title={role}
                >
                  <img src="/assets/icons/team-role-check.svg" alt="" width={16} height={17} />
                </FilledRole>
              ))}
            </RoleRow>
          </RoleBox>
          {manage ? (
            <ApplyLink href={manage.href}>지원자 {manage.applicants}명 보기</ApplyLink>
          ) : (
            <Apply>지원하기</Apply>
          )}
        </BottomRow>
      </Body>
    </>
  );
  return (
    <Card data-component="team-card">
      {manage ? (
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
  border: `0.5px solid ${c.gray100}`,
  borderRadius: 14,
  overflow: 'hidden',
  // ContestCard와 같은 hover lift로 카드 인터랙션 톤을 맞춘다.
  transition: 'box-shadow 0.2s ease, transform 0.2s ease',
  '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 10px 24px rgb(0 0 0 / 8%)' },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none', transform: 'none' },
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

const NameRow = styled.div({ display: 'flex', alignItems: 'baseline', gap: 2, minWidth: 0 });

const Count = styled.span({ ...textStyle.mNameLabel, color: c.gray900, flexShrink: 0 });

const BottomRow = styled.div({
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 8,
});

// 한 줄에 다 들어가면 전부 보이고, 넘치면 잘라 둔 뒤 hover 시 카드 위로 펼쳐 모두 보여준다.
const RoleBox = styled.div({ position: 'relative', flex: 1, minWidth: 0, height: 25 });

const RoleRow = styled.div({
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  display: 'flex',
  flexWrap: 'nowrap',
  alignItems: 'center',
  gap: 6,
  overflow: 'hidden',
  'div:hover > &': {
    flexWrap: 'wrap',
    overflow: 'visible',
    zIndex: 2,
    margin: -6,
    padding: 6,
    width: 'calc(100% + 12px)',
    background: c.white,
    borderRadius: 8,
  },
});

const RoleChip = styled.span({
  ...textStyle.mRoleText,
  padding: '4px 7px',
  borderRadius: 4,
  background: c.gray100,
  border: `0.5px solid ${c.gray100}`,
  color: c.gray500,
  whiteSpace: 'nowrap',
  flexShrink: 0,
});

const FilledRole = styled.span({
  flexShrink: 0,
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

const ApplyLink = Apply.withComponent(Link);

// Figma card/Thumnail(195:2930): 사진이 카드 전체를 채우고 하단 흰 본문(패딩 16, 간격 10)에
// 팀명·챌린지 / 역할 칩(모집 완료=초록, 모집 중=회색) / 참여 인원·지원하기를 둔다.
function ThumbnailTeamCard({ team }: { team: Team }) {
  return (
    <ThumbCard data-component="team-card">
      <ThumbLink href={`/teams/${team.id}`} aria-label={`${team.name} 상세 보기`}>
        <span className="thumb-art">
          {team.poster ? <img className="thumb-artwork" src={team.poster} alt="" /> : null}
        </span>
        <ThumbBody>
          <ThumbTopRow>
            <ThumbName>{team.name}</ThumbName>
            {team.challenge ? <ThumbChallenge>{team.challenge}</ThumbChallenge> : null}
          </ThumbTopRow>
          <ThumbRoleRow aria-label="역할">
            {[
              ...team.filledRoles.map((role) => ({ role, filled: true })),
              ...team.recruitingRoles.map((role) => ({ role, filled: false })),
            ].map(({ role, filled }, i) => (
              <ThumbRole
                key={`${filled ? 'filled' : 'recruiting'}-${role}-${i}`}
                filled={filled}
                title={`${role} ${filled ? '모집 완료' : '모집 중'}`}
                // 한 줄에 다 안 들어가면 뒤쪽 칩부터 줄어들며 말줄임(…)된다(앞 칩은 온전히 유지).
                style={{ flexShrink: 1000 ** i }}
              >
                {role}
              </ThumbRole>
            ))}
          </ThumbRoleRow>
          <ThumbBottomRow>
            <ThumbMembers>
              {team.joined}/{team.capacity}명 참여중
            </ThumbMembers>
            <ThumbApply>지원하기</ThumbApply>
          </ThumbBottomRow>
        </ThumbBody>
      </ThumbLink>
    </ThumbCard>
  );
}

const ellipsis = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const;

const ThumbCard = styled.article({
  minWidth: 0,
  borderRadius: 12,
  border: `0.5px solid ${c.gray200}`,
  background: c.white,
  overflow: 'hidden',
  transition: 'box-shadow 0.2s ease, transform 0.2s ease',
  '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 10px 24px rgb(0 0 0 / 8%)' },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none', transform: 'none' },
  // 사진은 공모전 카드(contestCard/normal) 사진 영역과 같은 298:315 비율, 본문은 그 아래에 쌓는다.
  '.thumb-art': { display: 'block', aspectRatio: '298 / 315', background: c.gray100 },
  '.thumb-artwork': { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
});

const ThumbLink = styled(Link)({
  display: 'flex',
  flexDirection: 'column',
  borderRadius: 'inherit',
  '&:focus-visible': { outline: `2px solid ${c.primary}`, outlineOffset: -2 },
});

const ThumbBody = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  padding: 16,
  background: c.white,
  minWidth: 0,
});

const ThumbTopRow = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  minWidth: 0,
});

const ThumbName = styled.h3({ ...textStyle.mNameLabel, color: c.gray900, margin: 0, ...ellipsis });

const ThumbChallenge = styled.span({
  ...textStyle.mInfoText,
  color: c.gray500,
  flexShrink: 1,
  maxWidth: '50%',
  ...ellipsis,
});

const ThumbRoleRow = styled.div({
  display: 'flex',
  flexWrap: 'nowrap',
  gap: 6,
  minWidth: 0,
  overflow: 'hidden',
});

const ThumbRole = styled('span', { shouldForwardProp: (prop) => prop !== 'filled' })<{
  filled?: boolean;
}>(({ filled }) => ({
  ...textStyle.mBadgeText,
  padding: '4px 8px',
  borderRadius: 4,
  background: filled ? c.lightGreen : c.gray100,
  // Figma 테두리는 안쪽(inside) 선이라 칩 높이(21)를 늘리지 않게 inset 그림자로 그린다.
  boxShadow: filled ? 'none' : `inset 0 0 0 0.5px ${c.gray200}`,
  color: filled ? c.green : c.gray500,
  ...ellipsis,
}));

const ThumbBottomRow = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  minWidth: 0,
});

const ThumbMembers = styled.span({ ...textStyle.mInfoText, color: c.gray700, ...ellipsis });

const ThumbApply = styled.span({
  ...textStyle.mCounterText,
  padding: '6px 12px',
  borderRadius: 8,
  boxShadow: `inset 0 0 0 1px ${c.primary}`,
  color: c.primary,
  whiteSpace: 'nowrap',
  flexShrink: 0,
});

export const TeamGrid = styled.div({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 16,
  [mobile]: { gridTemplateColumns: '1fr', gap: 12 },
});
