'use client';
import { useState } from 'react';
import Link from 'next/link';
import styled from '@emotion/styled';
import { useQueryClient } from '@tanstack/react-query';
import { generated } from '@semochal/api-client';
import type { PersonCardModel } from './person';
import { Modal } from '@/components/common/Feedback';
import { useToast } from '@/components/common/Toast';
import { Button, Muted, Row, Stack } from '@/components/common/Primitives';
import { Dropdown } from '@/components/ui/Dropdown';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';

const MESSAGE_MAX = 200;

const Label = styled.p({ ...textStyle.h3, color: c.gray900 });
const Textarea = styled.textarea({
  width: '100%',
  height: 118,
  resize: 'none',
  border: `1px solid ${c.gray200}`,
  borderRadius: 10,
  padding: '12px 14px',
  ...textStyle.caption,
  '&:focus': { outline: `2px solid ${c.primary}`, outlineOffset: 0 },
});
const Dot = styled.span<{ used: boolean }>(({ used }) => ({
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: used ? c.gray200 : c.primary,
}));

export function ScoutModal({
  person,
  onClose,
}: {
  person: Pick<PersonCardModel, 'id'> | null;
  onClose: () => void;
}) {
  return (
    <Modal open={person !== null} onClose={onClose} title="스카우트 제안" width={520}>
      {person && <ScoutForm key={person.id} person={person} onClose={onClose} />}
    </Modal>
  );
}

function ScoutForm({
  person,
  onClose,
}: {
  person: Pick<PersonCardModel, 'id'>;
  onClose: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const managed = generated.useListManagedTeams();
  const teams = managed.data?.status === 200 ? managed.data.data : [];
  const options = teams.map((team) => ({ value: team.id ?? '', label: team.title ?? '' }));
  const [pickedTeamId, setPickedTeamId] = useState('');
  const teamId = options.some((o) => o.value === pickedTeamId)
    ? pickedTeamId
    : (options[0]?.value ?? '');
  const [message, setMessage] = useState('');
  const [confirming, setConfirming] = useState(false);

  const quotaQuery = generated.useGetTeamScoutQuota(teamId, {
    query: { enabled: Boolean(teamId) },
  });
  const quota = quotaQuery.data?.status === 200 ? quotaQuery.data.data : undefined;
  const limit = quota?.limit ?? 3;
  const remaining = quota?.remaining ?? 0;
  const invite = generated.useInviteTeam();

  const send = () => {
    if (!teamId || !person.id) return;
    invite.mutate(
      { id: teamId, data: { userId: person.id, message: message.trim() || undefined } },
      {
        onSuccess: () => {
          toast.success('스카우트 제안을 보냈어요', '수락하면 팀원으로 합류해요');
          void queryClient.invalidateQueries({
            queryKey: generated.getGetTeamScoutQuotaQueryKey(teamId),
          });
          onClose();
        },
        onError: (error) => {
          setConfirming(false);
          const status = (error as { status?: number }).status;
          if (status === 409)
            toast.error('보낼 수 없어요', '이미 지원·초대된 분이거나 횟수를 모두 썼어요');
          else if (status === 403) toast.error('팀장만 스카우트할 수 있어요');
          else toast.error('전송에 실패했어요', '잠시 후 다시 시도해주세요');
        },
      },
    );
  };

  if (managed.isSuccess && options.length === 0) {
    return (
      <Stack gap={16}>
        <Muted>스카우트는 내가 팀장인 팀으로만 보낼 수 있어요.</Muted>
        <Row style={{ justifyContent: 'flex-end' }}>
          <Link href="/teams/new">
            <Button as="span">팀 모집글 만들기</Button>
          </Link>
        </Row>
      </Stack>
    );
  }

  return (
    <Stack gap={24}>
      <Stack gap={12}>
        <Label>스카우트할 팀</Label>
        <Dropdown
          aria-label="스카우트할 팀"
          value={teamId}
          onChange={setPickedTeamId}
          options={options}
        />
        <Row gap={8}>
          <Muted style={{ fontSize: 12 }}>남은 스카우트</Muted>
          <Row gap={5}>
            {Array.from({ length: limit }, (_, i) => (
              <Dot key={i} used={i >= remaining} />
            ))}
            <strong style={{ ...textStyle.label, color: c.gray900 }}>
              {remaining} / {limit}
            </strong>
          </Row>
        </Row>
      </Stack>
      <Stack gap={12}>
        <Label>제안 메시지</Label>
        <div style={{ position: 'relative' }}>
          <Textarea
            aria-label="제안 메시지"
            maxLength={MESSAGE_MAX}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <span
            style={{
              position: 'absolute',
              right: 14,
              bottom: 12,
              ...textStyle.finePrint,
              color: c.gray500,
            }}
          >
            {message.length}/{MESSAGE_MAX}
          </span>
        </div>
      </Stack>
      <Row gap={8}>
        <Button tone="plain" style={{ flex: 1 }} onClick={onClose}>
          닫기
        </Button>
        <Button
          style={{ flex: 1 }}
          disabled={!teamId || remaining <= 0}
          onClick={() => setConfirming(true)}
        >
          스카우트
        </Button>
      </Row>
      <Modal open={confirming} onClose={() => setConfirming(false)} title="전송할까요?">
        <Muted>전송하면 횟수가 1회 차감돼요. 전송 후에는 취소할 수 없어요.</Muted>
        <Row gap={8}>
          <Button tone="plain" style={{ flex: 1 }} onClick={() => setConfirming(false)}>
            닫기
          </Button>
          <Button style={{ flex: 1 }} disabled={invite.isPending} onClick={send}>
            전송
          </Button>
        </Row>
      </Modal>
    </Stack>
  );
}
