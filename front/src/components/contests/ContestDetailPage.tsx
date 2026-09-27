'use client';
import { useEffect, useRef, useState } from 'react';
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
  IconButton,
  SectionHeader,
} from '@/components/common/Primitives';
import { colors as c, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { useToast } from '@/components/common/Toast';
import { isBookmarkableId, useBookmarks } from '@/features/bookmarks/useBookmarks';
import { ContestCard } from './ContestCard';
import { TeamGrid, TeamCard } from '@/components/teams/TeamCard';
import { toTeamCard } from '@/components/teams/team-model';
import { generated } from '@semochal/api-client';
import { desktopContests, contests, contestDetail } from '@/data/user-design';

const formatDate = (value?: string) => (value ? value.slice(0, 10).replaceAll('-', '.') : '');

// challengeId가 있으면 GET /challenges/{id} 기준의 실제 상세, 없으면 /contests/public-data 데모 상세.
export function ContestDetailPage({
  teamTab = false,
  challengeId,
}: {
  teamTab?: boolean;
  challengeId?: string;
}) {
  // 실제 챌린지 상세만 서버 북마크 대상이다. 데모 상세(/contests/public-data)는 UUID가 없어 비활성.
  const bookmarkId = challengeId;
  const { bookmarks, toggleBookmark, isToggling } = useBookmarks();
  const saved = bookmarks.some((item) => item.id === bookmarkId);
  const [applyVisible, setApplyVisible] = useState(true);
  // D-day 계산 기준 시각은 마운트 시 한 번만 잡는다(렌더 중 Date.now() 호출 금지).
  const [now] = useState(() => Date.now());
  const challengeQuery = generated.useGetChallenge(challengeId ?? '', {
    query: { enabled: Boolean(challengeId) },
  });
  const challenge = challengeQuery.data?.status === 200 ? challengeQuery.data.data : undefined;
  // 데모 상세(challengeId 없음)는 전체 모집글을 보여준다.
  const { data: teamList } = generated.useListTeams(challengeId ? { challengeId } : undefined, {
    query: { enabled: teamTab },
  });
  const basePath = challengeId ? `/contests/${challengeId}` : '/contests/public-data';
  const external = challenge?.recruitMethod === 'external' && challenge.recruitUrl;
  // 신청 API는 ?challenge=<uuid>가 있어야 실제 신청·결제 흐름으로 동작한다(ApplicationPage).
  const applyHref = challengeId
    ? `/applications/new?challenge=${encodeURIComponent(challengeId)}`
    : '/applications/new';
  const detail = challenge
    ? {
        title: challenge.title ?? '',
        org: challenge.organizer ?? '',
        eligibility: challenge.eligibility ?? '-',
        period: [formatDate(challenge.startDate), formatDate(challenge.endDate)]
          .filter(Boolean)
          .join(' ~ '),
        dday: challenge.endDate
          ? `D-${Math.max(0, Math.ceil((new Date(challenge.endDate).getTime() - now) / 86_400_000))}`
          : '',
        deadline: formatDate(challenge.endDate) || '-',
        prizeTotal: '-',
        teamSize: challenge.capacity ? `${challenge.capacity}명` : '-',
        sections: challenge.description
          ? [{ title: '상세 안내', body: challenge.description }]
          : [],
      }
    : contestDetail;
  const toast = useToast();
  const applyRef = useRef<HTMLAnchorElement>(null);
  // 실제 챌린지는 로딩이 끝난 뒤에야 신청 버튼이 렌더되므로 그때 다시 관찰한다.
  const ready = !challengeId || Boolean(challenge);
  useEffect(() => {
    if (teamTab || !ready) return;
    const el = applyRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setApplyVisible(entry.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, [teamTab, ready]);
  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('링크를 복사했어요');
    } catch {
      toast.error('링크 복사 실패', '주소창의 링크를 복사해주세요');
    }
  };
  const teamCta = (
    <Link href="/teams/new">
      <Button as="span" tone="outline" fullWidth>
        이 챌린지 팀 구하기
      </Button>
    </Link>
  );
  const summaryBox = (
    <Summary>
      <b>대회 요약</b>
      <dl>
        <dt>마감일</dt>
        <dd>{detail.deadline}</dd>
        <dt>총 상금</dt>
        <dd>{detail.prizeTotal}</dd>
        <dt>팀 구성</dt>
        <dd>{detail.teamSize}</dd>
      </dl>
    </Summary>
  );
  if (challengeId && !challenge) {
    // 로딩 중이거나 조회 실패 — 목데이터로 대신 채우지 않는다(에러 토스트는 전역 QueryCache가 띄운다).
    return (
      <UserShell title="챌린지 상세" back="/explore">
        <Content>
          <Muted>
            {challengeQuery.isError ? '챌린지를 불러오지 못했어요' : '챌린지를 불러오는 중이에요'}
          </Muted>
        </Content>
      </UserShell>
    );
  }
  return (
    <UserShell title="챌린지 상세" back="/explore">
      <Content>
        <Intro>
          <div className="cover" />
          <div className="intro-body">
            <Title>{detail.title}</Title>
            <Muted>{detail.org}</Muted>
            <div className="facts">
              자격 / 대상　{detail.eligibility}
              <br />
              접수기간　{detail.period}
            </div>
            <Row>
              <Tag tone="blue">{detail.dday}</Tag>
              <IconButton
                aria-label="북마크"
                aria-pressed={saved}
                disabled={!isBookmarkableId(bookmarkId) || isToggling}
                title={bookmarkId ? undefined : '데모 챌린지는 북마크할 수 없어요'}
                onClick={() => toggleBookmark(bookmarkId)}
              >
                <Icon src="/assets/icons/scrap.png" size={18} alt="북마크" />
              </IconButton>
              <Button small tone="plain" onClick={share}>
                <Icon src="/assets/icons/share-ic.png" size={14} alt="공유" />
                공유
              </Button>
              <IconLink href="/reports/new?type=challenge" aria-label="신고">
                <Icon src="/assets/icons/report.svg" size={18} alt="신고" />
              </IconLink>
            </Row>
          </div>
        </Intro>
        <Columns>
          <div>
            <Tabs>
              <Link href={basePath} aria-current={!teamTab ? 'page' : undefined}>
                정보
              </Link>
              <Link href={`${basePath}/teams`} aria-current={teamTab ? 'page' : undefined}>
                팀모집
              </Link>
            </Tabs>
            {teamTab ? (
              <TeamGrid>
                {(teamList?.data ?? []).slice(0, 6).map((team) => (
                  <TeamCard key={team.id} team={toTeamCard(team)} />
                ))}
              </TeamGrid>
            ) : (
              <Stack gap={28}>
                {!challengeId && (
                  <DesktopOnly>
                    <img
                      src={contestDetail.poster}
                      alt={`${detail.title} 포스터`}
                      width={860}
                      height={860}
                      style={{ width: '100%', height: 'auto' }}
                    />
                  </DesktopOnly>
                )}
                <MobileOnly>{summaryBox}</MobileOnly>
                {detail.sections.map(({ title, body }) => (
                  <section key={title}>
                    <h2 style={{ fontSize: 15, marginBottom: 10 }}>{title}</h2>
                    <Muted style={{ whiteSpace: 'pre-line' }}>{body}</Muted>
                  </section>
                ))}
                {external ? (
                  <a href={external} target="_blank" rel="noopener noreferrer" ref={applyRef}>
                    <Button as="span" fullWidth>
                      참가 신청하기
                    </Button>
                  </a>
                ) : (
                  <Link href={applyHref} ref={applyRef}>
                    <Button as="span" fullWidth>
                      참가 신청하기
                    </Button>
                  </Link>
                )}
                <MobileOnly>{teamCta}</MobileOnly>
              </Stack>
            )}
          </div>
          <Sidebar>
            {!teamTab && !applyVisible && (
              <Link
                href={external || applyHref}
                {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              >
                <Button as="span" fullWidth>
                  참가 신청하기
                </Button>
              </Link>
            )}
            {teamCta}
            {summaryBox}
          </Sidebar>
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
  alignItems: 'start',
  gap: 24,
  [mobile]: { display: 'flex', flexDirection: 'column' },
});
const Sidebar = styled(DesktopOnly)({
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  minWidth: 0,
  position: 'sticky',
  top: 24,
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
  ...textStyle.caption,
  '& dl': { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 },
  '& dt': { color: c.gray500 },
  '& dd': { textAlign: 'right', fontWeight: 600 },
});
const IconLink = styled(Link)({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 4,
  borderRadius: 6,
  color: c.gray700,
  transition: 'background 0.15s ease, transform 0.1s ease',
  '&:hover': { background: c.gray50 },
  '&:active': { transform: 'scale(0.85)' },
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
