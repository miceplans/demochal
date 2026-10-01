'use client';
import { useState } from 'react';
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
          <DesktopOnly>
            {filterOpen ? (
              <FilterPanel aria-label="필터">
                <PanelInner>
                  <PanelTitle type="button" aria-expanded onClick={() => setFilterOpen(false)}>
                    필터
                    <img src="/assets/icons/figma-filter-title.svg" alt="" width={20} height={20} />
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
            ) : (
              <FilterBar>
                <FilterToggle
                  type="button"
                  aria-expanded={false}
                  onClick={() => setFilterOpen(true)}
                >
                  <img src="/assets/icons/figma-filter-button.svg" alt="" width={20} height={20} />
                  필터
                </FilterToggle>
              </FilterBar>
            )}
          </DesktopOnly>
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
                <Toggle>팀 찾기</Toggle>
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
                        <img
                          src="/assets/icons/figma-view-grid.svg"
                          alt=""
                          width={26}
                          height={26}
                        />
                      </ViewButton>
                      <ViewButton
                        type="button"
                        aria-label="목록으로 보기"
                        aria-pressed={view === 'list'}
                        onClick={() => setView('list')}
                      >
                        <img
                          src="/assets/icons/figma-view-list.svg"
                          alt=""
                          width={28}
                          height={28}
                        />
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
                  <TeamGrid>
                    {teamCards.map((team) => (
                      <TeamCard key={team.id} team={team} />
                    ))}
                  </TeamGrid>
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
                    <ExploreGrid $list={view === 'list'}>
                      {contestCards.map((x) => (
                        <ContestCard
                          key={x.id}
                          contest={x}
                          href={contestHref(x.id)}
                          row={view === 'list'}
                        />
                      ))}
                    </ExploreGrid>
                  </DesktopOnly>
                  <MobileOnly>
                    <ContestGrid>
                      {contestCards.map((x) => (
                        <ContestCard key={x.id} contest={x} href={contestHref(x.id)} />
                      ))}
                    </ContestGrid>
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
const FilterBar = styled.div({
  width: 1060,
  maxWidth: '100%',
  margin: '0 auto',
  padding: '24px 0 0',
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
  padding: '24px 24px',
});
const PanelInner = styled.div({
  maxWidth: 1200,
  margin: '0 auto',
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
  gap: 24,
});
const PrizeSlider = styled.div({ width: 220 });
const SortEnd = styled.div({ display: 'flex', alignItems: 'center', gap: 16 });
const ViewToggle = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: 4,
  borderRadius: 4,
  background: c.white,
});
const ViewButton = styled.button({
  display: 'flex',
  padding: 0,
  border: 0,
  borderRadius: 4,
  background: 'transparent',
  cursor: 'pointer',
  '&[aria-pressed=true]': { background: c.gray200 },
});
const ExploreGrid = styled(ContestGrid)<{ $list: boolean }>(({ $list }) => ({
  gridTemplateColumns: $list ? '1fr' : 'repeat(4, minmax(0, 1fr))',
}));
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
const Toggle = styled.span({
  ...textStyle.subtitle,
  display: 'flex',
  alignItems: 'center',
  height: 36,
  padding: '0 20px',
  borderRadius: 8,
  background: c.primary,
  color: c.white,
});
const CreateLink = styled(Link)({
  ...textStyle.subtitle,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 16px',
  borderRadius: 8,
  background: c.primary,
  color: c.white,
});
const Results = styled.div<{ $team?: boolean; $wide?: boolean }>(({ $team, $wide }) => ({
  padding: $team ? '24px 32px 100px' : '24px 0 100px',
  ...(!$team ? { width: $wide ? 1200 : 1060, maxWidth: '100%', margin: '0 auto' } : {}),
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
    border: '1px solid #f0f1f3',
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
    border: '1px solid #f0f1f3',
    '.artwork': { height: 160 },
    '.card-body': { padding: 12 },
  },
});
