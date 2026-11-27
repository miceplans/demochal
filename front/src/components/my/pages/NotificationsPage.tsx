'use client';
import { useState } from 'react';
import { LoadingState } from '@/components/common/LoadingState';
import { useRouter } from 'next/navigation';
import styled from '@emotion/styled';
import { useQueryClient } from '@tanstack/react-query';
import { UserShell, Content } from '@/components/common/UserShell';
import { Button, Row, Stack, Heading, Muted } from '@/components/common/Primitives';
import { useToast } from '@/components/common/Toast';
import { colors as c } from '@/styles/design';
import { generated } from '@semochal/api-client';
import {
  acceptedChatLink,
  describeNotification,
  notificationCategory,
  notificationTabs,
  timeAgo,
} from '../Mypage';

export function NotificationsPage() {
  const [tab, setTab] = useState<string>('전체');
  // 상대 시간 기준 시각은 마운트 시 한 번만 잡는다(렌더 중 Date.now() 호출 금지).
  const [now] = useState(() => Date.now());
  const queryClient = useQueryClient();
  const router = useRouter();
  const toast = useToast();
  const notificationsQuery = generated.useListMyNotifications();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: generated.getListMyNotificationsQueryKey() });
  const markRead = generated.useMarkNotificationRead({ mutation: { onSuccess: invalidate } });
  // 팀 초대 알림의 수락/거절 — 본인이 받은 invited 멤버 행을 결정한다(서버 권한과 동일).
  const [inviteResponses, setInviteResponses] = useState<Record<string, 'accepted' | 'rejected'>>(
    {},
  );
  const respondInvite = generated.useUpdateTeamMember({
    mutation: {
      onSuccess: (_data, variables) => {
        setInviteResponses((prev) => ({ ...prev, [variables.memberId]: variables.data.status }));
        invalidate();
      },
      onError: () => toast.error('응답에 실패했어요', '잠시 후 다시 시도해주세요'),
    },
  });
  const all = notificationsQuery.data?.data ?? [];
  const items = all.filter((x) => tab === '전체' || notificationCategory[x.type ?? ''] === tab);
  const openItem = (id?: string, readAt?: string | null, href?: string) => {
    if (id && !readAt) markRead.mutate({ id });
    if (href) router.push(href);
  };
  return (
    <UserShell title="알림">
      <Content size="medium">
        <Stack gap={24}>
          <NotificationTitle>알림</NotificationTitle>
          <NotificationTabs>
            {notificationTabs.map((x) => (
              <NotificationTabButton
                key={x}
                type="button"
                aria-pressed={x === tab}
                onClick={() => setTab(x)}
              >
                {x}
              </NotificationTabButton>
            ))}
          </NotificationTabs>
          <NotificationList>
            {items.map((item) => {
              const payload = (item.payload ?? {}) as Record<string, unknown>;
              const teamId = typeof payload.teamId === 'string' ? payload.teamId : undefined;
              const challengeId =
                typeof payload.challengeId === 'string' ? payload.challengeId : undefined;
              const href = teamId
                ? `/teams/${teamId}`
                : challengeId
                  ? `/contests/${challengeId}`
                  : undefined;
              const meta = [
                typeof payload.title === 'string' ? payload.title : '',
                timeAgo(item.createdAt, now),
              ]
                .filter(Boolean)
                .join(' · ');
              const inviteMemberId =
                typeof payload.invitedUserId === 'string' && typeof payload.memberId === 'string'
                  ? payload.memberId
                  : undefined;
              const inviteResponse = inviteMemberId ? inviteResponses[inviteMemberId] : undefined;
              // 합격 알림에 첨부된 채팅방 링크 — http(s)만 노출해 잘못된 스킴이 href로 나가지 않게 한다.
              const chatLink =
                item.type === 'team_matching'
                  ? acceptedChatLink(
                      typeof payload.status === 'string' ? payload.status : undefined,
                      payload.chatLink,
                    )
                  : undefined;
              return (
                <NotificationItem
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  data-unread={!item.readAt || undefined}
                  onClick={() => openItem(item.id, item.readAt, href)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') openItem(item.id, item.readAt, href);
                  }}
                >
                  <NotificationDot aria-hidden />
                  <NotificationBody>
                    <NotificationHeading>
                      {describeNotification(item.type ?? '', payload)}
                    </NotificationHeading>
                    {inviteMemberId && teamId && !inviteResponse && (
                      <InviteActions gap={8}>
                        <Button
                          small
                          disabled={respondInvite.isPending}
                          onClick={(e) => {
                            e.stopPropagation();
                            respondInvite.mutate({
                              id: teamId,
                              memberId: inviteMemberId,
                              data: { status: 'accepted' },
                            });
                          }}
                        >
                          수락
                        </Button>
                        <Button
                          small
                          tone="plain"
                          disabled={respondInvite.isPending}
                          onClick={(e) => {
                            e.stopPropagation();
                            respondInvite.mutate({
                              id: teamId,
                              memberId: inviteMemberId,
                              data: { status: 'rejected' },
                            });
                          }}
                        >
                          거절
                        </Button>
                      </InviteActions>
                    )}
                    {inviteResponse && (
                      <MutedSpaced $mt={8}>
                        {inviteResponse === 'accepted' ? '초대를 수락했어요' : '초대를 거절했어요'}
                      </MutedSpaced>
                    )}
                    {(item.type === 'content.rejected' || item.type === 'refund.result') &&
                      typeof payload.reason === 'string' && (
                        <NotificationDetail>반려 사유: {payload.reason}</NotificationDetail>
                      )}
                    {chatLink && (
                      <NotificationDetail>
                        채팅방 링크:{' '}
                        <a
                          href={chatLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            // 행의 Enter 핸들러(읽음 처리·페이지 이동)가 먼저 실행되지 않게 버블링을 막는다.
                            if (e.key === 'Enter') e.stopPropagation();
                          }}
                        >
                          {chatLink}
                        </a>
                      </NotificationDetail>
                    )}
                    <NotificationMeta>{meta}</NotificationMeta>
                  </NotificationBody>
                </NotificationItem>
              );
            })}
          </NotificationList>
          {notificationsQuery.isPending && <LoadingState label="알림을 불러오는 중이에요." />}
          {notificationsQuery.isError && <Muted>알림을 불러오지 못했어요.</Muted>}
        </Stack>
      </Content>
    </UserShell>
  );
}

// Styles are kept together at the bottom so page behavior and layout definitions remain separate.
const MutedSpaced = styled(Muted)<{ $mt: number }>(({ $mt }) => ({ marginTop: $mt }));
const NotificationTitle = styled.h1({
  margin: 0,
  textAlign: 'center',
  fontSize: 22,
  fontWeight: 700,
  color: c.gray900,
});
const NotificationTabs = styled.div({ display: 'flex', borderBottom: `0.5px solid ${c.gray100}` });
const NotificationTabButton = styled.button({
  flex: 1,
  minWidth: 0,
  height: 40,
  border: 0,
  borderBottom: '0.5px solid transparent',
  background: 'transparent',
  fontFamily: 'inherit',
  fontSize: 15,
  color: c.gray700,
  cursor: 'pointer',
  '&[aria-pressed="true"]': {
    borderBottomColor: c.primary,
    color: c.primary,
    fontSize: 14,
    fontWeight: 600,
  },
});
const NotificationList = styled.div({ display: 'flex', flexDirection: 'column' });
const NotificationItem = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '16px 0',
  borderBottom: `0.5px solid ${c.gray100}`,
  cursor: 'pointer',
  '&:last-of-type': { borderBottom: 0 },
  '&:hover': { background: c.gray50 },
  '&[data-unread] h2': { fontWeight: 600, color: c.gray900 },
  '&:not([data-unread]) h2': { fontWeight: 400, color: c.gray500 },
});
const NotificationDot = styled.span({
  flexShrink: 0,
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: c.lightBlue,
  '[data-unread] > &': { background: c.primary },
});
const NotificationBody = styled.div({
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});
const NotificationHeading = styled(Heading)({ fontSize: 14 });
const InviteActions = styled(Row)({ marginTop: 8 });
const NotificationDetail = styled(Muted)({ fontSize: 13 });
const NotificationMeta = styled(Muted)({ fontSize: 12 });
