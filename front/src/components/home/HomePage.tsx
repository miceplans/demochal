'use client';
import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import styled from '@emotion/styled';
import { UserShell } from '@/components/common/UserShell';
import { SectionHeader, DesktopOnly, MobileOnly } from '@/components/common/Primitives';
import { contestHref } from '@/components/contests/contest-links';
import { ContestCard } from '@/components/contests/ContestCard';
import { TeamCard } from '@/components/teams/TeamCard';
import { AdCarousel, type AdCarouselItem } from '@/components/ads/AdCarousel';
import { fallbackAds } from '@/components/ads/fallback-ads';
import {
  contests as fallbackContests,
  teams as fallbackTeams,
  type Contest,
} from '@/data/user-design';
import { toTeamCard } from '@/components/teams/team-model';
import { getHomeFallbackData } from '@/components/home/home-data';
import { mobile, colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { generated } from '@semochal/api-client';
import { daysUntil } from '@/lib/date';
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
  const liveTeams = (teamList?.data ?? []).slice(0, 4).map(toTeamCard);
  // 추천은 인증 기반 엔드포인트라 비로그인이면 요청하지 않고 섹션 전체를 숨긴다.
  const { data: recommended } = generated.useListRecommendedChallenges(
    { limit: 6 },
    { query: { enabled: auth?.status === 200 } },
  );
  const liveRecommendationContests = (recommended?.data.items ?? []).map((challenge) =>
    challengeToContest(challenge, now),
  );
  // 마감 임박순으로 최대 6개(3열 2줄) — 마감일이 없는 챌린지는 D-day를 표시할 수 없어 제외하고, D-7 이내만 노출한다.
  const { data: deadlineList } = generated.useListChallenges({
    sort: 'deadline',
    includeClosed: false,
    limit: 6,
  });
  const liveDeadlineContests = (deadlineList?.data.items ?? [])
    .filter((challenge) => Boolean(challenge.endDate))
    .slice(0, 4)
    .map((challenge) => challengeToContest(challenge, now));
  // 목업 데이터 폴백은 개발 환경 전용 — 프로덕션에서 API가 비어있거나 실패하면 빈 상태 그대로 둔다.
  const useMockFallbacks = process.env.NODE_ENV === 'development';
  const { recommendationContests, deadlineContests, teams, isFallbackTeamList } =
    getHomeFallbackData({
      recommendationContests: liveRecommendationContests,
      deadlineContests: liveDeadlineContests,
      teams: liveTeams,
      fallbackContests: useMockFallbacks ? fallbackContests.slice(0, 4) : [],
      fallbackTeams: useMockFallbacks ? fallbackTeams.slice(0, 4) : [],
    });

  return (
    <PreviewLock locked={adPreviewPrice !== null}>
      <UserShell>
        <Home>
          <AdCarousel
            // 기본 광고 → DB 광고로 바뀌면 슬라이드 수가 달라지므로 캐러셀 위치를 새로 시작한다.
            key={liveHeroAds ? 'hero-live' : 'hero-default'}
            ariaLabel="홈 상단 광고"
            items={liveHeroAds ?? fallbackAds.hero}
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
                <DesktopOnly>
                  <Rail>
                    {recommendationContests.slice(0, 6).map((contest) => (
                      <ContestCard
                        key={contest.id}
                        contest={contest}
                        href={contestHref(contest.id)}
                      />
                    ))}
                  </Rail>
                </DesktopOnly>
                <MobileOnly>
                  <Rail>
                    {recommendationContests.slice(0, 4).map((contest) => (
                      <ContestCard
                        key={contest.id}
                        contest={contest}
                        href={contestHref(contest.id)}
                        simple
                      />
                    ))}
                  </Rail>
                </MobileOnly>
              </section>
            )}
            {deadlineContests.length > 0 && (
              <section>
                <DesktopOnly>
                  <SectionHeader
                    title={`마감임박 D-${DEADLINE_SOON_DAYS}`}
                    action={<More href="/explore">더보기 →</More>}
                  />
                  <div style={{ height: 16 }} />
                  <Rail>
                    {deadlineContests.map((contest) => (
                      <ContestCard
                        key={contest.id}
                        contest={contest}
                        href={contestHref(contest.id)}
                      />
                    ))}
                  </Rail>
                </DesktopOnly>
                <MobileOnly>
                  <SectionHeader
                    title="마감임박! 지금 해야하는 챌린지"
                    action={<More href="/explore">더보기 →</More>}
                  />
                  <div style={{ display: 'grid', gap: 14, marginTop: 16 }}>
                    {deadlineContests.map((contest) => (
                      <ContestCard
                        key={contest.id}
                        contest={contest}
                        href={contestHref(contest.id)}
                        horizontal
                      />
                    ))}
                  </div>
                </MobileOnly>
              </section>
            )}
          </Sections>
          <AdCarousel
            key={liveGalleryAds ? 'gallery-live' : 'gallery-default'}
            ariaLabel="홈 중간 광고"
            items={liveGalleryAds ?? fallbackAds.gallery}
            variant="gallery"
            interval={4000}
          />
          <Sections last>
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
                    <TeamCard key={team.id} team={team} displayOnly={isFallbackTeamList} />
                  ))}
                </ScrollRail>
              </DesktopOnly>
              <MobileOnly>
                <ScrollRail as={TeamRail}>
                  {teams.slice(0, 3).map((team) => (
                    <TeamCard key={team.id} team={team} displayOnly={isFallbackTeamList} />
                  ))}
                </ScrollRail>
              </MobileOnly>
            </section>
          </Sections>
        </Home>
      </UserShell>
    </PreviewLock>
  );
}

function challengeToContest(
  challenge: {
    id?: string;
    title?: string;
    category?: string;
    endDate?: string;
    posterUrl?: string | null;
    prizeAmount?: number | null;
  },
  now: number,
): Contest {
  return {
    id: challenge.id ?? '',
    title: challenge.title ?? '챌린지',
    category: challenge.category ?? '기타',
    days: daysUntil(challenge.endDate, now),
    // 추천 응답에는 팀 모집 수가 없다 — 0으로 꾸며 보여주지 않고 카드에서 배지를 숨긴다.
    teams: undefined,
    posterUrl: challenge.posterUrl ?? null,
    prizeAmount: challenge.prizeAmount ?? null,
  };
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
// 데스크톱 3열 × 2줄(최대 6개), 모바일 2열.
const Rail = styled.div({
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: 16,
  [mobile]: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 },
});
const TeamRail = styled.div({
  display: 'flex',
  gap: 16,
  overflowX: 'auto',
  scrollbarWidth: 'none',
  '& > article': { flex: '0 0 362px' },
  [mobile]: { flexDirection: 'column', gap: 12, '& > article': { flex: 'none' } },
});
const More = styled(Link)({
  ...textStyle.secondaryText,
  color: c.gray500,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 2,
});
