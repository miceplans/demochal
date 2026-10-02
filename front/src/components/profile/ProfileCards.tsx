'use client';
import Link from 'next/link';
import styled from '@emotion/styled';
import type { ReactNode } from 'react';
import { Icon, Tag, Row, Stack, Muted, Wrap } from '@/components/common/Primitives';
import { colors as c, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';

// GET /users/{id} 공개 프로필 응답의 부분 집합 — 서버 실데이터만 렌더한다.
export type ProfileAward = { title?: string; organization?: string; date?: string; prize?: string };
export type ProfileLink = { label?: string; url?: string };
export type ProfileUserData = {
  name?: string;
  position?: string;
  region?: string;
  bio?: string | null;
  stacks?: string[];
  badges?: string[];
  externalLinks?: ProfileLink[];
  awardHistory?: ProfileAward[];
};

export const AddButton = styled.button({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 26,
  height: 26,
  flexShrink: 0,
  border: 0,
  borderRadius: 8,
  background: 'transparent',
  color: c.gray500,
  cursor: 'pointer',
  transition: 'background 0.15s ease, color 0.15s ease, transform 0.1s ease',
  '&:hover': { background: c.gray50, color: c.gray700 },
  '&:active': { transform: 'scale(0.85)' },
});

function badgeIcon(badge: string) {
  if (badge.includes('깃허브')) return 'imgGithub';
  if (badge.includes('포트폴리오')) return 'imgDescription24DpE3E3E3Fill0Wght300Grad0Opsz241';
  if (badge.includes('출품') || badge.includes('수상'))
    return 'imgTrophy24DpE3E3E3Fill0Wght300Grad0Opsz241';
  return 'imgCertificate';
}

export function Badges({
  badges = [],
  extra = [],
  trailing,
}: {
  badges?: string[];
  extra?: string[];
  trailing?: ReactNode;
}) {
  return (
    <Wrap>
      {badges.map((badge) => (
        <Tag key={badge}>
          <Icon name={badgeIcon(badge)} size={12} />
          {badge}
        </Tag>
      ))}
      {extra.map((label) => (
        <Tag key={label}>
          <Icon name="imgCertificate" size={12} />
          {label}
        </Tag>
      ))}
      {trailing}
    </Wrap>
  );
}

const Avatar = styled.div<{ large?: boolean }>(({ large }) => ({
  width: large ? 110 : 64,
  height: large ? 110 : 64,
  borderRadius: '50%',
  background: c.gray100,
  flexShrink: 0,
  [mobile]: { width: 72, height: 72, background: c.paleBlue },
}));

export function Identity({ user, large = false }: { user?: ProfileUserData; large?: boolean }) {
  const subline = [user?.position, user?.region].filter(Boolean).join(' · ');
  return (
    <Row gap={24}>
      <Avatar large={large} />
      <Stack gap={8}>
        <h2 style={{ fontSize: large ? 20 : 16 }}>{user?.name ?? '이름 없음'}</h2>
        {subline ? <Muted>{subline}</Muted> : null}
      </Stack>
    </Row>
  );
}

export function SkillStack({ skills = [], trailing }: { skills?: string[]; trailing?: ReactNode }) {
  return (
    <Wrap>
      {skills.map((x) => (
        <span
          key={x}
          style={{ background: c.gray100, borderRadius: 24, padding: '8px 16px', fontSize: 13 }}
        >
          {x}
        </span>
      ))}
      {trailing}
    </Wrap>
  );
}
const historyCardStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  border: `0.5px solid ${c.gray100}`,
  borderRadius: 12,
  padding: 16,
  '& h3': { ...textStyle.mBlockTitle, marginBottom: 6 },
  [mobile]: { padding: 14 },
} as const;

// 지원현황 카드 — 실제 챌린지 상세로 연결된다(#278).
export const HistoryCard = styled(Link)({
  ...historyCardStyle,
  '& .thumb': { width: 80, height: 60, background: c.gray100, borderRadius: 8, flexShrink: 0 },
  [mobile]: { padding: 14, '& .thumb': { width: 64, height: 48 } },
});
// 수상 이력 카드 — 링크가 아니라 정적 카드다.
const AwardCard = styled.div(historyCardStyle);

export function History({
  awards = [],
  compact = false,
}: {
  awards?: ProfileAward[];
  compact?: boolean;
}) {
  return (
    <Stack gap={16}>
      {awards.slice(0, compact ? 2 : awards.length).map((award, index) => (
        <AwardCard key={`${award.title ?? '수상'}·${index}`}>
          <div>
            <h3>{award.title ?? '수상 이력'}</h3>
            <Row gap={8}>
              {award.prize ? (
                <Tag tone={award.prize === '대상' ? 'blue' : 'gray'}>{award.prize}</Tag>
              ) : null}
              <Muted>{[award.organization, award.date].filter(Boolean).join(' · ')}</Muted>
            </Row>
          </div>
        </AwardCard>
      ))}
    </Stack>
  );
}
