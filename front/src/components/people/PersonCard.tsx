'use client';
import styled from '@emotion/styled';
import type { PersonCardModel } from './person';
import { Tag, Wrap } from '@/components/common/Primitives';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';

const Card = styled.button({
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
  width: '100%',
  padding: 20,
  border: `1px solid ${c.gray200}`,
  borderRadius: 8,
  background: c.white,
  textAlign: 'left',
  transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
  '&:hover': { borderColor: c.gray300, boxShadow: '0 4px 12px rgb(0 0 0 / 6%)' },
});
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
    <Card type="button" onClick={() => onSelect(person)}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar aria-hidden />
        <Name>{person.name ?? '이름 없음'}</Name>
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
      </span>
    </Card>
  );
}
