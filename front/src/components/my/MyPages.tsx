'use client';
import { useState } from 'react';
import Link from 'next/link';
import styled from '@emotion/styled';
import { UserShell, Content, MyShell, myMenu } from '@/components/common/UserShell';
import {
  Button,
  Chip,
  DesktopOnly,
  MobileOnly,
  Row,
  Stack,
  Wrap,
  Title,
  Heading,
  Muted,
  Tag,
  Toggle,
  Input,
  Select,
  Icon,
} from '@/components/common/Primitives';
import { Modal } from '@/components/common/Feedback';
import { Identity, Badges, SkillStack, History } from '@/components/profile/ProfileCards';
import { ContestCard, ContestGrid } from '@/components/contests/ContestCard';
import {
  contests,
  desktopContests,
  preferenceGroups,
  notificationSettings,
} from '@/data/user-design';
import { useUserStore } from '@/stores/useUserStore';
import { useToast } from '@/components/common/Toast';
import { colors as c, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import legalCopy from '@/data/design-copy.json';

const MobileMenu = styled.nav({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  '& a': {
    padding: '16px 4px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontWeight: 600,
  },
  borderBottom: `1px solid ${c.gray100}`,
  paddingBottom: 24,
});
const Participating = styled.div({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 20,
  '& a': { border: `1px solid ${c.gray100}`, borderRadius: 12, padding: 16 },
  [mobile]: { gridTemplateColumns: '1fr' },
});
export function MyPage() {
  return (
    <MyShell title="MY">
      <Stack gap={28}>
        <Link href="/profile">
          <Identity large />
        </Link>
        <DesktopOnly>
          <Heading style={{ marginBottom: 12 }}>내 뱃지</Heading>
        </DesktopOnly>
        <Badges />
        <MobileOnly>
          <MobileMenu>
            {myMenu.map(([href, label]) => (
              <Link key={href} href={href}>
                {label}
                <Icon frame="839-13815" name="imgMoreIcon" size={14} />
              </Link>
            ))}
          </MobileMenu>
        </MobileOnly>
        <Heading>기술 스택</Heading>
        <SkillStack />
        <DesktopOnly>
          <Heading style={{ marginBottom: 24 }}>참여중</Heading>
          <Participating>
            {[0, 1].map((x) => (
              <Link key={x} href="/my/teams/public-data">
                <Heading>OO챌린지</Heading>
                <Muted>데이터 시각화로 도시 문제 해결</Muted>
                <Wrap style={{ margin: '20px 0' }}>
                  <Tag tone="blue">디자이너</Tag>
                  <Tag tone="blue">백엔드</Tag>
                  <Tag>기획</Tag>
                  <Tag>프론트엔드</Tag>
                </Wrap>
                <Muted>D-14 · 마감 7월 10일</Muted>
              </Link>
            ))}
          </Participating>
        </DesktopOnly>
        <MobileOnly>
          <Heading style={{ marginBottom: 12 }}>참가 이력</Heading>
          <History compact />
        </MobileOnly>
      </Stack>
    </MyShell>
  );
}
export function MyTeamsPage() {
  return (
    <MyShell title="내 팀">
      <Stack>
        <Title>내가 만든 팀이 있는 공모전</Title>
        <ContestGrid style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }}>
          {desktopContests.slice(0, 2).map((x) => (
            <ContestCard contest={x} key={x.id} href="/my/teams/public-data" />
          ))}
        </ContestGrid>
      </Stack>
    </MyShell>
  );
}
const BookmarkGrid = styled(ContestGrid)<{ two: boolean }>(({ two }) => ({
  gridTemplateColumns: 'repeat(3,minmax(0,1fr))',
  [mobile]: { gridTemplateColumns: two ? 'repeat(2,minmax(0,1fr))' : '1fr' },
}));
export function BookmarksPage() {
  const ids = useUserStore((s) => s.bookmarks);
  const [sort, setSort] = useState('마감임박');
  const [two, setTwo] = useState(false);
  const data = contests
    .filter((x) => ids.includes(x.id))
    .sort((a, b) =>
      sort === '인기'
        ? b.teams - a.teams
        : sort === '최신'
          ? b.id.localeCompare(a.id)
          : a.days - b.days,
    );
  return (
    <MyShell title="북마크 챌린지">
      <Stack>
        <DesktopOnly>
          <Title>북마크 챌린지</Title>
        </DesktopOnly>
        <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Row>
            {['마감임박', '최신', '인기'].map((x) => (
              <Button
                key={x}
                tone="plain"
                small
                aria-pressed={sort === x}
                style={{ color: sort === x ? c.primary : c.gray500, border: 0, padding: 0 }}
                onClick={() => setSort(x)}
              >
                {x}
              </Button>
            ))}
          </Row>
          <MobileOnly>
            <Button small tone="plain" aria-pressed={two} onClick={() => setTwo(!two)}>
              {two ? '1열 보기' : '2열 보기'}
            </Button>
          </MobileOnly>
        </Row>
        <BookmarkGrid two={two}>
          {data.map((x) => (
            <ContestCard key={x.id} contest={x} />
          ))}
        </BookmarkGrid>
        {data.length === 0 && <Muted>북마크한 챌린지가 없어요.</Muted>}
      </Stack>
    </MyShell>
  );
}
export function InterestsPage() {
  const state = useUserStore();
  const toast = useToast();
  return (
    <MyShell title="관심분야 설정">
      <Stack gap={24}>
        <DesktopOnly>
          <Title>관심분야 설정</Title>
        </DesktopOnly>
        <p style={{ fontSize: 15 }}>
          관심 있는 분야를 선택하면 맞춤 챌린지와 팀 모집을 추천해드려요
        </p>
        {preferenceGroups.map((g) => (
          <Stack key={g.key} gap={12}>
            <Heading>{g.title}</Heading>
            <Wrap style={{ maxWidth: 550 }}>
              {g.options.map((x) => (
                <Chip
                  key={x}
                  selected={state[g.key].includes(x)}
                  aria-pressed={state[g.key].includes(x)}
                  onClick={() => state.togglePreference(g.key, x)}
                >
                  {x}
                </Chip>
              ))}
            </Wrap>
          </Stack>
        ))}
        <Button style={{ width: 160 }} onClick={() => toast.success('관심분야를 저장했어요.')}>
          저장하기
        </Button>
      </Stack>
    </MyShell>
  );
}
const SettingsGroup = styled.section({
  border: `1px solid ${c.gray100}`,
  borderRadius: 12,
  overflow: 'hidden',
  '& h2': { background: c.gray100, padding: '14px 20px', ...textStyle.body },
  '.setting': {
    padding: '16px 20px',
    display: 'flex',
    gap: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTop: `1px solid ${c.gray100}`,
  },
  [mobile]: {
    border: 0,
    '& h2': { background: c.white, padding: '12px 0', fontWeight: 600 },
    '.setting': { padding: '16px 0' },
  },
});
export function NotificationSettingsPage() {
  const values = useUserStore((s) => s.notifications);
  const toggle = useUserStore((s) => s.toggleNotification);
  return (
    <MyShell title="알림 설정">
      <Stack>
        <DesktopOnly>
          <Title>알림 설정</Title>
          <p style={{ marginTop: 24 }}>받고 싶은 알림을 선택하세요</p>
        </DesktopOnly>
        {notificationSettings.map((g) => (
          <SettingsGroup key={g.title}>
            <h2>{g.title}</h2>
            {g.rows.map(([key, label, desc]) => (
              <div key={key} className="setting">
                <div>
                  <p style={{ fontSize: 14, marginBottom: 4 }}>{label}</p>
                  <Muted style={{ fontSize: 12 }}>{desc}</Muted>
                </div>
                <Toggle label={label} checked={values[key]} onChange={() => toggle(key)} />
              </div>
            ))}
          </SettingsGroup>
        ))}
      </Stack>
    </MyShell>
  );
}
const Table = styled.table({
  width: '100%',
  borderSpacing: 0,
  border: `1px solid ${c.gray100}`,
  borderRadius: 12,
  overflow: 'hidden',
  fontSize: 14,
  '& th': { background: c.gray100, textAlign: 'left', fontWeight: 500 },
  '& td, & th': { padding: '14px 16px', borderBottom: `1px solid ${c.gray100}` },
  [mobile]: { '& td, & th': { padding: 10, fontSize: 12 } },
});
export function ApplicationsPage() {
  return (
    <MyShell title="지원현황">
      <Stack gap={40}>
        <section>
          <Title style={{ marginBottom: 20 }}>공모전 지원 현황</Title>
          <Table>
            <thead>
              <tr>
                <th>공모전</th>
                <th>협회</th>
                <th>결과</th>
              </tr>
            </thead>
            <tbody>
              {[0, 1].map((i) => (
                <tr key={i}>
                  <td>
                    <Link href="/contests/public-data">한국 마라톤 공모전</Link>
                  </td>
                  <td>한국 마라톤 협회</td>
                  <td>
                    <Tag tone="green">예선 통과</Tag>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </section>
        <section>
          <Title style={{ marginBottom: 20 }}>팀 지원현황</Title>
          <Table>
            <thead>
              <tr>
                <th>공모전</th>
                <th>팀</th>
                <th>결과</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['한국 마라톤 공모전', '김창윤의 팀', '불합격'],
                ['한국 IT 공모전', '강다정의 팀', '확정'],
              ].map(([name, team, result]) => (
                <tr key={team}>
                  <td>{name}</td>
                  <td>{team}</td>
                  <td>
                    <Tag tone={result === '확정' ? 'blue' : 'red'}>{result}</Tag>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </section>
      </Stack>
    </MyShell>
  );
}
export function TeamApplicantsPage() {
  const [results, setResults] = useState(['미정', '미정']);
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState('');
  const toast = useToast();
  return (
    <MyShell title="팀 지원현황">
      <Stack gap={28}>
        <div style={{ height: 220, borderRadius: 20, background: c.gray100 }} />
        <div>
          <Title>2025 공공데이터 활용 창업 대회</Title>
          <Muted style={{ marginTop: 8 }}>한국데이터산업진흥원</Muted>
        </div>
        <Row style={{ justifyContent: 'space-between', marginTop: 32 }}>
          <Heading>팀 지원현황</Heading>
          <Button small onClick={() => setOpen(true)}>
            결과 전송하기
          </Button>
        </Row>
        <Table>
          <thead>
            <tr>
              <th>이름</th>
              <th>뱃지</th>
              <th>결과</th>
            </tr>
          </thead>
          <tbody>
            {['이창윤', '황지영'].map((name, i) => (
              <tr key={name}>
                <td>
                  <Link href="/profile">{name}</Link>
                </td>
                <td></td>
                <td style={{ width: 130 }}>
                  <Select
                    aria-label={`${name} 결과`}
                    value={results[i]}
                    onChange={(e) =>
                      setResults(results.map((x, j) => (j === i ? e.target.value : x)))
                    }
                  >
                    {['미정', '합격', '불합격'].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Stack>
      <Modal open={open} onClose={() => setOpen(false)} title="결과 전송하기">
        <Muted style={{ color: c.red }}>*이 활동은 되돌릴 수 없어요</Muted>
        <p style={{ fontSize: 13 }}>합격자들에게 전송할 채팅방 링크를 첨부해주세요.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setOpen(false);
            toast.info('결과 전송 화면을 확인했어요.', '실제 전송은 연결 후 사용할 수 있어요.');
          }}
        >
          <Input
            aria-label="채팅방 링크"
            placeholder="링크"
            type="url"
            required
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
          <Row style={{ justifyContent: 'flex-end', marginTop: 16 }}>
            <Button type="button" small tone="plain" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button type="submit" small>
              확인
            </Button>
          </Row>
        </form>
      </Modal>
    </MyShell>
  );
}

const NotificationList = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 0,
  borderTop: `1px solid ${c.gray100}`,
});
export function NotificationsPage() {
  const items = [
    '공공데이터 챌린지 팀 · 김민수님이 지원 · 2분 전',
    '디자이너 자리 지원이 수락되었어요 · 스타트업 해커톤 팀 · 15분 전',
    '북마크한 챌린지 마감 D-7 · 7월 3일 마감',
    '관심분야 새 챌린지가 등록되었어요 · AI/데이터 분야 · 1시간 전',
    '관심분야 새 수상작이 등록되었어요 · 디자인 분야 · 3시간 전',
  ];
  return (
    <UserShell title="알림">
      <Content>
        <Stack gap={20}>
          <DesktopOnly>
            <Title>알림</Title>
          </DesktopOnly>
          <Row>
            {['전체', '팀매칭', '마감', '공고'].map((x) => (
              <Chip key={x} selected={x === '전체'}>
                {x}
              </Chip>
            ))}
          </Row>
          <NotificationList>
            {items.map((item, i) => (
              <div
                key={item}
                style={{ padding: '18px 4px', borderBottom: `1px solid ${c.gray100}` }}
              >
                <Heading style={{ fontSize: 14 }}>{item.split(' · ')[0]}</Heading>
                <Muted>{item.split(' · ').slice(1).join(' · ')}</Muted>
              </div>
            ))}
          </NotificationList>
        </Stack>
      </Content>
    </UserShell>
  );
}

export function LegalPage({ kind }: { kind: 'privacy' | 'terms' }) {
  const paragraphs =
    kind === 'privacy'
      ? (legalCopy as { privacy: string[] }).privacy
      : (legalCopy as { terms: string[] }).terms;
  return (
    <UserShell title={kind === 'privacy' ? '개인정보처리방침' : '이용약관'}>
      <Content>
        <Stack gap={24}>
          <Title>{kind === 'privacy' ? 'SEMO 개인정보처리방침' : '이용약관'}</Title>
          {paragraphs.map((p, i) =>
            i === 0 ? (
              <p key={i} style={{ lineHeight: 1.8 }}>
                {p}
              </p>
            ) : (
              <section key={i}>
                <Heading style={{ marginBottom: 8 }}>{p.split('\n')[0]}</Heading>
                <Muted style={{ whiteSpace: 'pre-line' }}>
                  {p.split('\n').slice(1).join('\n')}
                </Muted>
              </section>
            ),
          )}
        </Stack>
      </Content>
    </UserShell>
  );
}
