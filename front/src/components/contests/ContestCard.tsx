'use client';
import Link from 'next/link';
import styled from '@emotion/styled';
import { colors as c, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { type Contest } from '@/data/user-design';
import { useUserStore } from '@/stores/useUserStore';
import { Icon, IconButton, Row, Tag } from '@/components/common/Primitives';

const Card = styled.article<{ horizontal?: boolean }>(({ horizontal }) => ({
  borderRadius: 12,
  overflow: 'hidden',
  minWidth: 0,
  background: c.white,
  '.artwork': { height: 188, background: c.gray100, borderRadius: '12px 12px 0 0' },
  '.card-body': { display: 'flex', flexDirection: 'column', gap: 8, padding: 14 },
  h3: textStyle.h3,
  [mobile]: {
    border: `1px solid ${c.gray100}`,
    ...(horizontal
      ? {
          display: 'grid',
          gridTemplateColumns: '100px minmax(0, 1fr)',
          border: 0,
          alignItems: 'center',
        }
      : {}),
    '.artwork': {
      height: horizontal ? 100 : 160,
      background: horizontal ? c.gray100 : '#d8e4f0',
      borderRadius: horizontal ? 12 : '12px 12px 0 0',
    },
    '.card-body': { padding: horizontal ? '8px 0 8px 10px' : 12, gap: 8, minWidth: 0 },
    h3: { fontSize: horizontal ? 13 : 12 },
  },
}));
export function ContestCard({
  contest,
  horizontal = false,
  simple = false,
  href = '/contests/public-data',
}: {
  contest: Contest;
  horizontal?: boolean;
  simple?: boolean;
  href?: string;
}) {
  const saved = useUserStore((s) => s.bookmarks.includes(contest.id));
  const toggle = useUserStore((s) => s.toggleBookmark);
  return (
    <Card horizontal={horizontal} data-component="contest-card">
      <Link href={href} aria-label={`${contest.title} 상세`}>
        <div className="artwork" />
      </Link>
      <div className="card-body">
        <Link href={href}>
          <h3>{contest.title}</h3>
        </Link>
        <Row style={{ justifyContent: 'space-between' }}>
          <Tag>{contest.category}</Tag>
          {!simple && (
            <span style={{ color: c.primary, ...textStyle.overline }}>
              D-{contest.days}
            </span>
          )}
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <IconButton
            aria-label={`${contest.title} 북마크`}
            aria-pressed={saved}
            onClick={() => toggle(contest.id)}
          >
            <Icon src="/assets/icons/scrap.png" size={16} alt="북마크" />
          </IconButton>
          {!simple && (
            <Link href="/contests/public-data/teams">
              <Tag tone="blue">팀 모집 {contest.teams}건</Tag>
            </Link>
          )}
        </Row>
      </div>
    </Card>
  );
}
export const ContestGrid = styled.div({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 16,
  [mobile]: { gridTemplateColumns: '1fr', gap: 16 },
});
