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
  SectionHeader,
} from '@/components/common/Primitives';
import { colors as c, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { useUserStore } from '@/stores/useUserStore';
import { useToast } from '@/components/common/Toast';
import { ContestCard } from './ContestCard';
import { TeamGrid, TeamCard } from '@/components/teams/TeamCard';
import { desktopContests, contests, contestDetail } from '@/data/user-design';
const Intro = styled.div({
  display: 'flex',
  gap: 24,
  marginBottom: 60,
  '.cover': { width: 315, height: 220, borderRadius: 12, background: c.gray100 },
  '.intro-body': { display: 'flex', flexDirection: 'column', gap: 12, flex: 1 },
  '.facts': { marginTop: 'auto', ...textStyle.metaText, color: c.gray700, lineHeight: 1.8 },
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
  '& a': { padding: '12px 16px', ...textStyle.bodySmall, color: c.gray500 },
  '& a[aria-current=page]': { color: c.primary, borderBottom: `2px solid ${c.primary}` },
});
const Summary = styled.div({
  background: c.gray50,
  borderRadius: 12,
  padding: 16,
  marginTop: 16,
  ...textStyle.caption,
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
          <dd>{contestDetail.deadline}</dd>
          <dt>총 상금</dt>
          <dd>{contestDetail.prizeTotal}</dd>
          <dt>팀 구성</dt>
          <dd>{contestDetail.teamSize}</dd>
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
            <Title>{contestDetail.title}</Title>
            <Muted>{contestDetail.org}</Muted>
            <div className="facts">
              자격 / 대상　{contestDetail.eligibility}
              <br />
              접수기간　{contestDetail.period}
            </div>
            <Row>
              <Tag tone="blue">{contestDetail.dday}</Tag>
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
                    src={contestDetail.poster}
                    alt={`${contestDetail.title} 포스터`}
                    width={860}
                    height={860}
                    style={{ width: '100%', height: 'auto' }}
                  />
                </DesktopOnly>
                {contestDetail.sections.map(({ title, body }) => (
                  <section key={title}>
                    <h2 style={{ fontSize: 15, marginBottom: 10 }}>{title}</h2>
                    <Muted style={{ whiteSpace: 'pre-line' }}>{body}</Muted>
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
