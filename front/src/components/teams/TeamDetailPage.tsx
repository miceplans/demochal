'use client';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import styled from '@emotion/styled';
import { ApiError, generated } from '@semochal/api-client';
import { UserShell, Content } from '@/components/common/UserShell';
import {
  Button,
  HeartIcon,
  Icon,
  IconButton,
  Muted,
  Row,
  Stack,
} from '@/components/common/Primitives';
import { Modal } from '@/components/common/Feedback';
import { Dropdown } from '@/components/ui/Dropdown';
import { ShareMenu } from '@/components/common/ShareMenu';
import { useToast } from '@/components/common/Toast';
import { isBookmarkableId, useBookmarks } from '@/features/bookmarks/useBookmarks';
import {
  ApplicationQuestions,
  isAnswerValid,
  type Answers,
} from '@/components/applications/ApplicationQuestions';
import { apiErrorMessage } from '@/lib/api-error';
import { colors as c, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { formatDateDot as formatDate } from '@/lib/date';
import { teamCapacity } from './team-model';
import { canSubmitTeamJoin, joinRoleForTeam } from './team-join';

const DEFAULT_PROFILE_IMAGE = '/assets/default-profile.png';

// 팀 상세 응답의 멤버 중 프로필 모달에 필요한 필드만 갖는 구조 타입(표의 행 그대로 넘긴다).
type MemberSummary = {
  userId?: string;
  name?: string;
  role?: string | null;
  profileImageUrl?: string | null;
};

const REGION_DISPLAY_NAMES: Record<string, string> = {
  서울: '서울특별시',
  부산: '부산광역시',
  대구: '대구광역시',
  인천: '인천광역시',
  광주: '광주광역시',
  대전: '대전광역시',
  울산: '울산광역시',
  세종: '세종특별자치시',
  경기: '경기도',
  강원: '강원특별자치도',
  충북: '충청북도',
  충남: '충청남도',
  전북: '전북특별자치도',
  전남: '전라남도',
  경북: '경상북도',
  경남: '경상남도',
  제주: '제주특별자치도',
};

function formatRegion(region?: string) {
  const value = region?.trim();
  if (!value) return '지역 무관';
  return REGION_DISPLAY_NAMES[value] ?? value;
}

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
  // 팀이 속한 챌린지의 신청서 질문 — 있으면 지원 버튼을 눌렀을 때 신청서 모달을 띄운다.
  const questions = challenge?.applicationForm ?? [];
  const posterUrl = challenge?.posterUrl ?? null;
  const bookmarkId = challenge?.id;
  const saved = bookmarks.some((item) => item.id === bookmarkId);

  const goLogin = () => router.push(`/login?next=${encodeURIComponent(pathname)}`);
  // 팀 지원 시 맡을 역할. 팀 조회가 끝난 뒤 openRoles로 선택지를 만들고, 선택값이 유효하지 않으면 첫 슬롯으로 되돌린다.
  const [pickedRole, setPickedRole] = useState('');
  // 표에서 고른 팀원 — 프로필(프사) 모달에 표시한다.
  const [pickedMember, setPickedMember] = useState<MemberSummary | null>(null);
  // 챌린지에 신청서가 있는 팀은 지원 버튼을 눌러도 바로 신청하지 않고 신청서 모달을 연다.
  const [applyOpen, setApplyOpen] = useState(false);
  const [answers, setAnswers] = useState<Answers>({});
  const [uploading, setUploading] = useState(false);
  const join = generated.useJoinTeam({
    mutation: {
      onSuccess: () => {
        setApplyOpen(false);
        setAnswers({});
        toast.success('팀 신청을 보냈어요', '팀장이 확인하면 알림으로 알려드릴게요');
        void queryClient.invalidateQueries({ queryKey: generated.getGetTeamQueryKey(id) });
      },
      onError: (error) => {
        if (error instanceof ApiError && error.status === 401) goLogin();
        else if (error instanceof ApiError && error.status === 400)
          toast.error(
            '신청할 수 없어요',
            apiErrorMessage(error, '이미 신청했거나 내가 만든 팀이에요'),
          );
        else
          toast.error('팀 신청에 실패했어요', apiErrorMessage(error, '잠시 후 다시 시도해주세요'));
      },
    },
  });

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
  const joinRole = joinRoleForTeam(openRoles, pickedRole);
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
    // 신청서가 있는 팀은 모달에서 질문에 답한 뒤 제출하고, 없는 팀은 지금 바로 신청한다.
    if (questions.length > 0) {
      setApplyOpen(true);
      return;
    }
    join.mutate({ id, data: { role: joinRole } });
  };
  const submitApply = () => {
    const invalid = questions.find((question) => !isAnswerValid(question, answers[question.id]));
    if (invalid) {
      toast.error(`“${invalid.title}” 답변을 확인해 주세요.`);
      return;
    }
    join.mutate({
      id,
      data: {
        role: joinRole,
        formAnswers: questions
          .filter((question) => answers[question.id] !== undefined)
          .map((question) => ({ questionId: question.id, value: answers[question.id]! })),
      },
    });
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
                <HeartIcon filled={saved} size={18} />
              </BookmarkButton>
              <ShareMenu title={team.title ?? team.challengeTitle ?? '팀'} />
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
                      <td>
                        <MemberButton
                          type="button"
                          onClick={() => setPickedMember(member)}
                          aria-label={`${member.name ?? '팀원'} 프로필 보기`}
                        >
                          <Avatar src={member.profileImageUrl ?? DEFAULT_PROFILE_IMAGE} alt="" />
                          <span>{member.name}</span>
                        </MemberButton>
                      </td>
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
                !canSubmitTeamJoin({
                  authPending,
                  joinPending: join.isPending,
                  challengePending: challengeQuery.isPending,
                  isLeader,
                  hasMembership: !!myMembership,
                })
              }
              onClick={apply}
            >
              {ctaLabel}
            </Button>
            {!isLeader && !myMembership && roleOptions.length === 0 && (
              <Muted style={{ textAlign: 'center' }}>역할 선택 없이 팀에 신청할 수 있어요.</Muted>
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
                <dd>{formatRegion(team.region)}</dd>
              </dl>
            </Summary>
          </Sidebar>
        </Columns>
        <Modal
          open={pickedMember !== null}
          onClose={() => setPickedMember(null)}
          title="팀원 프로필"
          width={320}
        >
          {pickedMember && (
            <Stack gap={12} style={{ alignItems: 'center', textAlign: 'center' }}>
              <ProfileAvatar src={pickedMember.profileImageUrl ?? DEFAULT_PROFILE_IMAGE} alt="" />
              <ProfileName>{pickedMember.name ?? '이름 없음'}</ProfileName>
              <Muted>
                {pickedMember.role ?? '역할 없음'} ·{' '}
                {pickedMember.userId === team.leaderUserId ? '팀장' : '팀원'}
              </Muted>
              {pickedMember.userId && (
                <ProfileLink href={`/profile?id=${pickedMember.userId}`}>프로필 보기</ProfileLink>
              )}
            </Stack>
          )}
        </Modal>
        <Modal open={applyOpen} onClose={() => setApplyOpen(false)} title="팀 지원서" width={520}>
          <Stack gap={20}>
            {roleOptions.length > 0 && (
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
            <ApplicationQuestions
              questions={questions}
              answers={answers}
              onChange={(questionId, value) =>
                setAnswers((current) => ({ ...current, [questionId]: value }))
              }
              onUploading={setUploading}
              disabled={join.isPending || uploading}
            />
            <Row gap={8}>
              <Button tone="plain" style={{ flex: 1 }} onClick={() => setApplyOpen(false)}>
                취소
              </Button>
              <Button
                style={{ flex: 1 }}
                disabled={join.isPending || uploading}
                onClick={submitApply}
              >
                {uploading ? '첨부파일 업로드 중…' : join.isPending ? '신청 중…' : '신청하기'}
              </Button>
            </Row>
          </Stack>
        </Modal>
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
  '&[aria-pressed="true"], &[aria-pressed="true"]:hover': { background: c.lightRed },
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
  '& th:nth-of-type(1), & td:nth-of-type(1)': { width: 220 },
  '& th:last-of-type, & td:last-of-type': { width: 96 },
  '& th': { ...textStyle.h1, height: 48, background: c.gray100 },
  '& th:first-of-type': { borderTopLeftRadius: 12 },
  '& th:last-of-type': { borderTopRightRadius: 12 },
  '& td': { height: 56, borderBottom: `0.5px solid ${c.gray100}` },
  '& td:first-of-type': { borderLeft: `0.5px solid ${c.gray100}` },
  '& td:last-of-type': { borderRight: `0.5px solid ${c.gray100}` },
  '& tr:last-of-type td:first-of-type': { borderBottomLeftRadius: 12 },
  '& tr:last-of-type td:last-of-type': { borderBottomRightRadius: 12 },
  [mobile]: {
    ...textStyle.body,
    '& th:nth-of-type(1), & td:nth-of-type(1)': { width: 'auto' },
    '& th:last-of-type, & td:last-of-type': { width: 64 },
  },
});
// 표에서 사람(이름+아바타)을 누를 수 있는 버튼 — 누를면 팀원 프로필 모달이 열린다.
const MemberButton = styled.button({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 10,
  maxWidth: '100%',
  padding: 0,
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  ...textStyle.bodyLarge,
  color: c.gray900,
  '&:hover span': { textDecoration: 'underline' },
  span: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
});
const Avatar = styled.img({
  flexShrink: 0,
  width: 32,
  height: 32,
  borderRadius: '50%',
  background: c.gray100,
  objectFit: 'cover',
});
const ProfileAvatar = styled.img({
  width: 96,
  height: 96,
  borderRadius: '50%',
  background: c.gray100,
  objectFit: 'cover',
});
const ProfileName = styled.b({ ...textStyle.h1, color: c.gray900 });
// 배경·밑줄·색상 없는 일반 텍스트 링크 — 누를면 프로필로 이동한다.
const ProfileLink = styled(Link)({
  ...textStyle.subtitle,
  color: c.gray900,
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
