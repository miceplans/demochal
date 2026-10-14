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
  width: 'min(100%, 360px)',
  padding: 24,
  borderRadius: 12,
  background: c.white,
  boxShadow: '0 20px 48px rgba(17, 24, 39, .22)',
});
const PreviewTitle = styled.h2({ margin: 0, ...textStyle.h2_2, color: c.gray900 });
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
};

type ContestCardRow = {
  id: string;
  title: string;
  category: string;
  dday: string;
  teams: string;
  unread: boolean;
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

  const onRejected = () => {
    toast.success('반려했어요.');
    setPreview(null);
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

  useEffect(() => {
    if (!preview) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setPreview(null);
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
          <Backdrop role="presentation" onMouseDown={() => setPreview(null)}>
            <PreviewModal
              role="dialog"
              aria-modal="true"
              aria-labelledby="content-preview-title"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <PreviewTitle id="content-preview-title">
                {preview.kind === 'team' ? '팀 미리보기' : '챌린지 미리보기'}
              </PreviewTitle>
              {preview.kind === 'team' ? (
                previewTeam ? (
                  <TeamCard as="div" style={{ flex: 'none', cursor: 'default' }}>
                    {teamCardContent(previewTeam)}
                  </TeamCard>
                ) : null
              ) : previewContest ? (
                <ContestCard as="div" style={{ flex: 'none', cursor: 'default' }}>
                  {contestCardContent(previewContest)}
                </ContestCard>
              ) : null}
              <PreviewActions>
                <RejectButton type="button" onClick={() => setPreview(null)}>
                  이전
                </RejectButton>
                <ApproveButton
                  type="button"
                  disabled={rejecting}
                  onClick={() =>
                    preview.kind === 'team'
                      ? rejectTeam.mutate({ id: preview.id })
                      : rejectChallenge.mutate({ id: preview.id })
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
