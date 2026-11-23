'use client';
import Link from 'next/link';
import styled from '@emotion/styled';
import { colors as c, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { type Contest } from '@/data/user-design';
import { HeartIcon, Icon, IconButton, Row, Tag } from '@/components/common/Primitives';
import { splitCategories } from '@/lib/categories';
import { contestHref } from './contest-links';
import { isBookmarkableId, useBookmarks } from '@/features/bookmarks/useBookmarks';

const CategoryTag = styled(Tag)({
  [mobile]: { padding: '3px 6px', ...textStyle.mTagText, lineHeight: 'normal', color: c.gray700 },
});
const TeamTag = styled(Tag)({
  ...textStyle.mBadgeText,
  lineHeight: 'normal',
  [mobile]: { padding: '3px 6px', lineHeight: 'normal', background: c.lightBlue },
});
const CategoryTags = styled.div({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
  minWidth: 0,
});
// 북마크 저장 순간 팝 + 저장 상태 배경 강조로 토글 피드백을 준다(저장 해제는 틴트만 사라지게).
const ScrapButton = styled(IconButton, {
  shouldForwardProp: (prop) => prop !== '$saved',
})<{ $saved?: boolean }>(({ $saved }) => ({
  borderRadius: 999,
  ...($saved
    ? {
        background: c.lightRed,
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
  border: `0.5px solid ${c.gray200}`,
  overflow: 'hidden',
  minWidth: 0,
  background: c.white,
  transition: 'box-shadow 0.2s ease, transform 0.2s ease',
  '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 10px 24px rgb(0 0 0 / 8%)' },
  // 인라인 링크 안의 블록 썸네일은 모바일에서 높이·aspect-ratio 기준으로 축소될 수 있다.
  // 링크 자체를 블록으로 만들어 카드 폭을 기준으로 포스터를 배치한다.
  '> a:first-of-type': { display: 'block' },
  // Figma contestCard 1521:8662: 썸네일 정사각형(416×415), 본문 패딩 14 / 간격 12, 제목 18 Bold.
  '.artwork': {
    position: 'relative',
    aspectRatio: '416 / 415',
    background: c.gray100,
    borderRadius: '12px 12px 0 0',
    overflow: 'hidden',
  },
  // 마감된 챌린지: 썸네일을 어둡게 덮고 '마감된 공고입니다.'를 가운데에 표시한다.
  '.artwork-closed': {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: c.overlayBlack,
    color: c.white,
    textAlign: 'center',
    ...textStyle.h3_2,
  },
  '.artwork img': { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  '.card-body': { display: 'flex', flexDirection: 'column', gap: 12, padding: 14 },
  '.meta': { display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 },
  '.dday': { color: c.primary, ...textStyle.overline, whiteSpace: 'nowrap', flexShrink: 0 },
  '.prize': { color: c.gray900, ...textStyle.bodySmall2 },
  h3: { ...textStyle.h3, fontSize: 18, fontWeight: 700 },
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
      : { border: `0.5px solid ${c.gray200}` }),
    // 세로형 카드는 이미지 섹션이 카드 폭만큼 정방형(416:415)으로 크게 보이게 aspect-ratio를 그대로 둔다.
    // 명시적 높이를 얹으면 aspect-ratio가 무시되므로 높이는 horizontal(고정 100px 썸네일)에만 둔다.
    '.artwork': {
      width: '100%',
      ...(horizontal ? { height: 100 } : {}),
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
  variant,
  href: hrefProp,
}: {
  /**
   * poster: 홈 카드(Figma contestCard/normal 500:1481) — 사진이 298:416 카드를 채우고 하단 본문에
   * 제목 / 분야·D-day / 북마크·팀 모집 배지. list: 홈 가로형 목록(Variant4 1656:14149).
   */
  variant?: 'poster' | 'list';
  contest: Contest;
  horizontal?: boolean;
  /** 데스크톱 목록 보기(가로 카드). */
  row?: boolean;
  simple?: boolean;
  href?: string;
}) {
  // href를 넘기지 않으면 카드 id로 실제 상세(UUID)/데모 상세를 고른다.
  const href = hrefProp ?? contestHref(contest.id);
  const { bookmarks, toggleBookmark, isToggling } = useBookmarks();
  const bookmarkable = isBookmarkableId(contest.id);
  const saved = bookmarks.some((challenge) => challenge.id === contest.id);
  const categoryLabels = splitCategories(contest.category);
  const scrapButton = (
    <ScrapButton
      aria-label={`${contest.title} 북마크`}
      aria-pressed={saved}
      $saved={saved}
      disabled={!bookmarkable || isToggling}
      title={bookmarkable ? undefined : '서버 챌린지 ID가 없어 북마크할 수 없어요'}
      onClick={() => toggleBookmark(contest.id)}
    >
      <HeartIcon filled={saved} size={16} />
    </ScrapButton>
  );
  const artworkSrc = contest.thumbnailUrl ?? contest.posterUrl;
  // 홈 카드: 모집 중인 팀이 있을 때만 배지를 단다('팀 모집 0건'은 노출하지 않음).
  const teamBadge = contest.teams ? (
    <Link href="/contests/public-data/teams">
      <HomeTeamBadge>팀 모집 {contest.teams}건</HomeTeamBadge>
    </Link>
  ) : null;
  const homeCategories = (
    <HomeTags aria-label="분야">
      {categoryLabels.map((category) => (
        <HomeTag key={category}>{category}</HomeTag>
      ))}
    </HomeTags>
  );
  const dday = !contest.closed ? <HomeDday>D-{contest.days}</HomeDday> : null;
  if (variant === 'poster') {
    return (
      <PosterCard data-component="contest-card">
        <Link href={href} aria-label={`${contest.title} 상세`} className="poster-link">
          {artworkSrc ? <img src={artworkSrc} alt="" /> : null}
          {contest.closed && <div className="artwork-closed">마감된 공고입니다.</div>}
        </Link>
        <PosterBody>
          <Link href={href} className="title-link">
            <HomeTitle>{contest.title}</HomeTitle>
          </Link>
          <HomeRow>
            {homeCategories}
            {dday}
          </HomeRow>
          <HomeActionRow>
            {scrapButton}
            {teamBadge}
          </HomeActionRow>
        </PosterBody>
      </PosterCard>
    );
  }
  if (variant === 'list') {
    return (
      <ListCard data-component="contest-card">
        <Link href={href} aria-label={`${contest.title} 상세`} className="list-artwork">
          {artworkSrc ? <img src={artworkSrc} alt="" /> : null}
        </Link>
        <ListBody>
          <ListTitleRow>
            <Link href={href} className="title-link">
              <HomeTitle>{contest.title}</HomeTitle>
            </Link>
            {dday}
          </ListTitleRow>
          {homeCategories}
          <ListBottomRow>
            {scrapButton}
            {teamBadge}
          </ListBottomRow>
        </ListBody>
      </ListCard>
    );
  }
  return (
    <Card horizontal={horizontal} row={row} data-component="contest-card">
      <Link href={href} aria-label={`${contest.title} 상세`}>
        <div className="artwork">
          {(contest.thumbnailUrl ?? contest.posterUrl) ? (
            <img src={contest.thumbnailUrl ?? contest.posterUrl ?? ''} alt="" />
          ) : null}
          {contest.closed && <div className="artwork-closed">마감된 공고입니다.</div>}
        </div>
      </Link>
      <div className="card-body">
        {(simple || row || horizontal) && (
          <Link href={href}>
            <h3 className={simple ? 'clamp' : undefined}>{contest.title}</h3>
          </Link>
        )}
        {simple ? (
          <Row style={{ justifyContent: 'space-between' }}>
            <CategoryTags aria-label="분야">
              {categoryLabels.map((category) => (
                <CategoryTag key={category}>{category}</CategoryTag>
              ))}
            </CategoryTags>
            {scrapButton}
          </Row>
        ) : !row && !horizontal ? (
          // Figma contestCard 1521:8662: 금액·태그·북마크 / 제목·D-day.
          <>
            <div className="meta">
              <Row style={{ justifyContent: 'space-between' }}>
                <Row style={{ gap: 8 }}>
                  {contest.prizeAmount ? (
                    <span className="prize">{contest.prizeAmount}만원</span>
                  ) : null}
                  <CategoryTags aria-label="분야">
                    {categoryLabels.map((category) => (
                      <CategoryTag key={category} className="tag">
                        {category}
                      </CategoryTag>
                    ))}
                  </CategoryTags>
                </Row>
                {scrapButton}
              </Row>
              <Row style={{ gap: 8 }}>
                <Link href={href}>
                  <h3>{contest.title}</h3>
                </Link>
                {!contest.closed && <span className="dday">D-{contest.days}</span>}
              </Row>
            </div>
          </>
        ) : (
          <div className="meta">
            <Row style={{ justifyContent: 'space-between' }}>
              <CategoryTags aria-label="분야">
                {categoryLabels.map((category) => (
                  <CategoryTag key={category} className="tag">
                    {category}
                  </CategoryTag>
                ))}
              </CategoryTags>
              {!contest.closed && <span className="dday">D-{contest.days}</span>}
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
const ellipsis = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const;
const cardHover = {
  transition: 'box-shadow 0.2s ease, transform 0.2s ease',
  '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 10px 24px rgb(0 0 0 / 8%)' },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none', transform: 'none' },
} as const;
const HomeTitle = styled.h3({ ...textStyle.mCardTitle, color: c.gray900, margin: 0, ...ellipsis });
const HomeRow = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  minWidth: 0,
});
// 팀 모집 배지(21px)가 없어도 본문 높이가 같도록 최소 높이를 고정한다.
const HomeActionRow = styled(HomeRow)({ minHeight: 21 });
// 분야 태그는 한 줄 고정 — 넘치면 마지막 태그부터 말줄임으로 잘린다.
const HomeTags = styled.div({
  display: 'flex',
  flexWrap: 'nowrap',
  gap: 4,
  minWidth: 0,
  overflow: 'hidden',
});
const HomeTag = styled.span({
  ...textStyle.mTagText,
  padding: '3px 8px',
  borderRadius: 4,
  background: c.gray100,
  color: c.gray700,
  flexShrink: 1,
  ...ellipsis,
});
const HomeDday = styled.span({ ...textStyle.mCounterText, color: c.primary, flexShrink: 0 });
const HomeTeamBadge = styled.span({
  ...textStyle.mBadgeText,
  display: 'inline-block',
  padding: '4px 8px',
  borderRadius: 4,
  background: c.lightBlue,
  color: c.primary,
  whiteSpace: 'nowrap',
});
// 사진 영역(남는 높이)과 본문을 위아래로 쌓는다 — 본문을 사진 위에 겹치면 둥근 모서리에 회색 배경이 비친다.
const PosterCard = styled.article({
  aspectRatio: '298 / 416',
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  borderRadius: 12,
  background: c.white,
  overflow: 'hidden',
  ...cardHover,
  '.poster-link': {
    position: 'relative',
    display: 'block',
    flex: 1,
    minHeight: 0,
    background: c.gray100,
    overflow: 'hidden',
  },
  '.poster-link img': { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  '.artwork-closed': {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: c.overlayBlack,
    color: c.white,
    ...textStyle.h3_2,
  },
  '.title-link': { display: 'block', minWidth: 0 },
  // 북마크 버튼은 아이콘(16px)만 차지하게 기본 패딩을 없앤다.
  'button[aria-pressed]': { padding: 0 },
});
const PosterBody = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 14,
  background: c.white,
  minWidth: 0,
});
const ListCard = styled.article({
  display: 'flex',
  alignItems: 'stretch',
  height: 105,
  padding: 14,
  borderRadius: 12,
  background: c.white,
  minWidth: 0,
  ...cardHover,
  '.list-artwork': {
    flex: '0 0 141px',
    borderRadius: 8,
    background: c.gray100,
    overflow: 'hidden',
  },
  '.list-artwork img': { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  '.title-link': { display: 'block', minWidth: 0 },
  'button[aria-pressed]': { padding: 0 },
  [mobile]: { height: 'auto', padding: 10, '.list-artwork': { flex: '0 0 100px', height: 100 } },
});
const ListBody = styled.div({
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: '0 14px',
});
const ListTitleRow = styled.div({ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 });
const ListBottomRow = styled.div({ display: 'flex', alignItems: 'center', gap: 12, minHeight: 21 });
export const ContestGrid = styled.div({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 16,
  [mobile]: { gridTemplateColumns: '1fr', gap: 16 },
});
