'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';
import { UserShell } from '@/components/common/UserShell';
import { DesktopOnly, EmptyState, MobileOnly, Row } from '@/components/common/Primitives';
import { ContestCard, ContestGrid } from './ContestCard';
import { contestHref } from './contest-links';
import { TeamCard, TeamGrid } from '@/components/teams/TeamCard';
import {
  categories,
  challengeTargets,
  organizerTypes,
  regionGroups,
  roles,
  type Contest,
} from '@/data/user-design';
import { generated } from '@semochal/api-client';
import { toTeamCard } from '@/components/teams/team-model';
import { colors as c, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { useUserStore } from '@/stores/useUserStore';
import { Dropdown } from '@/components/ui/Dropdown';
import { ChallengeSearch } from './ChallengeSearch';
import { RangeSlider } from '@/components/ui/RangeSlider';
import { Checkbox, CheckFilter, ChipFilter, FilterPopover, toggleValue } from './ExploreFilters';
import { daysUntil, isPastDeadline } from '@/lib/date';

// 상금 필터 범위(만원). 전체 범위이면 서버에 상금 조건을 보내지 않는다.
const PRIZE_MIN = 0;
const PRIZE_MAX = 10_000;

const MOBILE_FILTER_MAX_WIDTH = 110;

// 한 페이지에 보여줄 공모전 수(데스크톱 4열 × 4행).
const PAGE_SIZE = 16;

export function ExplorePage({
  teamMode = false,
  initialCategory,
  initialRole,
}: {
  teamMode?: boolean;
  initialCategory?: string;
  initialRole?: string;
}) {
  const query = useUserStore((s) => s.query);
  // 필터 바가 실제로 화면 상단에 붙어 떠 있을 때만 그림자를 준다(sentinel이 화면 밖으로 나간 시점).
  const dockSentinel = useRef<HTMLDivElement>(null);
  const [floating, setFloating] = useState(false);
  useEffect(() => {
    const el = dockSentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setFloating(!entry?.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    initialCategory && categories.includes(initialCategory) ? [initialCategory] : [],
  );
  const [targets, setTargets] = useState<string[]>([]);
  const [organizers, setOrganizers] = useState<string[]>([]);
  const [prize, setPrize] = useState<[number, number]>([PRIZE_MIN, PRIZE_MAX]);
  const [challengeId, setChallengeId] = useState('');
  const [teamRoles, setTeamRoles] = useState<string[]>(
    initialRole && roles.includes(initialRole) ? [initialRole] : [],
  );
  const [regionLabels, setRegionLabels] = useState<string[]>([]);
  const [sort, setSort] = useState('마감임박');
  const [pageState, setPageState] = useState({ key: '', page: 1 });
  const [includeClosed, setIncludeClosed] = useState(true);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const prizeActive = prize[0] > PRIZE_MIN || prize[1] < PRIZE_MAX;
  const hasFilters =
    selectedCategories.length > 0 || targets.length > 0 || organizers.length > 0 || prizeActive;
  const resetFilters = () => {
    setSelectedCategories([]);
    setTargets([]);
    setOrganizers([]);
    setPrize([PRIZE_MIN, PRIZE_MAX]);
  };
  // D-day 계산 기준 시각은 마운트 시 한 번만 잡는다(렌더 중 Date.now() 호출 금지).
  const [now] = useState(() => Date.now());
  // 챌린지 탐색 목록. 팀 모드의 챌린지 필터는 ChallengeSearch가 따로 검색하므로 여기서는 조회하지 않는다.
  // 필터·정렬·검색어가 바뀌면 1페이지로 돌아간다(키가 달라지면 저장된 페이지를 무시).
  const filterKey = JSON.stringify([
    query,
    selectedCategories,
    targets,
    organizers,
    prize,
    includeClosed,
    sort,
  ]);
  const page = pageState.key === filterKey ? pageState.page : 1;
  const challengesQuery = generated.useListChallenges(
    {
      limit: PAGE_SIZE,
      page,
      q: query || undefined,
      category: selectedCategories.join(',') || undefined,
      targets: targets.join(',') || undefined,
      organizerType: organizers.join(',') || undefined,
      prizeMin: prize[0] > PRIZE_MIN ? prize[0] : undefined,
      prizeMax: prize[1] < PRIZE_MAX ? prize[1] : undefined,
      includeClosed,
      sort: sort === '마감임박' ? 'deadline' : sort === '인기' ? 'popular' : 'latest',
    },
    { query: { enabled: !teamMode } },
  );
  const challengeOptions = challengesQuery.data?.data.items ?? [];
  const teamsQuery = generated.useListTeams(
    {
      challengeId: challengeId || undefined,
      role: teamRoles.join(',') || undefined,
      region:
        regionGroups
          .filter((group) => regionLabels.includes(group.label))
          .flatMap((group) => group.members)
          .join(',') || undefined,
      q: query || undefined,
    },
    { query: { enabled: teamMode } },
  );
  const teamCards = (teamsQuery.data?.data ?? []).map(toTeamCard);
  const contestCards: Contest[] = challengeOptions.map((challenge) => ({
    id: challenge.id ?? '',
    title: challenge.title ?? '챌린지',
    category: challenge.category ?? '기타',
    days: daysUntil(challenge.endDate, now),
    closed: isPastDeadline(challenge.endDate, now),
    // 목록 응답에는 팀 모집 수가 없다 — 0으로 꾸며 보여주지 않고 카드에서 배지를 숨긴다.
    teams: undefined,
    posterUrl: challenge.posterUrl ?? null,
    thumbnailUrl: challenge.thumbnailUrl ?? null,
    prizeAmount: challenge.prizeAmount ?? null,
  }));
  const totalPages = Math.ceil((challengesQuery.data?.data.total ?? 0) / PAGE_SIZE);
  const goToPage = (next: number) => {
    setPageState({ key: filterKey, page: next });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  return (
    <UserShell>
      <Layout>
        <div ref={dockSentinel} aria-hidden style={{ height: 1, marginBottom: -1 }} />
        {teamMode ? (
          <FilterDock $floating={floating}>
            <FilterPopover label="챌린지" count={challengeId ? 1 : 0}>
              <ChallengeSearch value={challengeId} onChange={setChallengeId} />
            </FilterPopover>
            <FilterPopover label="필요 역할" count={teamRoles.length}>
              <ChipFilter
                ariaLabel="필요 역할"
                maxWidth={300}
                options={roles}
                selected={teamRoles}
                onToggle={(value) => setTeamRoles((list) => toggleValue(list, value))}
              />
            </FilterPopover>
            <FilterPopover label="지역" count={regionLabels.length}>
              <CheckFilter
                options={regionGroups.map((group) => group.label)}
                selected={regionLabels}
                onToggle={(value) => setRegionLabels((list) => toggleValue(list, value))}
                rows={Math.ceil(regionGroups.length / 2)}
                columnGap={32}
              />
            </FilterPopover>
            {(challengeId || teamRoles.length > 0 || regionLabels.length > 0) && (
              <ResetButton
                type="button"
                onClick={() => {
                  setChallengeId('');
                  setTeamRoles([]);
                  setRegionLabels([]);
                }}
              >
                초기화
              </ResetButton>
            )}
          </FilterDock>
        ) : (
          <>
            <FilterDock $floating={floating}>
              <FilterPopover label="분야" count={selectedCategories.length}>
                <ChipFilter
                  ariaLabel="분야"
                  maxWidth={300}
                  options={categories}
                  selected={selectedCategories}
                  onToggle={(value) => setSelectedCategories((list) => toggleValue(list, value))}
                />
              </FilterPopover>
              <FilterPopover label="대상" count={targets.length}>
                <CheckFilter
                  options={challengeTargets}
                  selected={targets}
                  onToggle={(value) => setTargets((list) => toggleValue(list, value))}
                  rows={Math.ceil(challengeTargets.length / 2)}
                  columnGap={32}
                />
              </FilterPopover>
              <FilterPopover label="주최기관" count={organizers.length}>
                <CheckFilter
                  options={organizerTypes}
                  selected={organizers}
                  onToggle={(value) => setOrganizers((list) => toggleValue(list, value))}
                  rows={Math.ceil(organizerTypes.length / 2)}
                  columnGap={32}
                />
              </FilterPopover>
              <FilterPopover label="상금" count={prizeActive ? 1 : 0}>
                <PrizeLabel>
                  {prize[0].toLocaleString()}~{prize[1].toLocaleString()}만원
                </PrizeLabel>
                <PrizeSlider>
                  <RangeSlider
                    min={PRIZE_MIN}
                    max={PRIZE_MAX}
                    step={500}
                    value={prize}
                    onChange={setPrize}
                    minAriaLabel="상금 최솟값"
                    maxAriaLabel="상금 최댓값"
                  />
                </PrizeSlider>
              </FilterPopover>
              {hasFilters && (
                <ResetButton type="button" onClick={resetFilters}>
                  초기화
                </ResetButton>
              )}
            </FilterDock>
          </>
        )}
        <Results $team={teamMode}>
          <MobileFilters>
            {teamMode ? (
              <>
                <ChallengeSearch fullWidth value={challengeId} onChange={setChallengeId} />
                {[
                  {
                    label: '필요역할',
                    value: teamRoles[0] ?? '',
                    onChange: (value: string) => setTeamRoles(value ? [value] : []),
                    options: roles.map((x) => ({ value: x, label: x })),
                  },
                  {
                    label: '지역',
                    value: regionLabels[0] ?? '',
                    onChange: (value: string) => setRegionLabels(value ? [value] : []),
                    options: regionGroups.map((group) => ({
                      value: group.label,
                      label: group.label,
                    })),
                  },
                ].map((filter) => (
                  <Dropdown
                    key={filter.label}
                    aria-label={filter.label}
                    size="S"
                    width="auto"
                    style={{ maxWidth: MOBILE_FILTER_MAX_WIDTH }}
                    value={filter.value}
                    onChange={filter.onChange}
                    options={[{ value: '', label: filter.label }, ...filter.options]}
                  />
                ))}
              </>
            ) : (
              <>
                <Dropdown
                  aria-label="분야"
                  size="S"
                  width="auto"
                  style={{ maxWidth: MOBILE_FILTER_MAX_WIDTH }}
                  value={selectedCategories[0] ?? ''}
                  onChange={(value) => setSelectedCategories(value ? [value] : [])}
                  options={[
                    { value: '', label: '분야' },
                    ...categories.map((v) => ({ value: v, label: v })),
                  ]}
                />
                <Checkbox
                  label="마감된 챌린지 포함"
                  checked={includeClosed}
                  onChange={setIncludeClosed}
                />
              </>
            )}
          </MobileFilters>
          <TopBar>
            {teamMode ? (
              <>
                <CreateLink href="/teams/new">
                  <img src="/assets/icons/figma-create-plus.svg" alt="" width={14} height={14} />
                  모집글 작성
                </CreateLink>
              </>
            ) : (
              <>
                <Row>
                  {['마감임박', '최신', '인기'].map((x) => (
                    <Sort key={x} active={sort === x} onClick={() => setSort(x)}>
                      {x}
                    </Sort>
                  ))}
                </Row>
                <DesktopOnly>
                  <SortEnd>
                    <Checkbox
                      label="마감된 챌린지도 포함하기"
                      checked={includeClosed}
                      onChange={setIncludeClosed}
                    />
                    <ViewToggle role="group" aria-label="보기 방식">
                      <ViewButton
                        type="button"
                        aria-label="그리드로 보기"
                        aria-pressed={view === 'grid'}
                        onClick={() => setView('grid')}
                      >
                        <GridIcon />
                      </ViewButton>
                      <ViewButton
                        type="button"
                        aria-label="목록으로 보기"
                        aria-pressed={view === 'list'}
                        onClick={() => setView('list')}
                      >
                        <ListIcon />
                      </ViewButton>
                    </ViewToggle>
                  </SortEnd>
                </DesktopOnly>
              </>
            )}
          </TopBar>
          {teamMode ? (
            <>
              {teamsQuery.isPending ? (
                <SkeletonStatus role="status" aria-label="팀 모집글을 불러오는 중입니다">
                  <TeamSkeletonGrid />
                </SkeletonStatus>
              ) : (
                <>
                  <TeamGridReveal>
                    {teamCards.map((team) => (
                      <TeamCard key={team.id} team={team} />
                    ))}
                  </TeamGridReveal>
                  {teamsQuery.isSuccess && teamCards.length === 0 && <EmptyState />}
                </>
              )}
            </>
          ) : (
            <>
              {challengesQuery.isPending ? (
                <SkeletonStatus role="status" aria-label="공모전 목록을 불러오는 중입니다">
                  <DesktopOnly>
                    <ContestSkeletonGrid />
                  </DesktopOnly>
                  <MobileOnly>
                    <ContestSkeletonGrid />
                  </MobileOnly>
                </SkeletonStatus>
              ) : (
                <>
                  <DesktopOnly>
                    <ExploreGridReveal $list={view === 'list'}>
                      {contestCards.map((x) => (
                        <ContestCard
                          key={x.id}
                          contest={x}
                          href={contestHref(x.id)}
                          row={view === 'list'}
                        />
                      ))}
                    </ExploreGridReveal>
                  </DesktopOnly>
                  <MobileOnly>
                    <ContestGridReveal>
                      {contestCards.map((x) => (
                        <ContestCard key={x.id} contest={x} href={contestHref(x.id)} />
                      ))}
                    </ContestGridReveal>
                  </MobileOnly>
                  {challengesQuery.isSuccess && contestCards.length === 0 && <EmptyState />}
                </>
              )}
              {totalPages > 1 && (
                <PageNav aria-label="페이지 이동">
                  <PageButton
                    type="button"
                    aria-label="이전 페이지"
                    disabled={page <= 1}
                    onClick={() => goToPage(page - 1)}
                  >
                    ‹
                  </PageButton>
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((n) => (
                    <PageButton
                      key={n}
                      type="button"
                      aria-label={`${n}페이지`}
                      aria-current={n === page ? 'page' : undefined}
                      onClick={() => goToPage(n)}
                    >
                      {n}
                    </PageButton>
                  ))}
                  <PageButton
                    type="button"
                    aria-label="다음 페이지"
                    disabled={page >= totalPages}
                    onClick={() => goToPage(page + 1)}
                  >
                    ›
                  </PageButton>
                </PageNav>
              )}
            </>
          )}
        </Results>
      </Layout>
    </UserShell>
  );
}

function TeamSkeletonGrid() {
  return (
    <TeamGrid aria-hidden="true">
      {Array.from({ length: 6 }, (_, index) => (
        <TeamSkeletonCard key={index} data-skeleton-card>
          <Shimmer className="poster" />
          <div className="body">
            <Shimmer className="title" />
            <div className="roles">
              <Shimmer />
              <Shimmer />
            </div>
            <div className="footer">
              <Shimmer />
              <Shimmer />
            </div>
          </div>
        </TeamSkeletonCard>
      ))}
    </TeamGrid>
  );
}

function ContestSkeletonGrid() {
  return (
    <ContestGrid aria-hidden="true">
      {Array.from({ length: 6 }, (_, index) => (
        <ContestSkeletonCard key={index} data-skeleton-card>
          <Shimmer className="artwork" />
          <div className="card-body">
            <Shimmer className="title" />
            <div className="meta">
              <Shimmer />
              <Shimmer />
            </div>
          </div>
        </ContestSkeletonCard>
      ))}
    </ContestGrid>
  );
}

const Layout = styled.div({ display: 'block' });
// 필터 칩 바는 스크롤해도 화면 상단에 붙어 있고, 펼침은 칩 아래 팝오버로 처리해 목록을 밀어내지 않는다.
const FilterDock = styled.div<{ $floating: boolean }>(({ $floating }) => ({
  position: 'sticky',
  top: 12,
  zIndex: 10,
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 8,
  // 헤더 기준선(1200px)과 같은 좌우 여백.
  margin: `0 ${CONTENT_INLINE}`,
  padding: '12px 0',
  background: c.white,
  // 화면 상단에 붙어 떠 있을 때만 아래쪽으로 그림자.
  boxShadow: $floating ? '0 8px 12px -8px rgba(0, 0, 0, 0.16)' : 'none',
  transition: 'box-shadow 0.2s ease',
  [mobile]: { display: 'none' },
}));
// 좌우 여백은 헤더(로고 시작 ~ 프로필 아이콘 끝, 1200px)와 같은 기준선을 쓴다.
const CONTENT_INLINE = 'max(24px, calc((100% - 1200px) / 2))';
const ResetButton = styled.button({
  ...textStyle.caption,
  padding: '6px 8px',
  border: 0,
  background: 'transparent',
  color: c.gray500,
  textDecoration: 'underline',
  cursor: 'pointer',
});
const PrizeSlider = styled.div({ width: 240, marginTop: 8 });
const SortEnd = styled.div({ display: 'flex', alignItems: 'center', gap: 16 });
const ViewToggle = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  padding: 2,
  borderRadius: 8,
  border: `0.5px solid ${c.gray200}`,
  background: c.white,
});
const ViewButton = styled.button({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  padding: 0,
  border: 0,
  borderRadius: 6,
  background: 'transparent',
  color: c.gray500,
  cursor: 'pointer',
  '&:hover': { background: c.gray50 },
  '&[aria-pressed=true]': { background: c.gray100, color: c.gray900 },
  '&:focus-visible': { outline: `2px solid ${c.primary}`, outlineOffset: 1 },
});
function GridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.2" />
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.2" />
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.2" />
      <rect x="9" y="9" width="5.5" height="5.5" rx="1.2" />
    </svg>
  );
}
function ListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="1.5" y="2" width="13" height="3" rx="1" />
      <rect x="1.5" y="6.5" width="13" height="3" rx="1" />
      <rect x="1.5" y="11" width="13" height="3" rx="1" />
    </svg>
  );
}
const ExploreGrid = styled(ContestGrid)<{ $list: boolean }>(({ $list }) => ({
  gridTemplateColumns: $list ? '1fr' : 'repeat(4, minmax(0, 1fr))',
  gap: $list ? 12 : 16,
}));

// 필터·페이지 변경으로 목록이 다시 그려질 때 카드가 순차적으로 떠오른다.
// 지연은 앞 6개만 계단식으로 주고 이후 카드는 상한(180ms)에 묶어 긴 목록이 늦어지지 않게 한다.
const riseIn = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: none; }
`;
const staggerIn = {
  '& > *': { animation: `${riseIn} 0.28s ease both` },
  '& > *:nth-child(2)': { animationDelay: '30ms' },
  '& > *:nth-child(3)': { animationDelay: '60ms' },
  '& > *:nth-child(4)': { animationDelay: '90ms' },
  '& > *:nth-child(5)': { animationDelay: '120ms' },
  '& > *:nth-child(6)': { animationDelay: '150ms' },
  '& > *:nth-child(n+7)': { animationDelay: '180ms' },
  '@media (prefers-reduced-motion: reduce)': { '& > *': { animation: 'none' } },
};
const TeamGridReveal = styled(TeamGrid)(staggerIn);
const ExploreGridReveal = styled(ExploreGrid)<{ $list: boolean }>(staggerIn);
const ContestGridReveal = styled(ContestGrid)(staggerIn);
const PageNav = styled.nav({
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  gap: 4,
  marginTop: 40,
});
const PageButton = styled.button({
  ...textStyle.caption,
  minWidth: 32,
  height: 32,
  padding: '0 8px',
  border: 0,
  borderRadius: 8,
  background: 'transparent',
  color: c.gray700,
  cursor: 'pointer',
  '&:hover:not(:disabled)': { background: c.gray50 },
  '&[aria-current=page]': { background: c.primary, color: c.white },
  '&:disabled': { color: c.gray300, cursor: 'default' },
  '&:focus-visible': { outline: `2px solid ${c.primary}`, outlineOffset: 1 },
});
const PrizeLabel = styled.p({ ...textStyle.caption, color: c.gray700, margin: 0 });
const TopBar = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 12,
  marginBottom: 20,
});
const CreateLink = styled(Link)({
  marginLeft: 'auto',
  ...textStyle.subtitle,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 16px',
  borderRadius: 8,
  background: c.primary,
  color: c.white,
});
// Figma RightContent 패딩: 팀 탐색 24/32, 공모전 접힘 20(상단)·24(하단), 펼침 32.
const Results = styled.div<{ $team?: boolean }>(({ $team }) => ({
  boxSizing: 'border-box',
  padding: `8px ${CONTENT_INLINE} ${$team ? 100 : 24}px`,
  minWidth: 0,
  minHeight: 900,
  [mobile]: { padding: '24px 16px', minHeight: 0 },
}));
const Sort = styled.button<{ active?: boolean }>(({ active }) => ({
  border: 0,
  background: 'transparent',
  ...(active ? textStyle.caption2 : textStyle.caption),
  color: active ? c.primary : c.gray500,
}));
const MobileFilters = styled.div({
  display: 'none',
  [mobile]: {
    display: 'flex',
    gap: 8,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
});

const shimmer = keyframes({
  '0%': { backgroundPosition: '100% 0' },
  '100%': { backgroundPosition: '-100% 0' },
});
const Shimmer = styled.div({
  height: 12,
  borderRadius: 6,
  background: `linear-gradient(90deg, ${c.gray100} 25%, ${c.gray50} 50%, ${c.gray100} 75%)`,
  backgroundSize: '200% 100%',
  animation: `${shimmer} 1.4s ease-in-out infinite`,
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
});
const SkeletonStatus = styled.div({ width: '100%' });
const TeamSkeletonCard = styled.article({
  background: c.white,
  border: `0.5px solid ${c.gray200}`,
  borderRadius: 12,
  overflow: 'hidden',
  minWidth: 0,
  '.poster': { height: 135, borderRadius: 0 },
  '.body': { padding: 16, display: 'flex', flexDirection: 'column', gap: 10 },
  '.title': { width: '62%', height: 20 },
  '.roles, .footer': { display: 'flex', justifyContent: 'space-between', gap: 8 },
  '.roles > div': { width: 56 },
  '.footer > div:first-of-type': { width: '38%' },
  '.footer > div:last-of-type': { width: 76 },
  [mobile]: {
    border: '0.5px solid #f0f1f3',
    borderRadius: 14,
    '.poster': { display: 'none' },
    '.body': { padding: 14, gap: 10 },
  },
});
const ContestSkeletonCard = styled.article({
  borderRadius: 12,
  overflow: 'hidden',
  minWidth: 0,
  background: c.white,
  '.artwork': { height: 188, borderRadius: '12px 12px 0 0' },
  '.card-body': { display: 'flex', flexDirection: 'column', gap: 8, padding: 14 },
  '.title': { width: '76%', height: 20 },
  '.meta': { display: 'flex', justifyContent: 'space-between', gap: 8 },
  '.meta > div': { width: '36%' },
  [mobile]: {
    border: '0.5px solid #f0f1f3',
    '.artwork': { height: 160 },
    '.card-body': { padding: 12 },
  },
});
