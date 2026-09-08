'use client';
import Link from 'next/link';
import styled from '@emotion/styled';
import { UserShell, Content } from '@/components/common/UserShell';
import {
  Button,
  DesktopOnly,
  MobileOnly,
  Row,
  Stack,
  Muted,
  Title,
  Tag,
  Icon,
  asset,
  SectionHeader,
} from '@/components/common/Primitives';
import { colors as c, mobile } from '@/styles/design';
import { useUserStore } from '@/stores/useUserStore';
import { useToast } from '@/components/common/Toast';
import { ContestCard } from './ContestCard';
import { TeamGrid, TeamCard } from '@/components/teams/TeamCard';
import { desktopContests, contests } from '@/data/user-design';
const Intro = styled.div({
  display: 'flex',
  gap: 24,
  marginBottom: 60,
  '.cover': { width: 315, height: 220, borderRadius: 12, background: c.gray100 },
  '.intro-body': { display: 'flex', flexDirection: 'column', gap: 12, flex: 1 },
  '.facts': { marginTop: 'auto', fontSize: 12, color: c.gray700, lineHeight: 1.8 },
  [mobile]: {
    flexDirection: 'column',
    gap: 24,
    marginBottom: 24,
    '.cover': {
      width: 'calc(100% + 32px)',
      height: 200,
      margin: '-24px -16px 0',
      background: '#d8e4f0',
      borderRadius: 0,
    },
    '.facts': { display: 'none' },
    '.intro-body': { gap: 12 },
  },
});
const Columns = styled.div({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 860px) minmax(240px, 320px)',
  gap: 24,
  [mobile]: { display: 'flex', flexDirection: 'column' },
});
const Tabs = styled.nav({
  display: 'flex',
  gap: 24,
  borderBottom: `1px solid ${c.gray100}`,
  marginBottom: 20,
  '& a': { padding: '12px 16px', fontSize: 14, color: c.gray500 },
  '& a[aria-current=page]': { color: c.primary, borderBottom: `2px solid ${c.primary}` },
});
const Summary = styled.div({
  background: c.gray50,
  borderRadius: 12,
  padding: 16,
  marginTop: 16,
  fontSize: 13,
  '& dl': { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 },
  '& dt': { color: c.gray500 },
  '& dd': { textAlign: 'right', fontWeight: 600 },
});
const Related = styled.div({
  display: 'grid',
  gridTemplateColumns: 'repeat(3,minmax(0,1fr))',
  gap: 16,
  marginTop: 16,
  [mobile]: {
    gridTemplateColumns: 'repeat(2,minmax(0,1fr))',
    '& > article:nth-of-type(n+3)': { display: 'none' },
  },
});
export function ContestDetailPage({ teamTab = false }: { teamTab?: boolean }) {
  const saved = useUserStore((s) => s.bookmarks.includes('contest-1'));
  const toggle = useUserStore((s) => s.toggleBookmark);
  const toast = useToast();
  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('링크를 복사했어요.');
    } catch {
      toast.error('링크 복사 실패', '주소창의 링크를 복사해주세요.');
    }
  };
  const summary = (
    <>
      <Link href="/teams/new">
        <Button as="span" tone="outline" fullWidth>
          이 챌린지 팀 구하기
        </Button>
      </Link>
      <Summary>
        <b>대회 요약</b>
        <dl>
          <dt>마감일</dt>
          <dd>2025.07.15</dd>
          <dt>총 상금</dt>
          <dd>3,600만원</dd>
          <dt>팀 구성</dt>
          <dd>2~5인</dd>
        </dl>
      </Summary>
    </>
  );
  return (
    <UserShell title="공모전 상세" back="/explore">
      <Content>
        <Intro>
          <div className="cover" />
          <div className="intro-body">
            <Title>2025 공공데이터 활용 창업 대회</Title>
            <Muted>한국데이터산업진흥원</Muted>
            <div className="facts">
              자격 / 대상　대학(원)생 및 일반인 누구나 참여 가능
              <br />
              접수기간　2025.06.01 ~ 2025.07.15
            </div>
            <Row>
              <Tag tone="blue">D-3</Tag>
              <Button small tone="plain" aria-pressed={saved} onClick={() => toggle('contest-1')}>
                <Icon src="/assets/icons/scrap.png" size={14} alt="북마크" />
                북마크
              </Button>
              <Button small tone="plain" onClick={share}>
                <Icon src="/assets/icons/shareIc.png" size={14} alt="공유" />
                공유
              </Button>
            </Row>
          </div>
        </Intro>
        <Columns>
          <div>
            <Tabs>
              <Link href="/contests/public-data" aria-current={!teamTab ? 'page' : undefined}>
                정보
              </Link>
              <Link href="/contests/public-data/teams" aria-current={teamTab ? 'page' : undefined}>
                팀모집
              </Link>
            </Tabs>
            {teamTab ? (
              <TeamGrid>
                {Array.from({ length: 6 }, (_, i) => (
                  <TeamCard key={i} />
                ))}
              </TeamGrid>
            ) : (
              <Stack gap={28}>
                <DesktopOnly>
                  <img
                    src={asset('195-1147', 'imgImage16')}
                    alt="2026년 청년창업지원사업 멘토링 안내"
                    width={860}
                    height={860}
                    style={{ width: '100%', height: 'auto' }}
                  />
                </DesktopOnly>
                {[
                  ['자격 / 대상', '대학(원)생 및 일반인 누구나 참여 가능\n팀 구성: 2~5인 (필수)'],
                  [
                    '일정',
                    '접수기간: 2025.06.01 ~ 2025.07.15\n1차 심사: 2025.07.30\n최종 발표: 2025.08.20',
                  ],
                  ['상금', '대상 1팀: 1,000만원\n최우수상 2팀: 각 500만원\n우수상 3팀: 각 300만원'],
                ].map(([title, text]) => (
                  <section key={title}>
                    <h2 style={{ fontSize: 15, marginBottom: 10 }}>{title}</h2>
                    <Muted style={{ whiteSpace: 'pre-line' }}>{text}</Muted>
                  </section>
                ))}
                <MobileOnly>{summary}</MobileOnly>
                <Link href="/applications/new">
                  <Button as="span" fullWidth>
                    참가 신청하기
                  </Button>
                </Link>
              </Stack>
            )}
          </div>
          <DesktopOnly>{summary}</DesktopOnly>
        </Columns>
        <section style={{ marginTop: 60 }}>
          <SectionHeader
            title="이 챌린지와 유사한 챌린지"
            action={
              <Link href="/explore" style={{ fontSize: 13, color: c.gray500 }}>
                더보기 →
              </Link>
            }
          />
          <DesktopOnly>
            <Related>
              {desktopContests.slice(0, 3).map((x) => (
                <ContestCard key={x.id} contest={x} />
              ))}
            </Related>
          </DesktopOnly>
          <MobileOnly>
            <Related>
              {contests.slice(4, 6).map((x) => (
                <ContestCard key={x.id} contest={x} />
              ))}
            </Related>
          </MobileOnly>
        </section>
      </Content>
    </UserShell>
  );
}
