'use client';
import { useState } from 'react';
import { LoadingState } from '@/components/common/LoadingState';
import styled from '@emotion/styled';
import { useQueryClient } from '@tanstack/react-query';
import { MyShell } from '@/components/common/UserShell';
import {
  Button,
  Row,
  Stack,
  Title,
  Heading,
  Muted,
  Tag,
  Input,
} from '@/components/common/Primitives';
import { Dropdown } from '@/components/ui/Dropdown';
import { Modal } from '@/components/common/Feedback';
import { useToast } from '@/components/common/Toast';
import { colors as c, mobile } from '@/styles/design';
import { generated } from '@semochal/api-client';
import { applicantResultOptions, resultFromStatus, type ApplicantResult } from '../Mypage';
import { EndRow, InlineRow, Table } from '../styles';

export function TeamApplicantsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const managedQuery = generated.useListManagedTeams();
  const teams = managedQuery.data?.status === 200 ? managedQuery.data.data : [];
  // 서버에서 받은 status를 기본값으로 하되, 드롭다운에서 바꾼 선택은 로컬에서 덮어쓴다.
  const [overrides, setOverrides] = useState<Record<string, ApplicantResult>>({});
  const [sendTargetId, setSendTargetId] = useState<string | null>(null);
  const [link, setLink] = useState('');
  // 전송에 실패한 지원자 id. 목록에 '전송 실패'로 표시하고 재전송 대상으로 남겨둔다.
  const [failedIds, setFailedIds] = useState<string[]>([]);
  const updateMember = generated.useUpdateTeamMember();
  const sendTarget = teams.find((team) => team.id === sendTargetId);

  const resultOf = (memberId: string | undefined, status?: string): ApplicantResult =>
    (memberId ? overrides[memberId] : undefined) ?? resultFromStatus(status);

  // 이번에 드롭다운으로 바꾼 지원자만 전송한다(이미 결정된 지원자에게 알림을 다시 보내지 않는다).
  const changedMembers = (team: (typeof teams)[number]) =>
    (team.members ?? []).filter((member) => {
      const override = member.id ? overrides[member.id] : undefined;
      return (
        override !== undefined &&
        override !== '미정' &&
        override !== resultFromStatus(member.status)
      );
    });
  const closeSendModal = () => {
    // 다른 팀 모달로 링크가 넘어가지 않게 닫을 때마다 초기화한다.
    setSendTargetId(null);
    setLink('');
  };
  const refreshTeams = () => {
    void queryClient.invalidateQueries({ queryKey: generated.getListManagedTeamsQueryKey() });
    void queryClient.invalidateQueries({
      queryKey: generated.getListMyTeamApplicationsQueryKey(),
    });
  };

  const send = async (team: (typeof teams)[number]) => {
    const decided = changedMembers(team);
    if (decided.length === 0) {
      toast.error('전송할 결과가 없어요', '지원자의 결과를 먼저 선택해주세요');
      return;
    }
    // TODO: 여러 지원자 결과를 한 트랜잭션으로 저장하는 일괄 API가 없어 지원자별로 보낸다.
    // 부분 실패 시 성공한 건은 반영된 상태로 두고 실패한 지원자만 다시 보낼 수 있게 한다.
    // https://orm.drizzle.team/docs/transactions
    const results = await Promise.allSettled(
      decided.map((member) => {
        const result = resultOf(member.id, member.status);
        return updateMember.mutateAsync({
          id: team.id ?? '',
          memberId: member.id ?? '',
          data: {
            status: result === '합격' ? 'accepted' : 'rejected',
            // 합격자에게만 채팅방 링크를 저장해 알림으로 함께 본다.
            ...(result === '합격' && link.trim() ? { chatLink: link.trim() } : {}),
          },
        });
      }),
    );
    const succeededIds = decided
      .filter((_, i) => results[i]?.status === 'fulfilled')
      .map((member) => member.id);
    const failedMemberIds = decided
      .filter((_, i) => results[i]?.status === 'rejected')
      .map((member) => member.id)
      .filter((id): id is string => Boolean(id));
    setOverrides((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([id]) => !succeededIds.includes(id))),
    );
    // 성공한 지원자는 실패 목록에서 빼고, 이번에 실패한 지원자만 표시한다.
    setFailedIds((prev) => [
      ...prev.filter((id) => !succeededIds.includes(id) && !failedMemberIds.includes(id)),
      ...failedMemberIds,
    ]);
    refreshTeams();
    const failed = results.length - succeededIds.length;
    if (failed > 0) {
      toast.error(
        `${failed}명에게 결과를 전송하지 못했어요`,
        succeededIds.length > 0
          ? `${succeededIds.length}명은 전송됐어요. 실패한 지원자만 다시 시도해주세요`
          : '다시 시도해주세요',
      );
      return;
    }
    closeSendModal();
    toast.success('결과를 전송했어요', '지원자에게 알림으로 알려드릴게요');
  };
  const sendNeedsLink =
    sendTarget !== undefined &&
    changedMembers(sendTarget).some((member) => resultOf(member.id, member.status) === '합격');
  return (
    <MyShell title="팀 지원현황">
      <Stack gap={40}>
        {managedQuery.isPending ? (
          <LoadingState label="불러오는 중이에요." />
        ) : managedQuery.isError ? (
          <Muted>팀 지원 현황을 불러오지 못했어요. 새로고침해주세요.</Muted>
        ) : teams.length === 0 ? (
          <Muted>아직 리더로 있는 팀이 없어요.</Muted>
        ) : (
          teams.map((team) => (
            <TeamApplicantsSection key={team.id}>
              <ApplicantThumbnail>
                {(team.challengeThumbnailUrl ?? team.challengePosterUrl) && (
                  <img src={team.challengeThumbnailUrl ?? team.challengePosterUrl ?? ''} alt="" />
                )}
              </ApplicantThumbnail>
              <ApplicantMeta>
                <Title>{team.challengeTitle ?? team.title}</Title>
                <Muted>{team.businessName ?? '-'}</Muted>
              </ApplicantMeta>
              <ApplicantHeader>
                <Heading>팀 지원현황</Heading>
                <Button small onClick={() => setSendTargetId(team.id ?? null)}>
                  결과 전송하기
                </Button>
              </ApplicantHeader>
              {(team.members ?? []).length === 0 ? (
                <Muted>아직 지원자가 없어요.</Muted>
              ) : (
                <ApplicantTable>
                  <colgroup>
                    <ApplicantColumn $width="34%" />
                    <ApplicantColumn $width="36%" />
                    <ApplicantColumn $width="30%" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>이름</th>
                      <th>지원 역할</th>
                      <th>결과</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(team.members ?? []).map((member) => (
                      <tr key={member.id}>
                        <td>{member.name ?? '지원자'}</td>
                        <td>
                          {member.role ? <Tag tone="blue">{member.role}</Tag> : <Muted>-</Muted>}
                        </td>
                        <td>
                          <InlineRow gap={6}>
                            <Dropdown
                              aria-label={`${member.name ?? '지원자'} 결과`}
                              size="S"
                              value={resultOf(member.id, member.status)}
                              onChange={(x) => {
                                if (!member.id) return;
                                // 결과를 다시 선택하면 실패 표시를 지워 재전송 대상에서 빠진다.
                                setOverrides((prev) => ({
                                  ...prev,
                                  [member.id as string]: x as ApplicantResult,
                                }));
                                setFailedIds((prev) => prev.filter((id) => id !== member.id));
                              }}
                              options={applicantResultOptions}
                            />
                            {member.id && failedIds.includes(member.id) && (
                              <Tag tone="red">전송 실패</Tag>
                            )}
                          </InlineRow>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </ApplicantTable>
              )}
            </TeamApplicantsSection>
          ))
        )}
      </Stack>
      <Modal open={sendTarget !== undefined} onClose={closeSendModal} title="결과 전송하기">
        <WarningText>*이 활동은 되돌릴 수 없어요</WarningText>
        <SmallText>합격자들에게 전송할 채팅방 링크를 첨부해주세요.</SmallText>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (sendTarget) void send(sendTarget);
          }}
        >
          <Input
            aria-label="채팅방 링크"
            placeholder="링크"
            type="url"
            required={sendNeedsLink}
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
          <EndRow $mt={16}>
            <Button type="button" small tone="plain" onClick={closeSendModal}>
              취소
            </Button>
            <Button type="submit" small disabled={updateMember.isPending}>
              확인
            </Button>
          </EndRow>
        </form>
      </Modal>
    </MyShell>
  );
}

// Styles are kept together at the bottom so page behavior and layout definitions remain separate.
const ApplicantThumbnail = styled.div({
  height: 221,
  overflow: 'hidden',
  borderRadius: 19,
  background: c.gray100,
  '& img': { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  [mobile]: { height: 160 },
});
const TeamApplicantsSection = styled.section({ display: 'flex', flexDirection: 'column', gap: 16 });
const ApplicantMeta = styled.div({ display: 'flex', flexDirection: 'column', gap: 8 });
const ApplicantHeader = styled(Row)({ justifyContent: 'space-between', marginTop: 8 });
const ApplicantTable = styled(Table)({ tableLayout: 'fixed' });
const ApplicantColumn = styled.col<{ $width: string }>(({ $width }) => ({ width: $width }));
const WarningText = styled(Muted)({ color: c.red });
const SmallText = styled.p({ fontSize: 13 });
