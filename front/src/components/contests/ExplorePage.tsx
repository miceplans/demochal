'use client';
import { useState } from 'react';
import Link from 'next/link';
import styled from '@emotion/styled';
import { UserShell } from '@/components/common/UserShell';
import {
  Button,
  Chip,
  DesktopOnly,
  MobileOnly,
  Select,
  Row,
  Stack,
  Wrap,
  Heading,
  Muted,
} from '@/components/common/Primitives';
import { ContestCard, ContestGrid } from './ContestCard';
import { TeamCard, TeamGrid } from '@/components/teams/TeamCard';
import { categories, desktopContests, contests, teams } from '@/data/user-design';
import { colors as c, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { useUserStore } from '@/stores/useUserStore';
import { Dropdown } from '@/components/ui/Dropdown';
import { RangeSlider } from '@/components/ui/RangeSlider';

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
const CheckGrid = styled.div({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12,
  '& label': { ...textStyle.metaText, color: c.gray700, display: 'flex', gap: 8, alignItems: 'center' },
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
export function ExplorePage({ teamMode = false }: { teamMode?: boolean }) {
  const query = useUserStore((s) => s.query);
  const [category, setCategory] = useState('');
  const [role, setRole] = useState('');
  const [sort, setSort] = useState('마감임박');
  const [limit, setLimit] = useState(6);
  const [prize, setPrize] = useState<[number, number]>([3000, 8000]);
  const [includeClosed, setIncludeClosed] = useState(true);
  const visible = (category || query ? contests : desktopContests)
    .filter(
      (x) =>
        (!category || x.category.includes(category.replace('/취업', ''))) &&
        (!query || x.title.includes(query) || x.category.includes(query)),
    )
    .sort((a, b) =>
      sort === '마감임박'
        ? a.days - b.days
        : sort === '인기'
          ? b.teams - a.teams
          : b.id.localeCompare(a.id),
    );
  const mobileVisible = contests.filter(
    (x) =>
      (!category || x.category.includes(category)) &&
      (!query || x.title.includes(query) || x.category.includes(query)),
  );
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
                  value={category}
                  onChange={setCategory}
                  options={[
                    { value: '', label: '전체 챌린지' },
                    { value: '공공데이터', label: '공공데이터 챌린지' },
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
                    { value: '백엔드', label: '백엔드' },
                    { value: '프론트', label: '프론트' },
                    { value: '디자인', label: '디자인' },
                  ]}
                />
              </div>
              <div>
                <h3>지역</h3>
                <Dropdown
                  aria-label="지역"
                  size="S"
                  value={category}
                  onChange={setCategory}
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
                  options={categories.map((cat) => ({ value: cat, label: cat }))}
                />
              </div>
              {[
                [
                  '대상',
                  '어린이',
                  '초등학생',
                  '중학생',
                  '고등학생',
                  '대학생',
                  '대학원생',
                  '제한없음',
                  '지역제한',
                  '일반인',
                  '기업',
                ],
                [
                  '주최기관',
                  '중앙정부/기관',
                  '대기업',
                  '외국계기업',
                  '학교/재단/협회',
                  '학회/비영리단체',
                  '진흥원',
                  '언론',
                  '지방자치단체',
                  '중소/벤처기업',
                  '기타',
                ],
              ].map(([label, ...items]) => (
                <div key={label}>
                  <h3>{label}</h3>
                  <CheckGrid>
                    {items.map((x) => (
                      <label key={x}>
                        <input type="checkbox" defaultChecked={x === '기업' || x === '기타'} />
                        {x}
                      </label>
                    ))}
                  </CheckGrid>
                </div>
              ))}
              <div>
                <h3 style={{ marginBottom: 10 }}>상금</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <span style={{ ...textStyle.caption, color: c.gray700 }}>
                    {prize[0].toLocaleString()}~{prize[1].toLocaleString()}천만원
                  </span>
                  <RangeSlider
                    min={0}
                    max={10000}
                    step={100}
                    value={prize}
                    onChange={setPrize}
                    minAriaLabel="최소 상금"
                    maxAriaLabel="최대 상금"
                  />
                </div>
              </div>
            </>
          )}
        </Sidebar>
        <Results>
          <MobileFilters>
            {(teamMode
              ? ['전체 챌린지', '필요역할', '지역']
              : ['분야', '대상', '주최기관', '상금']
            ).map((x, i) => (
              <Select
                key={x}
                aria-label={x}
                value={i === 0 ? category : undefined}
                onChange={(e) => {
                  if (i === 0) setCategory(e.target.value);
                }}
              >
                <option value="">{x}</option>
                {(i === 0 ? categories : ['전체', '대학생', '일반인']).map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </Select>
            ))}
          </MobileFilters>
          <Row style={{ justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap' }}>
            {teamMode ? (
              <>
                <Button small>팀 찾기</Button>
                <Link href="/teams/new">
                  <Button as="span" small>
                    ＋ 모집글 작성
                  </Button>
                </Link>
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
                <label style={{ fontSize: 12, color: c.gray700, display: 'flex', gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={includeClosed}
                    onChange={(e) => setIncludeClosed(e.target.checked)}
                  />
                  마감된 챌린지도 포함하기
                </label>
              </>
            )}
          </Row>
          {teamMode ? (
            <>
              <DesktopOnly>
                <TeamGrid>
                  {Array.from({ length: 9 }, (_, i) => (
                    <TeamCard key={i} />
                  ))}
                </TeamGrid>
              </DesktopOnly>
              <MobileOnly>
                <TeamGrid>
                  {teams.map((t) => (
                    <TeamCard team={t} key={t.id} />
                  ))}
                </TeamGrid>
              </MobileOnly>
            </>
          ) : (
            <>
              <DesktopOnly>
                <ContestGrid>
                  {visible.slice(0, limit).map((x) => (
                    <ContestCard key={x.id} contest={x} />
                  ))}
                </ContestGrid>
              </DesktopOnly>
              <MobileOnly>
                <ContestGrid>
                  {mobileVisible.slice(0, limit).map((x) => (
                    <ContestCard key={x.id} contest={x} />
                  ))}
                </ContestGrid>
              </MobileOnly>
              {visible.length === 0 && <Muted>검색 결과가 없습니다.</Muted>}
              {limit < visible.length && (
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
