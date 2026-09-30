'use client';
import { useDeferredValue, useMemo, useState } from 'react';
import styled from '@emotion/styled';
import { generated } from '@semochal/api-client';
import type { PersonCardModel } from './person';
import { UserShell, Content } from '@/components/common/UserShell';
import { Input, Muted, Stack } from '@/components/common/Primitives';
import { Dropdown } from '@/components/ui/Dropdown';
import { colors as c, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { PersonCard } from './PersonCard';
import { ScoutModal } from './ScoutModal';

const ALL = '';
const sortOptions = [
  { value: 'recent', label: '최신 활동 순' },
  { value: 'name', label: '이름 순' },
];

const Filters = styled.div({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  '& > .search': { width: 250 },
  [mobile]: { '& > .search': { width: '100%' } },
});
const Grid = styled.div({
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: 20,
  '@media (max-width: 1100px)': { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
  [mobile]: { gridTemplateColumns: '1fr' },
});
const Empty = styled.div({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  padding: '96px 0',
  textAlign: 'center',
  '& strong': { ...textStyle.h3, color: c.gray900 },
});

// 옵션은 필터가 걸리지 않은 전체 목록에서 뽑는다(필터를 걸어도 선택지가 줄지 않게).
const unique = (values: (string | null | undefined)[]) =>
  [...new Set(values.filter((v): v is string => Boolean(v)))].sort();
const withAll = (label: string, values: string[]) => [
  { value: ALL, label },
  ...values.map((value) => ({ value, label: value })),
];

export function PeoplePage() {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'recent' | 'name'>('recent');
  const [position, setPosition] = useState(ALL);
  const [region, setRegion] = useState(ALL);
  const [stack, setStack] = useState(ALL);
  const [scoutTarget, setScoutTarget] = useState<PersonCardModel | null>(null);
  const deferredQ = useDeferredValue(q);

  const query = generated.useListPeople({
    ...(deferredQ.trim() && { q: deferredQ.trim() }),
    sort,
    ...(position && { position }),
    ...(region && { region }),
    ...(stack && { stack }),
  });
  const everyone = generated.useListPeople({ sort: 'recent' }, { query: { staleTime: 60_000 } });
  const people = query.data?.status === 200 ? query.data.data : [];
  const options = useMemo(() => {
    const all = everyone.data?.status === 200 ? everyone.data.data : [];
    return {
      position: withAll('포지션', unique(all.map((p) => p.position))),
      region: withAll('지역', unique(all.map((p) => p.region))),
      stack: withAll('기술스택', unique(all.flatMap((p) => p.stacks ?? []))),
    };
  }, [everyone.data]);

  return (
    <UserShell title="팀원 찾기">
      <Content>
        <Stack gap={20}>
          <Filters>
            <Input
              className="search"
              aria-label="닉네임으로 검색"
              placeholder="닉네임으로 검색"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <Dropdown
              aria-label="정렬"
              width={171}
              value={sort}
              onChange={(v) => setSort(v === 'name' ? 'name' : 'recent')}
              options={sortOptions}
            />
            <Dropdown
              aria-label="포지션"
              width={171}
              placeholder="포지션"
              value={position}
              onChange={setPosition}
              options={options.position}
            />
            <Dropdown
              aria-label="지역"
              width={171}
              placeholder="지역"
              value={region}
              onChange={setRegion}
              options={options.region}
            />
            <Dropdown
              aria-label="기술스택"
              width={171}
              placeholder="기술스택"
              value={stack}
              onChange={setStack}
              options={options.stack}
            />
          </Filters>
          {query.isPending && <Muted>불러오는 중이에요.</Muted>}
          {query.isError && <Muted>목록을 불러오지 못했어요.</Muted>}
          {query.isSuccess && people.length === 0 && (
            // TODO: Figma 01-B 빈 상태의 일러스트는 저장소에 자산이 없어 텍스트만 표시한다.
            <Empty>
              <strong>조건에 맞는 분이 없어요</strong>
              <Muted>선택한 필터 조건에 맞는 분이 없어요. 조건을 조금 넓혀보세요.</Muted>
            </Empty>
          )}
          {people.length > 0 && (
            <Grid>
              {people.map((person) => (
                <PersonCard key={person.id} person={person} onSelect={setScoutTarget} />
              ))}
            </Grid>
          )}
        </Stack>
      </Content>
      <ScoutModal person={scoutTarget} onClose={() => setScoutTarget(null)} />
    </UserShell>
  );
}
