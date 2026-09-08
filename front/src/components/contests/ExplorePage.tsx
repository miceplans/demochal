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
import { useUserStore } from '@/stores/useUserStore';

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
  '& h3': { fontSize: 13, marginBottom: 12 },
  '& button': { fontSize: 12, padding: '5px 10px' },
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
  '& label': { fontSize: 12, color: c.gray700, display: 'flex', gap: 8, alignItems: 'center' },
});
const Sort = styled.button<{ active?: boolean }>(({ active }) => ({
  border: 0,
  background: 'transparent',
  fontSize: 13,
  color: active ? c.primary : c.gray500,
  fontWeight: active ? 600 : 400,
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
      fontSize: 12,
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
                <Select aria-label="챌린지" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">전체 챌린지</option>
                  <option value="공공데이터">공공데이터 공모전</option>
                </Select>
              </div>
              <div>
                <h3>필요 역할</h3>
                <Select aria-label="필요 역할" value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="">모든 역할</option>
                  <option value="백엔드">백엔드</option>
                  <option value="프론트">프론트</option>
                  <option value="디자인">디자인</option>
                </Select>
              </div>
              <div>
                <h3>지역</h3>
                <Select aria-label="지역" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">전체</option>
                  <option value="서울">서울</option>
                  <option value="부산">부산</option>
                </Select>
              </div>
            </>
          ) : (
            <>
              <div>
                <h3>분야</h3>
                <Select aria-label="분야" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </Select>
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
                <h3>상금</h3>
                <Muted>3,000~8,000천만원</Muted>
                <input
                  type="range"
                  aria-label="상금 범위"
                  min="0"
                  max="10000"
                  defaultValue="8000"
                  style={{ width: '100%', marginTop: 12 }}
                />
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
