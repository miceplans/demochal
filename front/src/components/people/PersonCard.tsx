'use client';
import Image from 'next/image';
import Link from 'next/link';
import styled from '@emotion/styled';
import type { PersonCardModel } from './person';
import { Wrap } from '@/components/common/Primitives';
import { badgeToneColors, type BadgeTone } from '@/components/ui/Badge';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';

// hover/포커스 시 하단의 배지·스택 칩이 '프로필 보기 / 스카우트' 버튼으로 교체된다(Figma 1291:10836).
// 두 레이어를 같은 grid 셀에 겹쳐 카드 높이가 흔들리지 않게 하고, hover 없는 기기에서는 세로로 모두 노출한다.
const Card = styled.div({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  width: '100%',
  padding: 20,
  border: `1px solid ${c.gray200}`,
  borderRadius: 8,
  background: c.white,
  transition: 'box-shadow 0.15s ease',
  '&:hover, &:focus-within': { boxShadow: '0 4px 12px rgb(0 0 0 / 6%)' },
  '@media (hover: hover)': {
    '&:hover [data-card-info], &:focus-within [data-card-info]': {
      opacity: 0,
      visibility: 'hidden',
    },
    '&:hover [data-card-actions], &:focus-within [data-card-actions]': {
      opacity: 1,
      visibility: 'visible',
    },
  },
});
// 카드 전체를 덮는 링크 — 카드 어디를 눌러도 프로필로 이동하고, 액션 버튼은 그 위(z-index)에서 따로 동작한다.
const CardLink = styled(Link)({ position: 'absolute', inset: 0, borderRadius: 8 });
const Top = styled.div({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 6,
  maxWidth: '100%',
});
const Bottom = styled.div({
  display: 'grid',
  alignItems: 'end',
  justifyItems: 'center',
  width: '100%',
});
const layer = {
  gridArea: '1 / 1',
  transition: 'opacity 0.15s ease, visibility 0.15s ease',
} as const;
const Info = styled.div({
  ...layer,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  '@media (hover: none)': { gridArea: 'auto' },
});
const Actions = styled.div({
  ...layer,
  display: 'flex',
  gap: 4,
  width: '100%',
  position: 'relative',
  zIndex: 1,
  opacity: 0,
  visibility: 'hidden',
  '@media (hover: none)': { gridArea: 'auto', opacity: 1, visibility: 'visible' },
});
const actionStyle = (primary?: boolean) => ({
  ...(primary ? textStyle.subtitle : textStyle.overline),
  flex: 1,
  minWidth: 0,
  height: 37,
  padding: '10px 12px',
  borderRadius: 6,
  border: primary ? 'none' : `1px solid ${c.gray200}`,
  background: primary ? c.primary : c.white,
  color: primary ? c.white : c.gray900,
  cursor: 'pointer',
  '&:hover:not(:disabled)': { background: primary ? '#005ee0' : c.gray50 },
  '&:disabled': { cursor: 'not-allowed', opacity: 0.5 },
});
const ActionButton = styled.button<{ primary?: boolean }>(({ primary }) => actionStyle(primary));
const ActionLink = styled(Link)({
  ...actionStyle(),
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
});

const Avatar = styled.span({
  flexShrink: 0,
  width: 147,
  height: 147,
  borderRadius: '50%',
  background: c.gray100,
});
const Name = styled.span({
  ...textStyle.h1_2,
  color: c.gray900,
  textAlign: 'center',
  wordBreak: 'break-word',
});
// TODO: 포트폴리오 배지의 하늘색(Figma 1354:23299)은 아직 디자인 토큰에 없다 — 토큰 추가 시 교체.
const portfolioColors = { background: '#dff7ff', color: '#169ac6' };
const VerifyBadge = styled.span<{ tone: BadgeTone }>(({ tone }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  height: 20,
  padding: '4px 9.5px',
  borderRadius: 7.6,
  fontSize: 10.4,
  fontWeight: 400,
  lineHeight: 'normal',
  whiteSpace: 'nowrap',
  ...badgeToneColors(tone),
  ...(tone === 'blue' ? portfolioColors : tone === 'gray' ? { color: c.gray900 } : {}),
}));
const StackChip = styled.span({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: 20,
  padding: '4px 10.3px',
  borderRadius: 14.67,
  fontSize: 9.5,
  fontWeight: 400,
  lineHeight: 'normal',
  background: c.gray100,
  color: c.gray900,
});
const BADGE_ICONS: Partial<Record<BadgeTone, { src: string; size: number }>> = {
  gray: { src: '/assets/people/card-github.svg', size: 10.4 },
  blue: { src: '/assets/people/card-portfolio.svg', size: 11.7 },
};

export function PersonCard({
  person,
  onSelect,
}: {
  person: PersonCardModel;
  onSelect: (person: PersonCardModel) => void;
}) {
  const badges: { label: string; tone: 'gray' | 'blue' | 'green' }[] = [];
  if (person.hasGithub) badges.push({ label: '깃허브 인증', tone: 'gray' });
  if (person.hasPortfolio) badges.push({ label: '포트폴리오', tone: 'blue' });
  if (person.hasAwards) badges.push({ label: '출품이력', tone: 'green' });
  return (
    <Card>
      <CardLink
        href={`/profile?id=${person.id}`}
        aria-label={`${person.name ?? '이름 없음'} 프로필 보기`}
      />
      <Top>
        <Avatar aria-hidden />
        <Name>{person.name ?? '이름 없음'}</Name>
      </Top>
      <Bottom>
        <Info data-card-info>
          {badges.length > 0 && (
            <Wrap style={{ gap: 4 }}>
              {badges.map((badge) => {
                const icon = BADGE_ICONS[badge.tone];
                return (
                  <VerifyBadge key={badge.label} tone={badge.tone}>
                    {icon && (
                      <Image
                        src={icon.src}
                        width={icon.size}
                        height={icon.size}
                        alt=""
                        unoptimized
                      />
                    )}
                    {badge.label}
                  </VerifyBadge>
                );
              })}
            </Wrap>
          )}
          {(person.stacks ?? []).length > 0 && (
            <Wrap style={{ gap: 4 }}>
              {(person.stacks ?? []).slice(0, 5).map((stack) => (
                <StackChip key={stack}>{stack}</StackChip>
              ))}
            </Wrap>
          )}
        </Info>
        <Actions data-card-actions>
          <ActionLink href={`/profile?id=${person.id}`}>프로필 보기</ActionLink>
          <ActionButton type="button" primary onClick={() => onSelect(person)}>
            스카우트
          </ActionButton>
        </Actions>
      </Bottom>
    </Card>
  );
}
