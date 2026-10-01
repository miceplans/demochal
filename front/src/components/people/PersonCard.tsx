'use client';
import styled from '@emotion/styled';
import type { PersonCardModel } from './person';
import { Row, Tag, Wrap } from '@/components/common/Primitives';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';

// hover/포커스 시 하단의 배지·스택 칩이 '프로필 보기 / 스카우트' 버튼으로 교체된다(Figma 1291:10836).
// 두 레이어를 같은 grid 셀에 겹쳐 카드 높이가 흔들리지 않게 하고, hover 없는 기기에서는 세로로 모두 노출한다.
const Card = styled.div({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  gap: 24,
  width: '100%',
  minHeight: 177,
  padding: 20,
  border: `1px solid ${c.gray200}`,
  borderRadius: 8,
  background: c.white,
  transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
  '&:hover, &:focus-within': { borderColor: c.gray300, boxShadow: '0 4px 12px rgb(0 0 0 / 6%)' },
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
const Bottom = styled.div({ display: 'grid', alignItems: 'end' });
const layer = {
  gridArea: '1 / 1',
  transition: 'opacity 0.15s ease, visibility 0.15s ease',
} as const;
const Info = styled.div({
  ...layer,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  '@media (hover: none)': { gridArea: 'auto', marginBottom: 16 },
});
const Actions = styled.div({
  ...layer,
  display: 'flex',
  gap: 4,
  opacity: 0,
  visibility: 'hidden',
  '@media (hover: none)': { gridArea: 'auto', opacity: 1, visibility: 'visible' },
});
const ActionButton = styled.button<{ primary?: boolean }>(({ primary }) => ({
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
}));
const Avatar = styled.span({
  flexShrink: 0,
  width: 59,
  height: 59,
  borderRadius: '50%',
  background: c.gray100,
});
const Name = styled.span({ ...textStyle.h1_2, color: c.gray900, wordBreak: 'break-word' });
const StackChip = styled.span({
  ...textStyle.finePrint,
  borderRadius: 15,
  padding: '4px 10px',
  background: c.gray100,
  color: c.gray900,
});

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
      <Row gap={12}>
        <Avatar aria-hidden />
        <Name>{person.name ?? '이름 없음'}</Name>
      </Row>
      <Bottom>
        <Info data-card-info>
          {badges.length > 0 && (
            <Wrap style={{ gap: 4 }}>
              {badges.map((badge) => (
                <Tag key={badge.label} tone={badge.tone}>
                  {badge.label}
                </Tag>
              ))}
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
          {/* TODO: 타인 공개 프로필 페이지가 생기면 연결한다(현재 /profile은 본인 전용). */}
          <ActionButton type="button" disabled title="준비 중입니다">
            프로필 보기
          </ActionButton>
          <ActionButton type="button" primary onClick={() => onSelect(person)}>
            스카우트
          </ActionButton>
        </Actions>
      </Bottom>
    </Card>
  );
}
