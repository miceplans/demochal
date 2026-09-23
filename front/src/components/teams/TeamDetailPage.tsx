'use client';
import { usePathname, useRouter } from 'next/navigation';
import styled from '@emotion/styled';
import { generated } from '@semochal/api-client';
import { UserShell, Content } from '@/components/common/UserShell';
import { Button } from '@/components/common/Primitives';
import { useToast } from '@/components/common/Toast';
import { teamDetail } from '@/data/user-design';
import { colors as c, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';

export function TeamDetailPage() {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  // UserShell과 같은 쿼리 키라 캐시를 공유한다 — 페이지 진입만으로는 로그인을 요구하지 않는다.
  const { data: auth, isPending } = generated.useGetMyAuthInfo({ query: { retry: false } });
  const apply = () => {
    if (auth?.status !== 200) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    // TODO: 팀 합류 신청 API가 아직 없다(openapi.yaml /teams 에 신청 엔드포인트 미정의) — 추가 후 mutation으로 연결.
    // https://tanstack.com/query/latest/docs/framework/react/guides/mutations
    toast.success('팀 신청을 보냈어요', '팀장이 확인하면 알림으로 알려드릴게요');
  };
  const facts = [
    ['필요역할', teamDetail.recruitingRoles.join(', ')],
    ['우대사항', teamDetail.preferred],
    ['기타', teamDetail.etc],
  ];
  return (
    <UserShell title="팀 모집글" back="/teams">
      <Content>
        <Header>
          <Cover
            src={teamDetail.poster}
            alt={`${teamDetail.challenge} 포스터`}
            width={1200}
            height={222}
          />
          <div className="heading">
            <h1>{teamDetail.title}</h1>
            <p>{teamDetail.challenge}</p>
          </div>
          <Facts>
            {facts.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </Facts>
        </Header>
        <Columns>
          <Main>
            <section>
              <h2>팀 소개</h2>
              <p className="intro">{teamDetail.introduction}</p>
            </section>
            <section>
              <h2>팀 현황</h2>
              <Roster>
                <thead>
                  <tr>
                    <th>이름</th>
                    <th>역할</th>
                    <th>직책</th>
                  </tr>
                </thead>
                <tbody>
                  {teamDetail.roster.map((member) => (
                    <tr key={member.name}>
                      <td>{member.name}</td>
                      <td>{member.role}</td>
                      <td>{member.position}</td>
                    </tr>
                  ))}
                </tbody>
              </Roster>
            </section>
          </Main>
          <Sidebar>
            <Button type="button" fullWidth disabled={isPending} onClick={apply}>
              팀 신청하기
            </Button>
            <Summary>
              <b>대회 요약</b>
              <dl>
                <dt>마감일</dt>
                <dd>{teamDetail.summary.deadline}</dd>
                <dt>총 상금</dt>
                <dd>{teamDetail.summary.prizeTotal}</dd>
                <dt>팀 구성</dt>
                <dd>{teamDetail.summary.teamSize}</dd>
              </dl>
            </Summary>
          </Sidebar>
        </Columns>
      </Content>
    </UserShell>
  );
}

const Header = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
  marginBottom: 32,
  '.heading': { display: 'flex', flexDirection: 'column', gap: 8 },
  h1: { ...textStyle.display, fontSize: 22, fontWeight: 700 },
  '.heading p': { ...textStyle.caption, color: c.gray900 },
  [mobile]: { gap: 20, marginBottom: 24 },
});
const Cover = styled.img({
  width: '100%',
  height: 222,
  objectFit: 'cover',
  objectPosition: 'center top',
  borderRadius: 19,
  background: c.gray100,
  [mobile]: { height: 180, borderRadius: 12 },
});
const Facts = styled.dl({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  ...textStyle.caption,
  '& div': { display: 'flex', gap: 18 },
  '& dt': { width: 45, flexShrink: 0, color: c.gray500 },
  '& dd': { ...textStyle.subtitle, color: c.gray900 },
});
const Columns = styled.div({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 320px',
  alignItems: 'start',
  gap: 24,
  [mobile]: { display: 'flex', flexDirection: 'column-reverse' },
});
const Main = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
  minWidth: 0,
  width: '100%',
  h2: { ...textStyle.bodyStrong, marginBottom: 8 },
  '.intro': { ...textStyle.body, color: c.gray700, whiteSpace: 'pre-line' },
  'section:nth-of-type(2) h2': { marginBottom: 16 },
});
const Roster = styled.table({
  width: '100%',
  borderCollapse: 'separate',
  borderSpacing: 0,
  ...textStyle.bodyLarge,
  '& th, & td': { padding: '0 16px', textAlign: 'left' },
  '& th:nth-of-type(1), & td:nth-of-type(1)': { width: 196 },
  '& th:last-of-type, & td:last-of-type': { width: 96 },
  '& th': { ...textStyle.h1, height: 48, background: c.gray100 },
  '& th:first-of-type': { borderTopLeftRadius: 12 },
  '& th:last-of-type': { borderTopRightRadius: 12 },
  '& td': { height: 56, borderBottom: `1px solid ${c.gray100}` },
  '& td:first-of-type': { borderLeft: `1px solid ${c.gray100}` },
  '& td:last-of-type': { borderRight: `1px solid ${c.gray100}` },
  '& tr:last-of-type td:first-of-type': { borderBottomLeftRadius: 12 },
  '& tr:last-of-type td:last-of-type': { borderBottomRightRadius: 12 },
  [mobile]: {
    ...textStyle.body,
    '& th:nth-of-type(1), & td:nth-of-type(1)': { width: 'auto' },
    '& th:last-of-type, & td:last-of-type': { width: 64 },
  },
});
const Sidebar = styled.aside({
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  minWidth: 0,
  width: '100%',
  position: 'sticky',
  top: 24,
  [mobile]: { position: 'static' },
});
const Summary = styled.div({
  border: `0.5px solid ${c.gray100}`,
  borderRadius: 12,
  padding: 16,
  ...textStyle.caption,
  '& b': textStyle.h3,
  '& dl': { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 },
  '& dt': { color: c.gray500 },
  '& dd': { ...textStyle.subtitle, textAlign: 'right' },
});
