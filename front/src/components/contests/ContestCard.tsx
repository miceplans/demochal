'use client';
import Link from 'next/link';
import styled from '@emotion/styled';
import { colors as c, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { type Contest } from '@/data/user-design';
import { useUserStore } from '@/stores/useUserStore';
import { Icon, IconButton, Row, Tag } from '@/components/common/Primitives';

const CategoryTag = styled(Tag)({
  [mobile]: { padding: '3px 6px', ...textStyle.mMicroTag, lineHeight: 'normal', color: c.gray700 },
});
const TeamTag = styled(Tag)({
  [mobile]: { padding: '3px 6px', ...textStyle.mMicroTag, lineHeight: 'normal', background: '#eaf3ff' },
});
const Card = styled.article<{ horizontal?: boolean }>(({ horizontal }) => ({
  borderRadius: 12,
  overflow: 'hidden',
  minWidth: 0,
  background: c.white,
  '.artwork': { height: 188, background: c.gray100, borderRadius: '12px 12px 0 0' },
  '.card-body': { display: 'flex', flexDirection: 'column', gap: 8, padding: 14 },
  '.meta': { display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 },
  '.dday': { color: c.primary, ...textStyle.overline },
  h3: textStyle.h3,
  [mobile]: {
    ...(horizontal
      ? {
          display: 'grid',
          gridTemplateColumns: '100px minmax(0, 1fr)',
          border: 0,
          borderRadius: 6,
          padding: 10,
          gap: 8,
          alignItems: 'center',
        }
      : { border: '1px solid #f0f1f3' }),
    '.artwork': {
      height: horizontal ? 100 : 160,
      background: horizontal ? c.gray100 : '#d8e3f0',
      ...(horizontal ? { border: '1px solid #f0f1f3' } : {}),
      borderRadius: horizontal ? 12 : '12px 12px 0 0',
    },
    '.card-body': { padding: horizontal ? 0 : 12, gap: horizontal ? 0 : 8, minWidth: 0 },
    '.card-body > a': horizontal ? { marginBottom: 30 } : undefined,
    h3: {
      fontSize: horizontal ? textStyle.mFeatureTitle.fontSize : textStyle.mBadgeText.fontSize,
      lineHeight: horizontal ? 1.4 : textStyle.h3.lineHeight,
    },
    'h3.clamp': { maxWidth: 124 },
    '.dday': { ...textStyle.mIndexNumber, color: c.primary },
    img: { width: 14, height: 14 },
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
  const scrapButton = (
    <IconButton
      aria-label={`${contest.title} 북마크`}
      aria-pressed={saved}
      onClick={() => toggle(contest.id)}
    >
      <Icon src="/assets/icons/scrap.png" size={16} alt="북마크" />
    </IconButton>
  );
  return (
    <Card horizontal={horizontal} data-component="contest-card">
      <Link href={href} aria-label={`${contest.title} 상세`}>
        <div className="artwork" />
      </Link>
      <div className="card-body">
        <Link href={href}>
          <h3 className={simple ? 'clamp' : undefined}>{contest.title}</h3>
        </Link>
        {simple ? (
          <Row style={{ justifyContent: 'space-between' }}>
            <CategoryTag>{contest.category}</CategoryTag>
            {scrapButton}
          </Row>
        ) : (
          <div className="meta">
            <Row style={{ justifyContent: 'space-between' }}>
              <CategoryTag>{contest.category}</CategoryTag>
              <span className="dday">D-{contest.days}</span>
            </Row>
            <Row style={{ justifyContent: 'space-between' }}>
              {scrapButton}
              <Link href="/contests/public-data/teams">
                <TeamTag tone="blue">
                  {horizontal || simple ? `팀 ${contest.teams}건` : `팀 모집 ${contest.teams}건`}
                </TeamTag>
              </Link>
            </Row>
          </div>
        )}
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
