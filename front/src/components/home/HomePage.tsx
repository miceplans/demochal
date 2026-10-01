'use client';
import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import styled from '@emotion/styled';
import { UserShell } from '@/components/common/UserShell';
import { SectionHeader, Row, DesktopOnly, MobileOnly } from '@/components/common/Primitives';
import { Dropdown } from '@/components/ui/Dropdown';
import { contestHref } from '@/components/contests/contest-links';
import { ContestCard } from '@/components/contests/ContestCard';
import { TeamCard } from '@/components/teams/TeamCard';
import { AdCarousel } from '@/components/ads/AdCarousel';
import { fallbackAds, publicAdsQuery, toAdItems } from '@/components/ads/hero-ads';
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

const noopSubscribe = () => () => {};
const getAdPreviewPriceSnapshot = () => new URLSearchParams(window.location.search).get('adPrice');
const getAdPreviewPriceServerSnapshot = () => null;

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
  const adPreviewPrice = adPriceParam ? Number(adPriceParam) : null;
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
  // 마감 임박순으로 최대 4개 — 마감일이 없는 챌린지는 D-day를 표시할 수 없어 제외한다.
  const { data: deadlineList } = generated.useListChallenges({
    sort: 'deadline',
    includeClosed: false,
    limit: 4,
  });
  const liveDeadlineContests = (deadlineList?.data.items ?? [])
    .filter((challenge) => Boolean(challenge.endDate))
    .slice(0, 4)
    .map((challenge) => challengeToContest(challenge, now));
  const { recommendationContests, deadlineContests, teams, isFallbackTeamList } =
    getHomeFallbackData({
      recommendationContests: liveRecommendationContests,
      deadlineContests: liveDeadlineContests,
      teams: liveTeams,
      fallbackContests: fallbackContests.slice(0, 4),
      fallbackTeams: fallbackTeams.slice(0, 4),
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
                  title={userName ? `${userName}님에게 맞는 AI 추천` : '회원님에게 맞는 AI 추천'}
                  action={<More href="/explore">더보기 →</More>}
                />
                <div style={{ height: 16 }} />
                <DesktopOnly>
                  <Rail>
                    {recommendationContests.slice(0, 4).map((contest) => (
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
                    {recommendationContests.slice(0, 2).map((contest) => (
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
                    title={`마감임박 D-${Math.min(...deadlineContests.map((contest) => contest.days))}`}
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
                <TeamRail>
                  {teams.map((team) => (
                    <TeamCard key={team.id} team={team} displayOnly={isFallbackTeamList} />
                  ))}
                </TeamRail>
              </DesktopOnly>
              <MobileOnly>
                <TeamRail>
                  {teams.slice(0, 3).map((team) => (
                    <TeamCard key={team.id} team={team} displayOnly={isFallbackTeamList} />
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

function challengeToContest(
  challenge: {
    id?: string;
    title?: string;
    category?: string;
    endDate?: string;
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
  };
}

const Home = styled.div({ padding: '60px 0', overflow: 'hidden', [mobile]: { padding: 0 } });
const PreviewLock = styled('div', { shouldForwardProp: (prop) => prop !== 'locked' })<{
  locked: boolean;
}>(({ locked }) => (locked ? { pointerEvents: 'none' } : undefined));
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
