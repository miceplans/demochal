'use client';
import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import styled from '@emotion/styled';
import { UserShell } from '@/components/common/UserShell';
import {
  SectionHeader,
  SectionHeading,
  DesktopOnly,
  MobileOnly,
} from '@/components/common/Primitives';
import { contestHref } from '@/components/contests/contest-links';
import { ContestCard } from '@/components/contests/ContestCard';
import { challengeToContest } from '@/components/contests/challenge-to-contest';
import { TeamCard } from '@/components/teams/TeamCard';
import { AdCarousel, type AdCarouselItem } from '@/components/ads/AdCarousel';
import { fallbackAds, fillWithFallback } from '@/components/ads/fallback-ads';
import { type Contest } from '@/data/user-design';
import { toTeamCard } from '@/components/teams/team-model';
import { mobile, colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { generated } from '@semochal/api-client';
import { ScrollRail } from '@/components/ui/ScrollRail';

// 홈 '마감임박' 섹션 노출 기준(일).
const DEADLINE_SOON_DAYS = 7;

const noopSubscribe = () => () => {};
const getAdPreviewPriceSnapshot = () => new URLSearchParams(window.location.search).get('adPrice');
const getAdPreviewPriceServerSnapshot = () => null;

// 게재 중인 광고가 없거나 조회에 실패하면 fallbackAds(공유 모듈) 기본 광고 세트를 보여준다(전역 에러 토스트도 띄우지 않음).
const publicAdsQuery = { query: { meta: { silentError: true } } };

function toAdItems(
  response: Awaited<ReturnType<typeof generated.listPublicAds>> | undefined,
): AdCarouselItem[] | undefined {
  if (response?.status !== 200 || response.data.length === 0) return undefined;
  return response.data.map((ad) => ({
    src: ad.imageUrl,
    alt: ad.title,
    adId: ad.id,
    // 랜딩은 광고주 입력값이라 http(s)만 링크로 쓴다(javascript: 등 차단).
    href: ad.landingUrl && /^https?:\/\//i.test(ad.landingUrl) ? ad.landingUrl : undefined,
  }));
}

function MoreIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M5 3.5 8.5 7 5 10.5"
        stroke={c.gray500}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// 부트캠프 섹션 검색어(전용 분야가 없어 제목/분야 ILIKE 검색을 쓴다).
const BOOTCAMP_QUERY = '부트캠프';

// 데스크톱/모바일 카드 형태를 CSS 미디어쿼리로 나눈다(SSR 불일치 없이 기존 DesktopOnly/MobileOnly 패턴 유지).
function ResponsiveContestCard({
  contest,
  desktop = 'card',
  mobileVariant = 'simple',
}: {
  contest: Contest;
  /** card: Figma contestCard/normal 포스터 카드, row: Figma Variant4 가로형 카드. */
  desktop?: 'card' | 'row';
  /** horizontal: 모바일 가로형 카드. */
  mobileVariant?: 'simple' | 'horizontal';
}) {
  const href = contestHref(contest.id);
  return (
    <>
      <DesktopOnly>
        <ContestCard
          contest={contest}
          href={href}
          variant={desktop === 'row' ? 'list' : 'poster'}
        />
      </DesktopOnly>
      <MobileOnly>
        {mobileVariant === 'horizontal' ? (
          <ContestCard contest={contest} href={href} horizontal />
        ) : (
          <ContestCard contest={contest} href={href} simple />
        )}
      </MobileOnly>
    </>
  );
}

export function HomePage() {
  // D-day 계산 기준 시각은 마운트 시 한 번만 잡는다(렌더 중 Date.now() 호출 금지).
  const [now] = useState(() => Date.now());
  const { data: heroAdList } = generated.useListPublicAds({ placement: 'hero' }, publicAdsQuery);
  const { data: galleryAdList } = generated.useListPublicAds(
    { placement: 'gallery' },
    publicAdsQuery,
  );
  const liveHeroAds = toAdItems(heroAdList);
  const liveGalleryAds = toAdItems(galleryAdList);
  const adPriceParam = useSyncExternalStore(
    noopSubscribe,
    getAdPreviewPriceSnapshot,
    getAdPreviewPriceServerSnapshot,
  );
  // 쿼리 파라미터 조작(?adPrice=abc → NaN)으로 페이지 전체 잠금이 걸리지 않게 유효한 숫자만 받는다.
  const parsedAdPreviewPrice = adPriceParam ? Number(adPriceParam) : null;
  const adPreviewPrice =
    parsedAdPreviewPrice !== null && Number.isFinite(parsedAdPreviewPrice)
      ? parsedAdPreviewPrice
      : null;
  const { data: auth } = generated.useGetMyAuthInfo({ query: { retry: false } });
  const userName = auth?.status === 200 ? auth.data.name : undefined;
  const { data: teamList } = generated.useListTeams();
  // Figma sec3grid: 팀 카드 5장(오른쪽 끝은 잘려 보이며 레일로 스크롤).
  const liveTeams = (teamList?.data ?? []).slice(0, 5).map(toTeamCard);
  // 추천은 인증 기반 엔드포인트라 비로그인이면 요청하지 않고 섹션 전체를 숨긴다.
  const { data: recommended } = generated.useListRecommendedChallenges(
    { limit: 8 },
    { query: { enabled: auth?.status === 200 } },
  );
  const liveRecommendationContests = (recommended?.data.items ?? []).map((challenge) =>
    challengeToContest(challenge, now),
  );
  // 마감 임박순 4개(Figma 1-홈: 4열 1줄) — 마감일이 없는 챌린지는 D-day를 표시할 수 없어 제외한다.
  const { data: deadlineList } = generated.useListChallenges({
    sort: 'deadline',
    includeClosed: false,
    limit: 8,
  });
  const liveDeadlineContests = (deadlineList?.data.items ?? [])
    .filter((challenge) => Boolean(challenge.endDate))
    .slice(0, 4)
    .map((challenge) => challengeToContest(challenge, now));
  // 가장 인기많은 공모전: 조회수순 1위는 대표 카드, 나머지는 가로 레일.
  const { data: popularList } = generated.useListChallenges({
    sort: 'popular',
    includeClosed: false,
    limit: 6,
  });
  const popularContests = (popularList?.data.items ?? []).map((challenge) =>
    challengeToContest(challenge, now),
  );
  const [featuredPopular, ...popularRail] = popularContests;
  // 부트캠프 전용 분야가 없어 제목/분야 검색(q)으로 모은다. 결과가 없으면 섹션을 숨긴다.
  const { data: bootcampList } = generated.useListChallenges({
    q: BOOTCAMP_QUERY,
    includeClosed: false,
    limit: 5,
  });
  const bootcampContests = (bootcampList?.data.items ?? []).map((challenge) =>
    challengeToContest(challenge, now),
  );
  // 하단 가로형 목록: 최신 등록순 5개.
  const { data: latestList } = generated.useListChallenges({
    sort: 'latest',
    includeClosed: false,
    limit: 5,
  });
  const latestContests = (latestList?.data.items ?? []).map((challenge) =>
    challengeToContest(challenge, now),
  );
  // API가 비어있거나 실패하면 목업 없이 빈 상태로 둔다. 사용자 화면에는 실 데이터만 노출한다.
  const recommendationContests = liveRecommendationContests;
  const deadlineContests = liveDeadlineContests;
  const teams = liveTeams;

  return (
    <PreviewLock locked={adPreviewPrice !== null}>
      <UserShell>
        <Home>
          <AdCarousel
            // 기본 광고 → DB 광고로 바뀌면 슬라이드 수가 달라지므로 캐러셀 위치를 새로 시작한다.
            key={liveHeroAds ? 'hero-live' : 'hero-default'}
            ariaLabel="홈 상단 광고"
            items={fillWithFallback(liveHeroAds, fallbackAds.hero)}
            variant="hero"
            priceOverlay={
              adPreviewPrice
                ? { label: '하루 광고비', value: `${adPreviewPrice.toLocaleString()}원` }
                : undefined
            }
          />
          <Sections>
            {recommendationContests.length > 0 && (
              <section>
                <SectionHeader
                  title={userName ? `${userName}님에게 맞는 AI 추천` : '회원님에게 맞는 AI 추천'}
                  action={<More href="/explore">더보기 →</More>}
                />
                <div style={{ height: 16 }} />
                <Rail>
                  {recommendationContests.slice(0, 4).map((contest) => (
                    <ResponsiveContestCard key={contest.id} contest={contest} />
                  ))}
                </Rail>
              </section>
            )}
            {teams.length > 0 && (
              <section>
                <MobileOnly style={{ marginBottom: 16 }}>
                  <SectionHeader
                    title="팀원모집중"
                    action={
                      <More href="/teams">
                        더보기
                        <MoreIcon />
                      </More>
                    }
                  />
                </MobileOnly>
                <DesktopOnly>
                  <ScrollRail as={TeamRail}>
                    {teams.map((team) => (
                      <TeamCard key={team.id} team={team} variant="thumbnail" />
                    ))}
                  </ScrollRail>
                </DesktopOnly>
                <MobileOnly>
                  <ScrollRail as={TeamRail}>
                    {teams.slice(0, 3).map((team) => (
                      <TeamCard key={team.id} team={team} />
                    ))}
                  </ScrollRail>
                </MobileOnly>
              </section>
            )}
          </Sections>
          <AdCarousel
            key={liveGalleryAds ? 'gallery-live' : 'gallery-default'}
            ariaLabel="홈 중간 광고"
            items={fillWithFallback(liveGalleryAds, fallbackAds.gallery)}
            variant="gallery"
            interval={4000}
          />
          <Sections last>
            {featuredPopular && (
              <Popular aria-labelledby="home-popular-title">
                <PopularFeatured>
                  <SubHeading id="home-popular-title">가장 인기많은 공모전</SubHeading>
                  <FeaturedPoster
                    href={contestHref(featuredPopular.id)}
                    aria-label={`${featuredPopular.title} 상세`}
                  >
                    {(featuredPopular.thumbnailUrl ?? featuredPopular.posterUrl) ? (
                      <img
                        src={featuredPopular.thumbnailUrl ?? featuredPopular.posterUrl ?? ''}
                        alt=""
                      />
                    ) : null}
                  </FeaturedPoster>
                </PopularFeatured>
                {popularRail.length > 0 && (
                  <RailSlot>
                    <ScrollRail as={CardRail}>
                      {popularRail.map((contest) => (
                        <ResponsiveContestCard key={contest.id} contest={contest} />
                      ))}
                    </ScrollRail>
                  </RailSlot>
                )}
              </Popular>
            )}
            {deadlineContests.length > 0 && (
              <section>
                <DesktopOnly>
                  <SectionHeader
                    title={`마감임박 D-${DEADLINE_SOON_DAYS}`}
                    action={<More href="/explore">더보기 →</More>}
                  />
                </DesktopOnly>
                <MobileOnly>
                  <SectionHeader
                    title="마감임박! 지금 해야하는 챌린지"
                    action={<More href="/explore">더보기 →</More>}
                  />
                </MobileOnly>
                <div style={{ height: 16 }} />
                <DeadlineRail>
                  {deadlineContests.map((contest) => (
                    <ResponsiveContestCard
                      key={contest.id}
                      contest={contest}
                      mobileVariant="horizontal"
                    />
                  ))}
                </DeadlineRail>
              </section>
            )}
            {bootcampContests.length > 0 && (
              <Bootcamp aria-labelledby="home-bootcamp-title">
                <BootcampHeading id="home-bootcamp-title">
                  취준생에게 딱 맞는 부트 캠프!
                </BootcampHeading>
                <RailSlot>
                  <ScrollRail as={BootcampRail}>
                    {bootcampContests.map((contest) => (
                      <ResponsiveContestCard key={contest.id} contest={contest} />
                    ))}
                  </ScrollRail>
                </RailSlot>
              </Bootcamp>
            )}
            {latestContests.length > 0 && (
              <LatestList aria-label="최신 공모전">
                {latestContests.map((contest) => (
                  <ResponsiveContestCard
                    key={contest.id}
                    contest={contest}
                    desktop="row"
                    mobileVariant="horizontal"
                  />
                ))}
              </LatestList>
            )}
          </Sections>
        </Home>
      </UserShell>
    </PreviewLock>
  );
}

// 상단 광고와 첫 섹션이 붙지 않도록 데스크톱에서 섹션 간격(60px)과 동일하게 띄운다.
const Home = styled.div({
  padding: '60px 0',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  gap: 60,
  [mobile]: { padding: 0, display: 'block' },
});
const PreviewLock = styled('div', { shouldForwardProp: (prop) => prop !== 'locked' })<{
  locked: boolean;
}>(({ locked }) => (locked ? { pointerEvents: 'none' } : undefined));
const Sections = styled.div<{ last?: boolean }>(({ last }) => ({
  // Home이 flex 컬럼이라 margin auto만으로는 폭이 내용물 크기로 줄어든다.
  width: '100%',
  maxWidth: 1200,
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 60,
  [mobile]: { gap: 32, padding: last ? '0 16px 32px' : '0 16px' },
}));
// Figma 1-홈: 데스크톱 4열 1줄, 모바일 2열.
const Rail = styled.div({
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: 16,
  [mobile]: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 },
});
// 마감임박은 모바일에서 기존처럼 가로형 카드 한 줄씩 쌓는다.
const DeadlineRail = styled(Rail)({
  [mobile]: { gridTemplateColumns: 'minmax(0, 1fr)', gap: 14 },
});
// Figma sec3grid: 241px 팀 카드 가로 레일(간격 16).
const TeamRail = styled.div({
  display: 'flex',
  gap: 16,
  overflowX: 'auto',
  scrollbarWidth: 'none',
  '& > article': { flex: '0 0 241px' },
  [mobile]: { flexDirection: 'column', gap: 12, '& > article': { flex: 'none' } },
});
// Figma Frame 539: 패딩 40, 대표 카드 열(298) ↔ 레일 간격 120.
const Popular = styled.section({
  display: 'flex',
  alignItems: 'center',
  gap: 120,
  padding: 40,
  overflow: 'hidden',
  [mobile]: { flexDirection: 'column', alignItems: 'stretch', gap: 16, padding: 0 },
});
const PopularFeatured = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  flex: '0 0 298px',
  minWidth: 0,
  [mobile]: { flex: 'none' },
});
// Figma 1651:13817: 대표 카드는 본문 없이 포스터만(298×366).
const FeaturedPoster = styled(Link)({
  display: 'block',
  width: '100%',
  aspectRatio: '298 / 366',
  borderRadius: 12,
  background: c.gray100,
  overflow: 'hidden',
  transition: 'box-shadow 0.2s ease, transform 0.2s ease',
  '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 10px 24px rgb(0 0 0 / 8%)' },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none', transform: 'none' },
  img: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
});
// 마감임박 등 다른 섹션 제목과 같은 SectionHeading(18 Bold)을 쓴다.
const SubHeading = styled(SectionHeading)({ margin: 0 });
// ScrollRail 래퍼가 flex 아이템이 되므로 남는 폭을 채우도록 감싼다.
const RailSlot = styled.div({ flex: 1, minWidth: 0, width: '100%' });
// Figma Frame 538: 229px 카드 가로 레일(간격 12), 넘치는 카드는 스크롤.
const CardRail = styled.div({
  display: 'flex',
  gap: 12,
  overflowX: 'auto',
  scrollbarWidth: 'none',
  // 긴 제목(nowrap)이 카드 폭을 밀어내지 않도록 minWidth 0.
  '& > div': { flex: '0 0 229px', minWidth: 0 },
  [mobile]: { '& > div': { flex: '0 0 160px' } },
});
// Figma Frame 541: 가운데 정렬 제목(24) + 카드 5열(간격 12).
const Bootcamp = styled.section({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 20,
  [mobile]: { alignItems: 'stretch', gap: 16 },
});
const BootcampHeading = styled.h2({
  ...textStyle.display,
  color: c.gray900,
  margin: 0,
  textAlign: 'center',
  [mobile]: textStyle.mSectionHeading,
});
const BootcampRail = styled(CardRail)({
  '& > div': { flex: '1 0 229px', minWidth: 0 },
});
// Figma Frame 546: 가로형 카드 세로 목록(간격 20).
const LatestList = styled.section({
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
  [mobile]: { gap: 14 },
});
const More = styled(Link)({
  ...textStyle.secondaryText,
  color: c.gray500,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 2,
});
