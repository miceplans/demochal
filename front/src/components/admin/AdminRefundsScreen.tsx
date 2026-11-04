'use client';

import { useState } from 'react';
import styled from '@emotion/styled';
import { useQueryClient } from '@tanstack/react-query';
import { generated } from '@semochal/api-client';
import { useToast } from '@/components/common/Toast';
import { apiErrorMessage } from '@/lib/api-error';
import { won } from '@/data/biz-design';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { AdminPageTitle, ApproveButton, RejectButton } from './parts';

type AdminRefundRequest = Awaited<
  ReturnType<typeof generated.listAdminRefundRequests>
>['data'][number];

const tabs = [
  ['requested', '대기'],
  ['approved', '승인'],
  ['rejected', '반려'],
] as const;
type RefundStatus = (typeof tabs)[number][0];
const orderTypeLabel: Record<string, string> = { application: '챌린지 신청', ad: '광고' };

export function AdminRefundsScreen() {
  const [status, setStatus] = useState<RefundStatus>('requested');
  const [approveTarget, setApproveTarget] = useState<AdminRefundRequest | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AdminRefundRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const toast = useToast();
  const queryClient = useQueryClient();

  const listQuery = generated.useListAdminRefundRequests({ status });
  const rows = listQuery.data?.data ?? [];

  const done = (message: string) => {
    toast.success(message);
    setApproveTarget(null);
    closeReject();
    void queryClient.invalidateQueries({
      queryKey: generated.getListAdminRefundRequestsQueryKey(),
    });
  };
  const failed = (error: unknown) => {
    toast.error('처리에 실패했어요', apiErrorMessage(error, '잠시 후 다시 시도해주세요'));
    // 동시 처리로 이미 상태가 바뀐 경우를 위해 목록을 새로 받는다.
    void queryClient.invalidateQueries({
      queryKey: generated.getListAdminRefundRequestsQueryKey(),
    });
  };
  const approveMutation = generated.useApproveRefundRequest({
    mutation: { onSuccess: () => done('환불을 승인하고 결제를 취소했어요.'), onError: failed },
  });
  const rejectMutation = generated.useRejectRefundRequest({
    mutation: { onSuccess: () => done('환불 요청을 반려했어요.'), onError: failed },
  });
  const pending = approveMutation.isPending || rejectMutation.isPending;

  const closeReject = () => {
    setRejectTarget(null);
    setRejectReason('');
  };
  const submitReject = () => {
    const reason = rejectReason.trim();
    if (!rejectTarget || !reason) return;
    rejectMutation.mutate({ id: rejectTarget.id, data: { reason } });
  };

  return (
    <>
      <AdminPageTitle>환불 처리</AdminPageTitle>
      <TabBar role="tablist" aria-label="환불 요청 상태">
        {tabs.map(([value, label]) => (
          <TabItem
            key={value}
            role="tab"
            aria-selected={status === value}
            active={status === value || undefined}
            onClick={() => setStatus(value)}
          >
            {label}
          </TabItem>
        ))}
      </TabBar>
      <ListBox>
        <List>
          {rows.map((row) => (
            <Item key={row.id}>
              <Info>
                <Top>
                  <strong>{row.requesterName ?? '탈퇴한 사용자'}</strong>
                  <Meta>{row.requesterEmail}</Meta>
                  <Pill>{orderTypeLabel[row.orderType] ?? row.orderType}</Pill>
                </Top>
                <Reason>{row.reason}</Reason>
                <Meta>
                  요청 {new Date(row.createdAt).toLocaleString('ko-KR')}
                  {row.processedAt &&
                    ` · 처리 ${new Date(row.processedAt).toLocaleString('ko-KR')}`}
                  {row.adminNote && ` · 반려 사유: ${row.adminNote}`}
                </Meta>
              </Info>
              <Amount>
                {won(row.refundableAmount)}
                {row.refundableAmount !== row.amount && <Meta>주문 {won(row.amount)}</Meta>}
              </Amount>
              {row.status === 'requested' && (
                <Actions>
                  <RejectButton onClick={() => setRejectTarget(row)} disabled={pending}>
                    반려
                  </RejectButton>
                  <ApproveButton onClick={() => setApproveTarget(row)} disabled={pending}>
                    승인
                  </ApproveButton>
                </Actions>
              )}
            </Item>
          ))}
          {listQuery.isPending ? (
            <Empty>불러오는 중...</Empty>
          ) : listQuery.isError ? (
            <Empty role="alert">
              환불 요청을 불러오지 못했어요.{' '}
              <button type="button" onClick={() => void listQuery.refetch()}>
                다시 시도
              </button>
            </Empty>
          ) : rows.length === 0 ? (
            <Empty>해당 상태의 환불 요청이 없습니다.</Empty>
          ) : null}
        </List>
      </ListBox>

      {approveTarget && (
        <Overlay
          role="dialog"
          aria-modal="true"
          aria-labelledby="refund-approve-title"
          onClick={() => setApproveTarget(null)}
        >
          <Dialog onClick={(event) => event.stopPropagation()} style={{ width: 360 }}>
            <DialogTitle id="refund-approve-title">환불을 승인할까요?</DialogTitle>
            <Meta>
              {approveTarget.requesterName ?? '탈퇴한 사용자'} ·{' '}
              {won(approveTarget.refundableAmount)}
            </Meta>
            <Notice>
              토스페이먼츠 결제가 즉시 취소되고 되돌릴 수 없어요. 광고 주문이면 진행 중인 광고도
              종료돼요.
            </Notice>
            <Buttons>
              <CancelButton onClick={() => setApproveTarget(null)}>취소</CancelButton>
              <ApproveButton
                onClick={() => approveMutation.mutate({ id: approveTarget.id })}
                disabled={pending}
              >
                {approveMutation.isPending ? '처리 중…' : '승인하고 결제 취소'}
              </ApproveButton>
            </Buttons>
          </Dialog>
        </Overlay>
      )}

      {rejectTarget && (
        <Overlay
          role="dialog"
          aria-modal="true"
          aria-labelledby="refund-reject-title"
          onClick={closeReject}
        >
          <Dialog onClick={(event) => event.stopPropagation()} style={{ width: 360 }}>
            <DialogTitle id="refund-reject-title">환불 요청을 반려할까요?</DialogTitle>
            <Label htmlFor="refund-reject-reason">반려 사유</Label>
            <Textarea
              id="refund-reject-reason"
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="구매자에게 전달될 반려 사유를 입력해주세요"
              rows={3}
              maxLength={1000}
              autoFocus
            />
            <Buttons>
              <CancelButton onClick={closeReject}>취소</CancelButton>
              <RejectButton onClick={submitReject} disabled={pending || !rejectReason.trim()}>
                {rejectMutation.isPending ? '처리 중…' : '반려'}
              </RejectButton>
            </Buttons>
          </Dialog>
        </Overlay>
      )}
    </>
  );
}

const TabBar = styled.div({ display: 'flex', gap: 8 });
const TabItem = styled.button<{ active?: boolean }>(({ active }) => ({
  width: 90,
  padding: '8px 10px',
  borderRadius: 6,
  border: `0.5px solid ${c.gray200}`,
  background: active ? c.surface : c.white,
  ...textStyle.subtitle,
  color: c.gray900,
  cursor: 'pointer',
}));
const ListBox = styled.div({
  border: `0.5px solid ${c.gray200}`,
  borderRadius: 8,
  overflow: 'hidden',
});
const List = styled.ul({
  display: 'flex',
  flexDirection: 'column',
  listStyle: 'none',
  margin: 0,
  padding: 0,
});
const Item = styled.li({
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  padding: '18px 16px',
  background: c.white,
  '& + &': { borderTop: `0.5px solid ${c.gray200}` },
});
const Info = styled.div({ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 });
const Top = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  ...textStyle.body,
  color: c.gray900,
});
const Meta = styled.span({ ...textStyle.metaText, color: c.gray500 });
const Reason = styled.p({ margin: 0, ...textStyle.body, color: c.gray900, whiteSpace: 'pre-wrap' });
const Pill = styled.span({
  height: 21,
  padding: '4px 10px',
  borderRadius: 20,
  background: c.paleBlue,
  color: c.primary,
  ...textStyle.finePrint,
});
const Amount = styled.div({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  flexShrink: 0,
  ...textStyle.subtitle,
  color: c.gray900,
});
const Actions = styled.div({ display: 'flex', gap: 8, flexShrink: 0 });
const Empty = styled.li({
  padding: 16,
  textAlign: 'center',
  color: c.gray500,
  ...textStyle.body,
});
const Overlay = styled.div({
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.2)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100,
});
const Dialog = styled.div({
  background: c.white,
  border: `0.5px solid ${c.gray200}`,
  borderRadius: 6,
  padding: 24,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
});
const DialogTitle = styled.h2({ margin: 0, ...textStyle.h3_2, color: c.gray900 });
const Notice = styled.p({ margin: 0, ...textStyle.bodySmall, color: c.gray700 });
const Buttons = styled.div({ display: 'flex', gap: 8, justifyContent: 'flex-end' });
const CancelButton = styled(ApproveButton)({
  background: c.white,
  color: c.gray700,
  border: `0.5px solid ${c.gray300}`,
});
const Label = styled.label({ ...textStyle.metaText, color: c.gray500 });
const Textarea = styled.textarea({
  resize: 'vertical',
  padding: '10px 12px',
  border: `0.5px solid ${c.gray200}`,
  borderRadius: 8,
  color: c.gray900,
  ...textStyle.bodySmall,
  '&:focus': { outline: 'none', borderColor: c.primary },
});
