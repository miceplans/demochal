'use client';
import Link from 'next/link';
import styled from '@emotion/styled';
import { Icon, Tag, Row, Stack, Muted, Wrap, Heading } from '@/components/common/Primitives';
import { awardHistory, profileUser, stacks } from '@/data/user-design';
import { colors as c, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';
export function Badges() {
  return (
    <Wrap>
      <Tag>
        <Icon name="imgGithub" size={12} />
        깃허브 인증
      </Tag>
      <Tag tone="blue">
        <Icon name="imgDescription24DpE3E3E3Fill0Wght300Grad0Opsz241" size={12} />
        포트폴리오
      </Tag>
      <Tag tone="green">
        <Icon name="imgTrophy24DpE3E3E3Fill0Wght300Grad0Opsz241" size={12} />
        출품이력
      </Tag>
    </Wrap>
  );
}
const Avatar = styled.div<{ large?: boolean }>(({ large }) => ({
  width: large ? 110 : 64,
  height: large ? 110 : 64,
  borderRadius: '50%',
  background: c.gray100,
  flexShrink: 0,
  [mobile]: { width: 72, height: 72, background: '#eaf3ff' },
}));
export function Identity({ large = false }: { large?: boolean }) {
  return (
    <Row gap={24}>
      <Avatar large={large} />
      <Stack gap={8}>
        <h2 style={{ fontSize: large ? 20 : 16 }}>{profileUser.name}</h2>
        <Muted>
          {profileUser.role} · {profileUser.region}
        </Muted>
      </Stack>
    </Row>
  );
}
export function SkillStack() {
  return (
    <Wrap>
      {stacks.map((x) => (
        <span
          key={x}
          style={{ background: c.gray100, borderRadius: 24, padding: '8px 16px', fontSize: 13 }}
        >
          {x}
        </span>
      ))}
    </Wrap>
  );
}
const HistoryCard = styled(Link)({
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  border: `1px solid ${c.gray100}`,
  borderRadius: 12,
  padding: 16,
  '& .thumb': { width: 80, height: 60, background: c.gray100, borderRadius: 8, flexShrink: 0 },
  '& h3': { ...textStyle.mBlockTitle, marginBottom: 6 },
  [mobile]: { padding: 14, '& .thumb': { width: 64, height: 48 } },
});
export function History({ compact = false }: { compact?: boolean }) {
  return (
    <Stack gap={16}>
      {awardHistory
        .slice(0, compact ? 2 : awardHistory.length)
        .map(({ title, award, detail, href }) => (
          <HistoryCard key={title} href={href ?? '/contests/public-data'}>
            <div className="thumb" />
            <div>
              <h3>{title}</h3>
              <Row gap={8}>
                <Tag tone={award === '대상' ? 'blue' : 'gray'}>{award}</Tag>
                <Muted>{detail}</Muted>
              </Row>
            </div>
          </HistoryCard>
        ))}
    </Stack>
  );
}
