'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';
import { UserShell } from '@/components/common/UserShell';
import {
  Button,
  DesktopOnly,
  EmptyState,
  MobileOnly,
  Row,
  Heading,
} from '@/components/common/Primitives';
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
import { RangeSlider } from '@/components/ui/RangeSlider';
import { Checkbox, CheckFilter, ChipFilter, FilterGroup, toggleValue } from './ExploreFilters';
import { daysUntil } from '@/lib/date';

// 상금 필터 범위(만원). 전체 범위이면 서버에 상금 조건을 보내지 않는다.
const PRIZE_MIN = 0;
const PRIZE_MAX = 10_000;

const MOBILE_FILTER_MAX_WIDTH = 110;

export function ExplorePage({ teamMode = false }: { teamMode?: boolean }) {
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
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [targets, setTargets] = useState<string[]>([]);
  const [organizers, setOrganizers] = useState<string[]>([]);
  const [prize, setPrize] = useState<[number, number]>([PRIZE_MIN, PRIZE_MAX]);
  const [challengeId, setChallengeId] = useState('');
  const [teamRoles, setTeamRoles] = useState<string[]>([]);
  const [regionLabels, setRegionLabels] = useState<string[]>([]);
  const [sort, setSort] = useState('마감임박');
  const [limit, setLimit] = useState(6);
  const [includeClosed, setIncludeClosed] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  // 접힌 필터 바에 나열할 선택 항목. 칩을 누르면 해당 필터만 해제된다.
  const selectedFilters = [
    ...selectedCategories.map((value) => ({
      key: `category:${value}`,
      label: value,
      clear: () => setSelectedCategories((list) => toggleValue(list, value)),
    })),
    ...targets.map((value) => ({
      key: `target:${value}`,
      label: value,
      clear: () => setTargets((list) => toggleValue(list, value)),
    })),
    ...organizers.map((value) => ({
      key: `organizer:${value}`,
      label: value,
      clear: () => setOrganizers((list) => toggleValue(list, value)),
    })),
    ...(prize[0] > PRIZE_MIN || prize[1] < PRIZE_MAX
      ? [
          {
            key: 'prize',
            label: `${prize[0].toLocaleString()}~${prize[1].toLocaleString()}만원`,
            clear: () => setPrize([PRIZE_MIN, PRIZE_MAX]),
          },
        ]
      : []),
  ];
  // D-day 계산 기준 시각은 마운트 시 한 번만 잡는다(렌더 중 Date.now() 호출 금지).
  const [now] = useState(() => Date.now());
  // 챌린지 목록(탐색)과 팀 모드의 챌린지 드롭다운 옵션을 한 쿼리로 공용한다 — teamMode와 무관하게 항상 조회.
  // 팀 모드에서는 드롭다운 옵션 확보가 목적이라 고정 50건, 탐색 모드에서는 더보기 클릭 시 limit을 늘린다.
  const challengesQuery = generated.useListChallenges({
    limit: teamMode ? 50 : limit,
    q: query || undefined,
    category: selectedCategories.join(',') || undefined,
    targets: targets.join(',') || undefined,
    organizerType: organizers.join(',') || undefined,
    prizeMin: prize[0] > PRIZE_MIN ? prize[0] : undefined,
    prizeMax: prize[1] < PRIZE_MAX ? prize[1] : undefined,
    includeClosed,
    sort: sort === '마감임박' ? 'deadline' : sort === '인기' ? 'popular' : 'latest',
  });
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
    // 목록 응답에는 팀 모집 수가 없다 — 0으로 꾸며 보여주지 않고 카드에서 배지를 숨긴다.
    teams: undefined,
  }));
  const hasMoreChallenges = Boolean(challengesQuery.data?.data.nextCursor);
  return (
    <UserShell>
      <Layout $team={teamMode}>
        {teamMode ? (
          <Sidebar>
            <Heading>필터</Heading>
            <>
              <FilterGroup title="챌린지">
                <Dropdown
                  aria-label="챌린지"
                  size="S"
                  value={challengeId}
                  onChange={setChallengeId}
                  options={[
                    { value: '', label: '전체 챌린지' },
                    ...challengeOptions.map((x) => ({ value: x.id ?? '', label: x.title ?? '' })),
                  ]}
                />
              </FilterGroup>
              <FilterGroup title="필요 역할">
                <ChipFilter
                  ariaLabel="필요 역할"
                  options={roles}
                  selected={teamRoles}
                  onToggle={(value) => setTeamRoles((list) => toggleValue(list, value))}
                />
              </FilterGroup>
              <FilterGroup title="지역">
                <CheckFilter
                  options={regionGroups.map((group) => group.label)}
                  selected={regionLabels}
                  onToggle={(value) => setRegionLabels((list) => toggleValue(list, value))}
                  rows={4}
                  columnGap={40}
                />
              </FilterGroup>
            </>
          </Sidebar>
        ) : (
          <>
            <div ref={dockSentinel} aria-hidden style={{ height: 1, marginBottom: -1 }} />
            <FilterDock $sticky={!filterOpen} $floating={floating && !filterOpen}>
              <Collapsible open={filterOpen}>
                <FilterPanel aria-label="필터">
                  <PanelInner>
                    <PanelTitle type="button" aria-expanded onClick={() => setFilterOpen(false)}>
                      필터
                      <img
                        src="/assets/icons/figma-filter-title.svg"
                        alt=""
                        width={20}
                        height={20}
                      />
                    </PanelTitle>
                    <PanelRow>
                      <>
                        <FilterGroup fit title="분야">
                          <ChipFilter
                            ariaLabel="분야"
                            maxWidth={190}
                            options={categories}
                            selected={selectedCategories}
                            onToggle={(value) =>
                              setSelectedCategories((list) => toggleValue(list, value))
                            }
                          />
                        </FilterGroup>
                        <FilterGroup fit title="대상">
                          <CheckFilter
                            options={challengeTargets}
                            selected={targets}
                            onToggle={(value) => setTargets((list) => toggleValue(list, value))}
                            rows={5}
                            columnGap={51}
                          />
                        </FilterGroup>
                        <FilterGroup fit title="주최기관">
                          <CheckFilter
                            options={organizerTypes}
                            selected={organizers}
                            onToggle={(value) => setOrganizers((list) => toggleValue(list, value))}
                            rows={5}
                            columnGap={7}
                          />
                        </FilterGroup>
                        <FilterGroup fit title="상금">
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
                        </FilterGroup>
                      </>
                    </PanelRow>
                  </PanelInner>
                </FilterPanel>
              </Collapsible>
              <Collapsible open={!filterOpen}>
                <FilterBar>
                  <FilterToggle
                    type="button"
                    aria-expanded={false}
                    onClick={() => setFilterOpen(true)}
                  >
                    필터
                    <img
                      src="/assets/icons/figma-filter-button.svg"
                      alt=""
                      width={20}
                      height={20}
                    />
                  </FilterToggle>
                  {selectedFilters.map((filter) => (
                    <FilterChip
                      key={filter.key}
                      type="button"
                      aria-label={`${filter.label} 필터 해제`}
                      onClick={filter.clear}
                    >
                      {filter.label}
                      <span aria-hidden>×</span>
                    </FilterChip>
                  ))}
                </FilterBar>
              </Collapsible>
            </FilterDock>
          </>
        )}
        <Results $team={teamMode} $wide={filterOpen}>
          <MobileFilters>
            {teamMode ? (
              [
                {
                  label: '전체 챌린지',
                  value: challengeId,
                  onChange: setChallengeId,
                  options: challengeOptions.map((x) => ({
                    value: x.id ?? '',
                    label: x.title ?? '',
                  })),
                },
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
                  variant="pill"
                  width="auto"
                  style={{ maxWidth: MOBILE_FILTER_MAX_WIDTH }}
                  value={filter.value}
                  onChange={filter.onChange}
                  options={[{ value: '', label: filter.label }, ...filter.options]}
                />
              ))
            ) : (
              <>
                <Dropdown
                  aria-label="분야"
                  variant="pill"
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
              {hasMoreChallenges && (
                <Row style={{ justifyContent: 'center', marginTop: 40 }}>
                  <Button small onClick={() => setLimit((v) => v + 6)}>
                    더보기
                  </Button>
                </Row>
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

const Layout = styled.div<{ $team: boolean }>(({ $team }) => ({
  display: $team ? 'grid' : 'block',
  gridTemplateColumns: '260px minmax(0, 1fr)',
  [mobile]: { display: 'block' },
}));
// 접힌 필터 버튼은 스크롤해도 화면 상단에 붙어 있도록 Layout 바로 아래에서 sticky로 고정한다.
// 펼친 패널(약 280px)까지 고정하면 목록을 가리므로 패널은 일반 흐름에 둔다.
const FilterDock = styled.div<{ $sticky: boolean; $floating: boolean }>(
  ({ $sticky, $floating }) => ({
    ...($sticky
      ? {
          position: 'sticky',
          top: 12,
          zIndex: 10,
          background: c.white,
          // 접힌 바는 헤더 기준선(1200px)까지만 차지한다.
          margin: `0 ${CONTENT_INLINE}`,
          borderRadius: 12,
        }
      : {}),
    // 화면 상단에 붙어 떠 있을 때만 목록 위로 뜬 그림자.
    boxShadow: $floating ? '0 8px 24px rgba(0, 0, 0, 0.16), 0 3px 8px rgba(0, 0, 0, 0.1)' : 'none',
    // 그림자가 좌우·위로 번지지 않고 아래쪽으로만 보이도록 잘라낸다.
    clipPath: 'inset(0 0 -40px 0)',
    transition: 'box-shadow 0.2s ease',
    [mobile]: { display: 'none' },
  }),
);
// 좌우 여백은 헤더(로고 시작 ~ 프로필 아이콘 끝, 1200px)와 같은 기준선을 쓴다.
const CONTENT_INLINE = 'max(24px, calc((100% - 1200px) / 2))';
// Figma RightContent 패딩: 접힘 상단 24 + 버튼 아래 간격 20, 펼침 32.
// 패널/버튼 전환: 두 영역을 항상 렌더링하고 grid 행 높이(0fr↔1fr)로 부드럽게 열고 닫는다.
// 닫힌 쪽은 visibility로 탭 포커스·스크린리더에서 제외한다.
function Collapsible({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <CollapseGrid $open={open} aria-hidden={!open}>
      <div className="clip">{children}</div>
    </CollapseGrid>
  );
}
const CollapseGrid = styled.div<{ $open: boolean }>(({ $open }) => ({
  display: 'grid',
  gridTemplateRows: $open ? '1fr' : '0fr',
  opacity: $open ? 1 : 0,
  visibility: $open ? 'visible' : 'hidden',
  transition: `grid-template-rows ${MOTION}, opacity 0.2s ease, visibility 0.3s`,
  '.clip': { minHeight: 0, overflow: 'hidden' },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
}));
const MOTION = '0.3s cubic-bezier(0.4, 0, 0.2, 1)';
const FilterBar = styled.div({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 8,
  // 고정(sticky)됐을 때 목록과 붙어 보이지 않도록 아래 여백 12. 본문 상단 8과 합쳐 기존 간격 20을 유지한다.
  padding: 12,
});
const FilterChip = styled.button({
  ...textStyle.mBadgeText,
  lineHeight: 'normal',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  // 파란 필터 버튼(패딩 6 + 아이콘 20)과 같은 높이 32.
  height: 32,
  padding: '0 8px',
  border: 0,
  borderRadius: 4,
  background: c.lightBlue,
  color: c.primary,
  cursor: 'pointer',
});
const FilterToggle = styled.button({
  ...textStyle.h3,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 2,
  padding: 6,
  border: 0,
  borderRadius: 20,
  background: c.primary,
  color: c.white,
  cursor: 'pointer',
});
const FilterPanel = styled.section({
  background: c.gray50,
  borderBottom: `0.5px solid ${c.gray100}`,
  padding: `24px ${CONTENT_INLINE}`,
});
const PanelInner = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
});
const PanelTitle = styled.button({
  ...textStyle.h1,
  display: 'inline-flex',
  alignItems: 'center',
  alignSelf: 'flex-start',
  gap: 4,
  padding: 0,
  border: 0,
  background: 'transparent',
  color: c.gray900,
  cursor: 'pointer',
});
const PanelRow = styled.div({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 40,
});
const PrizeSlider = styled.div({ width: 220 });
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

// 필터 변경으로 목록이 다시 그려질 때 카드가 순차적으로 떠오른다(더보기로 이어 붙는 카드에도 적용).
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
const Sidebar = styled.aside({
  padding: '24px 20px',
  background: c.gray50,
  borderRight: `0.5px solid ${c.gray100}`,
  display: 'flex',
  flexDirection: 'column',
  gap: 40,
  '& h2': { ...textStyle.h1, lineHeight: 'normal' },
  [mobile]: { display: 'none' },
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
const Results = styled.div<{ $team?: boolean; $wide?: boolean }>(({ $team, $wide }) => ({
  boxSizing: 'border-box',
  padding: $team
    ? '24px 32px 100px'
    : $wide
      ? `32px ${CONTENT_INLINE}`
      : `8px ${CONTENT_INLINE} 24px`,
  minWidth: 0,
  minHeight: 900,
  transition: `padding ${MOTION}`,
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
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
