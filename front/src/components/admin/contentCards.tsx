'use client';

import type { KeyboardEvent } from 'react';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';

/* ---------- 카드 행 타입 ---------- */

export type TeamCardRow = {
  id: string;
  name: string;
  challenge: string;
  members: string;
  roles: string[];
  otherRoles: string[];
  unread: boolean;
};

export type ContestCardRow = {
  id: string;
  title: string;
  category: string;
  dday: string;
  teams: string;
  unread: boolean;
};

// 콘텐츠 모니터링 조회 limit (서버 상한 50).
export const PAGE_SIZE = 8;
export const MAX_LIMIT = 50;

/* ---------- 팀 카드 ---------- */

export const TeamCard = styled.article({
  position: 'relative',
  cursor: 'pointer',
  '&:hover': { borderColor: c.gray300 },
  border: `0.5px solid ${c.gray200}`,
  borderRadius: 12,
  background: c.gray100,
  overflow: 'hidden',
  // 좁은 뷰포트의 가로 레일에서 카드가 찌그러지지 않도록 최소 폭을 유지한다.
  '@media (max-width: 640px)': { minWidth: 220 },
});
export const UnreadDot = styled.span({
  position: 'absolute',
  top: 10,
  right: 10,
  width: 10,
  height: 10,
  borderRadius: 24,
  background: c.primary,
  zIndex: 1,
});
export const TeamCover = styled.div({
  height: 135,
  background: `linear-gradient(135deg, ${c.gray200} 0%, ${c.gray100} 100%)`,
  // 모바일에서는 폭에 맞춰 커버 높이를 키운다.
  '@media (max-width: 640px)': { height: 'auto', aspectRatio: '4 / 3' },
});
export const TeamBody = styled.div({
  background: c.white,
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
});
export const TeamName = styled.strong({ ...textStyle.mNameLabel, color: c.gray900 });
export const TeamChallenge = styled.span({ ...textStyle.mInfoText, color: c.gray500 });
export const RoleBadges = styled.div({ display: 'flex', gap: 6, flexWrap: 'wrap' });
export const RoleBadge = styled.span<{ active?: boolean }>(({ active }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '4px 8px',
  borderRadius: 4,
  ...textStyle.mBadgeText,
  background: active ? c.lightGreen : c.gray100,
  color: active ? c.green : c.gray500,
  border: active ? 'none' : `0.5px solid ${c.gray200}`,
}));

/* ---------- 챌린지 카드 ---------- */

export const ContestCard = styled.article({
  position: 'relative',
  cursor: 'pointer',
  '&:hover': { borderColor: c.gray300 },
  border: `0.5px solid ${c.gray200}`,
  borderRadius: 12,
  background: c.gray100,
  overflow: 'hidden',
  // 좁은 뷰포트의 가로 레일에서 카드가 찌그러지지 않도록 최소 폭을 유지한다.
  '@media (max-width: 640px)': { minWidth: 220 },
});
export const ContestCover = styled.div({
  height: 189,
  background: `linear-gradient(135deg, ${c.gray200} 0%, ${c.gray100} 100%)`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: c.gray500,
  ...textStyle.mInfoText,
  // 모바일에서는 폭에 맞춰 커버 높이를 키운다.
  '@media (max-width: 640px)': { height: 'auto', aspectRatio: '4 / 3' },
});
export const ContestBody = styled.div({
  background: c.white,
  padding: 14,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});
export const ContestTitle = styled.strong({ ...textStyle.bodySmall2, color: c.gray900 });
// 긴 분야명은 두 줄로 깨지지 않고 말줄임 처리한다.
export const CategoryTag = styled.span({
  padding: '3px 8px',
  borderRadius: 4,
  background: c.gray100,
  color: c.gray700,
  ...textStyle.finePrint,
  alignSelf: 'flex-start',
  maxWidth: '100%',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  boxSizing: 'border-box',
});
export const DDay = styled.span({
  ...textStyle.overline,
  color: c.primary,
  whiteSpace: 'nowrap',
  flexShrink: 0,
});
export const TeamCount = styled.span({
  padding: '4px 8px',
  borderRadius: 4,
  background: c.lightBlue,
  color: c.primary,
  ...textStyle.label,
  whiteSpace: 'nowrap',
  flexShrink: 0,
});
// D-day와 팀 수는 카드 하단에 항상 한 줄로 정렬한다.
const ContestMetaRow = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  marginTop: 'auto',
});

// 카드를 키보드로도 열 수 있게 하는 공통 속성.
export const openOnKey = (open: () => void) => (event: KeyboardEvent) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    open();
  }
};

export const teamCardContent = (team: TeamCardRow) => (
  <>
    {team.unread ? <UnreadDot aria-label="확인 필요" /> : null}
    <TeamCover />
    <TeamBody>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TeamName>{team.name}</TeamName>
        <TeamChallenge>{team.challenge}</TeamChallenge>
      </div>
      <RoleBadges>
        {team.roles.map((role) => (
          <RoleBadge key={role} active>
            {role}
          </RoleBadge>
        ))}
        {team.otherRoles.map((role) => (
          <RoleBadge key={role}>{role}</RoleBadge>
        ))}
      </RoleBadges>
      <span style={{ ...textStyle.mInfoText, color: c.gray700 }}>{team.members}</span>
    </TeamBody>
  </>
);

export const contestCardContent = (contest: ContestCardRow) => (
  <>
    {contest.unread ? <UnreadDot aria-label="확인 필요" /> : null}
    <ContestCover>공고 이미지</ContestCover>
    <ContestBody>
      <ContestTitle>{contest.title}</ContestTitle>
      <CategoryTag>{contest.category}</CategoryTag>
      <ContestMetaRow>
        <DDay>{contest.dday}</DDay>
        <TeamCount>{contest.teams}</TeamCount>
      </ContestMetaRow>
    </ContestBody>
  </>
);
