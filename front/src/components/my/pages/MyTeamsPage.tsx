'use client';
import { LoadingState } from '@/components/common/LoadingState';
import styled from '@emotion/styled';
import { MyShell } from '@/components/common/UserShell';
import { DesktopOnly, Row, Stack, Title, Muted, Tag } from '@/components/common/Primitives';
import { TeamCard, TeamGrid } from '@/components/teams/TeamCard';
import { toTeamCard } from '@/components/teams/team-model';
import { generated } from '@semochal/api-client';

export function MyTeamsPage() {
  const managedQuery = generated.useListManagedTeams();
  const teams = managedQuery.data?.status === 200 ? managedQuery.data.data : [];
  return (
    <MyShell title="내 팀">
      <Stack>
        <DesktopOnly>
          <Title>내 팀</Title>
        </DesktopOnly>
        {managedQuery.isPending ? (
          <LoadingState label="불러오는 중이에요." />
        ) : managedQuery.isError ? (
          <Muted>팀 목록을 불러오지 못했어요. 새로고침해주세요.</Muted>
        ) : teams.length === 0 ? (
          <Muted>아직 내가 만든 팀이 없어요.</Muted>
        ) : (
          <TeamGrid>
            {teams.map((team) => {
              // 지원현황 표에 보이는 전체 지원자 수 — 합격/불합격 처리된 지원자도 포함한다.
              const applicants = (team.members ?? []).length;
              return (
                <Stack key={team.id} gap={8}>
                  <TeamRow>
                    <Muted>{team.challengeTitle ?? '챌린지'}</Muted>
                    <TeamActions gap={8}>
                      <Tag tone={team.status === 'closed' ? 'gray' : 'green'}>
                        {team.status === 'closed' ? '모집마감' : '모집중'}
                      </Tag>
                    </TeamActions>
                  </TeamRow>
                  <TeamCard
                    team={toTeamCard(team)}
                    manage={{ href: '/my/teams/public-data', applicants }}
                  />
                </Stack>
              );
            })}
          </TeamGrid>
        )}
      </Stack>
    </MyShell>
  );
}

// Styles are kept together at the bottom so page behavior and layout definitions remain separate.
const TeamRow = styled(Row)({ justifyContent: 'space-between', alignItems: 'center' });
const TeamActions = styled(Row)({ flexShrink: 0, alignItems: 'center' });
