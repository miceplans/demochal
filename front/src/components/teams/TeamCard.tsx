'use client';
import Link from 'next/link';
import styled from '@emotion/styled';
import { type Team, teams } from '@/data/user-design';
import { colors as c, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { Tag, Row, Muted } from '@/components/common/Primitives';
const Card = styled.article({
  background: c.white,
  border: `1px solid ${c.gray100}`,
  borderRadius: 12,
  overflow: 'hidden',
  minWidth: 0,
  '.team-artwork': { height: 135, background: c.gray100 },
  '.body': { padding: 16, display: 'flex', flexDirection: 'column', gap: 10 },
  h3: textStyle.h2,
  [mobile]: {
    border: '1px solid #f0f1f3',
    borderRadius: 14,
    '.team-artwork': { display: 'none' },
    '.body': { padding: 14, gap: 10 },
  },
});
const RoleTag = styled(Tag)<{ filled?: boolean }>(({ filled }) => ({
  ...textStyle.mBadgeText,
  lineHeight: 'normal',
  background: filled ? c.lightBlue : c.gray100,
  color: filled ? c.primary : c.gray500,
  border: filled ? 'none' : `1px solid ${c.gray100}`,
  [mobile]: { padding: '4px 7px' },
}));
const Challenge = styled(Muted)({ color: c.gray700, [mobile]: textStyle.mSubText });
const Members = styled(Muted)({ [mobile]: textStyle.mSubText });
const Apply = styled(Link)({
  color: c.primary,
  ...textStyle.overline,
  border: `1px solid ${c.primary}`,
  borderRadius: 8,
  padding: '6px 12px',
  [mobile]: { padding: '6px 14px', fontWeight: 700 },
});
export function TeamCard({ team = teams[0] }: { team?: Team }) {
  return (
    <Card data-component="team-card">
      <div className="team-artwork" />
      <div className="body">
        <Row style={{ justifyContent: 'space-between' }}>
          <h3>{team.name}</h3>
          <Challenge>{team.challenge}</Challenge>
        </Row>
        <Row gap={6}>
          {team.filledRoles.map((role) => (
            <RoleTag key={role} filled>
              {role}
            </RoleTag>
          ))}
          {team.recruitingRoles.map((role) => (
            <RoleTag key={role}>{role}</RoleTag>
          ))}
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <Members>{team.members}</Members>
          <Apply href="/applications/new">지원하기</Apply>
        </Row>
      </div>
    </Card>
  );
}
export const TeamGrid = styled.div({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 16,
  [mobile]: { gridTemplateColumns: '1fr', gap: 12 },
});
