'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styled from '@emotion/styled';
import { useQueryClient } from '@tanstack/react-query';
import { generated } from '@semochal/api-client';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { LOCAL_ERROR_TOAST_META, useToast } from '@/components/common/Toast';
import { AdminInlineNotice, ApproveButton, RejectButton } from './parts';
import { useAdminHref } from './AdminShell';

/* ---------- 레이아웃: 좌측 본문 + 우측 신고·확인 목록 ---------- */

const Layout = styled.div({ display: 'flex', alignItems: 'flex-start', gap: 32 });
const Main = styled.div({
  flex: '1 1 0',
  minWidth: 0,
  maxWidth: 720,
  display: 'flex',
  flexDirection: 'column',
});
const Side = styled.aside({
  flex: '0 0 368px',
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
});

const BackButton = styled.button({
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  alignSelf: 'flex-start',
  padding: 0,
  border: 0,
  background: 'none',
  cursor: 'pointer',
  ...textStyle.body,
  color: c.gray900,
});

const Body = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 40,
  padding: '30px 0',
});

/* ---------- 헤더 ---------- */

const Header = styled.div({ display: 'flex', alignItems: 'flex-end', gap: 24 });
const Thumbnail = styled.div({
  flex: '0 0 218px',
  height: 187,
  borderRadius: 19,
  background: c.gray100,
  overflow: 'hidden',
  '& img': { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
});
const HeaderInfo = styled.div({
  alignSelf: 'stretch',
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
});
const HeaderTitle = styled.h1({
  margin: 0,
  fontSize: 22,
  fontWeight: 700,
  color: c.gray900,
  wordBreak: 'break-word',
});
const HeaderSub = styled.p({ margin: '10px 0 0', ...textStyle.body, color: c.gray700 });
const MetaList = styled.div({ display: 'flex', flexDirection: 'column', gap: 8 });
const MetaRow = styled.div({ display: 'flex', alignItems: 'center', gap: 9, fontSize: 11 });
const MetaKey = styled.span({ fontWeight: 600, color: c.gray900, whiteSpace: 'nowrap' });
const MetaValue = styled.span({ color: c.gray700 });
const BadgeRow = styled.div({ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 });
const HeaderBadge = styled.span<{ tone?: 'primary' | 'gray' }>(({ tone = 'primary' }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '4px 10px',
  borderRadius: 4,
  ...textStyle.subtitle,
  background: tone === 'primary' ? c.primary : c.gray100,
  color: tone === 'primary' ? c.white : c.gray700,
}));

/* ---------- 탭 · 본문 ---------- */

const Tabs = styled.div({
  display: 'flex',
  borderBottom: `0.5px solid ${c.gray100}`,
  marginBottom: 20,
});
const TabButton = styled.button<{ active: boolean }>(({ active }) => ({
  padding: '10px 20px',
  border: 0,
  borderBottom: active ? `2px solid ${c.primary}` : '2px solid transparent',
  background: 'none',
  cursor: 'pointer',
  fontSize: active ? 14 : 15,
  fontWeight: active ? 600 : 400,
  color: active ? c.primary : c.gray500,
}));
const Poster = styled.img({ width: '100%', display: 'block', objectFit: 'cover' });
const SectionBlock = styled.div({ display: 'flex', flexDirection: 'column', gap: 8 });
const SectionTitle = styled.p({ margin: 0, ...textStyle.h2, fontSize: 15, color: c.gray900 });
const SectionText = styled.p({
  margin: 0,
  ...textStyle.body,
  color: c.gray700,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
});
const TeamLink = styled(Link)({
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  padding: '14px 16px',
  borderBottom: `0.5px solid ${c.gray200}`,
  textDecoration: 'none',
  color: c.gray900,
  '&:hover': { background: c.gray100 },
});

/* ---------- 우측 ---------- */

const SideSection = styled.section({ display: 'flex', flexDirection: 'column', gap: 4 });
const SideTitle = styled.h2({ margin: 0, ...textStyle.h2, color: '#000' });
const ReportBox = styled.ul({
  margin: 0,
  padding: 0,
  listStyle: 'none',
  border: `1px solid ${c.gray200}`,
  borderRadius: 8,
  background: c.white,
});
const ReportRow = styled.li({
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  padding: '16px',
  borderTop: `1px solid ${c.gray200}`,
  '&:first-of-type': { borderTop: 0 },
});
const ReportSummary = styled.span({ fontSize: 16, lineHeight: 1.5, color: c.gray900 });
const ReportMeta = styled.span({ ...textStyle.metaText, color: c.gray500 });

const NextItem = styled(Link)({
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  padding: 9,
  borderRadius: 5,
  textDecoration: 'none',
  '&:hover': { background: c.gray100 },
});
const NextThumb = styled.div({
  flex: '0 0 89px',
  height: 89,
  borderRadius: 11,
  border: '0.9px solid #f0f1f3',
  background: c.gray100,
});
const NextBody = styled.div({
  flex: 1,
  minWidth: 0,
  alignSelf: 'stretch',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
});
const NextTitle = styled.span({
  fontSize: 11.6,
  fontWeight: 600,
  lineHeight: 1.4,
  color: c.gray900,
});
const NextMeta = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
});
const MiniTag = styled.span<{ blue?: boolean }>(({ blue }) => ({
  padding: '3px 5px',
  borderRadius: 4,
  fontSize: 9,
  fontWeight: 500,
  background: blue ? c.lightBlue : c.gray100,
  color: blue ? c.primary : c.gray700,
}));
const NextSub = styled.span({ display: 'block', ...textStyle.metaText, color: c.gray500 });
const MiniTags = styled.div({ display: 'flex', flexWrap: 'wrap', gap: 4 });
const MiniDday = styled.span({ fontSize: 10, fontWeight: 700, color: c.primary });

/* ---------- 반려 사유 · 하단 반려 / 확인 ---------- */

const LabelFor = styled.label({ ...textStyle.metaText, color: c.gray500 });
const ReasonTextarea = styled.textarea({
  width: '100%',
  boxSizing: 'border-box',
  resize: 'vertical',
  padding: '10px 12px',
  border: `0.5px solid ${c.gray300}`,
  borderRadius: 8,
  color: c.gray900,
  ...textStyle.bodySmall,
  '&:focus': { outline: 'none', borderColor: c.primary },
});
const Actions = styled.div({ display: 'flex', justifyContent: 'flex-end', gap: 8 });

const EMPTY = '작성되지 않았어요';
const formatDateDot = (iso?: string) => (iso ? iso.slice(0, 10).replaceAll('-', '.') : '');
const daysLeft = (iso: string | undefined, now: number) =>
  iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 86_400_000)) : 0;

function Section({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <SectionBlock>
      <SectionTitle>{title}</SectionTitle>
      <SectionText>{children || EMPTY}</SectionText>
    </SectionBlock>
  );
}

function BackRow() {
  const router = useRouter();
  const hrefOf = useAdminHref();
  return (
    <BackButton type="button" onClick={() => router.push(hrefOf('/contents'))}>
      {/* eslint-disable-next-line @next/next/no-img-element -- 정적 SVG 아이콘 */}
      <img src="/assets/icons/admin-back.svg" alt="" width={24} height={24} />
      이전
    </BackButton>
  );
}

type ReportEntry = {
  id?: string;
  summary?: string;
  detail?: string | null;
  reporter?: string;
  reportedAt?: string;
  status?: string;
};

function ReportsBox({ title, reports }: { title: string; reports: ReportEntry[] }) {
  return (
    <SideSection>
      <SideTitle>{title}</SideTitle>
      <ReportBox>
        {reports.length === 0 ? (
          <ReportRow>
            <ReportSummary>접수된 신고가 없어요</ReportSummary>
          </ReportRow>
        ) : (
          reports.map((report) => (
            <ReportRow key={report.id}>
              <ReportSummary>{report.summary}</ReportSummary>
              {report.detail ? <ReportMeta>{report.detail}</ReportMeta> : null}
              <ReportMeta>
                {[
                  report.reporter,
                  formatDateDot(report.reportedAt),
                  report.status === 'open' ? '처리 대기' : '처리됨',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </ReportMeta>
            </ReportRow>
          ))
        )}
      </ReportBox>
    </SideSection>
  );
}

/** 우측 "확인해야할 공모전/팀" — 콘텐츠 모니터링 목록과 같은 항목(확인·반려된 것은 서버가 제외). */
function NextList({ kind, currentId }: { kind: 'team' | 'challenge'; currentId: string }) {
  const hrefOf = useAdminHref();
  const query = generated.useListAdminContents(
    { teamsLimit: 8, contestsLimit: 8 },
    { query: { meta: LOCAL_ERROR_TOAST_META } },
  );
  const data = query.data?.data;
  const items =
    kind === 'team'
      ? (data?.teams ?? [])
          .filter((team) => team.id !== currentId)
          .map((team) => (
            <NextItem key={team.id} href={hrefOf(`/contents/teams/${team.id}`)}>
              <NextThumb />
              <NextBody>
                <div>
                  <NextTitle>{team.name}</NextTitle>
                  <NextSub>{team.challenge}</NextSub>
                </div>
                <NextMeta>
                  <MiniTags>
                    {(team.roles ?? []).map((role) => (
                      <MiniTag key={role} blue>
                        {role}
                      </MiniTag>
                    ))}
                    {(team.otherRoles ?? []).map((role) => (
                      <MiniTag key={role}>{role}</MiniTag>
                    ))}
                  </MiniTags>
                </NextMeta>
                <NextSub>{team.members}</NextSub>
              </NextBody>
            </NextItem>
          ))
      : (data?.contests ?? [])
          .filter((contest) => contest.id !== currentId)
          .map((contest) => (
            <NextItem key={contest.id} href={hrefOf(`/contents/challenges/${contest.id}`)}>
              <NextThumb />
              <NextBody>
                <NextTitle>{contest.title}</NextTitle>
                <NextMeta>
                  <MiniTag>{contest.category}</MiniTag>
                  <MiniDday>{contest.dday}</MiniDday>
                </NextMeta>
                <NextMeta>
                  <span />
                  <MiniTag blue>{contest.teams}</MiniTag>
                </NextMeta>
              </NextBody>
            </NextItem>
          ));
  return (
    <SideSection>
      <SideTitle>{kind === 'team' ? '확인해야할 팀' : '확인해야할 공모전'}</SideTitle>
      {items.length > 0 ? items : <SectionText>확인할 항목이 없어요.</SectionText>}
    </SideSection>
  );
}

/** 우측 `신고` 박스 위의 반려 사유 입력 — 작성자에게 알림·이메일로 전달된다. */
function ReasonField({
  value,
  onChange,
  hidden,
}: {
  value: string;
  onChange: (value: string) => void;
  hidden: boolean;
}) {
  if (hidden) return null;
  return (
    <SideSection>
      <LabelFor htmlFor="content-reject-reason">반려 사유</LabelFor>
      <ReasonTextarea
        id="content-reject-reason"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="반려 사유를 입력해주세요 (작성자에게 알림과 이메일로 전달돼요)"
        maxLength={500}
        rows={4}
      />
    </SideSection>
  );
}

/** 하단 `반려` / `확인` — 반려는 사유가 필요하고, 확인하면 '확인해야하는' 목록에서 빠지고 목록으로 돌아간다. */
function ActionBar({
  rejected,
  pending,
  reason,
  onReject,
  onConfirm,
  confirming,
}: {
  rejected: boolean;
  pending: boolean;
  reason: string;
  onReject: (reason: string) => void;
  onConfirm: () => void;
  confirming: boolean;
}) {
  return (
    <Actions>
      <RejectButton
        type="button"
        disabled={rejected || pending || !reason.trim()}
        onClick={() => onReject(reason.trim())}
      >
        {rejected ? '반려됨' : pending ? '처리 중…' : '반려'}
      </RejectButton>
      <ApproveButton type="button" disabled={confirming || pending} onClick={onConfirm}>
        {confirming ? '처리 중…' : '확인'}
      </ApproveButton>
    </Actions>
  );
}

function useConfirmHandlers() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();
  const hrefOf = useAdminHref();
  return {
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: generated.getListAdminContentsQueryKey() });
      router.push(hrefOf('/contents'));
    },
    onError: () => toast.error('확인 처리에 실패했어요', '잠시 후 다시 시도해주세요'),
  };
}

function useRejectHandlers() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();
  const hrefOf = useAdminHref();
  return {
    onSuccess: () => {
      toast.success('반려하고 알림을 보냈어요.');
      void queryClient.invalidateQueries({ queryKey: generated.getListAdminContentsQueryKey() });
      router.push(hrefOf('/contents'));
    },
    onError: () => toast.error('반려에 실패했어요', '잠시 후 다시 시도해주세요'),
  };
}

/* ---------- 챌린지 상세 ---------- */

export function AdminChallengeDetailScreen({ id }: { id: string }) {
  const hrefOf = useAdminHref();
  const [tab, setTab] = useState<'info' | 'teams'>('info');
  const [reason, setReason] = useState('');
  // D-day 기준 시각은 마운트 시 한 번만 잡는다.
  const [now] = useState(() => Date.now());
  const query = generated.useGetAdminChallengeDetail(id, {
    query: { meta: LOCAL_ERROR_TOAST_META },
  });
  const reject = generated.useRejectAdminChallenge({ mutation: useRejectHandlers() });
  const confirm = generated.useConfirmAdminChallenge({ mutation: useConfirmHandlers() });
  const challenge = query.data?.status === 200 ? query.data.data : undefined;

  if (query.isPending) return <AdminInlineNotice>불러오는 중...</AdminInlineNotice>;
  if (!challenge) return <AdminInlineNotice>공고를 불러올 수 없어요.</AdminInlineNotice>;

  const rejected = challenge.status === 'rejected';
  const period = `${formatDateDot(challenge.startDate)} ~ ${formatDateDot(challenge.endDate)}`;
  const teams = challenge.teams ?? [];
  const prize = challenge.prizeAmount ? `${challenge.prizeAmount.toLocaleString()}만원` : '';
  const fee = (challenge.price ?? 0) > 0 ? `${challenge.price?.toLocaleString()}원` : '무료';

  return (
    <Layout>
      <Main>
        <BackRow />
        <Body>
          <Header>
            <Thumbnail>
              {challenge.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- 서버가 내려주는 외부 포스터 URL
                <img src={challenge.posterUrl} alt="" />
              ) : null}
            </Thumbnail>
            <HeaderInfo>
              <div>
                <HeaderTitle>{challenge.title}</HeaderTitle>
                <HeaderSub>{challenge.organization}</HeaderSub>
              </div>
              <div>
                <MetaList>
                  <MetaRow>
                    <MetaKey>자격 / 대상</MetaKey>
                    <MetaValue>{(challenge.targets ?? []).join(', ') || EMPTY}</MetaValue>
                  </MetaRow>
                  <MetaRow>
                    <MetaKey>접수기간</MetaKey>
                    <MetaValue>{period}</MetaValue>
                  </MetaRow>
                </MetaList>
                <BadgeRow>
                  <HeaderBadge>D-{daysLeft(challenge.endDate, now)}</HeaderBadge>
                  {rejected ? <HeaderBadge tone="gray">반려됨</HeaderBadge> : null}
                </BadgeRow>
              </div>
            </HeaderInfo>
          </Header>

          <div>
            <Tabs role="tablist">
              <TabButton
                type="button"
                role="tab"
                aria-selected={tab === 'info'}
                active={tab === 'info'}
                onClick={() => setTab('info')}
              >
                정보
              </TabButton>
              <TabButton
                type="button"
                role="tab"
                aria-selected={tab === 'teams'}
                active={tab === 'teams'}
                onClick={() => setTab('teams')}
              >
                팀모집
              </TabButton>
            </Tabs>
            {tab === 'info' ? (
              <SectionBlock style={{ gap: 20 }}>
                {challenge.posterUrl ? <Poster src={challenge.posterUrl} alt="" /> : null}
                <Body style={{ padding: 0 }}>
                  <Section title="자격 / 대상">
                    {[
                      (challenge.targets ?? []).join(', '),
                      `모집 인원 ${challenge.capacity ?? 0}명`,
                    ]
                      .filter(Boolean)
                      .join('\n')}
                  </Section>
                  <Section title="일정">{`접수기간: ${period}`}</Section>
                  <Section title="상금">{prize}</Section>
                  <Section title="참가비 · 지원 방식">
                    {[
                      fee,
                      challenge.recruitMethod === 'external'
                        ? `외부 링크 ${challenge.recruitUrl ?? ''}`.trim()
                        : '세모챌 신청서',
                    ].join('\n')}
                  </Section>
                  <Section title="한줄 소개">{challenge.summary}</Section>
                  <Section title="공고 내용">{challenge.description}</Section>
                  <Section title="해시태그">
                    {(challenge.hashtags ?? []).map((tag) => `#${tag}`).join(' ')}
                  </Section>
                </Body>
              </SectionBlock>
            ) : teams.length === 0 ? (
              <SectionText>등록된 팀 모집글이 없어요.</SectionText>
            ) : (
              <div>
                {teams.map((team) => (
                  <TeamLink key={team.id} href={hrefOf(`/contents/teams/${team.id}`)}>
                    <SectionTitle>{team.name}</SectionTitle>
                    <SectionText>
                      {[team.leaderName, team.status === 'rejected' ? '반려됨' : '']
                        .filter(Boolean)
                        .join(' · ')}
                    </SectionText>
                  </TeamLink>
                ))}
              </div>
            )}
          </div>

          <ActionBar
            rejected={rejected}
            pending={reject.isPending}
            reason={reason}
            onReject={(value) => reject.mutate({ id, data: { reason: value } })}
            onConfirm={() => confirm.mutate({ id })}
            confirming={confirm.isPending}
          />
        </Body>
      </Main>
      <Side>
        <ReasonField value={reason} onChange={setReason} hidden={rejected} />
        <ReportsBox title="이 공모전에 들어온 신고" reports={challenge.reports ?? []} />
        <NextList kind="challenge" currentId={id} />
      </Side>
    </Layout>
  );
}

/* ---------- 팀 상세 (챌린지 상세와 같은 구성) ---------- */

export function AdminTeamDetailScreen({ id }: { id: string }) {
  const [reason, setReason] = useState('');
  const query = generated.useGetAdminTeamDetail(id, {
    query: { meta: LOCAL_ERROR_TOAST_META },
  });
  const reject = generated.useRejectAdminTeam({ mutation: useRejectHandlers() });
  const confirm = generated.useConfirmAdminTeam({ mutation: useConfirmHandlers() });
  const team = query.data?.status === 200 ? query.data.data : undefined;

  if (query.isPending) return <AdminInlineNotice>불러오는 중...</AdminInlineNotice>;
  if (!team) return <AdminInlineNotice>팀을 불러올 수 없어요.</AdminInlineNotice>;

  const rejected = team.status === 'rejected';

  return (
    <Layout>
      <Main>
        <BackRow />
        <Body>
          <Header>
            <Thumbnail />
            <HeaderInfo>
              <div>
                <HeaderTitle>{team.name}</HeaderTitle>
                <HeaderSub>{team.challenge}</HeaderSub>
              </div>
              <div>
                <MetaList>
                  <MetaRow>
                    <MetaKey>팀장</MetaKey>
                    <MetaValue>
                      {[team.leaderName, team.leaderRole].filter(Boolean).join(' · ')}
                    </MetaValue>
                  </MetaRow>
                  <MetaRow>
                    <MetaKey>지역</MetaKey>
                    <MetaValue>{team.region || EMPTY}</MetaValue>
                  </MetaRow>
                  <MetaRow>
                    <MetaKey>등록일</MetaKey>
                    <MetaValue>{formatDateDot(team.createdAt)}</MetaValue>
                  </MetaRow>
                </MetaList>
                {rejected ? (
                  <BadgeRow>
                    <HeaderBadge tone="gray">반려됨</HeaderBadge>
                  </BadgeRow>
                ) : null}
              </div>
            </HeaderInfo>
          </Header>

          <div>
            <Tabs role="tablist">
              <TabButton type="button" role="tab" aria-selected active>
                정보
              </TabButton>
            </Tabs>
            <Body style={{ padding: 0 }}>
              <Section title="팀 소개">{team.introduction}</Section>
              <Section title="모집 역할">
                {(team.openRoles ?? []).map((slot) => `${slot.role} ${slot.count}명`).join('\n')}
              </Section>
              <Section title="참여 팀원">
                {(team.members ?? [])
                  .map((member) => [member.name, member.role].filter(Boolean).join(' · '))
                  .join('\n')}
              </Section>
              <Section title="우대사항">{team.preferred}</Section>
              <Section title="기타">{team.etc}</Section>
            </Body>
          </div>

          <ActionBar
            rejected={rejected}
            pending={reject.isPending}
            reason={reason}
            onReject={(value) => reject.mutate({ id, data: { reason: value } })}
            onConfirm={() => confirm.mutate({ id })}
            confirming={confirm.isPending}
          />
        </Body>
      </Main>
      <Side>
        <ReasonField value={reason} onChange={setReason} hidden={rejected} />
        <ReportsBox title="이 팀에 들어온 신고" reports={team.reports ?? []} />
        <NextList kind="team" currentId={id} />
      </Side>
    </Layout>
  );
}
