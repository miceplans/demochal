'use client';
import Link from 'next/link';
import styled from '@emotion/styled';
import { teams } from '@/data/user-design';
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
  [mobile]: { '.team-artwork': { display: 'none' }, '.body': { padding: 14 } },
});
const Apply = styled(Link)({
  color: c.primary,
  ...textStyle.overline,
  border: `1px solid ${c.primary}`,
  borderRadius: 8,
  padding: '6px 12px',
});
export function TeamCard({ team = teams[0] }: { team?: (typeof teams)[number] }) {
  return (
    <Card data-component="team-card">
      <div className="team-artwork" />
      <div className="body">
        <Row style={{ justifyContent: 'space-between' }}>
          <h3>{team.name}</h3>
          <Muted>{team.challenge}</Muted>
        </Row>
        <Row gap={6}>
          <Tag tone="green">기획</Tag>
          <Tag tone="green">프론트엔드</Tag>
          <Tag>백엔드</Tag>
          <Tag>디자이너</Tag>
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <Muted>{team.members}</Muted>
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
