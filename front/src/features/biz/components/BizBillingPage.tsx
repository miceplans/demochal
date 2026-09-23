'use client';

import { useState } from 'react';
import styled from '@emotion/styled';
import { generated } from '@semochal/api-client';
import { BizContent, SectionTitle, TableBox, THead, TRow } from '@/components/biz/BizShell';
import { BizPaymentCard } from '@/components/biz/BizPaymentCard';
import { Button } from '@/components/common/Primitives';
import { useToast } from '@/components/common/Toast';
import { requestTossBillingAuth } from '@/lib/payments';
import { won } from '@/data/biz-design';
import { colors as c } from '@/styles/design';

const Col = ({ w, children }: { w?: number; children: React.ReactNode }) => (
  <span style={{ width: w, flexShrink: 0 }}>{children}</span>
);

function formatPaidAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function BizBillingPage() {
  const toast = useToast();
  const [registering, setRegistering] = useState(false);
  const cardsQuery = generated.useListPaymentCards();
  const historyQuery = generated.useListPaymentHistory();
  const cards = cardsQuery.data?.data ?? [];
  const history = historyQuery.data?.data;

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
    } catch {
      toast.error('카드 등록을 시작하지 못했어요', '잠시 후 다시 시도해주세요');
    } finally {
      setRegistering(false);
    }
  };

  return (
    <BizContent>
      <Grid>
        <SideColumn>
          <SectionTitle>나의 결제수단</SectionTitle>
          {cardsQuery.isLoading && <StatusText>결제수단을 불러오는 중이에요.</StatusText>}
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
        </SideColumn>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32, flex: 1, minWidth: 0 }}>
          <SectionHeader>
            <SectionTitle>결제 내역</SectionTitle>
            {history && <TotalText>총액 {won(history.total)}</TotalText>}
          </SectionHeader>
          <TableBox>
            <THead>
              <Col w={300}>결제 항목</Col>
              <Col w={180}>일시</Col>
              <Col w={120}>금액</Col>
            </THead>
            {historyQuery.isLoading && (
              <TRow>
                <Col>결제 내역을 불러오는 중이에요.</Col>
              </TRow>
            )}
            {historyQuery.isError && (
              <TRow>
                <Col>결제 내역을 불러오지 못했어요.</Col>
              </TRow>
            )}
            {history?.items.map((p) => (
              <TRow key={p.id}>
                <Col w={300}>
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      display: 'block',
                    }}
                  >
                    {p.name}
                  </span>
                </Col>
                <Col w={180}>
                  <span style={{ fontSize: 13, color: c.gray500 }}>
                    {p.paidAt ? formatPaidAt(p.paidAt) : '—'}
                  </span>
                </Col>
                <Col w={120}>
                  <strong style={{ color: p.amount > 0 ? c.green : c.gray900 }}>
                    {won(p.amount)}
                  </strong>
                </Col>
              </TRow>
            ))}
            {history && history.items.length === 0 && (
              <TRow>
                <Col>결제 내역이 없어요.</Col>
              </TRow>
            )}
          </TableBox>
        </div>
      </Grid>
    </BizContent>
  );
}

const Grid = styled.div({ display: 'flex', gap: 32, alignItems: 'flex-start' });

const SideColumn = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 32,
  flexShrink: 0,
  alignItems: 'flex-start',
});

const SectionHeader = styled.div({
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: 16,
});

const TotalText = styled.span({
  fontSize: 14,
  color: c.gray500,
});

const StatusText = styled.p({
  margin: 0,
  fontSize: 14,
  color: c.gray500,
});
