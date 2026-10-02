'use client';

import { useEffect, useState } from 'react';
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
          {historyQuery.isLoading && <Empty>결제 내역을 불러오는 중이에요.</Empty>}
          {historyQuery.isError && <Empty>결제 내역을 불러오지 못했어요.</Empty>}
          {history?.items.map((p) => (
            <PaymentItem key={p.id}>
              <Ellipsis>{p.name}</Ellipsis>
              <span style={{ flexShrink: 0, color: p.amount > 0 ? c.green : c.red }}>
                {won(p.amount)}
              </span>
            </PaymentItem>
          ))}
          {history && history.items.length === 0 && <Empty>결제 내역이 없어요.</Empty>}
        </PaymentList>
      </Column>
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
