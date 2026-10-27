'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import styled from '@emotion/styled';
import { generated } from '@semochal/api-client';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { LOCAL_ERROR_TOAST_META, useToast } from '@/components/common/Toast';
import { AdminInlineNotice, AdminPageTitle } from './parts';
import { useAdminHref } from './AdminShell';
import {
  contestCardContent,
  MAX_LIMIT,
  openOnKey,
  TeamCard,
  teamCardContent,
  ContestCard,
  type ContestCardRow,
  type TeamCardRow,
} from './contentCards';

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

// 콘텐츠 모니터링 레일의 카드 4개 기준과 맞추고, 뷰포트가 좁아지면 3→2→1열로 줄인다.
const Grid = styled.div({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
  gap: 16,
});

const HeaderRow = styled.div({
  display: 'flex',
  alignItems: 'baseline',
  gap: 12,
});

const CountCaption = styled.span({ ...textStyle.caption, color: c.gray500 });

const Body = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
});

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

const useContentsToast = (isError: boolean, errorUpdatedAt: number) => {
  const toast = useToast();
  useEffect(() => {
    if (!isError) return;
    toast.error('콘텐츠를 불러올 수 없어요. 잠시 후 다시 시도해주세요.');
    // isError는 재시도 후에도 true로 유지되므로, 실패마다 갱신되는 errorUpdatedAt으로 재실패 시 재알림
  }, [isError, errorUpdatedAt, toast]);
};

/** '/contents'의 '확인해야하는 팀' 전체 목록 — 더보기로 진입한다. */
export function AdminTeamListScreen() {
  const hrefOf = useAdminHref();
  const router = useRouter();
  const contentsQuery = generated.useListAdminContents(
    // 팀 목록만 필요하지만 서버 limit 최소치가 1이라 챌린지는 1개만 덧붙여 조회한다.
    { teamsLimit: MAX_LIMIT, contestsLimit: 1 },
    { query: { meta: LOCAL_ERROR_TOAST_META } },
  );
  useContentsToast(contentsQuery.isError, contentsQuery.errorUpdatedAt);

  const teams = useMemo<TeamCardRow[]>(
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
  const teamsTotal = contentsQuery.data?.data.teamsTotal ?? teams.length;

  return (
    <Body>
      <BackRow />
      <HeaderRow>
        <AdminPageTitle>확인해야하는 팀</AdminPageTitle>
        <CountCaption>총 {teamsTotal}팀</CountCaption>
      </HeaderRow>
      {contentsQuery.isPending ? <AdminInlineNotice>불러오는 중...</AdminInlineNotice> : null}
      {!contentsQuery.isPending && teams.length === 0 ? (
        <AdminInlineNotice>확인할 팀이 없어요.</AdminInlineNotice>
      ) : null}
      {teamsTotal > MAX_LIMIT ? (
        <CountCaption>한 번에 최대 {MAX_LIMIT}개까지 표시돼요.</CountCaption>
      ) : null}
      <Grid>
        {teams.map((team) => (
          <TeamCard
            key={team.id}
            role="button"
            tabIndex={0}
            aria-label={`${team.name} 상세 보기`}
            onClick={() => router.push(hrefOf(`/contents/teams/${team.id}`))}
            onKeyDown={openOnKey(() => router.push(hrefOf(`/contents/teams/${team.id}`)))}
          >
            {teamCardContent(team)}
          </TeamCard>
        ))}
      </Grid>
    </Body>
  );
}

/** '/contents'의 '확인해야하는 챌린지' 전체 목록 — 더보기로 진입한다. */
export function AdminContestListScreen() {
  const hrefOf = useAdminHref();
  const router = useRouter();
  const contentsQuery = generated.useListAdminContents(
    { teamsLimit: 1, contestsLimit: MAX_LIMIT },
    { query: { meta: LOCAL_ERROR_TOAST_META } },
  );
  useContentsToast(contentsQuery.isError, contentsQuery.errorUpdatedAt);

  const contests = useMemo<ContestCardRow[]>(
    () =>
      (contentsQuery.data?.data.contests ?? []).map((contest, index) => ({
        id: contest.id ?? String(index),
        title: contest.title ?? '',
        category: contest.category ?? '',
        posterUrl: contest.posterUrl ?? null,
        dday: contest.dday ?? '',
        teams: contest.teams ?? '',
        unread: contest.unread ?? false,
      })),
    [contentsQuery.data],
  );
  const contestsTotal = contentsQuery.data?.data.contestsTotal ?? contests.length;

  return (
    <Body>
      <BackRow />
      <HeaderRow>
        <AdminPageTitle>확인해야하는 챌린지</AdminPageTitle>
        <CountCaption>총 {contestsTotal}개</CountCaption>
      </HeaderRow>
      {contentsQuery.isPending ? <AdminInlineNotice>불러오는 중...</AdminInlineNotice> : null}
      {!contentsQuery.isPending && contests.length === 0 ? (
        <AdminInlineNotice>확인할 챌린지가 없어요.</AdminInlineNotice>
      ) : null}
      {contestsTotal > MAX_LIMIT ? (
        <CountCaption>한 번에 최대 {MAX_LIMIT}개까지 표시돼요.</CountCaption>
      ) : null}
      <Grid>
        {contests.map((contest) => (
          <ContestCard
            key={contest.id}
            role="button"
            tabIndex={0}
            aria-label={`${contest.title} 상세 보기`}
            onClick={() => router.push(hrefOf(`/contents/challenges/${contest.id}`))}
            onKeyDown={openOnKey(() => router.push(hrefOf(`/contents/challenges/${contest.id}`)))}
          >
            {contestCardContent(contest)}
          </ContestCard>
        ))}
      </Grid>
    </Body>
  );
}
