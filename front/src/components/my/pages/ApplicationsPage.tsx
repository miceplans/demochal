'use client';
import { LoadingState } from '@/components/common/LoadingState';
import Link from 'next/link';
import styled from '@emotion/styled';
import { MyShell } from '@/components/common/UserShell';
import { Stack, Title, Muted, Tag } from '@/components/common/Primitives';
import { generated } from '@semochal/api-client';
import { acceptedChatLink, challengeResultTag, teamResultTag } from '../Mypage';
import { InlineRow, Table } from '../styles';

export function ApplicationsPage() {
  const challengeQuery = generated.useListMyApplications();
  const teamQuery = generated.useListMyTeamApplications();
  const challengeApps = challengeQuery.data?.status === 200 ? challengeQuery.data.data : [];
  const teamApps = teamQuery.data?.status === 200 ? teamQuery.data.data : [];
  return (
    <MyShell title="지원현황">
      <Stack gap={40}>
        <section>
          <TitleSpaced $mb={20}>챌린지 지원 현황</TitleSpaced>
          {challengeQuery.isPending ? (
            <LoadingState label="불러오는 중이에요." />
          ) : challengeQuery.isError ? (
            <Muted>지원 내역을 불러오지 못했어요. 새로고침해주세요.</Muted>
          ) : challengeApps.length === 0 ? (
            <Muted>아직 지원한 챌린지가 없어요.</Muted>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>챌린지</th>
                  <th>협회</th>
                  <th>지원서</th>
                  <th>결과</th>
                </tr>
              </thead>
              <tbody>
                {challengeApps.map((row) => {
                  const result = challengeResultTag(row.status);
                  return (
                    <tr key={row.id}>
                      <td>
                        {row.challengeId ? (
                          <Link href={`/contests/${row.challengeId}`}>
                            {row.challengeTitle ?? '챌린지'}
                          </Link>
                        ) : (
                          (row.challengeTitle ?? '챌린지')
                        )}
                      </td>
                      <td>{row.businessName ?? '-'}</td>
                      <td>
                        <Link href={`/my/applications/${row.id}`}>지원서 보기</Link>
                      </td>
                      <td>
                        <Tag tone={result.tone}>{result.label}</Tag>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </section>
        <section>
          <TitleSpaced $mb={20}>팀 지원현황</TitleSpaced>
          {teamQuery.isPending ? (
            <LoadingState label="불러오는 중이에요." />
          ) : teamQuery.isError ? (
            <Muted>지원 내역을 불러오지 못했어요. 새로고침해주세요.</Muted>
          ) : teamApps.length === 0 ? (
            <Muted>아직 지원한 팀이 없어요.</Muted>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>챌린지</th>
                  <th>팀</th>
                  <th>결과</th>
                </tr>
              </thead>
              <tbody>
                {teamApps.map((row) => {
                  const result = teamResultTag(row.status);
                  const chatLink = acceptedChatLink(row.status, row.chatLink);
                  return (
                    <tr key={row.id}>
                      <td>
                        {row.teamId ? (
                          <Link href={`/teams/${row.teamId}`}>
                            {row.challengeTitle ?? '챌린지'}
                          </Link>
                        ) : (
                          (row.challengeTitle ?? '챌린지')
                        )}
                      </td>
                      <td>
                        {row.teamId ? (
                          <Link href={`/teams/${row.teamId}`}>{row.teamTitle ?? '팀'}</Link>
                        ) : (
                          (row.teamTitle ?? '팀')
                        )}
                      </td>
                      <td>
                        <InlineRow gap={8}>
                          <Tag tone={result.tone}>{result.label}</Tag>
                          {chatLink && (
                            <a href={chatLink} target="_blank" rel="noopener noreferrer">
                              채팅방 링크
                            </a>
                          )}
                        </InlineRow>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </section>
      </Stack>
    </MyShell>
  );
}

// Styles are kept together at the bottom so page behavior and layout definitions remain separate.
const TitleSpaced = styled(Title)<{ $mb: number }>(({ $mb }) => ({ marginBottom: $mb }));
