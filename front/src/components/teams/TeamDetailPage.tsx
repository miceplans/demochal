'use client';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import styled from '@emotion/styled';
import { ApiError, generated } from '@semochal/api-client';
import { UserShell, Content } from '@/components/common/UserShell';
import { Button, Icon, IconButton, Muted, Row } from '@/components/common/Primitives';
import { Dropdown } from '@/components/ui/Dropdown';
import { useToast } from '@/components/common/Toast';
import { isBookmarkableId, useBookmarks } from '@/features/bookmarks/useBookmarks';
import { colors as c, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { formatDateDot as formatDate } from '@/lib/date';
import { teamCapacity } from './team-model';

export function TeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { bookmarks, toggleBookmark, isToggling } = useBookmarks();

  // UserShell과 같은 쿼리 키라 캐시를 공유한다 — 페이지 진입만으로는 로그인을 요구하지 않는다.
  const { data: auth, isPending: authPending } = generated.useGetMyAuthInfo({
    query: { retry: false },
  });
  const me = auth?.status === 200 ? auth.data : undefined;
  const teamQuery = generated.useGetTeam(id, { query: { retry: false } });
  const team = teamQuery.data?.status === 200 ? teamQuery.data.data : undefined;
  const challengeQuery = generated.useGetChallenge(team?.challengeId ?? '', {
    query: { enabled: !!team?.challengeId },
  });
  const challenge = challengeQuery.data?.status === 200 ? challengeQuery.data.data : undefined;
  const posterUrl = challenge?.posterUrl ?? null;
  const bookmarkId = challenge?.id;
  const saved = bookmarks.some((item) => item.id === bookmarkId);

  const goLogin = () => router.push(`/login?next=${encodeURIComponent(pathname)}`);
  // 팀 지원 시 맡을 역할. 팀 조회가 끝난 뒤 openRoles로 선택지를 만들고, 선택값이 유효하지 않으면 첫 슬롯으로 되돌린다.
  const [pickedRole, setPickedRole] = useState('');
  const join = generated.useJoinTeam({
    mutation: {
      onSuccess: () => {
        toast.success('팀 신청을 보냈어요', '팀장이 확인하면 알림으로 알려드릴게요');
        void queryClient.invalidateQueries({ queryKey: generated.getGetTeamQueryKey(id) });
      },
      onError: (error) => {
        if (error instanceof ApiError && error.status === 401) goLogin();
        else if (error instanceof ApiError && error.status === 400)
          toast.error('신청할 수 없어요', '이미 신청했거나 내가 만든 팀이에요');
      },
    },
  });

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('링크를 복사했어요');
    } catch {
      toast.error('링크 복사 실패', '주소창의 링크를 복사해주세요');
    }
  };

  if (teamQuery.isPending) {
    return (
      <UserShell title="팀 모집글" back="/teams">
        <Content />
      </UserShell>
    );
  }
  if (!team) {
    return (
      <UserShell title="팀 모집글" back="/teams">
        <Content>
          <Muted>모집글을 찾을 수 없어요.</Muted>
        </Content>
      </UserShell>
    );
  }

  const members = team.members ?? [];
  const accepted = members.filter((member) => member.status === 'accepted');
  const myMembership = me ? members.find((member) => member.userId === me.id) : undefined;
  const isLeader = !!me && me.id === team.leaderUserId;
  const capacity = teamCapacity(team);
  const openRoles = (team.openRoles ?? []).map((slot) => slot.role ?? '').filter(Boolean);
  const roleOptions = openRoles.map((role) => ({ value: role, label: role }));
  const joinRole = roleOptions.some((option) => option.value === pickedRole)
    ? pickedRole
    : (roleOptions[0]?.value ?? '');
  const facts = [
    ['필요역할', openRoles.length ? openRoles.join(', ') : '없음'],
    ['우대사항', team.preferred || '없음'],
    ['기타', team.etc || '없음'],
  ];
  const ctaLabel = isLeader
    ? '내가 만든 모집글'
    : myMembership?.status === 'pending'
      ? '신청 완료 · 검토 중'
      : myMembership?.status === 'accepted'
        ? '참여 중인 팀'
        : myMembership?.status === 'rejected'
          ? '신청이 거절됐어요'
          : '팀 신청하기';
  const apply = () => {
    if (!me) {
      goLogin();
      return;
    }
    join.mutate({ id, data: { role: joinRole || undefined } });
  };

  return (
    <UserShell title="팀 모집글" back="/teams">
      <Content>
        <Header>
          <Cover aria-hidden="true">
            {posterUrl ? (
              <img src={posterUrl} alt="" />
            ) : (
              <span>{(team.challengeTitle || team.title || '팀').trim().slice(0, 1)}</span>
            )}
          </Cover>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="heading">
              <h1>
                {team.title} ({accepted.length}/{capacity})
              </h1>
              <p>{team.challengeTitle}</p>
            </div>
            <Row gap={8}>
              <BookmarkButton
                aria-label="북마크"
                aria-pressed={saved}
                disabled={!isBookmarkableId(bookmarkId) || isToggling}
                title={bookmarkId ? undefined : '챌린지 정보가 없어 북마크할 수 없어요'}
                onClick={() => {
                  toggleBookmark(bookmarkId);
                }}
              >
                <Icon src="/assets/icons/scrap.png" size={18} alt="북마크" />
              </BookmarkButton>
              <Button small tone="plain" onClick={share}>
                <Icon src="/assets/icons/share-ic.png" size={14} alt="공유" />
                공유
              </Button>
              <IconLink href={`/reports/new?targetType=team&targetId=${team.id}`} aria-label="신고">
                <Icon src="/assets/icons/report.svg" size={18} alt="신고" />
              </IconLink>
            </Row>
          </Row>
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
              <p className="intro">{team.introduction || '아직 팀 소개가 없어요.'}</p>
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
                  {accepted.map((member) => (
                    <tr key={member.id}>
                      <td>{member.name}</td>
                      <td>{member.role ?? '-'}</td>
                      <td>{member.userId === team.leaderUserId ? '팀장' : '팀원'}</td>
                    </tr>
                  ))}
                </tbody>
              </Roster>
            </section>
          </Main>
          <Sidebar>
            {!isLeader && !myMembership && roleOptions.length > 0 && (
              <RolePicker>
                <span className="label">지원 역할</span>
                <Dropdown
                  aria-label="지원 역할"
                  value={joinRole}
                  onChange={setPickedRole}
                  options={roleOptions}
                />
              </RolePicker>
            )}
            <Button
              type="button"
              fullWidth
              disabled={
                authPending ||
                join.isPending ||
                isLeader ||
                !!myMembership ||
                roleOptions.length === 0
              }
              onClick={apply}
            >
              {ctaLabel}
            </Button>
            {!isLeader && !myMembership && roleOptions.length === 0 && (
              <Muted style={{ textAlign: 'center' }}>현재 모집 중인 역할이 없어요.</Muted>
            )}
            <Summary>
              <b>대회 요약</b>
              <dl>
                <dt>마감일</dt>
                <dd>{formatDate(challenge?.endDate)}</dd>
                <dt>팀 구성</dt>
                <dd>
                  {accepted.length}/{capacity}명
                </dd>
                <dt>지역</dt>
                <dd>{team.region || '무관'}</dd>
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
  '.heading': { display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 },
  h1: { ...textStyle.display, fontSize: 22, fontWeight: 700 },
  '.heading p': { ...textStyle.caption, color: c.gray900 },
  [mobile]: { gap: 20, marginBottom: 24 },
});
const Cover = styled.div({
  display: 'grid',
  placeItems: 'center',
  width: '100%',
  height: 222,
  borderRadius: 19,
  background: '#d8e4f0',
  overflow: 'hidden',
  img: { width: '100%', height: '100%', objectFit: 'cover' },
  span: { fontSize: 64, fontWeight: 700, color: 'rgb(255 255 255 / 90%)' },
  [mobile]: { height: 180, borderRadius: 12, span: { fontSize: 44 } },
});
const RolePicker = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  '& .label': { ...textStyle.caption, color: c.gray500 },
});
const BookmarkButton = styled(IconButton)({
  '&[aria-pressed="true"], &[aria-pressed="true"]:hover': { background: c.lightBlue },
});
const IconLink = styled(Link)({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 4,
  borderRadius: 6,
  transition: 'background 0.15s ease, transform 0.1s ease',
  '&:hover': { background: c.gray50 },
  '&:active': { transform: 'scale(0.85)' },
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
