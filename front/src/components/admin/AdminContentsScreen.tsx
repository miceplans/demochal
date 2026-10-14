'use client';

import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import styled from '@emotion/styled';
import { keepPreviousData, useQueryClient } from '@tanstack/react-query';
import { generated } from '@semochal/api-client';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { LOCAL_ERROR_TOAST_META, useToast } from '@/components/common/Toast';
import {
  AdminInlineNotice,
  AdminPageTitle,
  AdminSectionTitle,
  ApproveButton,
  RejectButton,
  FilterBar,
  SearchFilter,
  SelectFilter,
  SectionHeader,
} from './parts';
import { ReportLogTable } from './ReportLogTable';

/* ---------- 팀 카드 ---------- */

const CardGrid = styled.div({
  display: 'flex',
  gap: 16,
  flexWrap: 'nowrap',
  overflowX: 'auto',
});
const TeamCard = styled.article({
  position: 'relative',
  cursor: 'pointer',
  '&:hover': { borderColor: c.gray300 },
  flex: '0 0 calc((100% - 48px) / 4)',
  border: `0.5px solid ${c.gray200}`,
  borderRadius: 12,
  background: c.gray100,
  overflow: 'hidden',
});
const UnreadDot = styled.span({
  position: 'absolute',
  top: 10,
  right: 10,
  width: 10,
  height: 10,
  borderRadius: 24,
  background: c.primary,
  zIndex: 1,
});
const TeamCover = styled.div({
  height: 135,
  background: `linear-gradient(135deg, ${c.gray200} 0%, ${c.gray100} 100%)`,
});
const TeamBody = styled.div({
  background: c.white,
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
});
const TeamName = styled.strong({ ...textStyle.mNameLabel, color: c.gray900 });
const TeamChallenge = styled.span({ ...textStyle.mInfoText, color: c.gray500 });
const RoleBadges = styled.div({ display: 'flex', gap: 6, flexWrap: 'wrap' });
const RoleBadge = styled.span<{ active?: boolean }>(({ active }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '4px 8px',
  borderRadius: 4,
  ...textStyle.mBadgeText,
  background: active ? c.lightGreen : c.gray100,
  color: active ? c.green : c.gray500,
  border: active ? 'none' : `0.5px solid ${c.gray200}`,
}));
/* ---------- 챌린지 카드 ---------- */

const ContestCard = styled.article({
  position: 'relative',
  cursor: 'pointer',
  '&:hover': { borderColor: c.gray300 },
  flex: '0 0 calc((100% - 48px) / 4)',
  border: `0.5px solid ${c.gray200}`,
  borderRadius: 12,
  background: c.gray100,
  overflow: 'hidden',
});
const ContestCover = styled.div({
  height: 189,
  background: `linear-gradient(135deg, ${c.gray200} 0%, ${c.gray100} 100%)`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: c.gray500,
  ...textStyle.mInfoText,
});
const ContestBody = styled.div({
  background: c.white,
  padding: 14,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});
const ContestTitle = styled.strong({ ...textStyle.bodySmall2, color: c.gray900 });
const TagRow = styled.div({ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' });
const CategoryTag = styled.span({
  padding: '3px 8px',
  borderRadius: 4,
  background: c.gray100,
  color: c.gray700,
  ...textStyle.finePrint,
});
const DDay = styled.span({ ...textStyle.overline, color: c.primary });
const TeamCount = styled.span({
  padding: '4px 8px',
  borderRadius: 4,
  background: c.lightBlue,
  color: c.primary,
  ...textStyle.label,
});
const MoreButton = styled.button({
  border: 0,
  background: 'none',
  padding: 0,
  ...textStyle.caption,
  color: c.gray500,
  cursor: 'pointer',
  '&:hover:not(:disabled)': { color: c.gray900 },
  '&:disabled': { cursor: 'wait' },
});

/* ---------- preview 모달 ---------- */

const Backdrop = styled.div({
  position: 'fixed',
  zIndex: 100,
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  padding: 24,
  background: 'rgba(17, 24, 39, .46)',
});
const PreviewModal = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
  width: 'min(100%, 480px)',
  padding: 24,
  borderRadius: 12,
  background: c.white,
  boxShadow: '0 20px 48px rgba(17, 24, 39, .22)',
});
const PreviewTitle = styled.h2({ margin: 0, ...textStyle.h2_2, color: c.gray900 });
const PreviewScroll = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  maxHeight: '55vh',
  overflowY: 'auto',
});
const DetailHead = styled.div({ display: 'flex', flexDirection: 'column', gap: 4 });
const DetailName = styled.strong({ ...textStyle.h2_2, color: c.gray900 });
const DetailSub = styled.span({ ...textStyle.bodySmall, color: c.gray500 });
const DetailField = styled.div({ display: 'flex', flexDirection: 'column', gap: 4 });
const DetailLabel = styled.span({ ...textStyle.metaText, color: c.gray500 });
const DetailText = styled.p({
  margin: 0,
  ...textStyle.bodySmall,
  color: c.gray900,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
});
const EMPTY = '작성되지 않았어요';

const formatDate = (iso: string) => (iso ? iso.slice(0, 10) : '');

function DetailItem({ label, children }: { label: string; children?: string | null }) {
  return (
    <DetailField>
      <DetailLabel>{label}</DetailLabel>
      <DetailText>{children || EMPTY}</DetailText>
    </DetailField>
  );
}

const teamDetail = (team: TeamCardRow) => (
  <PreviewScroll>
    <DetailHead>
      <DetailName>{team.name}</DetailName>
      <DetailSub>{team.challenge}</DetailSub>
    </DetailHead>
    <DetailItem label="팀장">
      {[team.leaderName, team.leaderRole, team.region].filter(Boolean).join(' · ')}
    </DetailItem>
    <DetailItem label="모집 역할">
      {team.openRoles.map((slot) => `${slot.role} ${slot.count}명`).join(', ')}
    </DetailItem>
    <DetailItem label="참여 현황">{team.members}</DetailItem>
    <DetailItem label="팀 소개">{team.introduction}</DetailItem>
    <DetailItem label="우대사항">{team.preferred}</DetailItem>
    <DetailItem label="기타">{team.etc}</DetailItem>
  </PreviewScroll>
);

const contestDetail = (contest: ContestCardRow) => (
  <PreviewScroll>
    <DetailHead>
      <DetailName>{contest.title}</DetailName>
      <DetailSub>
        {[contest.category, contest.dday, contest.teams].filter(Boolean).join(' · ')}
      </DetailSub>
    </DetailHead>
    <DetailItem label="한줄 소개">{contest.summary}</DetailItem>
    <DetailItem label="접수 기간">
      {`${formatDate(contest.startDate)} ~ ${formatDate(contest.endDate)}`}
    </DetailItem>
    <DetailItem label="모집 인원 · 참가비">
      {`${contest.capacity}명 · ${contest.price > 0 ? `${contest.price.toLocaleString()}원` : '무료'}`}
    </DetailItem>
    <DetailItem label="총상금">
      {contest.prizeAmount ? `${contest.prizeAmount.toLocaleString()}만원` : ''}
    </DetailItem>
    <DetailItem label="대상">{contest.targets.join(', ')}</DetailItem>
    <DetailItem label="해시태그">{contest.hashtags.map((tag) => `#${tag}`).join(' ')}</DetailItem>
    <DetailItem label="공고 내용">{contest.description}</DetailItem>
  </PreviewScroll>
);

const ReasonLabel = styled.label({ ...textStyle.metaText, color: c.gray500 });
const ReasonTextarea = styled.textarea({
  marginTop: 8,
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
const PreviewActions = styled.div({ display: 'flex', justifyContent: 'flex-end', gap: 8 });

// 카드를 키보드로도 열 수 있게 하는 공통 속성.
const openOnKey = (open: () => void) => (event: KeyboardEvent) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    open();
  }
};

type Preview = { kind: 'team'; id: string } | { kind: 'contest'; id: string };

/* ---------- 신고 테이블 ---------- */

// '더보기'는 섹션 limit을 한 페이지씩 늘려 다시 조회한다 (서버 상한 50).
const PAGE_SIZE = 8;
const MAX_LIMIT = 50;

const kindOptionToTargetType: Record<string, 'challenge' | 'team' | 'award' | 'user'> = {
  챌린지: 'challenge',
  '팀 모집': 'team',
  수상작: 'award',
  프로필: 'user',
};

type TeamCardRow = {
  id: string;
  name: string;
  challenge: string;
  members: string;
  roles: string[];
  otherRoles: string[];
  unread: boolean;
  leaderName: string;
  leaderRole: string;
  region: string;
  introduction: string;
  preferred: string;
  etc: string;
  openRoles: { role: string; count: number }[];
};

type ContestCardRow = {
  id: string;
  title: string;
  category: string;
  dday: string;
  teams: string;
  unread: boolean;
  summary: string;
  description: string;
  startDate: string;
  endDate: string;
  price: number;
  capacity: number;
  prizeAmount: number | null;
  targets: string[];
  hashtags: string[];
};

const teamCardContent = (team: TeamCardRow) => (
  <>
    {team.unread ? <UnreadDot aria-label="확인 필요" /> : null}
    <TeamCover />
    <TeamBody>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TeamName>{team.name}</TeamName>
        <TeamChallenge>{team.challenge}</TeamChallenge>
      </div>
      <RoleBadges>
        {team.roles.map((role) => (
          <RoleBadge key={role} active>
            {role}
          </RoleBadge>
        ))}
        {team.otherRoles.map((role) => (
          <RoleBadge key={role}>{role}</RoleBadge>
        ))}
      </RoleBadges>
      <span style={{ ...textStyle.mInfoText, color: c.gray700 }}>{team.members}</span>
    </TeamBody>
  </>
);

const contestCardContent = (contest: ContestCardRow) => (
  <>
    {contest.unread ? <UnreadDot aria-label="확인 필요" /> : null}
    <ContestCover>공고 이미지</ContestCover>
    <ContestBody>
      <ContestTitle>{contest.title}</ContestTitle>
      <TagRow>
        <CategoryTag>{contest.category}</CategoryTag>
        <DDay>{contest.dday}</DDay>
        <TeamCount>{contest.teams}</TeamCount>
      </TagRow>
    </ContestBody>
  </>
);

export function AdminContentsScreen() {
  const [teamsLimit, setTeamsLimit] = useState(PAGE_SIZE);
  const [contestsLimit, setContestsLimit] = useState(PAGE_SIZE);
  const [reportQuery, setReportQuery] = useState('');
  const [kind, setKind] = useState('');
  const contentsQuery = generated.useListAdminContents(
    { teamsLimit, contestsLimit },
    // 더보기로 limit이 바뀌는 동안 기존 카드를 유지한다.
    { query: { placeholderData: keepPreviousData, meta: LOCAL_ERROR_TOAST_META } },
  );
  const teamsTotal = contentsQuery.data?.data.teamsTotal ?? 0;
  const contestsTotal = contentsQuery.data?.data.contestsTotal ?? 0;
  const reportParams = useMemo(
    () => ({ q: reportQuery || undefined, targetType: kindOptionToTargetType[kind] }),
    [reportQuery, kind],
  );
  const refetchContents = contentsQuery.refetch;
  const toast = useToast();
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [reason, setReason] = useState('');

  const onRejected = () => {
    toast.success('반려하고 알림을 보냈어요.');
    setPreview(null);
    setReason('');
    void queryClient.invalidateQueries({ queryKey: generated.getListAdminContentsQueryKey() });
  };
  const onRejectError = () => toast.error('반려에 실패했어요', '잠시 후 다시 시도해주세요');
  const rejectTeam = generated.useRejectAdminTeam({
    mutation: { onSuccess: onRejected, onError: onRejectError },
  });
  const rejectChallenge = generated.useRejectAdminChallenge({
    mutation: { onSuccess: onRejected, onError: onRejectError },
  });
  const rejecting = rejectTeam.isPending || rejectChallenge.isPending;

  const closePreview = () => {
    setPreview(null);
    setReason('');
  };

  useEffect(() => {
    if (!preview) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') closePreview();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [preview]);

  useEffect(() => {
    if (!contentsQuery.isError) return;
    toast.error('콘텐츠를 불러올 수 없어요. 잠시 후 다시 시도해주세요.', undefined, {
      action: { label: '다시 시도', onClick: () => void refetchContents() },
    });
    // isError는 재시도 후에도 true로 유지되므로, 실패마다 갱신되는 errorUpdatedAt으로 재실패 시 재알림
  }, [contentsQuery.isError, contentsQuery.errorUpdatedAt, refetchContents, toast]);

  const adminTeams = useMemo<TeamCardRow[]>(
    () =>
      (contentsQuery.data?.data.teams ?? []).map((team, index) => ({
        id: team.id ?? String(index),
        name: team.name ?? '',
        challenge: team.challenge ?? '',
        members: team.members ?? '',
        roles: team.roles ?? [],
        otherRoles: team.otherRoles ?? [],
        unread: team.unread ?? false,
        leaderName: team.leaderName ?? '',
        leaderRole: team.leaderRole ?? '',
        region: team.region ?? '',
        introduction: team.introduction ?? '',
        preferred: team.preferred ?? '',
        etc: team.etc ?? '',
        openRoles: (team.openRoles ?? []).map((slot) => ({
          role: slot.role ?? '',
          count: slot.count ?? 0,
        })),
      })),
    [contentsQuery.data],
  );

  const adminContests = useMemo<ContestCardRow[]>(
    () =>
      (contentsQuery.data?.data.contests ?? []).map((contest, index) => ({
        id: contest.id ?? String(index),
        title: contest.title ?? '',
        category: contest.category ?? '',
        dday: contest.dday ?? '',
        teams: contest.teams ?? '',
        unread: contest.unread ?? false,
        summary: contest.summary ?? '',
        description: contest.description ?? '',
        startDate: contest.startDate ?? '',
        endDate: contest.endDate ?? '',
        price: contest.price ?? 0,
        capacity: contest.capacity ?? 0,
        prizeAmount: contest.prizeAmount ?? null,
        targets: contest.targets ?? [],
        hashtags: contest.hashtags ?? [],
      })),
    [contentsQuery.data],
  );

  const previewTeam =
    preview?.kind === 'team' ? adminTeams.find((team) => team.id === preview.id) : undefined;
  const previewContest =
    preview?.kind === 'contest' ? adminContests.find((row) => row.id === preview.id) : undefined;

  return (
    <>
      <AdminPageTitle>콘텐츠 모니터링</AdminPageTitle>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SectionHeader>
          <AdminSectionTitle>확인해야하는 팀</AdminSectionTitle>
          {adminTeams.length < teamsTotal && teamsLimit < MAX_LIMIT ? (
            <MoreButton
              type="button"
              disabled={contentsQuery.isFetching}
              onClick={() => setTeamsLimit((limit) => Math.min(limit + PAGE_SIZE, MAX_LIMIT))}
            >
              더보기 ({adminTeams.length}/{teamsTotal}) →
            </MoreButton>
          ) : null}
        </SectionHeader>
        <CardGrid>
          {contentsQuery.isPending ? <AdminInlineNotice>불러오는 중...</AdminInlineNotice> : null}
          {adminTeams.map((team) => (
            <TeamCard
              key={team.id}
              role="button"
              tabIndex={0}
              aria-label={`${team.name} 미리보기`}
              onClick={() => setPreview({ kind: 'team', id: team.id })}
              onKeyDown={openOnKey(() => setPreview({ kind: 'team', id: team.id }))}
            >
              {teamCardContent(team)}
            </TeamCard>
          ))}
        </CardGrid>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SectionHeader>
          <AdminSectionTitle>확인해야하는 챌린지</AdminSectionTitle>
          {adminContests.length < contestsTotal && contestsLimit < MAX_LIMIT ? (
            <MoreButton
              type="button"
              disabled={contentsQuery.isFetching}
              onClick={() => setContestsLimit((limit) => Math.min(limit + PAGE_SIZE, MAX_LIMIT))}
            >
              더보기 ({adminContests.length}/{contestsTotal}) →
            </MoreButton>
          ) : null}
        </SectionHeader>
        <CardGrid>
          {contentsQuery.isPending ? <AdminInlineNotice>불러오는 중...</AdminInlineNotice> : null}
          {adminContests.map((contest) => (
            <ContestCard
              key={contest.id}
              role="button"
              tabIndex={0}
              aria-label={`${contest.title} 미리보기`}
              onClick={() => setPreview({ kind: 'contest', id: contest.id })}
              onKeyDown={openOnKey(() => setPreview({ kind: 'contest', id: contest.id }))}
            >
              {contestCardContent(contest)}
            </ContestCard>
          ))}
        </CardGrid>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <FilterBar>
          <SearchFilter
            placeholder="콘텐츠명 검색"
            label="콘텐츠명 검색"
            value={reportQuery}
            onChange={setReportQuery}
          />
          <SelectFilter
            label="종류"
            options={['전체', '챌린지', '팀 모집', '수상작', '프로필']}
            value={kind}
            onChange={setKind}
          />
        </FilterBar>
        <ReportLogTable params={reportParams} />
      </section>

      {preview &&
        typeof document !== 'undefined' &&
        createPortal(
          <Backdrop role="presentation" onMouseDown={closePreview}>
            <PreviewModal
              role="dialog"
              aria-modal="true"
              aria-labelledby="content-preview-title"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <PreviewTitle id="content-preview-title">
                {preview.kind === 'team' ? '팀 미리보기' : '챌린지 미리보기'}
              </PreviewTitle>
              {preview.kind === 'team'
                ? previewTeam
                  ? teamDetail(previewTeam)
                  : null
                : previewContest
                  ? contestDetail(previewContest)
                  : null}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <ReasonLabel htmlFor="content-reject-reason">반려 사유</ReasonLabel>
                <ReasonTextarea
                  id="content-reject-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="반려 사유를 입력해주세요 (작성자에게 알림으로 전달돼요)"
                  maxLength={500}
                  rows={3}
                />
              </div>
              <PreviewActions>
                <RejectButton type="button" onClick={closePreview}>
                  이전
                </RejectButton>
                <ApproveButton
                  type="button"
                  disabled={rejecting || !reason.trim()}
                  onClick={() =>
                    preview.kind === 'team'
                      ? rejectTeam.mutate({ id: preview.id, data: { reason: reason.trim() } })
                      : rejectChallenge.mutate({ id: preview.id, data: { reason: reason.trim() } })
                  }
                >
                  {rejecting ? '처리 중…' : '반려하기'}
                </ApproveButton>
              </PreviewActions>
            </PreviewModal>
          </Backdrop>,
          document.body,
        )}
    </>
  );
}
