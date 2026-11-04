'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import styled from '@emotion/styled';
import { generated } from '@semochal/api-client';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { LOCAL_ERROR_TOAST_META, useToast } from '@/components/common/Toast';
import {
  AdminInlineNotice,
  AdminPageTitle,
  AdminSectionTitle,
  FilterBar,
  SearchFilter,
  SelectFilter,
  SectionHeader,
} from './parts';
import { useAdminHref } from './AdminShell';
import { ReportLogTable } from './ReportLogTable';
import { ScrollRail } from '@/components/ui/ScrollRail';
import {
  contestCardContent,
  openOnKey,
  PAGE_SIZE,
  TeamCard,
  teamCardContent,
  ContestCard,
  type ContestCardRow,
  type TeamCardRow,
} from './contentCards';

const CardGrid = styled.div({
  display: 'flex',
  gap: 16,
  flexWrap: 'nowrap',
  overflowX: 'auto',
});
const RailCard = styled(TeamCard)({ flex: '0 0 calc((100% - 48px) / 4)' });
const RailContestCard = styled(ContestCard)({ flex: '0 0 calc((100% - 48px) / 4)' });
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

const kindOptionToTargetType: Record<string, 'challenge' | 'team' | 'award' | 'user'> = {
  챌린지: 'challenge',
  '팀 모집': 'team',
  수상작: 'award',
  프로필: 'user',
};

export function AdminContentsScreen() {
  const [reportQuery, setReportQuery] = useState('');
  const [kind, setKind] = useState('');
  const contentsQuery = generated.useListAdminContents(
    { teamsLimit: PAGE_SIZE, contestsLimit: PAGE_SIZE },
    { query: { meta: LOCAL_ERROR_TOAST_META } },
  );
  const teamsTotal = contentsQuery.data?.data.teamsTotal ?? 0;
  const contestsTotal = contentsQuery.data?.data.contestsTotal ?? 0;
  const reportParams = useMemo(
    () => ({ q: reportQuery || undefined, targetType: kindOptionToTargetType[kind] }),
    [reportQuery, kind],
  );
  const toast = useToast();
  const router = useRouter();
  const hrefOf = useAdminHref();

  useEffect(() => {
    if (!contentsQuery.isError) return;
    toast.error('콘텐츠를 불러올 수 없어요. 잠시 후 다시 시도해주세요.');
    // isError는 재시도 후에도 true로 유지되므로, 실패마다 갱신되는 errorUpdatedAt으로 재실패 시 재알림
  }, [contentsQuery.isError, contentsQuery.errorUpdatedAt, toast]);

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
        posterUrl: contest.posterUrl ?? null,
        dday: contest.dday ?? '',
        teams: contest.teams ?? '',
        unread: contest.unread ?? false,
      })),
    [contentsQuery.data],
  );

  return (
    <>
      <AdminPageTitle>콘텐츠 모니터링</AdminPageTitle>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SectionHeader>
          <AdminSectionTitle>확인해야하는 팀</AdminSectionTitle>
          {adminTeams.length < teamsTotal ? (
            <MoreButton type="button" onClick={() => router.push(hrefOf('/contents/teams'))}>
              더보기 ({adminTeams.length}/{teamsTotal}) →
            </MoreButton>
          ) : null}
        </SectionHeader>
        <ScrollRail as={CardGrid}>
          {contentsQuery.isPending ? <AdminInlineNotice>불러오는 중...</AdminInlineNotice> : null}
          {adminTeams.map((team) => (
            <RailCard
              key={team.id}
              role="button"
              tabIndex={0}
              aria-label={`${team.name} 상세 보기`}
              onClick={() => router.push(hrefOf(`/contents/teams/${team.id}`))}
              onKeyDown={openOnKey(() => router.push(hrefOf(`/contents/teams/${team.id}`)))}
            >
              {teamCardContent(team)}
            </RailCard>
          ))}
        </ScrollRail>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SectionHeader>
          <AdminSectionTitle>확인해야하는 챌린지</AdminSectionTitle>
          {adminContests.length < contestsTotal ? (
            <MoreButton type="button" onClick={() => router.push(hrefOf('/contents/challenges'))}>
              더보기 ({adminContests.length}/{contestsTotal}) →
            </MoreButton>
          ) : null}
        </SectionHeader>
        <ScrollRail as={CardGrid}>
          {contentsQuery.isPending ? <AdminInlineNotice>불러오는 중...</AdminInlineNotice> : null}
          {adminContests.map((contest) => (
            <RailContestCard
              key={contest.id}
              role="button"
              tabIndex={0}
              aria-label={`${contest.title} 상세 보기`}
              onClick={() => router.push(hrefOf(`/contents/challenges/${contest.id}`))}
              onKeyDown={openOnKey(() => router.push(hrefOf(`/contents/challenges/${contest.id}`)))}
            >
              {contestCardContent(contest)}
            </RailContestCard>
          ))}
        </ScrollRail>
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
    </>
  );
}
