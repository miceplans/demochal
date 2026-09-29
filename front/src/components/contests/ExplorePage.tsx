'use client';
import { useState } from 'react';
import Link from 'next/link';
import styled from '@emotion/styled';
import { UserShell } from '@/components/common/UserShell';
import {
  Button,
  DesktopOnly,
  MobileOnly,
  Select,
  Row,
  Heading,
  Muted,
} from '@/components/common/Primitives';
import { ContestCard, ContestGrid } from './ContestCard';
import { contestHref } from './contest-links';
import { TeamCard, TeamGrid } from '@/components/teams/TeamCard';
import { categories, roles, type Contest } from '@/data/user-design';
import { generated } from '@semochal/api-client';
import { toTeamCard } from '@/components/teams/team-model';
import { colors as c, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { useUserStore } from '@/stores/useUserStore';
import { Dropdown } from '@/components/ui/Dropdown';

export function ExplorePage({ teamMode = false }: { teamMode?: boolean }) {
  const query = useUserStore((s) => s.query);
  const [category, setCategory] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [role, setRole] = useState('');
  const [region, setRegion] = useState('');
  const [sort, setSort] = useState('마감임박');
  const [limit, setLimit] = useState(6);
  const [includeClosed, setIncludeClosed] = useState(true);
  // D-day 계산 기준 시각은 마운트 시 한 번만 잡는다(렌더 중 Date.now() 호출 금지).
  const [now] = useState(() => Date.now());
  // 챌린지 목록(탐색)과 팀 모드의 챌린지 드롭다운 옵션을 한 쿼리로 공용한다 — teamMode와 무관하게 항상 조회.
  // 팀 모드에서는 드롭다운 옵션 확보가 목적이라 고정 50건, 탐색 모드에서는 더보기 클릭 시 limit을 늘린다.
  const challengesQuery = generated.useListChallenges({
    limit: teamMode ? 50 : limit,
    q: query || undefined,
    category: category || undefined,
    includeClosed,
    sort: sort === '마감임박' ? 'deadline' : sort === '인기' ? 'popular' : 'latest',
  });
  const challengeOptions = challengesQuery.data?.data.items ?? [];
  const teamsQuery = generated.useListTeams(
    {
      challengeId: challengeId || undefined,
      role: role || undefined,
      region: region || undefined,
      q: query || undefined,
    },
    { query: { enabled: teamMode } },
  );
  const teamCards = (teamsQuery.data?.data ?? []).map(toTeamCard);
  const contestCards: Contest[] = challengeOptions.map((challenge) => {
    const end = challenge.endDate ? new Date(challenge.endDate).getTime() : NaN;
    return {
      id: challenge.id ?? '',
      title: challenge.title ?? '챌린지',
      category: challenge.category ?? '기타',
      days: Number.isNaN(end) ? 0 : Math.max(0, Math.ceil((end - now) / 86_400_000)),
      // 목록 응답에는 팀 모집 수가 없다 — 0으로 꾸며 보여주지 않고 카드에서 배지를 숨긴다.
      teams: undefined,
    };
  });
  const hasMoreChallenges = Boolean(challengesQuery.data?.data.nextCursor);
  return (
    <UserShell>
      <Layout>
        <Sidebar>
          <Heading>필터</Heading>
          {teamMode ? (
            <>
              <div>
                <h3>챌린지</h3>
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
              </div>
              <div>
                <h3>필요 역할</h3>
                <Dropdown
                  aria-label="필요 역할"
                  size="S"
                  value={role}
                  onChange={setRole}
                  options={[
                    { value: '', label: '모든 역할' },
                    ...roles.map((x) => ({ value: x, label: x })),
                  ]}
                />
              </div>
              <div>
                <h3>지역</h3>
                <Dropdown
                  aria-label="지역"
                  size="S"
                  value={region}
                  onChange={setRegion}
                  options={[
                    { value: '', label: '전체' },
                    { value: '서울', label: '서울' },
                    { value: '부산', label: '부산' },
                  ]}
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <h3>분야</h3>
                <Dropdown
                  aria-label="분야"
                  size="S"
                  value={category}
                  onChange={setCategory}
                  options={[
                    { value: '', label: '전체' },
                    ...categories.map((cat) => ({ value: cat, label: cat })),
                  ]}
                />
              </div>
              <IncludeClosed>
                <input
                  type="checkbox"
                  checked={includeClosed}
                  onChange={(e) => setIncludeClosed(e.target.checked)}
                />
                마감된 챌린지도 포함하기
              </IncludeClosed>
            </>
          )}
        </Sidebar>
        <Results>
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
                  value: role,
                  onChange: setRole,
                  options: roles.map((x) => ({ value: x, label: x })),
                },
                {
                  label: '지역',
                  value: region,
                  onChange: setRegion,
                  options: ['서울', '부산'].map((x) => ({ value: x, label: x })),
                },
              ].map((filter) => (
                <Select
                  key={filter.label}
                  aria-label={filter.label}
                  value={filter.value}
                  onChange={(e) => filter.onChange(e.target.value)}
                >
                  <option value="">{filter.label}</option>
                  {filter.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              ))
            ) : (
              <>
                <Select
                  aria-label="분야"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="">분야</option>
                  {categories.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </Select>
                <IncludeClosed>
                  <input
                    type="checkbox"
                    checked={includeClosed}
                    onChange={(e) => setIncludeClosed(e.target.checked)}
                  />
                  마감된 챌린지 포함
                </IncludeClosed>
              </>
            )}
          </MobileFilters>
          <Row style={{ justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap' }}>
            {teamMode ? (
              <Link href="/teams/new" style={{ marginLeft: 'auto' }}>
                <Button as="span" small>
                  ＋ 모집글 작성
                </Button>
              </Link>
            ) : (
              <Row>
                {['마감임박', '최신', '인기'].map((x) => (
                  <Sort key={x} active={sort === x} onClick={() => setSort(x)}>
                    {x}
                  </Sort>
                ))}
              </Row>
            )}
          </Row>
          {teamMode ? (
            <>
              <TeamGrid>
                {teamCards.map((team) => (
                  <TeamCard key={team.id} team={team} />
                ))}
              </TeamGrid>
              {teamsQuery.isSuccess && teamCards.length === 0 && (
                <Muted>조건에 맞는 팀 모집글이 없어요.</Muted>
              )}
            </>
          ) : (
            <>
              <DesktopOnly>
                <ContestGrid>
                  {contestCards.map((x) => (
                    <ContestCard key={x.id} contest={x} href={contestHref(x.id)} />
                  ))}
                </ContestGrid>
              </DesktopOnly>
              <MobileOnly>
                <ContestGrid>
                  {contestCards.map((x) => (
                    <ContestCard key={x.id} contest={x} href={contestHref(x.id)} />
                  ))}
                </ContestGrid>
              </MobileOnly>
              {challengesQuery.isPending && <Muted>불러오는 중…</Muted>}
              {challengesQuery.isSuccess && contestCards.length === 0 && (
                <Muted>검색 결과가 없습니다.</Muted>
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
const Layout = styled.div({
  display: 'grid',
  gridTemplateColumns: '260px minmax(0, 1fr)',
  [mobile]: { display: 'block' },
});
const Sidebar = styled.aside({
  padding: '28px 20px',
  background: c.gray50,
  display: 'flex',
  flexDirection: 'column',
  gap: 44,
  '& h3': { ...textStyle.subtitle, marginBottom: 12 },
  '& button': { ...textStyle.metaText, padding: '5px 10px' },
  [mobile]: { display: 'none' },
});
const Results = styled.div({
  padding: '60px 32px 100px',
  minWidth: 0,
  minHeight: 900,
  [mobile]: { padding: '24px 16px', minHeight: 0 },
});
const IncludeClosed = styled.label({
  ...textStyle.metaText,
  color: c.gray700,
  display: 'flex',
  gap: 6,
  alignItems: 'center',
  cursor: 'pointer',
});
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
    '& select': {
      background: c.gray100,
      fontSize: textStyle.mSubText.fontSize,
      borderRadius: 24,
      height: 34,
      maxWidth: 110,
    },
  },
});
