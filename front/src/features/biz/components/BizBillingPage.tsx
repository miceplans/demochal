'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { LoadingState } from '@/components/common/LoadingState';
import styled from '@emotion/styled';
import { generated } from '@semochal/api-client';
import type { AdReport } from '@semochal/api-client';
import { BizContent, SectionTitle } from '@/components/biz/BizShell';
import { ExposureChart } from '@/components/biz/ExposureChart';
import { BizPaymentCard } from '@/components/biz/BizPaymentCard';
import { Button } from '@/components/common/Primitives';
import { useToast } from '@/components/common/Toast';
import { requestTossBillingAuth } from '@/lib/payments';
import { apiErrorMessage } from '@/lib/api-error';
import { won } from '@/data/biz-design';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { adApi } from '@/lib/ad-api';

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const weekdayLabel = (date: string) => WEEKDAYS[new Date(date).getDay()] ?? date;

export function BizBillingPage() {
  const toast = useToast();
  const [registering, setRegistering] = useState(false);
  const cardsQuery = generated.useListPaymentCards();
  const historyQuery = generated.useListPaymentHistory();
  const cards = cardsQuery.data?.data ?? [];
  const history = historyQuery.data?.data;
  const queryClient = useQueryClient();
  // 환불 요청 대상 결제(orderId 기준)와 입력한 사유. 승인·반려는 관리자가 처리한다.
  const [refundTarget, setRefundTarget] = useState<{ orderId: string; name: string } | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const refundMutation = generated.useCreateRefundRequest({
    mutation: {
      onSuccess: () => {
        toast.success('환불을 요청했어요', '관리자 확인 후 결과를 알림으로 알려드려요');
        setRefundTarget(null);
        setRefundReason('');
      },
      onError: (error) =>
        toast.error('환불 요청에 실패했어요', apiErrorMessage(error, '잠시 후 다시 시도해주세요')),
      onSettled: () =>
        queryClient.invalidateQueries({ queryKey: generated.getListPaymentHistoryQueryKey() }),
    },
  });
  const [ctrReport, setCtrReport] = useState<AdReport | null>(null);
  // 가장 최근 광고의 일별 클릭률로 클릭률 차트를 그린다.
  useEffect(() => {
    let cancelled = false;
    void adApi.ads
      .listMine()
      .then((ads) => (ads[0] ? adApi.ads.getReport(ads[0].id) : null))
      .then((report) => {
        if (!cancelled) setCtrReport(report);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // 토스 빌링 인증창 → 성공 시 /biz/billing/auth/success으로 authKey와 함께 리다이렉트.
  const handleRegister = async () => {
    setRegistering(true);
    try {
      const { data } = await generated.getBillingCustomerKey();
      const started = await requestTossBillingAuth(data.customerKey);
      if (!started) {
        toast.error(
          '카드 등록을 시작할 수 없어요',
          'NEXT_PUBLIC_TOSS_CLIENT_KEY가 설정되지 않았어요',
        );
      }
    } catch (error) {
      toast.error(
        '카드 등록을 시작하지 못했어요',
        apiErrorMessage(error, '잠시 후 다시 시도해주세요'),
      );
    } finally {
      setRegistering(false);
    }
  };

  return (
    <BizContent style={{ gap: 40 }}>
      <TopRow>
        <Column>
          <SectionTitle>나의 결제수단</SectionTitle>
          {cardsQuery.isLoading && <LoadingState label="결제수단을 불러오는 중이에요." />}
          {cardsQuery.isError && <StatusText>결제수단을 불러오지 못했어요.</StatusText>}
          {cards.map((card) => (
            <BizPaymentCard
              key={card.id}
              label="카드"
              amount={card.cardName ?? '등록된 카드'}
              maskedNumber={card.maskedNumber}
              cardName={card.cardName}
            />
          ))}
          {!cardsQuery.isLoading && !cardsQuery.isError && cards.length === 0 && (
            <StatusText>등록된 결제수단이 없어요.</StatusText>
          )}
          <Button onClick={() => void handleRegister()} disabled={registering}>
            {registering ? '처리 중…' : '카드 등록'}
          </Button>
        </Column>
        <ChartColumn>
          <ChartHeader>
            <SectionTitle>광고 클릭률</SectionTitle>
            {ctrReport && <CtrBadge>{ctrReport.totals.ctr}%</CtrBadge>}
          </ChartHeader>
          <ExposureChart
            bars={(ctrReport?.daily ?? []).slice(-7).map((row) => ({
              label: weekdayLabel(row.date),
              value: row.ctr,
            }))}
            width={640}
            height={160}
            smooth={false}
          />
        </ChartColumn>
      </TopRow>
      <Column style={{ width: '100%' }}>
        <SectionHeader>
          <SectionTitle>결제 내역</SectionTitle>
          {history && <TotalText>총액 {won(history.total)}</TotalText>}
        </SectionHeader>
        <PaymentList>
          {historyQuery.isLoading && <LoadingState label="결제 내역을 불러오는 중이에요." />}
          {historyQuery.isError && <Empty>결제 내역을 불러오지 못했어요.</Empty>}
          {history?.items.map((p) => (
            <PaymentItem key={p.id}>
              <Ellipsis>{p.name}</Ellipsis>
              <span style={{ flexShrink: 0, color: p.amount > 0 ? c.green : c.red }}>
                {won(p.amount)}
              </span>
              {p.status === 'paid' && (
                <RefundButton
                  type="button"
                  onClick={() => setRefundTarget({ orderId: p.orderId, name: p.name })}
                >
                  환불 요청
                </RefundButton>
              )}
            </PaymentItem>
          ))}
          {history && history.items.length === 0 && <Empty>결제 내역이 없어요.</Empty>}
        </PaymentList>
      </Column>
      {refundTarget && (
        <RefundOverlay
          role="dialog"
          aria-modal="true"
          aria-labelledby="refund-request-title"
          onClick={() => setRefundTarget(null)}
        >
          <RefundDialog onClick={(event) => event.stopPropagation()}>
            <RefundTitle id="refund-request-title">환불을 요청할까요?</RefundTitle>
            <StatusText>{refundTarget.name}</StatusText>
            <StatusText>관리자가 확인한 뒤 승인하면 결제가 취소돼요.</StatusText>
            <RefundTextarea
              aria-label="환불 사유"
              value={refundReason}
              onChange={(event) => setRefundReason(event.target.value)}
              placeholder="환불 사유를 입력해주세요"
              rows={3}
              maxLength={1000}
              autoFocus
            />
            <RefundActions>
              <Button tone="outline" onClick={() => setRefundTarget(null)}>
                취소
              </Button>
              <Button
                disabled={refundMutation.isPending || !refundReason.trim()}
                onClick={() =>
                  refundMutation.mutate({
                    id: refundTarget.orderId,
                    data: { reason: refundReason.trim() },
                  })
                }
              >
                {refundMutation.isPending ? '요청 중…' : '환불 요청'}
              </Button>
            </RefundActions>
          </RefundDialog>
        </RefundOverlay>
      )}
    </BizContent>
  );
}

const TopRow = styled.div({ display: 'flex', alignItems: 'flex-start', gap: 48 });
const Column = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 32,
  alignItems: 'flex-start',
});
const ChartColumn = styled.div({
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
});
const ChartHeader = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
});
const CtrBadge = styled.strong({ ...textStyle.h1_2, color: c.gray900 });
const SectionHeader = styled.div({
  width: '100%',
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: 16,
});
const TotalText = styled.span({ fontSize: 13, color: c.gray500 });
const StatusText = styled.p({ margin: 0, fontSize: 14, color: c.gray500 });
const PaymentList = styled.ul({
  width: '100%',
  margin: 0,
  padding: 0,
  listStyle: 'none',
  border: `0.5px solid ${c.gray200}`,
  borderRadius: 12,
  overflow: 'hidden',
  ...textStyle.bodyLarge,
});
const PaymentItem = styled.li({
  height: 56,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  padding: '0 16px',
  background: c.white,
  '& + &': { borderTop: `0.5px solid ${c.gray200}` },
});
const Ellipsis = styled.span({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});
const Empty = styled.li({ padding: 16, listStyle: 'none', color: c.gray500 });
const RefundButton = styled.button({
  flexShrink: 0,
  height: 32,
  padding: '0 12px',
  border: `0.5px solid ${c.gray300}`,
  borderRadius: 6,
  background: c.white,
  color: c.gray700,
  cursor: 'pointer',
  ...textStyle.bodySmall,
  '&:hover': { background: c.gray50 },
});
const RefundOverlay = styled.div({
  position: 'fixed',
  inset: 0,
  zIndex: 100,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(0,0,0,0.2)',
});
const RefundDialog = styled.div({
  width: 400,
  maxWidth: 'calc(100vw - 32px)',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: 24,
  borderRadius: 12,
  background: c.white,
});
const RefundTitle = styled.h2({ margin: 0, ...textStyle.h3_2, color: c.gray900 });
const RefundTextarea = styled.textarea({
  resize: 'vertical',
  padding: '10px 12px',
  border: `0.5px solid ${c.gray200}`,
  borderRadius: 8,
  color: c.gray900,
  ...textStyle.bodySmall,
  '&:focus': { outline: 'none', borderColor: c.primary },
});
const RefundActions = styled.div({ display: 'flex', justifyContent: 'flex-end', gap: 8 });
