'use client';
import { useSyncExternalStore } from 'react';
import Link from 'next/link';
import styled from '@emotion/styled';
import { UserShell } from '@/components/common/UserShell';
import { SectionHeader, Row, DesktopOnly, MobileOnly } from '@/components/common/Primitives';
import { Dropdown } from '@/components/ui/Dropdown';
import { ContestCard } from '@/components/contests/ContestCard';
import { TeamCard } from '@/components/teams/TeamCard';
import { AdCarousel } from '@/components/ads/AdCarousel';
import { desktopContests, teams, type Contest } from '@/data/user-design';
import { mobile, colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { generated } from '@semochal/api-client';

const noopSubscribe = () => () => {};
const getAdPreviewPriceSnapshot = () => new URLSearchParams(window.location.search).get('adPrice');
const getAdPreviewPriceServerSnapshot = () => null;

const heroAds = [
  { src: '/assets/figma-ads/home-hero-1.png', alt: 'SEMO 브랜드 로고 광고' },
  { src: '/assets/figma-ads/home-hero-2.png', alt: '간편하고 쉬운 공모전을 위해, SEMO 광고' },
  { src: '/assets/figma-ads/home-hero-3.png', alt: '공모전 시작부터 끝까지 SEMO.BIZ 광고' },
];

const galleryAds = [
  { src: '/assets/figma-ads/home-hero-1.png', alt: 'SEMO 브랜드 로고 광고' },
  { src: '/assets/figma-ads/home-hero-2.png', alt: '간편하고 쉬운 공모전을 위해, SEMO 광고' },
  { src: '/assets/figma-ads/home-hero-3.png', alt: '공모전 시작부터 끝까지 SEMO.BIZ 광고' },
];

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
  const adPriceParam = useSyncExternalStore(
    noopSubscribe,
    getAdPreviewPriceSnapshot,
    getAdPreviewPriceServerSnapshot,
  );
  const adPreviewPrice = adPriceParam ? Number(adPriceParam) : null;
  const { data: auth } = generated.useGetMyAuthInfo({ query: { retry: false } });
  const { data: recommended } = generated.useListRecommendedChallenges(
    { limit: 6 },
    { query: { enabled: auth?.status === 200 } },
  );
  // 추천 결과가 로딩 중이거나 실패·비어 있으면 기본 목록을 유지해 레일이 비지 않게 한다.
  const recommendedItems = auth?.status === 200 ? recommended?.data.items : undefined;
  const recommendationContests = recommendedItems?.length
    ? recommendedItems.map(challengeToContest)
    : desktopContests;

  return (
    <PreviewLock locked={adPreviewPrice !== null}>
      <UserShell>
        <Home>
          <AdCarousel
            ariaLabel="홈 상단 광고"
            items={heroAds}
            variant="hero"
            priceOverlay={
              adPreviewPrice
                ? { label: '하루 광고비', value: `${adPreviewPrice.toLocaleString()}원` }
                : undefined
            }
          />
          <MobileHero href="/my/interests">
            <h2>나에게 맞는 챌린지 찾기</h2>
            <p>관심분야 등록하고 맞춤 추천 받아보세요</p>
          </MobileHero>
          <Sections>
            <section>
              <DesktopOnly style={{ margin: '28px 0' }}>
                <Row gap={16}>
                  <Dropdown
                    aria-label="분야"
                    size="S"
                    width={104}
                    placeholder="분야"
                    options={[
                      { value: '분야', label: '분야' },
                      { value: 'IT/SW', label: 'IT/SW' },
                      { value: '디자인', label: '디자인' },
                    ]}
                  />
                  <Dropdown
                    aria-label="연도"
                    size="S"
                    width={104}
                    placeholder="2025년"
                    options={[
                      { value: '2025년', label: '2025년' },
                      { value: '2024년', label: '2024년' },
                    ]}
                  />
                  <Dropdown
                    aria-label="수상등급"
                    size="S"
                    width={104}
                    placeholder="수상등급"
                    options={[
                      { value: '수상등급', label: '수상등급' },
                      { value: '대상', label: '대상' },
                      { value: '우수상', label: '우수상' },
                    ]}
                  />
                </Row>
              </DesktopOnly>
              <SectionHeader
                title="지영님에게 맞는 AI 추천"
                action={<More href="/explore">더보기 →</More>}
              />
              <div style={{ height: 16 }} />
              <DesktopOnly>
                <Rail>
                  {recommendationContests.slice(0, 4).map((contest) => (
                    <ContestCard key={contest.id} contest={contest} />
                  ))}
                </Rail>
              </DesktopOnly>
              <MobileOnly>
                <Rail>
                  {recommendationContests.slice(0, 2).map((contest) => (
                    <ContestCard key={contest.id} contest={contest} simple />
                  ))}
                </Rail>
              </MobileOnly>
            </section>
            <section>
              <DesktopOnly>
                <SectionHeader
                  title="마감임박 D-10"
                  action={<More href="/explore">더보기 →</More>}
                />
                <div style={{ height: 16 }} />
                <Rail>
                  {desktopContests.slice(0, 4).map((contest) => (
                    <ContestCard key={contest.id} contest={contest} />
                  ))}
                </Rail>
              </DesktopOnly>
              <MobileOnly>
                <SectionHeader
                  title="마감임박! 지금 해야하는 챌린지"
                  action={<More href="/explore">더보기 →</More>}
                />
                <div style={{ display: 'grid', gap: 14, marginTop: 16 }}>
                  {desktopContests.slice(0, 4).map((contest) => (
                    <ContestCard key={contest.id} contest={contest} horizontal />
                  ))}
                </div>
              </MobileOnly>
            </section>
          </Sections>
          <AdCarousel
            ariaLabel="홈 중간 광고"
            items={galleryAds}
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
                <TeamRail>
                  {teams.map((team) => (
                    <TeamCard key={team.id} team={team} />
                  ))}
                </TeamRail>
              </DesktopOnly>
              <MobileOnly>
                <TeamRail>
                  {teams.slice(0, 3).map((team) => (
                    <TeamCard key={team.id} team={team} />
                  ))}
                </TeamRail>
              </MobileOnly>
            </section>
          </Sections>
        </Home>
      </UserShell>
    </PreviewLock>
  );
}

function challengeToContest(challenge: {
  id?: string;
  title?: string;
  category?: string;
  endDate?: string;
}): Contest {
  const endDate = challenge.endDate ? new Date(challenge.endDate).getTime() : Date.now();
  return {
    id: challenge.id ?? '',
    title: challenge.title ?? '챌린지',
    category: challenge.category ?? '기타',
    days: Math.max(0, Math.ceil((endDate - Date.now()) / (24 * 60 * 60 * 1000))),
    // 추천 응답에는 팀 모집 수가 없다 — 0으로 꾸며 보여주지 않고 카드에서 배지를 숨긴다.
    teams: undefined,
  };
}

const Home = styled.div({ padding: '60px 0', overflow: 'hidden', [mobile]: { padding: 0 } });
const PreviewLock = styled('div', { shouldForwardProp: (prop) => prop !== 'locked' })<{
  locked: boolean;
}>(({ locked }) => (locked ? { pointerEvents: 'none' } : undefined));
const MobileHero = styled(Link)({
  display: 'none',
  [mobile]: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    height: 150,
    padding: 20,
    marginBottom: 16,
    background: c.lightBlue,
    borderRadius: 6,
    '& h2': textStyle.h2_2,
    '& p': textStyle.metaText,
  },
});
const Sections = styled.div<{ last?: boolean }>(({ last }) => ({
  maxWidth: 1200,
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 60,
  [mobile]: { gap: 32, padding: last ? '0 16px 32px' : '0 16px' },
}));
const Rail = styled.div({
  display: 'flex',
  gap: 16,
  overflowX: 'auto',
  scrollbarWidth: 'none',
  '& > article': { flex: '0 0 416px' },
  [mobile]: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 8,
    '& > article': { flex: 'none' },
  },
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
