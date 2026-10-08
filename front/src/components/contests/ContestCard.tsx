'use client';
import Link from 'next/link';
import styled from '@emotion/styled';
import { colors as c, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { type Contest } from '@/data/user-design';
import { Icon, IconButton, Row, Tag } from '@/components/common/Primitives';
import { isBookmarkableId, useBookmarks } from '@/features/bookmarks/useBookmarks';

const CategoryTag = styled(Tag)({
  [mobile]: { padding: '3px 6px', ...textStyle.mTagText, lineHeight: 'normal', color: c.gray700 },
});
const TeamTag = styled(Tag)({
  ...textStyle.mBadgeText,
  lineHeight: 'normal',
  [mobile]: { padding: '3px 6px', lineHeight: 'normal', background: c.lightBlue },
});
// 북마크 저장 순간 팝 + 저장 상태 배경 강조로 토글 피드백을 준다(저장 해제는 틴트만 사라지게).
const ScrapButton = styled(IconButton, {
  shouldForwardProp: (prop) => prop !== '$saved',
})<{ $saved?: boolean }>(({ $saved }) => ({
  borderRadius: 999,
  ...($saved
    ? {
        background: c.lightBlue,
        animation: 'semo-scrap-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        '@keyframes semo-scrap-pop': {
          '0%': { transform: 'scale(0.8)' },
          '60%': { transform: 'scale(1.18)' },
          '100%': { transform: 'scale(1)' },
        },
        '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
      }
    : {}),
}));
const Card = styled.article<{ horizontal?: boolean; row?: boolean }>(({ horizontal, row }) => ({
  borderRadius: 12,
  overflow: 'hidden',
  minWidth: 0,
  background: c.white,
  transition: 'box-shadow 0.2s ease, transform 0.2s ease',
  '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 10px 24px rgb(0 0 0 / 8%)' },
  '.artwork': { height: 188, background: c.gray100, borderRadius: '12px 12px 0 0' },
  '.card-body': { display: 'flex', flexDirection: 'column', gap: 8, padding: 14 },
  '.meta': { display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 },
  '.dday': { color: c.primary, ...textStyle.overline },
  h3: textStyle.h3,
  // 탐색 목록 보기(Figma contestCard 1345:22813): 100px 썸네일 + 세로로 쌓은 본문(제목 / 태그·D-day / 북마크·팀 배지).
  ...(row
    ? {
        display: 'grid',
        gridTemplateColumns: '100px minmax(0, 1fr)',
        alignItems: 'start',
        padding: 12,
        borderRadius: 8,
        border: `0.5px solid ${c.gray100}`,
        '> a:first-of-type': { display: 'block' },
        '.artwork': { width: 100, height: 101, background: c.gray100, borderRadius: 0 },
        '.card-body': {
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          gap: 8,
          padding: 14,
          minWidth: 0,
        },
        h3: textStyle.mCardTitle,
        '.meta': { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 },
        '.meta > div': { gap: 12, justifyContent: 'flex-start !important' },
        '.meta > div:last-of-type': { gap: 20 },
        '.tag': { padding: '3px 8px', ...textStyle.mTagText, lineHeight: 'normal' },
        '.dday': textStyle.mCounterText,
      }
    : {}),
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
      : { border: '0.5px solid #f0f1f3' }),
    '.artwork': {
      height: horizontal ? 100 : 160,
      background: horizontal ? c.gray100 : '#d8e3f0',
      ...(horizontal ? { border: '0.5px solid #f0f1f3' } : {}),
      borderRadius: horizontal ? 12 : '12px 12px 0 0',
    },
    '.card-body': { padding: horizontal ? 0 : 12, gap: horizontal ? 0 : 8, minWidth: 0 },
    '.card-body > a': horizontal ? { marginBottom: 30 } : undefined,
    h3: horizontal ? textStyle.mFeatureTitle : textStyle.mCardTitle,
    'h3.clamp': { maxWidth: 124 },
    '.dday': { ...textStyle.mCounterText, color: c.primary },
    img: { width: 14, height: 14 },
  },
}));
export function ContestCard({
  contest,
  horizontal = false,
  row = false,
  simple = false,
  href = '/contests/public-data',
}: {
  contest: Contest;
  horizontal?: boolean;
  /** 데스크톱 목록 보기(가로 카드). */
  row?: boolean;
  simple?: boolean;
  href?: string;
}) {
  const { bookmarks, toggleBookmark, isToggling } = useBookmarks();
  const bookmarkable = isBookmarkableId(contest.id);
  const saved = bookmarks.some((challenge) => challenge.id === contest.id);
  const scrapButton = (
    <ScrapButton
      aria-label={`${contest.title} 북마크`}
      aria-pressed={saved}
      $saved={saved}
      disabled={!bookmarkable || isToggling}
      title={bookmarkable ? undefined : '서버 챌린지 ID가 없어 북마크할 수 없어요'}
      onClick={() => toggleBookmark(contest.id)}
    >
      <Icon src="/assets/icons/scrap.png" size={16} alt="북마크" />
    </ScrapButton>
  );
  return (
    <Card horizontal={horizontal} row={row} data-component="contest-card">
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
              <CategoryTag className="tag">{contest.category}</CategoryTag>
              <span className="dday">D-{contest.days}</span>
            </Row>
            <Row style={{ justifyContent: 'space-between' }}>
              {scrapButton}
              {contest.teams !== undefined && (
                <Link href="/contests/public-data/teams">
                  <TeamTag tone="blue">
                    {horizontal || simple ? `팀 ${contest.teams}건` : `팀 모집 ${contest.teams}건`}
                  </TeamTag>
                </Link>
              )}
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
